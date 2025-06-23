import * as path from 'path';
import * as vscode from 'vscode';

export interface StructureInfo {
  title: string;
  level: number; // 1 = Act, 2 = Chapter, 3 = Section
  type: 'act' | 'chapter' | 'section' | 'folder' | 'event';
  position: vscode.Position;
  lineNumber: number;
  fileName: string;
  filePath: string;
  folderPath?: string; // Relative path from Book/ (e.g., "Part1", "Part2/Chapter1")
  wordCount?: number; // Word count for this section
  chapterNumber?: string; // Chapter number from metadata (e.g., "5.1", "5.3.2")
}

export class StructureTreeItem extends vscode.TreeItem {
  public children: StructureTreeItem[] = [];

  constructor(public readonly structureInfo: StructureInfo, collapsibleState: vscode.TreeItemCollapsibleState) {
    // Format title with chapter number if available
    let displayTitle = structureInfo.title;
    if (structureInfo.chapterNumber && structureInfo.type === 'chapter') {
      displayTitle = `${structureInfo.chapterNumber} - ${structureInfo.title}`;
    }

    super(displayTitle, collapsibleState);

    const fileName = path.basename(structureInfo.fileName, '.md');
    this.tooltip = `${structureInfo.type.toUpperCase()}: ${displayTitle} (${fileName})`;
    this.contextValue = structureInfo.type;

    // Show only word count in description (no chapter number since it's in title)
    this.description = this.getDescription(structureInfo);

    // Different icons for different structure levels
    switch (structureInfo.type) {
      case 'act':
        this.iconPath = new vscode.ThemeIcon('book');
        break;
      case 'chapter':
        this.iconPath = new vscode.ThemeIcon('file-text');
        break;
      case 'section':
        this.iconPath = new vscode.ThemeIcon('symbol-text');
        break;
      case 'event':
        this.iconPath = new vscode.ThemeIcon('calendar');
        break;
    }

    this.command = {
      command: 'writerdown.goToStructure',
      title: 'Go to Structure',
      arguments: [structureInfo],
    };
  }

  addChild(child: StructureTreeItem): void {
    this.children.push(child);
  }

  private getDescription(structureInfo: StructureInfo): string {
    // Only show word count (chapter number is now in the title)
    if (structureInfo.type !== 'event' && structureInfo.wordCount !== undefined) {
      return `${structureInfo.wordCount} words`;
    }
    return '';
  }
}

export class StructureProvider implements vscode.TreeDataProvider<StructureTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<StructureTreeItem | undefined | null | void> =
    new vscode.EventEmitter<StructureTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<StructureTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private structure: StructureInfo[] = [];
  private hierarchicalStructure: StructureTreeItem[] = [];

  constructor() {
    // Don't auto-refresh in constructor
  }

  private async isWriterDownProject(): Promise<boolean> {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      return false;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const bookFolderUri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, 'Book'));

    try {
      const bookStat = await vscode.workspace.fs.stat(bookFolderUri);
      return !!(bookStat.type & vscode.FileType.Directory);
    } catch {
      return false;
    }
  }

  async refresh(): Promise<void> {
    console.log('StructureProvider: Starting refresh...');
    await this.scanForStructure();
    this.buildHierarchy();
    console.log(
      `StructureProvider: Refresh complete. Found ${this.structure.length} items, ${this.hierarchicalStructure.length} root items`,
    );
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: StructureTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: StructureTreeItem): Thenable<StructureTreeItem[]> {
    if (!element) {
      console.log(
        `StructureProvider: getChildren called for root, returning ${this.hierarchicalStructure.length} items`,
      );

      // Add project totals as the first item
      const totals = this.getProjectTotals();
      if (totals.totalWords > 0) {
        const totalsItem = new StructureTreeItem(
          {
            title: `Project: ${totals.totalWords.toLocaleString()} words • ${totals.totalPages} pages • ${
              totals.chapterCount
            } chapters`,
            level: 0,
            type: 'folder',
            position: new vscode.Position(0, 0),
            lineNumber: 0,
            fileName: 'Project Totals',
            filePath: '',
            folderPath: '',
          },
          vscode.TreeItemCollapsibleState.None,
        );
        totalsItem.iconPath = new vscode.ThemeIcon('graph');
        totalsItem.contextValue = 'projectTotals';
        totalsItem.command = undefined; // No command for totals item

        return Promise.resolve([totalsItem, ...this.hierarchicalStructure]);
      }

      return Promise.resolve(this.hierarchicalStructure);
    }
    console.log(
      `StructureProvider: getChildren called for ${element.structureInfo.title}, returning ${element.children.length} children`,
    );
    return Promise.resolve(element.children);
  }

  private buildHierarchy(): void {
    this.hierarchicalStructure = [];

    // Create a map to track folder nodes
    const folderMap = new Map<string, StructureTreeItem>();

    // Group items by folder path
    const itemsByFolder = new Map<string, StructureInfo[]>();

    for (const item of this.structure) {
      const folderKey = item.folderPath || '';
      if (!itemsByFolder.has(folderKey)) {
        itemsByFolder.set(folderKey, []);
      }
      itemsByFolder.get(folderKey)!.push(item);
    }

    // Sort folder paths to ensure proper nesting (parent folders before child folders)
    const sortedFolderPaths = Array.from(itemsByFolder.keys()).sort((a, b) => {
      if (a === '') return -1; // Root folder first
      if (b === '') return 1;
      return a.split('/').length - b.split('/').length; // Shallower paths first
    });

    // Create folder structure
    for (const folderPath of sortedFolderPaths) {
      const items = itemsByFolder.get(folderPath)!;

      if (folderPath === '') {
        // Items directly in Book/ folder - build hierarchical structure
        this.buildFileHierarchy(items, this.hierarchicalStructure);
      } else {
        // Items in subfolders - create folder structure first
        const folderParts = folderPath.split('/');
        let currentParent: StructureTreeItem[] = this.hierarchicalStructure;
        let currentPath = '';

        // Create nested folder structure
        for (const folderName of folderParts) {
          currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;

          let folderNode = folderMap.get(currentPath);
          if (!folderNode) {
            // Create folder node
            const folderInfo: StructureInfo = {
              title: folderName,
              level: 0,
              type: 'folder',
              position: new vscode.Position(0, 0),
              lineNumber: 0,
              fileName: folderName,
              filePath: '',
              folderPath: currentPath,
            };

            folderNode = new StructureTreeItem(folderInfo, vscode.TreeItemCollapsibleState.Expanded);
            folderNode.iconPath = new vscode.ThemeIcon('folder');
            folderMap.set(currentPath, folderNode);

            currentParent.push(folderNode);
          }

          currentParent = folderNode.children;
        }

        // Build hierarchical structure for items in this folder
        this.buildFileHierarchy(items, currentParent);
      }
    }
  }

  private sortChapterNumbers(a: string, b: string): number {
    // Split by dots and convert to numbers for proper sorting
    const aParts = a.split('.').map((part) => parseInt(part, 10));
    const bParts = b.split('.').map((part) => parseInt(part, 10));

    // Compare each part
    const maxLength = Math.max(aParts.length, bParts.length);
    for (let i = 0; i < maxLength; i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      if (aPart !== bPart) {
        return aPart - bPart;
      }
    }
    return 0;
  }

  private buildFileHierarchy(items: StructureInfo[], parentArray: StructureTreeItem[]): void {
    // Group items by file for proper hierarchy building
    const itemsByFile = new Map<string, StructureInfo[]>();

    for (const item of items) {
      if (!itemsByFile.has(item.filePath)) {
        itemsByFile.set(item.filePath, []);
      }
      itemsByFile.get(item.filePath)!.push(item);
    }

    // Process each file's items
    for (const fileItems of itemsByFile.values()) {
      // Sort by line number to ensure proper order
      fileItems.sort((a, b) => a.lineNumber - b.lineNumber);

      // Build hierarchy for this file
      const stack: StructureTreeItem[] = [];

      for (const item of fileItems) {
        const treeItem = new StructureTreeItem(item, this.getCollapsibleState(item));

        if (item.type === 'event') {
          // Events go under the most recent header
          if (stack.length > 0) {
            stack[stack.length - 1].addChild(treeItem);
          } else {
            // If no parent header, add to root (shouldn't happen normally)
            parentArray.push(treeItem);
          }
        } else {
          // Regular headers (acts, chapters, sections)
          // Pop items from stack until we find the right parent level
          while (stack.length > 0 && stack[stack.length - 1].structureInfo.level >= item.level) {
            stack.pop();
          }

          if (stack.length === 0) {
            // Top level item
            parentArray.push(treeItem);
          } else {
            // Child of the item at top of stack
            stack[stack.length - 1].addChild(treeItem);
          }

          // Add this item to the stack for potential children
          stack.push(treeItem);
        }
      }
    }

    // Sort the final array by chapter number if available, then by title
    parentArray.sort((a, b) => {
      // If both have chapter numbers, sort by them
      if (a.structureInfo.chapterNumber && b.structureInfo.chapterNumber) {
        return this.sortChapterNumbers(a.structureInfo.chapterNumber, b.structureInfo.chapterNumber);
      }

      // If only one has a chapter number, prioritize it
      if (a.structureInfo.chapterNumber && !b.structureInfo.chapterNumber) {
        return -1;
      }
      if (!a.structureInfo.chapterNumber && b.structureInfo.chapterNumber) {
        return 1;
      }

      // Otherwise sort by title
      return a.structureInfo.title.localeCompare(b.structureInfo.title);
    });
  }

  private getCollapsibleState(item: StructureInfo): vscode.TreeItemCollapsibleState {
    if (item.type === 'folder') {
      return vscode.TreeItemCollapsibleState.Expanded;
    }

    // Events should never be collapsible - they're just markers
    if (item.type === 'event') {
      return vscode.TreeItemCollapsibleState.None;
    }

    // Check if this item has any child sections or events within the same file
    const hasChildren = this.structure.some((other) => {
      // Must be in the same file and after this item
      if (other.filePath !== item.filePath || other.lineNumber <= item.lineNumber) {
        return false;
      }

      // For events, they are children if they appear before the next header of same or higher level
      if (other.type === 'event') {
        // Find the next header at the same or higher level than the current item
        const nextSameLevelHeader = this.structure.find(
          (header) =>
            header.filePath === item.filePath &&
            header.lineNumber > item.lineNumber &&
            header.type !== 'event' &&
            header.level <= item.level,
        );

        // Event is a child if it appears before the next same-level header (or at end of file)
        return !nextSameLevelHeader || other.lineNumber < nextSameLevelHeader.lineNumber;
      }

      // For regular headers, use the original logic
      return other.level > item.level;
    });

    return hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
  }

  private async scanForStructure(): Promise<void> {
    this.structure = []; // Clear existing data

    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      console.log('No workspace folders found');
      return;
    }

    // Check if this is a WriterDown project
    if (!(await this.isWriterDownProject())) {
      console.log('Not a WriterDown project, skipping structure scanning');
      return;
    }

    try {
      // Find all markdown files only in the Book folder
      const files = await vscode.workspace.findFiles('Book/**/*.md', '**/node_modules/**');
      console.log(`Found ${files.length} markdown files in Book folder`);

      for (const file of files) {
        await this.scanFile(file);
      }

      // Sort by file name, then by line number
      this.structure.sort((a, b) => {
        const fileCompare = a.fileName.localeCompare(b.fileName);
        if (fileCompare !== 0) return fileCompare;
        return a.lineNumber - b.lineNumber;
      });

      console.log(`Found ${this.structure.length} structure items`);
    } catch (error) {
      console.error('Error scanning for structure:', error);
    }
  }

  private async scanFile(fileUri: vscode.Uri): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(fileUri);
      const lines = document.getText().split('\n');
      const fullText = document.getText();
      const fileName = path.basename(fileUri.fsPath);

      // Extract folder path relative to Book/
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;

      const bookPath = path.join(workspaceFolder.uri.fsPath, 'Book');
      const relativePath = path.relative(bookPath, fileUri.fsPath);
      const folderPath = path.dirname(relativePath);
      const normalizedFolderPath = folderPath === '.' ? '' : folderPath.replace(/\\/g, '/');

      // Extract metadata from YAML frontmatter
      const metadata = this.extractMetadata(fullText);

      const structureItems: StructureInfo[] = [];

      lines.forEach((line, index) => {
        const position = new vscode.Position(index, 0);

        // Match markdown headers # ## ### etc.
        const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
        // Match event markers #! [EVENT] Title
        const eventMatch = line.match(/^#!\s*\[EVENT\]\s*(.+)$/i);

        if (headerMatch) {
          // Skip Writer's Notes, Author's Notes, and Notes sections
          const headerText = headerMatch[2].trim().toLowerCase();
          if (
            headerText.includes("writer's notes") ||
            headerText.includes('writers notes') ||
            headerText.includes("author's notes") ||
            headerText.includes('authors notes') ||
            headerText === 'notes'
          ) {
            return; // Skip this header
          }
          const level = headerMatch[1].length;
          let title = headerMatch[2].trim();

          // Determine type based on content and level
          let type: 'act' | 'chapter' | 'section' | 'folder' = 'section';
          const lowerTitle = title.toLowerCase();
          const lowerFileName = fileName.toLowerCase();

          // Check if this is a chapter file (e.g., Chapter-01.md, chapter1.md)
          const isChapterFile = lowerFileName.includes('chapter') || /chapter[-_]?\d+/i.test(fileName);

          if (level === 1) {
            if (lowerTitle.includes('act') || lowerTitle.includes('part')) {
              type = 'act';
            } else if (lowerTitle.includes('chapter') || isChapterFile || metadata.chapter) {
              type = 'chapter';
              // Use metadata title if available, otherwise format from header
              if (metadata.title) {
                title = metadata.title;
              } else if (metadata.chapter && lowerTitle.includes('chapter')) {
                // Extract just the chapter name part (after "Chapter X:")
                const chapterNameMatch = title.match(/^Chapter\s+\d+:\s*(.+)$/i);
                if (chapterNameMatch) {
                  title = `${metadata.chapter}: ${chapterNameMatch[1]}`;
                }
              }
            } else {
              type = 'act'; // Top level defaults to act
            }
          } else if (level === 2) {
            if (lowerTitle.includes('chapter') || isChapterFile || metadata.chapter) {
              type = 'chapter';
              // Use metadata title if available, otherwise format from header
              if (metadata.title) {
                title = metadata.title;
              } else if (metadata.chapter && lowerTitle.includes('chapter')) {
                const chapterNameMatch = title.match(/^Chapter\s+\d+:\s*(.+)$/i);
                if (chapterNameMatch) {
                  title = `${metadata.chapter}: ${chapterNameMatch[1]}`;
                }
              }
            } else {
              type = 'section';
            }
          } else {
            type = 'section';
          }

          structureItems.push({
            title: title,
            level: level,
            type: type,
            position: position,
            lineNumber: index + 1,
            fileName: fileName,
            filePath: fileUri.fsPath,
            folderPath: normalizedFolderPath,
            chapterNumber: type === 'chapter' ? metadata.chapter : undefined,
          });
        } else if (eventMatch) {
          // Handle event markers
          const eventTitle = eventMatch[1].trim();

          structureItems.push({
            title: `${eventTitle}`,
            level: 3, // Treat events as level 3 (subsections)
            type: 'event', // New type for events
            position: position,
            lineNumber: index + 1,
            fileName: fileName,
            filePath: fileUri.fsPath,
            folderPath: normalizedFolderPath,
          });
        }
      });

      // Calculate word counts for each section (skip events)
      for (let i = 0; i < structureItems.length; i++) {
        const currentItem = structureItems[i];

        // Skip word counting for events
        if (currentItem.type === 'event') {
          continue;
        }

        // Find the next non-event item to determine section boundaries
        let nextItem = null;
        for (let j = i + 1; j < structureItems.length; j++) {
          if (structureItems[j].type !== 'event') {
            nextItem = structureItems[j];
            break;
          }
        }

        // Extract text for this section
        const startLine = currentItem.lineNumber - 1; // Convert to 0-based
        const endLine = nextItem ? nextItem.lineNumber - 1 : lines.length;

        const sectionLines = lines.slice(startLine, endLine);
        const sectionText = sectionLines.join('\n');

        // Count words using the same logic as the main word counter
        const wordCount = this.countWords(sectionText);
        currentItem.wordCount = wordCount;
      }

      // Add all items to the main structure array
      this.structure.push(...structureItems);
    } catch (error) {
      console.error('Error scanning file:', fileUri.fsPath, error);
    }
  }

  private countWords(text: string): number {
    // Remove WriterDown-specific syntax for counting (same logic as extension.ts)
    let cleanText = text
      // Remove YAML frontmatter
      .replace(/^---\s*\n[\s\S]*?\n---\s*\n?/m, '')
      // Remove scene markers
      .replace(/\*\*\*\s*SCENE\s+\d+:.*?\*\*\*/gi, '')
      // Remove plot notes
      .replace(/\[PLOT:.*?\]/gi, '')
      // Remove character mentions (but keep the name)
      .replace(/@([A-Za-z0-9_]+)/g, '$1')
      .replace(/@\[([^\]]+)\]/g, '$1')
      // Remove general notes
      .replace(/\[\[.*?\]\]/g, '')
      // Remove writer tasks
      .replace(/\{\{(TODO|RESEARCH|EDIT):.*?\}\}/gi, '')
      // Remove Writer's Notes sections
      .replace(/^###\s+Writer'?s?\s+Notes?[\s\S]*?(?=^###|\n---|\n\n---|\Z)/gim, '')
      // Remove Author's Notes sections
      .replace(/^###\s+Author'?s?\s+Notes?[\s\S]*?(?=^###|\n---|\n\n---|\Z)/gim, '')
      // Remove Notes sections at the end of documents
      .replace(/^##\s+Notes[\s\S]*?(?=^##|\n---|\n\n---|\Z)/gim, '')
      // Remove markdown headers
      .replace(/^#+\s*/gm, '')
      // Remove markdown bold/italic
      .replace(/[*_]+([^*_]+)[*_]+/g, '$1')
      // Remove markdown links
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code
      .replace(/`[^`]+`/g, '');

    // Count words (split by whitespace and filter out empty strings)
    const words = cleanText.split(/\s+/).filter((word) => word.trim().length > 0).length;
    return words;
  }

  private extractMetadata(text: string): { chapter?: string; title?: string; status?: string } {
    const metadata: { chapter?: string; title?: string; status?: string } = {};

    // Check if the file starts with YAML frontmatter
    const yamlMatch = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (yamlMatch) {
      const yamlContent = yamlMatch[1];

      // Extract chapter number (can be decimal like 5.1, 5.3.2)
      const chapterMatch = yamlContent.match(/^chapter:\s*([\d.]+)\s*$/m);
      if (chapterMatch) {
        metadata.chapter = chapterMatch[1];
      }

      // Extract title
      const titleMatch = yamlContent.match(/^title:\s*['"]?(.*?)['"]?\s*$/m);
      if (titleMatch) {
        metadata.title = titleMatch[1];
      }

      // Extract status
      const statusMatch = yamlContent.match(/^status:\s*['"]?(.*?)['"]?\s*$/m);
      if (statusMatch) {
        metadata.status = statusMatch[1];
      }
    }

    return metadata;
  }

  getAllStructure(): StructureInfo[] {
    return this.structure;
  }

  getProjectTotals(): { totalWords: number; totalPages: number; chapterCount: number } {
    let totalWords = 0;
    let chapterCount = 0;

    // Sum up word counts from all structure items
    for (const item of this.structure) {
      if (item.wordCount && item.wordCount > 0) {
        totalWords += item.wordCount;
      }
      if (item.type === 'chapter') {
        chapterCount++;
      }
    }

    // Get configurable words per page setting
    const config = vscode.workspace.getConfiguration('writerdown');
    const wordsPerPage = config.get<number>('wordsPerPage', 250);

    // Calculate page estimation
    const totalPages = Math.ceil(totalWords / wordsPerPage);

    return {
      totalWords,
      totalPages,
      chapterCount,
    };
  }

  async createNewChapter(): Promise<void> {
    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];

    try {
      // Create Book directory if it doesn't exist
      const bookDir = path.join(workspaceFolder.uri.fsPath, 'Book');
      const bookDirUri = vscode.Uri.file(bookDir);
      try {
        await vscode.workspace.fs.stat(bookDirUri);
      } catch {
        await vscode.workspace.fs.createDirectory(bookDirUri);
        console.log('Created Book directory');
      }

      // Find existing chapter files to determine next chapter number
      const files = await vscode.workspace.findFiles('Book/**/*.md', '**/node_modules/**');
      const chapterNumbers: string[] = [];

      for (const file of files) {
        try {
          const document = await vscode.workspace.openTextDocument(file);
          const metadata = this.extractMetadata(document.getText());
          if (metadata.chapter) {
            chapterNumbers.push(metadata.chapter);
          }
        } catch (error) {
          console.error('Error reading file metadata:', file.fsPath, error);
        }
      }

      // Ask user for chapter number
      const chapterNumber = await vscode.window.showInputBox({
        prompt: 'Enter chapter number (e.g., 1, 5.1, 5.3.2)',
        placeHolder: '1',
        value: '1',
      });

      if (!chapterNumber) {
        return;
      }

      // Ask user for chapter title
      const chapterTitle = await vscode.window.showInputBox({
        prompt: 'Enter chapter title',
        placeHolder: `Chapter ${chapterNumber}`,
        value: `Chapter ${chapterNumber}`,
      });

      if (!chapterTitle) {
        return;
      }

      // Create filename based on chapter number
      const safeChapterNumber = chapterNumber.replace(/[^a-zA-Z0-9.-]/g, '-');
      const chapterFileName = `Chapter-${safeChapterNumber}.md`;
      const chapterPath = path.join(bookDir, chapterFileName);

      // Create chapter content
      const chapterContent = `---
chapter: ${chapterNumber}
title: '${chapterTitle}'
status: draft
---

# ${chapterTitle}

{{TODO: Start writing this chapter}}

Write your chapter content here...

---

### Writer's Notes

- Character focus: 
- Key events: 
- Setting: 
- Mood/Tone: 

{{TODO: Review and edit this chapter}}
`;

      // Write the file
      const fileUri = vscode.Uri.file(chapterPath);
      await vscode.workspace.fs.writeFile(fileUri, Buffer.from(chapterContent, 'utf8'));

      // Open the new file
      const document = await vscode.workspace.openTextDocument(fileUri);
      await vscode.window.showTextDocument(document);

      // Set language to WriterDown
      await vscode.languages.setTextDocumentLanguage(document, 'writerdown');

      // Refresh the structure view
      await this.refresh();

      vscode.window.showInformationMessage(`Created ${chapterFileName}`);
    } catch (error) {
      console.error('Error creating new chapter:', error);
      vscode.window.showErrorMessage('Failed to create new chapter');
    }
  }
}
