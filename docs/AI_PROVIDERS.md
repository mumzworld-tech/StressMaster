# AI Providers

StressMaster supports multiple AI providers for parsing natural language commands. You can choose the provider that best fits your needs, budget, and privacy requirements.

## Supported Providers

### 🏠 Local Providers

#### Ollama (Default)

- **Cost**: Free
- **Privacy**: Complete privacy (runs locally)
- **Models**: LLaMA, Mistral, CodeLlama, Phi, and more
- **Setup**: Requires Ollama installation
- **Best for**: Privacy-conscious users, offline usage, cost-sensitive projects

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull llama3.2:1b

# Configure (default)
export AI_PROVIDER=ollama
export AI_MODEL=llama3.2:1b
export AI_ENDPOINT=http://localhost:11434
```

### ☁️ Cloud Providers

#### OpenAI

- **Cost**: Pay per token
- **Privacy**: Data sent to OpenAI
- **Models**: GPT-3.5-turbo, GPT-4, GPT-4-turbo
- **Setup**: Requires API key
- **Best for**: High accuracy, latest AI capabilities

```bash
export AI_PROVIDER=openai
export AI_API_KEY=sk-your-openai-api-key
export AI_MODEL=gpt-3.5-turbo
```

#### Anthropic Claude

- **Cost**: Pay per token
- **Privacy**: Data sent to Anthropic
- **Models**: Claude 3 Haiku, Sonnet, Opus
- **Setup**: Requires API key
- **Best for**: Detailed reasoning, safety-focused AI

```bash
export AI_PROVIDER=claude
export AI_API_KEY=sk-ant-your-claude-api-key
export AI_MODEL=claude-3-sonnet-20240229
```

#### Google Gemini

- **Cost**: Free tier available, then pay per token
- **Privacy**: Data sent to Google
- **Models**: Gemini Pro, Gemini Pro Vision
- **Setup**: Requires API key
- **Best for**: Multimodal capabilities, Google ecosystem

```bash
export AI_PROVIDER=gemini
export AI_API_KEY=your-google-ai-api-key
export AI_MODEL=gemini-pro
```

## Configuration

### Environment Variables

```bash
# Provider selection
AI_PROVIDER=ollama|openai|claude|gemini

# API credentials (for cloud providers)
AI_API_KEY=your-api-key-here

# Model selection
AI_MODEL=model-name

# Custom endpoint (optional)
AI_ENDPOINT=https://custom-endpoint.com

# Performance tuning
AI_MAX_RETRIES=3
AI_TIMEOUT=30000
```

### Configuration File

Create `config/ai-config.json`:

```json
{
  "provider": "openai",
  "apiKey": "${AI_API_KEY}",
  "model": "gpt-3.5-turbo",
  "maxRetries": 3,
  "timeout": 30000,
  "options": {
    "temperature": 0.1
  }
}
```

### Programmatic Configuration

```typescript
import { UnifiedCommandParser } from "./core/parser";

const parser = new UnifiedCommandParser({
  provider: "openai",
  apiKey: process.env.AI_API_KEY,
  model: "gpt-3.5-turbo",
  maxRetries: 3,
  timeout: 30000,
});

await parser.initialize();
```

## Provider Comparison

| Provider | Cost   | Privacy    | Accuracy   | Speed      | Offline |
| -------- | ------ | ---------- | ---------- | ---------- | ------- |
| Ollama   | Free   | ⭐⭐⭐⭐⭐ | ⭐⭐⭐     | ⭐⭐⭐     | ✅      |
| OpenAI   | $$     | ⭐⭐       | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ❌      |
| Claude   | $$     | ⭐⭐       | ⭐⭐⭐⭐   | ⭐⭐⭐⭐   | ❌      |
| Gemini   | $/Free | ⭐⭐       | ⭐⭐⭐⭐   | ⭐⭐⭐⭐   | ❌      |

## Switching Providers

You can easily switch between providers:

```bash
# Switch to OpenAI
export AI_PROVIDER=openai
export AI_API_KEY=sk-your-key

# Switch to Claude
export AI_PROVIDER=claude
export AI_API_KEY=sk-ant-your-key

# Switch back to Ollama
export AI_PROVIDER=ollama
unset AI_API_KEY
```

## Fallback System

If the selected AI provider fails, the system automatically falls back to rule-based parsing to ensure your load tests can still run.

## Adding New Providers

Want to add support for a new AI provider? Check out our [Contributing Guide](../CONTRIBUTING.md) for instructions on implementing new providers.

## Troubleshooting

### Ollama Issues

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama
ollama serve

# Pull a model
ollama pull llama3.2:1b
```

### API Key Issues

```bash
# Verify your API key is set
echo $AI_API_KEY

# Test API connectivity
curl -H "Authorization: Bearer $AI_API_KEY" https://api.openai.com/v1/models
```

### Model Not Found

```bash
# List available models for your provider
# (This varies by provider - check their documentation)
```

## Best Practices

1. **Start with Ollama** for development and testing
2. **Use cloud providers** for production with high accuracy needs
3. **Set appropriate timeouts** based on your provider's typical response times
4. **Monitor usage costs** for cloud providers
5. **Keep API keys secure** and rotate them regularly
6. **Test fallback scenarios** to ensure reliability

## Future Providers

Coming soon:

- Azure OpenAI
- Cohere
- Hugging Face Transformers
- AWS Bedrock
- Custom API endpoints

Want to contribute a new provider? We'd love your help!
