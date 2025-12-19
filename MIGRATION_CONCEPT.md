# Migration Concept: Features from obsidian-marp-slides

This document outlines the plan to migrate valuable features from the `obsidian-marp-slides` project to this plugin (`obsidian-marp-plugin`), while maintaining the cleaner architecture and Wikilink support that makes this project superior.

## Source Project Reference

The source project is located at:
```
/home/mhenze/Development/3rdParty/obsidian-marp-slides/
```

Key source files to reference:
- `/home/mhenze/Development/3rdParty/obsidian-marp-slides/src/main.ts`
- `/home/mhenze/Development/3rdParty/obsidian-marp-slides/src/views/marpPreviewView.ts`
- `/home/mhenze/Development/3rdParty/obsidian-marp-slides/src/utilities/marpExport.ts`
- `/home/mhenze/Development/3rdParty/obsidian-marp-slides/src/utilities/settings.ts`
- `/home/mhenze/Development/3rdParty/obsidian-marp-slides/src/utilities/icons.ts`

---

## 1. Configuration Migration

### Current State (marp-plugin)
```typescript
// src/settings.ts - Only 3 settings
interface MarpPluginSettings {
  autoReload: boolean;
  createNewSplitTab: boolean;
  themeDir: string;
}
```

### Target State
```typescript
// src/settings.ts - Extended settings
export interface MarpPluginSettings {
  // Existing settings
  autoReload: boolean;
  createNewSplitTab: boolean;
  themeDir: string;

  // New settings from marp-slides
  chromePath: string;           // Custom Chrome/Chromium path for PDF/PPTX export
  exportPath: string;           // Custom export directory (default: Downloads)
  enableHTML: boolean;          // Allow HTML elements in Marp markdown
  mathTypesetting: 'mathjax' | 'katex';  // Math rendering engine
  htmlExportMode: 'bare' | 'bespoke';    // HTML template mode
  embedAssetsInHTML: boolean;   // Embed images as base64 in HTML exports
}

export const MARP_DEFAULT_SETTINGS: MarpPluginSettings = {
  // Existing defaults
  autoReload: true,
  createNewSplitTab: true,
  themeDir: 'MarpTheme',

  // New defaults
  chromePath: '',
  exportPath: '',  // Empty = Downloads folder
  enableHTML: false,
  mathTypesetting: 'mathjax',
  htmlExportMode: 'bespoke',
  embedAssetsInHTML: true,
};
```

### Implementation Steps

1. **Update `src/settings.ts`** with new interface and defaults

2. **Update `src/settingTab.ts`** to add new UI controls:

```typescript
// Add after existing settings in display()

new Setting(containerEl)
  .setName('Chrome Path')
  .setDesc('Custom path to Chrome/Chromium for PDF, PPTX, and PNG exports. Leave empty for auto-detection.')
  .addText(text => text
    .setPlaceholder('/usr/bin/chromium')
    .setValue(this.plugin.settings.chromePath)
    .onChange(async v => {
      this.plugin.settings.chromePath = v;
      await this.plugin.saveSettings();
    }));

new Setting(containerEl)
  .setName('Export Path')
  .setDesc('Custom directory for exports. Leave empty to use Downloads folder.')
  .addText(text => text
    .setPlaceholder('~/Documents/Presentations')
    .setValue(this.plugin.settings.exportPath)
    .onChange(async v => {
      this.plugin.settings.exportPath = v;
      await this.plugin.saveSettings();
    }));

new Setting(containerEl)
  .setName('Enable HTML')
  .setDesc('Allow HTML elements in Marp markdown (security risk).')
  .addToggle(toggle => toggle
    .setValue(this.plugin.settings.enableHTML)
    .onChange(async v => {
      this.plugin.settings.enableHTML = v;
      await this.plugin.saveSettings();
    }));

new Setting(containerEl)
  .setName('Math Typesetting')
  .setDesc('Math rendering engine for equations.')
  .addDropdown(dropdown => dropdown
    .addOption('mathjax', 'MathJax')
    .addOption('katex', 'KaTeX')
    .setValue(this.plugin.settings.mathTypesetting)
    .onChange(async v => {
      this.plugin.settings.mathTypesetting = v as 'mathjax' | 'katex';
      await this.plugin.saveSettings();
    }));

new Setting(containerEl)
  .setName('HTML Export Template')
  .setDesc('Template for HTML exports. Bespoke supports transitions.')
  .addDropdown(dropdown => dropdown
    .addOption('bare', 'Bare (simple)')
    .addOption('bespoke', 'Bespoke (transitions)')
    .setValue(this.plugin.settings.htmlExportMode)
    .onChange(async v => {
      this.plugin.settings.htmlExportMode = v as 'bare' | 'bespoke';
      await this.plugin.saveSettings();
    }));

new Setting(containerEl)
  .setName('Embed Assets in HTML')
  .setDesc('Embed images as base64 data URLs in HTML exports for portability.')
  .addToggle(toggle => toggle
    .setValue(this.plugin.settings.embedAssetsInHTML)
    .onChange(async v => {
      this.plugin.settings.embedAssetsInHTML = v;
      await this.plugin.saveSettings();
    }));
```

3. **Update `src/marp.ts`** to use settings:

```typescript
import { Marp } from '@marp-team/marp-core';
import { MarpPluginSettings } from './settings';

export function createMarp(settings: MarpPluginSettings): Marp {
  return new Marp({
    html: settings.enableHTML,
    math: settings.mathTypesetting,
  });
}

// Keep singleton for backward compatibility, but allow recreation
let marpInstance: Marp | null = null;

export function getMarp(settings?: MarpPluginSettings): Marp {
  if (settings) {
    marpInstance = createMarp(settings);
  }
  if (!marpInstance) {
    marpInstance = new Marp();
  }
  return marpInstance;
}
```

### Reference Implementation
See `/home/mhenze/Development/3rdParty/obsidian-marp-slides/src/utilities/settings.ts` for the full settings interface.

---

## 2. Error Handling Improvements

### Current State
Basic console.error with minimal user feedback.

### Target State
Comprehensive error handling with user-friendly notifications.

### Implementation

Create new file `src/errors.ts`:

```typescript
import { Notice } from 'obsidian';

export class MarpExportError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'MarpExportError';
  }
}

export function handleExportError(error: unknown): void {
  console.error('[Marp Plugin]', error);

  if (error instanceof MarpExportError) {
    switch (error.code) {
      case 'CHROME_NOT_FOUND':
        new Notice(
          'Chrome/Chromium not found. Please install Chrome or set a custom path in settings.',
          10000
        );
        break;
      case 'NPX_NOT_FOUND':
        new Notice(
          'Node.js/npx not found. Please install Node.js to enable exports.',
          10000
        );
        break;
      case 'EXPORT_PATH_INVALID':
        new Notice(
          `Export directory not accessible: ${error.message}`,
          10000
        );
        break;
      default:
        new Notice(`Export failed: ${error.message}`, 10000);
    }
    return;
  }

  if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.includes('ENOENT') && error.message.includes('npx')) {
      new Notice(
        'Node.js not found. Please install Node.js to enable exports.',
        10000
      );
      return;
    }
    if (error.message.includes('EACCES')) {
      new Notice(
        'Permission denied. Check file permissions for the export directory.',
        10000
      );
      return;
    }
    new Notice(`Export error: ${error.message}`, 10000);
    return;
  }

  new Notice('An unexpected error occurred during export.', 10000);
}

export async function checkNodeInstalled(): Promise<boolean> {
  const { exec } = await import('child_process');
  return new Promise(resolve => {
    exec('npx --version', error => {
      resolve(!error);
    });
  });
}

export async function checkChromeInstalled(customPath?: string): Promise<boolean> {
  const { access } = await import('fs/promises');

  if (customPath) {
    try {
      await access(customPath);
      return true;
    } catch {
      return false;
    }
  }

  // Check common locations
  const commonPaths = process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    : process.platform === 'win32'
    ? ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe']
    : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];

  for (const path of commonPaths) {
    try {
      await access(path);
      return true;
    } catch {
      continue;
    }
  }

  return false;
}
```

### Update `src/export.ts`:

```typescript
import { handleExportError, MarpExportError, checkNodeInstalled } from './errors';

export async function exportSlide(
  file: TFile,
  ext: 'html' | 'pdf' | 'pptx' | 'png',
  basePath: string,
  themeDir: string,
  settings: MarpPluginSettings,
) {
  // Check Node.js availability first
  if (!await checkNodeInstalled()) {
    throw new MarpExportError(
      'Node.js/npx is required for exports',
      'NPX_NOT_FOUND'
    );
  }

  // Determine export directory
  const exportDir = settings.exportPath || join(
    process.env[process.platform == 'win32' ? 'USERPROFILE' : 'HOME']!,
    'Downloads',
  );

  // Validate export directory
  try {
    await mkdir(exportDir, { recursive: true });
  } catch (e) {
    throw new MarpExportError(
      `Cannot create export directory: ${exportDir}`,
      'EXPORT_PATH_INVALID'
    );
  }

  // ... rest of export logic with try/catch wrapping handleExportError
}
```

### Reference Implementation
See `/home/mhenze/Development/3rdParty/obsidian-marp-slides/src/utilities/marpExport.ts` lines 202-236 for CLI error handling patterns.

---

## 3. Live Reload and File Selection

### Current State
- Auto-reload on any file modification
- No file filtering (reloads for any file change)
- No Marp presentation detection

### Target State
- Auto-reload only when the displayed file changes
- Auto-load Marp presentations when preview is empty
- Detect Marp presentations via frontmatter

### Implementation

Add to `src/preview.ts`:

```typescript
// Add method to detect Marp presentations
async isMarpPresentation(file: TFile): Promise<boolean> {
  if (file.extension !== 'md') {
    return false;
  }

  try {
    const content = await this.app.vault.cachedRead(file);
    // Check for YAML frontmatter with marp: true
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      return /^marp\s*:\s*true\s*$/m.test(frontmatter);
    }
  } catch (e) {
    console.error('Failed to read file for Marp check:', e);
  }

  return false;
}

// Update onChange to only reload current file
onChange(modifiedFile: TFile) {
  if (!this.settings.autoReload) return;
  // Only reload if the modified file is the one being displayed
  if (this.file && modifiedFile.path === this.file.path) {
    this.renderPreview();
  }
}

// Add active file change listener in onOpen
async onOpen() {
  // Existing event registration
  this.registerEvent(
    this.app.vault.on('modify', (file) => {
      if (file instanceof TFile) {
        this.onChange(file);
      }
    })
  );

  // NEW: Listen for active file changes to auto-load Marp presentations
  this.registerEvent(
    this.app.workspace.on('active-leaf-change', async () => {
      // Only auto-load if preview has no file yet
      if (!this.file) {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && await this.isMarpPresentation(activeFile)) {
          this.file = activeFile;
          await this.renderPreview();
        }
      }
    })
  );

  this.addActions();
}
```

### Update `src/main.ts` activateView:

```typescript
async activateView(file: TFile) {
  // Check if file is a Marp presentation before opening
  const content = await this.app.vault.cachedRead(file);
  const isMarp = /^---\s*\n[\s\S]*?marp\s*:\s*true[\s\S]*?\n---/m.test(content);

  if (!isMarp) {
    new Notice(
      'This file does not appear to be a Marp presentation. Add "marp: true" to the frontmatter.',
      10000
    );
    return;
  }

  // ... rest of activateView
}
```

### Reference Implementation
See `/home/mhenze/Development/3rdParty/obsidian-marp-slides/src/views/marpPreviewView.ts`:
- Lines 153-172: `isMarpPresentation()` method
- Lines 133-147: `active-leaf-change` event listener
- Lines 124-131: File modification handler with path check

---

## 4. Sidebar Toolbar Implementation

### Current State
Only view header actions (visible when preview is in main area).

### Target State
Inline toolbar that appears when preview is in sidebar (where header actions are hidden).

### Implementation

Update `src/preview.ts`:

```typescript
import { setIcon } from 'obsidian';

export class PreviewView extends ItemView implements PreviewViewState {
  file: TFile | null;
  settings: MarpPluginSettings;

  // NEW: UI elements
  private wrapperEl: HTMLElement;
  private toolbarEl: HTMLElement;
  private slidesContainerEl: HTMLElement;

  // ... existing constructor

  async onOpen() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();

    // Create wrapper for horizontal layout (slides + toolbar)
    this.wrapperEl = container.createDiv({ cls: 'marp-preview-wrapper' });
    this.wrapperEl.style.display = 'flex';
    this.wrapperEl.style.flexDirection = 'row';
    this.wrapperEl.style.height = '100%';
    this.wrapperEl.style.width = '100%';

    // Create slides container (left side)
    this.slidesContainerEl = this.wrapperEl.createDiv({ cls: 'marp-preview-slides' });
    this.slidesContainerEl.style.flex = '1';
    this.slidesContainerEl.style.overflow = 'auto';
    this.slidesContainerEl.style.minWidth = '0';

    // Create inline toolbar (right side) - only visible in sidebar
    this.toolbarEl = this.wrapperEl.createDiv({ cls: 'marp-preview-toolbar' });
    this.toolbarEl.style.flexShrink = '0';
    this.createToolbarButtons();
    this.updateToolbarVisibility();

    // Register events
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile) this.onChange(file);
      })
    );

    // Update toolbar visibility when layout changes
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        this.updateToolbarVisibility();
      })
    );

    // Also add header actions for main area
    this.addActions();
  }

  private isInSidebar(): boolean {
    const root = this.leaf.getRoot();
    return root === this.app.workspace.leftSplit ||
           root === this.app.workspace.rightSplit;
  }

  private updateToolbarVisibility() {
    if (this.isInSidebar()) {
      this.toolbarEl.style.display = 'flex';
      this.toolbarEl.style.flexDirection = 'column';
      this.toolbarEl.style.padding = '8px';
      this.toolbarEl.style.gap = '4px';
      this.toolbarEl.style.borderLeft = '1px solid var(--background-modifier-border)';
    } else {
      this.toolbarEl.style.display = 'none';
    }
  }

  private createToolbarButton(
    icon: string,
    title: string,
    callback: () => void
  ): HTMLElement {
    const button = this.toolbarEl.createEl('button', {
      cls: 'marp-toolbar-button clickable-icon',
      attr: { 'aria-label': title, 'title': title }
    });
    setIcon(button, icon);
    button.addEventListener('click', callback);
    return button;
  }

  private createToolbarButtons() {
    const basePath = (
      this.app.vault.adapter as FileSystemAdapter
    ).getBasePath();
    const themeDir = join(basePath, this.settings.themeDir);

    // Refresh/Load Current File button
    this.createToolbarButton('refresh-cw', 'Load Current File', async () => {
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile && await this.isMarpPresentation(activeFile)) {
        this.file = activeFile;
        await this.renderPreview();
      }
    });

    // Export buttons
    this.createToolbarButton('download', 'Export as PDF', () => {
      if (this.file) exportSlide(this.file, 'pdf', basePath, themeDir, this.settings);
    });

    this.createToolbarButton('image', 'Export as PPTX', () => {
      if (this.file) exportSlide(this.file, 'pptx', basePath, themeDir, this.settings);
    });

    this.createToolbarButton('code-glyph', 'Export as HTML', () => {
      if (this.file) exportSlide(this.file, 'html', basePath, themeDir, this.settings);
    });

    this.createToolbarButton('image-file', 'Export as PNG', () => {
      if (this.file) exportSlide(this.file, 'png', basePath, themeDir, this.settings);
    });
  }

  // Update renderPreview to use slidesContainerEl
  async renderPreview() {
    if (!this.file) return;
    const originContent = await this.app.vault.cachedRead(this.file);
    const content = this.replaceImageWikilinks(originContent);
    const { html, css } = getMarp(this.settings).render(content);
    const doc = await convertHtml(html);

    // Use slidesContainerEl instead of container
    this.slidesContainerEl.empty();
    this.slidesContainerEl.appendChild(doc.body.children[0]);
    this.slidesContainerEl.createEl('style', { text: css });
  }
}
```

### Add CSS (create `styles.css` or add to existing):

```css
.marp-preview-wrapper {
  display: flex;
  height: 100%;
}

.marp-preview-slides {
  flex: 1;
  overflow: auto;
}

.marp-preview-toolbar {
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 4px;
  border-left: 1px solid var(--background-modifier-border);
  background: var(--background-primary);
}

.marp-toolbar-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  cursor: pointer;
  border: none;
  background: transparent;
  color: var(--text-muted);
}

.marp-toolbar-button:hover {
  background: var(--background-modifier-hover);
  color: var(--text-normal);
}
```

### Reference Implementation
See `/home/mhenze/Development/3rdParty/obsidian-marp-slides/src/views/marpPreviewView.ts`:
- Lines 66-91: `onOpen()` with wrapper/toolbar setup
- Lines 139-151: `isInSidebar()` and `updateToolbarVisibility()`
- Lines 284-347: `createToolbarButton()` and `createToolbarButtons()`

---

## 5. Additional Export Formats

### PNG Export

Add to `src/export.ts`:

```typescript
// Update the ext type
ext: 'html' | 'pdf' | 'pptx' | 'png',

// In the command construction, add PNG case
let cmd: string;
const baseArgs = `npx -y @marp-team/marp-cli@latest --stdin false --allow-local-files`;
const themeArgs = existsSync(themeDir) ? `--theme-set "${themeDir}"` : '';
const templateArgs = ext === 'html' ? `--bespoke.transition` : '';

// Handle PNG export differently (multiple files)
if (ext === 'png') {
  cmd = `${baseArgs} ${themeArgs} --images png -o "${join(exportDir, file.basename)}.png" --engine ${tmpEnginePath} -- "${tmpPath}"`;
} else {
  cmd = `${baseArgs} ${themeArgs} ${templateArgs} -o "${join(exportDir, file.basename)}.${ext}" --engine ${tmpEnginePath} -- "${tmpPath}"`;
}
```

### PDF with Notes Export

Add new export option:

```typescript
export async function exportSlide(
  file: TFile,
  ext: 'html' | 'pdf' | 'pptx' | 'png' | 'pdf-notes',
  // ...
) {
  // ...

  if (ext === 'pdf-notes') {
    cmd = `${baseArgs} ${themeArgs} --pdf --pdf-notes --pdf-outlines -o "${join(exportDir, file.basename)}.pdf" --engine ${tmpEnginePath} -- "${tmpPath}"`;
  }
}
```

---

## 6. Custom Icons (Optional)

The marp-slides project has custom SVG icons. If you want to use them:

### Reference
See `/home/mhenze/Development/3rdParty/obsidian-marp-slides/src/utilities/icons.ts`

### Implementation

Create `src/icons.ts`:

```typescript
import { addIcon } from 'obsidian';

export const ICON_SLIDE_PREVIEW = `<svg viewBox="0 0 24 24" ...>...</svg>`;
export const ICON_EXPORT_PDF = `<svg viewBox="0 0 24 24" ...>...</svg>`;
export const ICON_EXPORT_PPTX = `<svg viewBox="0 0 24 24" ...>...</svg>`;

export function registerMarpIcons() {
  addIcon('marp-preview', ICON_SLIDE_PREVIEW);
  addIcon('marp-pdf', ICON_EXPORT_PDF);
  addIcon('marp-pptx', ICON_EXPORT_PPTX);
}
```

Call `registerMarpIcons()` in `main.ts` `onload()`.

---

## 7. Migration Priority

### Phase 1 (High Priority)
1. Extended settings (`src/settings.ts`, `src/settingTab.ts`)
2. Error handling (`src/errors.ts`, update `src/export.ts`)
3. Custom export path support

### Phase 2 (Medium Priority)
4. Sidebar toolbar (`src/preview.ts`)
5. PNG export support
6. Marp presentation detection

### Phase 3 (Nice to Have)
7. PDF with notes export
8. Math engine selection in Marp instance
9. Custom icons
10. Cursor sync (complex, lower priority)

---

## 8. Testing Checklist

After implementing each feature, verify:

- [ ] Settings persist correctly across Obsidian restarts
- [ ] Export works with custom export path
- [ ] Export works with custom Chrome path
- [ ] Error messages appear as Notice popups
- [ ] Toolbar appears in sidebar, hides in main area
- [ ] Toolbar buttons trigger correct exports
- [ ] "Load Current File" loads active Marp presentation
- [ ] Auto-reload only triggers for displayed file
- [ ] PNG export creates individual slide images
- [ ] Wikilink image support still works after changes

---

## 9. Files to Create/Modify

### New Files
- `src/errors.ts` - Error handling utilities
- `src/icons.ts` - Custom icon definitions (optional)
- `styles.css` - Toolbar styling

### Modified Files
- `src/settings.ts` - Extended settings interface
- `src/settingTab.ts` - New settings UI
- `src/marp.ts` - Settings-aware Marp creation
- `src/preview.ts` - Toolbar, file detection, improved reload
- `src/export.ts` - PNG support, error handling, settings integration
- `src/main.ts` - Marp detection before opening preview
- `manifest.json` - Update version

---

## 10. Architecture Notes

### Why Not Bundle marp-cli?

The marp-slides project bundles `@marp-team/marp-cli` directly but faces Electron security restrictions when trying to load custom engines via `file://` protocol. The npx approach in this project avoids this issue entirely because:

1. npx runs as an external Node.js process
2. The process has full filesystem access
3. Custom engine files can be loaded without Electron restrictions

### Temporary File Strategy

The current approach of creating temporary files for export is correct:
1. Create temp markdown with embedded base64 images
2. Create temp engine.js with data URL validation
3. Run marp-cli
4. Clean up temp files

This should be preserved and enhanced with better error handling.

---

## Questions for Implementation

1. Should we add a "Preview in Browser" option like marp-slides has?
2. Should the sidebar toolbar be configurable (show/hide specific buttons)?
3. Should we support multiple simultaneous preview windows?
4. Should cursor sync be implemented? (Complex feature, may not be worth it)

---

*Document created: 2024-12-14*
*Source comparison: obsidian-marp-slides v0.45.6 vs obsidian-marp-plugin v1.5.0*
