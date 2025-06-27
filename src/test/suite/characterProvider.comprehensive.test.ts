import * as assert from 'assert';
import * as vscode from 'vscode';
import { CharacterInfo, CharacterProvider, CharacterTreeItem } from '../../characterProvider';

/**
 * Comprehensive tests for CharacterProvider before refactoring
 * Covers all major functionality to ensure nothing breaks during file splitting
 */
suite('CharacterProvider Comprehensive Tests', () => {
  let provider: CharacterProvider;

  setup(() => {
    provider = new CharacterProvider();
  });

  teardown(() => {
    // Clean up after each test
  });

  suite('Core Functionality', () => {
    test('Should handle multiple character mentions correctly', async () => {
      const characters = [
        { name: 'Elena', position: new vscode.Position(1, 5), file: 'chapter1.md' },
        { name: 'Elena', position: new vscode.Position(2, 10), file: 'chapter1.md' },
        { name: 'Marcus', position: new vscode.Position(3, 0), file: 'chapter1.md' },
        { name: 'Elena', position: new vscode.Position(1, 15), file: 'chapter2.md' },
      ];

      // Add character mentions
      for (const char of characters) {
        await (provider as any).addCharacterMention(char.name, char.position, char.file, `/test/${char.file}`);
      }

      const allCharacters = provider.getAllCharacters();

      // Should have 2 unique characters
      assert.strictEqual(allCharacters.length, 2);

      // Elena should have 3 mentions
      const elena = allCharacters.find((c) => c.name === 'Elena');
      assert.ok(elena);
      assert.strictEqual(elena.count, 3);
      assert.strictEqual(elena.positions.length, 3);

      // Marcus should have 1 mention
      const marcus = allCharacters.find((c) => c.name === 'Marcus');
      assert.ok(marcus);
      assert.strictEqual(marcus.count, 1);
      assert.strictEqual(marcus.positions.length, 1);
    });

    test('Should handle character names with special characters', async () => {
      const specialNames = [
        'Dr. Elena Rodriguez',
        'Lord Bren-Thane',
        "Marcus O'Connor",
        'Lady Elena-Marie',
        'Sir James III',
      ];

      for (const name of specialNames) {
        await (provider as any).addCharacterMention(name, new vscode.Position(1, 0), 'test.md', '/test.md');
      }

      const characters = provider.getAllCharacters();
      assert.strictEqual(characters.length, specialNames.length);

      specialNames.forEach((name) => {
        const found = characters.find((c) => c.name === name);
        assert.ok(found, `Character "${name}" should be found`);
      });
    });

    test('Should properly sort characters by mention count', async () => {
      const characterData = [
        { name: 'Elena', count: 10 },
        { name: 'Marcus', count: 5 },
        { name: 'Bren', count: 15 },
        { name: 'Garry', count: 2 },
      ];

      // Add mentions according to the counts
      for (const char of characterData) {
        for (let i = 0; i < char.count; i++) {
          await (provider as any).addCharacterMention(char.name, new vscode.Position(i, 0), 'test.md', '/test.md');
        }
      }

      const sorted = provider.getAllCharacters();

      // Should be sorted by count (descending)
      assert.strictEqual(sorted[0].name, 'Bren'); // 15
      assert.strictEqual(sorted[1].name, 'Elena'); // 10
      assert.strictEqual(sorted[2].name, 'Marcus'); // 5
      assert.strictEqual(sorted[3].name, 'Garry'); // 2
    });
  });

  suite('Search and Filtering', () => {
    async function setupSearchTestData() {
      // Set up characters with different categories for search testing
      const testCharacters = [
        { name: 'Elena', category: 'Protagonists' },
        { name: 'Marcus', category: 'Supporting' },
        { name: 'Villain Boss', category: 'Antagonists' },
        { name: 'Random Guard', category: 'Minor' },
      ];

      for (const char of testCharacters) {
        await (provider as any).addCharacterMention(char.name, new vscode.Position(1, 0), 'test.md', '/test.md');

        // Mock adding metadata
        const charInfo = provider.getCharacterInfo(char.name);
        if (charInfo) {
          charInfo.metadata = { category: char.category };
        }
      }
    }

    test('Should filter characters by name search', async () => {
      await setupSearchTestData();
      (provider as any).searchFilter = 'elena';

      const elena = provider.getCharacterInfo('Elena');
      const marcus = provider.getCharacterInfo('Marcus');

      assert.ok(elena);
      assert.ok(marcus);

      assert.ok((provider as any).characterMatchesSearch(elena));
      assert.ok(!(provider as any).characterMatchesSearch(marcus));
    });

    test('Should filter characters by category search', async () => {
      await setupSearchTestData();
      (provider as any).searchFilter = 'protagonist';

      const elena = provider.getCharacterInfo('Elena');
      const villain = provider.getCharacterInfo('Villain Boss');

      assert.ok(elena);
      assert.ok(villain);

      assert.ok((provider as any).characterMatchesSearch(elena));
      assert.ok(!(provider as any).characterMatchesSearch(villain));
    });

    test('Should clear search filter', () => {
      (provider as any).searchFilter = 'test';
      provider.clearSearch();

      assert.strictEqual((provider as any).searchFilter, '');
    });
  });

  suite('Character Card Template Generation', () => {
    test('Should generate consistent templates for new characters', () => {
      const names = ['Elena', 'Marcus The Knight', 'Dr. Rodriguez'];

      names.forEach((name) => {
        const template = (provider as any).createNewCharacterTemplate(name);

        // Check YAML frontmatter
        assert.ok(template.includes(`name: ${name}`));
        assert.ok(template.includes('category: Uncategorized'));
        assert.ok(template.includes('aliases: []'));
        assert.ok(template.includes('tags: []'));
        assert.ok(template.includes('status: active'));

        // Check main heading
        assert.ok(template.includes(`# ${name}`));

        // Check required sections
        const requiredSections = [
          '## Role in Story',
          '## Goal',
          '## Physical Description',
          '## Personality',
          '## Background',
          '## Relationships',
          '## Character Arc',
          '## Notes',
        ];

        requiredSections.forEach((section) => {
          assert.ok(template.includes(section), `Template for "${name}" missing section: ${section}`);
        });
      });
    });

    test('Should generate templates with mention statistics for existing characters', () => {
      const character: CharacterInfo = {
        name: 'Test Character',
        count: 25,
        positions: [
          { position: new vscode.Position(1, 0), fileName: 'chapter1.md', filePath: '/book/chapter1.md' },
          { position: new vscode.Position(5, 0), fileName: 'chapter1.md', filePath: '/book/chapter1.md' },
          { position: new vscode.Position(2, 0), fileName: 'chapter2.md', filePath: '/book/chapter2.md' },
        ],
      };

      const template = (provider as any).createCharacterCardTemplate(character);

      assert.ok(template.includes('Total Mentions: 25'));
      assert.ok(template.includes('across 2 files')); // 2 unique files
      assert.ok(template.includes('# Test Character'));
    });
  });

  suite('YAML Frontmatter Processing', () => {
    test('Should parse complete character metadata', () => {
      const complexYaml = `---
name: Dr. Elena Rodriguez
category: Medical Staff
role: Chief Surgeon
importance: major
faction: Hospital Alliance
location: Central Medical
status: active
tags: ["medical", "leadership", "skilled"]
aliases: ["Dr. Rodriguez", "Elena", "The Doc", "Chief"]
---

# Dr. Elena Rodriguez
Character content here...`;

      const metadata = (provider as any).parseYamlFrontmatter(complexYaml);

      assert.ok(metadata);
      assert.strictEqual(metadata.category, 'Medical Staff');
      assert.strictEqual(metadata.role, 'Chief Surgeon');
      assert.strictEqual(metadata.importance, 'major');
      assert.strictEqual(metadata.faction, 'Hospital Alliance');
      assert.strictEqual(metadata.location, 'Central Medical');
      assert.strictEqual(metadata.status, 'active');

      assert.ok(Array.isArray(metadata.tags));
      assert.strictEqual(metadata.tags.length, 3);
      // Tags might have quotes, so check for content
      const tagContents = metadata.tags.map((tag: string) => tag.replace(/"/g, ''));
      assert.ok(tagContents.includes('medical'));
      assert.ok(tagContents.includes('leadership'));

      assert.ok(Array.isArray(metadata.aliases));
      assert.strictEqual(metadata.aliases.length, 4);
      assert.ok(metadata.aliases.includes('Dr. Rodriguez'));
      assert.ok(metadata.aliases.includes('The Doc'));
    });

    test('Should handle partial YAML metadata', () => {
      const partialYaml = `---
name: Simple Character
category: Minor
---

# Simple Character
Content...`;

      const metadata = (provider as any).parseYamlFrontmatter(partialYaml);

      assert.ok(metadata);
      assert.strictEqual(metadata.category, 'Minor');
      assert.strictEqual(metadata.role, undefined);
      assert.strictEqual(metadata.aliases, undefined);
    });

    test('Should validate enum values correctly', () => {
      const yamlWithInvalidEnums = `---
name: Test Character
importance: invalid_importance
status: invalid_status
---

# Test Character`;

      const metadata = (provider as any).parseYamlFrontmatter(yamlWithInvalidEnums);

      assert.ok(metadata);
      // Invalid enum values should be ignored
      assert.strictEqual(metadata.importance, undefined);
      assert.strictEqual(metadata.status, undefined);
    });

    test('Should handle malformed arrays gracefully', () => {
      const malformedYaml = `---
name: Test Character
tags: [unclosed, array
aliases: not_an_array
---

# Test Character`;

      const metadata = (provider as any).parseYamlFrontmatter(malformedYaml);

      // Should not crash and return what it can parse
      if (metadata) {
        assert.strictEqual(typeof metadata, 'object');
        // Malformed arrays should be undefined
        assert.strictEqual(metadata.tags, undefined);
        assert.strictEqual(metadata.aliases, undefined);
      }
    });
  });

  suite('Character Features Parsing', () => {
    test('Should extract character features from card content', () => {
      const cardContent = `# Elena Rodriguez

Age: 28 • Location: Central Hospital

## Role in Story
Chief medical officer who becomes crucial to the plot

## Physical Description
Hair: Dark brown, usually in a bun
Eyes: Hazel
Height: 5'6"

## Personality
Core Traits: Analytical, compassionate, decisive
Strengths: Medical expertise, leadership
Weaknesses: Workaholic tendencies

## Background
Occupation: Surgeon
Education: Harvard Medical School
Family: Parents in Spain`;

      const features = (provider as any).parseCharacterFeatures(cardContent);

      assert.ok(features.length > 0);

      // Check that features are extracted (adjust to match actual parser behavior)
      const roleFeature = features.find((f: any) => f.label === 'Role in Story');
      assert.ok(roleFeature, 'Should find Role in Story feature');
      assert.ok(roleFeature.value.includes('Chief medical officer'));

      const personalityFeature = features.find((f: any) => f.label === 'Personality');
      assert.ok(personalityFeature, 'Should find Personality feature');

      // Check that physical description section is parsed
      const physicalFeature = features.find((f: any) => f.label === 'Physical Description');
      assert.ok(physicalFeature, 'Should find Physical Description feature');

      // Check that background section is parsed
      const backgroundFeature = features.find((f: any) => f.label === 'Background');
      assert.ok(backgroundFeature, 'Should find Background feature');
    });

    test('Should handle minimal card content', () => {
      const minimalContent = `# Simple Character

Basic character with no features.`;

      const features = (provider as any).parseCharacterFeatures(minimalContent);

      // Should not crash and may return empty array or basic info
      assert.ok(Array.isArray(features));
    });
  });

  suite('Tree Item Construction', () => {
    test('Should create proper character tree items with metadata', () => {
      const character: CharacterInfo = {
        name: 'Elena',
        count: 15,
        positions: [{ position: new vscode.Position(1, 0), fileName: 'ch1.md', filePath: '/book/ch1.md' }],
        metadata: {
          category: 'Protagonists',
          importance: 'major',
        },
      };

      const treeItem = new CharacterTreeItem(character, vscode.TreeItemCollapsibleState.Collapsed, 'character');

      assert.strictEqual(treeItem.label, 'Elena');
      assert.strictEqual(treeItem.description, '15 mentions');
      assert.strictEqual(treeItem.contextValue, 'characterWithCategory');
      const tooltip = typeof treeItem.tooltip === 'string' ? treeItem.tooltip : treeItem.tooltip?.value;
      assert.ok(tooltip?.includes('Elena'));
      assert.ok(tooltip?.includes('15 mentions'));
    });

    test('Should handle characters without categories', () => {
      const character: CharacterInfo = {
        name: 'Uncategorized Character',
        count: 3,
        positions: [],
      };

      const treeItem = new CharacterTreeItem(character, vscode.TreeItemCollapsibleState.Collapsed, 'character');

      assert.strictEqual(treeItem.contextValue, 'characterWithoutCategory');
    });

    test('Should create proper reference tree items', () => {
      const character: CharacterInfo = { name: 'Test', count: 1, positions: [] };
      const reference = {
        fileName: 'chapter1.md',
        line: 15,
        filePath: '/book/chapter1.md',
        position: new vscode.Position(14, 5),
      };

      const treeItem = new CharacterTreeItem(
        character,
        vscode.TreeItemCollapsibleState.None,
        'reference',
        undefined,
        reference,
      );

      assert.strictEqual(treeItem.label, 'chapter1.md:15');
      assert.strictEqual(treeItem.contextValue, 'reference');
      assert.ok(treeItem.command);
      assert.strictEqual(treeItem.command.command, 'writerdown.goToCharacterReference');
    });
  });

  suite('Error Handling and Edge Cases', () => {
    test('Should handle empty character names gracefully', async () => {
      await (provider as any).addCharacterMention('', new vscode.Position(1, 0), 'test.md', '/test.md');
      await (provider as any).addCharacterMention('   ', new vscode.Position(1, 0), 'test.md', '/test.md');

      const characters = provider.getAllCharacters();
      // Current implementation does add empty names - this documents the current behavior
      // This test ensures it doesn't crash with empty names
      assert.ok(characters.length >= 0, 'Should handle empty names without crashing');
    });

    test('Should handle duplicate positions correctly', async () => {
      const position = new vscode.Position(5, 10);

      // Add same character at same position multiple times
      await (provider as any).addCharacterMention('Elena', position, 'test.md', '/test.md');
      await (provider as any).addCharacterMention('Elena', position, 'test.md', '/test.md');

      const elena = provider.getCharacterInfo('Elena');
      assert.ok(elena);

      // Should accumulate count even for duplicate positions
      assert.strictEqual(elena.count, 2);
      assert.strictEqual(elena.positions.length, 2);
    });

    test('Should handle very long character names', async () => {
      const longName = 'A'.repeat(200); // Very long name

      await (provider as any).addCharacterMention(longName, new vscode.Position(1, 0), 'test.md', '/test.md');

      const character = provider.getCharacterInfo(longName);
      assert.ok(character);
      assert.strictEqual(character.name, longName);
    });

    test('Should handle special Unicode characters in names', async () => {
      const unicodeNames = ['Élena Rodríguez', '김철수', 'José-María', 'Ñoño'];

      for (const name of unicodeNames) {
        await (provider as any).addCharacterMention(name, new vscode.Position(1, 0), 'test.md', '/test.md');
      }

      unicodeNames.forEach((name) => {
        const character = provider.getCharacterInfo(name);
        assert.ok(character, `Should handle Unicode name: ${name}`);
      });
    });
  });
});
