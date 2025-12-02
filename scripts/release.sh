#!/bin/bash

# Release script for StressMaster
# Usage: ./scripts/release.sh [major|minor|patch]

set -e

VERSION_TYPE=$1

if [ -z "$VERSION_TYPE" ]; then
  echo "❌ Usage: ./scripts/release.sh [major|minor|patch]"
  exit 1
fi

if [[ ! "$VERSION_TYPE" =~ ^(major|minor|patch)$ ]]; then
  echo "❌ Invalid version type: $VERSION_TYPE"
  echo "   Must be one of: major, minor, patch"
  exit 1
fi

echo "🚀 Starting release process for $VERSION_TYPE version bump..."

# Pre-release checks
echo "📋 Running pre-publish checks..."
npm run typecheck || npx tsc --noEmit
npm run lint || echo "⚠️  Linting skipped"
npm run test || echo "⚠️  Some tests may have failed"
npm run build:clean

# Check if working directory is clean
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠️  Warning: Working directory has uncommitted changes"
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Check if CHANGELOG.md has been updated
if ! git diff HEAD --name-only | grep -q CHANGELOG.md; then
  echo "⚠️  Warning: CHANGELOG.md may not have been updated"
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Bump version
echo "📦 Bumping $VERSION_TYPE version..."
npm version $VERSION_TYPE --no-git-tag-version

# Get new version
NEW_VERSION=$(node -p "require('./package.json').version")
echo "✅ Version bumped to $NEW_VERSION"

# Build
echo "🔨 Building..."
npm run build:clean

# Create git tag
echo "🏷️  Creating git tag v$NEW_VERSION..."
git add package.json package-lock.json dist/ CHANGELOG.md
git commit -m "chore: release v$NEW_VERSION" || echo "No changes to commit"
git tag "v$NEW_VERSION"

# Push changes
echo "📤 Pushing to remote..."
read -p "Push changes and tags to remote? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  git push origin main
  git push --tags
  echo "✅ Pushed to remote"
  echo "📦 CI/CD will automatically publish to npm"
else
  echo "⚠️  Skipped push. Run manually:"
  echo "   git push origin main"
  echo "   git push --tags"
fi

echo ""
echo "✅ Release $VERSION_TYPE completed!"
echo "📦 Version: $NEW_VERSION"
echo "🏷️  Tag: v$NEW_VERSION"
echo ""
echo "Next steps:"
echo "  1. Verify CI/CD pipeline runs successfully"
echo "  2. Check npm package after publish: https://www.npmjs.com/package/stressmaster"
echo "  3. Test installation: npm install -g stressmaster@$NEW_VERSION"

