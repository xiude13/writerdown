import * as path from 'path';
import * as vscode from 'vscode';

export interface StructureInfo {
  title: string;
  level: number; // 1 = Act, 2 = Chapter, 3 = Section
  type: 'act' | 'chapter' | 'section' | 'folder';
  position: vscode.Position;
  lineNumber: number;
  fileName: string;
  filePath: string;
  folderPath?: string; // Relative path from Book/ (e.g., "Part1", "Part2/Chapter1")
}

export class StructureTreeItem extends vscode.TreeItem {
  public children: StructureTreeItem[] = [];

  constructor(public readonly structureInfo: StructureInfo, collapsibleState: vscode.TreeItemCollapsibleState) {
    super(structureInfo.title, collapsibleState);

    const fileName = path.basename(structureInfo.fileName, '.md');
    this.tooltip = `${structureInfo.type.toUpperCase()}: ${structureInfo.title} (${fileName})`;
    this.contextValue = structureInfo.type;

    // Show file name for chapters from different files
    if (structureInfo.type === 'chapter' && structureInfo.lineNumber === 1) {
      this.description = fileName;
    } else {
      this.description = `${fileName}:${structureInfo.lineNumber}`;
    }

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
        // Items directly in Book/ folder
        for (const item of items) {
          const treeItem = new StructureTreeItem(item, this.getCollapsibleState(item));
          this.hierarchicalStructure.push(treeItem);
        }
      } else {
        // Items in subfolders - create folder structure
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

        // Add items to the deepest folder
        for (const item of items) {
          const treeItem = new StructureTreeItem(item, this.getCollapsibleState(item));
          currentParent.push(treeItem);
        }
      }
    }
  }

  private getCollapsibleState(item: StructureInfo): vscode.TreeItemCollapsibleState {
    if (item.type === 'folder') {
      return vscode.TreeItemCollapsibleState.Expanded;
    }

    // Check if this item has any child sections within the same file
    const hasChildren = this.structure.some(
      (other) => other.filePath === item.filePath && other.lineNumber > item.lineNumber && other.level > item.level,
    );

    return hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
  }

  private async scanForStructure(): Promise<void> {
    this.structure = []; // Clear existing data

    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      console.log('No workspace folders found');
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
      const fileName = path.basename(fileUri.fsPath);

      // Extract folder path relative to Book/
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;

      const bookPath = path.join(workspaceFolder.uri.fsPath, 'Book');
      const relativePath = path.relative(bookPath, fileUri.fsPath);
      const folderPath = path.dirname(relativePath);
      const normalizedFolderPath = folderPath === '.' ? '' : folderPath.replace(/\\/g, '/');

      lines.forEach((line, index) => {
        const position = new vscode.Position(index, 0);

        // Match markdown headers # ## ### etc.
        const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          const title = headerMatch[2].trim();

          // Determine type based on content and level
          let type: 'act' | 'chapter' | 'section' | 'folder' = 'section';
          const lowerTitle = title.toLowerCase();
          const lowerFileName = fileName.toLowerCase();

          // Check if this is a chapter file (e.g., Chapter-01.md, chapter1.md)
          const isChapterFile = lowerFileName.includes('chapter') || /chapter[-_]?\d+/i.test(fileName);

          if (level === 1) {
            if (lowerTitle.includes('act') || lowerTitle.includes('part')) {
              type = 'act';
            } else if (lowerTitle.includes('chapter') || isChapterFile) {
              type = 'chapter';
            } else if (isChapterFile) {
              type = 'chapter';
            } else {
              type = 'act'; // Top level defaults to act
            }
          } else if (level === 2) {
            if (lowerTitle.includes('chapter') || isChapterFile) {
              type = 'chapter';
            } else {
              type = 'section';
            }
          } else {
            type = 'section';
          }

          this.structure.push({
            title: title,
            level: level,
            type: type,
            position: position,
            lineNumber: index + 1,
            fileName: fileName,
            filePath: fileUri.fsPath,
            folderPath: normalizedFolderPath,
          });
        }
      });
    } catch (error) {
      console.error('Error scanning file:', fileUri.fsPath, error);
    }
  }

  getAllStructure(): StructureInfo[] {
    return this.structure;
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
      const files = await vscode.workspace.findFiles('Book/Chapter-*.md', '**/node_modules/**');
      const chapterNumbers = files
        .map((file) => {
          const match = path.basename(file.fsPath).match(/Chapter-(\d+)\.md/i);
          return match ? parseInt(match[1]) : 0;
        })
        .filter((num) => num > 0);

      const nextChapterNumber = chapterNumbers.length > 0 ? Math.max(...chapterNumbers) + 1 : 1;
      const chapterFileName = `Chapter-${nextChapterNumber.toString().padStart(2, '0')}.md`;
      const chapterPath = path.join(bookDir, chapterFileName);

      // Ask user for chapter title
      const chapterTitle = await vscode.window.showInputBox({
        prompt: 'Enter chapter title',
        placeHolder: `Chapter ${nextChapterNumber}`,
        value: `Chapter ${nextChapterNumber}`,
      });

      if (!chapterTitle) {
        return;
      }

      // Create chapter content
      const chapterContent = `# ${chapterTitle}

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
