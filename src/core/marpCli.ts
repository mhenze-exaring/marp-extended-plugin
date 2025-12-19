/**
 * Marp CLI command building utilities
 *
 * Shared logic for building marp-cli commands used by both
 * the CLI tool and Obsidian export.
 */

import type { ExportFormat } from './config';

export interface MarpCliOptions {
  /** Path to the custom engine file */
  enginePath: string;
  /** Output file path */
  outputPath: string;
  /** Export format */
  format: ExportFormat;
  /** Enable HTML output (required for SVG diagrams, iframes) */
  enableHtml?: boolean;
  /** Allow access to local files */
  allowLocalFiles?: boolean;
  /** Path to theme directory (optional) */
  themeDir?: string;
  /** Enable bespoke transitions */
  bespokeTransition?: boolean;
  /** Additional marp-cli arguments */
  additionalArgs?: string[];
}

/**
 * Build marp-cli command parts array
 *
 * @returns Array of command parts that can be joined with spaces
 */
export function buildMarpCliCommand(
  inputPath: string,
  options: MarpCliOptions,
): string[] {
  const cmdParts = [
    'npx',
    '-y',
    '@marp-team/marp-cli@latest',
    `--engine "${options.enginePath}"`,
    `-o "${options.outputPath}"`,
    '--stdin false',
  ];

  // Add format-specific options
  if (options.format === 'pdf') {
    cmdParts.push('--pdf');
  } else if (options.format === 'pptx') {
    cmdParts.push('--pptx');
  }
  // html is the default, no flag needed

  // Enable bespoke transitions (for presentations)
  if (options.bespokeTransition !== false) {
    cmdParts.push('--bespoke.transition');
  }

  // HTML and local file access
  if (options.enableHtml) {
    cmdParts.push('--html');
  }
  if (options.allowLocalFiles) {
    cmdParts.push('--allow-local-files');
  }

  // Theme directory
  if (options.themeDir) {
    cmdParts.push(`--theme-set "${options.themeDir}"`);
  }

  // Additional arguments
  if (options.additionalArgs && options.additionalArgs.length > 0) {
    cmdParts.push(...options.additionalArgs);
  }

  // Input file (must be last)
  cmdParts.push(`-- "${inputPath}"`);

  return cmdParts;
}

/**
 * Build complete marp-cli command string
 */
export function buildMarpCliCommandString(
  inputPath: string,
  options: MarpCliOptions,
): string {
  return buildMarpCliCommand(inputPath, options).join(' ');
}

/**
 * Determine if HTML mode should be enabled based on content
 */
export function contentRequiresHtml(content: string): boolean {
  return (
    content.includes('<iframe') ||
    content.includes('<div') ||
    content.includes('<svg') ||
    content.includes('<img src="data:')
  );
}
