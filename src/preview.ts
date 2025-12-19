import {
  FileSystemAdapter,
  ItemView,
  TFile,
  ViewStateResult,
  WorkspaceLeaf,
} from 'obsidian';
import { convertHtml } from './convertImage';
import { exportSlide, ExportOptions } from './export';
import { createMarpInstance } from './marp';
import { MarpPluginSettings } from './settings';
import { join } from 'path';
import { MermaidCacheManager } from './mermaidCache';

export const MARP_PREVIEW_VIEW_TYPE = 'marp-preview-view';

interface PreviewViewState {
  file: TFile | null;
}

export class PreviewView extends ItemView implements PreviewViewState {
  file: TFile | null;
  settings: MarpPluginSettings;
  mermaidCache: MermaidCacheManager;

  constructor(
    leaf: WorkspaceLeaf,
    settings: MarpPluginSettings,
    mermaidCache: MermaidCacheManager,
  ) {
    super(leaf);
    this.file = null;
    this.settings = settings;
    this.mermaidCache = mermaidCache;
  }

  getViewType(): string {
    return MARP_PREVIEW_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Marp Preview';
  }


  // Function to replace Wikilinks with the desired format
  replaceImageWikilinks(markdown: string): string {
    const wikilinkRegex = /!\[\[(.+?)\]\]/g;
    const replacedMarkdown = markdown.replace(wikilinkRegex, (_, name) => {
      // Get url for image
      const url = this.app.vault.adapter.getResourcePath(name);
      return `![${name}](${url})`;
    });
    return replacedMarkdown;
  }
  

  async renderPreview() {
    if (!this.file) return;
    const originContent = await this.app.vault.cachedRead(this.file);

    // Step 1: Convert wikilinks to standard markdown images
    let content = this.replaceImageWikilinks(originContent);

    // Step 2: Convert Mermaid code blocks to inline SVGs
    if (this.settings.enableMermaid) {
      content = await this.mermaidCache.preprocessMarkdown(content);
    }

    const fileDir = this.file.parent?.path || '';

    // Create Marp instance with appropriate options
    // HTML must be enabled when Mermaid is used (to render SVG elements)
    const needsHtml = this.settings.enableHTML || this.settings.enableMermaid;
    const marpInstance = createMarpInstance({ html: needsHtml });

    const { html, css } = marpInstance.render(content);
    const doc = await convertHtml(html, fileDir);
    const container = this.containerEl.children[1];
    container.empty();
    container.appendChild(doc.body.children[0]);
    container.createEl('style', { text: css });
  }

  private getExportOptions(): ExportOptions {
    return {
      enableMarkdownItPlugins: this.settings.enableMarkdownItPlugins,
      enableMermaid: this.settings.enableMermaid,
      mermaidCache: this.mermaidCache,
    };
  }

  addActions() {
    const basePath = (
      this.app.vault.adapter as FileSystemAdapter
    ).getBasePath();
    const themeDir = join(basePath, this.settings.themeDir);
    this.addAction('download', 'Export as PDF', () => {
      if (this.file) {
        exportSlide(this.file, 'pdf', basePath, themeDir, this.getExportOptions());
      }
    });
    this.addAction('image', 'Export as PPTX', () => {
      if (this.file) {
        exportSlide(this.file, 'pptx', basePath, themeDir, this.getExportOptions());
      }
    });
    this.addAction('code-glyph', 'Export as HTML', () => {
      if (this.file) {
        exportSlide(this.file, 'html', basePath, themeDir, this.getExportOptions());
      }
    });
  }

  async onOpen() {
    this.registerEvent(this.app.vault.on('modify', this.onChange.bind(this)));
    this.addActions();
  }

  async onClose() {
    // Nothing to clean up.
  }

  onChange() {
    if (!this.settings.autoReload) return;
    this.renderPreview();
  }

  async setState(state: PreviewViewState, result: ViewStateResult) {
    if (state.file) {
      this.file = state.file;
    }
    await this.renderPreview();
    return super.setState(state, result);
  }

  getState(): PreviewViewState {
    return {
      file: this.file,
    };
  }
}
