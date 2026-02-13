# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.2.x   | ✅ Current         |
| 0.1.x   | ❌ End of Life     |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### **Do NOT** open a public issue

Instead, please send an email to: **`security@profile-vault.dev`**

### What to Include

- Type of vulnerability (e.g., XSS, RCE, path traversal)
- Detailed description of the issue
- Steps to reproduce (if applicable)
- Potential impact
- Any proof-of-concept code or screenshots

### Response Timeline

- **Initial response**: Within 48 hours
- **Detailed assessment**: Within 7 days
- **Patch release**: Based on severity, typically within 14 days

### Security Team

- **Lead**: `security@profile-vault.dev`
- **Team**: `maintainers@profile-vault.dev`

## Security Features

Profile Vault implements multiple security measures:

### Data Protection

- **Encryption**: AES-256-GCM for local storage
- **Redaction**: Configurable patterns for sensitive data
- **Validation**: Input sanitization and path traversal protection

### Access Control

- **Minimal Permissions**: Requests only necessary IDE permissions
- **Local Storage**: Data never leaves your machine unless explicitly exported
- **MCP Auth**: Optional token-based authentication for server

### Audit Trail

- **Operation Logging**: All profile operations are logged
- **Error Tracking**: Detailed error messages without exposing secrets
- **Change Tracking**: Profile versioning and diff capabilities

## Security Best Practices

### For Users

1. **Review Redaction Patterns**

   ```json
   {
     "profileVault.security.redactionPatterns": [
       "(?i)api[_-]?key\\s*[:=]\\s*['\\\"]?[A-Za-z0-9_\\-]{16,}['\\\"]?",
       "(?i)secret\\s*[:=]\\s*['\\\"]?.{8,}['\\\"]?"
     ]
   }
   ```

2. **Enable Encryption**

   ```json
   {
     "profileVault.crypto.encryptLocalStore": true,
     "profileVault.crypto.encryptExports": true
   }
   ```

3. **Secure Exported Profiles**
   - Use strong passwords for encrypted exports
   - Store exported files securely
   - Review content before sharing

4. **Regular Updates**
   - Keep extension updated
   - Review changelog for security fixes

### For Developers

1. **Input Validation**

   ```typescript
   function validatePath(path: string): boolean {
     const normalized = path.normalize(path);
     return !normalized.includes('..');
   }
   ```

2. **Secret Handling**

   ```typescript
   // Never log secrets
   console.log('Processing profile:', profile.id); // 
   console.log('API Key:', profile.apiKey); // 
   ```

3. **Dependencies**
   - Regular security audits
   - Dependabot alerts
   - Minimal third-party dependencies

## Threat Model

### Assets to Protect

1. **IDE Configuration**
   - User settings and preferences
   - Workspace configurations
   - Installed extensions list

2. **Sensitive Data**
   - API keys and tokens
   - Database credentials
   - Personal information

### Potential Threats

1. **Data Exposure**
   - Unauthorized access to profiles
   - Leakage through logs
   - Insecure storage

2. **Code Injection**
   - Malicious profile imports
   - Path traversal attacks
   - Command injection

3. **Man-in-the-Middle**
   - Intercepted profile exports
   - Compromised MCP server

### Mitigations

| Threat        | Mitigation                             |
|---------------|----------------------------------------|
| Data Exposure | Encryption, redaction, local storage   |
| Code Injection| Input validation, sandboxing          |
| MITM          | HTTPS, signed releases, verification   |

## Security Audits

### Past Audits

- [Initial Audit](https://github.com/profile-vault/profile-vault/security/audits/2024-01) (2024-01): Found 3 issues, all fixed
- [Penetration Test](https://github.com/profile-vault/profile-vault/security/audits/2024-02) (2024-02): No critical vulnerabilities

### Future Audits

- Quarterly automated scans
- Annual manual penetration testing
- [Community Bug Bounty](https://github.com/profile-vault/profile-vault/security/bounty) (planned)

## Security Advisories

Security advisories are published on GitHub:

1. Go to [Security Advisories](https://github.com/profile-vault/profile-vault/security/advisories)
2. Subscribe to notifications
3. Review severity ratings

## Compliance

Profile Vault aims to comply with:

- **OWASP Top 10** - Web application security
- **CWE** - Common weakness enumeration
- **CVE** - Common vulnerabilities and exposures

## Security Changelog

### v0.2.0 (2024-02-14)

- ✅ Added input validation for file paths
- ✅ Improved secret redaction patterns
- ✅ Fixed potential XSS in profile display

### v0.1.0 (2024-01-01)

- 🚀 Initial release
- ✅ Basic encryption implemented
- ✅ Path traversal protection added

## Questions?

If you have security questions that don't qualify as vulnerabilities:

- 📧 Email: `security@profile-vault.dev`
- 💬 Private discussion: Create a draft security advisory

Thank you for helping keep Profile Vault secure! 🔒
