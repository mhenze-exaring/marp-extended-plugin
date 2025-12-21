# Claude Code Guidelines for marp-extended-plugin

## Project Overview

**Marp Extended** is an Obsidian community plugin that integrates [Marp](https://marp.app/) (Markdown Presentation Ecosystem) for creating and exporting slide presentations. It extends the original plugin by JichouP with additional features like Mermaid diagram support, enhanced preview sync, and a standalone CLI.

**License**: MIT

### Core Functionality

- Live preview of Marp presentations within Obsidian (sidebar, split, or tab)
- Export slides to PDF, PPTX, and HTML formats via `marp-cli`
- Bidirectional sync between editor cursor and preview slide
- **Wikilink support** for images (`![[image.png]]` syntax)
- **Mermaid diagram rendering** with caching
- Custom theme support via CSS files
- Standalone CLI for batch exports (`marp-extended`)

## Tech Stack

- **Language**: TypeScript (strict mode)
- **Bundler**: ESBuild
- **Testing**: Vitest
- **Platform**: Obsidian Plugin API (Electron-based)
- **Key Dependencies**:
  - `@marp-team/marp-core` - Marp rendering engine
  - `mermaid` - Diagram rendering
  - `commander` - CLI framework
  - `fix-path` - PATH fix for macOS GUI apps
  - `mime` - MIME type detection

## Architecture

### Source Structure

```
src/
├── cli/                    # Standalone CLI
│   └── index.ts            # CLI entry point (marp-extended command)
├── core/                   # Platform-agnostic core logic
│   ├── config.ts           # Configuration types and loading
│   ├── diagrams/           # Diagram rendering (Mermaid, PlantUML)
│   ├── embedding.ts        # Image embedding utilities
│   ├── engine.ts           # Custom marp-cli engine
│   ├── export.ts           # Unified export pipeline
│   ├── index.ts            # Core exports
│   ├── markdownItPlugins.ts    # Custom markdown-it plugins
│   ├── markdownItPlugins.test.ts
│   ├── marpCli.ts          # Marp CLI command builder
│   ├── nodePathResolver.ts # Node.js path resolution
│   ├── preprocessor.ts     # Markdown preprocessing (wikilinks, directives)
│   └── types.ts            # Shared types
└── obsidian/               # Obsidian-specific implementation
    ├── main.ts             # Plugin entry point
    ├── deckView.ts         # Preview view (ItemView)
    ├── export.ts           # Obsidian export integration
    ├── marp.ts             # Marp instance singleton
    ├── mermaidCache.ts     # Mermaid SVG caching
    ├── settings.ts         # Settings interface and defaults
    ├── settingTab.ts       # Settings UI
    └── vaultPathResolver.ts # Vault path resolution
```

### Critical Design Decisions

1. **External Export Process (npx)**
   - Exports use `npx -y @marp-team/marp-cli@latest` as a child process
   - This is **intentional** to avoid Electron security restrictions blocking dynamic imports via `file://` protocol
   - **Do NOT attempt to bundle marp-cli into the plugin**

2. **Wikilink Image Support**
   - The plugin converts `![[image.png]]` to standard Markdown image syntax
   - Located in `src/core/preprocessor.ts`
   - **Preserve this functionality in all changes**

3. **Core/Obsidian Separation**
   - `src/core/` contains platform-agnostic logic (shared between Obsidian plugin and CLI)
   - `src/obsidian/` contains Obsidian-specific implementations
   - This enables the standalone CLI to reuse core functionality

4. **Plugin ID for Coexistence**
   - Plugin ID is `marp-extended` (not `marp`) to coexist with original plugin
   - View type is `marp-ext-deck-view`
   - CSS classes use `marp-ext-*` prefix

## Build Commands

```bash
npm install          # Install dependencies
npm run dev          # Development mode with watch
npm run build        # Production build (type check + bundle)
npm run build:quick  # Production build (skip type check)
npm run build:cli    # Build CLI only
npm run build:all    # Build both plugin and CLI
npm run deploy       # Build and deploy to local Obsidian vault
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
```

**Output**:
- Plugin: `dist/obsidian/main.js` (copied to project root as `main.js`)
- CLI: `dist/cli/index.js`

## Settings Interface

```typescript
interface MarpPluginSettings {
  // Preview settings
  autoReload: boolean;          // Auto-reload preview on save (default: true)
  previewLocation: 'sidebar' | 'split' | 'tab';  // Where to open preview (default: 'sidebar')
  enableSyncPreview: boolean;   // Sync preview with editor cursor (default: true)
  enableTextSelection: boolean; // Allow text selection in preview (default: false)
  followActiveFile: boolean;    // Switch preview when changing files (default: false)

  // Theme settings
  themeDir: string;             // Custom theme folder (default: 'MarpTheme')

  // Marp rendering options
  enableHTML: boolean;          // Allow HTML in slides (default: false)
  mathTypesetting: 'mathjax' | 'katex' | false;  // Math engine (default: 'mathjax')
  enableMarkdownItPlugins: boolean;  // Extended markdown features (default: false)

  // Mermaid settings
  enableMermaid: boolean;       // Render Mermaid diagrams (default: true)
  mermaidTheme: 'default' | 'dark' | 'forest' | 'neutral' | 'base';

  // Export settings
  exportPath: string;           // Custom export directory (default: '' = Downloads)
  chromePath: string;           // Custom Chrome/Chromium path for PDF export
}
```

## Code Style

### Formatting (Prettier)
- 80 char line width
- 2 space indentation
- Single quotes
- Trailing commas (all)
- Arrow parens: avoid

### TypeScript
- `noImplicitAny`: true
- `strictNullChecks`: true
- Use async/await for all async operations
- Use Obsidian's `Notice` API for user feedback

## Testing

```bash
npm run test         # Run all tests
npm run test:watch   # Watch mode
```

### Manual Testing Checklist
1. Preview renders correctly with various Marp directives
2. Wikilink images (`![[image.png]]`) display in preview
3. Standard Markdown images display in preview
4. Mermaid diagrams render correctly
5. Exports (PDF, PPTX, HTML) work correctly
6. Custom themes load from theme directory
7. Auto-reload triggers on file save
8. Preview syncs with editor cursor position
9. Clicking slide navigates to corresponding editor line

## Common Issues & Debugging

### "npx not found" / Export fails
- User needs Node.js installed and in PATH
- On macOS, `fix-path` should resolve GUI app PATH issues
- Check: `src/obsidian/export.ts` for PATH handling

### Images not displaying in preview
- Check wikilink preprocessing: `src/core/preprocessor.ts`
- Check image path resolution: `src/obsidian/deckView.ts:resolveImagePath()`

### Mermaid diagrams not rendering
- Verify `enableMermaid` setting is true
- Check browser console for Mermaid errors
- Check: `src/obsidian/mermaidCache.ts`

### Preview not syncing with editor
- Verify `enableSyncPreview` setting is true
- Check: `src/obsidian/deckView.ts:syncPreviewToEditor()`

### Export fails silently
- Check browser console for errors
- Verify Chrome/Chromium is available for PDF export
- Check: `src/core/export.ts`

## Git Workflow

- Main branch: `master`
- Use conventional commits
- Run `npm run build` before committing to verify no TypeScript errors

## CLI Usage

The standalone CLI can be used for batch exports:

```bash
# Via npx (after publishing)
npx marp-extended export presentation.md --format pdf

# Local development
npm run build:cli
node dist/cli/index.js export presentation.md --format pdf
```

Configuration via `marp-extended.config.json` in project root.
