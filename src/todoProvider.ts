import * as path from 'path';
import * as vscode from 'vscode';

export interface TodoInfo {
  task: string;
  line: number;
  position: vscode.Position;
  type: string; // Changed from 'TODO' | 'RESEARCH' | 'EDIT' to string for dynamic types
  fileName: string;
  filePath: string;
}

export interface TaskReference {
  task: string;
  fileName: string;
  line: number;
  position: vscode.Position;
  filePath: string;
}

export class TodoTreeItem extends vscode.TreeItem {
  constructor(
    public readonly todoInfo: TodoInfo,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemType: 'taskType' | 'task' = 'task',
    public readonly taskReference?: TaskReference,
  ) {
    super(todoInfo.task, collapsibleState);

    if (itemType === 'taskType') {
      // This is a task type section (TODO, RESEARCH, EDIT, CUSTOM, etc.)
      this.label = todoInfo.type;
      this.tooltip = `${todoInfo.type} tasks`;
      this.contextValue = 'taskType';
      this.description = `${todoInfo.line} tasks`; // Using line field to store count

      // Icons for different task types - use defaults for custom types
      this.iconPath = this.getIconForTaskType(todoInfo.type);
    } else {
      // This is an individual task
      const fileName = path.basename(todoInfo.fileName, '.md');
      this.label = `${fileName}:${todoInfo.line + 1} - ${todoInfo.task}`;
      this.tooltip = `${todoInfo.type}: ${todoInfo.task} (${fileName}:${todoInfo.line + 1})`;
      this.description = '';
      this.contextValue = 'task';

      // Icon based on task type
      this.iconPath = this.getIconForTaskType(todoInfo.type, false);

      this.command = {
        command: 'writerdown.goToTask',
        title: 'Go to Task',
        arguments: [todoInfo],
      };
    }
  }

  private getIconForTaskType(type: string, isSection: boolean = true): vscode.ThemeIcon {
    const upperType = type.toUpperCase();

    if (isSection) {
      // Icons for task type sections
      switch (upperType) {
        case 'TODO':
          return new vscode.ThemeIcon('check');
        case 'RESEARCH':
          return new vscode.ThemeIcon('search');
        case 'EDIT':
          return new vscode.ThemeIcon('edit');
        case 'DEADLINE':
          return new vscode.ThemeIcon('clock');
        case 'REVIEW':
          return new vscode.ThemeIcon('eye');
        case 'FIX':
          return new vscode.ThemeIcon('tools');
        case 'IDEA':
          return new vscode.ThemeIcon('lightbulb');
        case 'NOTE':
          return new vscode.ThemeIcon('note');
        default:
          return new vscode.ThemeIcon('tag'); // Generic icon for custom types
      }
    } else {
      // Icons for individual tasks
      switch (upperType) {
        case 'TODO':
          return new vscode.ThemeIcon('circle');
        case 'RESEARCH':
          return new vscode.ThemeIcon('book');
        case 'EDIT':
          return new vscode.ThemeIcon('pencil');
        case 'DEADLINE':
          return new vscode.ThemeIcon('watch');
        case 'REVIEW':
          return new vscode.ThemeIcon('preview');
        case 'FIX':
          return new vscode.ThemeIcon('wrench');
        case 'IDEA':
          return new vscode.ThemeIcon('light-bulb');
        case 'NOTE':
          return new vscode.ThemeIcon('comment');
        default:
          return new vscode.ThemeIcon('dot-fill'); // Generic icon for custom types
      }
    }
  }
}

export class TodoProvider implements vscode.TreeDataProvider<TodoTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TodoTreeItem | undefined | null | void> = new vscode.EventEmitter<
    TodoTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData: vscode.Event<TodoTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private todos: TodoInfo[] = [];

  constructor() {
    // Don't auto-refresh in constructor
  }

  async refresh(): Promise<void> {
    await this.scanForTodos();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TodoTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TodoTreeItem): Thenable<TodoTreeItem[]> {
    if (!element) {
      // Root level - show task type sections
      const taskTypes = this.getTaskTypeSections();
      return Promise.resolve(taskTypes);
    } else if (element.itemType === 'taskType') {
      // Task type level - show individual tasks of this type
      const tasksOfType = this.todos
        .filter((todo) => todo.type === element.todoInfo.type)
        .sort((a, b) => {
          const fileCompare = a.fileName.localeCompare(b.fileName);
          if (fileCompare !== 0) return fileCompare;
          return a.line - b.line;
        })
        .map((todo) => new TodoTreeItem(todo, vscode.TreeItemCollapsibleState.None, 'task'));

      return Promise.resolve(tasksOfType);
    }

    return Promise.resolve([]);
  }

  private getTaskTypeSections(): TodoTreeItem[] {
    const taskTypeCounts: { [key: string]: number } = {};

    // Count tasks by type (dynamic types)
    this.todos.forEach((todo) => {
      taskTypeCounts[todo.type] = (taskTypeCounts[todo.type] || 0) + 1;
    });

    // Create sections for task types that have tasks
    const sections: TodoTreeItem[] = [];

    // Sort task types alphabetically, but keep TODO, RESEARCH, EDIT at the top
    const priorityTypes = ['TODO', 'RESEARCH', 'EDIT'];
    const sortedTypes = Object.keys(taskTypeCounts).sort((a, b) => {
      const aPriority = priorityTypes.indexOf(a);
      const bPriority = priorityTypes.indexOf(b);

      if (aPriority !== -1 && bPriority !== -1) {
        return aPriority - bPriority;
      } else if (aPriority !== -1) {
        return -1;
      } else if (bPriority !== -1) {
        return 1;
      } else {
        return a.localeCompare(b);
      }
    });

    sortedTypes.forEach((type) => {
      const count = taskTypeCounts[type];
      if (count > 0) {
        const sectionInfo: TodoInfo = {
          task: type,
          line: count, // Store count in line field
          position: new vscode.Position(0, 0),
          type: type,
          fileName: '',
          filePath: '',
        };

        sections.push(new TodoTreeItem(sectionInfo, vscode.TreeItemCollapsibleState.Expanded, 'taskType'));
      }
    });

    return sections;
  }

  private async scanForTodos(): Promise<void> {
    this.todos = []; // Clear existing data

    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      console.log('No workspace folders found for todo scanning');
      return;
    }

    try {
      // Find all markdown files in the workspace, excluding character cards
      const files = await vscode.workspace.findFiles('**/*.md', '{**/node_modules/**,**/characters/**}');
      console.log(`Scanning ${files.length} files for todos (excluding character cards)`);

      for (const file of files) {
        await this.scanFile(file);
      }

      // Sort by file name, then by line number
      this.todos.sort((a, b) => {
        const fileCompare = a.fileName.localeCompare(b.fileName);
        if (fileCompare !== 0) return fileCompare;
        return a.line - b.line;
      });

      console.log(`Found ${this.todos.length} todos`);
    } catch (error) {
      console.error('Error scanning for todos:', error);
    }
  }

  private async scanFile(fileUri: vscode.Uri): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(fileUri);
      const text = document.getText();
      const fileName = path.basename(fileUri.fsPath);

      // Dynamic regex to find {TYPE: content} patterns
      const todoRegex = /\{([A-Z_]+):\s*([^}]+)\}/g;

      let match;
      while ((match = todoRegex.exec(text)) !== null) {
        const taskType = match[1].trim();
        const taskContent = match[2].trim();
        const position = document.positionAt(match.index);

        this.todos.push({
          task: taskContent,
          line: position.line,
          position: position,
          type: taskType,
          fileName: fileName,
          filePath: fileUri.fsPath,
        });
      }
    } catch (error) {
      console.error('Error scanning file for todos:', fileUri.fsPath, error);
    }
  }

  getAllTodos(): TodoInfo[] {
    return this.todos;
  }
}
