#!/bin/bash
# StressMaster AI Provider Switcher
# Usage: ./scripts/switch-provider.sh [ollama|openai|claude|gemini|openrouter]
PROVIDER=${1:-ollama}
CONFIG_FILE="config/ai-config.json"

# Auto-create config directory if it doesn't exist
if [ ! -d "config" ]; then
  echo "📁 Creating config directory..."
  mkdir -p config
fi

# Auto-create config file if it doesn't exist (default to Ollama)
if [ ! -f "$CONFIG_FILE" ]; then
  echo "📝 Creating new AI configuration file..."
  cat > $CONFIG_FILE << EOF
{
  "provider": "ollama",
  "model": "llama3.2:1b",
  "endpoint": "http://localhost:11434",
  "maxRetries": 3,
  "timeout": 30000,
  "options": {
    "temperature": 0.1,
    "top_p": 0.9
  }
}
EOF
  echo "✅ Created default configuration (Ollama)"
fi

echo "🔄 Switching AI provider to: $PROVIDER"
case $PROVIDER in
  "ollama")
    cat > $CONFIG_FILE << EOF
{
  "provider": "ollama",
  "model": "llama3.2:1b",
  "endpoint": "http://localhost:11434",
  "maxRetries": 3,
  "timeout": 30000,
  "options": {
    "temperature": 0.1,
    "top_p": 0.9
  }
}
EOF
    echo "✅ Switched to Ollama (local, free)"
    echo "📝 Make sure Ollama is running: ollama serve"
    echo "📝 Pull a model: ollama pull llama3.2:1b"
    ;;
  "openai")
    echo "Please enter your OpenAI API key (it should start with sk-):"
    read -s OPENAI_API_KEY
    echo ""
    cat > $CONFIG_FILE << EOF
{
  "provider": "openai",
  "apiKey": "$OPENAI_API_KEY",
  "model": "gpt-3.5-turbo",
  "maxRetries": 3,
  "timeout": 30000,
  "options": {
    "temperature": 0.1
  }
}
EOF
    echo "✅ Switched to OpenAI"
    ;;
  "claude")
    echo "Please enter your Claude API key (it should start with sk-ant-):"
    read -s CLAUDE_API_KEY
    echo ""
    cat > $CONFIG_FILE << EOF
{
  "provider": "claude",
  "apiKey": "$CLAUDE_API_KEY",
  "model": "claude-3-5-sonnet-20241022",
  "maxRetries": 3,
  "timeout": 30000,
  "options": {
    "temperature": 0.1
  }
}
EOF
    echo "✅ Switched to Claude (direct API)"
    ;;
  "claude-openrouter")
    echo "Please enter your OpenRouter API key (it should start with sk-or-):"
    read -s OPENROUTER_API_KEY
    echo ""
    cat > $CONFIG_FILE << EOF
{
  "provider": "claude",
  "apiKey": "$OPENROUTER_API_KEY",
  "model": "claude-3-5-sonnet-20241022",
  "maxRetries": 3,
  "timeout": 30000,
  "options": {
    "temperature": 0.1
  }
}
EOF
    echo "✅ Switched to Claude via OpenRouter"
    echo "📝 This uses OpenRouter API key but Claude provider for compatibility"
    ;;
  "gemini")
    echo "Please enter your Google AI API key:"
    read -s GEMINI_API_KEY
    echo ""
    cat > $CONFIG_FILE << EOF
{
  "provider": "gemini",
  "apiKey": "$GEMINI_API_KEY",
  "model": "gemini-pro",
  "maxRetries": 3,
  "timeout": 30000,
  "options": {
    "temperature": 0.1
  }
}
EOF
    echo "✅ Switched to Gemini"
    ;;
  "openrouter")
    echo "Please enter your OpenRouter API key (it should start with sk-or-):"
    read -s OPENROUTER_API_KEY
    echo ""
    cat > $CONFIG_FILE << EOF
{
  "provider": "openrouter",
  "apiKey": "$OPENROUTER_API_KEY",
           "model": "anthropic/claude-3.5-sonnet",
  "maxRetries": 3,
  "timeout": 30000,
  "options": {
    "temperature": 0.1
  }
}
EOF
    echo "✅ Switched to OpenRouter"
    echo "📝 Available models: anthropic/claude-3-5-sonnet-20241022, openai/gpt-4, openai/gpt-3.5-turbo, google/gemini-pro"
    ;;
  *)
    echo "❌ Invalid provider: $PROVIDER"
    echo "📝 Supported providers: ollama, openai, claude, claude-openrouter, gemini, openrouter"
    echo ""
    echo "📋 Provider Options:"
    echo "  ollama           - Local AI models (free, requires Ollama)"
    echo "  openai           - OpenAI GPT models (requires OpenAI API key)"
    echo "  claude           - Claude models via direct API (requires Claude API key)"
    echo "  claude-openrouter - Claude models via OpenRouter (requires OpenRouter API key)"
    echo "  gemini           - Google Gemini models (requires Google AI API key)"
    echo "  openrouter       - Multiple models via OpenRouter (requires OpenRouter API key)"
    exit 1
    ;;
esac

echo ""
echo "🔧 Current configuration:"
cat $CONFIG_FILE | jq '.provider, .model' 2>/dev/null || cat $CONFIG_FILE
echo ""
echo "🚀 Test with: stressmaster \"GET 5 requests to https://httpbin.org/get\"" 