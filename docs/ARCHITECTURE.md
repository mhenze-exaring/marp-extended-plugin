# Architecture Documentation

This document describes the technical architecture of the Obsidian Marp Plugin.

## Project Structure

```
marp-extended-plugin/
├── src/
│   ├── core/                    # Shared core (CLI + Obsidian)
│   │   ├── types.ts             # PathResolver interface, isLocalPath util
│   │   ├── config.ts            # Configuration types and loading
│   │   ├── preprocessor.ts      # Markdown preprocessing pipeline
│   │   ├── embedding.ts         # Image/iframe embedding utilities
│   │   ├── export.ts            # Unified export pipeline
│   │   ├── marpCli.ts           # Marp CLI command building utilities
│   │   ├── nodePathResolver.ts  # Node.js PathResolver implementation
│   │   ├── markdownItPlugins.ts # Container and mark plugins
│   │   ├── markdownItPlugins.test.ts  # Tests for plugins
│   │   ├── engine.ts            # marp-cli engine generation
│   │   ├── index.ts             # Core module exports
│   │   └── diagrams/            # Diagram renderers
│   │       ├── types.ts         # DiagramRenderer interface
│   │       ├── mermaid-cli.ts   # CLI mermaid renderer (mmdc)
│   │       └── plantuml.ts      # PlantUML renderer (java -jar)
│   │
│   ├── cli/                     # CLI entry point
│   │   └── index.ts             # marp-extended CLI (thin wrapper)
│   │
│   └── obsidian/                # Obsidian-specific code
│       ├── main.ts              # Plugin entry point
│       ├── deckView.ts          # DeckView with sidebar toolbar (unified preview)
│       ├── export.ts            # Export wrapper (thin wrapper around core)
│       ├── marp.ts              # Marp instance factory
│       ├── mermaidCache.ts      # Browser-based mermaid caching (implements DiagramRenderer)
│       ├── vaultPathResolver.ts # Obsidian vault PathResolver
│       ├── settings.ts          # Plugin settings interface
│       └── settingTab.ts        # Settings UI
│
├── dist/                        # Build output (gitignored)
│   ├── obsidian/                # Obsidian plugin
│   │   ├── main.js
│   │   └── manifest.json
│   └── cli/                     # CLI tool
│       └── index.js
│
├── docs/                        # Documentation
├── esbuild.config.mjs           # Build configuration
├── manifest.json                # Obsidian plugin manifest
└── package.json
```

## Core Module (`src/core/`)

The core module contains shared logic used by both the CLI and Obsidian plugin.

### Configuration (`config.ts`)

Defines the `MarpExtendedConfig` interface:

```typescript
interface MarpExtendedConfig {
  preprocessor: {
    enableDirectiveShorthand: boolean;  // /// syntax
    enableContainerPlugin: boolean;     // ::: syntax
    enableMarkPlugin: boolean;          // ==highlight== syntax
  };
  diagrams: {
    mermaid: { enabled, backend, cliPath?, theme };
    plantuml: { enabled, jarPath?, javaPath? };
  };
  embedding: {
    images: boolean;   // Base64 embedding
    iframes: boolean;  // Data URL embedding
  };
  export: { format: 'html' | 'pdf' | 'pptx' };
  mode: 'safe' | 'unsafe';
  marpCliArgs?: string[];
}
```

Key functions:
- `loadConfig(path?)` - Load from JSON file with defaults
- `fromObsidianSettings(settings)` - Convert Obsidian settings to config

### Preprocessor (`preprocessor.ts`)

Transforms markdown before Marp processes it.

#### Unified Pipeline (`preprocessForRender`)

The simplified pipeline used by both preview and export:

```typescript
interface RenderPreprocessContext {
  enableDirectives?: boolean;        // /// directive shorthand
  enableMermaid?: boolean;           // Mermaid diagram rendering
  mermaidRenderer?: DiagramRenderer; // Injected renderer (browser or CLI)
  wikilinkResolver?: WikilinkResolver; // Platform-specific URL resolution
}

async function preprocessForRender(
  markdown: string,
  context: RenderPreprocessContext
): Promise<string>;
```

Steps:
1. **Wikilink conversion** - `![[image.png]]` → `![image.png](resolved-url)`
2. **Directive shorthand** - `/// lead` → `<!-- _class: lead -->`
3. **Mermaid diagrams** - Code blocks → inline SVG

#### Full Pipeline (`preprocess`)

Used by CLI for full processing including PlantUML and safe mode handling.

Key functions:
- `preprocessWikilinks(markdown, resolver)` - Convert Obsidian wikilinks
- `preprocessDirectives(markdown)` - Transform `///` syntax
- `preprocessMermaid(markdown, renderer)` - Render mermaid blocks
- `preprocessPlantUML(markdown, renderer)` - Render PlantUML blocks
- `preprocessForRender(markdown, context)` - Unified render pipeline
- `preprocess(markdown, context)` - Full CLI pipeline

### Markdown-It Plugins (`markdownItPlugins.ts`)

Custom syntax extensions for markdown-it:

#### Generic Container Plugin

```markdown
::: columns
content
:::

::: .class#id attr="value"
styled content
:::
```

Supports:
- Element type: `div` (default), `span`, etc.
- Classes: `columns`, `.explicit-class`
- IDs: `#my-id`
- Attributes: `attr="value"`, `style="..."`

#### Mark Plugin

```markdown
This is ==highlighted== text.
```

Renders to `<mark>highlighted</mark>`.

### Engine (`engine.ts`)

Generates JavaScript code for marp-cli's custom engine:

```typescript
function getEngine(enablePlugins: boolean): string
```

The generated engine:
- Validates data URLs (allows base64 images)
- Optionally registers container and mark plugins

### Diagram Renderers (`diagrams/`)

#### DiagramRenderer Interface

```typescript
interface DiagramRenderer {
  render(code: string): Promise<string>;
  initialize?(): Promise<void>;
  destroy?(): void;
}
```

#### Implementations

| Renderer | Backend | Use Case |
|----------|---------|----------|
| `MermaidCliRenderer` | `mmdc` command | CLI, batch processing |
| `PlantUMLRenderer` | `java -jar plantuml.jar` | CLI |
| `MermaidCacheManager` | Browser mermaid.js | Obsidian preview/export |

### PathResolver Pattern (`types.ts`, `embedding.ts`)

The PathResolver interface abstracts file system access, enabling the same embedding logic
to work in both CLI and Obsidian contexts.

#### PathResolver Interface

```typescript
interface PathResolver {
  exists(path: string, fileDir: string): Promise<boolean>;
  readAsBase64(path: string, fileDir: string): Promise<string | null>;
  readAsText(path: string, fileDir: string): Promise<string | null>;
  getResourceUrl(path: string, fileDir: string): Promise<string | null>;
  resolveAbsolute(path: string, fileDir: string): Promise<string | null>;
}
```

#### Implementations

| Resolver | Environment | Backend |
|----------|-------------|---------|
| `NodePathResolver` | CLI | Node.js `fs/promises` |
| `VaultPathResolver` | Obsidian | `app.vault.adapter` |

Path resolution strategy:
1. Relative paths resolved from `fileDir` (directory of markdown file)
2. If not found, try from root (vault root or project root)
3. If still not found and path is absolute, try the absolute path

#### Embedding Utilities (`embedding.ts`)

```typescript
// Convert images and iframes to base64 data URLs
async function embedAssets(
  content: string,
  fileDir: string,
  context: EmbeddingContext,
  options: { images?: boolean; iframes?: boolean }
): Promise<string>;
```

Used by both CLI and Obsidian export to embed assets for portable output.

### Marp CLI Utilities (`marpCli.ts`)

Shared command building for marp-cli invocation:

```typescript
interface MarpCliOptions {
  enginePath: string;
  outputPath: string;
  format: ExportFormat;
  enableHtml?: boolean;
  allowLocalFiles?: boolean;
  themeDir?: string;
  bespokeTransition?: boolean;
  additionalArgs?: string[];
}

function buildMarpCliCommandString(inputPath: string, options: MarpCliOptions): string;
function contentRequiresHtml(content: string): boolean;
```

Used by the unified export pipeline for consistent command generation.

### Export Pipeline (`export.ts`)

Unified export logic used by both CLI and Obsidian:

```typescript
interface ExportConfig {
  format: 'html' | 'pdf' | 'pptx';
  outputPath: string;
  themeDir?: string;
  enableDirectives: boolean;
  enableMarkdownItPlugins: boolean;
  enableHtml: boolean;
  allowLocalFiles: boolean;
  enableMermaid: boolean;
  enablePlantUML: boolean;
  embedImages: boolean;
  embedIframes: boolean;
  bespokeTransition: boolean;
  additionalMarpArgs?: string[];
}

interface ExportContext {
  pathResolver: PathResolver;
  fileDir: string;
  getMimeType: (path: string) => string | null;
  mermaidRenderer?: DiagramRenderer;
  plantumlRenderer?: DiagramRenderer;
  wikilinkResolver?: WikilinkResolver;
  onProgress?: (message: string) => void;
  onError?: (error: Error) => void;
  tempDir?: string;
}

async function exportPresentation(
  content: string,
  config: ExportConfig,
  context: ExportContext
): Promise<ExportResult>;
```

Key design:
- **ExportConfig**: What to do (format, features, paths)
- **ExportContext**: How to do it (platform-specific implementations)
- Platform modules are thin wrappers that create config/context and call `exportPresentation()`

## CLI (`src/cli/`)

Standalone command-line tool for processing Marp presentations.

### Security Modes

| Mode | Flags | Features |
|------|-------|----------|
| `safe` (default) | None | Only `///` directives |
| `unsafe` | `--html --allow-local-files` | All features |

In safe mode, features that read local files are disabled:
- Image/iframe embedding
- Mermaid/PlantUML rendering
- Container/mark plugins (output HTML)

### Usage

```bash
marp-extended presentation.md --unsafe --format pdf -o output.pdf
```

## Obsidian Plugin (`src/obsidian/`)

### DeckView (Unified Preview)

The plugin uses a single `DeckView` component for all preview functionality:

| Feature | Description |
|---------|-------------|
| Sidebar toolbar | Export buttons visible when docked in sidebar |
| Header actions | Export buttons in header for all positions |
| Auto-reload | Refreshes on file save |
| Marp detection | Auto-loads files with `marp: true` frontmatter |
| Theme support | Loads custom themes from vault directory |

### Preprocessing Flow (Preview)

```
File content
     ↓
preprocessForRender() [CORE]
  ├─ wikilinkResolver → app:// URLs
  ├─ preprocessDirectives → HTML comments
  └─ mermaidRenderer → inline SVG
     ↓
marp.render(content) [IN-PROCESS]
     ↓
resolveHtmlImagePaths() [OBSIDIAN]
  └─ img/iframe/css url() → app:// URLs
     ↓
Display in container
```

### Export Flow (Unified Pipeline)

Both CLI and Obsidian use the same core export pipeline (`core/export.ts`):

```
exportPresentation(content, config, context)
     │
     ├─ Platform provides:
     │    ├─ ExportConfig (from CLI args or Obsidian settings)
     │    ├─ PathResolver (NodePathResolver or VaultPathResolver)
     │    └─ DiagramRenderer (MermaidCliRenderer or MermaidCacheManager)
     │
     ↓
preprocessForRender() [CORE]
  ├─ wikilinkResolver → relative paths
  ├─ preprocessDirectives → HTML comments
  └─ mermaidRenderer → inline SVG
     ↓
embedAssets() [CORE]
  └─ images/iframes → base64 data URLs
     ↓
Write temp files (.md, engine.js)
     ↓
Execute: npx @marp-team/marp-cli --engine engine.js ...
     ↓
Clean up temp files
     ↓
ExportResult { success, outputPath, error? }
```

**Why external process?** Electron security blocks dynamic imports via `file://`. Using npx bypasses this.

**Platform differences:**
| Aspect | CLI | Obsidian |
|--------|-----|----------|
| Config source | File + CLI args | Plugin settings |
| PathResolver | `NodePathResolver` | `VaultPathResolver` |
| Mermaid renderer | `MermaidCliRenderer` (mmdc) | `MermaidCacheManager` (browser) |
| Feedback | Console output | `Notice` API |

### MermaidCacheManager (`obsidian/mermaidCache.ts`)

Browser-based rendering with caching. Implements `DiagramRenderer` interface for use with core preprocessor.

Features:
1. Content-hash based caching
2. Theme-aware (cache clears on theme change)
3. Error placeholder for failed renders
4. Hidden DOM container for rendering

## Build System

### ESBuild Configuration

Two build targets configured in `esbuild.config.mjs`:

#### Obsidian Plugin

```javascript
{
  entryPoints: ['src/obsidian/main.ts'],
  outfile: 'dist/obsidian/main.js',
  format: 'cjs',
  external: ['obsidian', 'electron', ...builtins],
  plugins: [markdownItPluginsPlugin],
}
```

#### CLI

```javascript
{
  entryPoints: ['src/cli/index.ts'],
  outfile: 'dist/cli/index.js',
  platform: 'node',
  format: 'cjs',
}
```

### Plugin Embedding

Markdown-it plugins are compiled to a string and embedded:

1. ESBuild compiles `src/core/markdownItPlugins.ts` separately
2. Output stored in virtual module `markdown-it-plugins-string`
3. `engine.ts` imports and injects into generated engine code

This is necessary because marp-cli runs as an external process.

## Data Flow Summary

### Preview vs Export

| Aspect | Preview | Export |
|--------|---------|--------|
| Wikilink resolution | → `app://` URLs | → relative paths |
| Mermaid rendering | Browser (MermaidCacheManager) | Browser (MermaidCacheManager) |
| Image handling | Path resolution (app://) | Base64 embedding |
| Marp processing | In-process | External npx process |
| Output | DOM manipulation | File on disk |

### Shared Core Usage

Both preview and export use:
- `preprocessForRender()` - Unified preprocessing pipeline
- `MermaidCacheManager` - Diagram rendering (implements `DiagramRenderer`)
- `buildMarpCliCommandString()` - Command building (export only)
- `embedAssets()` - Asset embedding (export only)

## Dependencies

### Production

| Package | Purpose |
|---------|---------|
| `@marp-team/marp-core` | Marp rendering engine |
| `commander` | CLI argument parsing |
| `fix-path` | Fix PATH for macOS GUI apps |
| `mermaid` | Browser diagram rendering |
| `mime` | MIME type detection |

### External Tools (CLI)

| Tool | Purpose | Required |
|------|---------|----------|
| `npx` | Run marp-cli | For export |
| `mmdc` | Mermaid CLI | Optional |
| `java` + `plantuml.jar` | PlantUML | Optional |

## Security Considerations

### Safe vs Unsafe Mode (CLI)

The CLI defaults to safe mode because:

1. **`--html` risk**: Allows script injection
2. **`--allow-local-files` risk**: Path traversal attacks
3. **Preprocessor risk**: Reads files before marp-cli runs

In safe mode, preprocessors that read files are disabled entirely.

### Obsidian Context

The Obsidian plugin always operates in "unsafe" mode because:
- Runs locally on user's machine
- User controls their own files
- No untrusted input scenario

## Extension Points

### Custom Themes

Place CSS files in the theme folder:

```
vault/MarpTheme/
├── corporate.css
└── academic.css
```

Use in frontmatter: `theme: corporate`

### Configuration File (CLI)

Create `marp-extended.config.json`:

```json
{
  "mode": "unsafe",
  "diagrams": {
    "mermaid": { "enabled": true, "theme": "dark" }
  },
  "export": { "format": "pdf" }
}
```
