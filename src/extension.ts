import * as vscode from 'vscode';
import { CharacterInfo, CharacterProvider } from './characterProvider';
import { StructureInfo, StructureProvider } from './structureProvider';
import { activateTests } from './test/basicTests';
import { TodoInfo, TodoProvider } from './todoProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('WriterDown extension is now active!');

  // Create providers
  const characterProvider = new CharacterProvider();
  const todoProvider = new TodoProvider();
  const structureProvider = new StructureProvider();

  // Activate test commands
  activateTests(context);

  // Create status bar items
  const wordCountStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
  wordCountStatusBarItem.command = 'writerdown.showWordCountDetails';
  wordCountStatusBarItem.tooltip = 'WriterDown Word Count - Click for details';
  context.subscriptions.push(wordCountStatusBarItem);

  const pageCountStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 9);
  pageCountStatusBarItem.command = 'writerdown.showPageCountDetails';
  pageCountStatusBarItem.tooltip = 'WriterDown Page Estimation - Click for details';
  context.subscriptions.push(pageCountStatusBarItem);

  // Word counting utilities
  const countWords = (text: string): { words: number; characters: number; charactersNoSpaces: number } => {
    // Remove WriterDown-specific syntax for counting
    let cleanText = text
      // Remove scene markers
      .replace(/\*\*\*\s*SCENE\s+\d+:.*?\*\*\*/gi, '')
      // Remove plot notes
      .replace(/\[PLOT:.*?\]/gi, '')
      // Remove character mentions (but keep the name)
      .replace(/@([A-Za-z0-9_]+)/g, '$1')
      // Remove general notes
      .replace(/\[\[.*?\]\]/g, '')
      // Remove writer tasks
      .replace(/\{\{(TODO|RESEARCH|EDIT):.*?\}\}/gi, '')
      // Remove Writer's Notes sections (everything from ### Writer's Notes to next ### or end)
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

    // Count characters
    const characters = text.length;
    const charactersNoSpaces = text.replace(/\s/g, '').length;

    return { words, characters, charactersNoSpaces };
  };

  const updateWordCount = () => {
    const activeEditor = vscode.window.activeTextEditor;

    if (!activeEditor) {
      wordCountStatusBarItem.hide();
      pageCountStatusBarItem.hide();
      return;
    }

    // Only show word count for WriterDown and Markdown files
    const isWriterDownFile =
      activeEditor.document.languageId === 'writerdown' ||
      (activeEditor.document.languageId === 'markdown' && activeEditor.document.fileName.endsWith('.md'));

    if (!isWriterDownFile) {
      wordCountStatusBarItem.hide();
      pageCountStatusBarItem.hide();
      return;
    }

    const { words, characters, charactersNoSpaces } = countWords(activeEditor.document.getText());

    // Calculate page estimation (250 words per page is standard for printed books)
    const wordsPerPage = 250;
    const estimatedPages = Math.ceil(words / wordsPerPage);
    const exactPages = (words / wordsPerPage).toFixed(1);

    // Show word count in status bar
    wordCountStatusBarItem.text = `$(book) ${words} words`;
    wordCountStatusBarItem.show();

    // Show page count in status bar
    pageCountStatusBarItem.text = `$(file-text) ${estimatedPages} pages`;
    pageCountStatusBarItem.show();

    // Store the counts for the detail commands
    (wordCountStatusBarItem as any).wordCountData = {
      words,
      characters,
      charactersNoSpaces,
      fileName: activeEditor.document.fileName.split('/').pop() || 'Unknown',
    };

    (pageCountStatusBarItem as any).pageCountData = {
      words,
      estimatedPages,
      exactPages,
      wordsPerPage,
      fileName: activeEditor.document.fileName.split('/').pop() || 'Unknown',
    };
  };

  // Register tree views
  const structureTreeView = vscode.window.createTreeView('writerdown-structure', {
    treeDataProvider: structureProvider,
    showCollapseAll: false,
  });

  const characterTreeView = vscode.window.createTreeView('writerdown-characters', {
    treeDataProvider: characterProvider,
    showCollapseAll: false,
  });

  const todoTreeView = vscode.window.createTreeView('writerdown-tasks', {
    treeDataProvider: todoProvider,
    showCollapseAll: false,
  });

  // Register command to set language to WriterDown
  const setLanguageCommand = vscode.commands.registerCommand('writerdown.setLanguage', async () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      await vscode.languages.setTextDocumentLanguage(activeEditor.document, 'writerdown');
      vscode.window.showInformationMessage('Language set to WriterDown');
      await refreshAllProviders();
    } else {
      vscode.window.showWarningMessage('No active editor found');
    }
  });

  // Helper function to refresh all providers
  const refreshAllProviders = async () => {
    console.log('Refreshing all providers...');
    try {
      await Promise.all([structureProvider.refresh(), characterProvider.refresh(), todoProvider.refresh()]);
      console.log('All providers refreshed successfully');
    } catch (error) {
      console.error('Error refreshing providers:', error);
    }
  };

  // Register structure commands
  const refreshStructureCommand = vscode.commands.registerCommand('writerdown.refreshStructure', async () => {
    await structureProvider.refresh();
    vscode.window.showInformationMessage('Structure refreshed');
  });

  const newChapterCommand = vscode.commands.registerCommand('writerdown.newChapter', async () => {
    await structureProvider.createNewChapter();
    await refreshAllProviders();
  });

  const goToStructureCommand = vscode.commands.registerCommand(
    'writerdown.goToStructure',
    async (structureInfo: StructureInfo) => {
      // Open the file first
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(structureInfo.filePath));
      const editor = await vscode.window.showTextDocument(document);

      // Then navigate to the position
      editor.selection = new vscode.Selection(structureInfo.position, structureInfo.position);
      editor.revealRange(new vscode.Range(structureInfo.position, structureInfo.position));
    },
  );

  // Register character commands
  const refreshCharactersCommand = vscode.commands.registerCommand('writerdown.refreshCharacters', async () => {
    await characterProvider.refresh();
    vscode.window.showInformationMessage('Characters refreshed');
  });

  const newCharacterCommand = vscode.commands.registerCommand('writerdown.newCharacter', async () => {
    await characterProvider.createNewCharacter();
  });

  const openCharacterCardCommand = vscode.commands.registerCommand(
    'writerdown.openCharacterCard',
    async (characterInfo: CharacterInfo) => {
      await characterProvider.openCharacterCard(characterInfo);
    },
  );

  const goToCharacterCommand = vscode.commands.registerCommand(
    'writerdown.goToCharacter',
    async (characterInfo: CharacterInfo) => {
      if (characterInfo.positions.length > 0) {
        const firstOccurrence = characterInfo.positions[0];
        // Open the file first
        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(firstOccurrence.filePath));
        const editor = await vscode.window.showTextDocument(document);

        // Then navigate to the position
        editor.selection = new vscode.Selection(firstOccurrence.position, firstOccurrence.position);
        editor.revealRange(new vscode.Range(firstOccurrence.position, firstOccurrence.position));
      }
    },
  );

  const goToCharacterReferenceCommand = vscode.commands.registerCommand(
    'writerdown.goToCharacterReference',
    async (referenceInfo: any) => {
      // Open the file first
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(referenceInfo.filePath));
      const editor = await vscode.window.showTextDocument(document);

      // Then navigate to the position
      editor.selection = new vscode.Selection(referenceInfo.position, referenceInfo.position);
      editor.revealRange(new vscode.Range(referenceInfo.position, referenceInfo.position));
    },
  );

  // Register TODO commands
  const refreshTasksCommand = vscode.commands.registerCommand('writerdown.refreshTasks', async () => {
    await todoProvider.refresh();
    vscode.window.showInformationMessage('Tasks refreshed');
  });

  const goToTaskCommand = vscode.commands.registerCommand('writerdown.goToTask', async (todoInfo: TodoInfo) => {
    // Open the file first
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(todoInfo.filePath));
    const editor = await vscode.window.showTextDocument(document);

    // Then navigate to the position
    editor.selection = new vscode.Selection(todoInfo.position, todoInfo.position);
    editor.revealRange(new vscode.Range(todoInfo.position, todoInfo.position));
  });

  // Refresh all providers command (for debugging)
  const refreshAllCommand = vscode.commands.registerCommand('writerdown.refreshAll', async () => {
    await refreshAllProviders();
    vscode.window.showInformationMessage('All providers refreshed');
  });

  // Register command to show word count details
  const showWordCountDetailsCommand = vscode.commands.registerCommand('writerdown.showWordCountDetails', () => {
    const data = (wordCountStatusBarItem as any).wordCountData;
    if (data) {
      vscode.window.showInformationMessage(
        `Word Count for ${data.fileName}:\n` +
          `Words: ${data.words}\n` +
          `Characters: ${data.characters}\n` +
          `Characters (no spaces): ${data.charactersNoSpaces}`,
        { modal: false },
      );
    }
  });

  // Register command to show page count details
  const showPageCountDetailsCommand = vscode.commands.registerCommand('writerdown.showPageCountDetails', () => {
    const data = (pageCountStatusBarItem as any).pageCountData;
    if (data) {
      vscode.window.showInformationMessage(
        `Page Estimation for ${data.fileName}:\n` +
          `Words: ${data.words}\n` +
          `Estimated pages: ${data.estimatedPages} (rounded up)\n` +
          `Exact pages: ${data.exactPages}\n` +
          `Based on ${data.wordsPerPage} words per page (standard book format)`,
        { modal: false },
      );
    }
  });

  context.subscriptions.push(
    setLanguageCommand,
    refreshStructureCommand,
    newChapterCommand,
    goToStructureCommand,
    refreshCharactersCommand,
    newCharacterCommand,
    openCharacterCardCommand,
    goToCharacterCommand,
    goToCharacterReferenceCommand,
    refreshTasksCommand,
    goToTaskCommand,
    refreshAllCommand,
    showWordCountDetailsCommand,
    showPageCountDetailsCommand,
    structureTreeView,
    characterTreeView,
    todoTreeView,
  );

  // Auto-detect .md files and suggest WriterDown language
  const onDidOpenTextDocument = vscode.workspace.onDidOpenTextDocument(async (document) => {
    if (document.fileName.endsWith('.md') && document.languageId === 'markdown') {
      const selection = await vscode.window.showInformationMessage(
        'This is a Markdown file. Would you like to use WriterDown syntax highlighting?',
        'Use WriterDown',
        'Keep Markdown',
      );

      if (selection === 'Use WriterDown') {
        await vscode.languages.setTextDocumentLanguage(document, 'writerdown');
        await refreshAllProviders();
      }
    }
  });

  // Don't refresh on editor changes - data should persist
  const onDidChangeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
    // Only refresh if we don't have data yet
    if (editor && editor.document.fileName.endsWith('.md')) {
      const hasData =
        structureProvider.getAllStructure().length > 0 ||
        characterProvider.getAllCharacters().length > 0 ||
        todoProvider.getAllTodos().length > 0;

      if (!hasData) {
        await refreshAllProviders();
      }
    }
  });

  // Refresh providers when document content changes
  let refreshTimeout: NodeJS.Timeout | undefined;
  const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument((event) => {
    if (event.document.fileName.endsWith('.md')) {
      // Clear existing timeout
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }

      // Debounce the refresh to avoid too many updates
      refreshTimeout = setTimeout(async () => {
        await refreshAllProviders();
      }, 1000);
    }
  });

  // Refresh providers when files are created, deleted, or renamed
  const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.md');
  fileWatcher.onDidCreate(async () => {
    await refreshAllProviders();
  });
  fileWatcher.onDidDelete(async () => {
    await refreshAllProviders();
  });

  context.subscriptions.push(onDidOpenTextDocument, onDidChangeActiveTextEditor, onDidChangeTextDocument, fileWatcher);

  // Initial refresh after a short delay to ensure workspace is ready
  setTimeout(async () => {
    console.log('Performing initial refresh...');
    await refreshAllProviders();
  }, 1000);

  // Register Definition Provider for character mentions
  const characterDefinitionProvider = new CharacterDefinitionProvider(characterProvider);
  const definitionProviderDisposable = vscode.languages.registerDefinitionProvider(
    'writerdown',
    characterDefinitionProvider,
  );

  context.subscriptions.push(definitionProviderDisposable);

  // Register Completion Provider for character names
  const characterCompletionProvider = new CharacterCompletionProvider(characterProvider);
  const completionProviderDisposable = vscode.languages.registerCompletionItemProvider(
    'writerdown',
    characterCompletionProvider,
    '@',
  );

  context.subscriptions.push(completionProviderDisposable);

  // Update word count on editor change and document change
  const updateWordCountOnChange = () => {
    updateWordCount();
  };

  // Initial word count update
  updateWordCount();

  // Update word count when active editor changes
  const onDidChangeActiveTextEditorForWordCount = vscode.window.onDidChangeActiveTextEditor(updateWordCountOnChange);

  // Update word count when document content changes
  const onDidChangeTextDocumentForWordCount = vscode.workspace.onDidChangeTextDocument((event) => {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && event.document === activeEditor.document) {
      updateWordCount();
    }
  });

  context.subscriptions.push(onDidChangeActiveTextEditorForWordCount, onDidChangeTextDocumentForWordCount);
}

export function deactivate() {
  console.log('WriterDown extension is now deactivated!');
}

class CharacterDefinitionProvider implements vscode.DefinitionProvider {
  constructor(private characterProvider: CharacterProvider) {}

  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): Promise<vscode.Definition | undefined> {
    // Get the word at the current position
    const wordRange = document.getWordRangeAtPosition(position, /@[A-Za-z0-9_]+/);
    if (!wordRange) {
      return undefined;
    }

    const word = document.getText(wordRange);

    // Check if it's a character mention
    const characterMatch = word.match(/@([A-Za-z0-9_]+)/);
    if (!characterMatch) {
      return undefined;
    }

    const characterName = characterMatch[1];

    // Get character info from the provider
    const characterInfo = this.characterProvider.getCharacterInfo(characterName);
    if (!characterInfo || !characterInfo.cardPath) {
      return undefined;
    }

    // Return the character card as the definition
    const cardUri = vscode.Uri.file(characterInfo.cardPath);

    try {
      // Verify the file exists
      await vscode.workspace.fs.stat(cardUri);

      // Return definition pointing to the character card
      return new vscode.Location(cardUri, new vscode.Position(0, 0));
    } catch {
      // Character card doesn't exist
      return undefined;
    }
  }
}

class CharacterCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private characterProvider: CharacterProvider) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    // Get the text before the cursor
    const lineText = document.lineAt(position).text;
    const textBeforeCursor = lineText.substring(0, position.character);

    // Check if we're after an @ symbol
    const atMatch = textBeforeCursor.match(/@([A-Za-z0-9_]*)$/);
    if (!atMatch) {
      return [];
    }

    const partialName = atMatch[1];

    // Get all characters from the provider
    const allCharacters = this.characterProvider.getAllCharacters();

    // Create completion items for each character
    const completionItems: vscode.CompletionItem[] = allCharacters
      .filter((char) => char.name.toLowerCase().startsWith(partialName.toLowerCase()))
      .map((char) => {
        const completionItem = new vscode.CompletionItem(char.name, vscode.CompletionItemKind.Reference);

        // Set the text to insert (just the character name, since @ is already typed)
        completionItem.insertText = char.name;

        // Add details about the character
        completionItem.detail = `Character (${char.count} mentions across ${
          new Set(char.positions.map((p) => p.fileName)).size
        } files)`;

        // Set filter text to include the @ symbol for better matching
        completionItem.filterText = `@${char.name}`;

        // Set completion item kind for icon
        completionItem.kind = vscode.CompletionItemKind.Reference;

        return completionItem;
      });

    return completionItems;
  }

  async resolveCompletionItem(
    item: vscode.CompletionItem,
    token: vscode.CancellationToken,
  ): Promise<vscode.CompletionItem> {
    // Get character info
    const characterInfo = this.characterProvider.getCharacterInfo(item.label as string);
    if (!characterInfo || !characterInfo.cardPath) {
      return item;
    }

    try {
      // Read the character card content
      const cardUri = vscode.Uri.file(characterInfo.cardPath);
      const cardContent = Buffer.from(await vscode.workspace.fs.readFile(cardUri)).toString('utf8');

      // Process the card content for display
      const processedContent = this.processCharacterCardForDisplay(cardContent);

      // Set the documentation to show the character card content in monospaced font
      item.documentation = new vscode.MarkdownString(`\`\`\`\n${processedContent}\n\`\`\``);
    } catch (error) {
      // If we can't read the card, show basic info
      item.documentation = new vscode.MarkdownString(
        `\`\`\`\nCharacter: ${characterInfo.name}\n` +
          `${characterInfo.count} mentions across ${
            new Set(characterInfo.positions.map((p) => p.fileName)).size
          } files.\n\n` +
          `Character card not found or couldn't be read.\n\`\`\``,
      );
    }

    return item;
  }

  private processCharacterCardForDisplay(cardContent: string): string {
    // Split content into lines
    const lines = cardContent.split('\n');

    // Remove the metadata section at the end (--- and beyond)
    const contentLines: string[] = [];
    let inMetadata = false;

    for (const line of lines) {
      if (line.trim() === '---' && contentLines.length > 0) {
        inMetadata = true;
        break;
      }
      if (!inMetadata) {
        contentLines.push(line);
      }
    }

    // Join back and limit length for popup display
    let processedContent = contentLines.join('\n').trim();

    // Limit content length to avoid huge popups
    const maxLength = 800;
    if (processedContent.length > maxLength) {
      processedContent = processedContent.substring(0, maxLength) + '\n\n...content truncated';
    }

    // Add a simple header
    return `Character Card Preview:\n\n${processedContent}`;
  }
}
