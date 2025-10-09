# Testing Git Flow Next Extension

## Quick Test Steps

### 1. Launch Extension Development Host
- Press `F5` in Cursor
- A new window opens (Extension Development Host)

### 2. Test Commands
In the new window, press `Cmd+Shift+P` and try:

1. **"Git Flow Next: Initialize Git Flow"**
   - Choose "Classic" preset
   - Should create main and develop branches

2. **"Git Flow Next: Feature: Start"**
   - Enter name like "test-feature"
   - Should create feature/test-feature branch

3. **"Git Flow Next: Show Overview"**
   - Should display git-flow configuration

4. **"Git Flow Next: Feature: List"**
   - Should show available features

### 3. Test Shorthand Commands
- Switch to a feature branch
- Try "Git Flow Next: Finish Current Branch"
- Should automatically detect branch type and finish it

### 4. Verify Git Flow Next CLI Integration
In terminal, run:
```bash
git flow overview
git flow feature list
```

## Expected Results
- All commands should work without errors
- Git Flow Next CLI should be called correctly
- Branch operations should work as expected
- Error handling should show user-friendly messages
