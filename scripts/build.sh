#!/bin/bash

echo "🔨 Building StressMaster..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Compiling TypeScript..."
npm run build

# Install globally
echo "🌍 Installing StressMaster globally..."
npm install -g .

echo "✅ StressMaster built and installed successfully!"
echo "🚀 You can now use: stressmaster or sm" 