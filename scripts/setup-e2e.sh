#!/bin/bash

# Setup script for E2E tests

set -e

echo "🔧 Setting up E2E test environment..."

# Check if .env.test.local exists, if not copy from .env.test
if [ ! -f .env.test.local ]; then
  echo "📝 Creating .env.test.local from .env.test template..."
  cp .env.test .env.test.local
  echo "⚠️  Please update .env.test.local with your actual credentials"
fi

# Install Playwright browsers
echo "🌐 Installing Playwright browsers..."
npx playwright install --with-deps chromium

echo "✅ E2E test setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env.test.local with your Supabase credentials"
echo "2. Start the dev server: npm run dev"
echo "3. Run tests: npm run test:e2e"
