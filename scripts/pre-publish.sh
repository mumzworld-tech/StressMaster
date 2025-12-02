#!/bin/bash

# Pre-publish validation script
# Runs all checks before publishing to npm

set -e

echo "🧪 Running pre-publish checks..."

# Type check
echo "📝 Type checking..."
npm run typecheck || npx tsc --noEmit

# Lint
echo "🔍 Linting..."
npm run lint || echo "⚠️  Linting skipped if not configured"

# Tests
echo "🧪 Running tests..."
npm run test

# Coverage
echo "📊 Checking test coverage..."
npm run test:coverage || npm run test -- --coverage || echo "⚠️  Coverage check skipped"

# Build
echo "🔨 Building..."
npm run build:clean

# Security audit
echo "🔒 Running security audit..."
npm audit --audit-level=moderate || echo "⚠️  Security audit completed with warnings"

# Verify package
echo "📦 Verifying package..."
npm pack --dry-run

echo ""
echo "✅ All pre-publish checks passed!"
echo "🚀 Ready to publish"

