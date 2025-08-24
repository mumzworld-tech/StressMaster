#!/bin/bash

echo "🚀 Installing StressMaster..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Build the project
echo "📦 Building StressMaster..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please check the errors above."
    exit 1
fi

# Install globally
echo "🔧 Installing StressMaster globally..."
npm install -g .

if [ $? -ne 0 ]; then
    echo "❌ Installation failed. Try running with sudo: sudo npm install -g ."
    exit 1
fi

echo ""
echo "✅ StressMaster installed successfully!"
echo ""
echo "🎯 Usage Examples:"
echo "   stressmaster --help                    # Show help"
echo "   stressmaster --version                 # Show version"
echo "   stressmaster \"send 10 GET requests to https://httpbin.org/get\""
echo "   stressmaster \"spike test with 50 requests in 30 seconds\""
echo "   sm export html                         # Export results (short alias)"
echo ""
echo "🚀 Happy load testing!" 