/**
 * Core module exports
 *
 * This is the shared core used by both CLI and Obsidian plugin.
 */

// Configuration
export {
  type MarpExtendedConfig,
  type MermaidTheme,
  type MathTypesetting,
  type ExportFormat,
  type SecurityMode,
  type ObsidianMarpSettings,
  DEFAULT_CONFIG,
  loadConfig,
  fromObsidianSettings,
} from './config';

// Preprocessor
export {
  tokenizePreservingQuotes,
  parseMarpDirective,
  generateMarpComments,
  preprocessDirectives,
  preprocessMermaid,
  preprocessPlantUML,
  preprocess,
  type MarpDirectiveResult,
  type PreprocessorContext,
} from './preprocessor';

// Markdown-it plugins
export {
  parseSpaceSeparatedStyles,
  parseContainerDefinition,
  genericContainerPlugin,
  markPlugin,
} from './markdownItPlugins';

// Engine
export { getEngine } from './engine';

// Diagram renderers
export type { DiagramRenderer } from './diagrams/types';
export { MermaidCliRenderer, type MermaidCliOptions } from './diagrams/mermaid-cli';
export { PlantUMLRenderer, type PlantUMLOptions } from './diagrams/plantuml';
