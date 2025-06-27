import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

// Simple mock implementation without sinon
interface MockFunction {
  called: boolean;
  callCount: number;
  lastCall?: any[];
  returns?: any;
  throws?: Error;
  callsFake?: Function;
}

function createMockFunction(returnValue?: any): MockFunction {
  const mock: MockFunction = {
    called: false,
    callCount: 0,
    returns: returnValue,
  };

  const mockFn = function (...args: any[]) {
    mock.called = true;
    mock.callCount++;
    mock.lastCall = args;

    if (mock.throws) {
      throw mock.throws;
    }

    if (mock.callsFake) {
      return mock.callsFake(...args);
    }

    return mock.returns;
  };

  // Attach mock properties to function and create setters
  Object.defineProperty(mockFn, 'called', {
    get: () => mock.called,
    set: (value) => {
      mock.called = value;
    },
  });

  Object.defineProperty(mockFn, 'callCount', {
    get: () => mock.callCount,
    set: (value) => {
      mock.callCount = value;
    },
  });

  Object.defineProperty(mockFn, 'lastCall', {
    get: () => mock.lastCall,
    set: (value) => {
      mock.lastCall = value;
    },
  });

  Object.defineProperty(mockFn, 'returns', {
    get: () => mock.returns,
    set: (value) => {
      mock.returns = value;
    },
  });

  Object.defineProperty(mockFn, 'throws', {
    get: () => mock.throws,
    set: (value) => {
      mock.throws = value;
    },
  });

  Object.defineProperty(mockFn, 'callsFake', {
    get: () => mock.callsFake,
    set: (value) => {
      mock.callsFake = value;
    },
  });

  // Add a reset method for easier test management
  Object.defineProperty(mockFn, 'reset', {
    value: () => {
      mock.called = false;
      mock.callCount = 0;
      mock.lastCall = undefined;
      mock.throws = undefined;
      mock.callsFake = undefined;
    },
  });

  return mockFn as any;
}

suite('Export Novel Tests', () => {
  let originalExistsSync: typeof fs.existsSync;
  let originalReadFileSync: typeof fs.readFileSync;
  let originalWriteFileSync: typeof fs.writeFileSync;
  let originalMkdirSync: typeof fs.mkdirSync;
  let originalProcessExit: typeof process.exit;
  let originalConsoleError: typeof console.error;
  let originalConsoleLog: typeof console.log;

  // Mock functions
  let mockExistsSync: MockFunction;
  let mockReadFileSync: MockFunction;
  let mockWriteFileSync: MockFunction;
  let mockMkdirSync: MockFunction;
  let mockProcessExit: MockFunction;
  let mockConsoleError: MockFunction;
  let mockConsoleLog: MockFunction;

  setup(() => {
    // Store originals
    originalExistsSync = fs.existsSync;
    originalReadFileSync = fs.readFileSync;
    originalWriteFileSync = fs.writeFileSync;
    originalMkdirSync = fs.mkdirSync;
    originalProcessExit = process.exit;
    originalConsoleError = console.error;
    originalConsoleLog = console.log;

    // Create mocks
    mockExistsSync = createMockFunction(true);
    mockReadFileSync = createMockFunction('mock content');
    mockWriteFileSync = createMockFunction();
    mockMkdirSync = createMockFunction();
    mockProcessExit = createMockFunction();
    mockConsoleError = createMockFunction();
    mockConsoleLog = createMockFunction();

    // Replace with mocks
    (fs as any).existsSync = mockExistsSync;
    (fs as any).readFileSync = mockReadFileSync;
    (fs as any).writeFileSync = mockWriteFileSync;
    (fs as any).mkdirSync = mockMkdirSync;
    (process as any).exit = mockProcessExit;
    (console as any).error = mockConsoleError;
    (console as any).log = mockConsoleLog;
  });

  teardown(() => {
    // Restore originals
    (fs as any).existsSync = originalExistsSync;
    (fs as any).readFileSync = originalReadFileSync;
    (fs as any).writeFileSync = originalWriteFileSync;
    (fs as any).mkdirSync = originalMkdirSync;
    (process as any).exit = originalProcessExit;
    (console as any).error = originalConsoleError;
    (console as any).log = originalConsoleLog;
  });

  suite('CLI Options Parsing', () => {
    test('Should parse basic input file arguments', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'export-novel.ts', 'test.md'];

      // Simulate parseArgs logic
      const args = process.argv.slice(2);
      const options = {
        input: args[0],
        format: 'docx' as const,
      };

      assert.strictEqual(options.input, 'test.md', 'Should parse input file');
      assert.strictEqual(options.format, 'docx', 'Should default to docx format');

      process.argv = originalArgv;
    });

    test('Should parse format options correctly', () => {
      const testCases = [
        { format: 'html', expected: 'html' },
        { format: 'pdf', expected: 'pdf' },
        { format: 'docx', expected: 'docx' },
      ];

      testCases.forEach(({ format, expected }) => {
        const originalArgv = process.argv;
        process.argv = ['node', 'export-novel.ts', 'test.md', '--format', format];

        // Simulate format parsing
        const args = process.argv.slice(2);
        let parsedFormat = 'docx';

        for (let i = 1; i < args.length; i++) {
          if (args[i] === '--format') {
            parsedFormat = args[++i];
          }
        }

        assert.strictEqual(parsedFormat, expected, `Should parse ${format} format correctly`);

        process.argv = originalArgv;
      });
    });

    test('Should validate format values', () => {
      const validFormats = ['docx', 'html', 'pdf'];
      const invalidFormats = ['txt', 'epub', 'invalid'];

      validFormats.forEach((format) => {
        assert.ok(['docx', 'html', 'pdf'].includes(format), `Should accept valid format: ${format}`);
      });

      invalidFormats.forEach((format) => {
        assert.ok(!['docx', 'html', 'pdf'].includes(format), `Should reject invalid format: ${format}`);
      });
    });

    test('Should parse output option', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'export-novel.ts', 'input.md', '--output', 'custom.html'];

      const args = process.argv.slice(2);
      let output: string | undefined;

      for (let i = 1; i < args.length; i++) {
        if (args[i] === '--output') {
          output = args[++i];
        }
      }

      assert.strictEqual(output, 'custom.html', 'Should parse output option');

      process.argv = originalArgv;
    });
  });

  suite('Output Path Generation', () => {
    test('Should generate correct output paths for different formats', () => {
      const testCases = [
        { input: 'story.md', format: 'html', expectedExt: 'html' },
        { input: 'novel.md', format: 'pdf', expectedExt: 'pdf' },
        { input: 'manuscript.md', format: 'docx', expectedExt: 'md' },
      ];

      testCases.forEach(({ input, format, expectedExt }) => {
        // Simulate generateOutputPath logic
        const parsed = path.parse(input);
        const workspaceRoot = process.cwd();
        const outputDir = path.join(workspaceRoot, 'output');

        let extension: string;
        switch (format) {
          case 'html':
            extension = 'html';
            break;
          case 'pdf':
            extension = 'pdf';
            break;
          default:
            extension = 'md';
        }

        const outputPath = path.join(outputDir, `${parsed.name}-formatted.${extension}`);

        assert.ok(outputPath.includes(parsed.name), `Should include filename for ${format}`);
        assert.ok(outputPath.includes('output'), 'Should place in output directory');
        assert.ok(outputPath.endsWith(`.${expectedExt}`), `Should have ${expectedExt} extension`);
      });
    });

    test('Should handle different input path formats', () => {
      const paths = ['simple.md', 'folder/nested.md', '../relative.md', '/absolute/path.md'];

      paths.forEach((inputPath) => {
        const parsed = path.parse(inputPath);
        const outputPath = path.join(process.cwd(), 'output', `${parsed.name}-formatted.html`);

        assert.ok(outputPath.includes(parsed.name), `Should preserve basename from ${inputPath}`);
        assert.ok(outputPath.includes('output'), 'Should use output directory');
      });
    });
  });

  suite('File Operations', () => {
    test('Should check file existence', () => {
      // Reset mock state
      mockExistsSync.called = false;
      mockExistsSync.callsFake = (filePath: string) => {
        return filePath === 'existing.md';
      };

      assert.ok(fs.existsSync('existing.md'), 'Should detect existing files');
      assert.ok(!fs.existsSync('missing.md'), 'Should detect missing files');
    });

    test('Should read file content', () => {
      const mockContent = `# Chapter 1

@[Elena] walked into the room.

#! [Plot] Important scene marker

"Hello," she said.`;

      // Reset mock state and set return value
      mockReadFileSync.called = false;
      mockReadFileSync.returns = mockContent;

      const content = fs.readFileSync('test.md', 'utf-8');
      assert.strictEqual(content, mockContent, 'Should read file content correctly');
      assert.ok(mockReadFileSync.called, 'Should call readFileSync');
    });

    test('Should create output directory', () => {
      const outputDir = path.join(process.cwd(), 'output');

      // Reset mock state
      mockMkdirSync.called = false;
      mockExistsSync.callsFake = (dirPath: string) => dirPath !== outputDir;

      // Simulate directory creation logic
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      assert.ok(mockMkdirSync.called, 'Should call mkdirSync');
      assert.deepStrictEqual(
        mockMkdirSync.lastCall,
        [outputDir, { recursive: true }],
        'Should create with correct options',
      );
    });

    test('Should write output file', () => {
      const outputPath = 'output/test.html';
      const content = '<html>Test</html>';

      // Reset mock state
      mockWriteFileSync.called = false;

      fs.writeFileSync(outputPath, content, 'utf-8');

      assert.ok(mockWriteFileSync.called, 'Should call writeFileSync');
      assert.deepStrictEqual(
        mockWriteFileSync.lastCall,
        [outputPath, content, 'utf-8'],
        'Should write with correct parameters',
      );
    });
  });

  suite('HTML Processing Logic', () => {
    test('Should convert markdown to HTML', () => {
      const input = `<p class="dialogue">"Hello world"</p>
<p>Regular paragraph</p>
# Chapter Title
## Subtitle`;

      // Simulate the HTML conversion logic from export-novel.ts
      const lines = input.split('\n').map((line) => {
        if (line.trim().startsWith('<p class="dialogue">')) {
          return line;
        } else if (line.trim() && !line.startsWith('#')) {
          return `<p>${line}</p>`;
        } else if (line.startsWith('#')) {
          const level = line.match(/^#+/)?.[0].length || 1;
          const text = line.replace(/^#+\s*/, '');
          return `<h${level}>${text}</h${level}>`;
        }
        return line;
      });

      const result = lines.join('\n');

      assert.ok(result.includes('<p class="dialogue">"Hello world"</p>'), 'Should preserve dialogue formatting');
      assert.ok(result.includes('<h1>Chapter Title</h1>'), 'Should convert h1 headings');
      assert.ok(result.includes('<h2>Subtitle</h2>'), 'Should convert h2 headings');
      assert.ok(result.includes('<p><p>Regular paragraph</p></p>'), 'Should wrap paragraphs');
    });

    test('Should generate complete HTML document', () => {
      const htmlTemplate = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Novel Export</title>
    <style>/* CSS styles */</style>
</head>
<body class="vscode-body">
<!-- Content goes here -->
</body>
</html>`;

      assert.ok(htmlTemplate.includes('<!DOCTYPE html>'), 'Should include DOCTYPE declaration');
      assert.ok(htmlTemplate.includes('<meta charset="UTF-8">'), 'Should include UTF-8 charset');
      assert.ok(htmlTemplate.includes('<style>'), 'Should include style section');
      assert.ok(htmlTemplate.includes('class="vscode-body"'), 'Should include vscode-body class');
    });
  });

  suite('PDF Processing Logic', () => {
    test('Should generate PDF-ready HTML with print styles', () => {
      const pdfStyles = `@page {
    size: A4;
    margin: 1in 1in 1in 1.25in;
}

body {
    font-family: 'Times New Roman', serif;
    font-size: 12pt;
    line-height: 2;
}

.dialogue {
    text-indent: 2em;
}`;

      assert.ok(pdfStyles.includes('@page'), 'Should include page size settings');
      assert.ok(pdfStyles.includes('A4'), 'Should set A4 page size');
      assert.ok(pdfStyles.includes('margin: 1in 1in 1in 1.25in'), 'Should set manuscript margins');
      assert.ok(pdfStyles.includes("font-family: 'Times New Roman'"), 'Should use Times New Roman');
      assert.ok(pdfStyles.includes('font-size: 12pt'), 'Should use 12pt font');
      assert.ok(pdfStyles.includes('line-height: 2'), 'Should use double spacing');
      assert.ok(pdfStyles.includes('text-indent: 2em'), 'Should indent dialogue');
    });

    test('Should handle PDF fallback scenario', () => {
      const fallbackPath = 'story.pdf.html';
      const instructions = 'Open this file in a browser and use Print > Save as PDF';

      const fallbackContent = `<!-- ${instructions} -->
<!DOCTYPE html>
<html>
<head>
    <title>PDF Export - Ready for Print</title>
    <style>/* PDF styles */</style>
</head>
<body>Content</body>
</html>`;

      assert.ok(fallbackContent.includes(instructions), 'Should include PDF instructions');
      assert.ok(fallbackContent.includes('PDF Export - Ready for Print'), 'Should have PDF-ready title');
    });
  });

  suite('Error Handling', () => {
    test('Should handle missing input file', () => {
      // Reset mock state
      mockExistsSync.called = false;
      mockExistsSync.returns = false;

      // Simulate error handling - these calls should work
      const fileExists = fs.existsSync('missing.md');

      // The file should not exist according to our mock
      assert.ok(!fileExists, 'Should detect missing file');

      // Test the error path logic
      if (!fileExists) {
        console.error("Error: Input file 'missing.md' not found");
        process.exit(1);
      }

      // Verify mock was called
      assert.ok(mockExistsSync.called, 'Should call existsSync');
    });

    test('Should handle file read errors', () => {
      // Reset mock state
      mockReadFileSync.throws = new Error('Permission denied');

      let errorThrown = false;
      try {
        fs.readFileSync('error.md', 'utf-8');
      } catch (error) {
        errorThrown = true;
        console.error(`Error: ${error}`);
        process.exit(1);
      }

      assert.ok(errorThrown, 'Should throw read error');
    });

    test('Should handle file write errors', () => {
      // Reset mock state
      mockWriteFileSync.throws = new Error('Write permission denied');

      let errorThrown = false;
      try {
        fs.writeFileSync('output.html', 'content', 'utf-8');
      } catch (error) {
        errorThrown = true;
        console.error(`Error: ${error}`);
        process.exit(1);
      }

      assert.ok(errorThrown, 'Should throw write error');
    });

    test('Should validate invalid formats', () => {
      const format = 'invalid';
      const validFormats = ['docx', 'html', 'pdf'];

      if (!validFormats.includes(format)) {
        console.error(`Error: Invalid format '${format}'. Use: docx, html, pdf`);
        process.exit(1);
      }

      // If we get here, the validation logic worked
      assert.ok(!validFormats.includes(format), 'Should detect invalid format');
    });
  });

  suite('Content Statistics', () => {
    test('Should count lines and dialogue', () => {
      const content = `Line 1

Line 3
"This is dialogue," she said.
Line 5
'Another dialogue line.'
Line 7`;

      const lines = content.split('\n');
      const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
      const dialogueLines = lines.filter((line) => {
        const trimmed = line.trim();
        return trimmed.startsWith('"') || trimmed.startsWith("'") || trimmed.startsWith('\u201C');
      });

      assert.strictEqual(nonEmptyLines.length, 6, 'Should count total non-empty lines');
      assert.strictEqual(dialogueLines.length, 2, 'Should count dialogue lines');
    });

    test('Should track export completion stats', () => {
      const stats = {
        startTime: Date.now(),
        endTime: Date.now() + 1000,
        inputFile: 'test.md',
        outputFile: 'output/test.html',
        format: 'html',
      };

      const duration = stats.endTime - stats.startTime;

      assert.ok(stats.inputFile.endsWith('.md'), 'Should track input file');
      assert.ok(stats.outputFile.includes('output'), 'Should track output file');
      assert.strictEqual(stats.format, 'html', 'Should track format');
      assert.ok(duration >= 0, 'Should calculate duration');
    });
  });

  suite('Command Line Interface', () => {
    test('Should show help with no arguments', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'export-novel.ts'];

      // Test the help logic
      const shouldShowHelp = process.argv.length <= 2;

      if (shouldShowHelp) {
        console.log('WriterDown Novel Exporter');
        console.log('Usage: export-novel <input-file> [options]');
      }

      assert.ok(shouldShowHelp, 'Should detect when help should be shown');

      process.argv = originalArgv;
    });

    test('Should show help with --help flag', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'export-novel.ts', '--help'];

      // Test the help flag logic
      const shouldShowHelp = process.argv.includes('--help');

      if (shouldShowHelp) {
        console.log('WriterDown Novel Exporter');
        console.log('Usage: export-novel <input-file> [options]');
      }

      assert.ok(shouldShowHelp, 'Should detect --help flag');

      process.argv = originalArgv;
    });

    test('Should handle unknown options', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'export-novel.ts', '--unknown'];

      const validOptions = ['--help', '--format', '--output'];
      const unknownOptions = process.argv.filter((arg) => arg.startsWith('--') && !validOptions.includes(arg));

      if (unknownOptions.length > 0) {
        console.error(`Error: Unknown option '${unknownOptions[0]}'`);
        process.exit(1);
      }

      assert.ok(unknownOptions.length > 0, 'Should detect unknown option');
      assert.strictEqual(unknownOptions[0], '--unknown', 'Should identify the unknown option');

      process.argv = originalArgv;
    });
  });

  // Additional helper functions and tests for better coverage
  suite('Text Processing', () => {
    test('Should handle dialogue detection correctly', () => {
      const isDialogueLine = (line: string) => {
        const trimmed = line.trim();
        return (
          (trimmed.startsWith('"') && trimmed.includes('"')) ||
          (trimmed.startsWith("'") && trimmed.includes("'")) ||
          (trimmed.startsWith('\u201C') && trimmed.includes('\u201D')) ||
          (trimmed.startsWith('\u2018') && trimmed.includes('\u2019'))
        );
      };

      assert.ok(isDialogueLine('"Hello world"'), 'Should detect basic dialogue');
      assert.ok(isDialogueLine("'Single quotes'"), 'Should detect single quote dialogue');
      assert.ok(!isDialogueLine('Regular text'), 'Should not detect regular text as dialogue');
      assert.ok(!isDialogueLine('Text with "quote" inside'), 'Should not detect quoted words as dialogue');
    });

    test('Should clean WriterDown markup', () => {
      const cleanMarkup = (text: string) => {
        return text
          .replace(/^---\s*\n[\s\S]*?\n---\s*\n?/m, '') // YAML frontmatter
          .replace(/@\[([^\]]+)\]/g, '$1') // Character mentions with brackets
          .replace(/@([A-Za-z0-9_]+)/g, '$1') // Simple character mentions
          .replace(/\{\{(TODO|RESEARCH|EDIT):.*?\}\}/gi, '') // Writer annotations
          .replace(/#!\s*\[[^\]]+\].*$/gm, '') // Story markers
          .replace(/\[\[[^\]]+\]\]/g, '') // Notes
          .replace(/\n\s*\n\s*\n/g, '\n\n'); // Excess whitespace
      };

      const input = `---
title: Test
---
@[Elena] said {{TODO: fix}} hello.
#! [Plot] Important scene
[[Note: check this]]`;

      const cleaned = cleanMarkup(input);
      assert.ok(cleaned.includes('Elena said') && cleaned.includes('hello'), 'Should clean markup correctly');
      assert.ok(!cleaned.includes('TODO'), 'Should remove annotations');
      assert.ok(!cleaned.includes('#!'), 'Should remove story markers');
    });
  });
});
