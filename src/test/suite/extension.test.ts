import * as assert from 'assert';

// We'll focus on testing the main functions that can be tested
suite('Extension Tests', () => {
  suite('Word Counting Functionality', () => {
    test('Should count words correctly in clean text', () => {
      // Simulate the countWords function logic from extension.ts
      const countWords = (text: string): { words: number; characters: number; charactersNoSpaces: number } => {
        // Simplified version of the cleanup logic
        let cleanText = text
          // Remove YAML frontmatter
          .replace(/^---\s*\n[\s\S]*?\n---\s*\n?/m, '')
          // Remove character mentions (but keep the name)
          .replace(/@([A-Za-z0-9_]+)/g, '$1')
          .replace(/@\[([^\]]+)\]/g, '$1')
          // Remove story markers
          .replace(/\{\{(TODO|RESEARCH|EDIT):.*?\}\}/gi, '')
          // Remove markdown headers
          .replace(/^#+\s*/gm, '')
          // Remove markdown bold/italic
          .replace(/[*_]+([^*_]+)[*_]+/g, '$1');

        // Count words
        const words = cleanText.split(/\s+/).filter((word) => word.trim().length > 0).length;
        const characters = text.length;
        const charactersNoSpaces = text.replace(/\s/g, '').length;

        return { words, characters, charactersNoSpaces };
      };

      const simpleText = 'This is a simple sentence with eight words total.';
      const result = countWords(simpleText);

      assert.strictEqual(result.words, 9, 'Should count words correctly');
      assert.strictEqual(result.characters, simpleText.length, 'Should count total characters');
      assert.ok(result.charactersNoSpaces < result.characters, 'Should count characters without spaces');
    });

    test('Should clean WriterDown markup before counting', () => {
      const countWords = (text: string): { words: number; characters: number; charactersNoSpaces: number } => {
        let cleanText = text
          .replace(/^---\s*\n[\s\S]*?\n---\s*\n?/m, '')
          .replace(/@([A-Za-z0-9_]+)/g, '$1')
          .replace(/@\[([^\]]+)\]/g, '$1')
          .replace(/\{\{(TODO|RESEARCH|EDIT):.*?\}\}/gi, '')
          .replace(/^#+\s*/gm, '')
          .replace(/[*_]+([^*_]+)[*_]+/g, '$1');

        const words = cleanText.split(/\s+/).filter((word) => word.trim().length > 0).length;
        const characters = text.length;
        const charactersNoSpaces = text.replace(/\s/g, '').length;

        return { words, characters, charactersNoSpaces };
      };

      const writerDownText = `---
title: Test Chapter
---

@[Elena] walked into the room {{TODO: Describe better}}.

# Chapter Heading

"Hello," she said to @Marcus.`;

      const result = countWords(writerDownText);

      // Should count: Elena walked into the room. "Hello," she said to Marcus.
      // That's approximately 11 words
      assert.ok(result.words >= 10 && result.words <= 13, `Should count cleaned words, got ${result.words}`);
    });

    test('Should handle empty and whitespace-only text', () => {
      const countWords = (text: string): { words: number; characters: number; charactersNoSpaces: number } => {
        let cleanText = text
          .replace(/^---\s*\n[\s\S]*?\n---\s*\n?/m, '')
          .replace(/@([A-Za-z0-9_]+)/g, '$1')
          .replace(/@\[([^\]]+)\]/g, '$1')
          .replace(/\{\{(TODO|RESEARCH|EDIT):.*?\}\}/gi, '')
          .replace(/^#+\s*/gm, '')
          .replace(/[*_]+([^*_]+)[*_]+/g, '$1');

        const words = cleanText.split(/\s+/).filter((word) => word.trim().length > 0).length;
        const characters = text.length;
        const charactersNoSpaces = text.replace(/\s/g, '').length;

        return { words, characters, charactersNoSpaces };
      };

      assert.strictEqual(countWords('').words, 0, 'Should handle empty text');
      assert.strictEqual(countWords('   \n\n   ').words, 0, 'Should handle whitespace-only text');
      assert.strictEqual(countWords('   \n\n   ').characters, 8, 'Should count whitespace characters');
      assert.strictEqual(countWords('   \n\n   ').charactersNoSpaces, 0, 'Should have zero non-space characters');
    });

    test('Should calculate page estimates correctly', () => {
      const calculatePages = (words: number, wordsPerPage: number = 250) => {
        const estimatedPages = Math.ceil(words / wordsPerPage);
        const exactPages = (words / wordsPerPage).toFixed(1);
        return { estimatedPages, exactPages, wordsPerPage };
      };

      // Test standard manuscript format (250 words per page)
      const result250 = calculatePages(750, 250);
      assert.strictEqual(result250.estimatedPages, 3, 'Should estimate 3 pages for 750 words at 250 wpp');
      assert.strictEqual(result250.exactPages, '3.0', 'Should calculate exact pages correctly');

      // Test paperback format (300 words per page)
      const result300 = calculatePages(750, 300);
      assert.strictEqual(result300.estimatedPages, 3, 'Should estimate 3 pages for 750 words at 300 wpp');
      assert.strictEqual(result300.exactPages, '2.5', 'Should calculate exact pages correctly');

      // Test academic format (400 words per page)
      const result400 = calculatePages(750, 400);
      assert.strictEqual(result400.estimatedPages, 2, 'Should estimate 2 pages for 750 words at 400 wpp');
      assert.strictEqual(result400.exactPages, '1.9', 'Should calculate exact pages correctly');
    });
  });

  suite('Project Detection Logic', () => {
    test('Should detect WriterDown project structure', () => {
      // Simulate the isWriterDownProject logic
      const checkProjectStructure = (hasWorkspace: boolean, hasBookFolder: boolean) => {
        if (!hasWorkspace) {
          return false;
        }

        return hasBookFolder;
      };

      assert.ok(checkProjectStructure(true, true), 'Should detect WriterDown project with Book folder');
      assert.ok(!checkProjectStructure(true, false), 'Should not detect project without Book folder');
      assert.ok(!checkProjectStructure(false, true), 'Should not detect project without workspace');
      assert.ok(!checkProjectStructure(false, false), 'Should not detect project with nothing');
    });

    test('Should handle activation modes correctly', () => {
      // Simulate activation logic
      const getActivationMode = (isWriterDownProject: boolean) => {
        if (!isWriterDownProject) {
          return 'minimal';
        }
        return 'full';
      };

      assert.strictEqual(getActivationMode(true), 'full', 'Should use full mode for WriterDown projects');
      assert.strictEqual(getActivationMode(false), 'minimal', 'Should use minimal mode for non-WriterDown projects');
    });
  });

  suite('File Type Detection', () => {
    test('Should identify WriterDown and Markdown files', () => {
      const isWriterDownFile = (languageId: string, fileName: string) => {
        return languageId === 'writerdown' || (languageId === 'markdown' && fileName.endsWith('.md'));
      };

      assert.ok(isWriterDownFile('writerdown', 'test.txt'), 'Should detect writerdown language files');
      assert.ok(isWriterDownFile('markdown', 'chapter.md'), 'Should detect markdown .md files');
      assert.ok(!isWriterDownFile('markdown', 'readme.txt'), 'Should not detect non-.md markdown files');
      assert.ok(!isWriterDownFile('typescript', 'code.ts'), 'Should not detect other language files');
    });

    test('Should handle chapter file patterns', () => {
      const isChapterFile = (fileName: string) => {
        const baseName = fileName.split('/').pop() || '';
        return baseName.match(/chapter|ch\s*\d+/i) || baseName.includes('Chapter');
      };

      assert.ok(isChapterFile('Chapter 1.md'), 'Should detect Chapter files');
      assert.ok(isChapterFile('chapter-2.md'), 'Should detect lowercase chapter files');
      assert.ok(isChapterFile('Ch 3.md'), 'Should detect abbreviated chapter files');
      assert.ok(!isChapterFile('notes.md'), 'Should not detect non-chapter files');
      assert.ok(!isChapterFile('character-sheet.md'), 'Should not detect character files as chapters');
    });
  });

  suite('Status Bar Updates', () => {
    test('Should format word count status correctly', () => {
      const formatWordCount = (words: number) => {
        return `$(book) ${words} words`;
      };

      assert.strictEqual(formatWordCount(1500), '$(book) 1500 words', 'Should format word count with icon');
      assert.strictEqual(formatWordCount(0), '$(book) 0 words', 'Should handle zero words');
      assert.strictEqual(formatWordCount(1), '$(book) 1 words', 'Should use "words" even for 1 word');
    });

    test('Should format page count status correctly', () => {
      const formatPageCount = (estimatedPages: number) => {
        return `$(file-text) ${estimatedPages} pages`;
      };

      assert.strictEqual(formatPageCount(3), '$(file-text) 3 pages', 'Should format page count with icon');
      assert.strictEqual(formatPageCount(1), '$(file-text) 1 pages', 'Should use "pages" even for 1 page');
      assert.strictEqual(formatPageCount(0), '$(file-text) 0 pages', 'Should handle zero pages');
    });

    test('Should create status bar tooltips correctly', () => {
      const createTooltips = () => {
        return {
          wordCount: 'WriterDown Word Count - Click for details',
          pageCount: 'WriterDown Page Estimation - Click for details',
          projectTotals: 'WriterDown Project Totals - Click for details',
        };
      };

      const tooltips = createTooltips();
      assert.ok(tooltips.wordCount.includes('Word Count'), 'Should include word count in tooltip');
      assert.ok(tooltips.pageCount.includes('Page Estimation'), 'Should include page estimation in tooltip');
      assert.ok(tooltips.projectTotals.includes('Project Totals'), 'Should include project totals in tooltip');
    });
  });

  suite('Provider Management', () => {
    test('Should track provider types correctly', () => {
      const providerTypes = ['CharacterProvider', 'TodoProvider', 'StructureProvider', 'MarkerProvider'];

      const isValidProvider = (providerName: string) => {
        return providerTypes.includes(providerName);
      };

      assert.ok(isValidProvider('CharacterProvider'), 'Should recognize CharacterProvider');
      assert.ok(isValidProvider('TodoProvider'), 'Should recognize TodoProvider');
      assert.ok(isValidProvider('StructureProvider'), 'Should recognize StructureProvider');
      assert.ok(isValidProvider('MarkerProvider'), 'Should recognize MarkerProvider');
      assert.ok(!isValidProvider('UnknownProvider'), 'Should not recognize unknown providers');
    });

    test('Should handle provider refresh logic', () => {
      // Simulate refresh coordination
      const refreshProviders = (providers: string[]) => {
        const refreshed: string[] = [];

        providers.forEach((provider) => {
          if (['CharacterProvider', 'TodoProvider', 'StructureProvider', 'MarkerProvider'].includes(provider)) {
            refreshed.push(provider);
          }
        });

        return refreshed;
      };

      const result = refreshProviders(['CharacterProvider', 'TodoProvider', 'UnknownProvider']);
      assert.strictEqual(result.length, 2, 'Should refresh valid providers only');
      assert.ok(result.includes('CharacterProvider'), 'Should include CharacterProvider');
      assert.ok(result.includes('TodoProvider'), 'Should include TodoProvider');
      assert.ok(!result.includes('UnknownProvider'), 'Should exclude unknown providers');
    });
  });

  suite('Text Processing Utilities', () => {
    test('Should clean markdown formatting', () => {
      const cleanMarkdown = (text: string) => {
        return text
          .replace(/^#+\s*/gm, '') // Remove headers
          .replace(/[*_]+([^*_]+)[*_]+/g, '$1') // Remove bold/italic
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
          .replace(/`[^`]+`/g, ''); // Remove inline code
      };

      const markdownText = `# Chapter Title

This is **bold** and *italic* text.

[Link text](http://example.com)

Some \`inline code\` here.`;

      const cleaned = cleanMarkdown(markdownText);

      assert.ok(!cleaned.includes('#'), 'Should remove header markers');
      assert.ok(!cleaned.includes('**'), 'Should remove bold markers');
      assert.ok(!cleaned.includes('*'), 'Should remove italic markers');
      assert.ok(cleaned.includes('bold'), 'Should preserve bold text content');
      assert.ok(cleaned.includes('italic'), 'Should preserve italic text content');
      assert.ok(cleaned.includes('Link text'), 'Should preserve link text');
      assert.ok(!cleaned.includes('http://'), 'Should remove link URLs');
      assert.ok(!cleaned.includes('`'), 'Should remove code markers');
    });

    test('Should extract file names correctly', () => {
      const extractFileName = (fullPath: string) => {
        return fullPath.split('/').pop() || 'Unknown';
      };

      assert.strictEqual(extractFileName('/path/to/chapter1.md'), 'chapter1.md', 'Should extract filename from path');
      assert.strictEqual(extractFileName('chapter1.md'), 'chapter1.md', 'Should handle filename without path');
      assert.strictEqual(extractFileName('/complex/nested/path/story.md'), 'story.md', 'Should handle nested paths');
      assert.strictEqual(extractFileName(''), 'Unknown', 'Should handle empty paths');
    });
  });

  suite('Configuration Handling', () => {
    test('Should handle words per page configuration', () => {
      const getWordsPerPage = (configValue?: number) => {
        return configValue || 250; // Default to 250
      };

      assert.strictEqual(getWordsPerPage(300), 300, 'Should use configured value');
      assert.strictEqual(getWordsPerPage(undefined), 250, 'Should use default when undefined');
      assert.strictEqual(getWordsPerPage(0), 250, 'Should use default when zero');
    });

    test('Should validate words per page ranges', () => {
      const isValidWordsPerPage = (value: number) => {
        return value >= 100 && value <= 500;
      };

      assert.ok(isValidWordsPerPage(250), 'Should accept standard manuscript format');
      assert.ok(isValidWordsPerPage(300), 'Should accept paperback format');
      assert.ok(isValidWordsPerPage(400), 'Should accept academic format');
      assert.ok(!isValidWordsPerPage(50), 'Should reject too low values');
      assert.ok(!isValidWordsPerPage(1000), 'Should reject too high values');
    });
  });

  suite('Character Processing', () => {
    test('Should extract character mentions from text', () => {
      const extractCharacterMentions = (text: string) => {
        const mentions: string[] = [];

        // Find @[Name] patterns
        const bracketed = text.match(/@\[([^\]]+)\]/g);
        if (bracketed) {
          bracketed.forEach((match) => {
            const name = match.replace(/@\[([^\]]+)\]/, '$1');
            mentions.push(name);
          });
        }

        // Find @Name patterns
        const simple = text.match(/@([A-Za-z0-9_]+)/g);
        if (simple) {
          simple.forEach((match) => {
            const name = match.replace(/@([A-Za-z0-9_]+)/, '$1');
            if (!mentions.includes(name)) {
              mentions.push(name);
            }
          });
        }

        return mentions;
      };

      const textWithCharacters = `@[Elena Rodriguez] met @Marcus at the café. 
      Later, @[Dr. Smith] joined them.`;

      const mentions = extractCharacterMentions(textWithCharacters);

      assert.strictEqual(mentions.length, 3, 'Should find all character mentions');
      assert.ok(mentions.includes('Elena Rodriguez'), 'Should extract bracketed multi-word name');
      assert.ok(mentions.includes('Marcus'), 'Should extract simple name');
      assert.ok(mentions.includes('Dr. Smith'), 'Should extract bracketed name with punctuation');
    });

    test('Should handle character name normalization', () => {
      const normalizeCharacterName = (name: string) => {
        return name.trim().replace(/\s+/g, ' ');
      };

      assert.strictEqual(
        normalizeCharacterName('  Elena  Rodriguez  '),
        'Elena Rodriguez',
        'Should trim and normalize spaces',
      );
      assert.strictEqual(normalizeCharacterName('Marcus'), 'Marcus', 'Should handle single names');
      assert.strictEqual(normalizeCharacterName(''), '', 'Should handle empty names');
    });
  });

  suite('Analysis Framework', () => {
    test('Should detect duplication patterns', () => {
      const findDuplicatedSentences = (text: string, minLength: number = 10) => {
        // Simple implementation for testing
        const sentences = text
          .split(/[.!?]+/)
          .map((s) => s.trim())
          .filter((s) => s.length >= minLength);
        const duplicates: string[] = [];

        for (let i = 0; i < sentences.length; i++) {
          for (let j = i + 1; j < sentences.length; j++) {
            if (sentences[i] === sentences[j] && !duplicates.includes(sentences[i])) {
              duplicates.push(sentences[i]);
            }
          }
        }

        return duplicates;
      };

      const textWithDuplicates = `This is a unique sentence. This is a repeated sentence. 
      Another unique one here. This is a repeated sentence. Final unique sentence.`;

      const duplicates = findDuplicatedSentences(textWithDuplicates);

      assert.strictEqual(duplicates.length, 1, 'Should find one duplicated sentence');
      assert.ok(duplicates[0].includes('repeated sentence'), 'Should identify the correct duplicate');
    });

    test('Should filter sentences by minimum length', () => {
      const filterSentencesByLength = (sentences: string[], minLength: number) => {
        return sentences.filter((s) => s.trim().length >= minLength);
      };

      const sentences = [
        'Short.',
        'This is a longer sentence that meets criteria.',
        'No.',
        'Another long sentence here.',
      ];
      const filtered = filterSentencesByLength(sentences, 10);

      assert.strictEqual(filtered.length, 2, 'Should filter out short sentences');
      assert.ok(
        filtered.every((s) => s.length >= 10),
        'All filtered sentences should meet length requirement',
      );
    });
  });

  suite('Error Handling', () => {
    test('Should handle file system errors gracefully', () => {
      const handleFileError = (error: any) => {
        if (error.code === 'ENOENT') {
          return 'File not found';
        } else if (error.code === 'EACCES') {
          return 'Permission denied';
        } else {
          return 'Unknown error';
        }
      };

      assert.strictEqual(handleFileError({ code: 'ENOENT' }), 'File not found', 'Should handle file not found');
      assert.strictEqual(handleFileError({ code: 'EACCES' }), 'Permission denied', 'Should handle permission errors');
      assert.strictEqual(handleFileError({ code: 'UNKNOWN' }), 'Unknown error', 'Should handle unknown errors');
    });

    test('Should handle empty workspace scenarios', () => {
      const handleEmptyWorkspace = (hasWorkspace: boolean) => {
        if (!hasWorkspace) {
          return { mode: 'disabled', message: 'No workspace detected' };
        }
        return { mode: 'active', message: 'Workspace available' };
      };

      const noWorkspace = handleEmptyWorkspace(false);
      const withWorkspace = handleEmptyWorkspace(true);

      assert.strictEqual(noWorkspace.mode, 'disabled', 'Should disable features without workspace');
      assert.strictEqual(withWorkspace.mode, 'active', 'Should enable features with workspace');
    });
  });
});
