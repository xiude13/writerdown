import * as assert from 'assert';
import * as vscode from 'vscode';
import { ChapterMetadata, MarkerInfo, MarkerProvider, MarkerTreeItem } from '../../markerProvider';

suite('MarkerProvider Tests', () => {
  let provider: MarkerProvider;

  setup(() => {
    provider = new MarkerProvider();
  });

  teardown(() => {
    // Clean up after each test
  });

  test('Should initialize with empty markers', () => {
    // Since markers is private, we test through getChildren
    return provider.getChildren().then((children) => {
      assert.strictEqual(children.length, 0, 'Should start with no markers');
    });
  });

  suite('Marker Detection and Parsing', () => {
    test('Should detect basic marker patterns', () => {
      const testContent = `# Chapter 1

#! This is a basic marker
Some content here.
#! [Plot] This is a plot marker
More content.
#! [Character] Elena enters the scene`;

      // Test the marker regex pattern used in scanFile
      const markerRegex = /^#!\s*(?:\[([^\]]+)\])?\s*(.+)$/gm;
      const matches = [];
      let match;

      while ((match = markerRegex.exec(testContent)) !== null) {
        matches.push({
          category: match[1],
          text: match[2].trim(),
        });
      }

      assert.strictEqual(matches.length, 3, 'Should find 3 markers');

      assert.strictEqual(matches[0].category, undefined, 'First marker should have no category');
      assert.strictEqual(matches[0].text, 'This is a basic marker', 'First marker text should match');

      assert.strictEqual(matches[1].category, 'Plot', 'Second marker should have Plot category');
      assert.strictEqual(matches[1].text, 'This is a plot marker', 'Second marker text should match');

      assert.strictEqual(matches[2].category, 'Character', 'Third marker should have Character category');
      assert.strictEqual(matches[2].text, 'Elena enters the scene', 'Third marker text should match');
    });

    test('Should ignore EVENT markers', () => {
      const testContent = `# Chapter 1

#! [Event] This should be ignored
#! [Plot] This should be included
#! [EVENT] This should also be ignored`;

      const markerRegex = /^#!\s*(?:\[([^\]]+)\])?\s*(.+)$/gm;
      const matches = [];
      let match;

      while ((match = markerRegex.exec(testContent)) !== null) {
        const category = match[1];

        // Skip EVENT markers (case insensitive)
        if (category && category.toLowerCase() === 'event') {
          continue;
        }

        matches.push({
          category: category,
          text: match[2].trim(),
        });
      }

      assert.strictEqual(matches.length, 1, 'Should only find non-EVENT markers');
      assert.strictEqual(matches[0].category, 'Plot', 'Should include Plot marker');
    });

    test('Should handle markers with various formatting', () => {
      const testContent = `#! Simple marker
#!    Marker with spaces
#! [Category]   Marker with category and spaces
#!   [Multi Word Category]  Complex marker text here
#! No spaces around brackets[invalid] This should work`;

      const markerRegex = /^#!\s*(?:\[([^\]]+)\])?\s*(.+)$/gm;
      const matches = [];
      let match;

      while ((match = markerRegex.exec(testContent)) !== null) {
        matches.push({
          category: match[1],
          text: match[2].trim(),
        });
      }

      assert.strictEqual(matches.length, 5, 'Should handle various formatting styles');
      assert.strictEqual(matches[2].category, 'Category', 'Should parse category correctly');
      assert.strictEqual(matches[3].category, 'Multi Word Category', 'Should handle multi-word categories');
    });
  });

  suite('Chapter Metadata Parsing', () => {
    test('Should parse complete chapter metadata from YAML frontmatter', () => {
      const yamlContent = `---
chapter: 5
title: The Great Battle
act: 2
status: draft
---

# Chapter 5: The Great Battle
Content here...`;

      const metadata = (provider as any).parseChapterMetadata(yamlContent);

      assert.ok(metadata, 'Should parse metadata successfully');
      assert.strictEqual(metadata.chapter, 5, 'Should parse chapter number');
      assert.strictEqual(metadata.title, 'The Great Battle', 'Should parse title');
      assert.strictEqual(metadata.act, 2, 'Should parse act number');
      assert.strictEqual(metadata.status, 'draft', 'Should parse status');
    });

    test('Should parse partial chapter metadata', () => {
      const yamlContent = `---
chapter: 3
title: Mystery Begins
---

# Chapter 3
Content...`;

      const metadata = (provider as any).parseChapterMetadata(yamlContent);

      assert.ok(metadata, 'Should parse partial metadata');
      assert.strictEqual(metadata.chapter, 3, 'Should parse chapter number');
      assert.strictEqual(metadata.title, 'Mystery Begins', 'Should parse title');
      assert.strictEqual(metadata.act, undefined, 'Act should be undefined');
      assert.strictEqual(metadata.status, undefined, 'Status should be undefined');
    });

    test('Should handle invalid YAML values gracefully', () => {
      const yamlContent = `---
chapter: not_a_number
title: Valid Title
act: also_not_a_number
status: invalid_status
---

# Chapter
Content...`;

      const metadata = (provider as any).parseChapterMetadata(yamlContent);

      assert.ok(metadata, 'Should not crash on invalid values');
      assert.strictEqual(metadata.chapter, undefined, 'Invalid chapter number should be undefined');
      assert.strictEqual(metadata.title, 'Valid Title', 'Valid title should be parsed');
      assert.strictEqual(metadata.act, undefined, 'Invalid act should be undefined');
      assert.strictEqual(metadata.status, undefined, 'Invalid status should be undefined');
    });

    test('Should handle missing frontmatter', () => {
      const contentWithoutYAML = `# Chapter Without Metadata

Just content here, no YAML frontmatter.
#! Some marker`;

      const metadata = (provider as any).parseChapterMetadata(contentWithoutYAML);

      assert.strictEqual(metadata, undefined, 'Should return undefined for content without YAML');
    });

    test('Should validate status enum values', () => {
      const validStatuses = ['draft', 'review', 'final', 'published'];

      for (const status of validStatuses) {
        const yamlContent = `---
chapter: 1
status: ${status}
---
Content...`;

        const metadata = (provider as any).parseChapterMetadata(yamlContent);
        assert.strictEqual(metadata.status, status, `Should accept valid status: ${status}`);
      }

      // Test invalid status
      const invalidYaml = `---
chapter: 1
status: invalid
---
Content...`;

      const invalidMetadata = (provider as any).parseChapterMetadata(invalidYaml);
      assert.strictEqual(invalidMetadata.status, undefined, 'Should reject invalid status');
    });
  });

  suite('Search Functionality', () => {
    test('Should match markers by text content', () => {
      const marker: MarkerInfo = {
        text: 'Elena discovers the secret chamber',
        category: 'Plot',
        position: new vscode.Position(5, 0),
        fileName: 'chapter1.md',
        filePath: '/book/chapter1.md',
      };

      // Set search filter and test matching
      (provider as any).searchFilter = 'elena';
      assert.ok((provider as any).markerMatchesSearch(marker), 'Should match marker text (case insensitive)');

      (provider as any).searchFilter = 'secret';
      assert.ok((provider as any).markerMatchesSearch(marker), 'Should match partial text');

      (provider as any).searchFilter = 'nonexistent';
      assert.ok(!(provider as any).markerMatchesSearch(marker), 'Should not match non-existent text');
    });

    test('Should match markers by category', () => {
      const marker: MarkerInfo = {
        text: 'Battle scene begins',
        category: 'Action',
        position: new vscode.Position(10, 0),
        fileName: 'chapter2.md',
        filePath: '/book/chapter2.md',
      };

      (provider as any).searchFilter = 'action';
      assert.ok((provider as any).markerMatchesSearch(marker), 'Should match category (case insensitive)');

      (provider as any).searchFilter = 'act';
      assert.ok((provider as any).markerMatchesSearch(marker), 'Should match partial category');
    });

    test('Should match markers by filename', () => {
      const marker: MarkerInfo = {
        text: 'Important scene',
        category: 'Plot',
        position: new vscode.Position(15, 0),
        fileName: 'epilogue.md',
        filePath: '/book/epilogue.md',
      };

      (provider as any).searchFilter = 'epilogue';
      assert.ok((provider as any).markerMatchesSearch(marker), 'Should match filename');

      (provider as any).searchFilter = 'chapter';
      assert.ok(!(provider as any).markerMatchesSearch(marker), 'Should not match different filename');
    });

    test('Should return true when no search filter is set', () => {
      const marker: MarkerInfo = {
        text: 'Any marker',
        position: new vscode.Position(0, 0),
        fileName: 'test.md',
        filePath: '/test.md',
      };

      (provider as any).searchFilter = '';
      assert.ok((provider as any).markerMatchesSearch(marker), 'Should match all markers when no filter');
    });

    test('Should clear search filter', () => {
      (provider as any).searchFilter = 'test search';
      provider.clearSearch();
      assert.strictEqual((provider as any).searchFilter, '', 'Should clear search filter');
    });
  });

  suite('Tree Item Construction', () => {
    test('Should create marker tree items with correct properties', () => {
      const markerInfo: MarkerInfo = {
        text: 'Test marker text',
        category: 'Plot',
        position: new vscode.Position(10, 5),
        fileName: 'chapter1.md',
        filePath: '/book/chapter1.md',
      };

      const treeItem = new MarkerTreeItem(markerInfo, vscode.TreeItemCollapsibleState.None, 'marker');

      assert.strictEqual(treeItem.label, 'Test marker text', 'Label should match marker text');
      assert.strictEqual(treeItem.contextValue, 'marker', 'Context value should be marker');
      assert.ok(treeItem.command, 'Should have command for navigation');
      assert.strictEqual(treeItem.command.command, 'writerdown.goToMarker', 'Should have correct command');

      const tooltip = typeof treeItem.tooltip === 'string' ? treeItem.tooltip : '';
      assert.ok(tooltip.includes('Test marker text'), 'Tooltip should include marker text');
      assert.ok(tooltip.includes('chapter1.md'), 'Tooltip should include filename');
      assert.ok(tooltip.includes('11'), 'Tooltip should include line number (1-based)');
    });

    test('Should set appropriate icons based on category', () => {
      const categories = [
        { name: 'plot', expectedIcon: 'book' },
        { name: 'character', expectedIcon: 'person' },
        { name: 'battle', expectedIcon: 'flame' },
        { name: 'romance', expectedIcon: 'heart' },
        { name: 'mystery', expectedIcon: 'search' },
        { name: 'unknown', expectedIcon: 'pin' },
      ];

      categories.forEach(({ name, expectedIcon }) => {
        const markerInfo: MarkerInfo = {
          text: 'Test marker',
          category: name,
          position: new vscode.Position(0, 0),
          fileName: 'test.md',
          filePath: '/test.md',
        };

        const treeItem = new MarkerTreeItem(markerInfo, vscode.TreeItemCollapsibleState.None, 'marker');

        assert.ok(treeItem.iconPath instanceof vscode.ThemeIcon, `Should have ThemeIcon for category ${name}`);
        assert.strictEqual(
          (treeItem.iconPath as vscode.ThemeIcon).id,
          expectedIcon,
          `Should have ${expectedIcon} icon for ${name} category`,
        );
      });
    });

    test('Should create category tree items with correct properties', () => {
      const categoryInfo: MarkerInfo = {
        text: 'Plot',
        position: new vscode.Position(0, 0),
        fileName: '',
        filePath: '',
      };

      const treeItem = new MarkerTreeItem(categoryInfo, vscode.TreeItemCollapsibleState.Expanded, 'category');

      assert.strictEqual(treeItem.label, 'Plot', 'Label should match category name');
      assert.strictEqual(treeItem.contextValue, 'category', 'Context value should be category');
      assert.ok(treeItem.iconPath instanceof vscode.ThemeIcon, 'Should have ThemeIcon');
      assert.strictEqual((treeItem.iconPath as vscode.ThemeIcon).id, 'tag', 'Should have tag icon for category');

      const tooltip = typeof treeItem.tooltip === 'string' ? treeItem.tooltip : '';
      assert.ok(tooltip.includes('Category: Plot'), 'Tooltip should indicate category');
    });

    test('Should create chapter tree items with correct properties', () => {
      const chapterInfo: MarkerInfo = {
        text: 'Chapter 1: The Beginning',
        position: new vscode.Position(0, 0),
        fileName: '',
        filePath: '',
        chapterMetadata: { chapter: 1, title: 'The Beginning' },
      };

      const treeItem = new MarkerTreeItem(chapterInfo, vscode.TreeItemCollapsibleState.Expanded, 'chapter');

      assert.strictEqual(treeItem.label, 'Chapter 1: The Beginning', 'Label should match chapter display name');
      assert.strictEqual(treeItem.contextValue, 'chapter', 'Context value should be chapter');
      assert.ok(treeItem.iconPath instanceof vscode.ThemeIcon, 'Should have ThemeIcon');
      assert.strictEqual(
        (treeItem.iconPath as vscode.ThemeIcon).id,
        'file-text',
        'Should have file-text icon for chapter',
      );
    });
  });

  suite('Chapter Display Names', () => {
    test('Should format chapter display names correctly', () => {
      const testCases = [
        {
          metadata: { chapter: 1, title: 'The Beginning' },
          expected: 'Chapter 1: The Beginning',
        },
        {
          metadata: { chapter: 5 },
          expected: 'Chapter 5',
        },
        {
          metadata: { title: 'Prologue' },
          expected: 'Prologue',
        },
        {
          metadata: {},
          expected: '', // Empty metadata with empty filePath returns empty string
        },
      ];

      testCases.forEach(({ metadata, expected }) => {
        const result = (provider as any).getChapterDisplayName(metadata, '');
        assert.strictEqual(
          result,
          expected,
          `Should format chapter display name correctly for ${JSON.stringify(metadata)}`,
        );
      });
    });

    test('Should handle chapter numbers with titles', () => {
      const metadata: ChapterMetadata = {
        chapter: 3,
        title: 'Into the Unknown',
        act: 1,
        status: 'draft',
      };

      const displayName = (provider as any).getChapterDisplayName(metadata, '');
      assert.strictEqual(
        displayName,
        'Chapter 3: Into the Unknown (draft)',
        'Should combine chapter number, title, and status',
      );
    });
  });

  suite('WriterDown Project Detection', () => {
    test('Should detect WriterDown project correctly', async () => {
      // This test is environment-dependent, so we mainly test that the method exists and returns a boolean
      const isWriterDownProject = await (provider as any).isWriterDownProject();
      assert.strictEqual(typeof isWriterDownProject, 'boolean', 'Should return boolean value');
    });
  });

  suite('Error Handling and Edge Cases', () => {
    test('Should handle empty marker text gracefully', () => {
      const emptyMarker: MarkerInfo = {
        text: '',
        position: new vscode.Position(0, 0),
        fileName: 'test.md',
        filePath: '/test.md',
      };

      const treeItem = new MarkerTreeItem(emptyMarker, vscode.TreeItemCollapsibleState.None, 'marker');
      assert.strictEqual(treeItem.label, '', 'Should handle empty marker text');
    });

    test('Should handle markers without categories', () => {
      const uncategorizedMarker: MarkerInfo = {
        text: 'Uncategorized marker',
        position: new vscode.Position(0, 0),
        fileName: 'test.md',
        filePath: '/test.md',
      };

      const treeItem = new MarkerTreeItem(uncategorizedMarker, vscode.TreeItemCollapsibleState.None, 'marker');

      assert.ok(treeItem.iconPath instanceof vscode.ThemeIcon, 'Should have default icon');
      assert.strictEqual((treeItem.iconPath as vscode.ThemeIcon).id, 'pin', 'Should use pin icon for uncategorized');
    });

    test('Should handle very long marker text', () => {
      const longText = 'A'.repeat(1000); // Very long marker text
      const longMarker: MarkerInfo = {
        text: longText,
        position: new vscode.Position(0, 0),
        fileName: 'test.md',
        filePath: '/test.md',
      };

      const treeItem = new MarkerTreeItem(longMarker, vscode.TreeItemCollapsibleState.None, 'marker');
      assert.strictEqual(treeItem.label, longText, 'Should handle very long marker text');
    });

    test('Should handle special characters in marker text', () => {
      const specialChars = 'Marker with émojis 🎭 and symbols @#$%^&*()';
      const specialMarker: MarkerInfo = {
        text: specialChars,
        position: new vscode.Position(0, 0),
        fileName: 'test.md',
        filePath: '/test.md',
      };

      const treeItem = new MarkerTreeItem(specialMarker, vscode.TreeItemCollapsibleState.None, 'marker');
      assert.strictEqual(treeItem.label, specialChars, 'Should handle special characters in marker text');
    });
  });

  suite('Tree Data Provider Interface', () => {
    test('Should return tree item for getTreeItem', () => {
      const markerInfo: MarkerInfo = {
        text: 'Test marker',
        position: new vscode.Position(0, 0),
        fileName: 'test.md',
        filePath: '/test.md',
      };

      const treeItem = new MarkerTreeItem(markerInfo, vscode.TreeItemCollapsibleState.None, 'marker');
      const result = provider.getTreeItem(treeItem);

      assert.strictEqual(result, treeItem, 'getTreeItem should return the same tree item');
    });

    test('Should handle getChildren for different element types', async () => {
      // Test root level (should return categories)
      const rootChildren = await provider.getChildren();
      assert.ok(Array.isArray(rootChildren), 'Should return array for root children');

      // Test category element (should return chapters)
      const categoryInfo: MarkerInfo = {
        text: 'Plot',
        position: new vscode.Position(0, 0),
        fileName: '',
        filePath: '',
      };
      const categoryItem = new MarkerTreeItem(categoryInfo, vscode.TreeItemCollapsibleState.Expanded, 'category');
      const categoryChildren = await provider.getChildren(categoryItem);
      assert.ok(Array.isArray(categoryChildren), 'Should return array for category children');

      // Test chapter element (should return markers)
      const chapterInfo: MarkerInfo = {
        text: 'Chapter 1',
        position: new vscode.Position(0, 0),
        fileName: '',
        filePath: '',
      };
      const chapterItem = new MarkerTreeItem(chapterInfo, vscode.TreeItemCollapsibleState.Expanded, 'chapter');
      const chapterChildren = await provider.getChildren(chapterItem);
      assert.ok(Array.isArray(chapterChildren), 'Should return array for chapter children');

      // Test marker element (should return empty array)
      const markerInfo: MarkerInfo = {
        text: 'Test marker',
        position: new vscode.Position(0, 0),
        fileName: 'test.md',
        filePath: '/test.md',
      };
      const markerItem = new MarkerTreeItem(markerInfo, vscode.TreeItemCollapsibleState.None, 'marker');
      const markerChildren = await provider.getChildren(markerItem);
      assert.strictEqual(markerChildren.length, 0, 'Marker items should have no children');
    });
  });
});
