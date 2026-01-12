# StressMaster

A local-first AI-powered load testing tool that accepts natural language commands to perform API load testing. The system uses AI models to parse user prompts and convert them into structured load test specifications that can be executed using K6.

## 🤖 AI Provider Support

StressMaster supports multiple AI providers for natural language parsing:

- **Claude** - Claude 3 models via direct API or OpenRouter
- **OpenRouter** - Access to multiple AI models through OpenRouter
- **OpenAI** - GPT-3.5, GPT-4, and other OpenAI models
- **Google Gemini** - Gemini Pro and other Google AI models

## 🚀 Features

- **Natural Language Interface**: Describe load tests in plain English
- **Multiple Test Types**: Spike, stress, endurance, volume, and baseline testing
- **K6 Integration**: Generates and executes K6 scripts automatically
- **Real-time Monitoring**: Live progress tracking and metrics
- **Comprehensive Reporting**: Detailed analysis with AI-powered recommendations
- **Export Formats**: JSON, CSV, and HTML export capabilities
- **Cloud AI Integration**: Supports multiple cloud AI providers (Claude, OpenAI, Gemini, OpenRouter)
- **No Local AI Required**: Uses cloud-based AI models for natural language parsing

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Input    │───▶│   AI Parser      │───▶│  K6 Generator   │
│ (Natural Lang.) │    │ (AI Model)       │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Results &     │◀───│  Test Executor   │◀───│  Load Test      │
│ Recommendations │    │     (K6)         │    │  Orchestrator   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 📋 Prerequisites

- **Node.js**: Version 18.0 or higher
- **npm**: Version 9.0 or higher
- **K6**: Installed and available in PATH (for load test execution)
- **Internet Access**: Required for AI provider API calls

## 🚀 Quick Start

### 1. Installation

#### Option A: NPM Global Installation (Recommended)

```bash
# Install from npm
npm install -g stressmaster

# Verify installation
stressmaster --version
```

#### Option B: Development Installation (from source)

```bash
# Clone the repository
git clone https://github.com/mumzworld-tech/StressMaster.git
cd StressMaster

# Install dependencies
npm install

# Build the project
npm run build

# Install globally
npm install -g .
```

#### Option C: Testing Locally in Another Project (Development)

To test StressMaster locally in another project before publishing:

```bash
# In StressMaster directory
npm install
npm run build
npm link

# In your test project directory
npm link stressmaster

# Now use StressMaster in your project
stressmaster --version
```

📖 **See [LOCAL_TESTING_GUIDE.md](./LOCAL_TESTING_GUIDE.md) for detailed instructions** on:

- Testing StressMaster locally using `npm link`
- Using `npm pack` for production-like testing
- Verifying file resolution in other projects
- Configuration when testing locally

### 2. First Load Test

After installation, you can immediately start using StressMaster:

```bash
# Interactive mode
stressmaster

# Direct command
stressmaster "send 10 GET requests to https://httpbin.org/get"

# Spike test
stressmaster "spike test with 50 requests in 30 seconds to https://api.example.com"

# Export results
stressmaster export html
```

Try your first load test:

```bash
stressmaster "Send 100 GET requests to https://httpbin.org/get over 30 seconds"
```

### 3. Testing Local APIs (localhost)

**✅ Yes! StressMaster fully supports testing localhost APIs.** You can test your local backend applications directly:

```bash
# Test your local API
stressmaster "send 100 POST requests to http://localhost:3000/api/v1/users"

# Test with different ports
stressmaster "spike test with 50 requests to http://localhost:8080/api/products"

# Test with headers and payload
stressmaster "send 10 POST requests to http://localhost:5000/api/orders with header Authorization Bearer token123 and JSON body @payload.json"
```

**Key Points:**

- ✅ Works with `http://localhost` or `http://127.0.0.1`
- ✅ Supports any port (e.g., `:3000`, `:8080`, `:5000`)
- ✅ Works with local API development servers
- ✅ No special configuration needed - just use the localhost URL

**Example: Testing Your Local Backend**

```bash
# Start your local API server (e.g., Express, FastAPI, etc.)
# Then run StressMaster:

stressmaster "send 50 GET requests to http://localhost:3000/api/v1/users"
stressmaster "POST 20 requests to http://localhost:3000/api/v1/orders with JSON body @order-data.json increment orderId"
```

### 4. Configuration Setup

#### Quick Setup (Recommended) 🚀

After installation, run the interactive setup wizard to configure everything automatically:

```bash
stressmaster setup
```

This wizard will:

- ✅ Guide you through choosing your AI provider (Ollama, OpenAI, Claude, Gemini)
- ✅ Prompt for API keys and configuration
- ✅ Create `config/ai-config.json` file automatically
- ✅ Optionally create a `.env` file for environment variables
- ✅ Show you next steps

**That's it!** The setup wizard handles all the configuration for you.

#### Manual Configuration (Advanced)

**Important:** When StressMaster is installed as an npm package, all configuration is stored in **your project directory** (where you run the command), not in StressMaster's installation directory.

StressMaster loads configuration in this priority order:

1. **Environment Variables** (highest priority)
2. **Config File** (`.stressmaster/config/ai-config.json` in your project)
3. **package.json** (in a `stressmaster` section)
4. **Defaults** (lowest priority)

#### Method 1: Environment Variables (Recommended)

Create a `.env` file in your project directory:

```bash
# In your project directory (e.g., /path/to/your/project/.env)
AI_PROVIDER=claude
AI_API_KEY=your-api-key-here
AI_MODEL=claude-3-5-sonnet-20241022

# Or for OpenAI
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
AI_MODEL=gpt-3.5-turbo
```

Then load it (if you're using a tool like `dotenv`):

```bash
# Your project can load .env automatically, or use:
export $(cat .env | xargs)
```

#### Method 2: Config File

Create `.stressmaster/config/ai-config.json` in your project directory:

```bash
# Your project structure:
your-project/
├── .stressmaster/
│   └── config/
│       └── ai-config.json    # ← Created by StressMaster or setup/switch scripts
├── .env                      # ← Or use this for env vars
└── package.json
```

**File location:** `.stressmaster/config/ai-config.json` in your project directory (where you run `stressmaster`)

#### Method 3: package.json

Add configuration to your project's `package.json`:

```json
{
  "name": "my-project",
  "stressmaster": {
    "provider": "claude",
    "apiKey": "your-api-key",
    "model": "claude-3-5-sonnet-20241022"
  }
}
```

### 5. AI Provider Configuration

StressMaster automatically creates a configuration file on first use. You can switch between AI providers using simple commands:

#### Quick Provider Switching:

Use the interactive setup wizard to switch providers:

```bash
stressmaster setup
```

Or manually edit the configuration file (see below).

#### Manual Configuration:

The AI configuration is stored in `.stressmaster/config/ai-config.json` (automatically created on first use):

```json
{
  "provider": "claude",
  "model": "claude-3-5-sonnet-20241022",
  "endpoint": "https://api.anthropic.com/v1",
  "maxRetries": 3,
  "timeout": 30000,
  "options": {
    "temperature": 0.1
  }
}
```

#### Provider Setup:

- **OpenAI**: Get API key from OpenAI and configure via `stressmaster setup`
- **Claude**: Get API key from Anthropic and configure via `stressmaster setup`
- **OpenRouter**: Get API key from OpenRouter and configure via `stressmaster setup`
- **Gemini**: Get API key from Google AI and configure via `stressmaster setup`

> **Note**: The `config/ai-config.json` file contains API keys and is automatically excluded from git. Use `config/ai-config.example.json` as a reference.

## 💻 CLI Usage

StressMaster provides a powerful command-line interface with natural language processing:

### Basic Commands

```bash
# Show help
stressmaster --help
sm --help

# Show version
stressmaster --version
sm --version

# Interactive mode
stressmaster

# Run a test directly
stressmaster "send 10 GET requests to https://httpbin.org/get"

# Export results
stressmaster export html
sm export json --include-raw
```

### Command Examples

```bash
# Basic GET test
stressmaster "send 5 GET requests to https://httpbin.org/get"

# POST with JSON payload
stressmaster "POST 20 requests with JSON payload to https://api.example.com/users"

# Spike test
stressmaster "spike test with 100 requests in 60 seconds to https://api.example.com"

# Ramp-up test
stressmaster "ramp up from 10 to 100 requests over 2 minutes to https://api.example.com"

# Stress test
stressmaster "stress test with 500 requests to https://api.example.com"

# Random burst test
stressmaster "random burst test with 50 requests to https://api.example.com"
```

### Export Options

```bash
# Export to different formats
stressmaster export json
stressmaster export csv
stressmaster export html

# Include raw data
stressmaster export json --include-raw

# Include recommendations
stressmaster export html --include-recommendations
```

### Interactive CLI Commands

When you run `stressmaster` without arguments, you enter interactive mode where you can use structured commands:

**Configuration Commands:**

```bash
┌─ stressmaster ❯ config show              # Show current configuration
┌─ stressmaster ❯ config set key value     # Set configuration value
┌─ stressmaster ❯ config init              # Initialize configuration
```

**File Management:**

```bash
┌─ stressmaster ❯ file list                # List all files
┌─ stressmaster ❯ file list *.json         # List JSON files
┌─ stressmaster ❯ file validate @file.json # Validate file reference
┌─ stressmaster ❯ file search pattern      # Search for files
```

**Results & Export:**

```bash
┌─ stressmaster ❯ results list             # List recent test results
┌─ stressmaster ❯ results show <id>        # Show detailed result
┌─ stressmaster ❯ export json              # Export last result as JSON
┌─ stressmaster ❯ export csv               # Export as CSV
┌─ stressmaster ❯ export html              # Export as HTML report
```

**OpenAPI Integration:**

```bash
┌─ stressmaster ❯ openapi parse @api.yaml           # Parse OpenAPI spec
┌─ stressmaster ❯ openapi list @api.yaml            # List endpoints
┌─ stressmaster ❯ openapi payloads @api.yaml        # Generate payloads
┌─ stressmaster ❯ openapi curl @api.yaml            # Generate cURL commands
```

**File Autocomplete:** Press `Tab` after typing `@` to see file suggestions!

### Aliases

- `stressmaster` - Full command name
- `sm` - Short alias for quick commands

## 🤖 AI Model Setup

StressMaster supports multiple AI model configurations. Choose the setup that best fits your needs:

### Option 1: Claude / OpenRouter (Recommended)

Use Anthropic Claude directly or via OpenRouter for reliable, high-quality parsing.

### Option 2: OpenAI API

**Advantages**: Better performance, more reliable, no local setup

#### Setup Steps:

1. **Get OpenAI API Key**:

   - Visit [OpenAI Platform](https://platform.openai.com/api-keys)
   - Create a new API key
   - Copy the key

2. **Configure StressMaster**:

   ```bash
   # Edit your .env file
   AI_PROVIDER=openai
   OPENAI_API_KEY=your-api-key-here
   OPENAI_MODEL=gpt-4
   # or use gpt-3.5-turbo for cost savings
   ```

3. **Test Configuration**:
   ```bash
   # Test the API connection
   curl -H "Authorization: Bearer your-api-key" \
        https://api.openai.com/v1/models
   ```

### Option 3: Anthropic Claude

**Advantages**: Excellent reasoning, good for complex parsing

#### Setup Steps:

1. **Get Anthropic API Key**:

   - Visit [Anthropic Console](https://console.anthropic.com/)
   - Create a new API key
   - Copy the key

2. **Configure StressMaster**:
   ```bash
   # Edit your .env file
   AI_PROVIDER=anthropic
   ANTHROPIC_API_KEY=your-api-key-here
   ANTHROPIC_MODEL=claude-3-sonnet-20240229
   ```

### Option 4: Google Gemini

**Advantages**: Good performance, competitive pricing

#### Setup Steps:

1. **Get Google API Key**:

   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy the key

2. **Configure StressMaster**:
   ```bash
   # Edit your .env file
   AI_PROVIDER=gemini
   GEMINI_API_KEY=your-api-key-here
   GEMINI_MODEL=gemini-pro
   ```

### Configuration File

See `.stressmaster/config/ai-config.json` and `config/ai-config.example.json` for up-to-date examples of configuring Claude, OpenRouter, OpenAI, or Gemini.

### Model Comparison

| Provider  | Model           | Cost              | Performance | Setup Complexity |
| --------- | --------------- | ----------------- | ----------- | ---------------- |
| OpenAI    | GPT-3.5-turbo   | $0.0015/1K tokens | Excellent   | Easy             |
| OpenAI    | GPT-4           | $0.03/1K tokens   | Best        | Easy             |
| Anthropic | Claude 3 Sonnet | $0.003/1K tokens  | Excellent   | Easy             |
| Google    | Gemini Pro      | $0.0005/1K tokens | Good        | Easy             |

### Troubleshooting AI Setup

#### API Key Issues:

```bash
# Test OpenAI
curl -H "Authorization: Bearer your-key" \
     https://api.openai.com/v1/models

# Test Anthropic
curl -H "x-api-key: your-key" \
     https://api.anthropic.com/v1/models

# Test Gemini
curl "https://generativelanguage.googleapis.com/v1beta/models?key=your-key"
```

## 💡 Usage Examples

### Testing Local APIs

```bash
# Basic localhost test
stressmaster "send 10 GET requests to http://localhost:3000/api/v1/users"

# POST with localhost
stressmaster "POST 20 requests to http://localhost:8080/api/orders with JSON body @payload.json"

# Spike test on local API
stressmaster "spike test with 100 requests in 30 seconds to http://localhost:5000/api/products"

# Test with headers
stressmaster "send 50 POST requests to http://localhost:3000/api/auth/login with header Content-Type application/json and JSON body @login.json"

# Increment variables in localhost tests
stressmaster "send 10 POST requests to http://localhost:3000/api/users with JSON body @user-data.json increment userId"
```

### Basic Load Tests

```bash
# Simple GET request
stressmaster "send 50 GET requests to https://api.example.com/users"

# POST with JSON payload
stressmaster "POST 200 requests to https://api.example.com/orders with JSON body @order.json"

# POST with inline JSON
stressmaster "POST 10 requests to https://api.example.com/users with JSON body {\"name\":\"test\",\"email\":\"test@example.com\"}"
```

### Test Types

```bash
# Spike test - sudden load increase
stressmaster "spike test with 1000 requests in 10 seconds to https://api.example.com/products"

# Stress test with ramp-up
stressmaster "stress test starting with 10 users, ramping up to 500 users over 10 minutes to https://api.example.com/search"

# Endurance test - long duration
stressmaster "endurance test with 50 constant users for 2 hours to https://api.example.com/health"

# Volume test - high concurrency
stressmaster "volume test with 500 concurrent users for 5 minutes to https://api.example.com/data"

# Baseline test - establish baseline
stressmaster "baseline test with 10 requests to https://api.example.com/users"
```

### Load Pattern Examples

#### Constant Load

```
Maintain 100 requests per second to https://api.example.com/data for 10 minutes
```

#### Ramp-up Pattern

```
Start with 10 RPS, increase to 200 RPS over 5 minutes, then maintain for 15 minutes
```

#### Step Pattern

```
Load test in steps: 50 users for 2 minutes, then 100 users for 2 minutes, then 200 users for 2 minutes
```

## 🔧 Configuration

### Environment Variables

Key configuration options in `.env`:

```bash
# Application settings
NODE_ENV=production
APP_PORT=3000

# AI Provider settings
AI_PROVIDER=claude
AI_MODEL=claude-3-5-sonnet-20241022

# API Keys (if using cloud providers)
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GEMINI_API_KEY=your-gemini-key

# Resource limits
APP_MEMORY_LIMIT=1g
K6_MEMORY_LIMIT=2g
```

### Custom Payloads

The AI can generate various payload types:

- **Random IDs**: `{randomId}`, `{uuid}`
- **Timestamps**: `{timestamp}`, `{isoDate}`
- **Random Data**: `{randomString}`, `{randomNumber}`
- **Sequential Data**: `{sequence}`, `{counter}`

Example:

```
POST to https://api.example.com/users with payload:
{
  "id": "{uuid}",
  "name": "{randomString}",
  "email": "user{sequence}@example.com",
  "timestamp": "{isoDate}"
}
```

## 📊 Understanding Results

### Performance Metrics

The tool provides comprehensive metrics:

- **Response Times**: Min, max, average, and percentiles (50th, 90th, 95th, 99th)
- **Throughput**: Requests per second and bytes per second
- **Error Rates**: Success/failure ratios and error categorization
- **Resource Usage**: CPU and memory consumption during tests

### AI-Powered Recommendations

After each test, the AI analyzes results and provides:

- Performance bottleneck identification
- Optimization suggestions
- Capacity planning recommendations
- Error pattern analysis

### Export Formats

Results can be exported in multiple formats:

- **JSON**: Raw data for programmatic analysis
- **CSV**: Spreadsheet-compatible format
- **HTML**: Rich visual reports with charts

## 🛠️ Advanced Usage

### Custom Test Scenarios

#### Authentication Testing

```
Test API with JWT authentication:
1. POST login to get token
2. Use token for subsequent requests
3. Test 500 authenticated requests per minute
```

#### Complex JSON Payloads

```
Send POST requests to https://api.example.com/orders with complex JSON:
{
  "orderId": "{sequence}",
  "customer": {
    "name": "{randomString}",
    "email": "customer{sequence}@example.com"
  },
  "items": [
    {
      "productId": "PROD-{randomNumber}",
      "quantity": "{randomNumber:1-10}"
    }
  ]
}
```

### Performance Tuning

For high-volume or long-duration tests, ensure you have sufficient system resources:

- **Memory**: K6 executor may require additional memory for large tests
- **Network**: Ensure stable internet connection for AI API calls
- **Storage**: Test results are stored locally in `.stressmaster/` directory

## 🔍 Monitoring and Troubleshooting

### Health Checks

Verify your setup:

```bash
# Check StressMaster installation
stressmaster --version

# Check K6 installation
k6 version

# Test AI provider configuration
stressmaster setup
```

### Common Issues and Solutions

#### High Memory Usage

Monitor system resources using your OS tools (Activity Monitor on macOS, Task Manager on Windows, htop on Linux).

#### Test Execution Failures

```bash
# Verify target API accessibility
curl -I https://your-target-api.com

# Check K6 installation
k6 version

# Verify AI provider configuration
stressmaster setup
```

## 🔒 Security Considerations

### Network Security

- All API calls use HTTPS
- Input validation on all user inputs
- Secure storage of API keys in configuration files

### Data Security

- API keys stored locally in `.stressmaster/config/ai-config.json` (excluded from git)
- Test results stored locally in `.stressmaster/` directory
- No data sent to external services except configured AI providers

## 🚀 Installation Options

### Global Installation (Recommended)

```bash
npm install -g stressmaster
```

### Development Installation

```bash
git clone https://github.com/mumzworld-tech/StressMaster.git
cd StressMaster
npm install
npm run build
npm link
```

## 🤝 Contributing

### Development Setup

```bash
# Clone repository
git clone <repository-url>
cd stressmaster

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test
```

### Code Structure

```
src/
├── interfaces/    # User interfaces
│   └── cli/       # Command-line interface
├── core/          # Core functionality
│   ├── parser/    # AI command parsing
│   ├── generator/ # K6 script generation
│   ├── executor/  # Test execution
│   └── analyzer/  # Results analysis
├── types/         # TypeScript definitions
└── utils/         # Utility functions
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- Review the examples in this README for usage patterns
- Check the [CHANGELOG.md](./CHANGELOG.md) for recent updates
- Open an issue on [GitHub](https://github.com/mumzworld-tech/StressMaster/issues) for bugs or feature requests
