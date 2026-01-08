# 🏢 NPM Organization Setup for Open-Source Publishing

Guide for publishing StressMaster under your company (mumzworld-tech) as an open-source package.

## 🎯 Two Options for Company Ownership

### Option A: Unscoped Package (Recommended for Open-Source)
- **Package name**: `stressmaster` (if available)
- **Pros**: Cleaner name, easier to install (`npm install stressmaster`)
- **Cons**: Can't immediately show company ownership in name
- **Ownership**: Can transfer to organization after publishing

### Option B: Scoped Package (Shows Company Ownership)
- **Package name**: `@mumzworld/stressmaster`
- **Pros**: Clearly shows company ownership, prevents name conflicts
- **Cons**: Slightly longer install command (`npm install @mumzworld/stressmaster`)
- **Ownership**: Automatically under organization

## 📋 Step-by-Step Setup

### Step 1: Create NPM Organization

1. **Go to npm website:**
   - Visit: https://www.npmjs.com/signup
   - Or if you have an account: https://www.npmjs.com/org/create

2. **Create organization:**
   - Organization name: `mumzworld` (must match GitHub org name ideally)
   - Choose "Free" plan (perfect for open-source)
   - Add team members who need publish access

3. **Verify organization:**
   ```bash
   npm org ls mumzworld
   ```

### Step 2: Choose Package Name Strategy

#### If using Option A (Unscoped - `stressmaster`):

**Current setup is correct!** Your `package.json` already has:
```json
{
  "name": "stressmaster"
}
```

**After publishing, transfer ownership:**
```bash
# After first publish, transfer to organization
npm owner add mumzworld:developers stressmaster
npm owner rm <your-username> stressmaster  # Remove yourself if desired
```

#### If using Option B (Scoped - `@mumzworld/stressmaster`):

**Update `package.json`:**
```json
{
  "name": "@mumzworld/stressmaster",
  "publishConfig": {
    "access": "public"
  }
}
```

**Important**: The `publishConfig.access: "public"` is required for open-source scoped packages!

### Step 3: Get the Right NPM Token

#### For Organization Publishing:

1. **Go to organization settings:**
   - Visit: https://www.npmjs.com/settings/mumzworld/tokens
   - (Replace `mumzworld` with your actual org name)

2. **Create Automation Token:**
   - Click "Generate New Token"
   - Type: **"Automation"** (for CI/CD)
   - Select organization: **mumzworld**
   - Copy the token (starts with `npm_...`)

3. **Alternative: Use Personal Token with Org Access:**
   - Go to: https://www.npmjs.com/settings/[your-username]/tokens
   - Create "Automation" token
   - Make sure you're a member of the `mumzworld` organization
   - Token will have org permissions if you're an org member

### Step 4: Configure GitHub Secret

1. **Go to GitHub repository:**
   - Visit: https://github.com/mumzworld-tech/StressMaster/settings/secrets/actions

2. **Add secret:**
   - Name: `NPM_TOKEN`
   - Value: [paste the token from Step 3]
   - Click "Add secret"

### Step 5: Login Locally (for manual publishing)

```bash
# Login with your personal account (must be org member)
npm login

# Verify you have org access
npm whoami
npm org ls mumzworld
```

### Step 6: Publish

#### If using Option A (Unscoped):
```bash
npm run build:clean
npm publish
```

#### If using Option B (Scoped):
```bash
npm run build:clean
npm publish --access public
```

## 🔐 Token Types Explained

### Personal Token
- **Location**: https://www.npmjs.com/settings/[your-username]/tokens
- **Works if**: You're a member of the organization
- **Use for**: Both personal and org packages

### Organization Token
- **Location**: https://www.npmjs.com/settings/[org-name]/tokens
- **Works for**: Only organization packages
- **Use for**: CI/CD when you want org-specific access

## ✅ Recommended Setup for Open-Source

**For mumzworld-tech open-source project:**

1. **Use Option A (unscoped package)** - `stressmaster`
   - Cleaner for users
   - Can transfer ownership after publishing
   - Current `package.json` is already correct

2. **Create organization**: `mumzworld` on npm

3. **Get personal automation token** (you as org member)
   - Easier to manage
   - Works for both personal and org packages

4. **After first publish, transfer ownership:**
   ```bash
   npm owner add mumzworld:developers stressmaster
   ```

## 🎯 Quick Decision Guide

**Use unscoped (`stressmaster`) if:**
- ✅ You want the cleanest package name
- ✅ Package name is available
- ✅ You're okay transferring ownership after first publish

**Use scoped (`@mumzworld/stressmaster`) if:**
- ✅ You want immediate company branding in package name
- ✅ You want to prevent any name conflicts
- ✅ You want to show it's a company project from the start

## 📝 Checklist

- [ ] Create npm organization: `mumzworld`
- [ ] Add team members to organization
- [ ] Choose package name (unscoped or scoped)
- [ ] Update `package.json` if using scoped name
- [ ] Get automation token (personal or org)
- [ ] Add `NPM_TOKEN` to GitHub secrets
- [ ] Test login: `npm login` and `npm whoami`
- [ ] Verify org access: `npm org ls mumzworld`
- [ ] Publish: `npm publish` (or `npm publish --access public` for scoped)

## 🔗 Useful Links

- **Create Organization**: https://www.npmjs.com/org/create
- **Organization Settings**: https://www.npmjs.com/settings/mumzworld
- **Personal Tokens**: https://www.npmjs.com/settings/[username]/tokens
- **Organization Tokens**: https://www.npmjs.com/settings/mumzworld/tokens
- **Transfer Package Ownership**: https://docs.npmjs.com/transferring-a-package-from-a-user-account-to-another-user-account

---

**Recommendation**: Start with **unscoped package** (`stressmaster`) since it's cleaner for open-source users, and transfer ownership to the organization after publishing.
