/**
 * Node.js implementation of PathResolver
 *
 * For use in CLI context where we have direct filesystem access via Node.js fs module.
 * Supports optional root path for resolving relative paths (e.g., vault root).
 */

import { access, readFile } from 'fs/promises';
import { join, normalize, isAbsolute } from 'path';
import type { PathResolver } from './types';

export interface NodePathResolverOptions {
  /**
   * Root path for resolving relative paths (e.g., vault root, project root)
   * If not provided, relative paths are resolved from current working directory
   */
  rootPath?: string;
}

export class NodePathResolver implements PathResolver {
  private rootPath: string;

  constructor(options: NodePathResolverOptions = {}) {
    this.rootPath = options.rootPath || process.cwd();
  }

  /**
   * Try to resolve a path, checking multiple locations
   * Returns the first path that exists, or null if none found
   */
  private async tryResolvePath(
    path: string,
    fileDir: string,
  ): Promise<string | null> {
    // Skip URLs and data URIs
    if (
      path.startsWith('http://') ||
      path.startsWith('https://') ||
      path.startsWith('data:') ||
      path.startsWith('app://') ||
      path.startsWith('blob:')
    ) {
      return null;
    }

    // 1. Try relative to file's directory (within root)
    if (!isAbsolute(path)) {
      const relativePath = fileDir ? join(fileDir, path) : path;
      const fullPath = normalize(join(this.rootPath, relativePath));
      try {
        await access(fullPath);
        return fullPath;
      } catch {
        // Continue to next strategy
      }

      // 2. Try relative to root directly
      const rootRelativePath = normalize(join(this.rootPath, path));
      try {
        await access(rootRelativePath);
        return rootRelativePath;
      } catch {
        // Continue to next strategy
      }
    }

    // 3. Try as absolute path
    const absolutePath = normalize(path);
    try {
      await access(absolutePath);
      return absolutePath;
    } catch {
      return null;
    }
  }

  async exists(path: string, fileDir: string): Promise<boolean> {
    const resolved = await this.tryResolvePath(path, fileDir);
    return resolved !== null;
  }

  async readAsBase64(path: string, fileDir: string): Promise<string | null> {
    const resolved = await this.tryResolvePath(path, fileDir);
    if (!resolved) return null;

    try {
      const buffer = await readFile(resolved);
      return buffer.toString('base64');
    } catch {
      return null;
    }
  }

  async readAsText(path: string, fileDir: string): Promise<string | null> {
    const resolved = await this.tryResolvePath(path, fileDir);
    if (!resolved) return null;

    try {
      return await readFile(resolved, 'utf-8');
    } catch {
      return null;
    }
  }

  async getResourceUrl(path: string, fileDir: string): Promise<string | null> {
    // For URLs, return as-is
    if (
      path.startsWith('http://') ||
      path.startsWith('https://') ||
      path.startsWith('data:')
    ) {
      return path;
    }

    const resolved = await this.tryResolvePath(path, fileDir);
    if (!resolved) return null;

    // Return file:// URL for local files
    return `file://${resolved}`;
  }

  async resolveAbsolute(path: string, fileDir: string): Promise<string | null> {
    return this.tryResolvePath(path, fileDir);
  }
}
