import { App, PluginSettingTab, Setting } from 'obsidian';
import MarpPlugin from './main';
import { MathTypesetting, MermaidTheme, PreviewLocation } from './settings';

export class MarpSettingTab extends PluginSettingTab {
  plugin: MarpPlugin;

  constructor(app: App, plugin: MarpPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    // Preview Settings
    containerEl.createEl('h2', { text: 'Preview Settings' });

    new Setting(containerEl)
      .setName('Enable Auto Reload')
      .setDesc(
        'Automatically reload the preview when the file is saved.',
      )
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.autoReload).onChange(async v => {
          this.plugin.settings.autoReload = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Preview Location')
      .setDesc('Where to open the Marp preview.')
      .addDropdown(dropdown =>
        dropdown
          .addOption('sidebar', 'Right Sidebar')
          .addOption('split', 'Split Tab')
          .addOption('tab', 'New Tab')
          .setValue(this.plugin.settings.previewLocation)
          .onChange(async v => {
            this.plugin.settings.previewLocation = v as PreviewLocation;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Enable Sync Preview')
      .setDesc(
        'Sync the preview scroll position with the editor cursor position.',
      )
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.enableSyncPreview)
          .onChange(async v => {
            this.plugin.settings.enableSyncPreview = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Enable Text Selection')
      .setDesc('Allow selecting and copying text from the slide preview.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.enableTextSelection)
          .onChange(async v => {
            this.plugin.settings.enableTextSelection = v;
            await this.plugin.saveSettings();
          }),
      );

    // Marp Rendering Settings
    containerEl.createEl('h2', { text: 'Marp Rendering' });

    new Setting(containerEl)
      .setName('Enable HTML')
      .setDesc(
        'Allow HTML tags in Marp markdown. Warning: May pose security risks with untrusted content.',
      )
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.enableHTML).onChange(async v => {
          this.plugin.settings.enableHTML = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Math Typesetting')
      .setDesc('Choose the math rendering engine for LaTeX equations.')
      .addDropdown(dropdown =>
        dropdown
          .addOption('mathjax', 'MathJax')
          .addOption('katex', 'KaTeX')
          .addOption('false', 'Disabled')
          .setValue(String(this.plugin.settings.mathTypesetting))
          .onChange(async v => {
            this.plugin.settings.mathTypesetting =
              v === 'false' ? false : (v as MathTypesetting);
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Markdown-It Plugins')
      .setDesc(
        '(Experimental) Enable Markdown-It plugins (Container, Mark). Adds support for ::: container blocks and ==highlighted text== syntax.',
      )
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.enableMarkdownItPlugins)
          .onChange(async v => {
            this.plugin.settings.enableMarkdownItPlugins = v;
            await this.plugin.saveSettings();
          }),
      );

    // Mermaid Settings
    containerEl.createEl('h2', { text: 'Mermaid Diagrams' });

    new Setting(containerEl)
      .setName('Enable Mermaid')
      .setDesc(
        'Convert Mermaid code blocks to diagrams in preview and export. Supports flowcharts, sequence diagrams, and more.',
      )
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.enableMermaid)
          .onChange(async v => {
            this.plugin.settings.enableMermaid = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Mermaid Theme')
      .setDesc('Visual theme for Mermaid diagrams.')
      .addDropdown(dropdown =>
        dropdown
          .addOption('default', 'Default')
          .addOption('dark', 'Dark')
          .addOption('forest', 'Forest')
          .addOption('neutral', 'Neutral')
          .addOption('base', 'Base')
          .setValue(this.plugin.settings.mermaidTheme)
          .onChange(async v => {
            this.plugin.settings.mermaidTheme = v as MermaidTheme;
            this.plugin.onMermaidThemeChange();
            await this.plugin.saveSettings();
          }),
      );

    // Theme Settings
    containerEl.createEl('h2', { text: 'Theme Settings' });

    new Setting(containerEl)
      .setName('Theme Folder Location')
      .setDesc(
        'Relative path to the directory containing custom Marp theme CSS files. Restart Obsidian after adding new themes.',
      )
      .addText(text =>
        text
          .setPlaceholder('MarpTheme')
          .setValue(this.plugin.settings.themeDir)
          .onChange(async v => {
            this.plugin.settings.themeDir = v;
            await this.plugin.saveSettings();
          }),
      );

    // Export Settings
    containerEl.createEl('h2', { text: 'Export Settings' });

    new Setting(containerEl)
      .setName('Export Path')
      .setDesc(
        'Custom directory for exported files. Leave empty to use the Downloads folder.',
      )
      .addText(text =>
        text
          .setPlaceholder('Leave empty for Downloads folder')
          .setValue(this.plugin.settings.exportPath)
          .onChange(async v => {
            this.plugin.settings.exportPath = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Chrome/Chromium Path')
      .setDesc(
        'Path to Chrome or Chromium executable for PDF/PPTX export. Leave empty to use system default.',
      )
      .addText(text =>
        text
          .setPlaceholder('Auto-detect')
          .setValue(this.plugin.settings.chromePath)
          .onChange(async v => {
            this.plugin.settings.chromePath = v;
            await this.plugin.saveSettings();
          }),
      );
  }
}
