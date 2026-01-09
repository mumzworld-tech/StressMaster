# 🚀 Quick Publishing Checklist

Use this checklist before publishing StressMaster to npm.

## ✅ Pre-Publish Steps

- [ ] **Update repository URLs in `package.json`** (Already done ✅)

  - Repository: `https://github.com/mumzworld-tech/StressMaster.git`
  - Bugs: `https://github.com/mumzworld-tech/StressMaster/issues`
  - Homepage: `https://github.com/mumzworld-tech/StressMaster#readme`

- [ ] **Create `CHANGELOG.md`** with version history

- [ ] **Verify `.npmignore` is correct** (Already configured ✅)

- [ ] **Set up npm authentication using `.npmrc`**:

  **Option A: Using .npmrc file (Recommended)**
  - Get npm token: https://www.npmjs.com/settings/[username]/tokens
  - Add to `.npmrc`: `//registry.npmjs.org/:_authToken=YOUR_TOKEN`
  - Verify: `npm whoami` (should show username without login)
  
  **Option B: Using npm login (Alternative)**
  ```bash
  npm login
  npm whoami  # Verify you're logged in
  ```
  
  See [NPMRC_SETUP_GUIDE.md](./NPMRC_SETUP_GUIDE.md) for detailed .npmrc setup.

- [ ] **Check if package name is available**:

  ```bash
  npm view stressmaster
  ```

  If 404 → name is available ✅
  If returns info → name is taken, consider `@mumzworld/stressmaster`

- [ ] **Run final validation**:

  ```bash
  npm run build:clean
  npm run typecheck
  npm run lint
  npm audit --audit-level=moderate
  npm pack --dry-run  # Verify what will be published
  ```

- [ ] **Test package locally**:
  ```bash
  npm pack
  # Create a test directory and install the tarball
  ```

## 🎯 Publishing Options

### Option 1: Manual Publish (Fastest for first publish)

```bash
npm run build:clean
npm publish
# For scoped packages: npm publish --access public
```

### Option 2: Using Release Script

```bash
chmod +x scripts/release.sh
./scripts/release.sh patch  # or minor/major
# Then manually: npm publish
```

### Option 3: Automated via GitHub Actions (Best for future releases)

1. **Set up GitHub Secret**:

   - Go to: https://github.com/mumzworld-tech/StressMaster/settings/secrets/actions
   - Add secret: `NPM_TOKEN` (get token from https://www.npmjs.com/settings/YOUR_USERNAME/tokens)

2. **Create and push version tag**:

   ```bash
   npm version patch  # or minor/major
   git push origin master
   git push --tags
   ```

3. **GitHub Actions will automatically publish!** ✅

## 📋 Post-Publish

- [ ] **Verify installation**:

  ```bash
  npm install -g stressmaster@latest
  stressmaster --version
  ```

- [ ] **Check npm page**: https://www.npmjs.com/package/stressmaster

- [ ] **Create GitHub Release** (if not automated)

- [ ] **Update documentation** if needed

## 🔑 Key Commands

```bash
# Build
npm run build:clean

# Check what will be published
npm pack --dry-run

# Publish
npm publish

# Check package info
npm view stressmaster

# Install and test
npm install -g stressmaster
stressmaster --help
```

## 📚 Full Guide

For detailed instructions, see: [PRODUCTION_PUBLISHING_GUIDE.md](./PRODUCTION_PUBLISHING_GUIDE.md)
