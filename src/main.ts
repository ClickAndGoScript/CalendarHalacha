/**
 * Main entry point for the Otzaria plugin
 */

/// <reference path="../Otzaria otzaria plugins lib-plugins_sdk/otzaria_plugin.d.ts" />

import type { BootPayload, ThemePayload } from '../Otzaria otzaria plugins lib-plugins_sdk/otzaria_plugin';

// Plugin state
let bootData: BootPayload | null = null;

/**
 * Initialize the plugin
 */
function init() {
  console.log('Plugin initializing...');

  // Listen for boot event
  Otzaria.on('plugin.boot', handleBoot);

  // Listen for ready event
  Otzaria.on('plugin.ready', handleReady);

  // Listen for theme changes
  Otzaria.on('theme.changed', handleThemeChange);
}

/**
 * Handle plugin boot event
 */
function handleBoot(data: BootPayload) {
  console.log('Plugin booted:', data);
  bootData = data;

  // Apply initial theme
  applyTheme(data.theme);

  // Initialize UI
  initializeUI();
}

/**
 * Handle plugin ready event
 */
function handleReady() {
  console.log('Plugin ready');
  // Plugin is fully initialized and ready for user interaction
}

/**
 * Handle theme change event
 */
function handleThemeChange(theme: ThemePayload) {
  console.log('Theme changed:', theme.mode);
  applyTheme(theme);
}

/**
 * Apply theme to the UI
 */
function applyTheme(theme: ThemePayload) {
  const { colorScheme, typography } = theme;

  // Apply colors
  document.documentElement.style.setProperty('--md-sys-color-primary', colorScheme.primary);
  document.documentElement.style.setProperty('--md-sys-color-on-primary', colorScheme.onPrimary);
  document.documentElement.style.setProperty('--md-sys-color-secondary', colorScheme.secondary);
  document.documentElement.style.setProperty('--md-sys-color-on-secondary', colorScheme.onSecondary);
  document.documentElement.style.setProperty('--md-sys-color-surface', colorScheme.surface);
  document.documentElement.style.setProperty('--md-sys-color-on-surface', colorScheme.onSurface);
  document.documentElement.style.setProperty('--md-sys-color-error', colorScheme.error);
  document.documentElement.style.setProperty('--md-sys-color-on-error', colorScheme.onError);

  // Apply typography
  document.documentElement.style.setProperty('--md-sys-typescale-body-font', typography.fontFamily);
  document.documentElement.style.setProperty('--md-sys-typescale-body-size', `${typography.fontSize}px`);
  document.documentElement.style.setProperty('--md-sys-typescale-body-line-height', `${typography.lineHeight}px`);

  // Apply background
  document.body.style.backgroundColor = colorScheme.surface;
  document.body.style.color = colorScheme.onSurface;
}

/**
 * Initialize the UI
 */
function initializeUI() {
  // TODO: Initialize Material Design 3 components
  // TODO: Set up event listeners
  // TODO: Load initial data
}

// Start the plugin
init();
