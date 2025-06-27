import * as vscode from 'vscode';
import { CharacterInfo, CharacterProvider } from '../characterProvider';
import { StructureProvider } from '../structureProvider';
import { TodoProvider } from '../todoProvider';

/**
 * Basic test functions for WriterDown extension
 * These can be called manually to verify functionality
 */

export function testCharacterProvider(): boolean {
  console.log('Testing CharacterProvider...');

  try {
    const provider = new CharacterProvider();

    // Test 1: Initial state
    const initialCharacters = provider.getAllCharacters();
    if (initialCharacters.length !== 0) {
      console.error('Expected empty characters on initialization');
      return false;
    }

    // Test 2: Character card template
    const mockCharacter: CharacterInfo = {
      name: 'TestCharacter',
      count: 1,
      positions: [
        {
          position: new vscode.Position(5, 10),
          fileName: 'test.md',
          filePath: '/test.md',
        },
      ],
    };

    const template = (provider as any).createCharacterCardTemplate(mockCharacter);

    const requiredSections = [
      '# TestCharacter',
      '## Physical Description',
      'Hair:',
      'Eyes:',
      '## Personality',
      'Core Traits:',
      '## Background',
      '## Relationships',
      '## Character Arc',
    ];

    for (const section of requiredSections) {
      if (!template.includes(section)) {
        console.error(`Template missing required section: ${section}`);
        return false;
      }
    }

    // Test 3: Feature parsing
    const mockCardContent = `# Elena
Age: 25 • Location: New York

## Role in Story
Protagonist seeking her missing sister

## Physical Description
Hair: Dark curly
Eyes: Green

## Personality
Core Traits: Determined, brave
`;

    const features = (provider as any).parseCharacterFeatures(mockCardContent);

    if (features.length === 0) {
      console.error('Expected features to be parsed from card content');
      return false;
    }

    const hasAgeLocation = features.some(
      (f: any) => f.label === 'Age & Location' && f.value === '25 • Location: New York',
    );

    if (!hasAgeLocation) {
      console.error('Expected Age & Location feature to be parsed');
      return false;
    }

    console.log('✅ CharacterProvider tests passed');
    return true;
  } catch (error) {
    console.error('CharacterProvider test failed:', error);
    return false;
  }
}

export function testStructureProvider(): boolean {
  console.log('Testing StructureProvider...');

  try {
    const provider = new StructureProvider();

    // Test initial state
    const initialStructure = provider.getAllStructure();
    if (initialStructure.length !== 0) {
      console.error('Expected empty structure on initialization');
      return false;
    }

    console.log('✅ StructureProvider tests passed');
    return true;
  } catch (error) {
    console.error('StructureProvider test failed:', error);
    return false;
  }
}

export function testTodoProvider(): boolean {
  console.log('Testing TodoProvider...');

  try {
    const provider = new TodoProvider();

    // Test initial state
    const initialTodos = provider.getAllTodos();
    if (initialTodos.length !== 0) {
      console.error('Expected empty todos on initialization');
      return false;
    }

    console.log('✅ TodoProvider tests passed');
    return true;
  } catch (error) {
    console.error('TodoProvider test failed:', error);
    return false;
  }
}

export function testCharacterCardStructure(): boolean {
  console.log('Testing Character Card Structure...');

  try {
    const provider = new CharacterProvider();
    const template = (provider as any).createNewCharacterTemplate('TestCharacter');

    // Verify structured template has all required sections
    const requiredStructure = [
      'Age: • Location:',
      '## Role in Story',
      '## Goal',
      '## Physical Description',
      'Hair:',
      'Eyes:',
      'Body Type:',
      'Height:',
      'Skin:',
      'Distinguishing Features:',
      'Style/Clothing:',
      '## Personality',
      'Core Traits:',
      'Strengths:',
      'Weaknesses:',
      'Fears:',
      'Desires:',
      'Mannerisms:',
      'Speech Pattern:',
      '## Background',
      'Occupation:',
      'Education:',
      'Family:',
      'Childhood:',
      'Key Life Events:',
      '## Relationships',
      'Family Members:',
      'Friends:',
      'Enemies:',
      'Romantic Interest:',
      'Allies:',
      '## Character Arc',
      'Starting Point:',
      'Character Growth:',
      'Internal Conflict:',
      'External Conflict:',
      'Resolution:',
    ];

    for (const item of requiredStructure) {
      if (!template.includes(item)) {
        console.error(`Template missing: ${item}`);
        return false;
      }
    }

    console.log('✅ Character Card Structure tests passed');
    return true;
  } catch (error) {
    console.error('Character Card Structure test failed:', error);
    return false;
  }
}

export function testCharacterAliases(): boolean {
  console.log('Testing Character Aliases...');

  try {
    const provider = new CharacterProvider();

    // Test 1: Verify new character template includes aliases field
    const newTemplate = (provider as any).createNewCharacterTemplate('TestCharacter');

    if (!newTemplate.includes('aliases: []')) {
      console.error('New character template should include aliases field');
      return false;
    }

    // Test 2: Verify existing character template includes aliases field
    const mockCharacter: CharacterInfo = {
      name: 'TestCharacter',
      count: 1,
      positions: [
        {
          position: new vscode.Position(5, 10),
          fileName: 'test.md',
          filePath: '/test.md',
        },
      ],
    };

    const existingTemplate = (provider as any).createCharacterCardTemplate(mockCharacter);

    if (!existingTemplate.includes('aliases: []')) {
      console.error('Existing character template should include aliases field');
      return false;
    }

    // Test 3: Test YAML parsing with aliases
    const yamlWithAliases = `---
name: Bren
category: Main Characters
aliases: ["Master Bren", "Lord Bren", "The Master"]
tags: ["magic", "mentor"]
---

# Bren
Content here...`;

    const metadata = (provider as any).parseYamlFrontmatter(yamlWithAliases);

    if (!metadata || !Array.isArray(metadata.aliases)) {
      console.error('Failed to parse aliases from YAML frontmatter');
      return false;
    }

    if (metadata.aliases.length !== 3) {
      console.error(`Expected 3 aliases, got ${metadata.aliases.length}`);
      return false;
    }

    if (
      !metadata.aliases.includes('Master Bren') ||
      !metadata.aliases.includes('Lord Bren') ||
      !metadata.aliases.includes('The Master')
    ) {
      console.error('Not all expected aliases were parsed correctly');
      return false;
    }

    // Test 4: Test empty aliases array
    const yamlWithEmptyAliases = `---
name: Elena
category: Protagonist
aliases: []
---

# Elena
Content here...`;

    const emptyAliasMetadata = (provider as any).parseYamlFrontmatter(yamlWithEmptyAliases);

    if (!emptyAliasMetadata || !Array.isArray(emptyAliasMetadata.aliases)) {
      console.error('Failed to parse empty aliases array');
      return false;
    }

    if (emptyAliasMetadata.aliases.length !== 0) {
      console.error('Empty aliases array should have length 0');
      return false;
    }

    // Test 5: Test missing aliases field
    const yamlWithoutAliases = `---
name: Marcus
category: Supporting
---

# Marcus
Content here...`;

    const noAliasMetadata = (provider as any).parseYamlFrontmatter(yamlWithoutAliases);

    if (!noAliasMetadata) {
      console.error('Failed to parse YAML without aliases field');
      return false;
    }

    if (noAliasMetadata.aliases !== undefined) {
      console.error('Missing aliases field should be undefined');
      return false;
    }

    console.log('✅ Character Aliases tests passed');
    return true;
  } catch (error) {
    console.error('Character Aliases test failed:', error);
    return false;
  }
}

export function testAsyncCharacterMention(): boolean {
  console.log('Testing Async Character Mention...');

  try {
    const provider = new CharacterProvider();

    // Test that addCharacterMention is now async
    const characterName = 'TestCharacter';
    const position = new vscode.Position(1, 5);
    const fileName = 'test.md';
    const filePath = '/test/test.md';

    // This should return a Promise
    const result = (provider as any).addCharacterMention(characterName, position, fileName, filePath);

    if (!(result instanceof Promise)) {
      console.error('addCharacterMention should return a Promise');
      return false;
    }

    // Test that resolveCharacterAlias is async and returns a string
    const aliasResult = (provider as any).resolveCharacterAlias('TestAlias');

    if (!(aliasResult instanceof Promise)) {
      console.error('resolveCharacterAlias should return a Promise');
      return false;
    }

    console.log('✅ Async Character Mention tests passed');
    return true;
  } catch (error) {
    console.error('Async Character Mention test failed:', error);
    return false;
  }
}

export function runAllTests(): boolean {
  console.log('🧪 Running WriterDown Tests...\n');

  const tests = [
    testCharacterProvider,
    testStructureProvider,
    testTodoProvider,
    testCharacterCardStructure,
    testCharacterAliases,
    testAsyncCharacterMention,
  ];

  let allPassed = true;

  for (const test of tests) {
    const passed = test();
    if (!passed) {
      allPassed = false;
    }
    console.log(''); // Add spacing between tests
  }

  if (allPassed) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('❌ Some tests failed');
  }

  return allPassed;
}

// Export test runner command
export function activateTests(context: vscode.ExtensionContext) {
  const runTestsCommand = vscode.commands.registerCommand('writerdown.runTests', () => {
    const outputChannel = vscode.window.createOutputChannel('WriterDown Tests');
    outputChannel.show();

    // Redirect console.log to output channel
    const originalLog = console.log;
    const originalError = console.error;

    console.log = (message: any) => {
      outputChannel.appendLine(String(message));
    };

    console.error = (message: any) => {
      outputChannel.appendLine(`ERROR: ${String(message)}`);
    };

    try {
      runAllTests();
    } finally {
      // Restore original console functions
      console.log = originalLog;
      console.error = originalError;
    }
  });

  context.subscriptions.push(runTestsCommand);
}
