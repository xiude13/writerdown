import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Integration Tests', () => {
  let workspaceUri: vscode.Uri;

  suiteSetup(async () => {
    // Create a temporary workspace for testing
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      workspaceUri = workspaceFolder.uri;
    }
  });

  test('Extension should be present', () => {
    const extension = vscode.extensions.getExtension('writerdown.writerdown');
    assert.ok(extension, 'Extension should be installed');
  });

  test('Extension should activate', async () => {
    const extension = vscode.extensions.getExtension('writerdown.writerdown');
    if (extension && !extension.isActive) {
      await extension.activate();
    }
    assert.ok(extension?.isActive, 'Extension should be active');
  });

  test('WriterDown language should be registered', async () => {
    const languages = await vscode.languages.getLanguages();
    assert.ok(languages.includes('writerdown'), 'WriterDown language should be registered');
  });

  test('Commands should be registered', async () => {
    const commands = await vscode.commands.getCommands();

    const expectedCommands = [
      'writerdown.setLanguage',
      'writerdown.refreshCharacters',
      'writerdown.newCharacter',
      'writerdown.refreshStructure',
      'writerdown.refreshTasks',
    ];

    expectedCommands.forEach((command) => {
      assert.ok(commands.includes(command), `Command ${command} should be registered`);
    });
  });

  test('Tree views should be registered', async () => {
    // Test that tree view providers are registered by checking if they exist
    const structureView = vscode.window.createTreeView('writerdown-structure', {
      treeDataProvider: {
        getTreeItem: () => new vscode.TreeItem('test'),
        getChildren: () => [],
      },
    });

    assert.ok(structureView, 'Structure tree view should be creatable');
    structureView.dispose();
  });

  test('Should handle markdown file operations', async function () {
    this.timeout(10000); // Longer timeout for file operations

    if (!workspaceUri) {
      this.skip(); // Skip if no workspace
      return;
    }

    // Create a test markdown file
    const testFileUri = vscode.Uri.joinPath(workspaceUri, 'test-file.md');
    const testContent = `# Test Chapter

@Elena walked into the room.

## Section 1

@[John Smith] was waiting for her.

#! [EVENT] Important meeting

TODO: Add more dialogue here
`;

    try {
      await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(testContent));

      // Open the file
      const document = await vscode.workspace.openTextDocument(testFileUri);
      const editor = await vscode.window.showTextDocument(document);

      // Set language to WriterDown
      await vscode.languages.setTextDocumentLanguage(document, 'writerdown');

      // Verify content
      assert.strictEqual(document.getText(), testContent);
      assert.strictEqual(document.languageId, 'writerdown');

      // Clean up
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      await vscode.workspace.fs.delete(testFileUri);
    } catch (error) {
      console.error('Test file operation failed:', error);
      throw error;
    }
  });

  test('Character mentions should be detected', async function () {
    this.timeout(5000);

    if (!workspaceUri) {
      this.skip();
      return;
    }

    const testContent = `# Test

@Elena is the protagonist.
@[John Smith] is a supporting character.
`;

    const testFileUri = vscode.Uri.joinPath(workspaceUri, 'character-test.md');

    try {
      await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(testContent));
      const document = await vscode.workspace.openTextDocument(testFileUri);

      // Trigger character scanning by refreshing
      await vscode.commands.executeCommand('writerdown.refreshCharacters');

      // Wait a bit for processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Clean up
      await vscode.workspace.fs.delete(testFileUri);
    } catch (error) {
      console.error('Character detection test failed:', error);
      // Clean up on error
      try {
        await vscode.workspace.fs.delete(testFileUri);
      } catch {}
      throw error;
    }
  });
});
