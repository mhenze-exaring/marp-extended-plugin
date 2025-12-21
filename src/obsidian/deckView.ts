import {
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

export const MARP_DECK_VIEW_TYPE = 'marp-deck-view';

interface DeckViewState {
  file: TFile | null;
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
    return 'layers';
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
    if (!this.file) return;

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
    this.marpBrowser = browser(this.slidesContainerEl);

    let { html, css } = this.marp.render(content);

    // Resolve all relative image paths (preview-specific: app:// URLs)
    html = this.resolveHtmlImagePaths(html, fileDir);

    // Add Marp CSS
    const styleEl = this.slidesContainerEl.createEl('style', {
      attr: { id: '__marp-deck-style' },
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
  }

  // Scroll to a specific slide (0-indexed)
  scrollToSlide(slideIndex: number) {
    try {
      // Structure: base, style, contentDiv -> slides are children of contentDiv
      const contentEl = this.slidesContainerEl.children[2];
      (contentEl?.children[slideIndex] as HTMLElement)?.scrollIntoView({
        behavior: 'smooth',
      });
    } catch {
      console.log('Preview slide not found!');
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
      cls: 'marp-toolbar-button clickable-icon',
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
    this.searchContainerEl = container.createDiv({ cls: 'marp-search-bar' });
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
      cls: 'marp-search-input',
    });
    this.searchInputEl.style.width = '200px';
    this.searchInputEl.style.padding = '4px 8px';
    this.searchInputEl.style.border = '1px solid var(--background-modifier-border)';
    this.searchInputEl.style.borderRadius = '4px';
    this.searchInputEl.style.backgroundColor = 'var(--background-primary)';
    this.searchInputEl.style.color = 'var(--text-normal)';

    // Results counter
    this.searchResultsEl = this.searchContainerEl.createSpan({
      cls: 'marp-search-results',
    });
    this.searchResultsEl.style.fontSize = '12px';
    this.searchResultsEl.style.color = 'var(--text-muted)';
    this.searchResultsEl.style.minWidth = '60px';

    // Navigation buttons
    const prevBtn = this.searchContainerEl.createEl('button', {
      cls: 'marp-search-btn clickable-icon',
      attr: { 'aria-label': 'Previous match' },
    });
    setIcon(prevBtn, 'chevron-up');
    prevBtn.addEventListener('click', () => this.goToPreviousMatch());

    const nextBtn = this.searchContainerEl.createEl('button', {
      cls: 'marp-search-btn clickable-icon',
      attr: { 'aria-label': 'Next match' },
    });
    setIcon(nextBtn, 'chevron-down');
    nextBtn.addEventListener('click', () => this.goToNextMatch());

    // Close button
    const closeBtn = this.searchContainerEl.createEl('button', {
      cls: 'marp-search-btn clickable-icon',
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
        ? 'marp-search-highlight marp-search-current'
        : 'marp-search-highlight';
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
    this.wrapperEl = container.createDiv({ cls: 'marp-deck-wrapper' });
    this.wrapperEl.style.display = 'flex';
    this.wrapperEl.style.flexDirection = 'row';
    this.wrapperEl.style.height = '100%';
    this.wrapperEl.style.width = '100%';

    // Create slides container (left side)
    this.slidesContainerEl = this.wrapperEl.createDiv({
      cls: 'marp-deck-slides',
    });
    this.slidesContainerEl.style.flex = '1';
    this.slidesContainerEl.style.overflow = 'auto';
    this.slidesContainerEl.style.minWidth = '0';

    // Initialize marp browser
    this.marpBrowser = browser(this.slidesContainerEl);

    // Create toolbar (right side) - only visible in sidebar
    this.toolbarEl = this.wrapperEl.createDiv({ cls: 'marp-deck-toolbar' });
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

    // Auto-load Marp presentations when switching files (if no file is loaded)
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', async () => {
        if (!this.file) {
          const activeFile = this.app.workspace.getActiveFile();
          if (activeFile && (await this.isMarpPresentation(activeFile))) {
            await this.reinitializeMarp();
            this.file = activeFile;
            await this.renderPreview();
          }
        }
      }),
    );
  }

  async onClose() {
    this.marpBrowser?.cleanup();
  }

  async setState(state: DeckViewState, result: ViewStateResult) {
    if (state.file) {
      this.file = state.file;
    }
    await this.renderPreview();
    return super.setState(state, result);
  }

  getState(): Record<string, unknown> {
    return {
      file: this.file,
    };
  }
}
