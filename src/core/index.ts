/**
 * Core module exports
 *
 * This is the shared core used by both CLI and Obsidian plugin.
 */

// Types
export { type PathResolver, isLocalPath, createDataUrl } from './types';

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
  preprocessWikilinks,
  preprocessMermaid,
  preprocessPlantUML,
  preprocessForRender,
  preprocess,
  type MarpDirectiveResult,
  type PreprocessorContext,
  type RenderPreprocessContext,
  type WikilinkResolver,
} from './preprocessor';

// Markdown-it plugins
export {
  parseSpaceSeparatedStyles,
  parseContainerDefinition,
  genericContainerPlugin,
  markPlugin,
} from './markdownItPlugins';

// Path resolvers
export {
  NodePathResolver,
  type NodePathResolverOptions,
} from './nodePathResolver';

// Embedding
export {
  imageToDataUrl,
  htmlFileToDataUrl,
  embedImages,
  embedIframes,
  embedAssets,
  IMG_PATH_REGEX,
  IFRAME_SRC_REGEX,
  type MimeTypeLookup,
  type UrlFetcher,
  type EmbeddingContext,
} from './embedding';

// Marp CLI utilities
export {
  buildMarpCliCommand,
  buildMarpCliCommandString,
  contentRequiresHtml,
  type MarpCliOptions,
} from './marpCli';

// Export pipeline
export {
  exportPresentation,
  createExportConfigFromMarpConfig,
  DEFAULT_EXPORT_CONFIG,
  type ExportConfig,
  type ExportContext,
  type ExportResult,
} from './export';

// Diagram renderers
export type { DiagramRenderer } from './diagrams/types';
export { MermaidCliRenderer, type MermaidCliOptions as MermaidRendererOptions } from './diagrams/mermaid-cli';
export { PlantUMLRenderer, type PlantUMLOptions } from './diagrams/plantuml';
