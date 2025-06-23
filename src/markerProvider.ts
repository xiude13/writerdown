import * as path from 'path';
import * as vscode from 'vscode';

export interface ChapterMetadata {
  chapter?: number;
  title?: string;
  act?: number;
  status?: 'draft' | 'review' | 'final' | 'published';
}

export interface MarkerInfo {
  text: string;
  category?: string;
  position: vscode.Position;
  fileName: string;
  filePath: string;
  chapterMetadata?: ChapterMetadata;
}

export interface MarkerReference {
  fileName: string;
  line: number;
  filePath: string;
  position: vscode.Position;
}

export class MarkerTreeItem extends vscode.TreeItem {
  constructor(
    public readonly markerInfo: MarkerInfo,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemType: 'marker' | 'chapter' | 'act' | 'category' = 'marker',
    public readonly parent?: MarkerTreeItem,
    public readonly referenceInfo?: MarkerReference,
  ) {
    super(markerInfo.text, collapsibleState);

    if (itemType === 'marker') {
      this.tooltip = `${markerInfo.text} (${markerInfo.fileName}:${markerInfo.position.line + 1})`;
      this.command = {
        command: 'writerdown.goToMarker',
        title: 'Go to Marker',
        arguments: [markerInfo],
      };

      // Set icon based on category
      if (markerInfo.category) {
        switch (markerInfo.category.toLowerCase()) {
          case 'plot':
            this.iconPath = new vscode.ThemeIcon('book');
            break;
          case 'character':
            this.iconPath = new vscode.ThemeIcon('person');
            break;
          case 'battle':
            this.iconPath = new vscode.ThemeIcon('flame');
            break;
          case 'romance':
            this.iconPath = new vscode.ThemeIcon('heart');
            break;
          case 'mystery':
            this.iconPath = new vscode.ThemeIcon('search');
            break;
          default:
            this.iconPath = new vscode.ThemeIcon('pin');
        }
      } else {
        this.iconPath = new vscode.ThemeIcon('pin');
      }
    } else if (itemType === 'chapter') {
      this.iconPath = new vscode.ThemeIcon('file-text');
      this.tooltip = `Chapter: ${markerInfo.text}`;
    } else if (itemType === 'act') {
      this.iconPath = new vscode.ThemeIcon('folder');
      this.tooltip = `Act: ${markerInfo.text}`;
    } else if (itemType === 'category') {
      this.iconPath = new vscode.ThemeIcon('tag');
      this.tooltip = `Category: ${markerInfo.text}`;
    }

    this.contextValue = itemType;
  }
}

export class MarkerProvider implements vscode.TreeDataProvider<MarkerTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<MarkerTreeItem | undefined | null | void> = new vscode.EventEmitter<
    MarkerTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData: vscode.Event<MarkerTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private markers: Map<string, MarkerInfo[]> = new Map();
  private chapters: Map<string, ChapterMetadata> = new Map();
  private searchFilter: string = '';
  private treeView?: vscode.TreeView<MarkerTreeItem>;

  constructor() {
    this.refresh();
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

  setTreeView(treeView: vscode.TreeView<MarkerTreeItem>) {
    this.treeView = treeView;
  }

  searchMarkers(): void {
    vscode.window
      .showInputBox({
        prompt: 'Search Story Markers',
        placeHolder: 'Enter search terms...',
        value: this.searchFilter,
      })
      .then((searchTerm) => {
        if (searchTerm !== undefined) {
          this.searchFilter = searchTerm.toLowerCase();
          this.refresh();
        }
      });
  }

  clearSearch(): void {
    this.searchFilter = '';
    this.refresh();
  }

  private markerMatchesSearch(marker: MarkerInfo): boolean {
    if (!this.searchFilter) return true;

    const searchTerms = this.searchFilter.toLowerCase();
    return (
      marker.text.toLowerCase().includes(searchTerms) ||
      (marker.category && marker.category.toLowerCase().includes(searchTerms)) ||
      marker.fileName.toLowerCase().includes(searchTerms)
    );
  }

  async refresh(): Promise<void> {
    this.markers.clear();
    this.chapters.clear();
    await this.scanForMarkers();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: MarkerTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: MarkerTreeItem): Thenable<MarkerTreeItem[]> {
    if (!element) {
      // Root level - show categories
      return this.getMarkersByCategory();
    } else if (element.itemType === 'category') {
      // Show chapters within this category
      return this.getChaptersInCategory(element);
    } else if (element.itemType === 'chapter') {
      // Show markers within this chapter
      return this.getMarkersInChapter(element);
    } else {
      return Promise.resolve([]);
    }
  }

  private async scanForMarkers(): Promise<void> {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      return;
    }

    // Check if this is a WriterDown project
    if (!(await this.isWriterDownProject())) {
      console.log('Not a WriterDown project, skipping marker scanning');
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];

    // Find all markdown files in the workspace
    const pattern = new vscode.RelativePattern(workspaceFolder, '**/*.md');
    const files = await vscode.workspace.findFiles(pattern);

    for (const file of files) {
      // Skip character cards
      if (file.fsPath.includes('.characters')) {
        continue;
      }

      await this.scanFile(file);
    }
  }

  private async scanFile(fileUri: vscode.Uri): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(fileUri);
      const text = document.getText();
      const fileName = path.basename(fileUri.fsPath);

      // Parse chapter metadata from frontmatter
      const chapterMetadata = this.parseChapterMetadata(text);
      if (chapterMetadata) {
        this.chapters.set(fileUri.fsPath, chapterMetadata);
      }

      // Find markers in the file
      const fileMarkers: MarkerInfo[] = [];

      // Regex to find #! markers with optional categories
      const markerRegex = /^#!\s*(?:\[([^\]]+)\])?\s*(.+)$/gm;
      let match;

      while ((match = markerRegex.exec(text)) !== null) {
        const category = match[1];
        const markerText = match[2].trim();
        const position = document.positionAt(match.index);

        // Skip EVENT markers since they're now handled by the Story Structure panel
        if (category && category.toLowerCase() === 'event') {
          continue;
        }

        const markerInfo: MarkerInfo = {
          text: markerText,
          category: category,
          position: position,
          fileName: fileName,
          filePath: fileUri.fsPath,
          chapterMetadata: chapterMetadata,
        };

        fileMarkers.push(markerInfo);
      }

      if (fileMarkers.length > 0) {
        this.markers.set(fileUri.fsPath, fileMarkers);
      }
    } catch (error) {
      console.error('Error scanning file for markers:', fileUri.fsPath, error);
    }
  }

  private parseChapterMetadata(content: string): ChapterMetadata | undefined {
    const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!yamlMatch) {
      return undefined;
    }

    const yamlContent = yamlMatch[1];
    const metadata: ChapterMetadata = {};

    // Simple YAML parser for our specific fields
    const lines = yamlContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;

      const key = trimmed.substring(0, colonIndex).trim();
      const value = trimmed
        .substring(colonIndex + 1)
        .trim()
        .replace(/["']/g, '');

      switch (key) {
        case 'chapter':
          const chapterNum = parseInt(value);
          if (!isNaN(chapterNum)) metadata.chapter = chapterNum;
          break;
        case 'title':
          if (value) metadata.title = value;
          break;
        case 'act':
          const actNum = parseInt(value);
          if (!isNaN(actNum)) metadata.act = actNum;
          break;
        case 'status':
          if (value && ['draft', 'review', 'final', 'published'].includes(value)) {
            metadata.status = value as 'draft' | 'review' | 'final' | 'published';
          }
          break;
      }
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }

  private async getMarkersByCategory(): Promise<MarkerTreeItem[]> {
    const result: MarkerTreeItem[] = [];

    // Get all unique categories, filtering by search if needed
    const categories = new Set<string>();
    for (const markersInFile of this.markers.values()) {
      for (const marker of markersInFile) {
        // If search filter is active, check if marker matches
        if (this.searchFilter && !this.markerMatchesSearch(marker)) {
          continue;
        }
        categories.add(marker.category || 'Notes');
      }
    }

    // Sort categories alphabetically, but put "Notes" (uncategorized) first
    const sortedCategories = Array.from(categories).sort((a, b) => {
      if (a === 'Notes') return -1;
      if (b === 'Notes') return 1;
      return a.localeCompare(b);
    });

    // Create category tree items
    for (const categoryName of sortedCategories) {
      const categoryItem = new MarkerTreeItem(
        {
          text: this.searchFilter ? `${categoryName} (filtered)` : categoryName,
          position: new vscode.Position(0, 0),
          fileName: '',
          filePath: '',
        },
        vscode.TreeItemCollapsibleState.Expanded,
        'category',
      );

      result.push(categoryItem);
    }

    return result;
  }

  private async getChaptersInCategory(categoryItem: MarkerTreeItem): Promise<MarkerTreeItem[]> {
    // Extract original category name (remove " (filtered)" suffix if present)
    const categoryName = categoryItem.markerInfo.text.replace(' (filtered)', '');
    const result: MarkerTreeItem[] = [];

    // Group markers in this category by chapter
    const chapterMap = new Map<string, { metadata: ChapterMetadata; markers: MarkerInfo[] }>();

    for (const [filePath, markersInFile] of this.markers.entries()) {
      const chapterMetadata = this.chapters.get(filePath);

      // Filter markers for this category and search filter
      const categoryMarkers = markersInFile.filter((marker) => {
        const markerCategory = marker.category || 'Notes';
        return markerCategory === categoryName && this.markerMatchesSearch(marker);
      });

      if (categoryMarkers.length > 0) {
        const chapterKey = chapterMetadata?.chapter?.toString() || 'unknown';

        if (!chapterMap.has(chapterKey)) {
          chapterMap.set(chapterKey, {
            metadata: chapterMetadata || {},
            markers: [],
          });
        }

        chapterMap.get(chapterKey)!.markers.push(...categoryMarkers);
      }
    }

    // Sort chapters by chapter number
    const sortedChapterKeys = Array.from(chapterMap.keys()).sort((a, b) => {
      if (a === 'unknown') return 1;
      if (b === 'unknown') return -1;
      return parseInt(a) - parseInt(b);
    });

    // Create chapter tree items for this category
    for (const chapterKey of sortedChapterKeys) {
      const chapterData = chapterMap.get(chapterKey)!;

      // Get chapter display name
      let chapterName: string;
      if (chapterKey === 'unknown') {
        chapterName = 'Unknown Chapters';
      } else {
        chapterName = this.getChapterDisplayName(chapterData.metadata, '');
      }

      const chapterItem = new MarkerTreeItem(
        {
          text: chapterName,
          position: new vscode.Position(0, 0),
          fileName: '',
          filePath: '',
          chapterMetadata: chapterData.metadata,
        },
        vscode.TreeItemCollapsibleState.Expanded,
        'chapter',
        categoryItem,
      );

      result.push(chapterItem);
    }

    return result;
  }

  private async getMarkersInChapter(chapterItem: MarkerTreeItem): Promise<MarkerTreeItem[]> {
    const chapterMetadata = chapterItem.markerInfo.chapterMetadata;
    // Extract original category name (remove " (filtered)" suffix if present)
    const categoryName = (chapterItem.parent?.markerInfo.text || 'Notes').replace(' (filtered)', '');
    const result: MarkerInfo[] = [];

    // Collect markers for this chapter and category from all files
    for (const [filePath, markersInFile] of this.markers.entries()) {
      const fileChapterMetadata = this.chapters.get(filePath);

      // Filter markers by category and search filter
      const categoryMarkers = markersInFile.filter((marker) => {
        const markerCategory = marker.category || 'Notes';
        return markerCategory === categoryName && this.markerMatchesSearch(marker);
      });

      // Then filter by chapter
      if (chapterItem.markerInfo.text === 'Unknown Chapters') {
        // Include markers from files without chapter metadata
        if (!fileChapterMetadata?.chapter) {
          result.push(...categoryMarkers);
        }
      } else if (fileChapterMetadata?.chapter === chapterMetadata?.chapter) {
        result.push(...categoryMarkers);
      }
    }

    // Sort markers by line number within the chapter
    result.sort((a, b) => a.position.line - b.position.line);

    return result.map((marker) => {
      return new MarkerTreeItem(
        {
          ...marker,
          text: marker.text,
        },
        vscode.TreeItemCollapsibleState.None,
        'marker',
        chapterItem,
      );
    });
  }

  private getChapterDisplayName(metadata: ChapterMetadata, filePath: string): string {
    let name = '';

    if (metadata.chapter !== undefined) {
      name += `Chapter ${metadata.chapter}`;
    }

    if (metadata.title) {
      name += name ? `: ${metadata.title}` : metadata.title;
    }

    if (!name) {
      name = path.basename(filePath, '.md');
    }

    if (metadata.status) {
      name += ` (${metadata.status})`;
    }

    return name;
  }

  async addMetadataToChapter(filePath: string): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
      const content = document.getText();

      // Check if already has metadata
      if (content.startsWith('---')) {
        return;
      }

      // Try to extract chapter number from filename or title
      const fileName = path.basename(filePath, '.md');
      const chapterMatch = fileName.match(/chapter\s*(\d+)|ch\s*(\d+)|(\d+)/i);
      const chapterNumber = chapterMatch ? parseInt(chapterMatch[1] || chapterMatch[2] || chapterMatch[3]) : undefined;

      // Create metadata
      const metadata = [
        '---',
        chapterNumber ? `chapter: ${chapterNumber}` : 'chapter: 1',
        `title: "${fileName}"`,
        'status: draft',
        '---',
        '',
        content,
      ].join('\n');

      // Write back to file
      await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), Buffer.from(metadata, 'utf8'));

      console.log(`Added metadata to ${fileName}`);
    } catch (error) {
      console.error('Error adding metadata to chapter:', error);
    }
  }

  async goToMarker(marker: MarkerInfo): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(marker.filePath));
      const editor = await vscode.window.showTextDocument(document);

      // Navigate to the marker position
      editor.selection = new vscode.Selection(marker.position, marker.position);
      editor.revealRange(new vscode.Range(marker.position, marker.position));
    } catch (error) {
      console.error('Error opening marker:', error);
      vscode.window.showErrorMessage(`Failed to open marker: ${marker.text}`);
    }
  }
}
