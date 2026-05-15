# Testing StressMaster Locally as an NPM Tool

This guide explains how to test StressMaster locally in another project before publishing it to npm. This is useful for development and testing changes.

## 📋 Prerequisites

- Node.js 18+ and npm 9+ installed
- Access to the StressMaster source code
- Another project where you want to test StressMaster

## 🚀 Method 1: Using `npm link` (Recommended for Active Development)

This method creates a symlink, so changes in StressMaster are immediately available.

### Step 1: Build and Link StressMaster

In the **StressMaster** directory:

```bash
# Navigate to StressMaster directory
cd /path/to/StressMaster

# Install dependencies (if not already done)
npm install

# Build the project
npm run build

# Create a global symlink
npm link
```

This will:

- Create a global symlink to StressMaster
- Make `stressmaster` and `sm` commands available globally
- Link to your local development version

### Step 2: Use in Your Test Project

In your **test project** directory:

```bash
# Navigate to your test project
cd /path/to/your-test-project

# Link to the local StressMaster
npm link stressmaster
```

### Step 3: Verify Installation

```bash
# Check if StressMaster is available
stressmaster --version
# or
sm --version

# Should show: stressmaster@1.0.3 (or your current version)
```

### Step 4: Test StressMaster

```bash
# Run a simple test
stressmaster "send 10 GET requests to https://httpbin.org/get"

# Interactive mode
stressmaster

# Check that files are resolved correctly
stressmaster "send 2 POST requests to http://localhost:3000/api/users with JSON body @test-data.json"
```

### Step 5: Make Changes and Rebuild

When you make changes to StressMaster:

```bash
# In StressMaster directory
cd /path/to/StressMaster

# Rebuild
npm run build

# The changes are immediately available in your test project!
# No need to re-link
```

### Step 6: Unlink (when done)

```bash
# In your test project
cd /path/to/your-test-project
npm unlink stressmaster

# In StressMaster directory (to remove global link)
cd /path/to/StressMaster
npm unlink
```

## 📦 Method 2: Using `npm pack` (Recommended for Production-like Testing)

This method creates an actual package tarball, simulating a real npm install.

### Step 1: Build StressMaster

In the **StressMaster** directory:

```bash
cd /path/to/StressMaster

# Clean previous builds
npm run build:clean

# Build the project
npm run build
```

### Step 2: Create Package Tarball

```bash
# Create a .tgz package file
npm pack

# This creates: stressmaster-1.0.3.tgz (or your version)
```

### Step 3: Install in Your Test Project

In your **test project** directory:

```bash
cd /path/to/your-test-project

# Install from the local tarball
npm install /path/to/StressMaster/stressmaster-1.0.3.tgz

# Or if you copied the file
npm install ./stressmaster-1.0.3.tgz
```

### Step 4: Use StressMaster

```bash
# Use the globally installed command
stressmaster --version

# Or use npx (if installed locally)
npx stressmaster "send 10 GET requests to https://httpbin.org/get"
```

### Step 5: Update Package (after changes)

When you make changes:

```bash
# In StressMaster directory
npm run build
npm pack

# In your test project
npm install /path/to/StressMaster/stressmaster-1.0.3.tgz --force
```

## 🧪 Method 3: Direct Global Install (Quick Testing)

For quick testing without linking:

### Step 1: Build and Install Globally

In the **StressMaster** directory:

```bash
cd /path/to/StressMaster
npm install
npm run build
npm install -g .
```

### Step 2: Use Anywhere

```bash
# Navigate to your test project
cd /path/to/your-test-project

# Use StressMaster
stressmaster "send 10 GET requests to https://httpbin.org/get"
```

### Step 3: Update After Changes

```bash
# In StressMaster directory
npm run build
npm install -g .
```

## 📁 Method 4: Testing File Resolution in Another Project

This is crucial for ensuring StressMaster resolves files correctly from the project being tested, not from its own installation directory.

### Setup Test Project

```bash
# Create a test project
mkdir stressmaster-test-project
cd stressmaster-test-project

# Create a test API payload file
cat > api-payload.json << 'EOF'
{
  "userId": "test-user-1",
  "action": "test-action"
}
EOF

# Create a test OpenAPI spec
cat > api-spec.yaml << 'EOF'
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /api/test:
    post:
      summary: Test endpoint
      requestBody:
        content:
          application/json:
            schema:
              type: object
EOF
```

### Link StressMaster

```bash
# Link StressMaster (using Method 1)
npm link stressmaster
```

### Test File Resolution

```bash
# Test with local file reference
stressmaster "send 5 POST requests to http://localhost:3000/api/test with JSON body @api-payload.json"

# Test with OpenAPI file
stressmaster "send 10 requests to @api-spec.yaml endpoint /api/test"

# Verify files are found correctly
stressmaster file list
```

**Expected behavior:**

- ✅ Files should be found in your test project directory
- ✅ Not in StressMaster's installation directory
- ✅ `@api-payload.json` should resolve to `./api-payload.json` in your project

## 🔧 Configuration When Testing Locally

### Environment Variables

StressMaster respects configuration from:

1. **Environment variables** (highest priority)
2. **Config file**: `config/ai-config.json` in your project
3. **package.json**: `stressmaster` section

### Create Test Configuration

```bash
# In your test project
mkdir -p config

# Create AI config
cat > config/ai-config.json << 'EOF'
{
  "provider": "claude",
  "model": "claude-3-sonnet-20240229",
  "apiKey": "your-api-key-here"
}
EOF

# Or use environment variables
export AI_PROVIDER=claude
export ANTHROPIC_API_KEY=your-api-key
export AI_MODEL=claude-3-sonnet-20240229
```

### Verify Configuration

```bash
# Check active configuration
stressmaster config show

# Should show your configuration from the test project
```

## 📝 Example: Complete Local Testing Workflow

Here's a complete example workflow:

```bash
# 1. Build and link StressMaster
cd ~/Desktop/Mumzworld/StressMaster
npm install
npm run build
npm link

# 2. Create a test project
cd ~/Desktop
mkdir my-api-project
cd my-api-project

# 3. Create test files
echo '{"id": "123"}' > test-data.json

# 4. Link StressMaster
npm link stressmaster

# 5. Configure StressMaster
mkdir -p config
cat > config/ai-config.json << 'EOF'
{
  "provider": "claude",
  "model": "claude-3-sonnet-20240229"
}
EOF

# 6. Test StressMaster
stressmaster "send 10 POST requests to http://localhost:3000/api/users with JSON body @test-data.json"

# 7. Make changes to StressMaster
cd ~/Desktop/Mumzworld/StressMaster
# ... make your changes ...
npm run build

# 8. Test again (changes are immediately available!)
cd ~/Desktop/my-api-project
stressmaster "send 5 GET requests to http://localhost:3000/api/users"
```

## 🐛 Troubleshooting

### Issue: Command not found

```bash
# Check if StressMaster is linked
npm list -g stressmaster

# Re-link if needed
cd /path/to/StressMaster
npm run build
npm link
```

### Issue: Files not found in test project

**Problem**: StressMaster looks for files in its installation directory instead of your project.

**Solution**: This should be fixed, but verify:

```bash
# Check current working directory
pwd

# Make sure you're in your test project directory
cd /path/to/your-test-project

# Files should resolve relative to current directory
stressmaster file list
```

### Issue: Old version still running

```bash
# Clear npm cache
npm cache clean --force

# Re-link
cd /path/to/StressMaster
npm unlink
npm run build
npm link
```

### Issue: Permission errors on global install

```bash
# Use npm link instead (no sudo needed)
npm link

# Or fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
```

### Issue: Changes not reflecting

```bash
# Make sure to rebuild after changes
cd /path/to/StressMaster
npm run build

# For npm link, changes are immediate
# For npm pack, reinstall the package
```

## ✅ Verification Checklist

Before publishing to npm, verify:

- [ ] StressMaster builds without errors
- [ ] `stressmaster --version` works
- [ ] Files resolve correctly in test project (not in StressMaster directory)
- [ ] Configuration loads from test project
- [ ] Tests run successfully in test project
- [ ] Interactive CLI works
- [ ] All commands work as expected
- [ ] No hardcoded paths to StressMaster installation

## 🎯 Quick Reference

```bash
# Build StressMaster
cd /path/to/StressMaster && npm run build

# Link globally
npm link

# Use in test project
cd /path/to/test-project && npm link stressmaster

# Test
stressmaster --version
stressmaster "send 10 GET requests to https://httpbin.org/get"

# Unlink when done
npm unlink stressmaster  # in test project
npm unlink               # in StressMaster (remove global link)
```

## 📚 Additional Resources

- [npm link documentation](https://docs.npmjs.com/cli/v8/commands/npm-link)
- [npm pack documentation](https://docs.npmjs.com/cli/v8/commands/npm-pack)
- StressMaster README.md for usage examples

## 🚀 Next Steps

Once local testing is successful:

1. **Run full test suite**: `npm test`
2. **Check type checking**: `npm run typecheck`
3. **Lint code**: `npm run lint`
4. **Build for production**: `npm run build:clean`
5. **Publish to npm**: `npm publish` (when ready)

---

Happy testing! 🎉
