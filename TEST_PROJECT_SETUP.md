# Setting Up StressMaster Configuration in Your Test Project

This guide shows you how to configure StressMaster in your test project so it can parse your natural language commands.

## 🚀 Quick Setup (Easiest Method)

### Step 1: Run the Interactive Setup Wizard

In your **test project** directory:

```bash
cd /path/to/your-test-project
stressmaster setup
```

This wizard will:

- ✅ Guide you through choosing your AI provider
- ✅ Prompt for API keys
- ✅ Create `config/ai-config.json` automatically
- ✅ Optionally create a `.env` file

**That's it!** Configuration is done. Skip to Step 3.

---

## 📝 Manual Setup Methods

If you prefer to set up configuration manually, here are three methods:

### Method 1: Using Environment Variables (Recommended)

**Priority:** Highest (overrides other methods)

#### Create `.env` file in your test project:

```bash
# In your test project directory
cd /path/to/your-test-project

# Create .env file
cat > .env << 'EOF'
# For Claude (Anthropic)
AI_PROVIDER=claude
ANTHROPIC_API_KEY=your-anthropic-api-key-here
AI_MODEL=claude-3-5-sonnet-20241022

# OR for OpenAI
# AI_PROVIDER=openai
# OPENAI_API_KEY=sk-your-openai-key-here
# AI_MODEL=gpt-3.5-turbo


# OR for Google Gemini
# AI_PROVIDER=gemini
# GOOGLE_API_KEY=your-google-api-key
# AI_MODEL=gemini-pro
EOF
```

#### Load environment variables:

```bash
# Option 1: Source the file (for current shell)
export $(cat .env | grep -v '^#' | xargs)

# Option 2: Use with command (temporary)
source .env

# Option 3: Let StressMaster load it automatically (if you use dotenv)
# StressMaster will automatically load .env files in your project
```

**File structure:**

```
your-test-project/
├── .env                    # ← Your environment variables
├── api-payload.json
└── package.json
```

---

### Method 2: Using Config File

**Priority:** Medium (overridden by environment variables)

#### Create config file in your test project:

```bash
# In your test project directory
mkdir -p config

# Create AI config file
cat > config/ai-config.json << 'EOF'
{
  "provider": "claude",
  "model": "claude-3-5-sonnet-20241022",
  "apiKey": "your-anthropic-api-key-here",
  "endpoint": "https://api.anthropic.com",
  "maxRetries": 3,
  "timeout": 30000,
  "options": {
    "temperature": 0.1
  }
}
EOF
```

**File structure:**

```
your-test-project/
├── config/
│   └── ai-config.json      # ← Your configuration
├── api-payload.json
└── package.json
```

#### Provider-specific examples:

**For Claude:**

```json
{
  "provider": "claude",
  "model": "claude-3-5-sonnet-20241022",
  "apiKey": "sk-ant-your-key-here"
}
```

**For OpenAI:**

```json
{
  "provider": "openai",
  "model": "gpt-3.5-turbo",
  "apiKey": "sk-your-openai-key-here"
}
```

**For Ollama (Local):**

```json
{
  "provider": "claude",
  "model": "llama3.2:1b",
  "endpoint": "http://localhost:11434"
}
```

**For Google Gemini:**

```json
{
  "provider": "gemini",
  "model": "gemini-pro",
  "apiKey": "your-google-api-key"
}
```

---

### Method 3: Using package.json

**Priority:** Lowest (only used if other methods don't provide config)

#### Add to your project's `package.json`:

```json
{
  "name": "my-test-project",
  "version": "1.0.0",
  "stressmaster": {
    "provider": "claude",
    "model": "claude-3-5-sonnet-20241022",
    "apiKey": "your-api-key-here"
  }
}
```

---

## 🔄 Configuration Priority Order

StressMaster loads configuration in this order (highest to lowest priority):

1. **Environment Variables** (`.env` file or `export`)
2. **Config File** (`config/ai-config.json`)
3. **package.json** (`stressmaster` section)
4. **Defaults** (lowest priority)

**Example:** If you set `AI_PROVIDER=claude` in `.env` and `"provider": "openai"` in `config/ai-config.json`, StressMaster will use Claude (environment variable wins).

---

## ✅ Verify Your Configuration

After setting up, verify it's working:

```bash
# Check current configuration
stressmaster config show

# Should display:
# Provider: claude
# Model: claude-3-5-sonnet-20241022
# Source: environment variables (or config file)
```

---

## 📋 Complete Example Setup

Here's a complete example of setting up a test project:

```bash
# 1. Create test project
mkdir my-api-test
cd my-api-test

# 2. Link StressMaster (if using npm link)
npm link stressmaster

# 3. Create test data file
cat > test-data.json << 'EOF'
{
  "userId": "test-123",
  "action": "test"
}
EOF

# 4. Configure StressMaster using setup wizard
stressmaster setup

# OR manually create config
mkdir -p config
cat > config/ai-config.json << 'EOF'
{
  "provider": "claude",
  "model": "claude-3-5-sonnet-20241022",
  "apiKey": "your-api-key"
}
EOF

# 5. Verify configuration
stressmaster config show

# 6. Test it!
stressmaster "send 10 POST requests to http://localhost:3000/api/users with JSON body @test-data.json"
```

---

## 🔑 Getting API Keys

### Claude (Anthropic)

1. Go to https://console.anthropic.com/
2. Sign up / Log in
3. Navigate to API Keys
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)

### OpenAI

1. Go to https://platform.openai.com/
2. Sign up / Log in
3. Navigate to API Keys
4. Create a new secret key
5. Copy the key (starts with `sk-`)

### Ollama (Local - Free)

1. Get an Anthropic Claude or OpenRouter API key
2. Set `AI_PROVIDER=claude` and `AI_API_KEY=your-key` in `.env`
3. Use endpoint: `http://localhost:11434`

### Google Gemini

1. Go to https://aistudio.google.com/
2. Get API key from Google AI Studio
3. Copy the API key

---

## 🐛 Troubleshooting

### Issue: "No AI provider configured"

**Solution:** Make sure you've run `stressmaster setup` or created a config file:

```bash
# Check if config exists
ls -la config/ai-config.json

# Or check environment variables
echo $AI_PROVIDER

# Run setup wizard
stressmaster setup
```

### Issue: "Invalid API key"

**Solution:** Verify your API key is correct:

```bash
# Check your config
stressmaster config show

# Verify API key format:
# Claude: starts with "sk-ant-"
# OpenAI: starts with "sk-"
# Gemini: Google API key format
```

### Issue: Configuration not loading from test project

**Problem:** StressMaster is reading config from its installation directory instead of your project.

**Solution:** This should work automatically, but verify:

```bash
# Make sure you're in your test project directory
cd /path/to/your-test-project
pwd

# Check where config is being loaded from
stressmaster config show

# It should show your project's config, not StressMaster's
```

### Issue: Environment variables not working

**Solution:** Make sure variables are exported:

```bash
# Check if variables are set
echo $AI_PROVIDER

# Export them explicitly
export AI_PROVIDER=claude
export ANTHROPIC_API_KEY=your-key

# Or source .env file
source .env
```

---

## 📚 Quick Reference

### Environment Variables

```bash
# Claude
export AI_PROVIDER=claude
export ANTHROPIC_API_KEY=your-key
export AI_MODEL=claude-3-5-sonnet-20241022

# OpenAI
export AI_PROVIDER=openai
export OPENAI_API_KEY=your-key
export AI_MODEL=gpt-3.5-turbo

# Ollama
export AI_PROVIDER=claude
export AI_ENDPOINT=http://localhost:11434
export AI_MODEL=llama3.2:1b
```

### Config File Location

```
your-test-project/
└── config/
    └── ai-config.json      # StressMaster looks here
```

### Commands

```bash
stressmaster setup          # Interactive setup wizard
stressmaster config show    # View current configuration
stressmaster config init    # Initialize config file
```

---

## 🎯 Best Practices

1. **Use `.env` file** for API keys (add to `.gitignore`)
2. **Use `config/ai-config.json`** for project-specific settings
3. **Never commit API keys** to git
4. **Use environment variables** for CI/CD environments
5. **Run `stressmaster setup`** for first-time setup

---

## 📝 Example `.gitignore`

Make sure to add sensitive files to `.gitignore`:

```gitignore
# Environment variables
.env
.env.local

# StressMaster config (if contains API keys)
config/ai-config.json

# But you can commit a template
config/ai-config.example.json
```

---

That's it! Your StressMaster is now configured in your test project. 🎉

For more details, see:

- [LOCAL_TESTING_GUIDE.md](./LOCAL_TESTING_GUIDE.md) - Full local testing guide
- [README.md](./README.md) - General StressMaster documentation
