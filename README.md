# WriterDown VS Code Extension

Transform VS Code into a professional writing environment for novelists and storytellers.

![WriterDown Extension](https://img.shields.io/badge/VS%20Code-WriterDown-blue)

## Key Features

- **Smart Word Counter** - Real-time word count excluding markup syntax
- **Project Totals** - Track total words, pages, and chapters across your entire project
- **Story Structure** - Navigate chapters with metadata-driven titles and decimal numbering
- **Character Tracking** - Auto-detect `@Character` mentions with intelligent cards
- **Story Markers** - Categorize plot points, character moments, and notes
- **Writer Tasks** - Track TODO, RESEARCH, and EDIT items
- **Enhanced Syntax** - Dialogue highlighting and writer-specific markup
- **Novel Export** - Professional manuscript formatting
- **Configurable Page Counting** - Customize words per page for different formats

## Quick Start

1. Install WriterDown from VS Code Extensions
2. Open any `.md` file in your writing project
3. **Activate WriterDown syntax** (choose one):
   - Click the language selector in bottom-right corner → select "WriterDown"
   - Or use Command Palette (`Ctrl+Shift+P`) → "WriterDown: Set Language to WriterDown"
4. Put your chapters and parts in the `Book/` folder
5. Click the **📚 WriterDown** icon in the sidebar
6. Start writing with `@Character` mentions and story markers

> **💡 Tip**: To make WriterDown the default for all `.md` files, add this to your VS Code settings:
>
> ```json
> "files.associations": {
>   "*.md": "writerdown"
> }
> ```

## Chapter Organization

### Metadata-Driven Chapters

Use YAML frontmatter to organize your chapters:

```yaml
---
chapter: 5.2
title: 'The Forest Encounter'
status: draft
---
# The Forest Encounter

Your chapter content here...
```

- **Decimal Numbering**: Use chapter numbers like `1`, `5.1`, `5.3.2` to split long chapters
- **Metadata Titles**: Chapter titles come from YAML `title` field, not filenames
- **Smart Sorting**: Chapters sort correctly (5.2 comes before 5.10)
- **Display Format**: Shows as `5.2 - The Forest Encounter` in structure panel

### File Organization

```
your-project/
├── Book/                    # All story content goes here
│   ├── Chapter-1.md        # Any filename works
│   ├── Chapter-5-1.md      # Metadata determines display
│   └── Part2/
│       └── Chapter-10.md
├── Characters/             # Character cards (optional)
└── Notes/                  # Research, outlines, etc.
```

## Writing Syntax

### Characters

```markdown
@Elena walked into the room where @[Lady Catherine] was waiting.
@[Lord Halven] greeted @Marcus at the door.
```

- **Smart Tracking**: Automatically detects characters in `Book/` folder (focused on story content)
- **Intellisense**: Type `@` to get autocomplete suggestions with character previews
- **Global Renaming**: Character rename operations work across all markdown files
- **Bracket Support**: Use `@[Character Name]` for multi-word character names

### Story Markers

```markdown
#! [EVENT] Elena discovers the ancient map (appears in Story Structure)
#! [BATTLE] First skirmish with bandits
#! [CHARACTER] Marcus reveals his secret
#! [PLOT] Major revelation about the villain
#! Important note to remember (uncategorized → Notes)
```

**Available Categories**: EVENT, ACTION, PLOT, CHARACTER, BATTLE, ROMANCE, MYSTERY, or create your own!

- **EVENT markers** appear in Story Structure as part of chapter flow
- **Other markers** appear in Story Markers panel, organized by category

### Writer Tasks

```markdown
{TODO: Add more character development}
{RESEARCH: Historical accuracy needed}
{EDIT: Fix pacing in this section}
{DEADLINE: Finish chapter by Friday}
{REVIEW: Check dialogue consistency}
{CUSTOM: Your own task type}
```

**Dynamic Task Types**: Create any task type you want! Use `{TYPE: description}` format where TYPE can be any uppercase word (TODO, RESEARCH, EDIT, DEADLINE, REVIEW, FIX, IDEA, NOTE, CUSTOM, etc.)

## Sidebar Panels

Access via the **WriterDown** activity bar icon:

- **Story Structure** - Chapter navigation with metadata titles, word counts, and EVENT markers
- **Story Markers** - Categorized plot points (BATTLE, CHARACTER, PLOT, etc.)
- **Characters** - Auto-generated character cards (tracks `Book/` folder)
- **Writer Tasks** - TODO/RESEARCH/EDIT tracking

## Status Bar & Project Totals

### Individual File Tracking

- **X words** - Smart word counting (excludes markup)
- **X pages** - Configurable page estimation

### Project-Wide Tracking

- **📖 12,345 words • 49 pages** - Total project statistics
- **Project Summary** - First item in Story Structure panel

Click any status bar item for detailed breakdowns.

## Configuration

### Words Per Page Setting

Customize page count estimation in VS Code settings:

```json
{
  "writerdown.wordsPerPage": 250
}
```

**Popular Standards**:

- **250** - Traditional manuscript format (default)
- **300** - Paperback novel format
- **400** - Academic/technical writing

Access via: Settings → Extensions → WriterDown → Words Per Page

## Keyboard Shortcuts

- **Alt + Down** - Focus next WriterDown panel (when in sidebar)
- **Alt + Up** - Focus previous WriterDown panel (when in sidebar)

Panel order: Story Structure → Story Markers → Characters → Writer Tasks

## Perfect For

- **Novel Writers** - Multi-chapter projects with character arcs
- **Short Story Authors** - Organized development workflow
- **Content Creators** - Long-form narrative content
- **Academic Writers** - Structured document organization

## Installation

Search "WriterDown" in VS Code Extensions or install from the marketplace.

## Troubleshooting

### Extension Not Working?

1. **Activate WriterDown**: Click language selector (bottom-right) → "WriterDown"
2. **Reload Window**: `Ctrl+Shift+P` → "Developer: Reload Window"
3. **Check Console**: Help → Toggle Developer Tools → Console tab

### No Characters/Structure Showing?

- Ensure files are in `Book/` folder with `.md` extension
- Use `@Character` syntax for character detection
- Add YAML frontmatter with `chapter` and `title` fields

### Project Totals Not Updating?

- Save your files (project totals update on save)
- Refresh panels using the refresh button in each panel

---

**Happy Writing!**

_Transform your markdown files into a professional writing studio._
