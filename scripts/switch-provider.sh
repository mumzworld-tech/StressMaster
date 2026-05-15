#!/bin/bash
# StressMaster AI Provider Switcher
# Usage: ./scripts/switch-provider.sh [openai|claude|claude-openrouter|gemini|openrouter|amazonq]
PROVIDER=${1:-claude-openrouter}
CONFIG_DIR=".stressmaster/config"
CONFIG_FILE="$CONFIG_DIR/ai-config.json"

# Auto-create config directory if it doesn't exist
if [ ! -d "$CONFIG_DIR" ]; then
  echo "📁 Creating StressMaster config directory..."
  mkdir -p "$CONFIG_DIR"
fi

echo "🔄 Switching AI provider to: $PROVIDER"
case $PROVIDER in
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
  "amazonq")
    echo "Please enter your Amazon Q API key:"
    read -s AMAZON_Q_API_KEY
    echo ""
    cat > $CONFIG_FILE << EOF
{
  "provider": "amazonq",
  "apiKey": "$AMAZON_Q_API_KEY",
  "model": "amazon.q-developer",
  "endpoint": "https://q.us-east-1.amazonaws.com",
  "maxRetries": 3,
  "timeout": 30000,
  "options": {
    "temperature": 0.1
  }
}
EOF
    echo "✅ Switched to Amazon Q"
    echo "📝 Model: amazon.q-developer"
    echo "📝 Get your API key from: https://aws.amazon.com/q/developer/"
    ;;
  *)
    echo "❌ Invalid provider: $PROVIDER"
    echo "📝 Supported providers: openai, claude, claude-openrouter, gemini, openrouter, amazonq"
    echo ""
    echo "📋 Provider Options:"
    echo "  openai           - OpenAI GPT models (requires OpenAI API key)"
    echo "  claude           - Claude models via direct API (requires Claude API key)"
    echo "  claude-openrouter - Claude models via OpenRouter (requires OpenRouter API key)"
    echo "  gemini           - Google Gemini models (requires Google AI API key)"
    echo "  openrouter       - Multiple models via OpenRouter (requires OpenRouter API key)"
    echo "  amazonq          - Amazon Q Developer AI models (requires Amazon Q API key)"
    exit 1
    ;;
esac

echo ""
echo "🔧 Current configuration:"
cat $CONFIG_FILE | jq '.provider, .model' 2>/dev/null || cat $CONFIG_FILE
echo ""
echo "🚀 Test with: stressmaster \"GET 5 requests to https://httpbin.org/get\"" 