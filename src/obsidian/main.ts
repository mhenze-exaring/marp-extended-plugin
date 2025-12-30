import { FileSystemAdapter, Notice, Plugin, TFile, WorkspaceLeaf, editorInfoField } from 'obsidian';
import { MARP_DEFAULT_SETTINGS, MarpPluginSettings } from './settings';
import { MARP_DECK_VIEW_TYPE, DeckView } from './deckView';
import { MarpSettingTab } from './settingTab';
import { readdir, readFile } from 'fs/promises';
import { marp } from './marp';
import { existsSync } from 'fs';
import { join, normalize } from 'path';
import {
  MermaidCacheManager,
  destroyMermaidCacheManager,
} from './mermaidCache';
import { EditorView, ViewUpdate } from '@codemirror/view';

// Re-export markdown-it plugins for use by engine.js wrapper
// This allows marp-cli to use the same plugins bundled in this file
export { genericContainerPlugin, markPlugin } from '../core/markdownItPlugins';

export default class MarpPlugin extends Plugin {
  settings: MarpPluginSettings;
  mermaidCache: MermaidCacheManager;

  async onload() {
    await this.loadSettings();

    // Initialize Mermaid cache manager
    this.mermaidCache = new MermaidCacheManager({
      theme: this.settings.mermaidTheme,
    });

    // Ribbon icon for preview
    this.addRibbonIcon('presentation', 'Marp: Open Preview', async _ => {
      const file = this.app.workspace.activeEditor?.file;
      if (!file)
        return new Notice(
          'Please select the tab for the file you want to view in Marp, and then click this button again.',
          10000,
        );
      await this.activateView(file);
    });

    const that = this; // Reference for use in command callbacks

    // Command for preview
    this.addCommand({
      id: 'open-preview',
      name: 'Open Preview',
      async editorCallback(_editor, ctx) {
        const file = ctx.file;
        if (!file) return;
        await that.activateView(file);
      },
    });

    // Register view
    this.registerView(
      MARP_DECK_VIEW_TYPE,
      leaf => new DeckView(leaf, this.settings, this.mermaidCache, this),
    );
    this.addSettingTab(new MarpSettingTab(this.app, this));

    // Register CodeMirror extension for cursor/selection change tracking
    this.registerEditorExtension(
      EditorView.updateListener.of((update: ViewUpdate) => {
        // Only react to selection changes (cursor movement)
        if (!update.selectionSet) return;

        // Get the EditorInfo from the editor state
        const editorInfo = update.state.field(editorInfoField);
        if (!editorInfo) return;

        const file = editorInfo.file;
        if (!file) return;

        // Notify all DeckViews about the cursor change
        const deckViews = this.app.workspace.getLeavesOfType(MARP_DECK_VIEW_TYPE);
        for (const leaf of deckViews) {
          const view = leaf.view as DeckView;
          if (view.file?.path === file.path) {
            view.onEditorSelectionChange(update);
          }
        }
      }),
    );

    // load marp themes
    {
      const basePath = (
        this.app.vault.adapter as FileSystemAdapter
      ).getBasePath();
      const { themeDir } = this.settings;
      const isCss = (filename: string) => filename.split('.').at(-1) === 'css';

      if (themeDir && existsSync(join(basePath, themeDir))) {
        const themePaths = (
          await readdir(normalize(join(basePath, themeDir)), {
            withFileTypes: true,
          })
        )
          .filter(f => f.isFile() && isCss(f.name))
          .map(v => normalize(join(basePath, themeDir, v.name)));

        const cssContents = await Promise.all(
          themePaths.map(path => readFile(path, { encoding: 'utf-8' })),
        );

        cssContents.forEach(css => marp.themeSet.add(css));
      }
    }
  }

  onunload() {
    // Don't detach leaves on unload - let Obsidian preserve them in workspace state
    // so the preview persists across restarts (including pinned position in sidebar)

    // Clean up Mermaid cache
    this.mermaidCache.destroy();
    destroyMermaidCacheManager();
  }

  /**
   * Called when Mermaid theme setting changes.
   * Updates cache manager and clears cached SVGs.
   */
  onMermaidThemeChange() {
    this.mermaidCache.setTheme(this.settings.mermaidTheme);
  }

  async activateView(file: TFile) {
    // Check if a Marp leaf already exists - reuse it to preserve position (e.g., pinned in sidebar)
    const existingLeaves = this.app.workspace.getLeavesOfType(MARP_DECK_VIEW_TYPE);
    let leaf: WorkspaceLeaf | undefined = existingLeaves[0];

    if (!leaf) {
      // No existing leaf, create a new one based on settings
      switch (this.settings.previewLocation) {
        case 'sidebar': {
          // Open in right sidebar as a new split
          const rightLeaf = this.app.workspace.getRightLeaf(true);
          if (rightLeaf) {
            leaf = rightLeaf;
          } else {
            // Fallback to split tab if sidebar not available (e.g., mobile)
            leaf = this.app.workspace.getLeaf('split');
          }
          break;
        }
        case 'split':
          // Create a preview on a new split tab
          leaf = this.app.workspace.getLeaf('split');
          break;
        case 'tab':
        default:
          // Create in a new tab
          leaf = this.app.workspace.getLeaf('tab');
          break;
      }
    }

    if (!leaf) return; // Should not happen, but satisfy TypeScript

    // Reveal the leaf (opens sidebar if collapsed, focuses tab, etc.)
    this.app.workspace.revealLeaf(leaf);

    await leaf.setViewState({
      type: MARP_DECK_VIEW_TYPE,
      active: true,
      state: { file },
    });
  }

  async loadSettings() {
    this.settings = { ...MARP_DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
