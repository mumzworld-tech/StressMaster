# StressMaster

A local-first AI-powered load testing tool that accepts natural language commands to perform API load testing. The system uses a local LLM (LLaMA3 via Ollama) to parse user prompts and convert them into structured load test specifications that can be executed using K6.

## 🚀 Features

- **Natural Language Interface**: Describe load tests in plain English
- **Local AI Processing**: Uses LLaMA3 model running locally via Ollama
- **Multiple Test Types**: Spike, stress, endurance, volume, and baseline testing
- **K6 Integration**: Generates and executes K6 scripts automatically
- **Real-time Monitoring**: Live progress tracking and metrics
- **Comprehensive Reporting**: Detailed analysis with AI-powered recommendations
- **Export Formats**: JSON, CSV, and HTML export capabilities
- **Docker-based**: Fully containerized for easy deployment
- **No Cloud Dependencies**: Runs entirely on your local machine

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

- **Docker**: Version 20.10 or higher
- **Docker Compose**: Version 2.0 or higher
- **System Memory**: Minimum 8GB RAM (16GB recommended)
- **Storage**: Minimum 20GB free space
- **Network**: Internet access for initial setup

## 🚀 Quick Start

### 1. Installation

#### Option A: Global Installation (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd stressmaster

# Install globally
./install.sh

# Or manually:
npm run build
npm install -g .
```

#### Option B: Docker Installation

```bash
# Clone the repository
git clone <repository-url>
cd stressmaster

# Copy environment configuration
cp .env.example .env

# Deploy the application
./scripts/deploy.sh
```

### 2. First Load Test

#### Using Global Installation:

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

#### Using Docker Installation:

```bash
# Access the interactive CLI
docker-compose exec stressmaster npm start
```

Try your first load test:

```
Send 100 GET requests to https://httpbin.org/get over 30 seconds
```

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

### Aliases

- `stressmaster` - Full command name
- `sm` - Short alias for quick commands

## 🤖 AI Model Setup

StressMaster supports multiple AI model configurations. Choose the setup that best fits your needs:

### Option 1: Local Ollama (Recommended)

**Advantages**: No API costs, completely private, works offline

#### Setup Steps:

1. **Install Ollama** (if not using Docker):

   ```bash
   # macOS/Linux
   curl -fsSL https://ollama.ai/install.sh | sh

   # Windows
   # Download from https://ollama.ai/download
   ```

2. **Pull the LLaMA3 Model**:

   ```bash
   # Pull the recommended model
   ollama pull llama3.2:1b

   # Or try other models
   ollama pull llama3:latest
   ollama pull llama3.1:8b
   ```

3. **Configure StressMaster**:

   ```bash
   # Edit your .env file
   AI_PROVIDER=ollama
   OLLAMA_ENDPOINT=http://localhost:11434
   MODEL_NAME=llama3.2:1b
   ```

4. **Start Ollama**:

   ```bash
   # Start Ollama service
   ollama serve

   # In another terminal, verify it's working
   ollama list
   ```

#### Docker Setup (Alternative):

```bash
# Start Ollama in Docker
docker run -d --name ollama -p 11434:11434 -v ollama_data:/root/.ollama ollama/ollama

# Pull model
docker exec -it ollama ollama pull llama3.2:1b
```

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

Create or edit `config/ai-config.json`:

```json
{
  "provider": "ollama",
  "ollama": {
    "endpoint": "http://localhost:11434",
    "model": "llama3.2:1b"
  },
  "openai": {
    "apiKey": "your-openai-key",
    "model": "gpt-4",
    "maxTokens": 2000
  },
  "anthropic": {
    "apiKey": "your-anthropic-key",
    "model": "claude-3-sonnet-20240229",
    "maxTokens": 2000
  },
  "gemini": {
    "apiKey": "your-gemini-key",
    "model": "gemini-pro",
    "maxTokens": 2000
  }
}
```

### Model Comparison

| Provider  | Model           | Cost              | Performance | Setup Complexity |
| --------- | --------------- | ----------------- | ----------- | ---------------- |
| Ollama    | LLaMA3.2:1b     | Free              | Good        | Medium           |
| Ollama    | LLaMA3.1:8b     | Free              | Better      | Medium           |
| OpenAI    | GPT-3.5-turbo   | $0.0015/1K tokens | Excellent   | Easy             |
| OpenAI    | GPT-4           | $0.03/1K tokens   | Best        | Easy             |
| Anthropic | Claude 3 Sonnet | $0.003/1K tokens  | Excellent   | Easy             |
| Google    | Gemini Pro      | $0.0005/1K tokens | Good        | Easy             |

### Troubleshooting AI Setup

#### Ollama Issues:

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Restart Ollama
sudo systemctl restart ollama
# or
ollama serve

# Check model availability
ollama list

# Pull model if missing
ollama pull llama3.2:1b
```

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

#### Performance Optimization:

```bash
# For Ollama - increase memory
export OLLAMA_HOST=0.0.0.0
export OLLAMA_ORIGINS=*
export OLLAMA_MODELS=/path/to/models

# For better performance with local models
ollama run llama3.2:1b --gpu
```

## 💡 Usage Examples

### Basic Load Tests

#### Simple GET Request Test

```
Test https://api.example.com/users with 50 requests
```

#### POST Request with Payload

```
Send 200 POST requests to https://api.example.com/orders with random order data
```

#### Spike Testing

```
Perform a spike test on https://api.example.com/products with 1000 requests in 10 seconds
```

#### Stress Testing with Ramp-up

```
Stress test https://api.example.com/search starting with 10 users,
ramping up to 500 users over 10 minutes, then maintain for 20 minutes
```

#### Endurance Testing

```
Run endurance test on https://api.example.com/health with 50 constant users for 2 hours
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
AI_PROVIDER=ollama
OLLAMA_PORT=11434
MODEL_NAME=llama3.2:1b

# API Keys (if using cloud providers)
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GEMINI_API_KEY=your-gemini-key

# Resource limits
OLLAMA_MEMORY_LIMIT=4g
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

#### For High-Volume Testing

```bash
# Increase resource limits
OLLAMA_MEMORY_LIMIT=8g
APP_MEMORY_LIMIT=2g
K6_MEMORY_LIMIT=4g

# Restart services
docker-compose down && docker-compose up -d
```

#### For Long-Duration Tests

```bash
# Enable persistent storage
docker volume create stressmaster-results

# Monitor resources
./scripts/monitor.sh monitor
```

## 🔍 Monitoring and Troubleshooting

### Health Checks

Check system status:

```bash
# Quick status check
./scripts/monitor.sh status

# Continuous monitoring
./scripts/monitor.sh monitor

# Detailed health check
curl http://localhost:11434/api/tags
```

### Log Analysis

Collect and analyze logs:

```bash
# Collect all logs
./scripts/monitor.sh logs

# View real-time logs
docker-compose logs -f

# Filter specific service logs
docker-compose logs -f stressmaster
docker-compose logs -f ollama
```

### Common Issues and Solutions

#### AI Model Not Responding

```bash
# Check Ollama service
docker-compose logs ollama

# Restart Ollama
docker-compose restart ollama

# Reinitialize model
docker-compose --profile init up model-init
```

#### High Memory Usage

```bash
# Check resource usage
docker stats

# Reduce memory limits
echo "OLLAMA_MEMORY_LIMIT=2g" >> .env
docker-compose restart
```

#### Test Execution Failures

```bash
# Check K6 logs
docker-compose logs k6-runner

# Verify target API accessibility
curl -I https://your-target-api.com

# Check network connectivity
docker-compose exec stressmaster ping your-target-api.com
```

## 🔒 Security Considerations

### Network Security

- Services communicate via isolated Docker network
- Only necessary ports exposed to host
- Input validation on all user inputs

### Data Security

- No data sent to external services (with local Ollama)
- Local model processing only
- Configurable data retention policies

### Container Security

- Non-root user execution
- Read-only file systems where possible
- Resource limits to prevent DoS

## 🚀 Deployment Options

### Development

```bash
# Quick development setup
docker-compose up -d
```

### Production

```bash
# Production deployment with monitoring
./scripts/deploy.sh
./scripts/monitor.sh monitor
```

### CI/CD Integration

```bash
# Automated testing in CI
docker-compose -f docker-compose.yml -f docker-compose.ci.yml up --abort-on-container-exit
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

- Check the [FAQ](docs/FAQ.md) for common issues
- Review [examples](docs/EXAMPLES.md) for usage patterns
- Consult [troubleshooting guide](docs/TROUBLESHOOTING.md) for solutions
- Open an issue on GitHub for bugs or feature requests
