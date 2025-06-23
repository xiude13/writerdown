# VS Code Extension Testing Guide

## Overview

This guide covers the correct way to write tests for VS Code extensions, including unit tests, integration tests, and end-to-end tests.

## Test Structure

```
src/test/
├── runTest.ts           # Test runner entry point
├── suite/
│   ├── index.ts         # Mocha test suite setup
│   ├── extension.test.ts        # Integration tests
│   ├── characterProvider.test.ts # Unit tests for providers
│   └── structureProvider.test.ts # More unit tests
└── basicTests.ts        # Manual test functions (existing)
```

## Types of Tests

### 1. Unit Tests

Test individual classes and functions in isolation.

```typescript
import * as assert from 'assert';
import { CharacterProvider } from '../../characterProvider';

suite('CharacterProvider Tests', () => {
  let provider: CharacterProvider;

  setup(() => {
    provider = new CharacterProvider();
  });

  test('Should initialize correctly', () => {
    const characters = provider.getAllCharacters();
    assert.strictEqual(characters.length, 0);
  });
});
```

### 2. Integration Tests

Test how components work together within VS Code.

```typescript
suite('Extension Integration Tests', () => {
  test('Extension should activate', async () => {
    const extension = vscode.extensions.getExtension('writerdown.writerdown');
    await extension?.activate();
    assert.ok(extension?.isActive);
  });
});
```

### 3. End-to-End Tests

Test complete user workflows.

```typescript
test('Should detect character mentions in files', async () => {
  // Create test file
  const testContent = '@Elena walked into the room.';
  await vscode.workspace.fs.writeFile(testUri, Buffer.from(testContent));

  // Trigger refresh
  await vscode.commands.executeCommand('writerdown.refreshCharacters');

  // Verify results
  // ... assertions
});
```

## Running Tests

### Command Line

```bash
npm test                 # Run all tests
npm run test-compile     # Compile tests only
npm run pretest         # Compile and lint
```

### VS Code

1. **F5** - Run Extension (for manual testing)
2. **Debug: Extension Tests** - Run automated tests with debugger
3. **Command Palette** → "Test: Run All Tests"

### CI/CD

```bash
# In GitHub Actions or similar
npm ci
npm run test
```

## Test Best Practices

### 1. **Proper Setup/Teardown**

```typescript
suite('My Tests', () => {
  let provider: MyProvider;

  setup(() => {
    // Initialize before each test
    provider = new MyProvider();
  });

  teardown(() => {
    // Clean up after each test
    provider.dispose?.();
  });
});
```

### 2. **Async Test Handling**

```typescript
test('Async operation', async function () {
  this.timeout(5000); // Set timeout for long operations

  const result = await someAsyncFunction();
  assert.ok(result);
});
```

### 3. **File System Testing**

```typescript
test('File operations', async () => {
  const testUri = vscode.Uri.joinPath(workspaceUri, 'test.md');

  try {
    await vscode.workspace.fs.writeFile(testUri, Buffer.from('content'));
    // ... test logic
  } finally {
    // Always clean up
    await vscode.workspace.fs.delete(testUri);
  }
});
```

### 4. **Mock External Dependencies**

```typescript
// For testing without real VS Code APIs
const mockWorkspace = {
  findFiles: () => Promise.resolve([]),
  openTextDocument: () => Promise.resolve(mockDocument),
};
```

### 5. **Test Categories**

```typescript
// Skip tests conditionally
test('Integration test', function () {
  if (!vscode.workspace.workspaceFolders) {
    this.skip(); // Skip if no workspace
  }
  // ... test logic
});
```

## Common Patterns

### Testing Tree Data Providers

```typescript
test('Tree provider returns correct items', async () => {
  await provider.refresh();
  const children = await provider.getChildren();

  assert.ok(Array.isArray(children));
  assert.strictEqual(children.length, expectedCount);
});
```

### Testing Commands

```typescript
test('Command executes correctly', async () => {
  const result = await vscode.commands.executeCommand('writerdown.myCommand');
  assert.ok(result);
});
```

### Testing File Parsing

```typescript
test('Parse markdown correctly', () => {
  const content = '# Header\n@Character mention';
  const result = parser.parseContent(content);

  assert.strictEqual(result.headers.length, 1);
  assert.strictEqual(result.characters.length, 1);
});
```

## Debugging Tests

### 1. **Use VS Code Debugger**

- Set breakpoints in test files
- Run "Extension Tests" launch configuration
- Step through code execution

### 2. **Console Logging**

```typescript
test('Debug test', () => {
  console.log('Debug info:', someVariable);
  // Tests run in VS Code's output channel
});
```

### 3. **Test Isolation**

```typescript
// Run single test
test.only('This test only', () => {
  // Only this test will run
});

// Skip test
test.skip('Skip this test', () => {
  // This test will be skipped
});
```

## Performance Testing

```typescript
test('Performance test', async function () {
  this.timeout(10000);

  const start = Date.now();
  await expensiveOperation();
  const duration = Date.now() - start;

  assert.ok(duration < 1000, 'Should complete within 1 second');
});
```

## Error Testing

```typescript
test('Should handle errors gracefully', async () => {
  try {
    await functionThatShouldThrow();
    assert.fail('Should have thrown an error');
  } catch (error) {
    assert.ok(error instanceof ExpectedErrorType);
  }
});
```

## Continuous Integration

Example GitHub Actions workflow:

```yaml
name: Test Extension
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm ci
      - run: xvfb-run -a npm test
        if: runner.os == 'Linux'
      - run: npm test
        if: runner.os != 'Linux'
```

## Tips for WriterDown Extension

### Test Character Detection

```typescript
test('Detects @Character mentions', async () => {
  const content = '@Elena and @[John Smith] talked.';
  // Test character scanning logic
});
```

### Test Category Organization

```typescript
test('Organizes characters by category', async () => {
  // Test category folder structure
});
```

### Test File Movement

```typescript
test('Moves files when category changes', async () => {
  // Test automatic file reorganization
});
```

This testing setup provides comprehensive coverage for your VS Code extension while following best practices for maintainability and reliability.
