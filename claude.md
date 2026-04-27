# AI Agent Instructions

## Project Context

This is an Otzaria plugin project. Otzaria is a Jewish texts library application, and this plugin extends its functionality using web technologies.

## Key Technologies

- **Otzaria Plugin SDK**: JavaScript/TypeScript SDK for interacting with the host application
- **Material Design 3**: UI component library for consistent design
- **Web Technologies**: HTML, CSS, JavaScript/TypeScript
- **Lit 3**: Web-components framework for reactive UI
- **Vite 5**: Build tool that bundles the plugin into `dist/`

## Build System

The project uses **Vite + TypeScript + Lit**. It is NOT vanilla JS anymore.

### Commands

- `npm run dev` — Vite dev server on `localhost:5173` (uses the inline mock `Otzaria` object from `src/index.html`).
- `npm run typecheck` — `tsc --noEmit`, type-only check.
- `npm run build` — sync version → typecheck → `vite build` → outputs to `dist/`.
- `npm run package` / `package:win` — builds and zips into a `.otzplugin` file.

### Directory layout

- `src/` — source code (entry: `src/index.html`, which loads `src/main.ts`).
- `public/lib/` — static assets (fonts, Material Icons CSS) copied as-is to `dist/lib/`.
- `dist/` — build output. **`manifest.json` entrypoint is `dist/index.html`**. Gitignored.
- `version.cjs`, `scripts/*.cjs` — Node CommonJS scripts (the root `package.json` has `"type": "module"`, so Node scripts must use `.cjs`).

### Vite build specifics (important)

The WebView host does not reliably support ES modules loaded via `<script type="module">`. The Vite config therefore produces a **classic IIFE bundle**:

- `format: 'iife'`, `modulePreload: false`, `cssCodeSplit: false`, `inlineDynamicImports: true`.
- A small inline plugin (`classicScriptPlugin`) strips `type="module"` and `crossorigin` from the generated `<script>`/`<link>` tags in `dist/index.html`.

**Do not change this to ES modules** unless you have verified the Otzaria WebView supports them. Keep dynamic `import()` out of the code — it cannot be code-split under IIFE.

## Writing UI with Lit

Prefer Lit web components for new UI. Use vanilla DOM only for trivial one-off injections.

### Reactive component template

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('tracking-example')
export class TrackingExample extends LitElement {
  @property({ type: String }) dateKey = '';
  @state() private expanded = false;

  static styles = css`
    :host { display: block; }
    button { background: var(--primary); color: var(--surface); }
  `;

  render() {
    return html`
      <button @click=${() => (this.expanded = !this.expanded)}>
        ${this.expanded ? 'סגור' : 'פתח'}
      </button>
      ${this.expanded ? html`<div>${this.dateKey}</div>` : null}
    `;
  }
}
```

### Rules for Lit components in this project

1. **RTL**: All components must work with `dir="rtl"`. Avoid hard-coded `left`/`right` — use `inline-start`/`inline-end`.
2. **Theming**: Read colors from CSS custom properties (`var(--primary)`, `var(--surface)`, etc.) set by `applyTheme()` in `src/main.ts`. These properties are set on `:root` and pierce shadow DOM.
3. **Shadow DOM + fonts**: Material Icons and Rubik are loaded in light DOM from `public/lib/fonts/`. To use them inside a component's shadow root, either apply global styles via `document.adoptedStyleSheets` or render text nodes using the parent's font stack (inherited by default unless overridden).
4. **Decorators**: `tsconfig.json` has `experimentalDecorators: true` and `useDefineForClassFields: false`. Do not change these — Lit depends on them.
5. **`isolatedModules`** is on. Every file must be a valid standalone module (use `export type` for type-only re-exports).
6. **No dynamic imports**: IIFE bundle inlines everything. Use static `import` statements only.

### When NOT to use Lit

- Existing logic in `src/main.ts` (calendar rendering, dialogs, password gate) is vanilla TS with `innerHTML` — leave it as-is unless refactoring is part of the task. Do not partially convert it.
- One-off DOM operations during bootstrap (`document.getElementById('app')`) stay vanilla.

## Feature work: tracking layer

New features (halachic event tracking) are built under `src/features/tracking/` as Lit components layered **on top of** the existing calendar. The calendar DOM in `main.ts` exposes anchor points; the tracking layer mounts components into them. See `docs/tracking-ui-plan.md` for the full architecture, and **section 24 of that document for the binding implementation decisions** (time model, missing-day fallback, multi-event-per-day, supersession semantics, rule schema, id generation, z-index ordering).

### Core invariants (do not break)

1. **Time model is Hebrew-only.** All halachic calculations operate on the Hebrew date. The Gregorian date is stored alongside (`gregorianDateKey`) for display only. The halachic day starts at sunset — `onah: 'night'` belongs to the Hebrew date that begins that evening.
2. **`UserEvent` and `ComputedEvent` are strictly separated.** User input creates only `UserEvent` (tumah times). The engine creates only `ComputedEvent` (prisha times). Never collapse them into one collection without a discriminating `type` field.
3. **All halachic conditions live in JSON + `הלכות.md` only.** No halachic `if` in TypeScript. The engine consumes a closed set of operators (`shift_by_hebrew_month_same_day`, `count_inclusive_days`, `weekday_match`, `fixed_interval`, ...) — adding a new halachic behavior means adding a new operator to the engine *and* a rule entry to JSON, never a hard-coded condition in a UI handler.
4. **Supersession, not deletion.** When a new `UserEvent` invalidates older `ComputedEvent`s, mark them `status: 'superseded'` with `supersededAt` and `supersededByEventId`. Physical deletion only on explicit user action.
5. **Multiple events per day are allowed.** Both `UserEvent` and `ComputedEvent` may coexist on the same Hebrew day; the renderer merges them into one chip with a tooltip. `ComputedEvent.sourceUserEventIds` is an array.
6. **IDs:** use `crypto.randomUUID()`. Storage carries a top-level `schemaVersion: 1`.

## Development Guidelines

### Plugin Architecture

1. **Manifest-Driven**: All plugin metadata, permissions, and capabilities are declared in `manifest.json`
2. **WebView-Based**: Plugins run in a sandboxed WebView environment
3. **Event-Driven**: Communication with the host uses an event-based API (`Otzaria.call()` and `Otzaria.on()`)

### Code Organization

- Keep source code in the `src/` directory
- Keep static assets (fonts, icons, static JSON) in `public/` — copied 1:1 to `dist/`
- Entry point in the manifest is `dist/index.html` (the Vite build output)
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

The project is **offline** (`network.enabled: false` in manifest). No CDN loading.

Current state: only **Material Icons font** is used (from `public/lib/fonts/material-icons.css`), plus hand-written CSS using MD3 color tokens piped through `--primary`, `--surface`, etc.

If you need MD3 web components (`<md-dialog>`, `<md-filled-button>`, etc.), install `@material/web` and import the specific components you need — Vite will bundle them locally. Do not add it preemptively; each component adds to the bundle size.

Apply theme colors from `bootData.theme.colorScheme`; see `applyTheme()` in `src/main.ts` for how they map to CSS variables.

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
