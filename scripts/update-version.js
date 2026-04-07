#!/usr/bin/env node
/**
 * Version bump script for Otzaria plugin
 * Updates version in both manifest.json and package.json
 * 
 * Usage:
 *   node scripts/bump-version.js <major|minor|patch|X.Y.Z>
 * 
 * Examples:
 *   node scripts/bump-version.js patch    # 1.0.0 -> 1.0.1
 *   node scripts/bump-version.js minor    # 1.0.0 -> 1.1.0
 *   node scripts/bump-version.js major    # 1.0.0 -> 2.0.0
 *   node scripts/bump-version.js 2.5.3    # Set to 2.5.3
 */

const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '..', 'manifest.json');
const packagePath = path.join(__dirname, '..', 'package.json');

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3])
  };
}

function bumpVersion(currentVersion, type) {
  const version = parseVersion(currentVersion);
  
  switch (type) {
    case 'major':
      version.major++;
      version.minor = 0;
      version.patch = 0;
      break;
    case 'minor':
      version.minor++;
      version.patch = 0;
      break;
    case 'patch':
      version.patch++;
      break;
    default:
      // Assume it's a specific version
      return parseVersion(type);
  }
  
  return version;
}

function versionToString(version) {
  return `${version.major}.${version.minor}.${version.patch}`;
}

function updateFile(filePath, newVersion) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  content.version = newVersion;
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
}

// Main
const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error('Usage: node bump-version.js <major|minor|patch|X.Y.Z>');
  process.exit(1);
}

const bumpType = args[0];

try {
  // Read current version from manifest
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const currentVersion = manifest.version;
  
  console.log(`Current version: ${currentVersion}`);
  
  // Calculate new version
  const newVersionObj = bumpVersion(currentVersion, bumpType);
  const newVersion = versionToString(newVersionObj);
  
  console.log(`New version: ${newVersion}`);
  
  // Update both files
  updateFile(manifestPath, newVersion);
  updateFile(packagePath, newVersion);
  
  console.log('✅ Version updated successfully!');
  console.log(`   manifest.json: ${newVersion}`);
  console.log(`   package.json: ${newVersion}`);
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
