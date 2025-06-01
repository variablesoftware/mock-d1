#!/bin/bash

echo "🚀 Setting up the project..."

# Check if corepack is available
if ! command -v corepack &> /dev/null
then
  echo "⚠️  corepack is not available. Please ensure you are using Node.js 16.10+ and run:"
  echo ""
  echo "   corepack enable"
  echo ""
  echo "Then re-run this script."
  exit 1
fi

# Check if pnpm is available
if ! command -v pnpm &> /dev/null
then
  echo "🔧 pnpm is not installed yet. Installing correct pnpm version using corepack..."
  corepack prepare pnpm@latest --activate
fi

# Install dependencies
echo "📦 Installing dependencies with pnpm..."
pnpm install

echo "✅ Project setup complete!"
