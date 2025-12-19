# CLI Architecture Proposal

## Goals

1. **Shared Core**: Export/preprocessing logic usable from both CLI and Obsidian plugin
2. **Pragmatic**: Don't over-abstract - some features are UI-only (live preview, sync scroll)
3. **Configurable**: Support external tools (mermaid-cli, plantuml.jar) via config
4. **Pass-through**: Allow forwarding arbitrary marp-cli arguments

## Proposed Structure

```
obsidian-marp-plugin/
├── src/
│   ├── core/                      # Shared core (CLI + Obsidian)
│   │   ├── preprocessor.ts        # Markdown transformations
│   │   ├── config.ts              # Configuration types and loading
│   │   ├── markdownItPlugins.ts   # markdown-it plugins (existing)
│   │   ├── engine.ts              # marp-cli engine generation
│   │   ├── diagrams/              # Diagram rendering backends
│   │   │   ├── types.ts           # DiagramRenderer interface
│   │   │   ├── mermaid-browser.ts # Browser-based (Obsidian)
│   │   │   ├── mermaid-cli.ts     # CLI-based (@mermaid-js/mermaid-cli)
│   │   │   └── plantuml.ts        # PlantUML via java -jar
│   │   └── export.ts              # Core export logic
│   │
│   ├── obsidian/                  # Obsidian-specific (UI)
│   │   ├── main.ts                # Plugin entry point
│   │   ├── deckView.ts            # Live preview
│   │   ├── settingTab.ts          # Settings UI
│   │   └── settings.ts            # Obsidian settings adapter
│   │
│   └── cli/                       # CLI entry point
│       └── index.ts               # CLI implementation
│
├── bin/
│   └── marp-extended              # Symlink/wrapper for npm bin
│
├── marp-extended.config.json      # Example config file
└── ...
```

## Core Components

### 1. Configuration (`src/core/config.ts`)

```typescript
export interface MarpExtendedConfig {
  // Preprocessor options
  preprocessor: {
    enableDirectiveShorthand: boolean;  // /// syntax
    enableContainerPlugin: boolean;     // ::: syntax
    enableMarkPlugin: boolean;          // ==highlight== syntax
  };

  // Diagram rendering
  diagrams: {
    mermaid: {
      enabled: boolean;
      backend: 'browser' | 'cli';       // browser = mermaid.js, cli = mmdc
      cliPath?: string;                 // Path to mmdc if not in PATH
      theme: 'default' | 'dark' | 'forest' | 'neutral' | 'base';
    };
    plantuml: {
      enabled: boolean;
      jarPath?: string;                 // Path to plantuml.jar
      javaPath?: string;                // Path to java if not in PATH
    };
  };

  // Embedding options
  embedding: {
    images: boolean;                    // Embed images as base64 data URLs (default: true)
    iframes: boolean;                   // Embed local HTML iframes as data URLs (default: true)
  };

  // Theme
  themeDir?: string;

  // Export defaults
  export: {
    format: 'html' | 'pdf' | 'pptx';   // Default output format (default: html)
  };

  // Security mode (see Security section below)
  // 'safe': Vanilla marp-cli passthrough, no extended features requiring --html/--allow-local-files
  // 'unsafe': Full extended features enabled (--html, --allow-local-files)
  mode: 'safe' | 'unsafe';

  // marp-cli pass-through (additional args beyond the defaults)
  marpCliArgs?: string[];
}

export const DEFAULT_CONFIG: MarpExtendedConfig = {
  preprocessor: {
    enableDirectiveShorthand: true,
    enableContainerPlugin: true,
    enableMarkPlugin: true,
  },
  diagrams: {
    mermaid: {
      enabled: true,
      backend: 'cli',  // CLI default for CLI usage
      theme: 'default',
    },
    plantuml: {
      enabled: false,
    },
  },
  embedding: {
    images: true,       // Embed images as base64 for portable output
    iframes: true,      // Embed local HTML (e.g., Plotly exports) as data URLs
  },
  export: {
    format: 'html',           // HTML is default (most portable, viewable anywhere)
  },
  mode: 'safe',               // Safe by default - requires --unsafe for extended features
};

// Load config from file or defaults
export function loadConfig(configPath?: string): MarpExtendedConfig;

// Merge Obsidian settings into config format
export function fromObsidianSettings(settings: MarpPluginSettings): MarpExtendedConfig;
```

### 2. Preprocessor (`src/core/preprocessor.ts`)

```typescript
import { MarpExtendedConfig } from './config';
import { DiagramRenderer } from './diagrams/types';

export interface PreprocessorContext {
  config: MarpExtendedConfig;
  diagramRenderer: DiagramRenderer;
  basePath: string;           // For resolving relative paths
  fileDir: string;            // Directory of the markdown file
}

/**
 * Main preprocessing pipeline.
 * Transforms markdown before passing to marp-cli.
 */
export async function preprocess(
  markdown: string,
  context: PreprocessorContext
): Promise<string> {
  let content = markdown;

  // 1. /// directive shorthand -> HTML comments
  if (context.config.preprocessor.enableDirectiveShorthand) {
    content = preprocessDirectives(content);
  }

  // 2. Mermaid diagrams -> inline SVG/img
  if (context.config.diagrams.mermaid.enabled) {
    content = await preprocessMermaid(content, context.diagramRenderer);
  }

  // 3. PlantUML diagrams -> inline SVG/img
  if (context.config.diagrams.plantuml.enabled) {
    content = await preprocessPlantUML(content, context);
  }

  // 4. Image path resolution (for export)
  // ... existing logic from export.ts

  return content;
}

// Individual preprocessors (exported for testing)
export function preprocessDirectives(markdown: string): string;
export async function preprocessMermaid(markdown: string, renderer: DiagramRenderer): Promise<string>;
export async function preprocessPlantUML(markdown: string, context: PreprocessorContext): Promise<string>;
```

### 3. Diagram Renderer Interface (`src/core/diagrams/types.ts`)

```typescript
export interface DiagramRenderer {
  /**
   * Render diagram code to SVG string.
   */
  render(code: string, type: 'mermaid' | 'plantuml'): Promise<string>;

  /**
   * Initialize the renderer (if needed).
   */
  initialize?(): Promise<void>;

  /**
   * Cleanup resources.
   */
  destroy?(): void;
}
```

### 4. CLI Mermaid Backend (`src/core/diagrams/mermaid-cli.ts`)

```typescript
import { execFile } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { DiagramRenderer } from './types';

export interface MermaidCliOptions {
  cliPath?: string;  // Default: 'mmdc' (assumes in PATH)
  theme?: string;
}

/**
 * Mermaid renderer using @mermaid-js/mermaid-cli (mmdc).
 * Suitable for CLI usage where browser APIs aren't available.
 */
export class MermaidCliRenderer implements DiagramRenderer {
  private cliPath: string;
  private theme: string;

  constructor(options: MermaidCliOptions = {}) {
    this.cliPath = options.cliPath || 'mmdc';
    this.theme = options.theme || 'default';
  }

  async render(code: string): Promise<string> {
    const tmpInput = join(tmpdir(), `mermaid-${Date.now()}.mmd`);
    const tmpOutput = join(tmpdir(), `mermaid-${Date.now()}.svg`);

    try {
      await writeFile(tmpInput, code);

      await new Promise<void>((resolve, reject) => {
        execFile(this.cliPath, [
          '-i', tmpInput,
          '-o', tmpOutput,
          '-t', this.theme,
          '--quiet'
        ], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      return await readFile(tmpOutput, 'utf-8');
    } finally {
      await unlink(tmpInput).catch(() => {});
      await unlink(tmpOutput).catch(() => {});
    }
  }
}
```

### 5. PlantUML Backend (`src/core/diagrams/plantuml.ts`)

```typescript
import { execFile } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { DiagramRenderer } from './types';

export interface PlantUMLOptions {
  jarPath: string;           // Required: path to plantuml.jar
  javaPath?: string;         // Default: 'java'
}

/**
 * PlantUML renderer using java -jar plantuml.jar.
 */
export class PlantUMLRenderer implements DiagramRenderer {
  private jarPath: string;
  private javaPath: string;

  constructor(options: PlantUMLOptions) {
    this.jarPath = options.jarPath;
    this.javaPath = options.javaPath || 'java';
  }

  async render(code: string): Promise<string> {
    const tmpInput = join(tmpdir(), `plantuml-${Date.now()}.puml`);

    try {
      await writeFile(tmpInput, code);

      await new Promise<void>((resolve, reject) => {
        execFile(this.javaPath, [
          '-jar', this.jarPath,
          '-tsvg',
          '-pipe'
        ], {
          // Pass input via stdin
        }, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      // PlantUML creates .svg with same basename
      const svgPath = tmpInput.replace('.puml', '.svg');
      return await readFile(svgPath, 'utf-8');
    } finally {
      await unlink(tmpInput).catch(() => {});
    }
  }
}
```

### 6. CLI Entry Point (`src/cli/index.ts`)

```typescript
#!/usr/bin/env node
import { program } from 'commander';
import { readFile, writeFile, unlink } from 'fs/promises';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { join, dirname, basename, extname } from 'path';
import { loadConfig, DEFAULT_CONFIG } from '../core/config';
import { preprocess } from '../core/preprocessor';
import { getEngine } from '../core/engine';
import { MermaidCliRenderer } from '../core/diagrams/mermaid-cli';
import { PlantUMLRenderer } from '../core/diagrams/plantuml';

program
  .name('marp-extended')
  .description('Marp CLI with extended syntax support')
  .version('1.0.0')
  .argument('<input>', 'Input markdown file')
  .option('-o, --output <file>', 'Output file (default: input with new extension)')
  .option('-c, --config <file>', 'Config file (default: marp-extended.config.json)')
  .option('--format <type>', 'Output format: html, pdf, pptx (default: html)', 'html')
  .option('--unsafe', 'Enable unsafe mode (--html, --allow-local-files) for full extended features')
  .option('--theme-dir <dir>', 'Theme directory')
  .option('--no-mermaid', 'Disable Mermaid preprocessing')
  .option('--no-plantuml', 'Disable PlantUML preprocessing')
  .option('--no-directives', 'Disable /// directive shorthand')
  .option('--no-embed-images', 'Disable image embedding as base64')
  .option('--no-embed-iframes', 'Disable iframe embedding as data URLs')
  .option('--mermaid-cli <path>', 'Path to mmdc (mermaid-cli)')
  .option('--plantuml-jar <path>', 'Path to plantuml.jar')
  .option('--java <path>', 'Path to java executable')
  .option('--', 'Pass remaining arguments to marp-cli')
  .action(async (input, options, command) => {
    // Load config (file -> defaults -> CLI overrides)
    const config = loadConfig(options.config);

    // Apply CLI overrides
    if (options.unsafe) config.mode = 'unsafe';
    if (options.mermaid === false) config.diagrams.mermaid.enabled = false;
    if (options.plantuml === false) config.diagrams.plantuml.enabled = false;
    if (options.directives === false) config.preprocessor.enableDirectiveShorthand = false;
    if (options.embedImages === false) config.embedding.images = false;
    if (options.embedIframes === false) config.embedding.iframes = false;
    if (options.mermaidCli) config.diagrams.mermaid.cliPath = options.mermaidCli;
    if (options.plantumlJar) config.diagrams.plantuml.jarPath = options.plantumlJar;
    if (options.java) config.diagrams.plantuml.javaPath = options.java;
    if (options.themeDir) config.themeDir = options.themeDir;
    if (options.format) config.export.format = options.format;

    // In safe mode, disable all dangerous preprocessors (not just marp-cli flags)
    // This is critical: preprocessors read local files BEFORE marp-cli runs
    if (config.mode === 'safe') {
      const skipped: string[] = [];

      if (config.preprocessor.enableContainerPlugin) {
        config.preprocessor.enableContainerPlugin = false;
        skipped.push('::: container plugin');
      }
      if (config.preprocessor.enableMarkPlugin) {
        config.preprocessor.enableMarkPlugin = false;
        skipped.push('==highlight== mark plugin');
      }
      if (config.diagrams.mermaid.enabled) {
        config.diagrams.mermaid.enabled = false;
        skipped.push('Mermaid diagrams');
      }
      if (config.diagrams.plantuml.enabled) {
        config.diagrams.plantuml.enabled = false;
        skipped.push('PlantUML diagrams');
      }
      if (config.embedding.images) {
        config.embedding.images = false;
        skipped.push('Image base64 embedding');
      }
      if (config.embedding.iframes) {
        config.embedding.iframes = false;
        skipped.push('Iframe data URL embedding');
      }

      if (skipped.length > 0) {
        console.warn('Safe mode: The following features are disabled:');
        skipped.forEach(f => console.warn(`  - ${f}`));
        console.warn('Use --unsafe flag or set mode: "unsafe" in config for full functionality.');
      }
    }

    // Get pass-through args (everything after --)
    const marpCliArgs = command.args.slice(1); // args after input file

    // Create diagram renderers
    const diagramRenderer = new MermaidCliRenderer({
      cliPath: config.diagrams.mermaid.cliPath,
      theme: config.diagrams.mermaid.theme,
    });

    // Read and preprocess
    const markdown = await readFile(input, 'utf-8');
    const processed = await preprocess(markdown, {
      config,
      diagramRenderer,
      basePath: process.cwd(),
      fileDir: dirname(input),
    });

    // Write temp files
    const tmpMd = join(tmpdir(), `marp-${Date.now()}.md`);
    const tmpEngine = join(tmpdir(), `engine-${Date.now()}.js`);

    await writeFile(tmpMd, processed);
    await writeFile(tmpEngine, getEngine(true));

    // Determine output path
    const format = config.export.format;
    const outputPath = options.output ||
      join(dirname(input), `${basename(input, extname(input))}.${format}`);

    // Build marp-cli command
    const isUnsafe = config.mode === 'unsafe';
    const cmd = [
      'npx -y @marp-team/marp-cli@latest',
      `--engine "${tmpEngine}"`,
      `-o "${outputPath}"`,
      // Only enable dangerous flags in unsafe mode
      isUnsafe ? '--html' : '',
      isUnsafe ? '--allow-local-files' : '',
      config.themeDir ? `--theme-set "${config.themeDir}"` : '',
      // User's additional pass-through args
      ...marpCliArgs,
      `"${tmpMd}"`,
    ].filter(Boolean).join(' ');

    try {
      execSync(cmd, { stdio: 'inherit' });
      console.log(`Exported: ${outputPath}`);
    } finally {
      await unlink(tmpMd).catch(() => {});
      await unlink(tmpEngine).catch(() => {});
    }
  });

program.parse();
```

## Config File Example (`marp-extended.config.json`)

```json
{
  "preprocessor": {
    "enableDirectiveShorthand": true,
    "enableContainerPlugin": true,
    "enableMarkPlugin": true
  },
  "diagrams": {
    "mermaid": {
      "enabled": true,
      "backend": "cli",
      "theme": "default"
    },
    "plantuml": {
      "enabled": true,
      "jarPath": "/opt/plantuml/plantuml.jar"
    }
  },
  "embedding": {
    "images": true,
    "iframes": true
  },
  "export": {
    "format": "html"
  },
  "mode": "unsafe",
  "themeDir": "./themes",
  "marpCliArgs": ["--pdf-notes"]
}
```

## CLI Usage Examples

```bash
# Safe mode (default) - vanilla marp-cli passthrough, preprocessors run but may not render
marp-extended presentation.md

# Unsafe mode - full extended features (--html, --allow-local-files enabled)
marp-extended presentation.md --unsafe

# Export as PDF with all features
marp-extended presentation.md --unsafe --format pdf

# Export as PowerPoint
marp-extended presentation.md --unsafe --format pptx -o presentation.pptx

# With config file (can set mode: "unsafe" in config to avoid --unsafe flag)
marp-extended presentation.md -c my-config.json

# Disable specific features
marp-extended presentation.md --unsafe --no-mermaid --no-plantuml

# Disable embedding (use external files)
marp-extended presentation.md --unsafe --no-embed-images --no-embed-iframes

# Custom tool paths
marp-extended presentation.md --unsafe \
  --mermaid-cli /usr/local/bin/mmdc \
  --plantuml-jar ~/tools/plantuml.jar \
  --java /usr/bin/java

# Pass additional args to marp-cli
marp-extended presentation.md --unsafe -- --pdf-notes --bespoke.progress
```

## Security Considerations

### Safe vs Unsafe Mode

The CLI operates in two modes:

| Mode | `--html` | `--allow-local-files` | Use Case |
|------|----------|----------------------|----------|
| `safe` (default) | No | No | Server-side rendering with untrusted input |
| `unsafe` | Yes | Yes | Local development, trusted input |

### Why This Matters

**`--html` risks:**
- Allows arbitrary HTML/JavaScript injection
- If input contains `<script>alert('xss')</script>`, it will execute
- Malicious markdown could exfiltrate data, redirect users, etc.

**`--allow-local-files` risks:**
- Enables file:// protocol access
- Could read sensitive files from the server filesystem
- Path traversal attacks: `![](../../../etc/passwd)`

### Safe Mode Behavior

In safe mode, the CLI:
1. **Skips all preprocessing that accesses local files or generates HTML**
2. Only runs "safe" transformations (/// directives → HTML comments)
3. Passes markdown to marp-cli WITHOUT `--html`/`--allow-local-files`
4. Emits a warning listing which features were skipped

**Critical**: The preprocessor itself is a security boundary. Features like image embedding read local files and encode them as base64 *before* marp-cli runs. This would bypass marp-cli's `--allow-local-files` protection. Therefore, in safe mode, these preprocessors are **disabled entirely**, not just the marp-cli flags.

| Feature | Safe Mode | Unsafe Mode |
|---------|-----------|-------------|
| `/// lead` → HTML comments | Runs | Runs |
| `:::` container plugin | **Skipped** | Runs |
| `==highlight==` mark plugin | **Skipped** | Runs |
| Mermaid/PlantUML rendering | **Skipped** | Runs |
| Image base64 embedding | **Skipped** | Runs |
| Iframe data URL embedding | **Skipped** | Runs |

This allows:
- Using the directive shorthand (`/// lead`) - transforms to HTML comments (safe, no file access)
- Basic markdown rendering

But skips (not just breaks):
- Container plugin (`:::`) - would output `<div>` tags
- Mark plugin (`==text==`) - would output `<mark>` tags
- Mermaid/PlantUML - would execute external tools
- Image embedding - **would read arbitrary local files**
- Iframe embedding - **would read arbitrary local HTML files**

### Recommendations

1. **Server-side automation with user input**: Use safe mode, or sanitize input before processing
2. **Local development**: Use `--unsafe` freely
3. **CI/CD with controlled input**: Set `mode: "unsafe"` in config file
4. **Obsidian plugin**: Always unsafe (runs locally, user controls input)

### Obsidian Context

The Obsidian plugin doesn't have this distinction because:
- It runs locally on the user's machine
- The user controls their own markdown files
- Obsidian itself already has access to the vault files
- There's no untrusted input scenario

The `mode` config is CLI-only; the Obsidian adapter always operates in "unsafe" mode.

## Migration Path

### Phase 1: Extract Core (Minimal Changes)
1. Move `parseMarpDirective`, `generateMarpComments`, `tokenizePreservingQuotes` to `src/core/preprocessor.ts`
2. Move `genericContainerPlugin`, `markPlugin` to `src/core/markdownItPlugins.ts`
3. Keep existing files as re-exports for backwards compatibility:
   ```typescript
   // src/markdownItPlugins.ts (backwards compat)
   export * from './core/markdownItPlugins';
   export * from './core/preprocessor';
   ```

### Phase 2: Add CLI
1. Create `src/core/diagrams/mermaid-cli.ts`
2. Create `src/core/config.ts`
3. Create `src/cli/index.ts`
4. Add `bin` entry to `package.json`

### Phase 3: Refactor Obsidian Code
1. Move `deckView.ts`, `main.ts`, `settingTab.ts` to `src/obsidian/`
2. Update imports
3. Have Obsidian settings adapter convert to core config format

### Phase 4: Add PlantUML (Optional)
1. Create `src/core/diagrams/plantuml.ts`
2. Add PlantUML regex and preprocessing
3. Add settings UI in Obsidian

## Package.json Changes

```json
{
  "name": "obsidian-marp-plugin",
  "bin": {
    "marp-extended": "./dist/cli/index.js"
  },
  "exports": {
    ".": "./main.js",
    "./cli": "./dist/cli/index.js",
    "./core": "./dist/core/index.js"
  },
  "scripts": {
    "build:cli": "esbuild src/cli/index.ts --bundle --platform=node --outfile=dist/cli/index.js",
    "build:obsidian": "node esbuild.config.mjs production",
    "build": "npm run build:cli && npm run build:obsidian"
  },
  "dependencies": {
    "commander": "^12.0.0"
  }
}
```

## What Stays Obsidian-Only

- **Live preview** (`deckView.ts`) - requires DOM, Obsidian APIs
- **Sync scroll** - preview-specific
- **Settings UI** (`settingTab.ts`) - Obsidian PluginSettingTab
- **Wikilink resolution** - uses Obsidian vault API
- **File watching/auto-reload** - uses Obsidian events
- **Browser-based Mermaid** - uses DOM, fine for preview

## What's Shared (Core)

- **Preprocessors**: `///` directives, container plugin, mark plugin
- **Engine generation**: markdown-it plugin bundling
- **Config types**: shared between CLI args and Obsidian settings
- **Diagram rendering interface**: backend-agnostic
- **Image base64 conversion**: for export embedding

## Open Questions

1. **Should CLI be a separate npm package?**
   - Pro: Cleaner separation, independent versioning
   - Con: More maintenance, sync issues
   - Recommendation: Keep in same package, separate entry points

2. **How to handle Obsidian-specific image resolution (wikilinks)?**
   - CLI doesn't have vault context
   - Option A: CLI only supports standard markdown images
   - Option B: CLI has a `--vault-path` option that enables wikilink resolution
   - Recommendation: Option A initially, add B if needed

3. **Should we support watch mode in CLI?**
   - marp-cli already has `--watch`
   - Our preprocessor would need to re-run on changes
   - Recommendation: Defer, use marp-cli's watch for now

4. **NPX vs global install?**
   - Could be used via `npx obsidian-marp-plugin` or `npm install -g`
   - Recommendation: Support both, document npx for simplicity
