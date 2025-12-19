/**
 * Mermaid renderer using @mermaid-js/mermaid-cli (mmdc)
 *
 * Suitable for CLI usage where browser APIs aren't available.
 * Requires: npm install -g @mermaid-js/mermaid-cli
 */

import { execFile } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { DiagramRenderer } from './types';

export interface MermaidCliOptions {
  /** Path to mmdc executable. Default: 'mmdc' (assumes in PATH) */
  cliPath?: string;
  /** Mermaid theme. Default: 'default' */
  theme?: string;
}

/**
 * Create an error SVG placeholder
 */
function createErrorSvg(message: string): string {
  const escapedMessage = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100">
    <rect width="400" height="100" fill="#fee" stroke="#c00" stroke-width="2" rx="4"/>
    <text x="10" y="25" fill="#c00" font-family="monospace" font-size="14" font-weight="bold">Mermaid Error</text>
    <text x="10" y="50" fill="#600" font-family="monospace" font-size="11">${escapedMessage.substring(0, 60)}</text>
    ${escapedMessage.length > 60 ? `<text x="10" y="70" fill="#600" font-family="monospace" font-size="11">${escapedMessage.substring(60, 120)}</text>` : ''}
  </svg>`;
}

/**
 * Mermaid renderer using mermaid-cli (mmdc)
 */
export class MermaidCliRenderer implements DiagramRenderer {
  private cliPath: string;
  private theme: string;

  constructor(options: MermaidCliOptions = {}) {
    this.cliPath = options.cliPath || 'mmdc';
    this.theme = options.theme || 'default';
  }

  async render(code: string): Promise<string> {
    const trimmedCode = code.trim();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const tmpInput = join(tmpdir(), `mermaid-${timestamp}-${random}.mmd`);
    const tmpOutput = join(tmpdir(), `mermaid-${timestamp}-${random}.svg`);

    try {
      await writeFile(tmpInput, trimmedCode);

      await new Promise<void>((resolve, reject) => {
        execFile(
          this.cliPath,
          ['-i', tmpInput, '-o', tmpOutput, '-t', this.theme, '--quiet'],
          { timeout: 30000 }, // 30 second timeout
          (error, _stdout, stderr) => {
            if (error) {
              reject(new Error(stderr || error.message));
            } else {
              resolve();
            }
          },
        );
      });

      const svg = await readFile(tmpOutput, 'utf-8');

      // Clean up the SVG
      return this.cleanSvg(svg);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('Mermaid CLI render error:', errorMessage);
      return createErrorSvg(errorMessage);
    } finally {
      // Clean up temp files
      await unlink(tmpInput).catch(() => {});
      await unlink(tmpOutput).catch(() => {});
    }
  }

  /**
   * Clean SVG for embedding
   */
  private cleanSvg(svg: string): string {
    return svg
      // Remove XML declaration if present
      .replace(/<\?xml[^?]*\?>/g, '')
      // Remove comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Normalize whitespace
      .trim();
  }
}
