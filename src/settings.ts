export type MathTypesetting = 'mathjax' | 'katex' | false;

export type MermaidTheme = 'default' | 'dark' | 'forest' | 'neutral' | 'base';

export interface MarpPluginSettings {
  // Preview settings
  autoReload: boolean;
  createNewSplitTab: boolean;
  enableSyncPreview: boolean;

  // Theme settings
  themeDir: string;

  // Marp rendering options
  enableHTML: boolean;
  mathTypesetting: MathTypesetting;
  enableMarkdownItPlugins: boolean;

  // Mermaid settings
  enableMermaid: boolean;
  mermaidTheme: MermaidTheme;

  // Export settings
  exportPath: string;
  chromePath: string;
}

export const MARP_DEFAULT_SETTINGS: MarpPluginSettings = {
  // Preview settings
  autoReload: true,
  createNewSplitTab: true,
  enableSyncPreview: true,

  // Theme settings
  themeDir: 'MarpTheme',

  // Marp rendering options
  enableHTML: false,
  mathTypesetting: 'mathjax',
  enableMarkdownItPlugins: false,

  // Mermaid settings
  enableMermaid: true,
  mermaidTheme: 'default',

  // Export settings
  exportPath: '',
  chromePath: '',
};
