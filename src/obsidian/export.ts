/**
 * Obsidian Marp Plugin - Export functionality
 *
 * Thin wrapper around core export that provides Obsidian-specific
 * path resolution, config translation, and UI feedback.
 */

import { access } from 'fs/promises';
import { App, Notice, TFile, FileSystemAdapter } from 'obsidian';
import { join } from 'path';
import fixPath from 'fix-path';
import mimes from 'mime';
import {
  exportPresentation,
  type ExportConfig,
  type ExportContext,
} from '../core/export';
import { MermaidCacheManager } from './mermaidCache';
import { VaultPathResolver } from './vaultPathResolver';

export interface ExportOptions {
  /** Enable markdown-it plugins (container, mark, directives) */
  enableMarkdownItPlugins?: boolean;
  /** Enable mermaid diagram rendering */
  enableMermaid?: boolean;
  /** Mermaid cache manager instance */
  mermaidCache?: MermaidCacheManager;
  /** Enable HTML output */
  enableHTML?: boolean;
}

/**
 * Get the default export directory (user's Downloads folder)
 */
function getExportDir(): string {
  const homeDir = process.env[process.platform == 'win32' ? 'USERPROFILE' : 'HOME'];
  if (!homeDir) {
    throw new Error('Could not determine home directory');
  }
  return join(homeDir, 'Downloads');
}

/**
 * Export a Marp presentation from Obsidian
 *
 * Uses the unified core export pipeline with Obsidian-specific:
 * - VaultPathResolver for file access
 * - MermaidCacheManager for diagram rendering
 * - Notice API for user feedback
 *
 * @param app - Obsidian app instance
 * @param file - File to export
 * @param format - Export format (html, pdf, pptx)
 * @param themeDir - Theme directory (relative to vault)
 * @param options - Export options
 */
export async function exportSlide(
  app: App,
  file: TFile,
  format: 'html' | 'pdf' | 'pptx',
  themeDir: string,
  options: ExportOptions = {},
): Promise<void> {
  const {
    enableMarkdownItPlugins = false,
    enableMermaid = false,
    enableHTML = false,
    mermaidCache,
  } = options;

  if (!file) return;

  // Fix PATH for macOS GUI apps
  fixPath();

  const exportDir = getExportDir();
  const basePath = (app.vault.adapter as FileSystemAdapter).getBasePath();
  const fileDir = file.parent?.path || '';
  const outputPath = join(exportDir, `${file.basename}.${format}`);

  // Read file content via vault adapter
  const fileContent = await app.vault.cachedRead(file);

  // Resolve theme directory (check if it exists)
  const themeDirFull = join(basePath, themeDir);
  let resolvedThemeDir: string | undefined;
  try {
    await access(themeDirFull);
    resolvedThemeDir = themeDirFull;
  } catch {
    // Theme directory doesn't exist, will be omitted
  }

  // Create export config
  const exportConfig: ExportConfig = {
    format,
    outputPath,
    themeDir: resolvedThemeDir,
    enableDirectives: enableMarkdownItPlugins,
    enableMarkdownItPlugins,
    enableHtml: enableHTML || enableMermaid,
    allowLocalFiles: true,
    enableMermaid,
    enablePlantUML: false, // Not yet supported in Obsidian
    embedImages: true,
    embedIframes: true,
    bespokeTransition: true,
  };

  // Create path resolver
  const pathResolver = new VaultPathResolver(app);

  // Create export context
  const exportContext: ExportContext = {
    pathResolver,
    fileDir,
    getMimeType: (path) => mimes.getType(path),
    mermaidRenderer: enableMermaid && mermaidCache ? mermaidCache : undefined,
    wikilinkResolver: (name) => name, // Return filename as-is for embedding
    tempDir: exportDir, // Use export dir for temp files
    onProgress: (message) => {
      console.debug(`[Marp Export] ${message}`);
    },
    onError: (error) => {
      new Notice(`Export failed: ${error.message}`, 10000);
      console.error('[Marp Export]', error);
    },
  };

  // Show initial notice
  new Notice(`Exporting "${file.basename}.${format}" to "${exportDir}"`, 20000);

  // Execute export
  const result = await exportPresentation(fileContent, exportConfig, exportContext);

  if (result.success) {
    new Notice('Exported successfully', 5000);
  }
  // Error is already handled by onError callback
}
