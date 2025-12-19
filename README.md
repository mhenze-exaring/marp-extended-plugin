# Obsidian Marp Plugin

Create beautiful slide presentations using [Marp](https://marp.app/) directly within [Obsidian](https://obsidian.md/). This plugin provides live preview, export capabilities, and extended Markdown syntax for professional presentations.

## Features

### Live Preview

Preview your Marp slides in real-time within Obsidian. Changes are reflected immediately when you save the file.

![open_preview](docs/open_preview.gif)

#### Auto Reload

![auto_reload](docs/auto_reload.gif)

### Export to PDF, PPTX, HTML

Export your presentations to multiple formats. Images are automatically embedded as Base64, making your exports self-contained and shareable.

**Requires Node.js** - The plugin uses `npx @marp-team/marp-cli` for export.

![export](docs/export.gif)

### Slide Transitions (HTML Export)

![transition](docs/transition.gif)

Export to HTML format to use slide transitions. Requires Chrome 111+ or enabling the View Transitions API in Chrome 110:

![enable_view_transitions_api](docs/enable_view_transitions_api.png)

### Extended Markdown Syntax

#### Directive Shorthand (`///`)

Quick syntax for Marp directives instead of HTML comments:

```markdown
/// lead paginate:skip

# My Title Slide
```

Expands to:
```html
<!-- _class: lead -->
<!-- _paginate: skip -->
```

#### Container Blocks (`:::`)

Create styled containers with flexible syntax:

```markdown
::: columns
Left column content

:::
Right column content
:::
:::

::: .highlight#important style="background: yellow"
Highlighted content with class, ID, and inline styles
:::
```

#### Mark/Highlight (`==text==`)

Highlight text with double equals:

```markdown
This is ==highlighted== text.
```

Renders as `<mark>highlighted</mark>`.

### Mermaid Diagrams

Embed Mermaid diagrams directly in your slides. Diagrams are rendered to SVG and cached for performance.

````markdown
```mermaid w:400
graph LR
    A[Start] --> B[End]
```
````

Optional sizing: `w:400` (width) or `h:300` (height) in pixels or percentages.

### Wikilink Images

Use Obsidian's native image syntax - both formats work:

```markdown
![[path/to/image.png]]
![alt text](path/to/image.png)
```

### Custom Themes

Load custom CSS themes from your vault:

1. Create a theme folder (default: `MarpTheme/`)
2. Add your `.css` theme files
3. Restart Obsidian to load themes
4. Use `theme: your-theme` in frontmatter

```
your-vault/
└── MarpTheme/
    ├── custom.css
    └── corporate.css
```

### Math Typesetting

Render mathematical equations with MathJax or KaTeX:

```markdown
Inline: $E = mc^2$

Block:
$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$
```

## CLI Tool

This plugin includes a standalone CLI for processing Marp presentations outside of Obsidian:

```bash
# Build the CLI
npm run build:cli

# Basic usage (safe mode)
node dist/cli/index.js presentation.md

# Full features (unsafe mode - enables HTML and local file access)
node dist/cli/index.js presentation.md --unsafe

# Export as PDF
node dist/cli/index.js presentation.md --unsafe --format pdf -o output.pdf

# See all options
node dist/cli/index.js --help
```

The CLI supports the same extended syntax (`///`, `:::`, `==highlight==`) and can render Mermaid diagrams using `mmdc` (mermaid-cli).

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for build instructions and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for technical details.

## Installation

### From Obsidian Community Plugins

1. Open Obsidian Settings
2. Go to Community Plugins and disable Safe Mode
3. Click Browse and search for "Marp"
4. Install and enable the plugin

### Manual Installation

1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/JichouP/obsidian-marp-plugin/releases)
2. Create folder: `<your-vault>/.obsidian/plugins/marp/`
3. Copy the files into the folder
4. Restart Obsidian and enable the plugin

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| **Auto Reload** | On | Update preview automatically when file is saved |
| **Open in Split Tab** | On | Open preview in a new split tab |
| **Theme Folder** | `MarpTheme` | Location of custom theme CSS files |
| **Enable HTML** | On | Allow HTML in Marp slides |
| **Math Typesetting** | MathJax | Math rendering engine (MathJax/KaTeX/disabled) |
| **Enable Plugins** | On | Enable `:::` containers and `==highlight==` syntax |
| **Enable Mermaid** | On | Render Mermaid diagrams |
| **Mermaid Theme** | default | Theme for Mermaid diagrams |
| **Export Path** | Downloads | Output directory for exports |
| **Chrome Path** | (auto) | Custom Chrome/Chromium path for PDF export |

## Creating Presentations

Add `marp: true` to your frontmatter to enable Marp:

```markdown
---
marp: true
theme: default
paginate: true
---

# Slide 1

Content for the first slide

---

# Slide 2

Use `---` to separate slides
```

## Requirements

- **Obsidian** v1.0.0 or later
- **Node.js** (for export functionality)
- **Chrome/Chromium** (for PDF/PPTX export)

## Development

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for:
- Building from source
- Local deployment
- Running tests
- Project structure

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for technical architecture documentation.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Credits

- Original author: [JichouP](https://github.com/JichouP)
- Built on [Marp](https://marp.app/) by the Marp team
