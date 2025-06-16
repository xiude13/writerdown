"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateTests = exports.runAllTests = exports.testCharacterCardStructure = exports.testTodoProvider = exports.testStructureProvider = exports.testCharacterProvider = void 0;
const vscode = require("vscode");
const characterProvider_1 = require("../characterProvider");
const structureProvider_1 = require("../structureProvider");
const todoProvider_1 = require("../todoProvider");
/**
 * Basic test functions for WriterDown extension
 * These can be called manually to verify functionality
 */
function testCharacterProvider() {
    console.log('Testing CharacterProvider...');
    try {
        const provider = new characterProvider_1.CharacterProvider();
        // Test 1: Initial state
        const initialCharacters = provider.getAllCharacters();
        if (initialCharacters.length !== 0) {
            console.error('Expected empty characters on initialization');
            return false;
        }
        // Test 2: Character card template
        const mockCharacter = {
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
        const template = provider.createCharacterCardTemplate(mockCharacter);
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
        const features = provider.parseCharacterFeatures(mockCardContent);
        if (features.length === 0) {
            console.error('Expected features to be parsed from card content');
            return false;
        }
        const hasAgeLocation = features.some((f) => f.label === 'Age & Location' && f.value === '25 • Location: New York');
        if (!hasAgeLocation) {
            console.error('Expected Age & Location feature to be parsed');
            return false;
        }
        console.log('✅ CharacterProvider tests passed');
        return true;
    }
    catch (error) {
        console.error('CharacterProvider test failed:', error);
        return false;
    }
}
exports.testCharacterProvider = testCharacterProvider;
function testStructureProvider() {
    console.log('Testing StructureProvider...');
    try {
        const provider = new structureProvider_1.StructureProvider();
        // Test initial state
        const initialStructure = provider.getAllStructure();
        if (initialStructure.length !== 0) {
            console.error('Expected empty structure on initialization');
            return false;
        }
        console.log('✅ StructureProvider tests passed');
        return true;
    }
    catch (error) {
        console.error('StructureProvider test failed:', error);
        return false;
    }
}
exports.testStructureProvider = testStructureProvider;
function testTodoProvider() {
    console.log('Testing TodoProvider...');
    try {
        const provider = new todoProvider_1.TodoProvider();
        // Test initial state
        const initialTodos = provider.getAllTodos();
        if (initialTodos.length !== 0) {
            console.error('Expected empty todos on initialization');
            return false;
        }
        console.log('✅ TodoProvider tests passed');
        return true;
    }
    catch (error) {
        console.error('TodoProvider test failed:', error);
        return false;
    }
}
exports.testTodoProvider = testTodoProvider;
function testCharacterCardStructure() {
    console.log('Testing Character Card Structure...');
    try {
        const provider = new characterProvider_1.CharacterProvider();
        const template = provider.createNewCharacterTemplate('TestCharacter');
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
    }
    catch (error) {
        console.error('Character Card Structure test failed:', error);
        return false;
    }
}
exports.testCharacterCardStructure = testCharacterCardStructure;
function runAllTests() {
    console.log('🧪 Running WriterDown Tests...\n');
    const tests = [testCharacterProvider, testStructureProvider, testTodoProvider, testCharacterCardStructure];
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
    }
    else {
        console.log('❌ Some tests failed');
    }
    return allPassed;
}
exports.runAllTests = runAllTests;
// Export test runner command
function activateTests(context) {
    const runTestsCommand = vscode.commands.registerCommand('writerdown.runTests', () => {
        const outputChannel = vscode.window.createOutputChannel('WriterDown Tests');
        outputChannel.show();
        // Redirect console.log to output channel
        const originalLog = console.log;
        const originalError = console.error;
        console.log = (message) => {
            outputChannel.appendLine(String(message));
        };
        console.error = (message) => {
            outputChannel.appendLine(`ERROR: ${String(message)}`);
        };
        try {
            runAllTests();
        }
        finally {
            // Restore original console functions
            console.log = originalLog;
            console.error = originalError;
        }
    });
    context.subscriptions.push(runTestsCommand);
}
exports.activateTests = activateTests;
//# sourceMappingURL=basicTests.js.map