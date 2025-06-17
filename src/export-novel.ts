#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import { NovelFormatter } from './novelFormatter';

interface CliOptions {
  input: string;
  output?: string;
  format: 'docx' | 'html' | 'pdf';
  help?: boolean;
}

function showHelp() {
  console.log(`
WriterDown Novel Exporter

Usage: ts-node scripts/export-novel.ts <input-file> [options]

Options:
  --format <format>    Export format: docx, html, pdf (default: docx)
  --output <file>      Output file path (default: auto-generated)
  --help              Show this help message

Examples:
  ts-node scripts/export-novel.ts example-project/dialogue-example.md
  ts-node scripts/export-novel.ts story.md --format html --output formatted-story.html
  ts-node scripts/export-novel.ts novel.md --format pdf
`);
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    showHelp();
    process.exit(0);
  }

  const options: CliOptions = {
    input: args[0],
    format: 'docx',
  };

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--format':
        const format = args[++i];
        if (!['docx', 'html', 'pdf'].includes(format)) {
          console.error(`Error: Invalid format '${format}'. Use: docx, html, pdf`);
          process.exit(1);
        }
        options.format = format as 'docx' | 'html' | 'pdf';
        break;
      case '--output':
        options.output = args[++i];
        break;
      default:
        console.error(`Error: Unknown option '${args[i]}'`);
        process.exit(1);
    }
  }

  return options;
}

function generateOutputPath(inputPath: string, format: string): string {
  const parsed = path.parse(inputPath);
  const extension = format === 'html' ? 'html' : 'md';
  return path.join(parsed.dir, `${parsed.name}-formatted.${extension}`);
}

async function exportNovel(options: CliOptions): Promise<void> {
  try {
    // Check if input file exists
    if (!fs.existsSync(options.input)) {
      console.error(`Error: Input file '${options.input}' not found`);
      process.exit(1);
    }

    // Read input file
    console.log(`Reading: ${options.input}`);
    const content = fs.readFileSync(options.input, 'utf-8');

    // Create a mock document object for the formatter
    const mockDocument = {
      getText: () => content,
      fileName: options.input,
    };

    // Format the content
    console.log(`Formatting for ${options.format.toUpperCase()} export...`);
    const formattedContent = NovelFormatter.prepareForExport(content, options.format);

    // Generate output path if not provided
    const outputPath = options.output || generateOutputPath(options.input, options.format);

    // Add HTML wrapper if needed
    let finalContent = formattedContent;
    if (options.format === 'html') {
      finalContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Novel Export</title>
    <style>
${NovelFormatter.getExportCSS()}
    </style>
</head>
<body class="vscode-body">
${formattedContent
  .split('\n')
  .map((line) => {
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
  })
  .join('\n')}
</body>
</html>`;
    }

    // Write output file
    fs.writeFileSync(outputPath, finalContent, 'utf-8');

    console.log(`✅ Export complete: ${outputPath}`);
    console.log(`📊 Format: ${options.format.toUpperCase()}`);

    // Show some stats
    const lines = content.split('\n');
    const dialogueLines = lines.filter((line) => NovelFormatter.isDialogueLine(line)).length;
    const totalLines = lines.filter((line) => line.trim()).length;

    console.log(`📈 Stats:`);
    console.log(`   - Total lines: ${totalLines}`);
    console.log(`   - Dialogue lines: ${dialogueLines}`);
    console.log(`   - Dialogue formatted with proper indentation`);
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}

// isDialogueLine is now public in NovelFormatter

// Run if called directly
if (require.main === module) {
  const options = parseArgs();
  exportNovel(options);
}

export { CliOptions, exportNovel };
