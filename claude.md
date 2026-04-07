# Claude AI Assistant Guidelines

## Project-Specific Instructions

When working on this Otzaria plugin project, follow these guidelines:

### Understanding the Context

1. This is a plugin for Otzaria, a Jewish texts library application
2. The plugin runs in a WebView with a sandboxed JavaScript environment
3. Communication with the host app uses the `Otzaria` global object
4. The project uses Material Design 3 for UI components

### Code Generation

When generating code:

1. **Always use TypeScript** with the provided type definitions from `otzaria_plugin.d.ts`
2. **Check permissions** before using any API - verify they're declared in `manifest.json`
3. **Handle errors gracefully** - always check `response.success` and handle `response.error`
4. **Support RTL** - Otzaria's primary language is Hebrew (right-to-left)
5. **Respect themes** - Listen to theme changes and apply colors from the theme object

### File Organization

- Source code goes in `src/`
- Entry point (HTML) is referenced in `manifest.json`
- Keep TypeScript/JavaScript modular and well-organized
- Use ES modules for better code organization

### Manifest Updates

When modifying `manifest.json`:

1. Validate JSON syntax carefully
2. Ensure all required fields are present
3. Add permissions for any new API calls
4. Update version number for significant changes
5. Keep `sdkVersion` as `"1.x"` unless SDK changes

### API Usage Patterns

Always use this pattern for API calls:

```typescript
try {
  const response = await Otzaria.call('method.name', { params });
  if (response.success) {
    // Handle success
    return response.data;
  } else {
    // Handle error
    console.error(response.error?.message);
    await Otzaria.call('ui.showError', {
      message: response.error?.message || 'Unknown error'
    });
  }
} catch (error) {
  console.error('API call failed:', error);
}
```

### Material Design 3

When adding Material Design 3:

1. Import from CDN or install via npm
2. Apply theme colors from `bootData.theme.colorScheme`
3. Use Material components that support RTL
4. Follow Material Design guidelines for Hebrew typography

### Testing Considerations

Remind the user to:

1. Run Otzaria in debug mode for hot reload
2. Check the browser console for errors
3. Test with both light and dark themes
4. Test RTL layout with Hebrew text
5. Verify all permissions are granted

### Common Pitfalls to Avoid

1. Don't use APIs without declaring permissions
2. Don't assume LTR layout - always support RTL
3. Don't ignore theme changes - update UI dynamically
4. Don't use network access without declaring it in manifest
5. Don't forget to handle the `plugin.boot` event for initialization

### Helpful Reminders

- The `Otzaria` object is globally available - no import needed
- All API calls are asynchronous - use `await` or `.then()`
- Event listeners should be set up early (before `plugin.ready`)
- Storage is scoped to the plugin - no cross-plugin access
- Published data can be shared with the host app and other plugins

### When Suggesting Changes

1. Explain why the change is needed
2. Show the impact on permissions (if any)
3. Mention any manifest updates required
4. Consider backward compatibility
5. Suggest testing steps

## Development Workflow

Typical workflow when assisting:

1. Understand the feature request
2. Check if permissions are sufficient
3. Generate/modify code with proper error handling
4. Update manifest if needed
5. Suggest testing steps
6. Remind about hot reload capabilities

## Code Style

- Use modern JavaScript/TypeScript features
- Prefer `async/await` over callbacks
- Use descriptive variable names (Hebrew or English)
- Add comments for complex logic
- Keep functions small and focused
- Use TypeScript types from the SDK

## Security Considerations

- Validate all user input
- Sanitize HTML content before rendering
- Don't expose sensitive data in console logs
- Follow principle of least privilege for permissions
- Be cautious with `published_data` - it's shared globally
