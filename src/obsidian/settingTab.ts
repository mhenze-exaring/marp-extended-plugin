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

    // Preview section
    new Setting(containerEl).setName('Preview').setHeading();

    new Setting(containerEl)
      .setName('Enable auto reload')
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
      .setName('Preview location')
      .setDesc('Where to open the Marp preview.')
      .addDropdown(dropdown =>
        dropdown
          .addOption('sidebar', 'Right sidebar')
          .addOption('split', 'Split tab')
          .addOption('tab', 'New tab')
          .setValue(this.plugin.settings.previewLocation)
          .onChange(async v => {
            this.plugin.settings.previewLocation = v as PreviewLocation;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Enable sync preview')
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
      .setName('Enable text selection')
      .setDesc('Allow selecting and copying text from the slide preview.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.enableTextSelection)
          .onChange(async v => {
            this.plugin.settings.enableTextSelection = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Follow active file')
      .setDesc(
        'Automatically switch the preview to show the active Marp presentation. When disabled, the preview stays locked to the first presentation.',
      )
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.followActiveFile)
          .onChange(async v => {
            this.plugin.settings.followActiveFile = v;
            await this.plugin.saveSettings();
          }),
      );

    // Marp rendering section
    new Setting(containerEl).setName('Marp rendering').setHeading();

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
      .setName('Math typesetting')
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
      .setName('Markdown-it plugins')
      .setDesc(
        '(Experimental) Enable markdown-it plugins (Container, Mark). Adds support for ::: container blocks and ==highlighted text== syntax.',
      )
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.enableMarkdownItPlugins)
          .onChange(async v => {
            this.plugin.settings.enableMarkdownItPlugins = v;
            await this.plugin.saveSettings();
          }),
      );

    // Mermaid section
    new Setting(containerEl).setName('Mermaid diagrams').setHeading();

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
      .setName('Mermaid theme')
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

    // Themes section
    new Setting(containerEl).setName('Themes').setHeading();

    new Setting(containerEl)
      .setName('Theme folder location')
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

    // Export section
    new Setting(containerEl).setName('Export').setHeading();

    new Setting(containerEl)
      .setName('Export path')
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
      .setName('Chrome/Chromium path')
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
