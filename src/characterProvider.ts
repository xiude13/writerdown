import * as path from 'path';
import * as vscode from 'vscode';

export interface CharacterMetadata {
  category?: string;
  role?: string;
  importance?: 'major' | 'minor' | 'supporting';
  faction?: string;
  location?: string;
  status?: 'active' | 'inactive' | 'deceased';
  tags?: string[];
}

export interface CharacterInfo {
  name: string;
  count: number;
  positions: { position: vscode.Position; fileName: string; filePath: string }[];
  cardPath?: string;
  metadata?: CharacterMetadata;
}

export interface CharacterFeature {
  label: string;
  value: string;
}

export interface CharacterReference {
  fileName: string;
  line: number;
  filePath: string;
  position: vscode.Position;
}

export class CharacterTreeItem extends vscode.TreeItem {
  constructor(
    public readonly characterInfo: CharacterInfo,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemType: 'character' | 'section' | 'reference' | 'feature' | 'category' = 'character',
    public readonly parent?: CharacterTreeItem,
    public readonly referenceInfo?: CharacterReference,
    public readonly featureInfo?: CharacterFeature,
  ) {
    super(characterInfo.name, collapsibleState);

    if (itemType === 'character') {
      this.tooltip = `${characterInfo.name} - ${characterInfo.count} mentions\nDouble-click to open character card\nRight-click for options`;

      // Set different contextValue based on whether character has a category
      const hasCategory = characterInfo.metadata?.category && characterInfo.metadata.category !== 'Uncategorized';
      this.contextValue = hasCategory ? 'characterWithCategory' : 'characterWithoutCategory';

      this.iconPath = new vscode.ThemeIcon('person');
      this.description = `${characterInfo.count} mentions`;
      this.command = {
        command: 'writerdown.openCharacterCard',
        title: 'Open Character Card',
        arguments: [characterInfo],
      };
    } else if (itemType === 'section') {
      this.label = characterInfo.name; // This will be "References" or "Features"
      this.tooltip = characterInfo.name;
      this.contextValue = 'section';
      this.iconPath = new vscode.ThemeIcon(characterInfo.name === 'References' ? 'references' : 'info');
    } else if (itemType === 'reference') {
      this.label = `${referenceInfo!.fileName}:${referenceInfo!.line}`;
      this.tooltip = `${referenceInfo!.fileName} line ${referenceInfo!.line}`;
      this.contextValue = 'reference';
      this.iconPath = new vscode.ThemeIcon('go-to-file');
      this.command = {
        command: 'writerdown.goToCharacterReference',
        title: 'Go to Reference',
        arguments: [referenceInfo],
      };
    } else if (itemType === 'feature') {
      this.label = `${featureInfo!.label}: ${featureInfo!.value}`;
      this.tooltip = `${featureInfo!.label}: ${featureInfo!.value}`;
      this.contextValue = 'feature';
      this.iconPath = new vscode.ThemeIcon('tag');
    } else if (itemType === 'category') {
      this.label = characterInfo.name;
      this.tooltip = characterInfo.name;
      this.contextValue = 'category';
      this.iconPath = new vscode.ThemeIcon('folder');
    }
  }
}

export class CharacterProvider implements vscode.TreeDataProvider<CharacterTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<CharacterTreeItem | undefined | null | void> =
    new vscode.EventEmitter<CharacterTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<CharacterTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private characters: Map<string, CharacterInfo> = new Map();
  private searchFilter: string = '';
  private treeView?: vscode.TreeView<CharacterTreeItem>;

  constructor() {
    // Don't auto-refresh in constructor
  }

  setTreeView(treeView: vscode.TreeView<CharacterTreeItem>) {
    this.treeView = treeView;
  }

  searchCharacters(): void {
    vscode.window
      .showInputBox({
        prompt: 'Search Characters',
        placeHolder: 'Enter character name or category...',
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

  private characterMatchesSearch(character: CharacterInfo): boolean {
    if (!this.searchFilter) return true;

    const searchTerms = this.searchFilter.toLowerCase();
    return (
      character.name.toLowerCase().includes(searchTerms) ||
      (character.metadata?.category && character.metadata.category.toLowerCase().includes(searchTerms)) ||
      false
    );
  }

  async refresh(): Promise<void> {
    await this.scanForCharacters();
    await this.createCharacterCards();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CharacterTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: CharacterTreeItem): Thenable<CharacterTreeItem[]> {
    if (!element) {
      // Root level - show categories or all characters
      return this.getCharactersByCategory();
    } else if (element.itemType === 'category') {
      // Category level - show characters in this category
      const categoryName = element.characterInfo.name;
      const charactersInCategory = Array.from(this.characters.values())
        .filter((character) => {
          const category = character.metadata?.category || 'Uncategorized';
          return category === categoryName && this.characterMatchesSearch(character);
        })
        .sort((a, b) => b.count - a.count)
        .map((character) => new CharacterTreeItem(character, vscode.TreeItemCollapsibleState.Collapsed, 'character'));

      return Promise.resolve(charactersInCategory);
    } else if (element.itemType === 'character') {
      // Character level - show References and Features sections
      const sections: CharacterTreeItem[] = [];

      // References section
      const referencesSection = new CharacterTreeItem(
        {
          name: 'References',
          count: element.characterInfo.count,
          positions: element.characterInfo.positions,
          cardPath: element.characterInfo.cardPath,
        },
        vscode.TreeItemCollapsibleState.Collapsed,
        'section',
      );
      sections.push(referencesSection);

      // Features section
      const featuresSection = new CharacterTreeItem(
        { name: 'Features', count: 0, positions: [], cardPath: element.characterInfo.cardPath },
        vscode.TreeItemCollapsibleState.Collapsed,
        'section',
        element,
      );
      sections.push(featuresSection);

      return Promise.resolve(sections);
    } else if (element.itemType === 'section') {
      if (element.characterInfo.name === 'References') {
        // References section - show all references
        const references = element.characterInfo.positions.map((pos) => {
          const referenceInfo: CharacterReference = {
            fileName: pos.fileName,
            line: pos.position.line + 1,
            filePath: pos.filePath,
            position: pos.position,
          };
          return new CharacterTreeItem(
            element.characterInfo,
            vscode.TreeItemCollapsibleState.None,
            'reference',
            element,
            referenceInfo,
          );
        });
        return Promise.resolve(references);
      } else if (element.characterInfo.name === 'Features') {
        // Features section - extract features from character card
        return this.extractCharacterFeatures(element);
      }
    }

    return Promise.resolve([]);
  }

  private async extractCharacterFeatures(element: CharacterTreeItem): Promise<CharacterTreeItem[]> {
    const parentCharacter = element.parent;
    if (!parentCharacter || !parentCharacter.characterInfo.cardPath) {
      return [];
    }

    try {
      const cardUri = vscode.Uri.file(parentCharacter.characterInfo.cardPath);
      const cardContent = Buffer.from(await vscode.workspace.fs.readFile(cardUri)).toString('utf8');

      const features = this.parseCharacterFeatures(cardContent);

      return features.map(
        (feature) =>
          new CharacterTreeItem(
            element.characterInfo,
            vscode.TreeItemCollapsibleState.None,
            'feature',
            element,
            undefined,
            feature,
          ),
      );
    } catch (error) {
      console.error('Error reading character card for features:', error);
      return [];
    }
  }

  private parseCharacterFeatures(cardContent: string): CharacterFeature[] {
    const features: CharacterFeature[] = [];
    const lines = cardContent.split('\n');

    // Extract age and location from the second line
    if (lines.length > 1) {
      const ageLocationLine = lines[1].trim();
      if (ageLocationLine && !ageLocationLine.startsWith('#')) {
        features.push({ label: 'Age & Location', value: ageLocationLine });
      }
    }

    // Extract content from main sections
    let currentSection = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      if (line.startsWith('## ')) {
        // Save previous section if it had content
        if (currentSection && currentContent.length > 0) {
          const content = currentContent.join(' ').trim();
          if (content) {
            features.push({ label: currentSection, value: content });
          }
        }

        // Start new section
        currentSection = line.replace('## ', '');
        currentContent = [];
      } else if (currentSection && line.trim() && !line.startsWith('#') && !line.startsWith('---')) {
        // Add content to current section (skip empty lines, headers, and separators)
        currentContent.push(line.trim());
      }
    }

    // Save last section
    if (currentSection && currentContent.length > 0) {
      const content = currentContent.join(' ').trim();
      if (content) {
        features.push({ label: currentSection, value: content });
      }
    }

    // Limit feature text length for tree display
    return features.map((feature) => ({
      label: feature.label,
      value: feature.value.length > 100 ? feature.value.substring(0, 100) + '...' : feature.value,
    }));
  }

  private async scanForCharacters(): Promise<void> {
    this.characters.clear(); // Clear existing data

    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      console.log('No workspace folders found');
      return;
    }

    try {
      // Find markdown files only in the Book folder, excluding character cards
      const files = await vscode.workspace.findFiles('Book/**/*.md', '**/node_modules/**');
      console.log(`Found ${files.length} markdown files in Book/ folder for character scanning`);

      for (const file of files) {
        await this.scanFile(file);
      }

      console.log(`Found ${this.characters.size} unique characters`);

      // Create character cards after scanning
      await this.createCharacterCards();
    } catch (error) {
      console.error('Error scanning for characters:', error);
    }
  }

  private async scanFile(fileUri: vscode.Uri): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(fileUri);
      const text = document.getText();
      const fileName = path.basename(fileUri.fsPath);

      // Regex to find @CharacterName and @[Multi Word Name] mentions
      const singleWordRegex = /@([A-Za-z0-9_]+)/g;
      const bracketedRegex = /@\[([^\]]+)\]/g;

      // Scan for single word character names (@CharacterName)
      let match;
      while ((match = singleWordRegex.exec(text)) !== null) {
        const characterName = match[1];
        const position = document.positionAt(match.index);
        this.addCharacterMention(characterName, position, fileName, fileUri.fsPath);
      }

      // Scan for bracketed character names (@[Multi Word Name])
      while ((match = bracketedRegex.exec(text)) !== null) {
        const characterName = match[1];
        const position = document.positionAt(match.index);
        this.addCharacterMention(characterName, position, fileName, fileUri.fsPath);
      }
    } catch (error) {
      console.error('Error scanning file for characters:', fileUri.fsPath, error);
    }
  }

  private addCharacterMention(
    characterName: string,
    position: vscode.Position,
    fileName: string,
    filePath: string,
  ): void {
    if (this.characters.has(characterName)) {
      const existing = this.characters.get(characterName)!;
      existing.count++;
      existing.positions.push({
        position: position,
        fileName: fileName,
        filePath: filePath,
      });
    } else {
      this.characters.set(characterName, {
        name: characterName,
        count: 1,
        positions: [
          {
            position: position,
            fileName: fileName,
            filePath: filePath,
          },
        ],
      });
    }
  }

  private async createCharacterCards(): Promise<void> {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const charactersDir = path.join(workspaceFolder.uri.fsPath, '.characters');

    try {
      // Create .characters directory if it doesn't exist
      const charactersDirUri = vscode.Uri.file(charactersDir);
      try {
        await vscode.workspace.fs.stat(charactersDirUri);
      } catch {
        await vscode.workspace.fs.createDirectory(charactersDirUri);
        console.log('Created characters directory');
      }

      // Get all existing character card files
      const existingCardFiles = await this.getExistingCharacterCards(charactersDir);

      // Create or update character cards for each character
      for (const [name, character] of this.characters) {
        await this.createOrUpdateCharacterCard(charactersDir, name, character, existingCardFiles);
      }

      // Handle characters that are no longer mentioned (rename with underscore)
      await this.handleUnreferencedCharacters(charactersDir, existingCardFiles);
    } catch (error) {
      console.error('Error creating character cards:', error);
    }
  }

  private async getExistingCharacterCards(charactersDir: string): Promise<Map<string, string>> {
    const cardFiles = new Map<string, string>();

    try {
      const dirUri = vscode.Uri.file(charactersDir);
      const files = await vscode.workspace.fs.readDirectory(dirUri);

      for (const [fileName, fileType] of files) {
        if (fileType === vscode.FileType.File && fileName.endsWith('.md')) {
          let characterName = fileName.replace('.md', '');
          let isUnreferenced = false;

          // Check if it's an unreferenced character file (starts with underscore)
          if (characterName.startsWith('_')) {
            characterName = characterName.substring(1);
            isUnreferenced = true;
          }

          // Convert underscores back to spaces for character names
          const displayName = characterName.replace(/_+/g, ' ');

          cardFiles.set(displayName, fileName);
        }
      }
    } catch (error) {
      console.error('Error reading characters directory:', error);
    }

    return cardFiles;
  }

  private async createOrUpdateCharacterCard(
    charactersDir: string,
    name: string,
    character: CharacterInfo,
    existingFiles: Map<string, string>,
  ): Promise<void> {
    const sanitizedName = name.replace(/\s+/g, '_');
    const currentFileName = existingFiles.get(name);
    const shouldBeActive = character.count > 0;
    const expectedFileName = shouldBeActive ? `${sanitizedName}.md` : `_${sanitizedName}.md`;

    if (currentFileName && currentFileName !== expectedFileName) {
      // Need to rename the file
      await this.renameCharacterCard(charactersDir, currentFileName, expectedFileName);
    }

    const cardFileName = expectedFileName;
    const cardPath = path.join(charactersDir, cardFileName);
    const cardUri = vscode.Uri.file(cardPath);

    try {
      await vscode.workspace.fs.stat(cardUri);
      // File exists, update it with new references
      await this.updateCharacterCard(cardUri, character);
      character.cardPath = cardPath;
    } catch {
      // File doesn't exist, create it
      const cardContent = this.createCharacterCardTemplate(character);
      await vscode.workspace.fs.writeFile(cardUri, Buffer.from(cardContent, 'utf8'));
      character.cardPath = cardPath;
      console.log(`Created character card for ${name}: ${cardFileName}`);
    }
  }

  private async handleUnreferencedCharacters(charactersDir: string, existingFiles: Map<string, string>): Promise<void> {
    // Find characters that exist as files but are no longer mentioned
    for (const [characterName, fileName] of existingFiles) {
      if (!this.characters.has(characterName)) {
        // Character is no longer mentioned, ensure it has underscore prefix
        if (!fileName.startsWith('_')) {
          const newFileName = `_${fileName}`;
          await this.renameCharacterCard(charactersDir, fileName, newFileName);
          console.log(`Renamed ${fileName} to ${newFileName} (character no longer referenced)`);
        }
      }
    }
  }

  private async renameCharacterCard(charactersDir: string, oldFileName: string, newFileName: string): Promise<void> {
    try {
      const oldPath = path.join(charactersDir, oldFileName);
      const newPath = path.join(charactersDir, newFileName);
      const oldUri = vscode.Uri.file(oldPath);
      const newUri = vscode.Uri.file(newPath);

      // Read the old file content
      const content = await vscode.workspace.fs.readFile(oldUri);

      // Write to new location
      await vscode.workspace.fs.writeFile(newUri, content);

      // Delete old file
      await vscode.workspace.fs.delete(oldUri);

      console.log(`Renamed character card: ${oldFileName} → ${newFileName}`);
    } catch (error) {
      console.error(`Error renaming character card from ${oldFileName} to ${newFileName}:`, error);
    }
  }

  private async updateCharacterCard(cardUri: vscode.Uri, character: CharacterInfo): Promise<void> {
    try {
      // Read existing card content
      const existingContent = Buffer.from(await vscode.workspace.fs.readFile(cardUri)).toString('utf8');

      // Generate new story references section
      const mentionsList = character.positions
        .slice(0, 5) // Show first 5 mentions
        .map((pos) => `- ${pos.fileName}:${pos.position.line + 1}`)
        .join('\n');

      const moreReferences = character.count > 5 ? `\n\n*And ${character.count - 5} more mentions...*` : '';
      const newReferencesSection = `## Story References

${mentionsList}${moreReferences}`;

      // Update the story references section while preserving other content
      const updatedContent = this.replaceStoryReferencesSection(existingContent, newReferencesSection, character);

      // Write updated content back to file
      await vscode.workspace.fs.writeFile(cardUri, Buffer.from(updatedContent, 'utf8'));
      console.log(`Updated character card for ${character.name} with ${character.count} mentions`);
    } catch (error) {
      console.error(`Error updating character card for ${character.name}:`, error);
    }
  }

  private replaceStoryReferencesSection(
    content: string,
    newReferencesSection: string,
    character: CharacterInfo,
  ): string {
    // Pattern to match the Story References section
    const storyReferencesPattern = /## Story References[\s\S]*?(?=## |$)/;

    if (storyReferencesPattern.test(content)) {
      // Replace existing Story References section
      return content.replace(storyReferencesPattern, newReferencesSection + '\n\n');
    } else {
      // Add Story References section before the final metadata section
      const metadataPattern = /---\s*\*Total Mentions:.*$/m;

      if (metadataPattern.test(content)) {
        return content.replace(metadataPattern, `${newReferencesSection}\n\n$&`);
      } else {
        // If no metadata section, add before the last "---" or at the end
        const lastSeparatorPattern = /---\s*$/;
        if (lastSeparatorPattern.test(content)) {
          return content.replace(lastSeparatorPattern, `${newReferencesSection}\n\n---`);
        } else {
          // Add at the end
          return (
            content +
            `\n\n${newReferencesSection}\n\n---\n\n*Total Mentions: ${character.count} across ${
              new Set(character.positions.map((p) => p.fileName)).size
            } files*\n*Character card updated by WriterDown • ${new Date().toLocaleDateString()}*\n`
          );
        }
      }
    }
  }

  private createCharacterCardTemplate(character: CharacterInfo): string {
    const mentionsList = character.positions
      .slice(0, 5) // Show first 5 mentions
      .map((pos) => `- ${pos.fileName}:${pos.position.line + 1}`)
      .join('\n');

    const moreReferences = character.count > 5 ? `\n\n*And ${character.count - 5} more mentions...*` : '';

    return `---
name: ${character.name}
category: 
role: 
importance: 
faction: 
location: 
status: active
tags: []
---

# ${character.name}
Age: • Location: 

## Role in Story


## Goal


## Physical Description
Hair: 
Eyes: 
Body Type: 
Height: 
Skin: 
Distinguishing Features: 
Style/Clothing: 

## Personality
Core Traits: 
Strengths: 
Weaknesses: 
Fears: 
Desires: 
Mannerisms: 
Speech Pattern: 

## Background
Occupation: 
Education: 
Family: 
Childhood: 
Key Life Events: 

## Relationships
Family Members: 
Friends: 
Enemies: 
Romantic Interest: 
Allies: 

## Character Arc
Starting Point: 
Character Growth: 
Internal Conflict: 
External Conflict: 
Resolution: 

## Story References

${mentionsList}${moreReferences}

## Notes


---

*Total Mentions: ${character.count} across ${new Set(character.positions.map((p) => p.fileName)).size} files*
*Character card generated by WriterDown • ${new Date().toLocaleDateString()}*
`;
  }

  private createNewCharacterTemplate(name: string): string {
    return `---
name: ${name}
category: 
role: 
importance: 
faction: 
location: 
status: active
tags: []
---

# ${name}
Age: • Location: 

## Role in Story


## Goal


## Physical Description
Hair: 
Eyes: 
Body Type: 
Height: 
Skin: 
Distinguishing Features: 
Style/Clothing: 

## Personality
Core Traits: 
Strengths: 
Weaknesses: 
Fears: 
Desires: 
Mannerisms: 
Speech Pattern: 

## Background
Occupation: 
Education: 
Family: 
Childhood: 
Key Life Events: 

## Relationships
Family Members: 
Friends: 
Enemies: 
Romantic Interest: 
Allies: 

## Character Arc
Starting Point: 
Character Growth: 
Internal Conflict: 
External Conflict: 
Resolution: 

## Notes


---

*Character card created by WriterDown • ${new Date().toLocaleDateString()}*
`;
  }

  async createNewCharacter(): Promise<void> {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    // Ask user for character name
    const characterName = await vscode.window.showInputBox({
      prompt: 'Enter character name',
      placeHolder: 'Character Name',
      validateInput: (value) => {
        if (!value || value.trim() === '') {
          return 'Character name cannot be empty';
        }
        // Allow spaces in character names (they'll be used with bracket notation if needed)
        if (!/^[A-Za-z0-9_\s]+$/.test(value)) {
          return 'Character name can only contain letters, numbers, underscores, and spaces';
        }
        return null;
      },
    });

    if (!characterName) {
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const charactersDir = path.join(workspaceFolder.uri.fsPath, '.characters');

    try {
      // Create .characters directory if it doesn't exist
      const charactersDirUri = vscode.Uri.file(charactersDir);
      try {
        await vscode.workspace.fs.stat(charactersDirUri);
      } catch {
        await vscode.workspace.fs.createDirectory(charactersDirUri);
        console.log('Created .characters directory');
      }

      // Create character card (sanitize filename for characters with spaces)
      const sanitizedName = characterName.replace(/\s+/g, '_');
      const cardFileName = `${sanitizedName}.md`;
      const cardPath = path.join(charactersDir, cardFileName);
      const cardUri = vscode.Uri.file(cardPath);

      // Check if character card already exists
      try {
        await vscode.workspace.fs.stat(cardUri);
        vscode.window.showWarningMessage(`Character card for ${characterName} already exists`);

        // Open existing card
        const document = await vscode.workspace.openTextDocument(cardUri);
        await vscode.window.showTextDocument(document);
        await vscode.languages.setTextDocumentLanguage(document, 'writerdown');
        return;
      } catch {
        // File doesn't exist, create it
        const cardContent = this.createNewCharacterTemplate(characterName);
        await vscode.workspace.fs.writeFile(cardUri, Buffer.from(cardContent, 'utf8'));

        // Open the new character card
        const document = await vscode.workspace.openTextDocument(cardUri);
        await vscode.window.showTextDocument(document);
        await vscode.languages.setTextDocumentLanguage(document, 'writerdown');

        // Add to characters map
        this.characters.set(characterName, {
          name: characterName,
          count: 0,
          positions: [],
          cardPath: cardPath,
        });

        this._onDidChangeTreeData.fire();

        vscode.window.showInformationMessage(`Created character card for ${characterName}`);
      }
    } catch (error) {
      console.error('Error creating new character:', error);
      vscode.window.showErrorMessage('Failed to create new character');
    }
  }

  async openCharacterCard(character: CharacterInfo): Promise<void> {
    if (!character.cardPath) {
      vscode.window.showErrorMessage(`No character card found for ${character.name}`);
      return;
    }

    try {
      const cardUri = vscode.Uri.file(character.cardPath);
      const document = await vscode.workspace.openTextDocument(cardUri);
      await vscode.window.showTextDocument(document);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open character card: ${error}`);
    }
  }

  async renameCharacter(character: CharacterInfo): Promise<void> {
    if (!character || !character.name) {
      vscode.window.showErrorMessage('Invalid character information provided');
      return;
    }

    const oldName = character.name;

    // Ask user for new name
    const newName = await vscode.window.showInputBox({
      prompt: `Rename character "${oldName}"`,
      value: oldName,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Character name cannot be empty';
        }
        if (value === oldName) {
          return 'New name must be different from current name';
        }
        // Check if character already exists
        if (this.characters.has(value.trim())) {
          return 'A character with this name already exists';
        }
        // Check for invalid characters that might cause issues
        if (value.includes('\n') || value.includes('\r')) {
          return 'Character name cannot contain line breaks';
        }
        return null;
      },
    });

    if (!newName || newName.trim() === oldName.trim()) {
      return;
    }

    const trimmedNewName = newName.trim();

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Renaming character "${oldName}" to "${trimmedNewName}"`,
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: 'Finding all references...' });

          // 1. Update all file references
          console.log(`Renaming character: "${oldName}" -> "${trimmedNewName}"`);
          await this.updateCharacterReferencesInFiles(oldName, trimmedNewName);

          progress.report({ message: 'Updating character card...' });

          // 2. Rename and update character card file
          await this.renameCharacterCardFile(oldName, trimmedNewName, character.cardPath);

          progress.report({ message: 'Refreshing data...' });

          // 3. Refresh the provider to pick up changes
          await this.refresh();
        },
      );

      vscode.window.showInformationMessage(`Successfully renamed character "${oldName}" to "${trimmedNewName}"`);
    } catch (error) {
      console.error('Character rename error:', error);
      vscode.window.showErrorMessage(`Failed to rename character: ${error}`);
    }
  }

  async changeCategoryCharacter(character: CharacterInfo): Promise<void> {
    if (!character || !character.name) {
      vscode.window.showErrorMessage('Invalid character information provided');
      return;
    }

    if (!character.cardPath) {
      vscode.window.showErrorMessage(`No character card found for ${character.name}`);
      return;
    }

    // Get all existing categories from current characters
    const existingCategories = new Set<string>();
    for (const char of this.characters.values()) {
      if (char.metadata?.category && char.metadata.category !== 'Uncategorized') {
        existingCategories.add(char.metadata.category);
      }
    }

    // Convert to sorted array
    const currentCategories = Array.from(existingCategories).sort();
    const currentCategory = character.metadata?.category || 'Uncategorized';

    // Build options with "Create New Category..." first, then existing categories
    const categoryOptions = [
      {
        label: '$(add) Create New Category...',
        description: 'Enter a custom category name',
      },
      ...currentCategories.map((cat) => ({
        label: cat,
        description: cat === currentCategory ? '(current)' : undefined,
      })),
    ];

    // Show category selection
    const selectedCategory = await vscode.window.showQuickPick(categoryOptions, {
      placeHolder: `Change category for ${character.name} (currently: ${currentCategory})`,
      ignoreFocusOut: true,
    });

    if (!selectedCategory) {
      return;
    }

    let newCategory: string;

    if (selectedCategory.label === '$(add) Create New Category...') {
      const customCategory = await vscode.window.showInputBox({
        prompt: `Enter new category for ${character.name}`,
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Category name cannot be empty';
          }
          return null;
        },
      });

      if (!customCategory) {
        return;
      }
      newCategory = customCategory.trim();
    } else {
      newCategory = selectedCategory.label;
    }

    if (newCategory === currentCategory) {
      return; // No change needed
    }

    try {
      await this.updateCharacterCategory(character, newCategory);
      await this.refresh();
      vscode.window.showInformationMessage(`Changed category for ${character.name} to "${newCategory}"`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to change category: ${error}`);
    }
  }

  async assignCategoryCharacter(character: CharacterInfo): Promise<void> {
    if (!character || !character.name) {
      vscode.window.showErrorMessage('Invalid character information provided');
      return;
    }

    if (!character.cardPath) {
      vscode.window.showErrorMessage(`No character card found for ${character.name}`);
      return;
    }

    // Get all existing categories from current characters
    const existingCategories = new Set<string>();
    for (const char of this.characters.values()) {
      if (char.metadata?.category && char.metadata.category !== 'Uncategorized') {
        existingCategories.add(char.metadata.category);
      }
    }

    // Convert to sorted array
    const currentCategories = Array.from(existingCategories).sort();

    // Build options with "Create New Category..." first, then existing categories
    const categoryOptions = [
      {
        label: '$(add) Create New Category...',
        description: 'Enter a custom category name',
      },
      ...currentCategories.map((cat) => ({ label: cat })),
    ];

    // Show category selection
    const selectedCategory = await vscode.window.showQuickPick(categoryOptions, {
      placeHolder: `Assign category to ${character.name}`,
      ignoreFocusOut: true,
    });

    if (!selectedCategory) {
      return;
    }

    let newCategory: string;

    if (selectedCategory.label === '$(add) Create New Category...') {
      const customCategory = await vscode.window.showInputBox({
        prompt: `Enter category for ${character.name}`,
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Category name cannot be empty';
          }
          return null;
        },
      });

      if (!customCategory) {
        return;
      }
      newCategory = customCategory.trim();
    } else {
      newCategory = selectedCategory.label;
    }

    try {
      await this.updateCharacterCategory(character, newCategory);
      await this.refresh();
      vscode.window.showInformationMessage(`Assigned category "${newCategory}" to ${character.name}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to assign category: ${error}`);
    }
  }

  private async updateCharacterCategory(character: CharacterInfo, newCategory: string): Promise<void> {
    if (!character.cardPath) {
      throw new Error('No character card path available');
    }

    try {
      // Read the current card content
      const cardUri = vscode.Uri.file(character.cardPath);
      const cardContent = Buffer.from(await vscode.workspace.fs.readFile(cardUri)).toString('utf8');

      if (!cardContent) {
        throw new Error('Character card content is empty');
      }

      // Update the category in YAML frontmatter
      const updatedContent = this.updateCharacterCardCategory(cardContent, character.name, newCategory);

      // Write the updated content back
      await vscode.workspace.fs.writeFile(cardUri, Buffer.from(updatedContent, 'utf8'));

      // Update the in-memory metadata
      if (!character.metadata) {
        character.metadata = {};
      }
      character.metadata.category = newCategory;
    } catch (error) {
      console.error(`Error updating character category:`, error);
      throw new Error(`Failed to update character category: ${error}`);
    }
  }

  private updateCharacterCardCategory(content: string, characterName: string, newCategory: string): string {
    if (!content) {
      return content;
    }

    // Check if content has YAML frontmatter
    const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (yamlMatch) {
      // Update existing YAML frontmatter
      const yamlContent = yamlMatch[1];
      let updatedYaml = yamlContent;

      // Check if category field exists
      if (/^category:\s*.+$/m.test(yamlContent)) {
        // Update existing category
        updatedYaml = yamlContent.replace(/^category:\s*.+$/m, `category: ${newCategory}`);
      } else {
        // Add category field to existing YAML
        updatedYaml = yamlContent + `\ncategory: ${newCategory}`;
      }

      return content.replace(/^---\n([\s\S]*?)\n---/, `---\n${updatedYaml}\n---`);
    } else {
      // No YAML frontmatter exists, create minimal one
      const minimalYaml = `---
name: ${characterName}
category: ${newCategory}
---

`;
      return minimalYaml + content;
    }
  }

  private async updateCharacterReferencesInFiles(oldName: string, newName: string): Promise<void> {
    if (!oldName || !newName) {
      throw new Error('Old name and new name are required');
    }

    // Get all markdown files in the workspace
    const files = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**');

    // Escape special regex characters for the old name
    const escapedOldName = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Create regex patterns for both single-word and bracketed formats
    const oldSingleWordPattern = new RegExp(`@${escapedOldName}\\b`, 'g');
    const oldBracketedPattern = new RegExp(`@\\[${escapedOldName}\\]`, 'g');

    // Determine new format based on whether the new name has spaces
    const newReference = newName.includes(' ') ? `@[${newName}]` : `@${newName}`;

    for (const file of files) {
      try {
        const document = await vscode.workspace.openTextDocument(file);
        const content = document.getText();

        if (!content) {
          continue; // Skip empty files
        }

        // Check if this file contains references to the old character
        const hasSingleWordRef = oldSingleWordPattern.test(content);
        const hasBracketedRef = oldBracketedPattern.test(content);

        if (hasSingleWordRef || hasBracketedRef) {
          // Reset regex lastIndex
          oldSingleWordPattern.lastIndex = 0;
          oldBracketedPattern.lastIndex = 0;

          let updatedContent = content;

          // Replace both patterns with the new reference format
          updatedContent = updatedContent.replace(oldSingleWordPattern, newReference);
          updatedContent = updatedContent.replace(oldBracketedPattern, newReference);

          // Apply the changes
          const edit = new vscode.WorkspaceEdit();
          const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(content.length));
          edit.replace(file, fullRange, updatedContent);
          await vscode.workspace.applyEdit(edit);

          // Save the document
          await document.save();
        }
      } catch (error) {
        console.error(`Error updating references in ${file.fsPath}:`, error);
        // Continue with other files even if one fails
      }
    }
  }

  private async renameCharacterCardFile(oldName: string, newName: string, cardPath?: string): Promise<void> {
    if (!cardPath) {
      console.log('No character card path provided, skipping card file rename');
      return;
    }

    if (!oldName || !newName) {
      throw new Error('Old name and new name are required for card file rename');
    }

    try {
      // Read the current card content
      const cardUri = vscode.Uri.file(cardPath);
      const cardContent = Buffer.from(await vscode.workspace.fs.readFile(cardUri)).toString('utf8');

      if (!cardContent) {
        console.warn('Character card content is empty, creating minimal content');
      }

      // Update the card content to reflect the new name
      const updatedContent = this.updateCharacterCardContent(cardContent, oldName, newName);

      // Create new filename (sanitize spaces to underscores)
      const cardDir = path.dirname(cardPath);
      const sanitizedNewName = newName.replace(/\s+/g, '_').replace(/[^\w\-_.]/g, '');
      const newFileName = `${sanitizedNewName}.md`;
      const newCardPath = path.join(cardDir, newFileName);

      // Write content to new file
      const newCardUri = vscode.Uri.file(newCardPath);
      await vscode.workspace.fs.writeFile(newCardUri, Buffer.from(updatedContent, 'utf8'));

      // Delete old file if it's different from new file
      if (cardPath !== newCardPath) {
        try {
          await vscode.workspace.fs.delete(cardUri);
        } catch (deleteError) {
          console.warn(`Could not delete old character card file: ${deleteError}`);
          // Don't throw here - the rename operation was successful
        }
      }
    } catch (error) {
      console.error(`Error renaming character card file:`, error);
      throw new Error(`Failed to rename character card file: ${error}`);
    }
  }

  private updateCharacterCardContent(content: string, oldName: string, newName: string): string {
    if (!content) {
      console.error('Character card content is undefined or empty');
      return content || '';
    }

    if (!oldName || !newName) {
      console.error('Old name or new name is undefined');
      return content;
    }

    let updatedContent = content;

    try {
      // Update YAML frontmatter name field
      updatedContent = updatedContent.replace(/^name:\s*.+$/m, `name: ${newName}`);

      // Escape special regex characters for the old name
      const escapedOldName = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Update the main heading
      updatedContent = updatedContent.replace(new RegExp(`^# ${escapedOldName}$`, 'm'), `# ${newName}`);

      // Update any character references within the card content
      const oldSingleWordPattern = new RegExp(`@${escapedOldName}\\b`, 'g');
      const oldBracketedPattern = new RegExp(`@\\[${escapedOldName}\\]`, 'g');
      const newReference = newName.includes(' ') ? `@[${newName}]` : `@${newName}`;

      updatedContent = updatedContent.replace(oldSingleWordPattern, newReference);
      updatedContent = updatedContent.replace(oldBracketedPattern, newReference);

      return updatedContent;
    } catch (error) {
      console.error('Error updating character card content:', error);
      return content;
    }
  }

  getCharacterInfo(name: string): CharacterInfo | undefined {
    return this.characters.get(name);
  }

  getAllCharacters(): CharacterInfo[] {
    return Array.from(this.characters.values()).sort((a, b) => b.count - a.count);
  }

  private async getCharactersByCategory(): Promise<CharacterTreeItem[]> {
    // Load metadata for all characters
    for (const [name, character] of this.characters.entries()) {
      if (character.cardPath && !character.metadata) {
        character.metadata = await this.loadCharacterMetadata(character.cardPath);
      }
    }

    // Group characters by category (apply search filter)
    const categories = new Map<string, CharacterInfo[]>();

    for (const character of this.characters.values()) {
      if (!this.characterMatchesSearch(character)) continue; // Apply search filter

      const category = character.metadata?.category || 'Uncategorized';
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(character);
    }

    // Create category tree items
    const categoryItems: CharacterTreeItem[] = [];

    for (const [categoryName, charactersInCategory] of categories.entries()) {
      const totalMentions = charactersInCategory.reduce((sum, char) => sum + char.count, 0);

      const categoryItem = new CharacterTreeItem(
        {
          name: categoryName,
          count: totalMentions,
          positions: [],
        },
        vscode.TreeItemCollapsibleState.Collapsed,
        'category',
      );

      categoryItems.push(categoryItem);
    }

    // Sort categories by total mentions
    categoryItems.sort((a, b) => b.characterInfo.count - a.characterInfo.count);

    return categoryItems;
  }

  private parseYamlFrontmatter(content: string): CharacterMetadata | undefined {
    const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!yamlMatch) {
      return undefined;
    }

    const yamlContent = yamlMatch[1];
    const metadata: CharacterMetadata = {};

    // Simple YAML parser for our specific fields
    const lines = yamlContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;

      const key = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();

      switch (key) {
        case 'category':
          if (value) metadata.category = value;
          break;
        case 'role':
          if (value) metadata.role = value;
          break;
        case 'importance':
          if (value && ['major', 'minor', 'supporting'].includes(value)) {
            metadata.importance = value as 'major' | 'minor' | 'supporting';
          }
          break;
        case 'faction':
          if (value) metadata.faction = value;
          break;
        case 'location':
          if (value) metadata.location = value;
          break;
        case 'status':
          if (value && ['active', 'inactive', 'deceased'].includes(value)) {
            metadata.status = value as 'active' | 'inactive' | 'deceased';
          }
          break;
        case 'tags':
          if (value && value.startsWith('[') && value.endsWith(']')) {
            const tagsStr = value.slice(1, -1);
            metadata.tags = tagsStr
              .split(',')
              .map((tag) => tag.trim())
              .filter((tag) => tag);
          }
          break;
      }
    }

    return metadata;
  }

  private async loadCharacterMetadata(cardPath: string): Promise<CharacterMetadata | undefined> {
    try {
      const cardUri = vscode.Uri.file(cardPath);
      const cardContent = Buffer.from(await vscode.workspace.fs.readFile(cardUri)).toString('utf8');
      return this.parseYamlFrontmatter(cardContent);
    } catch (error) {
      console.error('Error loading character metadata:', error);
      return undefined;
    }
  }
}
