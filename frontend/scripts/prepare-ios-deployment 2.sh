#!/bin/bash

# iOS Deployment Preparation Script
# This script prepares the Link app for iOS App Store deployment

set -e

echo "🚀 Preparing Link app for iOS App Store deployment..."

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script requires macOS for iOS development"
    exit 1
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed"
    exit 1
fi

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is required but not installed"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Install dependencies if needed
echo "📦 Installing dependencies..."
npm install

# Run tests
echo "🧪 Running tests..."
npm test -- --watchAll=false --passWithNoTests

# Type check
echo "🔍 Running type check..."
npm run type-check

# Lint check
echo "🔧 Running lint check..."
npm run lint

# Build the app
echo "🔨 Building production app..."
npm run build:production

# Check if ImageMagick is available for icon generation
if command -v convert &> /dev/null; then
    echo "🎨 Generating app icons..."
    npm run generate-icons
else
    echo "⚠️  ImageMagick not found. Install with: brew install imagemagick"
    echo "   You'll need to generate icons manually or install ImageMagick"
fi

# Copy to iOS
echo "📱 Copying web assets to iOS project..."
npx cap copy ios

echo "✅ iOS deployment preparation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Install Xcode from the App Store (if not already installed)"
echo "2. Install CocoaPods: sudo gem install cocoapods"
echo "3. Install iOS dependencies: cd ios/App && pod install"
echo "4. Open Xcode project: npm run ios:open"
echo "5. Configure signing certificates in Xcode"
echo "6. Update backend URLs in .env.production"
echo "7. Follow the full checklist in IOS_DEPLOYMENT_CHECKLIST.md"
echo ""
echo "🔗 Resources:"
echo "- App Store metadata: app-store-metadata.json"
echo "- Deployment checklist: IOS_DEPLOYMENT_CHECKLIST.md" 
echo "- Legal content: src/content/legal/"
