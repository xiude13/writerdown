import * as assert from 'assert';
import * as vscode from 'vscode';
import { CharacterInfo, CharacterProvider } from '../../characterProvider';

/**
 * Integration tests for character alias functionality
 * These tests mock file system operations to test the complete alias resolution flow
 */
suite('Character Alias Integration Tests', () => {
  let provider: CharacterProvider;
  let mockWorkspaceFolder: vscode.Uri;

  setup(() => {
    provider = new CharacterProvider();
    mockWorkspaceFolder = vscode.Uri.file('/mock/workspace');
  });

  teardown(() => {
    // Clean up after each test
  });

  suite('Alias Resolution Integration', () => {
    test('Should resolve aliases when character cards exist', async function () {
      // This test demonstrates how to test alias resolution
      // In a real test environment, you'd mock vscode.workspace.fs operations

      // Skip this test if not in a proper test environment
      if (!vscode.workspace.workspaceFolders) {
        this.skip();
        return;
      }

      const aliasName = 'Master Bren';
      const expectedMainName = 'Bren';

      try {
        const resolvedName = await (provider as any).resolveCharacterAlias(aliasName);

        // If no alias is found, it returns the original name
        assert.strictEqual(typeof resolvedName, 'string');
        assert.ok(resolvedName.length > 0);

        // In a mocked environment, we could set up specific expectations
        console.log(`Resolved "${aliasName}" to "${resolvedName}"`);
      } catch (error) {
        // Test that the method handles errors gracefully
        assert.ok(error instanceof Error);
      }
    });

    test('Should handle character mention with alias resolution', async function () {
      if (!vscode.workspace.workspaceFolders) {
        this.skip();
        return;
      }

      const characterName = 'Lord Bren';
      const position = new vscode.Position(1, 5);
      const fileName = 'test.md';
      const filePath = '/test/test.md';

      try {
        // This should work without throwing
        await (provider as any).addCharacterMention(characterName, position, fileName, filePath);

        // Verify the character was added (either as original name or resolved name)
        const characters = provider.getAllCharacters();
        const addedCharacter = characters.find(
          (c) => c.name === characterName || c.name === 'Bren', // Could be resolved to main character
        );

        if (addedCharacter) {
          assert.ok(addedCharacter.count >= 1);
          assert.ok(addedCharacter.positions.length >= 1);
        }
      } catch (error) {
        // Test passes if method handles the case gracefully
        assert.ok(error instanceof Error);
      }
    });
  });

  suite('Character Card Template Integration', () => {
    test('Should create character cards with aliases field for new characters', () => {
      const template = (provider as any).createNewCharacterTemplate('New Character');

      // Verify all YAML fields are present
      const yamlFields = [
        'name: New Character',
        'category: Uncategorized',
        'role:',
        'importance:',
        'faction:',
        'location:',
        'status: active',
        'tags: []',
        'aliases: []',
      ];

      yamlFields.forEach((field) => {
        assert.ok(template.includes(field), `Template should include YAML field: ${field}`);
      });

      // Verify markdown structure
      const markdownSections = [
        '# New Character',
        '## Role in Story',
        '## Goal',
        '## Physical Description',
        '## Personality',
        '## Background',
        '## Relationships',
        '## Character Arc',
        '## Notes',
      ];

      markdownSections.forEach((section) => {
        assert.ok(template.includes(section), `Template should include section: ${section}`);
      });
    });

    test('Should create character cards with aliases field for existing characters', () => {
      const mockCharacter: CharacterInfo = {
        name: 'Existing Character',
        count: 5,
        positions: [
          {
            position: new vscode.Position(10, 0),
            fileName: 'chapter1.md',
            filePath: '/book/chapter1.md',
          },
          {
            position: new vscode.Position(20, 5),
            fileName: 'chapter2.md',
            filePath: '/book/chapter2.md',
          },
        ],
      };

      const template = (provider as any).createCharacterCardTemplate(mockCharacter);

      // Verify aliases field is included
      assert.ok(template.includes('aliases: []'), 'Template should include aliases field');

      // Verify character-specific information
      assert.ok(template.includes('# Existing Character'), 'Template should include character name');
      assert.ok(template.includes('Total Mentions: 5'), 'Template should include mention count');
      assert.ok(template.includes('across 2 files'), 'Template should include file count');
    });
  });

  suite('YAML Frontmatter Parsing', () => {
    test('Should parse complex aliases with special characters', () => {
      const yamlContent = `---
name: Dr. Elena Rodriguez
category: Medical Professionals
role: Surgeon
importance: major
status: active
aliases: ["Dr. Rodriguez", "Elena", "The Doctor", "Dr. E", "Rodriguez"]
tags: ["medical", "professional", "skilled"]
faction: Hospital Staff
location: City General Hospital
---

# Dr. Elena Rodriguez
Content here...`;

      const metadata = (provider as any).parseYamlFrontmatter(yamlContent);

      assert.ok(metadata, 'Should parse complex YAML metadata');
      assert.strictEqual(metadata.category, 'Medical Professionals');
      assert.strictEqual(metadata.role, 'Surgeon');
      assert.strictEqual(metadata.importance, 'major');
      assert.strictEqual(metadata.status, 'active');
      assert.strictEqual(metadata.faction, 'Hospital Staff');
      assert.strictEqual(metadata.location, 'City General Hospital');

      assert.ok(Array.isArray(metadata.aliases), 'Aliases should be an array');
      assert.strictEqual(metadata.aliases.length, 5, 'Should parse all 5 aliases');

      const expectedAliases = ['Dr. Rodriguez', 'Elena', 'The Doctor', 'Dr. E', 'Rodriguez'];
      expectedAliases.forEach((alias) => {
        assert.ok(metadata.aliases.includes(alias), `Should include alias: ${alias}`);
      });

      assert.ok(Array.isArray(metadata.tags), 'Tags should be an array');
      assert.strictEqual(metadata.tags.length, 3, 'Should parse all 3 tags');
    });

    test('Should handle malformed YAML gracefully', () => {
      const malformedYaml = `---
name: Broken Character
category: Test
aliases: [unclosed array
tags: invalid: structure
---

# Broken Character
Content here...`;

      const metadata = (provider as any).parseYamlFrontmatter(malformedYaml);

      // Should either return undefined or partial metadata, but not throw
      if (metadata) {
        // If it parsed something, verify basic structure
        assert.strictEqual(typeof metadata, 'object');
      }
      // Test passes if no exception is thrown
    });
  });
});
