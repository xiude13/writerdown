import * as vscode from 'vscode';
import { CharacterInfo, CharacterProvider, CharacterTreeItem } from './characterProvider';
import { exportNovel } from './export-novel';
import { MarkerInfo, MarkerProvider } from './markerProvider';
import { NovelFormatter } from './novelFormatter';
import { StructureInfo, StructureProvider } from './structureProvider';
import { TodoInfo, TodoProvider } from './todoProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('WriterDown extension is now active!');

  // Create providers
  const characterProvider = new CharacterProvider();
  const todoProvider = new TodoProvider();
  const structureProvider = new StructureProvider();
  const markerProvider = new MarkerProvider();

  // Activate test commands (optional - only in development)
  try {
    const { activateTests } = require('./test/basicTests');
    activateTests(context);
    console.log('Test commands activated');
  } catch (error) {
    console.log('Test commands not available (production mode)');
  }

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

  // Set the tree view on the provider for access to VS Code features
  characterProvider.setTreeView(characterTreeView);

  const todoTreeView = vscode.window.createTreeView('writerdown-tasks', {
    treeDataProvider: todoProvider,
    showCollapseAll: false,
  });

  const markerTreeView = vscode.window.createTreeView('writerdown-markers', {
    treeDataProvider: markerProvider,
    showCollapseAll: false,
  });

  // Set the tree view on the provider for access to VS Code features
  markerProvider.setTreeView(markerTreeView);

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
      await Promise.all([
        structureProvider.refresh(),
        characterProvider.refresh(),
        todoProvider.refresh(),
        markerProvider.refresh(),
      ]);
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

  const renameCharacterCommand = vscode.commands.registerCommand(
    'writerdown.renameCharacter',
    async (treeItem?: CharacterTreeItem | CharacterInfo, ...args: any[]) => {
      console.log('Rename character command called with:', treeItem, 'args:', args);

      let characterInfo: CharacterInfo | undefined;

      // Try to extract character info from different possible parameter types
      if (treeItem) {
        if ('characterInfo' in treeItem) {
          // It's a CharacterTreeItem
          characterInfo = treeItem.characterInfo;
        } else if ('name' in treeItem && 'count' in treeItem) {
          // It's already a CharacterInfo
          characterInfo = treeItem as CharacterInfo;
        }
      }

      if (characterInfo && characterInfo.name) {
        console.log('Found character info:', characterInfo.name);
        await characterProvider.renameCharacter(characterInfo);
      } else {
        console.log('No valid character info found, treeItem:', treeItem);
        vscode.window.showErrorMessage('No character selected for rename');
      }
    },
  );

  const changeCategoryCommand = vscode.commands.registerCommand(
    'writerdown.changeCategory',
    async (treeItem?: CharacterTreeItem | CharacterInfo, ...args: any[]) => {
      console.log('Change category command called with:', treeItem, 'args:', args);

      let characterInfo: CharacterInfo | undefined;

      // Try to extract character info from different possible parameter types
      if (treeItem) {
        if ('characterInfo' in treeItem) {
          // It's a CharacterTreeItem
          characterInfo = treeItem.characterInfo;
        } else if ('name' in treeItem && 'count' in treeItem) {
          // It's already a CharacterInfo
          characterInfo = treeItem as CharacterInfo;
        }
      }

      if (characterInfo && characterInfo.name) {
        console.log('Found character info for category change:', characterInfo.name);
        await characterProvider.changeCategoryCharacter(characterInfo);
      } else {
        console.log('No valid character info found for category change, treeItem:', treeItem);
        vscode.window.showErrorMessage('No character selected for category change');
      }
    },
  );

  const assignCategoryCommand = vscode.commands.registerCommand(
    'writerdown.assignCategory',
    async (treeItem?: CharacterTreeItem | CharacterInfo, ...args: any[]) => {
      console.log('Assign category command called with:', treeItem, 'args:', args);

      let characterInfo: CharacterInfo | undefined;

      // Try to extract character info from different possible parameter types
      if (treeItem) {
        if ('characterInfo' in treeItem) {
          // It's a CharacterTreeItem
          characterInfo = treeItem.characterInfo;
        } else if ('name' in treeItem && 'count' in treeItem) {
          // It's already a CharacterInfo
          characterInfo = treeItem as CharacterInfo;
        }
      }

      if (characterInfo && characterInfo.name) {
        console.log('Found character info for category assignment:', characterInfo.name);
        await characterProvider.assignCategoryCharacter(characterInfo);
      } else {
        console.log('No valid character info found for category assignment, treeItem:', treeItem);
        vscode.window.showErrorMessage('No character selected for category assignment');
      }
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

  // Register marker commands
  const refreshMarkersCommand = vscode.commands.registerCommand('writerdown.refreshMarkers', async () => {
    await markerProvider.refresh();
    vscode.window.showInformationMessage('Markers refreshed');
  });

  const goToMarkerCommand = vscode.commands.registerCommand('writerdown.goToMarker', async (markerInfo: MarkerInfo) => {
    await markerProvider.goToMarker(markerInfo);
  });

  const addChapterMetadataCommand = vscode.commands.registerCommand('writerdown.addChapterMetadata', async () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showWarningMessage('No active editor found');
      return;
    }

    await markerProvider.addMetadataToChapter(activeEditor.document.fileName);
    await refreshAllProviders();
    vscode.window.showInformationMessage('Chapter metadata added');
  });

  // Register marker search commands
  const searchStoryEventsCommand = vscode.commands.registerCommand('writerdown.searchStoryEvents', () => {
    markerProvider.searchMarkers();
  });

  const clearStoryEventsSearchCommand = vscode.commands.registerCommand('writerdown.clearStoryEventsSearch', () => {
    markerProvider.clearSearch();
  });

  // Register character search commands
  const searchCharactersCommand = vscode.commands.registerCommand('writerdown.searchCharacters', () => {
    characterProvider.searchCharacters();
  });

  const clearCharactersSearchCommand = vscode.commands.registerCommand('writerdown.clearCharactersSearch', () => {
    characterProvider.clearSearch();
  });

  // Register panel focus navigation commands
  const panelOrder = ['writerdown-structure', 'writerdown-markers', 'writerdown-characters', 'writerdown-tasks'];
  let currentPanelIndex = 0;

  const focusNextPanelCommand = vscode.commands.registerCommand('writerdown.focusNextPanel', () => {
    currentPanelIndex = (currentPanelIndex + 1) % panelOrder.length;
    const nextPanel = panelOrder[currentPanelIndex];

    vscode.commands.executeCommand('workbench.view.extension.writerdown-sidebar');
    setTimeout(() => vscode.commands.executeCommand(`${nextPanel}.focus`), 100);
  });

  const focusPreviousPanelCommand = vscode.commands.registerCommand('writerdown.focusPreviousPanel', () => {
    currentPanelIndex = currentPanelIndex <= 0 ? panelOrder.length - 1 : currentPanelIndex - 1;
    const previousPanel = panelOrder[currentPanelIndex];

    vscode.commands.executeCommand('workbench.view.extension.writerdown-sidebar');
    setTimeout(() => vscode.commands.executeCommand(`${previousPanel}.focus`), 100);
  });

  const resetPanelOrderCommand = vscode.commands.registerCommand('writerdown.resetPanelOrder', async () => {
    const selection = await vscode.window.showInformationMessage(
      'VS Code does not provide an API to programmatically reorder panels.\n\nTo reset panel order manually:\n1. Right-click on panel titles\n2. Drag panels to this order: Structure → Story Markers → Characters → Writer Tasks\n\nThis will ensure Alt+Up/Down navigation works correctly.',
      { modal: true },
      'Open Settings',
      'OK',
    );

    if (selection === 'Open Settings') {
      // Reset the current panel index for keyboard navigation
      currentPanelIndex = 0;

      // Open the settings where users can see the extension
      await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:writerdown');
    }
  });

  // Register internal link provider
  const linkProvider = vscode.languages.registerDocumentLinkProvider(
    { language: 'writerdown' },
    new WriterDownLinkProvider(),
  );
  context.subscriptions.push(linkProvider);

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

  // Register novel formatting commands
  const formatNovelCommand = vscode.commands.registerCommand('writerdown.formatNovel', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    if (!editor.document.fileName.endsWith('.md')) {
      vscode.window.showErrorMessage('Novel formatting is only available for Markdown files');
      return;
    }

    try {
      const formattedText = await NovelFormatter.formatDocument(editor.document);
      const fullRange = new vscode.Range(
        editor.document.positionAt(0),
        editor.document.positionAt(editor.document.getText().length),
      );

      await editor.edit((editBuilder) => {
        editBuilder.replace(fullRange, formattedText);
      });

      vscode.window.showInformationMessage('Novel formatting applied successfully');
    } catch (error) {
      vscode.window.showErrorMessage(`Error formatting novel: ${error}`);
    }
  });

  const cleanIndentationCommand = vscode.commands.registerCommand('writerdown.cleanIndentation', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    try {
      const cleanedText = NovelFormatter.cleanMarkdownIndentation(editor.document.getText());
      const fullRange = new vscode.Range(
        editor.document.positionAt(0),
        editor.document.positionAt(editor.document.getText().length),
      );

      await editor.edit((editBuilder) => {
        editBuilder.replace(fullRange, cleanedText);
      });

      vscode.window.showInformationMessage('Markdown indentation cleaned successfully');
    } catch (error) {
      vscode.window.showErrorMessage(`Error cleaning indentation: ${error}`);
    }
  });

  const exportNovelCommand = vscode.commands.registerCommand('writerdown.exportNovel', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    const format = await vscode.window.showQuickPick(['docx', 'html', 'pdf'], { placeHolder: 'Select export format' });

    if (!format) return;

    try {
      // Use the standalone export function
      await exportNovel({
        input: editor.document.fileName,
        format: format as 'docx' | 'html' | 'pdf',
      });

      vscode.window.showInformationMessage(`Novel exported successfully in ${format.toUpperCase()} format`);
    } catch (error) {
      vscode.window.showErrorMessage(`Error exporting novel: ${error}`);
    }
  });

  const cleanMarkupCommand = vscode.commands.registerCommand('writerdown.cleanMarkup', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith('.md')) {
      vscode.window.showErrorMessage('Please open a markdown file to clean markup');
      return;
    }

    try {
      const originalText = editor.document.getText();
      const cleanedText = NovelFormatter.cleanWriterDownMarkup(originalText);

      // Show preview of cleaned content in a new untitled document
      const doc = await vscode.workspace.openTextDocument({
        content: cleanedText,
        language: 'markdown',
      });

      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage(
        'WriterDown markup cleaned. This is a preview - your original file is unchanged.',
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Error cleaning markup: ${error}`);
    }
  });

  const exportCleanMarkdownCommand = vscode.commands.registerCommand('writerdown.exportCleanMarkdown', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith('.md')) {
      vscode.window.showErrorMessage('Please open a markdown file to export');
      return;
    }

    try {
      const originalText = editor.document.getText();
      const cleanedText = NovelFormatter.cleanWriterDownMarkup(originalText);

      // Create output directory
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
      }

      const fs = require('fs');
      const path = require('path');
      const outputDir = path.join(workspaceFolder.uri.fsPath, 'output');

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Generate output filename
      const originalFileName = path.basename(editor.document.fileName, '.md');
      const outputPath = path.join(outputDir, `${originalFileName}-clean.md`);

      // Write cleaned file
      fs.writeFileSync(outputPath, cleanedText, 'utf-8');

      vscode.window.showInformationMessage(`Clean markdown exported to: output/${originalFileName}-clean.md`);
    } catch (error) {
      vscode.window.showErrorMessage(`Error exporting clean markdown: ${error}`);
    }
  });

  const exportChapterCleanCommand = vscode.commands.registerCommand('writerdown.exportChapterClean', async () => {
    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    try {
      // Find all chapter files
      const files = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**');
      const chapterFiles = files.filter(
        (file) =>
          file.fsPath.includes('Book/') ||
          file.fsPath.includes('Chapter') ||
          file.path.toLowerCase().includes('chapter'),
      );

      if (chapterFiles.length === 0) {
        vscode.window.showWarningMessage(
          'No chapter files found. Looking for files in Book/ folder or containing "Chapter".',
        );
        return;
      }

      const fs = require('fs');
      const path = require('path');
      const outputDir = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'output', 'chapters');

      // Create output directory
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      let processedCount = 0;

      for (const file of chapterFiles) {
        const content = fs.readFileSync(file.fsPath, 'utf-8');
        const cleanedContent = NovelFormatter.cleanWriterDownMarkup(content);

        const fileName = path.basename(file.fsPath, '.md') + '-clean.md';
        const outputPath = path.join(outputDir, fileName);

        fs.writeFileSync(outputPath, cleanedContent, 'utf-8');
        processedCount++;
      }

      vscode.window.showInformationMessage(`Exported ${processedCount} clean chapter files to: output/chapters/`);
    } catch (error) {
      vscode.window.showErrorMessage(`Error exporting chapters: ${error}`);
    }
  });

  const exportAllFormatsCommand = vscode.commands.registerCommand('writerdown.exportAllFormats', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith('.md')) {
      vscode.window.showErrorMessage('Please open a markdown file to export');
      return;
    }

    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
      }

      // Show progress
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Exporting to all formats...',
          cancellable: false,
        },
        async (progress) => {
          const formats: ('docx' | 'html' | 'pdf')[] = ['docx', 'html', 'pdf'];
          const total = formats.length;

          for (let i = 0; i < formats.length; i++) {
            const format = formats[i];
            progress.report({
              increment: 100 / total,
              message: `Exporting ${format.toUpperCase()}...`,
            });

            await exportNovel({
              input: editor.document.fileName,
              format: format,
            });
          }
        },
      );

      vscode.window.showInformationMessage('Novel exported to all formats successfully! Check the output/ folder.');
    } catch (error) {
      vscode.window.showErrorMessage(`Error exporting to all formats: ${error}`);
    }
  });

  const debugStructureCommand = vscode.commands.registerCommand('writerdown.debugStructure', async () => {
    console.log('=== DEBUG STRUCTURE PROVIDER ===');

    // Check workspace
    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    console.log('Workspace folder:', vscode.workspace.workspaceFolders[0].uri.fsPath);

    // Check for Book folder
    try {
      const files = await vscode.workspace.findFiles('Book/**/*.md', '**/node_modules/**');
      console.log(`Found ${files.length} markdown files in Book folder:`);
      files.forEach((file) => console.log('  -', file.fsPath));

      // Force refresh structure provider
      await structureProvider.refresh();

      const allStructure = structureProvider.getAllStructure();
      console.log(`Structure provider has ${allStructure.length} items:`);
      allStructure.forEach((item) => {
        console.log(`  - ${item.type}: ${item.title} (${item.fileName}:${item.lineNumber})`);
      });

      vscode.window.showInformationMessage(
        `Debug complete. Found ${files.length} files, ${allStructure.length} structure items. Check console for details.`,
      );
    } catch (error) {
      console.error('Debug error:', error);
      vscode.window.showErrorMessage(`Debug error: ${error}`);
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
    renameCharacterCommand,
    changeCategoryCommand,
    assignCategoryCommand,
    refreshTasksCommand,
    goToTaskCommand,
    refreshMarkersCommand,
    goToMarkerCommand,
    addChapterMetadataCommand,
    searchStoryEventsCommand,
    clearStoryEventsSearchCommand,
    searchCharactersCommand,
    clearCharactersSearchCommand,
    focusNextPanelCommand,
    focusPreviousPanelCommand,
    resetPanelOrderCommand,
    refreshAllCommand,
    showWordCountDetailsCommand,
    showPageCountDetailsCommand,
    structureTreeView,
    characterTreeView,
    todoTreeView,
    markerTreeView,
    formatNovelCommand,
    cleanIndentationCommand,
    exportNovelCommand,
    cleanMarkupCommand,
    exportCleanMarkdownCommand,
    exportChapterCleanCommand,
    exportAllFormatsCommand,
    debugStructureCommand,
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
    // Get the word at the current position - try bracketed first, then single word
    let wordRange = document.getWordRangeAtPosition(position, /@\[[^\]]+\]/);
    let characterName: string | undefined;

    if (wordRange) {
      // Bracketed character name
      const word = document.getText(wordRange);
      const bracketedMatch = word.match(/@\[([^\]]+)\]/);
      if (bracketedMatch) {
        characterName = bracketedMatch[1];
      }
    } else {
      // Try single word character name
      wordRange = document.getWordRangeAtPosition(position, /@[A-Za-z0-9_]+/);
      if (wordRange) {
        const word = document.getText(wordRange);
        const singleWordMatch = word.match(/@([A-Za-z0-9_]+)/);
        if (singleWordMatch) {
          characterName = singleWordMatch[1];
        }
      }
    }

    if (!characterName || !wordRange) {
      return undefined;
    }

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

    // Check if we're after an @ symbol (for both @Name and @[Name formats)
    const singleWordMatch = textBeforeCursor.match(/@([A-Za-z0-9_]*)$/);
    const bracketedMatch = textBeforeCursor.match(/@\[([^\]]*)$/);

    let partialName = '';
    let isBracketed = false;

    if (bracketedMatch) {
      partialName = bracketedMatch[1];
      isBracketed = true;
    } else if (singleWordMatch) {
      partialName = singleWordMatch[1];
      isBracketed = false;
    } else {
      return [];
    }

    // Get all characters from the provider
    const allCharacters = this.characterProvider.getAllCharacters();

    // Create completion items for each character
    const completionItems: vscode.CompletionItem[] = allCharacters
      .filter((char) => char.name.toLowerCase().startsWith(partialName.toLowerCase()))
      .map((char) => {
        const completionItem = new vscode.CompletionItem(char.name, vscode.CompletionItemKind.Reference);

        // Set the text to insert based on format and character name
        const hasSpaces = char.name.includes(' ');

        if (isBracketed) {
          // For @[Name] format, insert the rest: Name]
          completionItem.insertText = char.name + ']';
        } else if (hasSpaces) {
          // For @Name format with spaces, insert [Name]
          completionItem.insertText = `[${char.name}]`;
        } else {
          // For @Name format without spaces, just insert the character name
          completionItem.insertText = char.name;
        }

        // Add details about the character
        completionItem.detail = `Character (${char.count} mentions across ${
          new Set(char.positions.map((p) => p.fileName)).size
        } files)`;

        // Set filter text to include the @ symbol for better matching
        completionItem.filterText = isBracketed ? `@[${char.name}` : `@${char.name}`;

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

class WriterDownLinkProvider implements vscode.DocumentLinkProvider {
  public provideDocumentLinks(
    document: vscode.TextDocument,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.DocumentLink[]> {
    const links: vscode.DocumentLink[] = [];
    const text = document.getText();

    // Regex to find paths like 'Book/Chapter 1.md:123'
    const linkPattern = /(['"])((?:Book|chapters|scenes)\/[^:'"]+\.md):(\d+)(['"])/g;
    let match;

    while ((match = linkPattern.exec(text)) !== null) {
      const filePath = match[2];
      const lineNumber = parseInt(match[3], 10) - 1; // Convert to 0-based index

      if (vscode.workspace.workspaceFolders) {
        const fullPath = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, filePath);

        const start = document.positionAt(match.index + 1);
        const end = document.positionAt(match.index + match[0].length - 1);
        const range = new vscode.Range(start, end);

        // Create the target URI with fragment for line number
        const targetUri = fullPath.with({ fragment: `L${lineNumber + 1}` });

        const link = new vscode.DocumentLink(range, targetUri);
        link.tooltip = 'Alt+click to follow link';
        links.push(link);
      }
    }

    return links;
  }
}
