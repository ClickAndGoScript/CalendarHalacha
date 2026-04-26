#!/usr/bin/env node
/**
 * Sync version from version.js to manifest.json and package.json
 * This script reads the version from version.js and updates the other files
 */

const fs = require('fs');
const path = require('path');

const versionPath = path.join(__dirname, '..', 'version.cjs');
const manifestPath = path.join(__dirname, '..', 'manifest.json');
const packagePath = path.join(__dirname, '..', 'package.json');

try {
  // Read version from version.js
  const versionModule = require(versionPath);
  const version = versionModule.version;
  
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid version format in version.js: ${version}`);
  }
  
  console.log(`Syncing version: ${version}`);
  
  // Update manifest.json
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.version = version;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`✅ Updated manifest.json`);
  
  // Update package.json
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  pkg.version = version;
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`✅ Updated package.json`);
  
  console.log(`✅ Version ${version} synced successfully!`);
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
