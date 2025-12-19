/**
 * PlantUML renderer using java -jar plantuml.jar
 *
 * Requires: Java and plantuml.jar
 */

import { spawn } from 'child_process';
import type { DiagramRenderer } from './types';

export interface PlantUMLOptions {
  /** Path to plantuml.jar (required) */
  jarPath: string;
  /** Path to java executable. Default: 'java' */
  javaPath?: string;
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
    <text x="10" y="25" fill="#c00" font-family="monospace" font-size="14" font-weight="bold">PlantUML Error</text>
    <text x="10" y="50" fill="#600" font-family="monospace" font-size="11">${escapedMessage.substring(0, 60)}</text>
    ${escapedMessage.length > 60 ? `<text x="10" y="70" fill="#600" font-family="monospace" font-size="11">${escapedMessage.substring(60, 120)}</text>` : ''}
  </svg>`;
}

/**
 * PlantUML renderer using java -jar plantuml.jar
 */
export class PlantUMLRenderer implements DiagramRenderer {
  private jarPath: string;
  private javaPath: string;

  constructor(options: PlantUMLOptions) {
    if (!options.jarPath) {
      throw new Error('PlantUML jarPath is required');
    }
    this.jarPath = options.jarPath;
    this.javaPath = options.javaPath || 'java';
  }

  async render(code: string): Promise<string> {
    const trimmedCode = code.trim();

    try {
      return await new Promise<string>((resolve, reject) => {
        const chunks: Buffer[] = [];
        const errorChunks: Buffer[] = [];

        // Use pipe mode to avoid temp files
        const proc = spawn(this.javaPath, [
          '-jar',
          this.jarPath,
          '-tsvg',
          '-pipe',
        ]);

        proc.stdout.on('data', (chunk) => chunks.push(chunk));
        proc.stderr.on('data', (chunk) => errorChunks.push(chunk));

        proc.on('close', (code) => {
          if (code !== 0) {
            const stderr = Buffer.concat(errorChunks).toString();
            reject(new Error(stderr || `PlantUML exited with code ${code}`));
          } else {
            const svg = Buffer.concat(chunks).toString();
            resolve(this.cleanSvg(svg));
          }
        });

        proc.on('error', (err) => {
          reject(err);
        });

        // Write input to stdin
        proc.stdin.write(trimmedCode);
        proc.stdin.end();

        // Timeout after 60 seconds
        setTimeout(() => {
          proc.kill();
          reject(new Error('PlantUML render timeout'));
        }, 60000);
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('PlantUML render error:', errorMessage);
      return createErrorSvg(errorMessage);
    }
  }

  /**
   * Clean SVG for embedding
   */
  private cleanSvg(svg: string): string {
    return svg
      // Remove XML declaration if present
      .replace(/<\?xml[^?]*\?>/g, '')
      // Remove DOCTYPE if present
      .replace(/<!DOCTYPE[^>]*>/g, '')
      // Remove comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Normalize whitespace
      .trim();
  }
}
