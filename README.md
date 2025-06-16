# WriterDown VS Code Extension

**The Complete Writing Suite for VS Code** - Transform your Markdown files into a professional writing environment with project management, character tracking, and intelligent word counting.

![WriterDown Extension](https://img.shields.io/badge/VS%20Code-WriterDown-blue)

## 🚀 Features Overview

WriterDown transforms VS Code into a complete writing IDE with:
- **📊 Smart Status Bar** - Real-time word count and page estimation
- **📚 Story Structure Management** - Multi-file project organization  
- **👥 Character Tracking** - Automatic character cards and mentions
- **✅ Writer Task Management** - TODO, RESEARCH, and EDIT tracking
- **🎨 Enhanced Syntax Highlighting** - Writer-specific markup and dialogue
- **🔍 Intelligent Navigation** - Jump to characters, scenes, tasks instantly

---

## 📊 Status Bar Features

### Real-Time Word Counter
- **📖 X words** - Intelligent word counting that excludes WriterDown syntax
- Excludes: Writer's Notes, character mentions syntax, plot notes, scene markers
- Includes: Actual story content, dialogue, character names
- **Click for details**: Characters, characters (no spaces), file name

### Page Estimation
- **📄 X pages** - Professional page count based on 250 words/page standard
- Industry-standard calculation for book publishing
- Both exact (decimal) and rounded estimates
- **Click for details**: Exact pages, calculation method

---

## 🗂️ Three-Panel Sidebar

Access via the **📚 WriterDown** icon in the Activity Bar.

### 📖 Story Structure
- **Hierarchical Organization**: Acts → Chapters → Sections
- **New Chapter Button**: Auto-creates `Chapter-XX.md` with templates
- **Smart Detection**: Recognizes markdown headers across files
- **Quick Navigation**: Click any structure item to jump to location
- **Template Generation**: Each new chapter includes Writer's Notes section

### 👥 Characters Panel
- **Automatic Detection**: Finds all `@CharacterName` mentions
- **Smart Sorting**: Most mentioned characters first
- **Character Cards**: Auto-generated detailed character profiles
- **Dual Actions**: 
  - Click to open character card
  - Right-click → Go to first mention
- **Character Archiving**: Inactive characters automatically prefixed with `_`

### ✅ Writer Tasks
- **Task Categories**: TODO, RESEARCH, EDIT items
- **Hierarchical View**: Tasks grouped by type
- **Quick Navigation**: Click any task to jump to location
- **Cross-File Tracking**: Tasks tracked across entire project

---

## 👥 Advanced Character Management

### Automatic Character Cards
```markdown
# Elena
Age: • Location: 

## Role in Story

## Physical Description
Hair: Eyes: Body Type: Height: ...

## Personality
Core Traits: Strengths: Weaknesses: ...

## Background
Occupation: Education: Family: ...

## Character Arc
Starting Point: Character Growth: ...

## Story References
- Chapter 1: The Journey Begins.md:7
- Chapter 2: Into the Unknown.md:15

*Total Mentions: 23 across 2 files*
```

### Character Intelligence Features
- **Go to Definition (F12)**: Press F12 on `@Character` to open their card
- **Smart Autocomplete**: Type `@` to see character suggestions with previews
- **Live Updates**: Character cards update automatically with new mentions
- **Rich Previews**: Autocomplete shows character card content

---

## 🎨 WriterDown Syntax

### Character References
```markdown
@Elena walked into the room where @Marcus was waiting.
```
- **Smart Highlighting**: Character names stand out
- **Auto-completion**: Type `@` for character suggestions
- **Navigation**: F12 to jump to character card

### Writer Annotations
```markdown
[[This is a general note that won't appear in final text]]
{{TODO: Add more character development here}}
{{RESEARCH: Historical accuracy of this scene}}
{{EDIT: Make this dialogue more natural}}
```

### Scene Structure
```markdown
*** SCENE 1: The Meeting ***
[PLOT: This scene establishes the relationship between Elena and Marcus]
```

### Dialogue Highlighting
```markdown
"Hello there," she said with a warm smile.
"I've been expecting you," @Marcus replied.
```
- **Distinct Colors**: Quotes and content use different colors
- **Italic Styling**: Dialogue stands out from narrative text

### Writer's Notes (Excluded from Word Count)
```markdown
### Writer's Notes
- Character focus: @Elena's internal conflict
- Key events: The revelation about @Marcus
- Setting: Medieval village atmosphere
- Mood/Tone: Building tension

{{TODO: Review this section for pacing}}
```

---

## 🛠️ Professional Writing Tools

### Multi-File Project Management
- **Workspace-wide scanning** of all `.md` files
- **Real-time updates** when files change
- **Cross-file character tracking** and task management
- **Automatic file watching** for live updates

### Smart Text Processing
- **Intelligent word counting** excludes meta-content
- **Writer's Notes exclusion** from counters
- **Clean text extraction** for accurate statistics
- **Professional page estimation** using industry standards

### Template Generation
New chapters include professional structure:
```markdown
# Chapter Title

{{TODO: Start writing this chapter}}

Write your chapter content here...

---

### Writer's Notes
- Character focus: 
- Key events: 
- Setting: 
- Mood/Tone: 

{{TODO: Review and edit this chapter}}
```

---

## 🔧 Installation & Setup

### Quick Start
1. **Install**: Search "WriterDown" in VS Code Extensions
2. **Open**: Any `.md` file in your writing project
3. **Activate**: VS Code will prompt to use WriterDown syntax
4. **Explore**: Click the 📚 WriterDown icon in the sidebar

### Manual Setup
1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run "Set Language to WriterDown"
3. The extension automatically detects and manages your writing project

---

## 📋 Usage Examples

### Complete Writing Project Structure
```
my-novel/
├── Chapter-01.md          # Auto-numbered chapters
├── Chapter-02.md
├── Chapter-03.md
└── characters/           # Auto-generated character cards
    ├── Elena.md         # Active character
    ├── Marcus.md        # Active character
    └── _OldCharacter.md # Archived character
```

### Sample Chapter Content
```markdown
# Chapter 1: The Beginning

@Elena stood at the crossroads. [[She represents choice/change]]

"Which path do we take?" she asked @Marcus.

{{TODO: Add more description of the landscape}}

*** SCENE 2: The Decision ***

[PLOT: This is where Elena chooses her destiny]

The ancient map showed three routes. {{RESEARCH: Medieval map accuracy}}

---

### Writer's Notes
- Character focus: Elena's growth from uncertainty to leadership
- Key events: The choice that changes everything
- Setting: Mystical crossroads with ancient significance
- Themes: Destiny vs. free will

{{EDIT: Strengthen the magical atmosphere}}
```

---

## 🎯 Perfect For

- **📖 Novel Writers**: Multi-chapter book projects with character tracking
- **✍️ Short Story Authors**: Organized story development with task management  
- **📝 Screenwriters**: Character-driven narratives with scene structure
- **📚 Content Creators**: Long-form content with professional word counting
- **🎭 Game Writers**: Character-heavy narratives with branching storylines

---

## 🚀 Advanced Features

### Testing & Development
- Built-in test suite with `WriterDown: Run Tests` command
- Comprehensive validation of all features
- Development-friendly with TypeScript support

### Performance
- **Debounced updates** prevent performance issues
- **Smart caching** for large projects
- **Optimized file watching** for real-time updates

### Customization
- Professional syntax highlighting with theme support
- Configurable word-per-page calculations
- Flexible Writer's Notes section detection

---

## 📈 Why WriterDown?

**Before WriterDown**: Basic Markdown with manual character tracking, no word counts, scattered notes across files.

**With WriterDown**: Professional writing environment with automated character management, intelligent word counting, structured project organization, and real-time progress tracking.

Transform your writing workflow from chaotic to professional with WriterDown's comprehensive suite of authoring tools.

---

## 🐛 Support & Development

### Feedback
Found a bug or have a feature request? We'd love to hear from you!

### Development
```bash
git clone [repository]
npm install
npm run compile
# Press F5 to test in Extension Development Host
```

---

**Happy Writing! 📚✨**

*WriterDown - Where stories come to life with professional tools.* 