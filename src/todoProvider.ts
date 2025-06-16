import * as path from 'path';
import * as vscode from 'vscode';

export interface TodoInfo {
  task: string;
  line: number;
  position: vscode.Position;
  type: 'TODO' | 'RESEARCH' | 'EDIT';
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
      // This is a task type section (TODO, RESEARCH, EDIT)
      this.label = todoInfo.type;
      this.tooltip = `${todoInfo.type} tasks`;
      this.contextValue = 'taskType';
      this.description = `${todoInfo.line} tasks`; // Using line field to store count

      // Different icons for different task types
      switch (todoInfo.type) {
        case 'TODO':
          this.iconPath = new vscode.ThemeIcon('check');
          break;
        case 'RESEARCH':
          this.iconPath = new vscode.ThemeIcon('search');
          break;
        case 'EDIT':
          this.iconPath = new vscode.ThemeIcon('edit');
          break;
      }
    } else {
      // This is an individual task
      const fileName = path.basename(todoInfo.fileName, '.md');
      this.label = `${fileName}:${todoInfo.line + 1} - ${todoInfo.task}`;
      this.tooltip = `${todoInfo.type}: ${todoInfo.task} (${fileName}:${todoInfo.line + 1})`;
      this.description = '';
      this.contextValue = 'task';

      // Icon based on task type
      switch (todoInfo.type) {
        case 'TODO':
          this.iconPath = new vscode.ThemeIcon('circle');
          break;
        case 'RESEARCH':
          this.iconPath = new vscode.ThemeIcon('book');
          break;
        case 'EDIT':
          this.iconPath = new vscode.ThemeIcon('pencil');
          break;
      }

      this.command = {
        command: 'writerdown.goToTask',
        title: 'Go to Task',
        arguments: [todoInfo],
      };
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
    const taskTypeCounts = {
      TODO: 0,
      RESEARCH: 0,
      EDIT: 0,
    };

    // Count tasks by type
    this.todos.forEach((todo) => {
      taskTypeCounts[todo.type]++;
    });

    // Create sections for task types that have tasks
    const sections: TodoTreeItem[] = [];

    Object.entries(taskTypeCounts).forEach(([type, count]) => {
      if (count > 0) {
        const sectionInfo: TodoInfo = {
          task: type,
          line: count, // Store count in line field
          position: new vscode.Position(0, 0),
          type: type as 'TODO' | 'RESEARCH' | 'EDIT',
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

      // Regex to find {{TODO: ...}}, {{RESEARCH: ...}}, {{EDIT: ...}}
      const todoPatterns = [
        { regex: /\{\{TODO:\s*([^}]+)\}\}/g, type: 'TODO' as const },
        { regex: /\{\{RESEARCH:\s*([^}]+)\}\}/g, type: 'RESEARCH' as const },
        { regex: /\{\{EDIT:\s*([^}]+)\}\}/g, type: 'EDIT' as const },
      ];

      todoPatterns.forEach((pattern) => {
        let match;
        while ((match = pattern.regex.exec(text)) !== null) {
          const task = match[1].trim();
          const position = document.positionAt(match.index);

          this.todos.push({
            task: task,
            line: position.line,
            position: position,
            type: pattern.type,
            fileName: fileName,
            filePath: fileUri.fsPath,
          });
        }
      });
    } catch (error) {
      console.error('Error scanning file for todos:', fileUri.fsPath, error);
    }
  }

  getAllTodos(): TodoInfo[] {
    return this.todos;
  }
}
