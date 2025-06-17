# WriterDown Development Guide

## Running the Extension

### Method 1: Debug Mode (Recommended for Development)

1. Open the project in VS Code
2. Press `F5` or go to Run → Start Debugging
3. This opens a new VS Code window with the extension loaded
4. Open your writing project in the new window

### Method 2: Install as VSIX Package

1. Build the extension: `npm run build`
2. Install the generated `.vsix` file:
   - Command Palette → "Extensions: Install from VSIX..."
   - Select the `writerdown-0.0.1.vsix` file
3. Reload VS Code

### Method 3: Development Install

```bash
# Link the extension for development
npm install -g vsce
vsce package
code --install-extension writerdown-0.0.1.vsix
```

## Troubleshooting

### "There is no data provider registered" Error

This usually happens when the extension isn't properly loaded. Try:

1. **Reload VS Code Window**: `Ctrl+Shift+P` → "Developer: Reload Window"
2. **Check Extension is Active**: Look for WriterDown in the activity bar (book icon)
3. **Run Debug Command**: `Ctrl+Shift+P` → "WriterDown: Debug Structure Provider"
4. **Check Console**: Help → Toggle Developer Tools → Console tab

### Character Tree Issues

- **Double-click not working**: Make sure you're double-clicking the character name, not the expand arrow
- **Categories not showing**: Ensure character cards have YAML frontmatter with `category` field
- **No characters detected**: Check that you're using `@CharacterName` syntax in your markdown files

### Structure Tree Issues

- **No structure showing**: Ensure you have a `Book/` folder with `.md` files
- **Files not detected**: Check that files contain markdown headers (`# Title`, `## Chapter`, etc.)
- **Nested folders not working**: Verify folder structure follows the pattern `Book/Act I/Chapter 1.md`

## File Structure Requirements

```
your-project/
├── Book/                          # Required: All story content goes here
│   ├── Chapter-01.md             # Direct chapters
│   ├── Act I - The Beginning/    # Nested structure supported
│   │   ├── Chapter 1.md
│   │   └── Chapter 2.md
│   └── Act II/
│       └── Chapter 3.md
├── .characters/                   # Auto-generated character cards
│   ├── Elena.md
│   ├── Marcus.md
│   └── Thane.md
└── other-files.md                # Other files (ignored by structure)
```

## Character Card YAML Format

```yaml
---
name: CharacterName
category: Protagonists              # Groups characters in tree
role: Main Character               # Character's story role
importance: major                  # major | minor | supporting
faction: Rebels                    # Character's allegiance
location: Capital City             # Primary location
status: active                     # active | inactive | deceased
tags: [brave, intelligent, loyal] # Flexible tags
---

# CharacterName
Age: 25 • Location: Capital City

## Role in Story
Character's role and importance...
```

## WriterDown Syntax

```markdown
# Chapter Title

Regular paragraph text.

"Dialogue is automatically detected," she said.

@CharacterName mentions create character cards automatically.

{{TODO: Tasks for the writer}}
{{RESEARCH: Research items}}
{{EDIT: Editing notes}}

[[General notes about the story]]

[PLOT: Plot development notes]

**_ SCENE 1: Scene markers _**

### Writer's Notes

These sections are excluded from word count.
```

## Commands Available

- `WriterDown: Set Language to WriterDown` - Apply syntax highlighting
- `WriterDown: Format Novel (Clean Up)` - Clean up formatting
- `WriterDown: Remove Problematic Indentation` - Fix dialogue indentation issues
- `WriterDown: Export with Novel Formatting` - Export with proper novel formatting
- `WriterDown: Debug Structure Provider` - Debug structure issues
- `WriterDown: Run Tests` - Run extension tests

## Development Commands

```bash
# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Build extension package
npm run build

# Run tests (integrated into VS Code)
# Use "WriterDown: Run Tests" command in VS Code
```

## Extension Features

### ✅ Implemented

- Custom WriterDown syntax highlighting
- Character detection and auto-card creation
- Character categorization with YAML metadata
- Story structure navigation (Acts/Chapters/Sections)
- Writer task tracking (TODO/RESEARCH/EDIT)
- Word and page counting with novel-specific exclusions
- Novel formatting and export (dialogue indentation fix)
- Character autocomplete and "Go to Definition"
- Hierarchical tree views for all content

### 🚧 Future Enhancements

- Pandoc integration for advanced export formats
- Character relationship mapping
- Plot timeline tracking
- Writing goal tracking and statistics
- Collaboration features
- Advanced search and filtering
