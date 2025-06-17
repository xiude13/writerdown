import * as vscode from 'vscode';

export interface NovelFormattingOptions {
  indentDialogue: boolean;
  dialogueIndentSize: number;
  sceneBreakStyle: 'asterisks' | 'hash' | 'space';
  paragraphSpacing: 'single' | 'double';
  removeTrailingSpaces: boolean;
  standardizeQuotes: boolean;
}

export class NovelFormatter {
  private static readonly DEFAULT_OPTIONS: NovelFormattingOptions = {
    indentDialogue: true,
    dialogueIndentSize: 4, // spaces
    sceneBreakStyle: 'asterisks',
    paragraphSpacing: 'single',
    removeTrailingSpaces: true,
    standardizeQuotes: true,
  };

  /**
   * Format document for novel writing standards
   */
  public static async formatDocument(
    document: vscode.TextDocument,
    options?: Partial<NovelFormattingOptions>,
  ): Promise<string> {
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    const text = document.getText();
    const lines = text.split('\n');

    const formattedLines: string[] = [];
    let inCodeBlock = false;
    let inBlockQuote = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Track code blocks and blockquotes to avoid formatting them
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        formattedLines.push(line);
        continue;
      }

      if (inCodeBlock) {
        formattedLines.push(line);
        continue;
      }

      // Check for blockquotes (but not our dialogue)
      if (line.trim().startsWith('>') && !this.isDialogueLine(line)) {
        inBlockQuote = true;
      } else if (inBlockQuote && line.trim() === '') {
        inBlockQuote = false;
      }

      if (inBlockQuote) {
        formattedLines.push(line);
        continue;
      }

      // Apply novel formatting
      line = this.formatLine(line, config, i, lines);
      formattedLines.push(line);
    }

    return formattedLines.join('\n');
  }

  /**
   * Format a single line according to novel standards
   */
  private static formatLine(
    line: string,
    config: NovelFormattingOptions,
    lineIndex: number,
    allLines: string[],
  ): string {
    let formatted = line;

    // Remove trailing spaces if configured
    if (config.removeTrailingSpaces) {
      formatted = formatted.replace(/\s+$/, '');
    }

    // Standardize quotes if configured
    if (config.standardizeQuotes) {
      formatted = this.standardizeQuotes(formatted);
    }

    // Handle dialogue indentation
    if (config.indentDialogue && this.isDialogueLine(formatted)) {
      formatted = this.formatDialogue(formatted, config);
    }

    // Handle scene breaks
    formatted = this.formatSceneBreaks(formatted, config);

    return formatted;
  }

  /**
   * Check if a line contains dialogue
   */
  public static isDialogueLine(line: string): boolean {
    const trimmed = line.trim();

    // Check for dialogue patterns:
    // - Lines starting with quotes
    // - Lines with quotes and dialogue tags
    // - Em-dash dialogue (European style)

    return (
      trimmed.startsWith('"') ||
      trimmed.startsWith("'") ||
      trimmed.startsWith('\u201C') ||
      trimmed.startsWith('\u2018') ||
      trimmed.startsWith('—') ||
      /^["\u201C\u201D'\u2018\u2019].*["\u201C\u201D'\u2018\u2019]/.test(trimmed) ||
      /^["\u201C\u201D'\u2018\u2019].*," (he|she|they|it|\w+) (said|asked|replied|whispered|shouted|muttered)/i.test(
        trimmed,
      )
    );
  }

  /**
   * Format dialogue line - just mark it for export processing
   */
  private static formatDialogue(line: string, config: NovelFormattingOptions): string {
    const trimmed = line.trim();
    if (!trimmed) return line;

    // Don't modify if already marked or indented
    if (line.includes('<!--dialogue-->') || line.startsWith('    ') || line.startsWith('\t')) {
      return line;
    }

    // Just add invisible marker for export processing - no visual indentation in VS Code
    return `<!--dialogue-->${trimmed}`;
  }

  /**
   * Standardize quote marks
   */
  private static standardizeQuotes(line: string): string {
    // Convert various quote types to standard double quotes
    return line
      .replace(/[""]/g, '"') // Smart quotes to straight
      .replace(/['']/g, "'") // Smart single quotes to straight
      .replace(/`([^`]+)`/g, '"$1"'); // Backticks to quotes (if not code)
  }

  /**
   * Format scene breaks
   */
  private static formatSceneBreaks(line: string, config: NovelFormattingOptions): string {
    const trimmed = line.trim();

    // Detect scene break patterns
    if (this.isSceneBreak(trimmed)) {
      switch (config.sceneBreakStyle) {
        case 'asterisks':
          return '                    * * *';
        case 'hash':
          return '                    # # #';
        case 'space':
          return '';
        default:
          return line;
      }
    }

    return line;
  }

  /**
   * Check if line is a scene break
   */
  private static isSceneBreak(line: string): boolean {
    return (
      /^\*+$/.test(line) ||
      /^#+$/.test(line) ||
      /^\* \* \*$/.test(line) ||
      /^# # #$/.test(line) ||
      /^-{3,}$/.test(line) ||
      /^_{3,}$/.test(line)
    );
  }

  /**
   * Clean up markdown indentation that creates unwanted code blocks
   */
  public static cleanMarkdownIndentation(text: string): string {
    const lines = text.split('\n');
    const cleaned: string[] = [];

    for (const line of lines) {
      // If line starts with 4+ spaces and looks like dialogue, clean it
      if (line.match(/^    +[""''"]/) || line.match(/^    +—/)) {
        // Remove the indentation that would create a code block
        cleaned.push(line.replace(/^    +/, ''));
      } else {
        cleaned.push(line);
      }
    }

    return cleaned.join('\n');
  }

  /**
   * Prepare text for export with proper novel formatting
   */
  public static prepareForExport(text: string, format: 'docx' | 'pdf' | 'html' = 'docx'): string {
    const lines = text.split('\n');
    const exportLines: string[] = [];

    for (const line of lines) {
      // Check if line is dialogue (with or without our marker)
      const isDialogue = line.includes('<!--dialogue-->') || this.isDialogueLine(line);

      if (isDialogue) {
        // Remove our marker if present
        const cleanLine = line.replace('<!--dialogue-->', '').trim();

        switch (format) {
          case 'docx':
            // For Word export, use actual indentation (0.5 inch standard)
            exportLines.push(`    ${cleanLine}`);
            break;
          case 'html':
            // For HTML, use CSS class
            exportLines.push(`<p class="dialogue">${cleanLine}</p>`);
            break;
          case 'pdf':
            // For PDF, use indentation
            exportLines.push(`    ${cleanLine}`);
            break;
          default:
            exportLines.push(`    ${cleanLine}`);
        }
      } else {
        exportLines.push(line);
      }
    }

    return exportLines.join('\n');
  }

  /**
   * Get CSS for HTML export with proper dialogue styling
   */
  public static getExportCSS(): string {
    return `
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
            }
        `;
  }
}
