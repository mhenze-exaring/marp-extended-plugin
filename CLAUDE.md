# Claude Code Guidelines for obsidian-marp-plugin

## Project Overview

**obsidian-marp-plugin** is an Obsidian community plugin that integrates [Marp](https://marp.app/) (Markdown Presentation Ecosystem) for creating and exporting slide presentations. Original author: JichouP. License: MIT.

### Core Functionality
- Live preview of Marp presentations within Obsidian
- Export slides to PDF, PPTX, and HTML formats
- Auto-reload preview on file save
- Custom theme support via CSS files
- **Wikilink support** for images (`![[image.png]]` syntax)

## Tech Stack

- **Language**: TypeScript (strict mode)
- **Bundler**: ESBuild
- **Platform**: Obsidian Plugin API (Electron-based)
- **Key Dependencies**:
  - `@marp-team/marp-core` - Marp rendering engine
  - `fix-path` - PATH fix for macOS GUI apps
  - `mime` - MIME type detection

## Architecture

### Source Structure
```
src/
├── main.ts          # Plugin entry point, commands, ribbon icon, theme loading
├── preview.ts       # PreviewView component (ItemView), Wikilink conversion
├── export.ts        # Export via external npx @marp-team/marp-cli process
├── marp.ts          # Marp singleton instance
├── engine.ts        # Custom marp-cli engine for data URL validation
├── settings.ts      # MarpPluginSettings interface and defaults
├── settingTab.ts    # Settings UI (PluginSettingTab)
└── convertImage.ts  # Image path resolution and base64 conversion
```

### Critical Design Decisions

1. **External Export Process (npx)**
   - Exports use `npx -y @marp-team/marp-cli@latest` as a child process
   - This is **intentional** to avoid Electron security restrictions blocking dynamic imports via `file://` protocol
   - **Do NOT attempt to bundle marp-cli into the plugin**

2. **Wikilink Image Support**
   - The plugin converts `![[image.png]]` to standard Markdown image syntax
   - This is a key differentiator from other Marp integrations
   - Located in `preview.ts:replaceImageWikilinks()`
   - **Preserve this functionality in all changes**

3. **Export Output Location**
   - Exports always go to user's `Downloads` directory
   - Temporary files (`.tmp`, `engine.js`) are created and cleaned up after export

## Build Commands

```bash
npm install        # Install dependencies
npm run dev        # Development mode with watch
npm run build      # Production build (type check + minified bundle)
```

Output: `main.js` in project root (for Obsidian to load)

## Code Style

### Formatting (Prettier)
- 80 char line width
- 2 space indentation
- Single quotes
- Trailing commas (all)
- Arrow parens: avoid

### Linting (ESLint)
- TypeScript ESLint recommended rules
- `@typescript-eslint/ban-ts-comment`: off
- `no-prototype-builtins`: off
- `@typescript-eslint/no-empty-function`: off

### TypeScript
- `noImplicitAny`: true
- `strictNullChecks`: true
- Use async/await for all async operations
- Use Obsidian's `Notice` API for user feedback

## Settings Interface

```typescript
interface MarpPluginSettings {
  autoReload: boolean;        // Auto-reload preview on save (default: true)
  createNewSplitTab: boolean; // Open preview in split tab (default: true)
  themeDir: string;           // Custom theme folder (default: 'MarpTheme')
}
```

## Testing

No automated tests currently. Manual testing checklist:
1. Preview renders correctly with various Marp directives
2. Wikilink images (`![[image.png]]`) display in preview
3. Standard Markdown images display in preview
4. Exports (PDF, PPTX, HTML) work correctly
5. Custom themes load from theme directory
6. Auto-reload triggers on file save
7. Export embeds images as base64

## Common Issues & Debugging

### "npx not found" / Export fails
- User needs Node.js installed and in PATH
- On macOS, `fix-path` should resolve GUI app PATH issues
- Check: `export.ts:fixPath()` call

### Images not displaying in preview
- Check Wikilink regex: `preview.ts:replaceImageWikilinks()`
- For standard images, check `convertImage.ts:convertPathToLocalLink()`

### Images not embedded in export
- Check `export.ts` image regex: `/!\[[^\]]*\]\(([^)]+)\)/g`
- Check `convertImage.ts:convertToBase64()`

### Export fails silently
- Check browser console for errors
- Export uses `exec()` callback - errors may not surface to user
- Improve with better `Notice` feedback

### Known Bug
- `convertImage.ts:39` uses `this.app` but `convertToBase64` is not a method, causing potential runtime error. Should use global `app` instead.

## Migration Context

See `AGENTS.md` for migration plans from `obsidian-marp-slides` project. Priority features:
1. Extended settings (custom export path, Chrome path, math engine)
2. Better error handling with user notifications
3. Sidebar toolbar for docked preview
4. PNG export support
5. Marp presentation detection via frontmatter

Reference project: `/home/mhenze/Development/3rdParty/obsidian-marp-slides/`

## Git Workflow

- Main branch: `master`
- Use conventional commits
- Run `npm run build` before committing to verify no TypeScript errors

## Dependencies Management

- Dependabot enabled for automated dependency updates
- Keep production dependencies minimal (currently 3)
- Dev dependencies include Obsidian type stubs and build tooling
