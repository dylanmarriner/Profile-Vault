# Contributing to Profile Vault

Thank you for your interest in contributing! This guide will help you get started.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Git
- VSCode/Windsurf (recommended)

### Development Setup

```bash
# Fork and Clone
git clone https://github.com/YOUR_USERNAME/profile-vault.git
cd profile-vault
```

1. **Install Dependencies**

```bash
npm install
```

1. **Setup Pre-commit Hooks**

```bash
npm run prepare
```

1. **Run Initial Build**

```bash
npm run build
```

## 📁 Project Structure

```text
profile-vault/
├── packages/
│   ├── extension/          # VSCode/Windsurf extension
│   │   ├── src/
│   │   │   ├── core/      # Core functionality
│   │   │   └── ui/        # UI components
│   │   ├── test/          # Tests
│   │   └── resources/     # Icons, assets
│   └── mcp-server/        # MCP server
│       ├── src/
│       └── test/
├── docs/                  # Documentation
├── scripts/               # Build/utility scripts
└── .github/               # Workflows, templates
```

## 🏗️ Development Workflow

### 1. Create a Branch

```bash
# Feature branch
git checkout -b feature/your-feature-name

# Bug fix branch
git checkout -b fix/issue-number-description
```

### 2. Make Changes

- Follow existing code style (ESLint + Prettier)
- Write tests for new functionality
- Update documentation as needed

### 3. Run Tests & Checks

```bash
# Lint code
npm run lint

# Run type checking
npm run type-check

# Run all tests
npm run test

# Build packages
npm run build
```

### 4. Commit Changes

We use [conventional commits](https://www.conventionalcommits.org/):

```bash
# Feature
git commit -m "feat: add profile export functionality"

# Bug fix
git commit -m "fix: resolve path traversal issue"

# Documentation
git commit -m "docs: update API reference"

# Breaking change
git commit -m "feat!: redesign profile storage format"
```

### 5. Submit Pull Request

- Push to your fork
- Open PR against `main` branch
- Fill out PR template completely
- Wait for CI checks to pass
- Address review feedback

## 🧪 Testing

### Test Structure

```text
packages/
├── extension/
│   └── test/
│       ├── unit/         # Unit tests
│       ├── integration/  # Integration tests
│       └── e2e/         # End-to-end tests
└── mcp-server/
    └── test/
        ├── unit/
        └── integration/
```

### Writing Tests

```typescript
// unit/example.test.ts
import { myFunction } from '../src/myFunction';

describe('myFunction', () => {
  it('should return expected result', () => {
    expect(myFunction(input)).toEqual(expectedOutput);
  });
});
```

### Running Tests

```bash
# All tests
npm run test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Specific package
npm run test --workspace=packages/extension
```

## 📝 Code Style

### ESLint + Prettier

- Configuration in `.eslintrc.js` and `.prettierrc`
- Auto-formats on commit (pre-commit hook)
- VSCode extension recommended for IDE integration

### TypeScript Guidelines

- Use strict mode
- Prefer explicit types
- Avoid `any` type
- Use JSDoc for public APIs

### Naming Conventions

```typescript
// Files: kebab-case
profile-manager.ts
crypto-utils.ts

// Classes: PascalCase
class ProfileManager {}

// Functions/Variables: camelCase
const profileStore = new ProfileStore();
function captureProfile() {}

// Constants: UPPER_SNAKE_CASE
const MAX_PROFILE_SIZE = 1024 * 1024 * 10; // 10MB

// Interfaces: PascalCase with 'I' prefix
interface IProfileManifest {}
```

## 🐛 Bug Reports

### Before Creating Bug Report

1. Check existing issues
2. Try latest version
3. Reproduce in clean environment

### Bug Report Template

```markdown
## Bug Description
Brief description of the issue

## Steps to Reproduce
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

## Expected Behavior
What you expected to happen

## Actual Behavior
What actually happened

## Environment
- OS: [e.g. Windows 11, macOS 13.0, Ubuntu 22.04]
- IDE: [e.g. VSCode 1.84, Windsurf 1.0]
- Extension Version: [e.g. 0.2.0]

## Additional Context
Add any other context about the problem here
```

## 💡 Feature Requests

### Feature Request Process

1. Open issue with "Feature Request" label
2. Describe use case clearly
3. Provide mockups if UI-related
4. Team will triage and prioritize

### Feature Request Template

```markdown
## Feature Description
Clear description of the feature

## Problem Statement
What problem does this solve?

## Proposed Solution
How should it work?

## Alternatives Considered
Other approaches you thought about

## Additional Context
Any other relevant information
```

## 🔐 Security

### Security Vulnerabilities

- Do NOT open public issues
- Email: `security@profile-vault.dev`
- We'll respond within 48 hours

### Security Guidelines

- Validate all inputs
- Use secure defaults
- Follow principle of least privilege
- Document security decisions

## 📚 Documentation

### Types of Documentation

1. **User Documentation** (in `/docs`)
   - Getting started guides
   - How-to articles
   - Tutorials

2. **Developer Documentation**
   - API reference
   - Architecture guides
   - Contributing guide (this file)

3. **Code Documentation**
   - JSDoc comments
   - README in packages
   - Inline comments

### Writing Documentation

- Use clear, simple language
- Include code examples
- Add screenshots for UI features
- Update table of contents

## 🚀 Release Process

Releases are automated using semantic-release:

1. Commits are analyzed on merge
2. Version is bumped automatically
3. Changelog is generated
4. Release is created and published

### Release Types

- `feat:` - Feature (minor version)
- `fix:` - Bug fix (patch version)
- `BREAKING CHANGE:` - Breaking change (major version)

## 🤝 Code Review

### Reviewer Guidelines

1. Check functionality works as intended
2. Verify tests are adequate
3. Ensure code follows style guide
4. Check for security issues
5. Verify documentation is updated

### Author Guidelines

1. Keep PRs focused and small
2. Address all review comments
3. Update tests and documentation
4. Respond to reviews promptly

## 📞 Getting Help

- 📖 [Documentation](./docs)
- 💬 [GitHub Discussions](https://github.com/profile-vault/profile-vault/discussions)
- 🐛 [Issue Tracker](https://github.com/profile-vault/profile-vault/issues)
- 📧 [Email](mailto:dev@profile-vault.dev)

## 🏆 Recognition

Contributors are recognized in:

- README.md contributors section
- Release notes
- Annual community post

Thank you for contributing to Profile Vault! 🎉
