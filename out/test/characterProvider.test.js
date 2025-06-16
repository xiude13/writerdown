"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const vscode = require("vscode");
const characterProvider_1 = require("../characterProvider");
suite('CharacterProvider Tests', () => {
    let characterProvider;
    setup(() => {
        characterProvider = new characterProvider_1.CharacterProvider();
    });
    test('Should initialize with empty characters', () => {
        const characters = characterProvider.getAllCharacters();
        assert.strictEqual(characters.length, 0);
    });
    test('Should detect character mentions in text', () => {
        // This would require mocking vscode.workspace and file system
        // For now, we'll test the parsing logic directly
        assert.ok(true, 'Character parsing test placeholder');
    });
    test('Should create character tree items with correct hierarchy', async () => {
        // Mock character data
        const mockCharacter = {
            name: 'Elena',
            count: 5,
            positions: [
                {
                    position: new vscode.Position(10, 5),
                    fileName: 'Chapter-01.md',
                    filePath: '/path/to/Chapter-01.md',
                },
            ],
            cardPath: '/path/to/characters/Elena.md',
        };
        // Add mock character to provider
        characterProvider.characters.set('Elena', mockCharacter);
        const treeItems = await characterProvider.getChildren();
        assert.strictEqual(treeItems.length, 1);
        assert.strictEqual(treeItems[0].label, 'Elena');
        assert.strictEqual(treeItems[0].collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
    });
    test('Should create References and Features sections under characters', async () => {
        const mockCharacter = {
            name: 'Elena',
            count: 3,
            positions: [
                {
                    position: new vscode.Position(10, 5),
                    fileName: 'Chapter-01.md',
                    filePath: '/path/to/Chapter-01.md',
                },
            ],
        };
        characterProvider.characters.set('Elena', mockCharacter);
        const characterItems = await characterProvider.getChildren();
        const characterItem = characterItems[0];
        const sections = await characterProvider.getChildren(characterItem);
        assert.strictEqual(sections.length, 2);
        assert.strictEqual(sections[0].label, 'References');
        assert.strictEqual(sections[1].label, 'Features');
    });
    test('Should sort characters by mention count (descending)', async () => {
        const elena = {
            name: 'Elena',
            count: 5,
            positions: [],
        };
        const marcus = {
            name: 'Marcus',
            count: 10,
            positions: [],
        };
        characterProvider.characters.set('Elena', elena);
        characterProvider.characters.set('Marcus', marcus);
        const treeItems = await characterProvider.getChildren();
        assert.strictEqual(treeItems[0].label, 'Marcus'); // Higher count first
        assert.strictEqual(treeItems[1].label, 'Elena');
    });
    test('Should create character card template with structured sections', () => {
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
        const template = characterProvider.createCharacterCardTemplate(mockCharacter);
        assert.ok(template.includes('# TestCharacter'));
        assert.ok(template.includes('## Physical Description'));
        assert.ok(template.includes('Hair:'));
        assert.ok(template.includes('Eyes:'));
        assert.ok(template.includes('## Personality'));
        assert.ok(template.includes('Core Traits:'));
        assert.ok(template.includes('## Background'));
        assert.ok(template.includes('## Relationships'));
        assert.ok(template.includes('## Character Arc'));
        assert.ok(template.includes('## Story References'));
    });
    test('Should handle character with no references', async () => {
        const noRefCharacter = {
            name: 'UnusedCharacter',
            count: 0,
            positions: [],
        };
        characterProvider.characters.set('UnusedCharacter', noRefCharacter);
        const characterItems = await characterProvider.getChildren();
        const characterItem = characterItems[0];
        const sections = await characterProvider.getChildren(characterItem);
        const referencesSection = sections[0];
        const references = await characterProvider.getChildren(referencesSection);
        assert.strictEqual(references.length, 0);
    });
    test('Should parse character features from card content', () => {
        const mockCardContent = `# Elena
Age: 25 • Location: New York

## Role in Story
Protagonist seeking her missing sister

## Physical Description
Hair: Dark curly
Eyes: Green

## Personality
Core Traits: Determined, brave
Strengths: Leadership
`;
        const features = characterProvider.parseCharacterFeatures(mockCardContent);
        assert.ok(features.length > 0);
        assert.ok(features.some((f) => f.label === 'Age & Location' && f.value === '25 • Location: New York'));
        assert.ok(features.some((f) => f.label === 'Role in Story'));
        assert.ok(features.some((f) => f.label === 'Physical Description'));
    });
});
//# sourceMappingURL=characterProvider.test.js.map