# Development Guide

This guide covers building, testing, and deploying the Obsidian Marp Plugin.

## Prerequisites

- **Node.js** v18 or later
- **npm** v9 or later
- **Git**

For CLI features:
- **mmdc** (mermaid-cli) - `npm install -g @mermaid-js/mermaid-cli`
- **Java** + **plantuml.jar** - for PlantUML support

## Quick Start

```bash
# Clone repository
git clone https://github.com/mhenze-exaring/marp-extended-plugin.git
cd marp-extended-plugin

# Install dependencies
npm install

# Build plugin
npm run build

# Deploy plugin to Obsidian
npm run deploy

# Build CLI
npm run build:cli

# Run tests
npm test
```

## Build Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Development mode with file watching |
| `npm run build` | Production build with type checking |
| `npm run build:quick` | Production build (skip type check) |
| `npm run build:cli` | Build CLI tool only |
| `npm run build:all` | Build both Obsidian plugin and CLI |
| `npm test` | Run test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run deploy` | Build and deploy to local vault |

## Build Output

All build artifacts go to `dist/`:

```
dist/
├── obsidian/
│   ├── main.js        # Obsidian plugin bundle
│   └── manifest.json  # Plugin manifest (copied)
└── cli/
    └── index.js       # CLI tool bundle
```

## Local Development

### Development Mode

Start the dev server with file watching:

```bash
npm run dev
```

This watches `src/` and rebuilds `dist/obsidian/main.js` on changes.

### Deploying to Your Vault

The `deploy` script builds and copies to a local vault:

```bash
npm run deploy
```

By default, it copies to:
```
dev-vault/.obsidian/plugins/marp-extended/
```

To change the target vault, edit `package.json`:

```json
{
  "scripts": {
    "deploy": "npm run build:quick && cp -r dist/obsidian/. dev-vault/.obsidian/plugins/marp-extended/"
  }
}
```

After deploying, restart Obsidian or use the "Reload app without saving" command.

### Manual Installation

1. Build the plugin:
   ```bash
   npm run build:quick
   ```

2. Create the plugin folder in your vault:
   ```bash
   mkdir -p /path/to/vault/.obsidian/plugins/marp-extended
   ```

3. Copy the built files:
   ```bash
   cp dist/obsidian/* /path/to/vault/.obsidian/plugins/marp-extended/
   ```

4. Enable the plugin in Obsidian Settings → Community Plugins

## Testing

### Run Tests

```bash
npm test
```

### Watch Mode

```bash
npm run test:watch
```

### Test Coverage

Tests are located in `src/*.test.ts` and use Vitest.

Current test coverage:
- `markdownItPlugins.test.ts` - Container and mark plugin tests (56 tests)

## CLI Development

### Building the CLI

```bash
npm run build:cli
```

Output: `dist/cli/index.js`

### Running the CLI

```bash
# Direct execution
node dist/cli/index.js presentation.md --help

# Or link globally
npm link
marp-extended presentation.md --help
```

### CLI Options

```
Usage: marp-extended [options] <input>

Marp CLI with extended syntax support

Arguments:
  input                    Input markdown file

Options:
  -V, --version            output the version number
  -o, --output <file>      Output file
  -c, --config <file>      Config file
  --format <type>          Output format: html, pdf, pptx (default: "html")
  --unsafe                 Enable full features (--html, --allow-local-files)
  --theme-dir <dir>        Theme directory
  --no-mermaid             Disable Mermaid preprocessing
  --no-plantuml            Disable PlantUML preprocessing
  --no-directives          Disable /// directive shorthand
  --no-containers          Disable ::: container plugin
  --no-mark                Disable ==highlight== mark plugin
  --mermaid-cli <path>     Path to mmdc
  --mermaid-theme <theme>  Mermaid theme
  --plantuml-jar <path>    Path to plantuml.jar
  --java <path>            Path to java executable
  --verbose                Verbose output
  -h, --help               display help for command
```

### CLI Configuration File

Create `marp-extended.config.json` in your project:

```json
{
  "mode": "unsafe",
  "preprocessor": {
    "enableDirectiveShorthand": true,
    "enableContainerPlugin": true,
    "enableMarkPlugin": true
  },
  "diagrams": {
    "mermaid": {
      "enabled": true,
      "theme": "default"
    },
    "plantuml": {
      "enabled": true,
      "jarPath": "/path/to/plantuml.jar"
    }
  },
  "export": {
    "format": "html"
  }
}
```

## Code Style

### Formatting

The project uses Prettier with these settings:
- 80 character line width
- 2 space indentation
- Single quotes
- Trailing commas

Format code:
```bash
npx prettier --write src/
```

### Linting

ESLint with TypeScript rules:
```bash
npx eslint src/
```

### Type Checking

```bash
npx tsc --noEmit
```

Note: Some pre-existing type errors in the codebase are currently skipped with `--skipLibCheck`.

## Project Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for:
- Module structure and responsibilities
- Data flow diagrams
- Build system details
- Security considerations

## Releasing

### Version Bump

```bash
npm version patch  # or minor, major
```

This runs the version script which updates `manifest.json` and `versions.json`.

### Creating a Release

1. Build production bundles:
   ```bash
   npm run build:all
   ```

2. Create GitHub release with:
   - `dist/obsidian/main.js`
   - `dist/obsidian/manifest.json`
   - `styles.css` (if present)

## Troubleshooting

### "npx not found" during export

Node.js is not installed or not in PATH. Install Node.js from https://nodejs.org/

On macOS, the plugin uses `fix-path` to resolve PATH issues in GUI apps.

### Mermaid diagrams not rendering

1. Check "Enable Mermaid" is on in settings
2. For CLI: ensure `mmdc` is installed (`npm install -g @mermaid-js/mermaid-cli`)
3. Check browser console for errors (Obsidian: Cmd/Ctrl+Shift+I)

### Custom themes not loading

1. Verify theme folder exists (default: `vault/MarpTheme/`)
2. Check theme files have `.css` extension
3. **Restart Obsidian** after adding new themes
4. Verify frontmatter uses correct theme name: `theme: my-theme` (without `.css`)

### Export fails silently

1. Open DevTools (Cmd/Ctrl+Shift+I) to check console errors
2. Verify Node.js is installed: `node --version`
3. For PDF/PPTX: ensure Chrome/Chromium is installed
4. Check export path is writable

### Build errors

```bash
# Clean and rebuild
rm -rf node_modules dist
npm install
npm run build
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run `npm test` and `npm run build`
5. Submit a pull request

Please follow existing code style and add tests for new functionality.
