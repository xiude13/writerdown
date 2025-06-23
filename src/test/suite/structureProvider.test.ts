import * as assert from 'assert';
import * as vscode from 'vscode';
import { StructureProvider } from '../../structureProvider';

suite('StructureProvider Tests', () => {
  let provider: StructureProvider;

  setup(() => {
    provider = new StructureProvider();
  });

  teardown(() => {
    // Clean up after each test
  });

  test('Should initialize with empty structure', () => {
    const structure = provider.getAllStructure();
    assert.strictEqual(structure.length, 0);
  });

  test('Should calculate project totals correctly', () => {
    const totals = provider.getProjectTotals();

    assert.ok(typeof totals.totalWords === 'number');
    assert.ok(typeof totals.totalPages === 'number');
    assert.ok(typeof totals.chapterCount === 'number');
    assert.ok(totals.totalWords >= 0);
    assert.ok(totals.totalPages >= 0);
    assert.ok(totals.chapterCount >= 0);
  });

  test('Should count words correctly', () => {
    const testText = 'This is a test with exactly eight words.';
    const wordCount = (provider as any).countWords(testText);

    assert.strictEqual(wordCount, 8);
  });

  test('Should count words with punctuation and newlines', () => {
    const testText = `Hello, world!
    This is a test.
    
    With multiple lines and... punctuation!`;

    const wordCount = (provider as any).countWords(testText);
    assert.ok(wordCount > 0);
  });

  test('Should extract metadata from YAML frontmatter', () => {
    const testContent = `---
chapter: 5.1
title: The Great Discovery
status: draft
---

# Chapter Content
This is the chapter content.`;

    const metadata = (provider as any).extractMetadata(testContent);

    assert.strictEqual(metadata.chapter, '5.1');
    assert.strictEqual(metadata.title, 'The Great Discovery');
    assert.strictEqual(metadata.status, 'draft');
  });

  test('Should handle content without metadata', () => {
    const testContent = `# Simple Chapter
Just content without frontmatter.`;

    const metadata = (provider as any).extractMetadata(testContent);

    assert.strictEqual(metadata.chapter, undefined);
    assert.strictEqual(metadata.title, undefined);
    assert.strictEqual(metadata.status, undefined);
  });

  test('Should sort chapter numbers correctly', () => {
    const chapterNumbers = ['1.10', '1.2', '1.1', '2.1', '1.3'];
    const sortedNumbers = chapterNumbers.sort((a, b) => (provider as any).sortChapterNumbers(a, b));

    const expected = ['1.1', '1.2', '1.3', '1.10', '2.1'];
    assert.deepStrictEqual(sortedNumbers, expected);
  });

  test('Should handle empty chapter numbers', () => {
    const result = (provider as any).sortChapterNumbers('', '1.1');
    assert.ok(typeof result === 'number');
  });

  test('Should create new chapter with proper template', async function () {
    this.timeout(5000);

    // Mock the input box to return a test chapter name
    const originalShowInputBox = vscode.window.showInputBox;
    vscode.window.showInputBox = async () => 'Test Chapter';

    try {
      // This test would require workspace setup, so we'll skip it if no workspace
      if (!vscode.workspace.workspaceFolders) {
        this.skip();
        return;
      }

      // The method should not throw
      await provider.createNewChapter();
    } finally {
      // Restore original function
      vscode.window.showInputBox = originalShowInputBox;
    }
  });
});
