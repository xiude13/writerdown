# WriterDown VS Code Extension

Transform VS Code into a professional writing environment for novelists and storytellers.

![WriterDown Extension](https://img.shields.io/badge/VS%20Code-WriterDown-blue)

## Key Features

- **Smart Word Counter** - Real-time word count excluding markup syntax
- **Story Structure** - Navigate chapters, acts, and sections across files
- **Character Tracking** - Auto-detect `@Character` mentions with intelligent cards
- **Story Markers** - Categorize plot points, character moments, and notes
- **Writer Tasks** - Track TODO, RESEARCH, and EDIT items
- **Enhanced Syntax** - Dialogue highlighting and writer-specific markup
- **Novel Export** - Professional manuscript formatting

## Quick Start

1. Install WriterDown from VS Code Extensions
2. Open any `.md` file in your writing project
3. Put your chapters and parts in the `Book/` folder
4. Click the **WriterDown** icon in the sidebar
5. Start writing with `@Character` mentions and story markers

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

- **Story Structure** - Chapter navigation with word counts and EVENT markers
- **Story Markers** - Categorized plot points (BATTLE, CHARACTER, PLOT, etc.)
- **Characters** - Auto-generated character cards (tracks `Book/` folder)
- **Writer Tasks** - TODO/RESEARCH/EDIT tracking

## Status Bar

- **X words** - Smart word counting (excludes markup)
- **X pages** - Industry-standard page estimation (250 words/page)

Click for detailed breakdowns.

## Perfect For

- **Novel Writers** - Multi-chapter projects with character arcs
- **Short Story Authors** - Organized development workflow
- **Content Creators** - Long-form narrative content

## Installation

Search "WriterDown" in VS Code Extensions or install from the marketplace.

---

**Happy Writing!**

_Transform your markdown files into a professional writing studio._
