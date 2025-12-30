/**
 * Unified export pipeline for marp-extended
 *
 * This module provides the core export logic used by both CLI and Obsidian.
 * Platform-specific concerns (path resolution, config sources, UI feedback)
 * are injected via the ExportContext interface.
 */

import { writeFile, unlink, mkdir } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join, dirname } from 'path';

const execAsync = promisify(exec);
import { preprocessForRender, type WikilinkResolver } from './preprocessor';
import { embedAssets, type EmbeddingContext } from './embedding';
import { buildMarpCliCommandString, contentRequiresHtml } from './marpCli';
import type { DiagramRenderer } from './diagrams/types';
import type { PathResolver } from './types';
import type { ExportFormat } from './config';

/**
 * Export configuration
 *
 * Contains all options needed to configure an export operation.
 * Platform modules (CLI/Obsidian) are responsible for creating this
 * from their respective config sources.
 */
export interface ExportConfig {
  /** Output format */
  format: ExportFormat;

  /** Output file path (full path including filename) */
  outputPath: string;

  /** Theme directory (optional, full path) */
  themeDir?: string;

  /** Enable /// directive shorthand conversion */
  enableDirectives: boolean;

  /** Enable markdown-it plugins (container, mark) */
  enableMarkdownItPlugins: boolean;

  /** Enable HTML output (required for SVG diagrams, iframes, plugins) */
  enableHtml: boolean;

  /** Allow access to local files (for marp-cli) */
  allowLocalFiles: boolean;

  /** Enable mermaid diagram rendering */
  enableMermaid: boolean;

  /** Enable PlantUML diagram rendering */
  enablePlantUML: boolean;

  /** Embed images as base64 data URLs */
  embedImages: boolean;

  /** Embed local HTML iframes as data URLs */
  embedIframes: boolean;

  /** Enable bespoke transitions in HTML output */
  bespokeTransition: boolean;

  /** Additional marp-cli arguments */
  additionalMarpArgs?: string[];
}

/**
 * Export context - platform-specific dependencies
 *
 * These are injected by the platform module (CLI/Obsidian) to provide
 * platform-specific implementations.
 */
export interface ExportContext {
  /** Path resolver for file operations */
  pathResolver: PathResolver;

  /** Directory containing the markdown file (relative to resolver's root) */
  fileDir: string;

  /** MIME type lookup function */
  getMimeType: (path: string) => string | null;

  /** Mermaid diagram renderer (optional) */
  mermaidRenderer?: DiagramRenderer;

  /** PlantUML diagram renderer (optional) */
  plantumlRenderer?: DiagramRenderer;

  /** Wikilink resolver - converts wikilink names to paths for embedding */
  wikilinkResolver?: WikilinkResolver;

  /** Callback for progress messages (optional) */
  onProgress?: (message: string) => void;

  /** Callback for errors (optional) */
  onError?: (error: Error) => void;

  /** Temp directory override (default: os.tmpdir()) */
  tempDir?: string;

  /**
   * Path to the engine.js file for marp-cli
   * If provided, this engine will be used instead of generating one.
   * This is used by Obsidian to reference the bundled engine.js in the plugin directory.
   */
  enginePath?: string;
}

/**
 * Export result
 */
export interface ExportResult {
  success: boolean;
  outputPath: string;
  error?: Error;
}

/**
 * Default export configuration
 */
export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  format: 'html',
  outputPath: '',
  enableDirectives: true,
  enableMarkdownItPlugins: true,
  enableHtml: true,
  allowLocalFiles: true,
  enableMermaid: false,
  enablePlantUML: false,
  embedImages: true,
  embedIframes: true,
  bespokeTransition: true,
};

/**
 * Generate unique temp file path for markdown
 */
function getTempMdPath(tempDir: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return join(tempDir, `marp-${timestamp}-${random}.md`);
}

/**
 * Clean up temporary markdown file
 */
async function cleanupMdFile(mdPath: string): Promise<void> {
  await unlink(mdPath).catch(() => {});
}

/**
 * Basic marp engine (no custom plugins)
 * Only includes data URL validation for images
 */
const basicMarpEngineJs = `
module.exports = ({ marp }) => marp.use((md) => {
  // https://github.com/markdown-it/markdown-it/issues/447#issuecomment-373408654
  const defaultValidateLink = md.validateLink;
  md.validateLink = url => /^data:image\\/.*?;/.test(url) || defaultValidateLink(url);
})`;

/**
 * Unified export pipeline
 *
 * This is the main export function used by both CLI and Obsidian.
 *
 * Steps:
 * 1. Preprocess markdown (wikilinks, directives, diagrams)
 * 2. Embed assets (images, iframes) as base64
 * 3. Write temporary markdown file
 * 4. Execute marp-cli with engine.js from plugin directory (or basic engine)
 * 5. Clean up temporary files
 *
 * @param content - Markdown content to export
 * @param config - Export configuration
 * @param context - Platform-specific context (resolvers, renderers, callbacks)
 * @returns Export result with success status and output path
 */
export async function exportPresentation(
  content: string,
  config: ExportConfig,
  context: ExportContext,
): Promise<ExportResult> {
  const {
    pathResolver,
    fileDir,
    getMimeType,
    mermaidRenderer,
    plantumlRenderer,
    wikilinkResolver,
    onProgress,
    onError,
    tempDir = tmpdir(),
    enginePath: providedEnginePath,
  } = context;

  const tempMdPath = getTempMdPath(tempDir);
  let tempEnginePath: string | null = null;

  try {
    // Validate engine availability for markdown-it plugins
    if (config.enableMarkdownItPlugins && !providedEnginePath) {
      throw new Error(
        'Markdown-it plugins require an engine.js file. ' +
        'Please provide enginePath in the export context.',
      );
    }

    // Report progress
    onProgress?.('Preprocessing markdown...');

    // 1. Preprocess markdown
    let processed = content;

    // Wikilink resolver for export: converts to relative paths for embedding
    const exportWikilinkResolver: WikilinkResolver = wikilinkResolver || ((name) => name);

    processed = await preprocessForRender(processed, {
      wikilinkResolver: exportWikilinkResolver,
      enableDirectives: config.enableDirectives,
      enableMermaid: config.enableMermaid,
      mermaidRenderer: config.enableMermaid ? mermaidRenderer : undefined,
    });

    // PlantUML (if enabled and renderer provided)
    if (config.enablePlantUML && plantumlRenderer) {
      const { preprocessPlantUML } = await import('./preprocessor');
      processed = await preprocessPlantUML(processed, plantumlRenderer);
    }

    // 2. Embed assets
    onProgress?.('Embedding assets...');

    if (config.embedImages || config.embedIframes) {
      const embeddingContext: EmbeddingContext = {
        pathResolver,
        getMimeType,
      };

      processed = await embedAssets(processed, fileDir, embeddingContext, {
        images: config.embedImages,
        iframes: config.embedIframes,
      });
    }

    // 3. Write temporary markdown file
    onProgress?.('Writing temporary files...');

    // Ensure temp directory exists
    await mkdir(dirname(tempMdPath), { recursive: true });
    await writeFile(tempMdPath, processed);

    // 4. Determine engine path
    let enginePath: string;
    if (config.enableMarkdownItPlugins && providedEnginePath) {
      // Use provided engine.js from plugin directory
      enginePath = providedEnginePath;
    } else {
      // Write basic engine to temp file (no markdown-it plugins)
      tempEnginePath = join(tempDir, `engine-${Date.now()}.js`);
      await writeFile(tempEnginePath, basicMarpEngineJs);
      enginePath = tempEnginePath;
    }

    // 5. Determine if HTML mode is needed
    const needsHtml =
      config.enableHtml ||
      config.enableMermaid ||
      config.enablePlantUML ||
      contentRequiresHtml(processed);

    // 6. Build marp-cli command
    const cmd = buildMarpCliCommandString(tempMdPath, {
      enginePath,
      outputPath: config.outputPath,
      format: config.format,
      enableHtml: needsHtml,
      allowLocalFiles: config.allowLocalFiles,
      themeDir: config.themeDir,
      bespokeTransition: config.bespokeTransition,
      additionalArgs: config.additionalMarpArgs,
    });

    // 7. Execute marp-cli
    onProgress?.(`Exporting to ${config.format.toUpperCase()}...`);

    try {
      const { stdout, stderr } = await execAsync(cmd);
      if (stdout) onProgress?.(stdout);
      if (stderr) onProgress?.(stderr);

      await cleanupMdFile(tempMdPath);
      if (tempEnginePath) await unlink(tempEnginePath).catch(() => {});
      onProgress?.('Export completed successfully');

      return {
        success: true,
        outputPath: config.outputPath,
      };
    } catch (error) {
      await cleanupMdFile(tempMdPath);
      if (tempEnginePath) await unlink(tempEnginePath).catch(() => {});
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      return {
        success: false,
        outputPath: config.outputPath,
        error: err,
      };
    }
  } catch (error) {
    // Cleanup on preprocessing/embedding errors
    await cleanupMdFile(tempMdPath);
    if (tempEnginePath) await unlink(tempEnginePath).catch(() => {});

    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
    return {
      success: false,
      outputPath: config.outputPath,
      error: err,
    };
  }
}

/**
 * Create ExportConfig from MarpExtendedConfig (for CLI)
 */
export function createExportConfigFromMarpConfig(
  marpConfig: {
    preprocessor: {
      enableDirectiveShorthand: boolean;
      enableContainerPlugin: boolean;
      enableMarkPlugin: boolean;
    };
    diagrams: {
      mermaid: { enabled: boolean };
      plantuml: { enabled: boolean };
    };
    embedding: {
      images: boolean;
      iframes: boolean;
    };
    export: { format: ExportFormat };
    mode: 'safe' | 'unsafe';
    themeDir?: string;
    marpCliArgs?: string[];
  },
  outputPath: string,
): ExportConfig {
  const isUnsafe = marpConfig.mode === 'unsafe';

  return {
    format: marpConfig.export.format,
    outputPath,
    themeDir: marpConfig.themeDir,
    enableDirectives: marpConfig.preprocessor.enableDirectiveShorthand,
    enableMarkdownItPlugins:
      marpConfig.preprocessor.enableContainerPlugin ||
      marpConfig.preprocessor.enableMarkPlugin,
    enableHtml: isUnsafe,
    allowLocalFiles: isUnsafe,
    enableMermaid: isUnsafe && marpConfig.diagrams.mermaid.enabled,
    enablePlantUML: isUnsafe && marpConfig.diagrams.plantuml.enabled,
    embedImages: isUnsafe && marpConfig.embedding.images,
    embedIframes: isUnsafe && marpConfig.embedding.iframes,
    bespokeTransition: true,
    additionalMarpArgs: marpConfig.marpCliArgs,
  };
}
