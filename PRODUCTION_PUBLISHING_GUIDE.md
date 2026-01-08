# 🚀 StressMaster Production Publishing Guide

Complete guide to publishing StressMaster to npm as a production-ready package.

## 📋 Pre-Publishing Checklist

### 1. ✅ Update Package Metadata

**Update `package.json` repository URLs:**

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/mumzworld-tech/StressMaster.git"
  },
  "bugs": {
    "url": "https://github.com/mumzworld-tech/StressMaster/issues"
  },
  "homepage": "https://github.com/mumzworld-tech/StressMaster#readme"
}
```

### 2. ✅ Create/Update CHANGELOG.md

Create a `CHANGELOG.md` file documenting all changes:

```markdown
# Changelog

All notable changes to StressMaster will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2024-12-02

### Added

- Unified `.stressmaster/` directory for all generated files
- Automatic `.gitignore` management
- Interactive setup wizard (`stressmaster setup`)
- Improved module resolution for npm packages
- Support for localhost API testing

### Fixed

- Module resolution issues when installed as npm package
- File path resolution in linked packages
- K6 executor script generation and results parsing

### Changed

- Consolidated all documentation into single README.md
- Improved error handling and logging
- Enhanced file autocomplete in interactive CLI

## [Unreleased]

### Planned

- Additional test types
- Enhanced reporting features
```

### 3. ✅ Verify .npmignore

Your `.npmignore` file is already configured correctly. It excludes:

- Source files (only `dist/` is included)
- Development files (tests, scripts, configs)
- Documentation except README.md
- Generated files

### 4. ✅ NPM Account Setup (For Company/Organization)

**Since this is an open-source project owned by mumzworld-tech:**

1. **Create npm organization (if not exists):**
   - Go to: https://www.npmjs.com/org/create
   - Organization name: `mumzworld` (or your company's npm org name)
   - Choose "Free" plan (perfect for open-source)
   - Add team members who need publish access

2. **Login with your account (must be org member):**
   ```bash
   npm login
   npm whoami  # Verify you're logged in
   npm org ls mumzworld  # Verify org access
   ```

3. **Verify package name availability:**
   - Check if `stressmaster` is available: https://www.npmjs.com/package/stressmaster
   - If taken, consider: `@mumzworld/stressmaster` (scoped package)
   
4. **For scoped packages, update package.json:**
   ```json
   {
     "name": "@mumzworld/stressmaster",
     "publishConfig": {
       "access": "public"
     }
   }
   ```
   
   **Note**: `publishConfig.access: "public"` is required for open-source scoped packages!

### 5. ✅ GitHub Secrets Configuration

Set up GitHub Actions secrets for automated publishing:

1. **Generate npm token (for organization):**

   **Option A: Personal token (if you're org member):**
   - Go to: https://www.npmjs.com/settings/[your-username]/tokens
   - Create new "Automation" token
   - Token will have org permissions if you're a member
   - Copy the token
   
   **Option B: Organization token:**
   - Go to: https://www.npmjs.com/settings/mumzworld/tokens
   - Create new "Automation" token
   - Copy the token
   
   **Note**: Either token type works, but personal token is easier if you're already an org member.

2. **Add to GitHub repository:**
   - Go to: `https://github.com/mumzworld-tech/StressMaster/settings/secrets/actions`
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: [paste your npm token]

### 6. ✅ Final Build Verification

Run comprehensive checks:

```bash
# Clean build
npm run build:clean

# Type checking
npm run typecheck

# Linting
npm run lint

# Tests (skip if many are failing, but fix critical ones)
npm run test

# Security audit
npm audit --audit-level=moderate

# Verify what will be published
npm pack --dry-run
```

Review the output of `npm pack --dry-run` to ensure only necessary files are included.

### 7. ✅ Test Local Package

Test the package locally before publishing:

```bash
# Build
npm run build:clean

# Create tarball
npm pack

# Test installation in a clean directory
mkdir /tmp/stressmaster-test
cd /tmp/stressmaster-test
npm init -y
npm install /path/to/StressMaster/stressmaster-1.0.3.tgz

# Test the CLI
npx stressmaster --help
```

## 📦 Publishing Steps

### Option 1: Automated Publishing (Recommended)

Uses GitHub Actions to automatically publish when you push a version tag.

**Step 1: Update version in package.json**

```bash
# Patch version (1.0.3 -> 1.0.4)
npm version patch

# Minor version (1.0.3 -> 1.1.0)
npm version minor

# Major version (1.0.3 -> 2.0.0)
npm version major
```

**Step 2: Update CHANGELOG.md**
Document what changed in this version.

**Step 3: Commit and push**

```bash
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: release v1.0.4"
git push origin master
```

**Step 4: Create and push tag**

```bash
# Tag was created by npm version command
git push origin --tags
```

**Step 5: GitHub Actions will automatically:**

- Run validation checks
- Build the package
- Publish to npm
- Create GitHub release

**Step 6: Verify**

- Check npm: https://www.npmjs.com/package/stressmaster
- Check GitHub releases: https://github.com/mumzworld-tech/StressMaster/releases

### Option 2: Manual Publishing

Publish directly from your local machine:

```bash
# 1. Clean build
npm run build:clean

# 2. Run pre-publish checks
npm run typecheck
npm run lint
npm audit

# 3. Verify package contents
npm pack --dry-run

# 4. Login to npm (if not already)
npm login

# 5. Publish
npm publish

# For scoped packages (@mumzworld/stressmaster), publish as public:
# npm publish --access public
# OR if publishConfig.access is set in package.json:
# npm publish
```

### Option 3: Using Release Script

Use the provided release script:

```bash
# Make script executable
chmod +x scripts/release.sh

# Run release (patch, minor, or major)
./scripts/release.sh patch
```

## 🔧 Post-Publishing Steps

### 1. Verify Installation

Test installation from npm:

```bash
# Test global installation
npm install -g stressmaster@latest
stressmaster --help

# Test in a new project
mkdir test-project && cd test-project
npm init -y
npm install stressmaster
npx stressmaster --help
```

### 2. Update Documentation

- [ ] Verify README.md installation instructions work
- [ ] Check that all examples are accurate
- [ ] Update any version-specific documentation

### 3. Announce Release

- [ ] Create release notes on GitHub
- [ ] Share on relevant communities/platforms
- [ ] Update any external documentation

### 4. Monitor

- [ ] Check npm download stats: https://www.npmjs.com/package/stressmaster
- [ ] Monitor GitHub issues for user feedback
- [ ] Watch for bug reports or issues

## 🚨 Troubleshooting

### Package name already taken

If `stressmaster` is taken, use a scoped package:

```json
{
  "name": "@mumzworld/stressmaster",
  "publishConfig": {
    "access": "public"
  }
}
```

Then publish with:

```bash
npm publish --access public
```

### GitHub Actions fails

1. Check Actions tab for error logs
2. Verify `NPM_TOKEN` secret is set correctly
3. Ensure you're pushing tags correctly
4. Check that workflows are enabled in repository settings

### Module resolution issues

If users report module resolution issues:

1. Verify `files` field in package.json includes all necessary files
2. Check that `.npmignore` isn't excluding required files
3. Test installation in a clean environment

### Version conflicts

If version already exists:

```bash
# Update version manually
npm version patch  # or minor/major
```

## 📝 Package.json Publishing Fields Reference

Key fields for npm publishing:

```json
{
  "name": "stressmaster",              // Package name
  "version": "1.0.3",                   // Current version
  "description": "...",                 // Short description
  "main": "dist/index.js",             // Entry point
  "types": "dist/index.d.ts",          // TypeScript definitions
  "bin": {                              // CLI commands
    "stressmaster": "./dist/cli.js",
    "sm": "./dist/cli.js"
  },
  "files": [                            // Files to include (optional)
    "dist",
    "README.md",
    "LICENSE"
  ],
  "keywords": [...],                    // Search keywords
  "repository": {...},                  // GitHub repo
  "engines": {                          // Node version requirements
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  },
  "publishConfig": {                    // Scoped packages only
    "access": "public"
  }
}
```

## 🎯 Quick Publishing Checklist

Before publishing, ensure:

- [ ] Package name is available/updated
- [ ] Version number is correct
- [ ] Repository URLs are correct
- [ ] README.md is up-to-date
- [ ] CHANGELOG.md is updated
- [ ] LICENSE file exists
- [ ] Build succeeds (`npm run build:clean`)
- [ ] Tests pass (critical ones at least)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] `.npmignore` is configured correctly
- [ ] `npm pack --dry-run` shows correct files
- [ ] NPM account is logged in
- [ ] GitHub Actions secrets are configured (for automated publishing)
- [ ] Tested locally as linked package

## 🔗 Useful Links

- **npm Package Page**: https://www.npmjs.com/package/stressmaster
- **npm Publishing Guide**: https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry
- **Semantic Versioning**: https://semver.org/
- **Keep a Changelog**: https://keepachangelog.com/

---

**Ready to publish?** Follow the steps above and you'll have StressMaster on npm in no time! 🚀
