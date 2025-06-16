import * as path from 'path';
import * as vscode from 'vscode';

export interface CharacterInfo {
  name: string;
  count: number;
  positions: { position: vscode.Position; fileName: string; filePath: string }[];
  cardPath?: string;
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
    public readonly itemType: 'character' | 'section' | 'reference' | 'feature' = 'character',
    public readonly parent?: CharacterTreeItem,
    public readonly referenceInfo?: CharacterReference,
    public readonly featureInfo?: CharacterFeature,
  ) {
    super(characterInfo.name, collapsibleState);

    if (itemType === 'character') {
      this.tooltip = `${characterInfo.name} - ${characterInfo.count} mentions`;
      this.contextValue = 'character';
      this.iconPath = new vscode.ThemeIcon('person');
      this.description = `${characterInfo.count} mentions`;
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
    }
  }
}

export class CharacterProvider implements vscode.TreeDataProvider<CharacterTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<CharacterTreeItem | undefined | null | void> =
    new vscode.EventEmitter<CharacterTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<CharacterTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private characters: Map<string, CharacterInfo> = new Map();

  constructor() {
    // Don't auto-refresh in constructor
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
      // Root level - show all characters
      const characterItems = Array.from(this.characters.values())
        .sort((a, b) => b.count - a.count)
        .map((character) => new CharacterTreeItem(character, vscode.TreeItemCollapsibleState.Collapsed, 'character'));
      return Promise.resolve(characterItems);
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
      // Find all markdown files in the workspace, excluding character cards
      const files = await vscode.workspace.findFiles('**/*.md', '{**/node_modules/**,**/characters/**}');
      console.log(`Found ${files.length} markdown files for character scanning (excluding character cards)`);

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

      // Regex to find @CharacterName mentions
      const characterRegex = /@([A-Za-z0-9_]+)/g;
      let match;

      while ((match = characterRegex.exec(text)) !== null) {
        const characterName = match[1];
        const position = document.positionAt(match.index);

        if (this.characters.has(characterName)) {
          const existing = this.characters.get(characterName)!;
          existing.count++;
          existing.positions.push({
            position: position,
            fileName: fileName,
            filePath: fileUri.fsPath,
          });
        } else {
          this.characters.set(characterName, {
            name: characterName,
            count: 1,
            positions: [
              {
                position: position,
                fileName: fileName,
                filePath: fileUri.fsPath,
              },
            ],
          });
        }
      }
    } catch (error) {
      console.error('Error scanning file for characters:', fileUri.fsPath, error);
    }
  }

  private async createCharacterCards(): Promise<void> {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const charactersDir = path.join(workspaceFolder.uri.fsPath, 'characters');

    try {
      // Create characters directory if it doesn't exist
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

          cardFiles.set(characterName, fileName);
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
    const currentFileName = existingFiles.get(name);
    const shouldBeActive = character.count > 0;
    const expectedFileName = shouldBeActive ? `${name}.md` : `_${name}.md`;

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

    return `# ${character.name}
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
    return `# ${name}
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
        if (!/^[A-Za-z0-9_]+$/.test(value)) {
          return 'Character name can only contain letters, numbers, and underscores';
        }
        return null;
      },
    });

    if (!characterName) {
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const charactersDir = path.join(workspaceFolder.uri.fsPath, 'characters');

    try {
      // Create characters directory if it doesn't exist
      const charactersDirUri = vscode.Uri.file(charactersDir);
      try {
        await vscode.workspace.fs.stat(charactersDirUri);
      } catch {
        await vscode.workspace.fs.createDirectory(charactersDirUri);
        console.log('Created characters directory');
      }

      // Create character card
      const cardFileName = `${characterName}.md`;
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
      vscode.window.showErrorMessage(`Character card for ${character.name} not found`);
      return;
    }

    try {
      const cardUri = vscode.Uri.file(character.cardPath);
      const document = await vscode.workspace.openTextDocument(cardUri);
      await vscode.window.showTextDocument(document);

      // Set language to WriterDown
      await vscode.languages.setTextDocumentLanguage(document, 'writerdown');
    } catch (error) {
      console.error('Error opening character card:', error);
      vscode.window.showErrorMessage(`Failed to open character card for ${character.name}`);
    }
  }

  getCharacterInfo(name: string): CharacterInfo | undefined {
    return this.characters.get(name);
  }

  getAllCharacters(): CharacterInfo[] {
    return Array.from(this.characters.values()).sort((a, b) => b.count - a.count);
  }
}
