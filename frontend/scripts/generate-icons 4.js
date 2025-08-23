#!/usr/bin/env node

/**
 * Icon Generation Script for iOS App Store
 * 
 * This script generates all required iOS app icon sizes from a source SVG.
 * 
 * Requirements:
 * - ImageMagick or similar SVG to PNG converter
 * - Source icon at public/icons/app-icon.svg
 * 
 * To install ImageMagick on macOS: brew install imagemagick
 * 
 * Usage: npm run generate-icons
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const iconSizes = [
  { size: 20, scale: 2, filename: 'icon-20@2x.png' },
  { size: 20, scale: 3, filename: 'icon-20@3x.png' },
  { size: 29, scale: 2, filename: 'icon-29@2x.png' },
  { size: 29, scale: 3, filename: 'icon-29@3x.png' },
  { size: 40, scale: 2, filename: 'icon-40@2x.png' },
  { size: 40, scale: 3, filename: 'icon-40@3x.png' },
  { size: 60, scale: 2, filename: 'icon-60@2x.png' },
  { size: 60, scale: 3, filename: 'icon-60@3x.png' },
  { size: 1024, scale: 1, filename: 'icon-1024.png' },
  // Also generate for Capacitor
  { size: 512, scale: 2, filename: 'AppIcon-512@2x.png' }
];

const sourceIcon = 'public/icons/app-icon.svg';
const outputDir = 'ios/App/App/Assets.xcassets/AppIcon.appiconset';
const publicOutputDir = 'public/icons';

console.log('🎨 Generating iOS app icons...');

// Check if ImageMagick is available
try {
  execSync('which convert', { stdio: 'ignore' });
} catch (error) {
  console.error('❌ ImageMagick not found. Please install it:');
  console.error('   macOS: brew install imagemagick');
  console.error('   Or use an online SVG to PNG converter to manually create these sizes:');
  iconSizes.forEach(icon => {
    const actualSize = icon.size * icon.scale;
    console.error(`   ${actualSize}x${actualSize} -> ${icon.filename}`);
  });
  process.exit(1);
}

// Create output directories
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

if (!fs.existsSync(publicOutputDir)) {
  fs.mkdirSync(publicOutputDir, { recursive: true });
}

// Generate icons
iconSizes.forEach(icon => {
  const actualSize = icon.size * icon.scale;
  const outputPath = path.join(outputDir, icon.filename);
  const publicOutputPath = path.join(publicOutputDir, icon.filename);
  
  try {
    // Generate for iOS bundle
    execSync(`convert ${sourceIcon} -resize ${actualSize}x${actualSize} ${outputPath}`);
    
    // Also copy to public for web app use
    execSync(`convert ${sourceIcon} -resize ${actualSize}x${actualSize} ${publicOutputPath}`);
    
    console.log(`✅ Generated ${icon.filename} (${actualSize}x${actualSize})`);
  } catch (error) {
    console.error(`❌ Failed to generate ${icon.filename}:`, error.message);
  }
});

console.log('✅ Icon generation complete!');
