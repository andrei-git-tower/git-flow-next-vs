const { defineConfig } = require('@vscode/test-cli');

module.exports = defineConfig({
  files: 'out/test/**/*.test.js',
  version: 'stable',
  workspaceFolder: '/Users/andreibaloleanu/helpwise',
  mocha: {
    ui: 'tdd',
    timeout: 30000,
    color: true,
    slow: 10000
  }
});
