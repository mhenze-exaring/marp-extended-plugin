# Editor Extension Concept: Syntax Highlighting for Custom Marp Syntax

## Overview

This document describes a potential CodeMirror 6 editor extension to provide syntax highlighting for the custom Marp syntax elements introduced in this plugin:

- `///` directive shorthand
- `:::` container blocks with extended syntax

## Goal

Make the custom syntax visually distinct in the editor, similar to how HTML comments or code fences are styled - greyed out or otherwise differentiated from regular content.

## Technical Approach

Obsidian uses CodeMirror 6 for its editor. Custom syntax highlighting can be added via:

1. **ViewPlugin with Decorations** - Scan visible lines and apply CSS classes
2. **registerEditorExtension()** - Obsidian's Plugin API to register the extension

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                    ViewPlugin                       │
│  ┌───────────────────────────────────────────────┐  │
│  │  buildDecorations(view: EditorView)           │  │
│  │  - Iterate visible lines                      │  │
│  │  - Match patterns: /^\/\/\/\s/, /^:::\s/      │  │
│  │  - Create line decorations with CSS classes   │  │
│  └───────────────────────────────────────────────┘  │
│                        │                            │
│                        ▼                            │
│  ┌───────────────────────────────────────────────┐  │
│  │  DecorationSet                                │  │
│  │  - marp-directive-line (for ///)              │  │
│  │  - marp-container-open (for ::: with params)  │  │
│  │  - marp-container-close (for bare :::)        │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                   styles.css                        │
│  .marp-directive-line { color: var(--text-muted); } │
│  .marp-container-open { ... }                       │
└─────────────────────────────────────────────────────┘
```

## Implementation

### 1. Create Editor Extension (`src/editorExtension.ts`)

```typescript
import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

// Decoration for /// directive lines
const directiveDecoration = Decoration.line({
  class: 'marp-directive-line',
});

// Decoration for ::: container opening lines (with parameters)
const containerOpenDecoration = Decoration.line({
  class: 'marp-container-open',
});

// Decoration for ::: container closing lines (bare :::)
const containerCloseDecoration = Decoration.line({
  class: 'marp-container-close',
});

// Patterns
const DIRECTIVE_PATTERN = /^\/\/\/\s+\S/;  // /// followed by content
const CONTAINER_OPEN_PATTERN = /^:::\s+\S/; // ::: followed by parameters
const CONTAINER_CLOSE_PATTERN = /^:::\s*$/; // bare ::: (closing)

export const marpSyntaxHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();

      for (const { from, to } of view.visibleRanges) {
        let pos = from;
        while (pos < to) {
          const line = view.state.doc.lineAt(pos);
          const text = line.text;

          if (DIRECTIVE_PATTERN.test(text)) {
            builder.add(line.from, line.from, directiveDecoration);
          } else if (CONTAINER_OPEN_PATTERN.test(text)) {
            builder.add(line.from, line.from, containerOpenDecoration);
          } else if (CONTAINER_CLOSE_PATTERN.test(text)) {
            builder.add(line.from, line.from, containerCloseDecoration);
          }

          pos = line.to + 1;
        }
      }

      return builder.finish();
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
```

### 2. Register in Plugin (`src/main.ts`)

```typescript
import { marpSyntaxHighlighter } from './editorExtension';

export default class MarpPlugin extends Plugin {
  async onload() {
    // ... existing code ...

    // Register editor extension for syntax highlighting
    this.registerEditorExtension(marpSyntaxHighlighter);
  }
}
```

### 3. Add Styles (`styles.css`)

```css
/* Marp directive shorthand (/// lead paginate:skip) */
.marp-directive-line {
  color: var(--text-muted);
  font-style: italic;
}

/* Container opening (::: caption-left width:50%) */
.marp-container-open {
  color: var(--text-muted);
}

/* Container closing (:::) */
.marp-container-close {
  color: var(--text-muted);
}

/* Optional: Add background highlight */
.marp-directive-line,
.marp-container-open,
.marp-container-close {
  background-color: var(--background-modifier-code);
  border-radius: 2px;
}
```

## Alternative: Token-based Highlighting

For more fine-grained control (highlighting individual parts like the `///` marker, class names, and directives differently), a more complex approach using `MatchDecorator` or custom tokenization would be needed:

```typescript
import { MatchDecorator } from '@codemirror/view';

const directiveMarkerDeco = Decoration.mark({ class: 'marp-directive-marker' });
const directiveClassDeco = Decoration.mark({ class: 'marp-directive-class' });
const directiveKeyDeco = Decoration.mark({ class: 'marp-directive-key' });
const directiveValueDeco = Decoration.mark({ class: 'marp-directive-value' });

// Would require regex with capture groups and multiple decorators
```

This is significantly more complex and may not be worth the effort for this use case.

## Considerations

### Performance

- `ViewPlugin` only processes visible lines, so large documents are handled efficiently
- Decorations are rebuilt on document changes and viewport scrolling
- For very frequent typing, consider debouncing the rebuild

### Theme Compatibility

- Use CSS variables from Obsidian's theme (`--text-muted`, `--background-modifier-code`)
- Test with both light and dark themes
- Consider adding theme-specific overrides if needed

### User Preferences

Consider adding a setting to enable/disable editor highlighting:

```typescript
interface MarpPluginSettings {
  // ... existing settings ...
  enableEditorHighlighting: boolean;
}
```

### Marp File Detection

The extension should ideally only activate in files with `marp: true` in frontmatter. This requires checking the document content:

```typescript
function isMarpDocument(view: EditorView): boolean {
  const firstLines = view.state.doc.sliceString(0, 200);
  return /^---[\s\S]*?marp:\s*true[\s\S]*?---/m.test(firstLines);
}
```

## Future Enhancements

1. **Autocomplete** - Suggest class names and directive keys
2. **Hover tooltips** - Show what the syntax expands to
3. **Folding** - Allow folding container blocks
4. **Validation** - Highlight invalid syntax with error styling
5. **Go to definition** - Jump to theme CSS for class names

## References

- [CodeMirror 6 Decorations](https://codemirror.net/docs/ref/#view.Decoration)
- [CodeMirror 6 ViewPlugin](https://codemirror.net/docs/ref/#view.ViewPlugin)
- [Obsidian Plugin API - registerEditorExtension](https://docs.obsidian.md/Reference/TypeScript+API/Plugin/registerEditorExtension)
- [Obsidian Sample Plugin with CM6](https://github.com/obsidianmd/obsidian-sample-plugin)
