#!/usr/bin/env node

/**
 * Color Contrast Audit Script
 * Analyzes color combinations for WCAG AA compliance (4.5:1 ratio)
 */

const tailwindConfig = require('../tailwind.config.js');

// Convert hex to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Calculate relative luminance
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Calculate contrast ratio
function getContrastRatio(color1, color2) {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) return 0;
  
  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  
  return (brightest + 0.05) / (darkest + 0.05);
}

// Check if contrast meets WCAG AA standard
function meetsWCAG_AA(ratio) {
  return ratio >= 4.5;
}

function meetsWCAG_AAA(ratio) {
  return ratio >= 7;
}

// Extract colors from tailwind config
const colors = tailwindConfig.theme.extend.colors;

console.log('🎨 Color Contrast Audit for WCAG AA Compliance');
console.log('=' .repeat(60));

const results = [];
const issues = [];

// Common background colors (light backgrounds)
const lightBackgrounds = ['#ffffff', '#f8fafc', '#f1f5f9']; // surface.card, surface.dark, surface.hover

// Common dark backgrounds
const darkBackgrounds = ['#1f2937', '#374151']; // text.primary, darker variant

// Test primary colors against light backgrounds
console.log('\n📋 PRIMARY COLORS vs LIGHT BACKGROUNDS');
console.log('-'.repeat(40));

Object.entries(colors.primary).forEach(([shade, color]) => {
  lightBackgrounds.forEach((bg, bgIndex) => {
    const bgName = ['white', 'surface.dark', 'surface.hover'][bgIndex];
    const ratio = getContrastRatio(color, bg);
    const passes = meetsWCAG_AA(ratio);
    const passesAAA = meetsWCAG_AAA(ratio);
    
    const result = {
      foreground: `primary-${shade}`,
      foregroundColor: color,
      background: bgName,
      backgroundColor: bg,
      ratio: ratio.toFixed(2),
      wcagAA: passes,
      wcagAAA: passesAAA
    };
    
    results.push(result);
    
    console.log(`primary-${shade.padEnd(3)} on ${bgName.padEnd(12)} | Ratio: ${ratio.toFixed(2)} | ${passes ? '✅' : '❌'} AA ${passesAAA ? '✅' : '❌'} AAA`);
    
    if (!passes && (shade === '400' || shade === '500' || shade === '600')) {
      issues.push({
        ...result,
        suggestion: `Consider using primary-${parseInt(shade) + 100 < 900 ? parseInt(shade) + 100 : 900} instead`
      });
    }
  });
});

// Test text colors against light backgrounds
console.log('\n📋 TEXT COLORS vs LIGHT BACKGROUNDS');
console.log('-'.repeat(40));

Object.entries(colors.text).forEach(([level, color]) => {
  lightBackgrounds.forEach((bg, bgIndex) => {
    const bgName = ['white', 'surface.dark', 'surface.hover'][bgIndex];
    const ratio = getContrastRatio(color, bg);
    const passes = meetsWCAG_AA(ratio);
    const passesAAA = meetsWCAG_AAA(ratio);
    
    const result = {
      foreground: `text-${level}`,
      foregroundColor: color,
      background: bgName,
      backgroundColor: bg,
      ratio: ratio.toFixed(2),
      wcagAA: passes,
      wcagAAA: passesAAA
    };
    
    results.push(result);
    
    console.log(`text-${level.padEnd(9)} on ${bgName.padEnd(12)} | Ratio: ${ratio.toFixed(2)} | ${passes ? '✅' : '❌'} AA ${passesAAA ? '✅' : '❌'} AAA`);
    
    if (!passes) {
      issues.push({
        ...result,
        suggestion: 'Consider using a darker text color'
      });
    }
  });
});

// Test accent colors
console.log('\n📋 ACCENT COLORS vs LIGHT BACKGROUNDS');
console.log('-'.repeat(40));

Object.entries(colors.accent).forEach(([name, color]) => {
  lightBackgrounds.forEach((bg, bgIndex) => {
    const bgName = ['white', 'surface.dark', 'surface.hover'][bgIndex];
    const ratio = getContrastRatio(color, bg);
    const passes = meetsWCAG_AA(ratio);
    const passesAAA = meetsWCAG_AAA(ratio);
    
    const result = {
      foreground: `accent-${name}`,
      foregroundColor: color,
      background: bgName,
      backgroundColor: bg,
      ratio: ratio.toFixed(2),
      wcagAA: passes,
      wcagAAA: passesAAA
    };
    
    results.push(result);
    
    console.log(`accent-${name.padEnd(12)} on ${bgName.padEnd(12)} | Ratio: ${ratio.toFixed(2)} | ${passes ? '✅' : '❌'} AA ${passesAAA ? '✅' : '❌'} AAA`);
    
    if (!passes) {
      issues.push({
        ...result,
        suggestion: 'Consider using a darker shade'
      });
    }
  });
});

// Test aqua colors
console.log('\n📋 AQUA COLORS vs LIGHT BACKGROUNDS');
console.log('-'.repeat(40));

Object.entries(colors.aqua).forEach(([level, color]) => {
  lightBackgrounds.forEach((bg, bgIndex) => {
    const bgName = ['white', 'surface.dark', 'surface.hover'][bgIndex];
    const ratio = getContrastRatio(color, bg);
    const passes = meetsWCAG_AA(ratio);
    const passesAAA = meetsWCAG_AAA(ratio);
    
    const result = {
      foreground: `aqua-${level}`,
      foregroundColor: color,
      background: bgName,
      backgroundColor: bg,
      ratio: ratio.toFixed(2),
      wcagAA: passes,
      wcagAAA: passesAAA
    };
    
    results.push(result);
    
    console.log(`aqua-${level.padEnd(7)} on ${bgName.padEnd(12)} | Ratio: ${ratio.toFixed(2)} | ${passes ? '✅' : '❌'} AA ${passesAAA ? '✅' : '❌'} AAA`);
    
    if (!passes) {
      issues.push({
        ...result,
        suggestion: 'Consider using aqua-dark or aqua-deeper'
      });
    }
  });
});

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 SUMMARY');
console.log('='.repeat(60));

const totalTests = results.length;
const passedAA = results.filter(r => r.wcagAA).length;
const passedAAA = results.filter(r => r.wcagAAA).length;

console.log(`Total color combinations tested: ${totalTests}`);
console.log(`WCAG AA compliant (≥4.5:1): ${passedAA}/${totalTests} (${((passedAA/totalTests)*100).toFixed(1)}%)`);
console.log(`WCAG AAA compliant (≥7:1): ${passedAAA}/${totalTests} (${((passedAAA/totalTests)*100).toFixed(1)}%)`);

if (issues.length > 0) {
  console.log('\n🚨 ISSUES FOUND:');
  console.log('-'.repeat(40));
  issues.forEach((issue, index) => {
    console.log(`${index + 1}. ${issue.foreground} on ${issue.background}`);
    console.log(`   Ratio: ${issue.ratio}:1 (needs ≥4.5:1)`);
    console.log(`   💡 ${issue.suggestion}`);
    console.log('');
  });
  
  // Generate improved color suggestions
  console.log('🎨 SUGGESTED TAILWIND CONFIG UPDATES:');
  console.log('-'.repeat(40));
  console.log('Consider updating these colors in tailwind.config.js:');
  
  const uniqueIssues = issues.filter((issue, index, arr) => 
    arr.findIndex(i => i.foreground === issue.foreground) === index
  );
  
  uniqueIssues.forEach(issue => {
    if (issue.foreground.startsWith('primary-')) {
      const currentShade = issue.foreground.split('-')[1];
      const suggestedShade = Math.min(parseInt(currentShade) + 100, 900);
      console.log(`// ${issue.foreground}: Consider using primary-${suggestedShade} instead`);
    } else if (issue.foreground.startsWith('aqua-')) {
      console.log(`// ${issue.foreground}: Consider using aqua-dark (#0891b2) or aqua-deeper (#0e7490)`);
    }
  });
}

console.log('\n✨ Audit complete! Run "npm run lint" to check for additional a11y issues.');

// Save results to JSON for further analysis
const fs = require('fs');
fs.writeFileSync('contrast-audit-results.json', JSON.stringify({
  summary: {
    totalTests,
    passedAA,
    passedAAA,
    aaPercentage: ((passedAA/totalTests)*100).toFixed(1),
    aaaPercentage: ((passedAAA/totalTests)*100).toFixed(1)
  },
  results,
  issues
}, null, 2));

console.log('📄 Detailed results saved to contrast-audit-results.json');

process.exit(issues.length > 0 ? 1 : 0);
