import {
  Editor,
  FileSystemAdapter,
  ItemView,
  normalizePath,
  setIcon,
  TFile,
  ViewStateResult,
  WorkspaceLeaf,
} from 'obsidian';
import { Marp } from '@marp-team/marp-core';
import { browser, type MarpCoreBrowser } from '@marp-team/marp-core/browser';
import { join } from 'path';
import { exportSlide, ExportOptions } from './export';
import { MarpPluginSettings } from './settings';
import {
  genericContainerPlugin,
  markPlugin,
  preprocessForRender,
  type RenderPreprocessContext,
} from '../core';
import { MermaidCacheManager } from './mermaidCache';
import type { ViewUpdate } from '@codemirror/view';

export const MARP_DECK_VIEW_TYPE = 'marp-ext-deck-view';

interface DeckViewState {
  file?: TFile | null; // Used when setting state programmatically
  filePath?: string;   // Used for serialization/deserialization
}

interface SearchMatch {
  element: HTMLElement;
  textNode: Text;
  startOffset: number;
  endOffset: number;
  originalText: string;
}

export class DeckView extends ItemView {
  file: TFile | null;
  settings: MarpPluginSettings;
  mermaidCache: MermaidCacheManager;
  private marp: Marp;
  private marpBrowser: MarpCoreBrowser | undefined;
  private wrapperEl: HTMLElement;
  private toolbarEl: HTMLElement;
  private slidesContainerEl: HTMLElement;

  // Search state
  private searchContainerEl: HTMLElement | null = null;
  private searchInputEl: HTMLInputElement | null = null;
  private searchResultsEl: HTMLElement | null = null;
  private searchMatches: SearchMatch[] = [];
  private currentMatchIndex: number = -1;
  private highlightElements: HTMLElement[] = [];

  // Sync preview state
  private lastSyncedSlideIndex: number = -1;
  private slideBoundaries: number[] = []; // Line numbers where each slide starts
  private activeSlideStyleEl: HTMLStyleElement | null = null;
  private syncDebounceTimeout: number | null = null;
  private lastEditorLineCount: number = -1; // Track line count to detect content changes
  private static readonly SYNC_DEBOUNCE_MS = 250;

  constructor(
    leaf: WorkspaceLeaf,
    settings: MarpPluginSettings,
    mermaidCache: MermaidCacheManager,
  ) {
    super(leaf);
    this.file = null;
    this.settings = settings;
    this.mermaidCache = mermaidCache;
    this.marp = this.createMarpInstance();
  }

  private createMarpInstance(): Marp {
    // HTML must be enabled when Mermaid is used (to render SVG elements)
    const needsHtml = this.settings.enableHTML || this.settings.enableMermaid;

    const marp = new Marp({
      container: { tag: 'div', id: '__marp-vscode' },
      slideContainer: { tag: 'div', 'data-marp-vscode-slide-wrapper': '' },
      html: needsHtml,
      inlineSVG: {
        enabled: true,
        backdropSelector: false,
      },
      math: this.settings.mathTypesetting,
      minifyCSS: true,
      script: false,
    });

    if (this.settings.enableMarkdownItPlugins) {
      // Note: marpDirectivePlugin is NOT used here - it's handled as a pre-processor
      // because Marp parses directives from raw markdown before markdown-it runs
      marp.use(genericContainerPlugin).use(markPlugin);
    }

    return marp;
  }

  private async reinitializeMarp() {
    this.marp = this.createMarpInstance();
    await this.loadThemes();
  }

  private async loadThemes() {
    const { themeDir } = this.settings;
    if (!themeDir) return;

    try {
      const files = this.app.vault
        .getFiles()
        .filter(
          f =>
            f.parent?.path === normalizePath(themeDir) && f.extension === 'css',
        );

      const cssContents = await Promise.all(
        files.map(file => this.app.vault.cachedRead(file)),
      );

      cssContents.forEach(css => {
        try {
          this.marp.themeSet.add(css);
        } catch (e) {
          console.error('Failed to add Marp theme:', e);
        }
      });
    } catch (e) {
      console.error('Failed to load Marp themes:', e);
    }
  }

  getViewType(): string {
    return MARP_DECK_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Marp Deck Preview';
  }

  getIcon(): string {
    return 'presentation';
  }

  // Check if a file is a Marp presentation (has marp: true in frontmatter)
  async isMarpPresentation(file: TFile): Promise<boolean> {
    if (file.extension !== 'md') return false;

    try {
      const content = await this.app.vault.cachedRead(file);
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

  /**
   * Create wikilink resolver for this view's vault context
   * Used by core preprocessForRender() for platform-specific URL resolution
   */
  private createWikilinkResolver(): (name: string) => string {
    return (name: string) => this.app.vault.adapter.getResourcePath(name);
  }

  private getBasePath(): string {
    return (this.app.vault.adapter as FileSystemAdapter).getBasePath();
  }

  private getFileBasePath(file: TFile): string {
    const basePath = this.getBasePath();
    const fileDir = file.parent?.path || '';
    return `app://local/${join(basePath, fileDir)}/`;
  }

  // Resolve a relative image path to an absolute app:// URL
  private resolveImagePath(src: string, fileDir: string): string | null {
    // Skip URLs and data URIs
    if (
      src.startsWith('http://') ||
      src.startsWith('https://') ||
      src.startsWith('data:') ||
      src.startsWith('app://')
    ) {
      return null;
    }

    // Construct the vault-relative path
    const vaultRelativePath = fileDir ? `${fileDir}/${src}` : src;

    // Use Obsidian's resource path resolution
    return this.app.vault.adapter.getResourcePath(vaultRelativePath);
  }

  // Check if a URL is already absolute (http, https, data, app)
  private isAbsoluteUrl(url: string): boolean {
    return (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('data:') ||
      url.startsWith('app://')
    );
  }

  // Resolve a local file path to an app:// URL
  private resolveLocalFilePath(src: string): string | null {
    // Handle absolute filesystem paths (starting with /)
    if (src.startsWith('/')) {
      return `app://local${src}`;
    }
    return null;
  }

  // Process HTML to resolve all image paths relative to the file's directory
  private resolveHtmlImagePaths(html: string, fileDir: string): string {
    const basePath = this.getBasePath();
    const fullBasePath = `app://local/${join(basePath, fileDir)}/`;

    // Replace img src attributes (handles Marp's rendered images)
    html = html.replace(
      /<img([^>]*)\ssrc="([^"]+)"([^>]*)>/gi,
      (match, before, src, after) => {
        const resolved = this.resolveImagePath(src, fileDir);
        if (resolved) {
          return `<img${before} src="${resolved}"${after}>`;
        }
        return match;
      },
    );

    // Replace iframe src attributes (handles embedded local HTML files)
    html = html.replace(
      /<iframe([^>]*)\ssrc="([^"]+)"([^>]*)>/gi,
      (match, before, src, after) => {
        if (this.isAbsoluteUrl(src)) return match;

        // Handle absolute filesystem paths
        const localResolved = this.resolveLocalFilePath(src);
        if (localResolved) {
          return `<iframe${before} src="${localResolved}"${after}>`;
        }

        // Handle vault-relative paths
        const resolved = this.resolveImagePath(src, fileDir);
        if (resolved) {
          return `<iframe${before} src="${resolved}"${after}>`;
        }
        return match;
      },
    );

    // Replace url() in any CSS property - simpler approach that handles all formats
    // Format 1: url(&quot;...&quot;) - HTML entity encoded quotes
    html = html.replace(/url\(&quot;([^&]+)&quot;\)/gi, (match, src) => {
      if (this.isAbsoluteUrl(src)) return match;
      const resolved = this.resolveImagePath(src, fileDir);
      return resolved ? `url(&quot;${resolved}&quot;)` : match;
    });

    // Format 2: url("...") - double quotes
    html = html.replace(/url\("([^"]+)"\)/gi, (match, src) => {
      if (this.isAbsoluteUrl(src)) return match;
      const resolved = this.resolveImagePath(src, fileDir);
      return resolved ? `url("${resolved}")` : match;
    });

    // Format 3: url('...') - single quotes
    html = html.replace(/url\('([^']+)'\)/gi, (match, src) => {
      if (this.isAbsoluteUrl(src)) return match;
      const resolved = this.resolveImagePath(src, fileDir);
      return resolved ? `url('${resolved}')` : match;
    });

    return html;
  }

  async renderPreview() {
    // Show placeholder if no file or not a Marp presentation
    if (!this.file || !(await this.isMarpPresentation(this.file))) {
      this.showPlaceholder();
      return;
    }

    const originContent = await this.app.vault.cachedRead(this.file);

    // Preprocess using core unified pipeline
    const preprocessContext: RenderPreprocessContext = {
      wikilinkResolver: this.createWikilinkResolver(),
      enableDirectives: this.settings.enableMarkdownItPlugins,
      enableMermaid: this.settings.enableMermaid,
      mermaidRenderer: this.settings.enableMermaid ? this.mermaidCache : undefined,
    };

    const content = await preprocessForRender(originContent, preprocessContext);

    const fileDir = this.file.parent?.path || '';

    // Empty and reinitialize slides container only
    this.slidesContainerEl.empty();
    this.activeSlideStyleEl = null; // Reset since container was emptied
    this.lastSyncedSlideIndex = -1; // Reset to force re-highlight after render
    this.marpBrowser = browser(this.slidesContainerEl);

    let { html, css } = this.marp.render(content);

    // Extract slide boundaries from original content (not preprocessed)
    // to get correct line numbers matching the editor
    this.slideBoundaries = this.extractSlideBoundariesFromContent(originContent);
    // Track line count so cursor-change handler knows when content has changed
    this.lastEditorLineCount = originContent.split('\n').length;

    // Resolve all relative image paths (preview-specific: app:// URLs)
    html = this.resolveHtmlImagePaths(html, fileDir);

    // Add Marp CSS
    const styleEl = this.slidesContainerEl.createEl('style', {
      attr: { id: '__marp-ext-deck-style' },
    });

    // Add text selection CSS if enabled
    if (this.settings.enableTextSelection) {
      css += `
        svg foreignObject * {
          user-select: text !important;
          -webkit-user-select: text !important;
        }
      `;
    }

    styleEl.textContent = css;

    // Create content container and insert HTML
    const contentEl = this.slidesContainerEl.createDiv();
    contentEl.innerHTML = html;

    // Update Marp browser for custom elements
    this.marpBrowser?.update();

    // Attach click handlers to slides for reverse sync (preview -> editor)
    this.attachSlideClickHandlers();

    // Sync preview to editor cursor position after render completes
    this.syncPreviewAfterRender();
  }

  /**
   * Show placeholder message when no Marp presentation is selected
   */
  private showPlaceholder() {
    this.slidesContainerEl.empty();
    this.activeSlideStyleEl = null;

    const placeholderEl = this.slidesContainerEl.createDiv({
      cls: 'marp-ext-placeholder',
    });

    placeholderEl.createEl('div', {
      text: 'Select a Marp Presentation!',
      cls: 'marp-ext-placeholder-title',
    });

    placeholderEl.createEl('div', {
      text: '(marp: true in the frontmatter)',
      cls: 'marp-ext-placeholder-subtitle',
    });

    // Add placeholder styles
    const styleEl = this.slidesContainerEl.createEl('style');
    styleEl.textContent = `
      .marp-ext-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 2rem;
        text-align: center;
        color: var(--text-muted);
      }
      .marp-ext-placeholder-title {
        font-size: 1.1rem;
        font-weight: 500;
        margin-bottom: 0.5rem;
      }
      .marp-ext-placeholder-subtitle {
        font-size: 0.9rem;
        font-family: var(--font-monospace);
        opacity: 0.8;
      }
    `;
  }

  /**
   * Sync preview to editor after render completes.
   * Gets the current editor cursor and scrolls to the appropriate slide.
   */
  private syncPreviewAfterRender() {
    if (!this.settings.enableSyncPreview) return;
    if (!this.file) return;

    // Find the editor for our file
    const leaves = this.app.workspace.getLeavesOfType('markdown');
    for (const leaf of leaves) {
      const view = leaf.view;
      // Check if this is the editor for our file
      if ('file' in view && (view as { file: TFile | null }).file?.path === this.file.path) {
        if ('editor' in view) {
          const editor = (view as { editor: Editor }).editor;
          this.syncPreviewToEditor(editor);
          break;
        }
      }
    }
  }

  // Scroll to ensure a slide is fully visible (minimal scrolling)
  scrollToSlide(slideIndex: number, forceScroll = false) {
    try {
      const slideEl = this.getSlideElement(slideIndex);
      if (!slideEl) return;

      // Check if scroll is needed
      if (!forceScroll && this.isSlideFullyVisible(slideIndex)) {
        return;
      }

      // Perform minimal scroll to make slide visible
      this.scrollSlideIntoView(slideEl);
    } catch {
      console.log('Preview slide not found!');
    }
  }

  // Get the DOM element for a slide by index
  private getSlideElement(slideIndex: number): HTMLElement | null {
    // Find the content div that contains slide wrappers
    // Look for the div with data-marp-vscode-slide-wrapper children
    for (let i = 0; i < this.slidesContainerEl.children.length; i++) {
      const child = this.slidesContainerEl.children[i];
      // The content div contains the slide wrappers
      if (child.children.length > 0 && child.children[0]?.hasAttribute?.('data-marp-vscode-slide-wrapper')) {
        return (child.children[slideIndex] as HTMLElement) || null;
      }
    }

    // Fallback: look for slides directly in container
    const slides = this.slidesContainerEl.querySelectorAll('[data-marp-vscode-slide-wrapper]');
    return (slides[slideIndex] as HTMLElement) || null;
  }

  // Check if a slide is fully visible within the viewport
  private isSlideFullyVisible(slideIndex: number): boolean {
    const slideEl = this.getSlideElement(slideIndex);
    if (!slideEl) return false;

    const containerRect = this.slidesContainerEl.getBoundingClientRect();
    const slideRect = slideEl.getBoundingClientRect();

    // Allow a small tolerance (e.g., 2px) for rounding errors
    const tolerance = 2;

    const topVisible = slideRect.top >= containerRect.top - tolerance;
    const bottomVisible = slideRect.bottom <= containerRect.bottom + tolerance;

    return topVisible && bottomVisible;
  }

  // Scroll minimally to make a slide fully visible
  // If slide is taller than viewport, align its top with container top
  private scrollSlideIntoView(slideEl: HTMLElement) {
    const containerRect = this.slidesContainerEl.getBoundingClientRect();
    const slideRect = slideEl.getBoundingClientRect();

    const slideHeight = slideRect.height;
    const containerHeight = containerRect.height;

    // If slide is taller than container, align top
    if (slideHeight >= containerHeight) {
      slideEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    // Calculate how much the slide is outside the viewport
    const topOffset = containerRect.top - slideRect.top; // positive if slide is above viewport
    const bottomOffset = slideRect.bottom - containerRect.bottom; // positive if slide is below viewport

    if (topOffset > 0) {
      // Slide is partially above viewport - scroll up to show top
      this.slidesContainerEl.scrollBy({ top: -topOffset, behavior: 'smooth' });
    } else if (bottomOffset > 0) {
      // Slide is partially below viewport - scroll down to show bottom
      this.slidesContainerEl.scrollBy({ top: bottomOffset, behavior: 'smooth' });
    }
  }

  // Handle click on a slide - navigate editor to that slide
  private handleSlideClick(slideIndex: number) {
    if (!this.file) return;
    if (!this.settings.enableSyncPreview) return;

    // Immediately highlight the clicked slide and update sync state
    this.ensureActiveSlideStyles();
    this.highlightActiveSlide(slideIndex);
    this.lastSyncedSlideIndex = slideIndex;

    // Scroll minimally to ensure slide is fully visible
    this.scrollToSlide(slideIndex);

    // Find the editor for our file
    const leaves = this.app.workspace.getLeavesOfType('markdown');
    for (const leaf of leaves) {
      const view = leaf.view;
      if (
        'file' in view &&
        (view as { file: TFile | null }).file?.path === this.file.path
      ) {
        if ('editor' in view) {
          const editor = (view as { editor: Editor }).editor;

          // Get first non-separator line number for this slide
          const lineNumber = 1 + (this.slideBoundaries[slideIndex] ?? 0);

          // WORKAROUND to scroll to the top of the slide in the editor
          // virtually scroll to the bottom of the editor, so that setting
          // the cursor position scrolls up again to be at the top of the editor
          editor.scrollTo(null, 10000000)
          editor.refresh();

          // Set the cursor and scroll (back) to the starting line of the slide
          editor.setCursor({ line: lineNumber, ch: 0 });
          editor.refresh();

          // Focus the editor
          leaf.view.containerEl.focus();
          editor.focus();

          // do it twice, to correct occasional misplacing *sigh*
          editor.setCursor({ line: lineNumber, ch: 0 });
          editor.refresh();
          break;
        }
      }
    }
  }

  // Attach click handlers to all slides
  private attachSlideClickHandlers() {
    const slides = this.slidesContainerEl.querySelectorAll(
      '[data-marp-vscode-slide-wrapper]',
    );
    slides.forEach((slide, index) => {
      // Use pointer cursor to indicate clickability
      (slide as HTMLElement).style.cursor = 'pointer';

      // Add click handler
      slide.addEventListener('click', (e) => {
        // Don't trigger if clicking on a link or interactive element
        const target = e.target as HTMLElement;
        if (target.closest('a, button, input, textarea, select')) {
          return;
        }

        // Don't trigger if user is making a text selection
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
          return;
        }

        // If this slide is already active, just ensure it's fully visible
        if (index === this.lastSyncedSlideIndex) {
          this.scrollToSlide(index);
          return;
        }

        this.handleSlideClick(index);
      });
    });
  }

  // Highlight the active slide with a visual indicator
  private highlightActiveSlide(slideIndex: number) {
    // Remove previous highlight
    const previousActive = this.slidesContainerEl.querySelector(
      '[data-marp-vscode-slide-wrapper].marp-ext-active-slide',
    );
    if (previousActive) {
      previousActive.classList.remove('marp-ext-active-slide');
    }

    // Add highlight to current slide
    const slideEl = this.getSlideElement(slideIndex);
    if (slideEl) {
      slideEl.classList.add('marp-ext-active-slide');
    }
  }

  // Inject the active slide styles if not already present
  private ensureActiveSlideStyles() {
    if (this.activeSlideStyleEl) return;

    this.activeSlideStyleEl = document.createElement('style');
    this.activeSlideStyleEl.id = '__marp-ext-active-slide-style';
    this.activeSlideStyleEl.textContent = `
      [data-marp-vscode-slide-wrapper].marp-ext-active-slide {
        outline: 3px solid var(--interactive-accent);
        outline-offset: -3px;
        border-radius: 4px;
      }
    `;
    this.slidesContainerEl.appendChild(this.activeSlideStyleEl);
  }

  // ===== Sync Preview functionality =====

  /**
   * Extract slide boundaries from the original markdown content.
   * Parses --- slide separators while correctly handling:
   * - Frontmatter (skipped)
   * - Code blocks (--- inside them is not a separator)
   *
   * Uses original content to get correct line numbers matching the editor.
   */
  private extractSlideBoundariesFromContent(content: string): number[] {
    const lines = content.split('\n');
    const boundaries: number[] = [];
    let inCodeBlock = false;
    let inFrontmatter = false;
    let frontmatterEnded = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check for code block toggle (``` or ~~~)
      if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }

      // Skip content inside code blocks
      if (inCodeBlock) continue;

      // Handle frontmatter (only at the very start)
      if (i === 0 && trimmed === '---') {
        inFrontmatter = true;
        continue;
      }

      if (inFrontmatter) {
        if (trimmed === '---') {
          inFrontmatter = false;
          frontmatterEnded = true;
          // First slide starts after frontmatter
          boundaries.push(i + 1);
        }
        continue;
      }

      // Check for slide separator (--- on its own line, possibly with trailing dashes)
      if (/^-{3,}$/.test(trimmed)) {
        // This is a slide separator - next line starts a new slide
        boundaries.push(i + 1);
      }
    }

    // If no frontmatter, first slide starts at line 0
    if (!frontmatterEnded && boundaries.length === 0) {
      boundaries.unshift(0);
    }

    // Ensure we have at least one boundary
    if (boundaries.length === 0) {
      return [0];
    }

    return boundaries;
  }

  /**
   * Get the slide index for a given line number (0-indexed).
   */
  private getSlideIndexForLine(lineNumber: number): number {
    // Find the last boundary that is <= lineNumber
    for (let i = this.slideBoundaries.length - 1; i >= 0; i--) {
      if (this.slideBoundaries[i] <= lineNumber) {
        return i;
      }
    }
    return 0;
  }

  /**
   * Sync the preview to show the slide at the editor's cursor position.
   * Only scrolls if the target slide is different and not at the top.
   * Always highlights the active slide for visual reference.
   */
  private syncPreviewToEditor(editor: Editor) {
    if (!this.settings.enableSyncPreview) return;
    if (!this.file) return;

    const cursor = editor.getCursor();
    const slideIndex = this.getSlideIndexForLine(cursor.line);

    // Only do anything if we're on a different slide
    if (slideIndex !== this.lastSyncedSlideIndex) {
      this.ensureActiveSlideStyles();
      this.highlightActiveSlide(slideIndex);
      this.lastSyncedSlideIndex = slideIndex;
      this.scrollToSlide(slideIndex);
    }
  }

  /**
   * Public handler for editor selection/cursor changes.
   * Called from the CodeMirror extension registered in main.ts.
   * Debounces the sync to avoid excessive updates during rapid cursor movement.
   */
  onEditorSelectionChange(_update: ViewUpdate) {
    if (!this.settings.enableSyncPreview) return;
    if (!this.file) return;

    // Clear any pending sync
    if (this.syncDebounceTimeout !== null) {
      window.clearTimeout(this.syncDebounceTimeout);
    }

    // Schedule a new sync
    this.syncDebounceTimeout = window.setTimeout(async () => {
      this.syncDebounceTimeout = null;

      // Get cursor position from Obsidian's Editor API (handles edge cases like tables)
      const leaves = this.app.workspace.getLeavesOfType('markdown');
      for (const leaf of leaves) {
        const view = leaf.view;
        if (
          'file' in view &&
          (view as { file: TFile | null }).file?.path === this.file?.path
        ) {
          if ('editor' in view) {
            const editor = (view as { editor: Editor }).editor;

            // Only re-parse slide boundaries if document length changed
            // (indicates paste/edit rather than just cursor movement)
            const currentLineCount = editor.lineCount();
            if (currentLineCount !== this.lastEditorLineCount) {
              const currentContent = editor.getValue();
              this.slideBoundaries = this.extractSlideBoundariesFromContent(currentContent);
              this.lastEditorLineCount = currentLineCount;
            }

            const cursor = editor.getCursor();
            this.syncPreviewToLine(cursor.line);
            break;
          }
        }
      }
    }, DeckView.SYNC_DEBOUNCE_MS);
  }

  /**
   * Sync the preview to show the slide containing the given line number.
   */
  private syncPreviewToLine(lineNumber: number) {
    if (!this.settings.enableSyncPreview) return;
    if (!this.file) return;

    const slideIndex = this.getSlideIndexForLine(lineNumber);

    this.ensureActiveSlideStyles();
    this.highlightActiveSlide(slideIndex);

    if (slideIndex !== this.lastSyncedSlideIndex) {
      this.lastSyncedSlideIndex = slideIndex;
      this.scrollToSlide(slideIndex);
    }
  }

  // Load and display the currently active file if it's a Marp presentation
  async loadCurrentFile() {
    const activeFile = this.app.workspace.getActiveFile();

    if (activeFile && (await this.isMarpPresentation(activeFile))) {
      await this.reinitializeMarp();
      this.file = activeFile;
      await this.renderPreview();
    } else if (this.file) {
      // Active file is not a Marp presentation, reload the current one
      await this.reinitializeMarp();
      await this.renderPreview();
    }
  }

  // Check if view is in sidebar
  private isInSidebar(): boolean {
    const root = this.leaf.getRoot();
    return (
      root === this.app.workspace.leftSplit ||
      root === this.app.workspace.rightSplit
    );
  }

  private updateToolbarVisibility() {
    if (this.isInSidebar()) {
      this.toolbarEl.style.display = 'flex';
      this.toolbarEl.style.flexDirection = 'column';
    } else {
      this.toolbarEl.style.display = 'none';
    }
  }

  private createToolbarButton(
    icon: string,
    title: string,
    callback: () => void,
  ): HTMLElement {
    const button = this.toolbarEl.createEl('button', {
      cls: 'marp-ext-toolbar-button clickable-icon',
      attr: { 'aria-label': title, title: title },
    });
    setIcon(button, icon);
    button.addEventListener('click', callback);
    return button;
  }

  private getExportOptions(): ExportOptions {
    return {
      enableMarkdownItPlugins: this.settings.enableMarkdownItPlugins,
      enableMermaid: this.settings.enableMermaid,
      enableHTML: this.settings.enableHTML,
      mermaidCache: this.mermaidCache,
    };
  }

  private createToolbarButtons() {
    // Reload button
    this.createToolbarButton('refresh-cw', 'Load Current File', async () => {
      await this.loadCurrentFile();
    });

    // Search button
    this.createToolbarButton('search', 'Search in slides', () => {
      this.openSearch();
    });

    // Export buttons
    this.createToolbarButton('download', 'Export as PDF', () => {
      if (this.file)
        exportSlide(this.app, this.file, 'pdf', this.settings.themeDir, this.getExportOptions());
    });

    this.createToolbarButton('image', 'Export as PPTX', () => {
      if (this.file)
        exportSlide(this.app, this.file, 'pptx', this.settings.themeDir, this.getExportOptions());
    });

    this.createToolbarButton('code-glyph', 'Export as HTML', () => {
      if (this.file)
        exportSlide(this.app, this.file, 'html', this.settings.themeDir, this.getExportOptions());
    });
  }

  addActions() {
    this.addAction('refresh-cw', 'Load Current File', async () => {
      await this.loadCurrentFile();
    });

    this.addAction('search', 'Search in slides', () => {
      this.openSearch();
    });

    this.addAction('download', 'Export as PDF', () => {
      if (this.file)
        exportSlide(this.app, this.file, 'pdf', this.settings.themeDir, this.getExportOptions());
    });

    this.addAction('image', 'Export as PPTX', () => {
      if (this.file)
        exportSlide(this.app, this.file, 'pptx', this.settings.themeDir, this.getExportOptions());
    });

    this.addAction('code-glyph', 'Export as HTML', () => {
      if (this.file)
        exportSlide(this.app, this.file, 'html', this.settings.themeDir, this.getExportOptions());
    });
  }

  // ===== Search functionality =====

  /**
   * Open the search bar and focus the input
   */
  openSearch() {
    if (!this.searchContainerEl) {
      this.createSearchUI();
    }
    this.searchContainerEl!.style.display = 'flex';
    this.searchInputEl?.focus();
    this.searchInputEl?.select();
  }

  /**
   * Close the search bar and clear highlights
   */
  closeSearch() {
    if (this.searchContainerEl) {
      this.searchContainerEl.style.display = 'none';
    }
    this.clearHighlights();
    this.searchMatches = [];
    this.currentMatchIndex = -1;
    this.updateSearchResults();
  }

  /**
   * Check if search is currently open
   */
  isSearchOpen(): boolean {
    return (
      this.searchContainerEl !== null &&
      this.searchContainerEl.style.display !== 'none'
    );
  }

  private createSearchUI() {
    const container = this.containerEl.children[1] as HTMLElement;

    // Create search bar container
    this.searchContainerEl = container.createDiv({ cls: 'marp-ext-search-bar' });
    this.searchContainerEl.style.display = 'none';
    this.searchContainerEl.style.position = 'absolute';
    this.searchContainerEl.style.top = '0';
    this.searchContainerEl.style.right = '0';
    this.searchContainerEl.style.zIndex = '100';
    this.searchContainerEl.style.padding = '8px';
    this.searchContainerEl.style.backgroundColor = 'var(--background-secondary)';
    this.searchContainerEl.style.borderBottomLeftRadius = '6px';
    this.searchContainerEl.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
    this.searchContainerEl.style.alignItems = 'center';
    this.searchContainerEl.style.gap = '6px';

    // Search input
    this.searchInputEl = this.searchContainerEl.createEl('input', {
      type: 'text',
      placeholder: 'Search in slides...',
      cls: 'marp-ext-search-input',
    });
    this.searchInputEl.style.width = '200px';
    this.searchInputEl.style.padding = '4px 8px';
    this.searchInputEl.style.border = '1px solid var(--background-modifier-border)';
    this.searchInputEl.style.borderRadius = '4px';
    this.searchInputEl.style.backgroundColor = 'var(--background-primary)';
    this.searchInputEl.style.color = 'var(--text-normal)';

    // Results counter
    this.searchResultsEl = this.searchContainerEl.createSpan({
      cls: 'marp-ext-search-results',
    });
    this.searchResultsEl.style.fontSize = '12px';
    this.searchResultsEl.style.color = 'var(--text-muted)';
    this.searchResultsEl.style.minWidth = '60px';

    // Navigation buttons
    const prevBtn = this.searchContainerEl.createEl('button', {
      cls: 'marp-ext-search-btn clickable-icon',
      attr: { 'aria-label': 'Previous match' },
    });
    setIcon(prevBtn, 'chevron-up');
    prevBtn.addEventListener('click', () => this.goToPreviousMatch());

    const nextBtn = this.searchContainerEl.createEl('button', {
      cls: 'marp-ext-search-btn clickable-icon',
      attr: { 'aria-label': 'Next match' },
    });
    setIcon(nextBtn, 'chevron-down');
    nextBtn.addEventListener('click', () => this.goToNextMatch());

    // Close button
    const closeBtn = this.searchContainerEl.createEl('button', {
      cls: 'marp-ext-search-btn clickable-icon',
      attr: { 'aria-label': 'Close search' },
    });
    setIcon(closeBtn, 'x');
    closeBtn.addEventListener('click', () => this.closeSearch());

    // Event listeners for input
    this.searchInputEl.addEventListener('input', () => {
      this.performSearch(this.searchInputEl!.value);
    });

    this.searchInputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          this.goToPreviousMatch();
        } else {
          this.goToNextMatch();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.closeSearch();
      }
    });
  }

  private performSearch(query: string) {
    this.clearHighlights();
    this.searchMatches = [];
    this.currentMatchIndex = -1;

    if (!query || query.length < 1) {
      this.updateSearchResults();
      return;
    }

    // Search in the entire slides container - Marp renders content in various structures
    // including SVG foreignObject elements
    const matches = this.findTextMatches(this.slidesContainerEl, query.toLowerCase());
    this.searchMatches = matches;

    if (matches.length > 0) {
      this.currentMatchIndex = 0;
      this.highlightMatches();
      this.scrollToCurrentMatch();
    }

    this.updateSearchResults();
  }

  private findTextMatches(root: HTMLElement, query: string): SearchMatch[] {
    const matches: SearchMatch[] = [];
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node: Text) => {
          // Skip text in style and script elements
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tagName = parent.tagName.toLowerCase();
          if (tagName === 'style' || tagName === 'script') {
            return NodeFilter.FILTER_REJECT;
          }
          // Skip empty or whitespace-only text nodes
          if (!node.textContent?.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const text = node.textContent || '';
      const lowerText = text.toLowerCase();
      let startIndex = 0;

      while (true) {
        const index = lowerText.indexOf(query, startIndex);
        if (index === -1) break;

        matches.push({
          element: node.parentElement!,
          textNode: node,
          startOffset: index,
          endOffset: index + query.length,
          originalText: text.substring(index, index + query.length),
        });

        startIndex = index + 1;
      }
    }

    return matches;
  }

  private highlightMatches() {
    // Clear previous highlights
    this.clearHighlights();

    // Group matches by text node to handle multiple matches in same node
    const nodeMatches = new Map<Text, SearchMatch[]>();
    for (const match of this.searchMatches) {
      const existing = nodeMatches.get(match.textNode) || [];
      existing.push(match);
      nodeMatches.set(match.textNode, existing);
    }

    // Process each text node
    let matchIndex = 0;
    for (const [textNode, matches] of nodeMatches) {
      // Sort matches by offset (descending) to process from end to start
      matches.sort((a, b) => b.startOffset - a.startOffset);

      for (const match of matches) {
        const isCurrent = this.searchMatches.indexOf(match) === this.currentMatchIndex;
        const highlight = this.createHighlight(
          textNode,
          match.startOffset,
          match.endOffset,
          isCurrent,
        );
        if (highlight) {
          this.highlightElements.push(highlight);
          // Update match to reference the highlight element
          match.element = highlight;
        }
        matchIndex++;
      }
    }
  }

  private createHighlight(
    textNode: Text,
    start: number,
    end: number,
    isCurrent: boolean,
  ): HTMLElement | null {
    try {
      const range = document.createRange();
      range.setStart(textNode, start);
      range.setEnd(textNode, end);

      const highlight = document.createElement('mark');
      highlight.className = isCurrent
        ? 'marp-ext-search-highlight marp-ext-search-current'
        : 'marp-ext-search-highlight';
      highlight.style.backgroundColor = isCurrent
        ? 'var(--text-highlight-bg-active, #ff9632)'
        : 'var(--text-highlight-bg, #ffff0080)';
      highlight.style.color = 'inherit';
      highlight.style.borderRadius = '2px';

      range.surroundContents(highlight);
      return highlight;
    } catch {
      // Range manipulation can fail in some edge cases
      return null;
    }
  }

  private clearHighlights() {
    for (const highlight of this.highlightElements) {
      const parent = highlight.parentNode;
      if (parent) {
        // Replace highlight with its text content
        const text = document.createTextNode(highlight.textContent || '');
        parent.replaceChild(text, highlight);
        parent.normalize(); // Merge adjacent text nodes
      }
    }
    this.highlightElements = [];
  }

  private updateSearchResults() {
    if (!this.searchResultsEl) return;

    if (this.searchMatches.length === 0) {
      if (this.searchInputEl?.value) {
        this.searchResultsEl.textContent = 'No results';
      } else {
        this.searchResultsEl.textContent = '';
      }
    } else {
      this.searchResultsEl.textContent = `${this.currentMatchIndex + 1}/${this.searchMatches.length}`;
    }
  }

  private goToNextMatch() {
    if (this.searchMatches.length === 0) return;

    this.currentMatchIndex = (this.currentMatchIndex + 1) % this.searchMatches.length;
    this.highlightMatches();
    this.scrollToCurrentMatch();
    this.updateSearchResults();
  }

  private goToPreviousMatch() {
    if (this.searchMatches.length === 0) return;

    this.currentMatchIndex =
      (this.currentMatchIndex - 1 + this.searchMatches.length) %
      this.searchMatches.length;
    this.highlightMatches();
    this.scrollToCurrentMatch();
    this.updateSearchResults();
  }

  private scrollToCurrentMatch() {
    if (this.currentMatchIndex < 0 || this.currentMatchIndex >= this.searchMatches.length) {
      return;
    }

    const match = this.searchMatches[this.currentMatchIndex];
    match.element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  async onOpen() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();

    // Create wrapper for horizontal layout (slides + toolbar)
    this.wrapperEl = container.createDiv({ cls: 'marp-ext-deck-wrapper' });
    this.wrapperEl.style.display = 'flex';
    this.wrapperEl.style.flexDirection = 'row';
    this.wrapperEl.style.height = '100%';
    this.wrapperEl.style.width = '100%';

    // Create slides container (left side)
    this.slidesContainerEl = this.wrapperEl.createDiv({
      cls: 'marp-ext-deck-slides',
    });
    this.slidesContainerEl.style.flex = '1';
    this.slidesContainerEl.style.overflow = 'auto';
    this.slidesContainerEl.style.minWidth = '0';

    // Initialize marp browser
    this.marpBrowser = browser(this.slidesContainerEl);

    // Create toolbar (right side) - only visible in sidebar
    this.toolbarEl = this.wrapperEl.createDiv({ cls: 'marp-ext-deck-toolbar' });
    this.toolbarEl.style.flexShrink = '0';
    this.toolbarEl.style.display = 'flex';
    this.toolbarEl.style.flexDirection = 'column';
    this.toolbarEl.style.gap = '4px';
    this.toolbarEl.style.padding = '6px';
    this.toolbarEl.style.borderLeft = '1px solid var(--background-modifier-border)';
    this.toolbarEl.style.backgroundColor = 'var(--background-secondary)';

    this.createToolbarButtons();
    this.updateToolbarVisibility();

    // Load themes
    await this.loadThemes();

    // Add header actions
    this.addActions();

    // Register event listeners
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        this.updateToolbarVisibility();
      }),
    );

    // Auto-reload on file modification
    this.registerEvent(
      this.app.vault.on('modify', async file => {
        if (!this.settings.autoReload) return;
        if (
          file instanceof TFile &&
          this.file &&
          file.path === this.file.path
        ) {
          await this.renderPreview();
        }
      }),
    );

    // Auto-load Marp presentations when switching files
    // Behavior depends on followActiveFile setting:
    // - false (default): Only loads when no Marp file is showing (locks to first presentation)
    // - true: Always switches to the active Marp presentation
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', async () => {
        const currentIsMarp = this.file && (await this.isMarpPresentation(this.file));
        const shouldSwitch = this.settings.followActiveFile || !currentIsMarp;

        if (shouldSwitch) {
          const activeFile = this.app.workspace.getActiveFile();
          if (activeFile && (await this.isMarpPresentation(activeFile))) {
            // Don't switch if it's already the same file
            if (activeFile.path !== this.file?.path) {
              await this.reinitializeMarp();
              this.file = activeFile;
              await this.renderPreview();
            }
          }
        }
      }),
    );
  }

  async onClose() {
    // Clean up debounce timeout
    if (this.syncDebounceTimeout !== null) {
      window.clearTimeout(this.syncDebounceTimeout);
      this.syncDebounceTimeout = null;
    }
    this.marpBrowser?.cleanup();
  }

  async setState(state: DeckViewState, result: ViewStateResult) {
    // Handle both TFile (programmatic) and filePath (from serialized state)
    if (state.file) {
      this.file = state.file;
    } else if (state.filePath) {
      // Restore TFile from path (used when Obsidian restores workspace state)
      const file = this.app.vault.getAbstractFileByPath(state.filePath);
      if (file instanceof TFile) {
        this.file = file;
      }
    }
    await this.renderPreview();
    return super.setState(state, result);
  }

  getState(): Record<string, unknown> {
    // Save file path as string for JSON serialization
    return {
      filePath: this.file?.path ?? null,
    };
  }
}
