#!/bin/bash

# Script to test StressMaster as a local package
# Usage: ./scripts/test-local-package.sh [method]
# Methods: pack (default), link, or direct

set -e

METHOD=${1:-pack}
STRESSMASTER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_PROJECT_DIR="$HOME/test-stressmaster-project"

echo "🧪 Testing StressMaster as Local Package"
echo "=========================================="
echo "Method: $METHOD"
echo "StressMaster dir: $STRESSMASTER_DIR"
echo ""

# Step 1: Build StressMaster
echo "📦 Building StressMaster..."
cd "$STRESSMASTER_DIR"
npm run build:clean

if [ ! -f "dist/cli.js" ]; then
    echo "❌ Build failed - dist/cli.js not found"
    exit 1
fi

echo "✅ Build successful"
echo ""

# Step 2: Create test project
echo "📁 Setting up test project..."
if [ -d "$TEST_PROJECT_DIR" ]; then
    echo "⚠️  Test project already exists at $TEST_PROJECT_DIR"
    read -p "Remove and recreate? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$TEST_PROJECT_DIR"
    else
        echo "Using existing test project"
    fi
fi

if [ ! -d "$TEST_PROJECT_DIR" ]; then
    mkdir -p "$TEST_PROJECT_DIR"
    cd "$TEST_PROJECT_DIR"
    npm init -y > /dev/null 2>&1
    
    # Create test files
    echo '{"test": "data", "id": 123}' > test-payload.json
    echo '{"name": "Test API", "version": "1.0.0"}' > api.yaml
    mkdir -p payloads
    echo '{"items": [{"id": 1, "name": "Item 1"}]}' > payloads/test-data.json
    
    echo "✅ Test project created at $TEST_PROJECT_DIR"
    echo "   Created test files: test-payload.json, api.yaml, payloads/test-data.json"
fi

cd "$TEST_PROJECT_DIR"
echo ""

# Step 3: Install based on method
case $METHOD in
    pack)
        echo "📦 Creating package tarball..."
        cd "$STRESSMASTER_DIR"
        PACK_FILE=$(npm pack 2>&1 | tail -1)
        PACK_PATH="$STRESSMASTER_DIR/$PACK_FILE"
        
        if [ ! -f "$PACK_PATH" ]; then
            echo "❌ Failed to create package tarball"
            exit 1
        fi
        
        echo "✅ Created: $PACK_FILE"
        echo ""
        echo "📥 Installing package in test project..."
        cd "$TEST_PROJECT_DIR"
        npm install "$PACK_PATH" --save-dev
        echo "✅ Package installed"
        ;;
        
    link)
        echo "🔗 Linking StressMaster..."
        cd "$STRESSMASTER_DIR"
        npm link
        
        cd "$TEST_PROJECT_DIR"
        npm link stressmaster
        echo "✅ Package linked"
        ;;
        
    direct)
        echo "📥 Installing directly from directory..."
        cd "$TEST_PROJECT_DIR"
        npm install "$STRESSMASTER_DIR" --save-dev
        echo "✅ Package installed"
        ;;
        
    *)
        echo "❌ Unknown method: $METHOD"
        echo "Available methods: pack, link, direct"
        exit 1
        ;;
esac

echo ""
echo "✅ Setup complete!"
echo ""
echo "🧪 Testing StressMaster..."
echo "=========================="
echo ""

# Test commands
cd "$TEST_PROJECT_DIR"

echo "1. Testing version command..."
if command -v stressmaster &> /dev/null; then
    stressmaster --version || npx stressmaster --version
else
    npx stressmaster --version
fi

echo ""
echo "2. Testing help command..."
npx stressmaster --help | head -10

echo ""
echo "3. Testing file resolution (this should find test-payload.json)..."
echo "   Command: stressmaster 'POST 5 requests to https://httpbin.org/post with @test-payload.json'"
echo "   (This will parse but not execute - check that file is found)"
echo ""

# Verify file resolution works
if [ -f "test-payload.json" ]; then
    echo "✅ Test file exists: test-payload.json"
    echo "   File content: $(cat test-payload.json)"
else
    echo "⚠️  Test file not found"
fi

echo ""
echo "📋 Next Steps:"
echo "=============="
echo "1. Test commands manually:"
echo "   cd $TEST_PROJECT_DIR"
echo "   npx stressmaster 'send 5 GET requests to https://httpbin.org/get'"
echo ""
echo "2. Test file references:"
echo "   npx stressmaster 'POST to https://httpbin.org/post with @test-payload.json'"
echo "   npx stressmaster 'test @api.yaml endpoints'"
echo ""
echo "3. Test interactive mode:"
echo "   npx stressmaster"
echo ""
echo "4. Clean up when done:"
if [ "$METHOD" = "link" ]; then
    echo "   cd $TEST_PROJECT_DIR && npm unlink stressmaster"
    echo "   cd $STRESSMASTER_DIR && npm unlink"
else
    echo "   rm -rf $TEST_PROJECT_DIR"
    if [ "$METHOD" = "pack" ]; then
        echo "   rm $STRESSMASTER_DIR/stressmaster-*.tgz"
    fi
fi

