export type MathTypesetting = 'mathjax' | 'katex' | false;

export type MermaidTheme = 'default' | 'dark' | 'forest' | 'neutral' | 'base';

export type PreviewLocation = 'sidebar' | 'split' | 'tab';

export interface MarpPluginSettings {
  // Preview settings
  autoReload: boolean;
  previewLocation: PreviewLocation;
  enableSyncPreview: boolean;
  enableTextSelection: boolean;

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
  previewLocation: 'sidebar',
  enableSyncPreview: true,
  enableTextSelection: false,

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
