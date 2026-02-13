# Maintainer Playbook

This playbook contains standard operating procedures (SOPs) for Profile Vault maintainers.

## Table of Contents

- [Triage SOP](#triage-sop)
- [PR Review SOP](#pr-review-sop)
- [Release SOP](#release-sop)
- [Incident Response](#incident-response)
- [Security Response](#security-response)
- [On-Call Schedule](#on-call-schedule)

## Triage SOP

### Issue Intake

1. **New Issue Notification**
   - All maintainers receive notifications for new issues
   - Primary on-call maintainer performs initial triage within 24 hours

2. **Initial Assessment**
   - Check for duplicates using GitHub search
   - Verify issue contains required information:
     - Clear description
     - Steps to reproduce
     - Environment details (OS, IDE version, extension version)
     - Error logs/screenshots if applicable
   - Apply appropriate labels:
     - `bug`, `feature`, `question`, `documentation`
     - `priority: critical`, `priority: high`, `priority: medium`, `priority: low`
     - `area: extension`, `area: mcp-server`, `area: documentation`
     - `status: needs-triage`, `status: needs-info`, `status: confirmed`

3. **Priority Assignment**
   - **Critical**: Security vulnerabilities, data loss, extension crashes
   - **High**: Broken core functionality, performance issues
   - **Medium**: UI bugs, edge cases, documentation gaps
   - **Low**: Nice-to-have features, minor improvements

4. **SLAs**
   - Critical: Response within 4 hours, fix within 48 hours
   - High: Response within 24 hours, fix within 7 days
   - Medium: Response within 72 hours, fix within 14 days
   - Low: Response within 1 week, address in next release cycle

5. **Escalation**
   - If issue requires expertise beyond current maintainer:
     - @-mention relevant maintainer
     - Create discussion in team channel
     - Schedule meeting if complex

## PR Review SOP

### Pre-Review Checks

1. **Automated Checks**
   - CI must pass (tests, lint, build)
   - Coverage must not decrease significantly
   - SBOM generation must succeed

2. **Documentation**
   - README updated if user-facing changes
   - API documentation updated for public API changes
   - Changelog entry included (use conventional commits)

### Review Process

1. **Code Quality**
   - TypeScript strict compliance
   - No `any` types unless absolutely necessary
   - Proper error handling
   - Security considerations (input validation, secret handling)

2. **Functionality**
   - Changes match PR description
   - No breaking changes without proper version bump
   - Backward compatibility maintained
   - Performance impact assessed

3. **Testing**
   - Unit tests for new functionality
   - Integration tests for cross-component changes
   - E2E tests for user-facing features
   - Test coverage >80%

4. **Security Review**
   - Check for exposed secrets
   - Validate file operations
   - Review dependency changes
   - Assess permission requirements

### Approval Requirements

- Documentation changes: 1 maintainer approval
- Bug fixes: 1 maintainer approval
- New features: 2 maintainer approvals
- Breaking changes: 2 maintainer approvals + team discussion
- Security fixes: 2 maintainer approvals + security team review

## Release SOP

### Version Management

1. **Semantic Versioning**
   - MAJOR: Breaking changes
   - MINOR: New features (backward compatible)
   - PATCH: Bug fixes (backward compatible)

2. **Pre-Release Checklist**
   - All tests passing on main branch
   - Documentation updated
   - CHANGELOG.md updated
   - Security scan clean
   - Performance benchmarks run

### Release Process

1. **Create Release Branch**
   ```bash
   git checkout -b release/v0.x.x main
   ```

2. **Update Version Numbers**
   - Update package.json files
   - Update mkdocs.yml version
   - Commit changes

3. **Tag Release**
   ```bash
   git tag -a v0.x.x -m "Release v0.x.x"
   git push origin v0.x.x
   ```

4. **Automated Release**
   - GitHub Actions builds and publishes:
     - Extension to VSCode Marketplace
     - Extension to Open VSX Registry
     - NPM packages
     - GitHub Release with artifacts
     - Documentation to GitHub Pages
     - SBOMs attached to release

5. **Post-Release**
   - Verify all artifacts published
   - Check documentation deployment
   - Monitor for critical issues
   - Announce release

### Rollback Strategy

1. **Identify Issue**
   - Critical bug or security vulnerability
   - Affects >20% of users
   - No workaround available

2. **Rollback Steps**
   - Unpublish from marketplaces if possible
   - Create hotfix branch
   - Fix issue and test thoroughly
   - Release patch version (x.x.1)

## Incident Response

### Severity Levels

1. **SEV-0 (Critical)**
   - Service completely down
   - Data loss or security breach
   - Impact: All users

2. **SEV-1 (High)**
   - Major feature broken
   - Performance degradation
   - Impact: >50% users

3. **SEV-2 (Medium)**
   - Minor feature broken
   - UI issues
   - Impact: <50% users

4. **SEV-3 (Low)**
   - Documentation issues
   - Typos
   - Impact: Minimal

### Response Process

1. **Detection**
   - Monitor GitHub issues
   - Check CI/CD failures
   - Review error metrics

2. **Assessment**
   - Determine severity
   - Estimate impact
   - Identify root cause

3. **Communication**
   - SEV-0: Immediate announcement (within 1 hour)
   - SEV-1: Announcement within 4 hours
   - SEV-2: Announcement within 24 hours
   - SEV-3: Next release notes

4. **Resolution**
   - Implement fix
   - Test thoroughly
   - Deploy hotfix if needed
   - Verify resolution

5. **Post-Incident**
   - Write postmortem
   - Update procedures
   - Prevent recurrence

## Security Response

### Vulnerability Intake

1. **Private Reporting**
   - Email: security@profile-vault.dev
   - Create private security advisory
   - Acknowledge within 48 hours

2. **Assessment**
   - Verify vulnerability
   - Determine severity (CVSS score)
   - Identify affected versions

3. **Coordination**
   - Inform maintainers privately
   - Plan fix timeline
   - Coordinate with reporter if desired

### Disclosure Process

1. **Preparation**
   - Develop fix
   - Test thoroughly
   - Prepare security advisory

2. **Release**
   - Fix released first
   - Wait 7-14 days (based on severity)
   - Publish advisory

3. **Communication**
   - Security advisory on GitHub
   - Announcement in release notes
   - Social media if critical

## On-Call Schedule

### Rotation

- Weekly rotation
- Primary and secondary on-call
- Handover on Mondays

### Responsibilities

1. **Primary**
   - Issue triage
   - PR reviews
   - CI/CD monitoring
   - Incident response

2. **Secondary**
   - Backup for primary
   - Documentation updates
   - Performance monitoring

### Escalation

- Contact team lead for SEV-0
- Create GitHub issue for tracking
- Use team chat for urgent matters

## Tools and Access

### Required Access

- GitHub repository admin
- VSCode Marketplace publisher
- Open VSX Registry publisher
- NPM publish access
- Google Analytics (docs)

### Monitoring

- GitHub Actions workflows
- Codecov coverage
- Dependabot alerts
- Security advisories
- Error metrics

## Contact Information

- **Security**: security@profile-vault.dev
- **Support**: support@profile-vault.dev
- **Team Chat**: [Private channel]
- **Emergency**: [Phone number for SEV-0]

## Training

### New Maintainers

1. Read entire playbook
2. Shadow current maintainer for 1 week
3. Perform supervised triage
4. Review security procedures
5. Get required access

### Ongoing Training

- Quarterly security training
- Annual incident review
- Tool updates and best practices
- Community management guidelines
