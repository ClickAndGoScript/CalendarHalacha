# AI Agent Instructions

## Project Context

This is an Otzaria plugin project. Otzaria is a Jewish texts library application, and this plugin extends its functionality using web technologies.

## Key Technologies

- **Otzaria Plugin SDK**: JavaScript/TypeScript SDK for interacting with the host application
- **Material Design 3**: UI component library for consistent design
- **Web Technologies**: HTML, CSS, JavaScript/TypeScript

## Development Guidelines

### Plugin Architecture

1. **Manifest-Driven**: All plugin metadata, permissions, and capabilities are declared in `manifest.json`
2. **WebView-Based**: Plugins run in a sandboxed WebView environment
3. **Event-Driven**: Communication with the host uses an event-based API (`Otzaria.call()` and `Otzaria.on()`)

### Code Organization

- Keep source code in the `src/` directory
- Entry point is specified in the manifest (`entrypoint` field)
- Use TypeScript definitions from `otzaria_plugin.d.ts` for type safety

### Permissions

Always declare required permissions in the manifest:
- `search.fulltext.read` - Search library content
- `reader.open` - Open books in the reader
- `ui.feedback` - Show UI messages
- `plugin.storage.read/write` - Store plugin data
- `calendar.read` - Access calendar data
- `published_data.write` - Publish data to the app

### Best Practices

1. **Type Safety**: Use TypeScript and the provided type definitions
2. **Error Handling**: Always check `response.success` when calling `Otzaria.call()`
3. **Responsive Design**: Support both RTL and LTR layouts
4. **Theme Integration**: Listen to `theme.changed` events and adapt UI accordingly
5. **Minimal Permissions**: Only request permissions actually needed
6. **Network Restrictions**: Declare network access requirements in manifest

### Testing

- Test in Otzaria debug mode with hot reload enabled
- Verify all permissions are properly declared
- Test with both light and dark themes
- Test RTL layout (Hebrew interface)

## Common Patterns

### Initializing the Plugin

```typescript
Otzaria.on('plugin.boot', (bootData) => {
  // Initialize with boot data
  console.log('Plugin ID:', bootData.plugin.id);
  console.log('App version:', bootData.app.version);
  console.log('Theme:', bootData.theme.mode);
});

Otzaria.on('plugin.ready', () => {
  // Plugin is fully ready
});
```

### Making API Calls

```typescript
const response = await Otzaria.call('library.findBooks', {
  query: 'search term'
});

if (response.success) {
  console.log('Results:', response.data);
} else {
  console.error('Error:', response.error);
}
```

### Handling Theme Changes

```typescript
Otzaria.on('theme.changed', (theme) => {
  document.body.style.backgroundColor = theme.colorScheme.surface;
  document.body.style.color = theme.colorScheme.onSurface;
});
```

## Material Design 3 Integration

Use Material Design 3 components for consistent UI:
- Import from CDN or npm package
- Apply theme colors from `bootData.theme.colorScheme`
- Follow Material Design guidelines for Hebrew/RTL layouts

## Debugging

- Use browser DevTools (available in debug mode)
- Check manifest validation errors in the error screen
- Monitor console for API call responses
- Use `ui.showMessage` for user-facing feedback

## Resources

- Otzaria Plugin SDK documentation in the SDK folder
- Material Design 3: https://m3.material.io/
- TypeScript definitions: `otzaria_plugin.d.ts`


## כללים נוספים לפיתוח

### כללי קובץ ׳הלכות.md׳
חודש משפיע רק פעם אחת בודדה: לא ניתן לעצור את השפעתו.

### כלל יסוד
כל תנאי חייב להכתב בקובץ ׳הלכות.md׳, אין תנאי שנמצא ברדמי ולא בקוד, אין תנאי שנמצא בקוד ולא ב׳הלכות.md׳!

יש לבצע הפרדה מבנית (מבחינה לוגית) בין הגדרת זמני טומאה לזמני פרישה: זמני טומאה רק המשתמש מזין, זמני פרישה רק התוכנה מחשבת.

יש לבצע הפרדה בין חישוב ימי הפרישה: ווסת שאינו קבוע, ווסת קבוע.

משמעות ווסת קבוע, היינו שאירוע הטומאה חזר על עצמו בדיוק במשך 3 פעמים. ווסת זה ממשיך עד לעצירתו, גם כשאין יותר ראייה. עצירה הינה אי-ראייה במשך 3 פעמים, בתנאי שזמן ה"אירוע" לא כלל את היום הרלוונטי.

ווסת שאינו קבוע הוא האירוע הרגיל, וכל פעם מחושב שנפרד ומבוטל לפעם הבאה, אלא שאם הפעם הבאה.,...
