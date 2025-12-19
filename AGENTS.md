# Agent Guidelines for obsidian-marp-plugin

## Project Overview

This is an Obsidian plugin for creating and exporting Marp presentations. It uses Marp Core for rendering and external `npx @marp-team/marp-cli` for exports.

## Key Architecture Decisions

### Export via External Process (npx)
This project deliberately uses `npx @marp-team/marp-cli` as an external process rather than bundling marp-cli. This avoids Electron security restrictions that block dynamic imports via `file://` protocol. **Do not change this to a bundled approach.**

### Wikilink Support
This plugin supports Obsidian's native `![[image.png]]` Wikilink syntax for images. This is a key differentiator from other Marp plugins. **Preserve Wikilink support in all changes.**

## Source Files

```
src/
├── main.ts          # Plugin entry, commands, ribbon icon
├── preview.ts       # Preview view component
├── export.ts        # Export via npx marp-cli
├── marp.ts          # Marp instance singleton
├── engine.ts        # Custom engine for data URL validation
├── settings.ts      # Settings interface
├── settingTab.ts    # Settings UI
└── convertImage.ts  # Image path resolution and base64 conversion
```

## Migration Work

See `MIGRATION_CONCEPT.md` for detailed migration plans from the `obsidian-marp-slides` project. The source project is at:
```
/home/mhenze/Development/3rdParty/obsidian-marp-slides/
```

### Priority Features to Migrate
1. Extended settings (custom export path, Chrome path, math engine)
2. Better error handling with user notifications
3. Sidebar toolbar for when preview is docked
4. PNG export support
5. Marp presentation detection via frontmatter

## Code Conventions

- Use TypeScript strict mode (noImplicitAny, strictNullChecks)
- Use async/await for all async operations
- Use Obsidian's Notice API for user feedback
- Keep dependencies minimal (currently only 3 production deps)
- ESLint + Prettier configured - run checks before committing

## Testing

No automated tests currently. Manual testing checklist:
1. Preview renders correctly
2. Wikilink images display
3. Exports (PDF, PPTX, HTML) work
4. Custom themes load
5. Auto-reload works

## Build Commands

```bash
npm run dev      # Watch mode
npm run build    # Production build
```

Output goes to `main.js` in project root.

## Common Issues

### "npx not found"
User needs Node.js installed. Show helpful error message.

### Images not displaying
Check Wikilink conversion in `preview.ts:replaceImageWikilinks()`.

### Export fails silently
Check `export.ts` error handling. Improve with Notice feedback.

## Reference Files from marp-slides

When implementing features from marp-slides, reference these files with absolute paths:

- Settings: `/home/mhenze/Development/3rdParty/obsidian-marp-slides/src/utilities/settings.ts`
- Preview: `/home/mhenze/Development/3rdParty/obsidian-marp-slides/src/views/marpPreviewView.ts`
- Export: `/home/mhenze/Development/3rdParty/obsidian-marp-slides/src/utilities/marpExport.ts`
- Icons: `/home/mhenze/Development/3rdParty/obsidian-marp-slides/src/utilities/icons.ts`
