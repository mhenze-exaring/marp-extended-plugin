/**
 * Obsidian Vault implementation of PathResolver
 *
 * For use in Obsidian plugin context where we use app.vault.adapter for file access.
 * This is more efficient than Node.js fs operations in the Obsidian environment.
 */

import { App, FileSystemAdapter } from 'obsidian';
import { join, normalize } from 'path';
import { access, readFile } from 'fs/promises';
import type { PathResolver } from '../core/types';

const APP_URL_PREFIX = 'app://local';

export class VaultPathResolver implements PathResolver {
  constructor(private app: App) {}

  /**
   * Get the vault's base filesystem path
   */
  private getBasePath(): string {
    return (this.app.vault.adapter as FileSystemAdapter).getBasePath();
  }

  /**
   * Try to resolve a path within the vault, checking multiple locations
   * Returns the vault-relative path that exists, or null if none found
   */
  private async tryResolveVaultPath(
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

    // 1. Try relative to file's directory
    const relativePath = fileDir ? `${fileDir}/${path}` : path;
    if (await this.app.vault.adapter.exists(relativePath)) {
      return relativePath;
    }

    // 2. Try as direct vault path
    if (await this.app.vault.adapter.exists(path)) {
      return path;
    }

    return null;
  }

  /**
   * Try to resolve as absolute filesystem path (outside vault)
   */
  private async tryResolveAbsolutePath(path: string): Promise<string | null> {
    if (!path.startsWith('/')) return null;

    try {
      await access(path);
      return path;
    } catch {
      return null;
    }
  }

  async exists(path: string, fileDir: string): Promise<boolean> {
    const vaultPath = await this.tryResolveVaultPath(path, fileDir);
    if (vaultPath) return true;

    const absolutePath = await this.tryResolveAbsolutePath(path);
    return absolutePath !== null;
  }

  async readAsBase64(path: string, fileDir: string): Promise<string | null> {
    // Try vault path first
    const vaultPath = await this.tryResolveVaultPath(path, fileDir);
    if (vaultPath) {
      try {
        const basePath = this.getBasePath();
        const fullPath = normalize(join(basePath, vaultPath));
        const buffer = await readFile(fullPath);
        return buffer.toString('base64');
      } catch {
        return null;
      }
    }

    // Try absolute path
    const absolutePath = await this.tryResolveAbsolutePath(path);
    if (absolutePath) {
      try {
        const buffer = await readFile(absolutePath);
        return buffer.toString('base64');
      } catch {
        return null;
      }
    }

    // Handle app:// URLs
    if (path.startsWith(APP_URL_PREFIX)) {
      const fsPath = path.slice(APP_URL_PREFIX.length);
      try {
        const buffer = await readFile(fsPath);
        return buffer.toString('base64');
      } catch {
        return null;
      }
    }

    return null;
  }

  async readAsText(path: string, fileDir: string): Promise<string | null> {
    // Try vault path first
    const vaultPath = await this.tryResolveVaultPath(path, fileDir);
    if (vaultPath) {
      try {
        const basePath = this.getBasePath();
        const fullPath = normalize(join(basePath, vaultPath));
        return await readFile(fullPath, 'utf-8');
      } catch {
        return null;
      }
    }

    // Try absolute path
    const absolutePath = await this.tryResolveAbsolutePath(path);
    if (absolutePath) {
      try {
        return await readFile(absolutePath, 'utf-8');
      } catch {
        return null;
      }
    }

    return null;
  }

  async getResourceUrl(path: string, fileDir: string): Promise<string | null> {
    // For URLs, return as-is
    if (
      path.startsWith('http://') ||
      path.startsWith('https://') ||
      path.startsWith('data:') ||
      path.startsWith('app://')
    ) {
      return path;
    }

    // Try vault path - use Obsidian's getResourcePath for efficient access
    const vaultPath = await this.tryResolveVaultPath(path, fileDir);
    if (vaultPath) {
      return this.app.vault.adapter.getResourcePath(vaultPath);
    }

    // For absolute paths, convert to app:// URL
    const absolutePath = await this.tryResolveAbsolutePath(path);
    if (absolutePath) {
      return `${APP_URL_PREFIX}${absolutePath}`;
    }

    return null;
  }

  async resolveAbsolute(path: string, fileDir: string): Promise<string | null> {
    // Try vault path
    const vaultPath = await this.tryResolveVaultPath(path, fileDir);
    if (vaultPath) {
      return normalize(join(this.getBasePath(), vaultPath));
    }

    // Try absolute path
    return this.tryResolveAbsolutePath(path);
  }
}
