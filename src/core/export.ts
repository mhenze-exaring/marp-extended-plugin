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
import { getEngine } from './engine';
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
 * Generate unique temp file paths
 */
function getTempPaths(tempDir: string): { mdPath: string; enginePath: string } {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return {
    mdPath: join(tempDir, `marp-${timestamp}-${random}.md`),
    enginePath: join(tempDir, `engine-${timestamp}-${random}.js`),
  };
}

/**
 * Clean up temporary files
 */
async function cleanup(paths: { mdPath: string; enginePath: string }): Promise<void> {
  await Promise.all([
    unlink(paths.mdPath).catch(() => {}),
    unlink(paths.enginePath).catch(() => {}),
  ]);
}

/**
 * Unified export pipeline
 *
 * This is the main export function used by both CLI and Obsidian.
 *
 * Steps:
 * 1. Preprocess markdown (wikilinks, directives, diagrams)
 * 2. Embed assets (images, iframes) as base64
 * 3. Write temporary files (processed markdown, engine.js)
 * 4. Execute marp-cli
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
  } = context;

  const tempPaths = getTempPaths(tempDir);

  try {
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

    // 3. Write temporary files
    onProgress?.('Writing temporary files...');

    // Ensure temp directory exists
    await mkdir(dirname(tempPaths.mdPath), { recursive: true });

    await writeFile(tempPaths.mdPath, processed);
    await writeFile(tempPaths.enginePath, getEngine(config.enableMarkdownItPlugins));

    // 4. Determine if HTML mode is needed
    const needsHtml =
      config.enableHtml ||
      config.enableMermaid ||
      config.enablePlantUML ||
      contentRequiresHtml(processed);

    // 5. Build marp-cli command
    const cmd = buildMarpCliCommandString(tempPaths.mdPath, {
      enginePath: tempPaths.enginePath,
      outputPath: config.outputPath,
      format: config.format,
      enableHtml: needsHtml,
      allowLocalFiles: config.allowLocalFiles,
      themeDir: config.themeDir,
      bespokeTransition: config.bespokeTransition,
      additionalArgs: config.additionalMarpArgs,
    });

    // 6. Execute marp-cli
    onProgress?.(`Exporting to ${config.format.toUpperCase()}...`);

    try {
      const { stdout, stderr } = await execAsync(cmd);
      if (stdout) onProgress?.(stdout);
      if (stderr) onProgress?.(stderr);

      await cleanup(tempPaths);
      onProgress?.('Export completed successfully');

      return {
        success: true,
        outputPath: config.outputPath,
      };
    } catch (error) {
      await cleanup(tempPaths);
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
    await cleanup(tempPaths);

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
