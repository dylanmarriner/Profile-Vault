# Profile Vault

[![CI](https://github.com/profile-vault/profile-vault/workflows/CI/badge.svg)](https://github.com/profile-vault/profile-vault/actions)
[![codecov](https://codecov.io/gh/profile-vault/profile-vault/branch/main/graph/badge.svg)](https://codecov.io/gh/profile-vault/profile-vault)
[![Security Rating](https://github.com/profile-vault/profile-vault/workflows/Security/badge.svg)](https://github.com/profile-vault/profile-vault/actions?query=workflow%3ASecurity)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/profile-vault.svg)](https://badge.fury.io/js/profile-vault)

> Cross-IDE profile management for Windsurf, Antigravity, and VSCode

Profile Vault enables you to capture, apply, and share IDE configurations across multiple environments and editors. Perfect for maintaining consistent development setups across teams and machines.

## ✨ Features

- 🔐 **Secure Profile Capture**: Encrypts sensitive data with configurable redaction patterns
- 🔄 **Cross-IDE Support**: Works with Windsurf, Antigravity, and VSCode
- 📦 **Export/Import**: Share profiles as `.pvault` files with optional encryption
- 🔍 **Profile Diffing**: Compare profiles to identify configuration differences
- 🌳 **MCP Server**: Programmatic access via Model Context Protocol
- 🎯 **Zero Configuration**: Works out of the box with sensible defaults

## 🚀 Quick Start

### Install Extension

1. **From VSIX** (recommended):

   ```bash
   # Download the latest .vsix from Releases
   code --install-extension profile-vault.vsix
   ```

2. **From Marketplace**:

   - Search "Profile Vault" in your IDE's extension marketplace
   - Click Install

### Basic Usage

```bash
# Capture current profile
Ctrl+Shift+P → "Profile Vault: Capture Profile"

# Apply a saved profile
Ctrl+Shift+P → "Profile Vault: Apply Profile"

# Export for sharing
Ctrl+Shift+P → "Profile Vault: Export Profile"
```

### MCP Server

```bash
cd packages/mcp-server
npm install
npm start

# Server listens on stdio for MCP protocol
```

## 📖 Documentation

### [User Guide](./docs/guide.md)

- Installation and setup
- Capturing profiles
- Applying profiles
- Export/import workflows
- Security configuration

### [API Reference](./docs/api.md)

- Extension API
- MCP Server API
- Configuration options

### [Architecture](./docs/architecture.md)

- System design
- Security model
- Extension points

## 🏗️ Architecture

```ascii
┌─────────────────┐     ┌─────────────────┐
│   Extension     │     │   MCP Server    │
│  (VSCode/Windsurf)    │                 │
├─────────────────┤     ├─────────────────┤
│ • UI Components │     │ • Profile API   │
│ • Commands      │◄────┤ • Auth Layer    │
│ • Tree Provider │     │ • Storage       │
├─────────────────┤     ├─────────────────┤
│ • Collector     │     │ • REST/HTTP     │
│ • Applier       │     │ • WebSocket     │
│ • Crypto        │     │ • Stdio         │
└─────────────────┘     └─────────────────┘
         │                       │
         └───────────────────────┘
                    │
         ┌─────────────────┐
         │  Local Storage  │
         │ • Encrypted     │
         │ • Versioned     │
         │ • Compressed    │
         └─────────────────┘
```

## 🛠️ Development

### Prerequisites

- Node.js 18+
- npm 9+
- Git

### Setup

```bash
# Clone repository
git clone https://github.com/profile-vault/profile-vault.git
cd profile-vault

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm run test

```text
# Start development
npm run dev:extension  # Extension development
npm run dev:mcp       # MCP server development
```

### Project Structure

```text
profile-vault/
├── packages/
│   ├── extension/      # VSCode/Windsurf extension
│   └── mcp-server/     # MCP server
├── docs/               # Documentation
├── scripts/            # Build scripts
└── .github/            # Workflows & templates
```

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Run specific package
npm run test --workspace=packages/extension

# E2E tests
npm run test:e2e
```

## 📦 Building & Packaging

```bash
# Build all packages
npm run build

# Package extension
npm run package

# Create release
npm run release
```

## 🔒 Security

Profile Vault takes security seriously:

- **Local Encryption**: AES-256-GCM for stored profiles
- **Secret Redaction**: Configurable patterns for sensitive data
- **Path Traversal Protection**: Validates all file paths
- **Minimal Permissions**: Requests only necessary permissions
- **Audit Trail**: Logs all profile operations

See [SECURITY.md](./SECURITY.md) for detailed security information.

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guide](./CONTRIBUTING.md) for details.

### Quick Contribution Checklist

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit with conventional commits (`git commit -m 'feat: add amazing feature'`)
4. Push to your branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🆘 Support

- 📖 [Documentation](./docs)
- 🐛 [Issue Tracker](https://github.com/profile-vault/profile-vault/issues)
- 💬 [Discussions](https://github.com/profile-vault/profile-vault/discussions)
- 📧 [Email Support](mailto:support@profile-vault.dev)

## 🙏 Acknowledgments

- VSCode Extension API
- Model Context Protocol
- All contributors and users

---

Made with ❤️ by the Profile Vault team
