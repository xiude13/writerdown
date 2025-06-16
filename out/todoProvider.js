"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TodoProvider = exports.TodoTreeItem = void 0;
const path = require("path");
const vscode = require("vscode");
class TodoTreeItem extends vscode.TreeItem {
    constructor(todoInfo, collapsibleState, itemType = 'task', taskReference) {
        super(todoInfo.task, collapsibleState);
        this.todoInfo = todoInfo;
        this.collapsibleState = collapsibleState;
        this.itemType = itemType;
        this.taskReference = taskReference;
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
        }
        else {
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
exports.TodoTreeItem = TodoTreeItem;
class TodoProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.todos = [];
        // Don't auto-refresh in constructor
    }
    async refresh() {
        await this.scanForTodos();
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            // Root level - show task type sections
            const taskTypes = this.getTaskTypeSections();
            return Promise.resolve(taskTypes);
        }
        else if (element.itemType === 'taskType') {
            // Task type level - show individual tasks of this type
            const tasksOfType = this.todos
                .filter((todo) => todo.type === element.todoInfo.type)
                .sort((a, b) => {
                const fileCompare = a.fileName.localeCompare(b.fileName);
                if (fileCompare !== 0)
                    return fileCompare;
                return a.line - b.line;
            })
                .map((todo) => new TodoTreeItem(todo, vscode.TreeItemCollapsibleState.None, 'task'));
            return Promise.resolve(tasksOfType);
        }
        return Promise.resolve([]);
    }
    getTaskTypeSections() {
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
        const sections = [];
        Object.entries(taskTypeCounts).forEach(([type, count]) => {
            if (count > 0) {
                const sectionInfo = {
                    task: type,
                    line: count,
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
    async scanForTodos() {
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
                if (fileCompare !== 0)
                    return fileCompare;
                return a.line - b.line;
            });
            console.log(`Found ${this.todos.length} todos`);
        }
        catch (error) {
            console.error('Error scanning for todos:', error);
        }
    }
    async scanFile(fileUri) {
        try {
            const document = await vscode.workspace.openTextDocument(fileUri);
            const text = document.getText();
            const fileName = path.basename(fileUri.fsPath);
            // Regex to find {{TODO: ...}}, {{RESEARCH: ...}}, {{EDIT: ...}}
            const todoPatterns = [
                { regex: /\{\{TODO:\s*([^}]+)\}\}/g, type: 'TODO' },
                { regex: /\{\{RESEARCH:\s*([^}]+)\}\}/g, type: 'RESEARCH' },
                { regex: /\{\{EDIT:\s*([^}]+)\}\}/g, type: 'EDIT' },
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
        }
        catch (error) {
            console.error('Error scanning file for todos:', fileUri.fsPath, error);
        }
    }
    getAllTodos() {
        return this.todos;
    }
}
exports.TodoProvider = TodoProvider;
//# sourceMappingURL=todoProvider.js.map