# Change Log

All notable changes to the "Git Flow Next" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-10-24

### Added
- Initial release of Git Flow Next VS Code Extension
- Complete git-flow-next command integration
- Smart branch detection and context-aware commands
- Interactive UI for all git flow operations
- Support for feature, release, hotfix, support, and bugfix branches
- Shorthand commands for common workflows (finish, delete, update, rename, rebase, publish)
- Configurable merge strategies (merge, rebase, squash)
- Configurable update strategies (merge, rebase)
- Auto-update before finish option
- Customizable start points for branch types
- Fast-forward control options
- Branch retention options (keep, delete, keep-local, keep-remote)
- Tag creation with configurable prefixes and GPG signing
- Remote configuration support
- Context-aware command palette (commands only show when applicable)
- Git Flow initialization wizard
- Comprehensive configuration through VS Code settings
- Conflict resolution support (continue/abort operations)
- Git Flow overview and config commands

### Security
- Updated esbuild to v0.25.10+ to address security vulnerability
- Added .env to .gitignore to prevent accidental secret exposure
