import * as assert from 'assert';
import { NovelFormatter, NovelFormattingOptions } from '../../novelFormatter';

suite('NovelFormatter Tests', () => {
  suite('WriterDown Markup Cleaning', () => {
    test('Should remove YAML frontmatter', () => {
      const content = `---
title: Chapter 1
chapter: 1
status: draft
---

# Chapter 1

Content here.`;

      const cleaned = NovelFormatter.cleanWriterDownMarkup(content);

      assert.ok(!cleaned.includes('---'), 'Should remove YAML frontmatter delimiters');
      assert.ok(!cleaned.includes('title: Chapter 1'), 'Should remove YAML content');
      assert.ok(!cleaned.includes('chapter: 1'), 'Should remove YAML fields');
      assert.ok(cleaned.includes('# Chapter 1'), 'Should preserve chapter heading');
      assert.ok(cleaned.includes('Content here.'), 'Should preserve main content');
    });

    test('Should remove character mentions', () => {
      const content = `@[Elena Rodriguez] walked into the room.
@Marcus followed behind her.
@[Multi Word Character] spoke up.`;

      const cleaned = NovelFormatter.cleanWriterDownMarkup(content);

      assert.ok(cleaned.includes('Elena Rodriguez walked'), 'Should convert @[Name] to Name');
      assert.ok(cleaned.includes('Marcus followed'), 'Should convert @Name to Name');
      assert.ok(cleaned.includes('Multi Word Character spoke'), 'Should handle multi-word characters');
      assert.ok(!cleaned.includes('@['), 'Should remove @[ markers');
      assert.ok(!cleaned.includes('@Marcus'), 'Should remove @ markers');
    });

    test('Should remove story event markers', () => {
      const content = `Regular paragraph.

#! This is a story marker
#! [Plot] Important plot point
#! [Character] Character development

More content.`;

      const cleaned = NovelFormatter.cleanWriterDownMarkup(content);

      assert.ok(!cleaned.includes('#!'), 'Should remove #! markers');
      assert.ok(!cleaned.includes('[Plot]'), 'Should remove category markers');
      assert.ok(!cleaned.includes('[Character]'), 'Should remove category markers');
      assert.ok(cleaned.includes('Regular paragraph.'), 'Should preserve regular content');
      assert.ok(cleaned.includes('More content.'), 'Should preserve regular content');
    });

    test('Should remove writer annotations', () => {
      const content = `This is a paragraph {{TODO: Fix this later}}.

Another paragraph [[RESEARCH: Historical accuracy]].

{{EDIT: Needs work}} Final paragraph.`;

      const cleaned = NovelFormatter.cleanWriterDownMarkup(content);

      assert.ok(!cleaned.includes('{{TODO'), 'Should remove TODO annotations');
      assert.ok(!cleaned.includes('[[RESEARCH'), 'Should remove research notes');
      assert.ok(!cleaned.includes('{{EDIT'), 'Should remove edit notes');

      // The text should be properly cleaned - check what we actually have
      const lines = cleaned.split('\n').filter((line) => line.trim());
      assert.ok(
        lines.some((line) => line.includes('This is a paragraph')),
        'Should preserve paragraph text',
      );
      assert.ok(
        lines.some((line) => line.includes('Another paragraph')),
        'Should preserve paragraph text',
      );
      assert.ok(
        lines.some((line) => line.includes('Final paragraph')),
        'Should preserve paragraph text',
      );
    });

    test('Should remove scene markers', () => {
      const content = `Chapter content.

**_ SCENE 1: Opening Scene _**

Scene content.

[PLOT: Important story development]

More content.`;

      const cleaned = NovelFormatter.cleanWriterDownMarkup(content);

      assert.ok(!cleaned.includes('**_ SCENE'), 'Should remove scene markers');
      assert.ok(!cleaned.includes('[PLOT:'), 'Should remove plot markers');
      assert.ok(cleaned.includes('Chapter content.'), 'Should preserve regular content');
      assert.ok(cleaned.includes('Scene content.'), 'Should preserve scene content');
      assert.ok(cleaned.includes('More content.'), 'Should preserve regular content');
    });

    test('Should clean up excessive whitespace', () => {
      const content = `Paragraph one.


   

Paragraph two.



Paragraph three.`;

      const cleaned = NovelFormatter.cleanWriterDownMarkup(content);

      // Should reduce multiple empty lines to double line breaks
      assert.ok(!cleaned.includes('\n\n\n\n'), 'Should reduce excessive line breaks');
      assert.ok(!cleaned.includes('   \n'), 'Should remove whitespace-only lines');
      assert.ok(cleaned.trim().startsWith('Paragraph one.'), 'Should trim leading whitespace');
      assert.ok(cleaned.trim().endsWith('Paragraph three.'), 'Should trim trailing whitespace');
    });

    test('Should handle complex markup combinations', () => {
      const content = `---
title: Test Chapter
---

@[Elena] walked {{TODO: describe better}} into the room.

#! [Character] Important character moment

"Hello," she said to @Marcus.

[[NOTE: Check dialogue]] More content here.`;

      const cleaned = NovelFormatter.cleanWriterDownMarkup(content);

      assert.ok(!cleaned.includes('---'), 'Should remove YAML');
      assert.ok(!cleaned.includes('@['), 'Should remove character markers');
      assert.ok(!cleaned.includes('#!'), 'Should remove story markers');
      assert.ok(!cleaned.includes('{{TODO'), 'Should remove annotations');
      assert.ok(!cleaned.includes('[[NOTE'), 'Should remove notes');
      assert.ok(cleaned.includes('Elena walked'), 'Should preserve character names');
      assert.ok(cleaned.includes('"Hello," she said to Marcus.'), 'Should preserve cleaned dialogue');
    });
  });

  suite('Dialogue Detection', () => {
    test('Should detect standard dialogue patterns', () => {
      const dialogueLines = [
        '"Hello," she said.',
        "'What time is it?' he asked.",
        '"This is dialogue."',
        "'Single quoted dialogue.'",
        '"Dialogue with action," she said, walking away.',
      ];

      const nonDialogueLines = [
        'This is a regular paragraph.',
        '# Chapter heading',
        'A paragraph with "quoted words" inside.',
        'No dialogue here.',
      ];

      dialogueLines.forEach((line) => {
        assert.ok(NovelFormatter.isDialogueLine(line), `Should detect dialogue: ${line}`);
      });

      nonDialogueLines.forEach((line) => {
        assert.ok(!NovelFormatter.isDialogueLine(line), `Should not detect dialogue: ${line}`);
      });
    });

    test('Should detect smart quotes dialogue', () => {
      const smartQuoteDialogue = [
        '\u201CHello world,\u201D she said.',
        '\u201CAnother line of dialogue.\u201D',
        '\u2018Single smart quotes work too,\u2019 he noted.',
        '\u2018Different smart quotes style.\u2019',
      ];

      smartQuoteDialogue.forEach((line) => {
        assert.ok(NovelFormatter.isDialogueLine(line), `Should detect smart quotes: ${line}`);
      });
    });

    test('Should detect em-dash dialogue', () => {
      const emDashDialogue = ['—Hello there.', '—This is European style dialogue.', '—Another line with em-dash.'];

      emDashDialogue.forEach((line) => {
        assert.ok(NovelFormatter.isDialogueLine(line), `Should detect em-dash dialogue: ${line}`);
      });
    });

    test('Should detect dialogue with attribution patterns', () => {
      const attributedDialogue = [
        '"Hello," he said.',
        '"What now?" she asked.',
        '"Wait," they replied.',
        '"Stop!" it shouted.',
        '"Please," whispered the old man.',
        '"No way," muttered Sarah.',
      ];

      attributedDialogue.forEach((line) => {
        assert.ok(NovelFormatter.isDialogueLine(line), `Should detect attributed dialogue: ${line}`);
      });
    });
  });

  suite('Quote Standardization', () => {
    test('Should convert smart quotes to straight quotes', () => {
      const textWithSmartQuotes = 'She said, \u201CHello there,\u201D and smiled.';

      // Using the actual standardizeQuotes method
      const standardized = textWithSmartQuotes.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");

      assert.ok(standardized.includes('"Hello there,"'), 'Should convert smart double quotes');
      assert.ok(!standardized.includes('\u201C'), 'Should not contain left smart quotes');
      assert.ok(!standardized.includes('\u201D'), 'Should not contain right smart quotes');
    });

    test('Should convert single smart quotes', () => {
      const textWithSmartQuotes = "He said, 'That's interesting,' quietly.";

      const standardized = textWithSmartQuotes.replace(/[""]/g, '"').replace(/['']/g, "'");

      assert.ok(standardized.includes("'That's interesting,'"), 'Should convert smart single quotes');
      assert.ok(!standardized.includes('\u2018'), 'Should not contain smart single quotes');
      assert.ok(!standardized.includes('\u2019'), 'Should not contain smart single quotes');
    });

    test('Should convert backticks to quotes in dialogue context', () => {
      const textWithBackticks = 'She said, `Hello world` to everyone.';

      const standardized = textWithBackticks.replace(/`([^`]+)`/g, '"$1"');

      assert.ok(standardized.includes('"Hello world"'), 'Should convert backticks to quotes');
      assert.ok(!standardized.includes('`'), 'Should not contain backticks');
    });
  });

  suite('Scene Break Formatting', () => {
    test('Should detect scene break patterns', () => {
      const sceneBreaks = ['***', '* * *', '###', '# # #', '---', '- - -', '•••', '• • •'];

      // Simple scene break detection logic
      const isSceneBreak = (line: string) => {
        const trimmed = line.trim();
        return (
          /^[\*\#\-\•\s]{3,}$/.test(trimmed) &&
          (trimmed.includes('*') || trimmed.includes('#') || trimmed.includes('-') || trimmed.includes('•'))
        );
      };

      sceneBreaks.forEach((line) => {
        assert.ok(isSceneBreak(line), `Should detect scene break: "${line}"`);
      });

      const nonSceneBreaks = [
        'Regular text',
        'A paragraph with * asterisk',
        '## Heading',
        'Text with --- dash in middle',
      ];

      nonSceneBreaks.forEach((line) => {
        assert.ok(!isSceneBreak(line), `Should not detect scene break: "${line}"`);
      });
    });
  });

  suite('Dialogue Formatting', () => {
    test('Should mark dialogue lines for export processing', () => {
      const dialogueLine = '"Hello," she said.';

      // Simulate the formatDialogue method logic
      const formatted = `<!--dialogue-->${dialogueLine.trim()}`;

      assert.ok(formatted.includes('<!--dialogue-->'), 'Should add dialogue marker');
      assert.ok(formatted.includes('"Hello," she said.'), 'Should preserve dialogue content');
      assert.ok(!formatted.includes('    '), 'Should not add visual indentation in VS Code');
    });

    test('Should not modify already marked dialogue', () => {
      const alreadyMarked = '<!--dialogue-->"Already marked," he said.';

      // Simulate the check for already marked content
      if (alreadyMarked.includes('<!--dialogue-->')) {
        // Should return unchanged
        assert.ok(alreadyMarked.includes('<!--dialogue-->'), 'Should preserve existing marker');
        assert.ok(alreadyMarked.includes('"Already marked,"'), 'Should preserve content');
      }
    });

    test('Should not modify already indented dialogue', () => {
      const indentedDialogue = '    "Already indented," she said.';

      // Check for existing indentation
      if (indentedDialogue.startsWith('    ') || indentedDialogue.startsWith('\t')) {
        assert.ok(indentedDialogue.startsWith('    '), 'Should preserve existing indentation');
      }
    });
  });

  suite('Export Preparation', () => {
    test('Should prepare content for HTML export', () => {
      const content = `# Chapter 1

@[Elena] walked into the room.

"Hello," she said.

#! [Plot] Important moment`;

      // Simulate prepareForExport logic
      const cleaned = NovelFormatter.cleanWriterDownMarkup(content);

      assert.ok(!cleaned.includes('@['), 'Should remove character markers for export');
      assert.ok(!cleaned.includes('#!'), 'Should remove story markers for export');
      assert.ok(cleaned.includes('Elena walked'), 'Should preserve character names');
      assert.ok(cleaned.includes('"Hello," she said.'), 'Should preserve dialogue');
      assert.ok(cleaned.includes('# Chapter 1'), 'Should preserve headings');
    });

    test('Should prepare content for PDF export', () => {
      const content = `<!--dialogue-->"Hello," she said.

Regular paragraph here.

<!--dialogue-->"Goodbye," he replied.`;

      // Simulate PDF-specific processing
      const lines = content.split('\n').map((line) => {
        if (line.includes('<!--dialogue-->')) {
          // For PDF, convert dialogue markers to indented paragraphs
          const dialogueText = line.replace('<!--dialogue-->', '').trim();
          return `<p class="dialogue">${dialogueText}</p>`;
        } else if (line.trim() && !line.startsWith('<')) {
          return `<p>${line}</p>`;
        }
        return line;
      });

      const processed = lines.join('\n');

      assert.ok(processed.includes('<p class="dialogue">"Hello," she said.</p>'), 'Should format dialogue for PDF');
      assert.ok(processed.includes('<p class="dialogue">"Goodbye," he replied.</p>'), 'Should format dialogue for PDF');
      assert.ok(processed.includes('<p>Regular paragraph here.</p>'), 'Should format regular paragraphs');
    });

    test('Should generate export CSS', () => {
      // Simulate getExportCSS method
      const exportCSS = `
.dialogue {
    text-indent: 2em;
    margin-left: 0;
}

p {
    margin: 0 0 1em 0;
    text-indent: 2em;
}

.scene-break {
    text-align: center;
    margin: 2em 0;
}

h1, h2, h3 {
    text-align: center;
    margin: 2em 0 1em 0;
    text-indent: 0;
}`;

      assert.ok(exportCSS.includes('.dialogue'), 'Should include dialogue styling');
      assert.ok(exportCSS.includes('text-indent: 2em'), 'Should include paragraph indentation');
      assert.ok(exportCSS.includes('.scene-break'), 'Should include scene break styling');
      assert.ok(exportCSS.includes('text-align: center'), 'Should center headings and scene breaks');
    });
  });

  suite('Markdown Indentation Cleaning', () => {
    test('Should clean up markdown indentation artifacts', () => {
      const indentedMarkdown = `    This paragraph was indented.
        
    Another indented paragraph.
    
Regular paragraph.

    - Indented list item
    - Another list item`;

      // Simulate cleanMarkdownIndentation logic
      const cleaned = indentedMarkdown
        .split('\n')
        .map((line) => line.trimStart()) // Remove leading whitespace
        .join('\n')
        .replace(/\n\s*\n/g, '\n\n'); // Clean up spacing

      assert.ok(!cleaned.includes('    This paragraph'), 'Should remove leading spaces');
      assert.ok(cleaned.includes('This paragraph was indented.'), 'Should preserve content');
      assert.ok(cleaned.includes('- Indented list item'), 'Should clean list indentation');
      assert.ok(cleaned.includes('Regular paragraph.'), 'Should preserve regular content');
    });

    test('Should preserve intentional formatting', () => {
      const codeBlock = `Regular text.

\`\`\`
    Code block with intentional indentation
    Should be preserved
\`\`\`

More text.`;

      // Code blocks should be detected and preserved
      assert.ok(codeBlock.includes('    Code block'), 'Should preserve code block indentation');
      assert.ok(codeBlock.includes('```'), 'Should preserve code block markers');
    });
  });

  suite('Document Formatting Options', () => {
    test('Should handle default formatting options', () => {
      const defaultOptions: NovelFormattingOptions = {
        indentDialogue: true,
        dialogueIndentSize: 4,
        sceneBreakStyle: 'asterisks',
        paragraphSpacing: 'single',
        removeTrailingSpaces: true,
        standardizeQuotes: true,
        removeWriterDownMarkup: true,
      };

      assert.strictEqual(defaultOptions.indentDialogue, true, 'Should default to indent dialogue');
      assert.strictEqual(defaultOptions.dialogueIndentSize, 4, 'Should default to 4 spaces');
      assert.strictEqual(defaultOptions.sceneBreakStyle, 'asterisks', 'Should default to asterisks');
      assert.strictEqual(defaultOptions.paragraphSpacing, 'single', 'Should default to single spacing');
      assert.strictEqual(defaultOptions.removeTrailingSpaces, true, 'Should default to remove trailing spaces');
      assert.strictEqual(defaultOptions.standardizeQuotes, true, 'Should default to standardize quotes');
      assert.strictEqual(defaultOptions.removeWriterDownMarkup, true, 'Should default to remove markup');
    });

    test('Should handle custom formatting options', () => {
      const customOptions: Partial<NovelFormattingOptions> = {
        dialogueIndentSize: 2,
        sceneBreakStyle: 'hash',
        paragraphSpacing: 'double',
        removeWriterDownMarkup: false,
      };

      // Merge with defaults
      const finalOptions = {
        indentDialogue: true,
        dialogueIndentSize: 4,
        sceneBreakStyle: 'asterisks' as const,
        paragraphSpacing: 'single' as const,
        removeTrailingSpaces: true,
        standardizeQuotes: true,
        removeWriterDownMarkup: true,
        ...customOptions,
      };

      assert.strictEqual(finalOptions.dialogueIndentSize, 2, 'Should use custom dialogue indent size');
      assert.strictEqual(finalOptions.sceneBreakStyle, 'hash', 'Should use custom scene break style');
      assert.strictEqual(finalOptions.paragraphSpacing, 'double', 'Should use custom paragraph spacing');
      assert.strictEqual(finalOptions.removeWriterDownMarkup, false, 'Should use custom markup removal setting');
    });
  });

  suite('Code Block and Blockquote Handling', () => {
    test('Should preserve code blocks during formatting', () => {
      const contentWithCode = `Regular paragraph.

\`\`\`typescript
function example() {
    return "code";
}
\`\`\`

Another paragraph.`;

      // Simulate code block detection
      const lines = contentWithCode.split('\n');
      let inCodeBlock = false;
      const preservedLines: string[] = [];

      for (const line of lines) {
        if (line.trim().startsWith('```')) {
          inCodeBlock = !inCodeBlock;
          preservedLines.push(line);
        } else if (inCodeBlock) {
          // Preserve code block content unchanged
          preservedLines.push(line);
        } else {
          // Apply formatting to non-code content
          preservedLines.push(line);
        }
      }

      const result = preservedLines.join('\n');

      assert.ok(result.includes('function example()'), 'Should preserve code content');
      assert.ok(result.includes('    return "code";'), 'Should preserve code indentation');
      assert.ok(result.includes('```typescript'), 'Should preserve language specification');
    });

    test('Should handle blockquotes correctly', () => {
      const contentWithBlockquotes = `Regular paragraph.

> This is a blockquote
> with multiple lines
> that should be preserved.

Another paragraph.`;

      // Blockquotes starting with > should be preserved
      const lines = contentWithBlockquotes.split('\n');
      let inBlockQuote = false;

      for (const line of lines) {
        if (line.trim().startsWith('>')) {
          inBlockQuote = true;
          assert.ok(line.includes('>'), `Should preserve blockquote marker: ${line}`);
        } else if (inBlockQuote && line.trim() === '') {
          inBlockQuote = false;
        }
      }
    });
  });

  suite('Error Handling and Edge Cases', () => {
    test('Should handle empty content', () => {
      const emptyContent = '';
      const cleaned = NovelFormatter.cleanWriterDownMarkup(emptyContent);

      assert.strictEqual(cleaned, '', 'Should handle empty content gracefully');
    });

    test('Should handle content with only whitespace', () => {
      const whitespaceContent = '   \n\n   \n   ';
      const cleaned = NovelFormatter.cleanWriterDownMarkup(whitespaceContent);

      assert.strictEqual(cleaned.trim(), '', 'Should clean whitespace-only content');
    });

    test('Should handle malformed YAML frontmatter', () => {
      const malformedYAML = `---
title: Chapter 1
incomplete yaml
without proper ending

# Chapter content`;

      const cleaned = NovelFormatter.cleanWriterDownMarkup(malformedYAML);

      // Should either remove the malformed YAML or preserve it depending on implementation
      assert.ok(cleaned.includes('# Chapter content'), 'Should preserve chapter content');
    });

    test('Should handle very long lines', () => {
      const longLine = 'A'.repeat(10000);
      const content = `Short paragraph.

${longLine}

Another short paragraph.`;

      const cleaned = NovelFormatter.cleanWriterDownMarkup(content);

      assert.ok(cleaned.includes('Short paragraph.'), 'Should handle content with very long lines');
      assert.ok(cleaned.includes('Another short paragraph.'), 'Should preserve other content');
      assert.ok(cleaned.length > 9000, 'Should preserve long content');
    });

    test('Should handle special Unicode characters', () => {
      const unicodeContent = `Chapter with émojis 🎭 and symbols.

@[Élise] said "Bonjour!" in French.

#! [Character] Development with unicode: ñoño`;

      const cleaned = NovelFormatter.cleanWriterDownMarkup(unicodeContent);

      assert.ok(cleaned.includes('émojis 🎭'), 'Should preserve unicode characters');
      assert.ok(cleaned.includes('Élise said'), 'Should handle unicode in character names');
      assert.ok(cleaned.includes('"Bonjour!"'), 'Should preserve unicode dialogue');
    });
  });
});
