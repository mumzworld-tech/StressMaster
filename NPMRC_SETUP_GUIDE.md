# 🔐 NPM Authentication Using .npmrc File

Guide for setting up npm authentication using `.npmrc` file instead of `npm login`.

## 📋 Why Use .npmrc?

- ✅ No need to run `npm login` every time
- ✅ Works great for CI/CD and automated publishing
- ✅ Can store tokens securely
- ✅ Easy to switch between accounts/organizations

## 🚀 Setup Steps

### Step 1: Get Your NPM Token

1. **Go to npm token settings:**
   - Personal token: https://www.npmjs.com/settings/[your-username]/tokens
   - Organization token: https://www.npmjs.com/settings/mumzworld/tokens

2. **Create Automation Token:**
   - Click "Generate New Token"
   - Type: **"Automation"** (for CI/CD and scripts)
   - Copy the token (starts with `npm_...`)
   - ⚠️ **Save it immediately** - you won't see it again!

### Step 2: Configure .npmrc File

**Your `.npmrc` file should look like this:**

```ini
# NPM Registry
registry=https://registry.npmjs.org/

# Authentication Token
//registry.npmjs.org/:_authToken=YOUR_NPM_TOKEN_HERE

# GitHub Packages (if needed)
@mumzworld-tech:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN_HERE
```

**Replace `YOUR_NPM_TOKEN_HERE` with your actual token.**

### Step 3: Verify .npmrc is Excluded from Package

**Check `.npmignore` includes `.npmrc`:**
```ini
.npmrc
```

✅ **Already configured!** Your `.npmignore` already excludes `.npmrc`.

### Step 4: Test Authentication

```bash
# Verify you're authenticated
npm whoami

# Should output your npm username
# If it works, you're ready to publish!
```

### Step 5: Publish

```bash
# Build first
npm run build:clean

# Verify package contents
npm pack --dry-run

# Publish (no login needed - uses .npmrc)
npm publish

# For scoped packages:
# npm publish --access public
```

## 🔒 Security Best Practices

### Option A: Token in .npmrc (Local Development)

**For local development, you can put the token directly in `.npmrc`:**

```ini
//registry.npmjs.org/:_authToken=npm_xxxxxxxxxxxxxxxxxxxxx
```

**⚠️ Important:**
- Add `.npmrc` to `.gitignore` (already done ✅)
- Never commit tokens to git
- Use environment variables for CI/CD

### Option B: Environment Variable (Recommended for CI/CD)

**For GitHub Actions, use secrets instead:**

```yaml
# .github/workflows/release.yml
- name: Publish to NPM
  run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**npm automatically uses `NODE_AUTH_TOKEN` environment variable if present.**

### Option C: Token in .npmrc with Git Ignore

**Best practice for local development:**

1. **Add `.npmrc` to `.gitignore`:**
   ```gitignore
   .npmrc
   ```

2. **Create `.npmrc.example` (template):**
   ```ini
   registry=https://registry.npmjs.org/
   //registry.npmjs.org/:_authToken=YOUR_TOKEN_HERE
   ```

3. **Each developer copies and adds their token:**
   ```bash
   cp .npmrc.example .npmrc
   # Then edit .npmrc and add your token
   ```

## 📝 Your Current .npmrc Setup

**Current `.npmrc` file:**
```ini
registry=https://registry.npmjs.org/
@mumzworld-tech:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=
```

**To add npm authentication, add this line:**
```ini
//registry.npmjs.org/:_authToken=YOUR_NPM_TOKEN_HERE
```

**Complete `.npmrc` should look like:**
```ini
registry=https://registry.npmjs.org/
//registry.npmjs.org/:_authToken=npm_xxxxxxxxxxxxxxxxxxxxx
@mumzworld-tech:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN_IF_NEEDED
```

## 🎯 Quick Publishing with .npmrc

```bash
# 1. Make sure .npmrc has your token
cat .npmrc | grep _authToken

# 2. Verify authentication
npm whoami

# 3. Build
npm run build:clean

# 4. Publish (no login needed!)
npm publish
```

## 🔄 Switching Between Accounts

**If you need to switch npm accounts:**

1. **Update `.npmrc` with different token:**
   ```ini
   //registry.npmjs.org/:_authToken=DIFFERENT_TOKEN
   ```

2. **Or use npm config:**
   ```bash
   npm config set //registry.npmjs.org/:_authToken YOUR_TOKEN
   ```

## ✅ Verification Checklist

- [ ] `.npmrc` file exists with token
- [ ] `.npmrc` is in `.npmignore` (won't be published)
- [ ] `.npmrc` is in `.gitignore` (won't be committed)
- [ ] `npm whoami` shows your username
- [ ] Token has correct permissions (Automation type)
- [ ] Ready to publish without `npm login`

## 🚨 Troubleshooting

### "npm ERR! code E401" (Unauthorized)

**Problem**: Token is invalid or expired

**Solution**:
1. Generate a new token
2. Update `.npmrc` with new token
3. Try again

### "npm ERR! code E403" (Forbidden)

**Problem**: Token doesn't have publish permissions

**Solution**:
1. Make sure token type is "Automation"
2. Verify you're a member of the organization (if publishing org package)
3. Check package name is available

### Token Not Working

**Check**:
```bash
# Verify token format
cat .npmrc

# Should see:
# //registry.npmjs.org/:_authToken=npm_...

# Test authentication
npm whoami
```

## 🔗 Useful Links

- **Create Token**: https://www.npmjs.com/settings/[username]/tokens
- **npmrc Documentation**: https://docs.npmjs.com/cli/v9/configuring-npm/npmrc
- **Token Types**: https://docs.npmjs.com/about-access-tokens

---

**Ready to publish?** Just make sure your `.npmrc` has the token and run `npm publish`! 🚀
