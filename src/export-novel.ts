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
  --output <file>      Output file path (default: auto-generated in output/)
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
  const workspaceRoot = process.cwd();
  const outputDir = path.join(workspaceRoot, 'output');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

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

  return path.join(outputDir, `${parsed.name}-formatted.${extension}`);
}

async function generatePDF(htmlContent: string, outputPath: string): Promise<void> {
  try {
    // Try using puppeteer for PDF generation
    const puppeteer = require('puppeteer');

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Set page format for manuscript
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: outputPath,
      format: 'A4',
      margin: {
        top: '1in',
        right: '1in',
        bottom: '1in',
        left: '1.25in', // Standard manuscript margin
      },
      printBackground: true,
    });

    await browser.close();
    console.log(`📄 PDF generated with Puppeteer`);
  } catch (puppeteerError) {
    console.log(`⚠️  Puppeteer not available: ${(puppeteerError as Error).message}`);
    console.log(`📝 Falling back to HTML-to-PDF conversion...`);

    try {
      // Fallback: Try html-pdf
      const pdf = require('html-pdf');

      const options = {
        format: 'A4',
        border: {
          top: '1in',
          right: '1in',
          bottom: '1in',
          left: '1.25in',
        },
        type: 'pdf',
        quality: '75',
      };

      pdf.create(htmlContent, options).toFile(outputPath, (err: any, res: any) => {
        if (err) {
          throw err;
        }
        console.log(`📄 PDF generated with html-pdf`);
      });
    } catch (htmlPdfError) {
      console.log(`⚠️  html-pdf not available: ${(htmlPdfError as Error).message}`);

      // Final fallback: Save as HTML with PDF styling and instructions
      const pdfHtmlPath = outputPath.replace('.pdf', '.pdf.html');
      const pdfReadyHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>PDF Export - Ready for Print</title>
    <style>
        @page {
            size: A4;
            margin: 1in 1in 1in 1.25in;
        }
        
        body {
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 2;
            color: black;
            background: white;
        }
        
        .dialogue {
            text-indent: 2em;
            margin-left: 0;
        }
        
        .scene-break {
            text-align: center;
            margin: 2em 0;
            font-weight: bold;
        }
        
        .chapter-heading {
            text-align: center;
            margin: 3em 0 2em 0;
            font-size: 1.2em;
            font-weight: bold;
            page-break-before: always;
        }
        
        p {
            margin: 0 0 1em 0;
            text-align: left;
            text-indent: 2em;
            widows: 2;
            orphans: 2;
        }
        
        h1, h2, h3 {
            text-indent: 0;
        }
    </style>
</head>
<body>
<!-- PDF INSTRUCTIONS: Open this file in a browser and use Print > Save as PDF -->
${htmlContent.split('<body class="vscode-body">')[1].split('</body>')[0]}
</body>
</html>`;

      fs.writeFileSync(pdfHtmlPath, pdfReadyHtml, 'utf-8');
      console.log(`📄 PDF-ready HTML created: ${pdfHtmlPath}`);
      console.log(`   Open in browser and use 'Print > Save as PDF' to create PDF`);
    }
  }
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

    // Format the content
    console.log(`Formatting for ${options.format.toUpperCase()} export...`);
    const formattedContent = NovelFormatter.prepareForExport(content, options.format);

    // Generate output path if not provided
    const outputPath = options.output || generateOutputPath(options.input, options.format);

    if (options.format === 'pdf') {
      // For PDF, first create HTML, then convert
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Novel Export</title>
    <style>
${NovelFormatter.getExportCSS()}
        body {
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 2;
            max-width: none;
            margin: 0;
            padding: 0;
        }
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

      await generatePDF(htmlContent, outputPath);
    } else if (options.format === 'html') {
      // Create HTML with enhanced styling
      const finalContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Novel Export</title>
    <style>
${NovelFormatter.getExportCSS()}
        body {
            font-family: 'Times New Roman', serif;
            font-size: 16px;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 2em;
            background: #fefefe;
            color: #333;
        }
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

      fs.writeFileSync(outputPath, finalContent, 'utf-8');
    } else {
      // Write markdown file
      fs.writeFileSync(outputPath, formattedContent, 'utf-8');
    }

    console.log(`✅ Export complete: ${outputPath}`);
    console.log(`📊 Format: ${options.format.toUpperCase()}`);

    // Show some stats
    const lines = content.split('\n');
    const dialogueLines = lines.filter((line) => NovelFormatter.isDialogueLine(line)).length;
    const totalLines = lines.filter((line) => line.trim()).length;

    console.log(`📈 Stats:`);
    console.log(`   - Total lines: ${totalLines}`);
    console.log(`   - Dialogue lines: ${dialogueLines}`);
    console.log(`   - All WriterDown markup removed`);
    console.log(`   - Dialogue formatted with proper indentation`);
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  const options = parseArgs();
  exportNovel(options);
}

export { CliOptions, exportNovel };
