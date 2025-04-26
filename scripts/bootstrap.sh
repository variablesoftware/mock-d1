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

# Check if yarn is available
if ! command -v yarn &> /dev/null
then
  echo "🔧 Yarn is not installed yet. Installing correct Yarn version using corepack..."
  corepack prepare yarn@stable --activate
fi

# Install dependencies
echo "📦 Installing dependencies with Yarn..."
yarn install

echo "✅ Project setup complete!"
