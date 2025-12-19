/**
 * Core types shared between CLI and Obsidian plugin
 */

/**
 * PathResolver interface for abstracting file system access
 *
 * This allows the same embedding/path-resolution logic to work:
 * - In CLI: Using Node.js fs operations with optional root path
 * - In Obsidian: Using app.vault.adapter for efficient vault access
 *
 * Path resolution strategy:
 * 1. Relative paths are resolved from fileDir (directory of the markdown file)
 * 2. If not found in fileDir, try from rootPath (e.g., vault root)
 * 3. If still not found and path is absolute, try the absolute path
 */
export interface PathResolver {
  /**
   * Check if a file exists
   * @param path - Path to check (can be relative to fileDir, relative to root, or absolute)
   * @param fileDir - Directory of the current markdown file (relative to root)
   */
  exists(path: string, fileDir: string): Promise<boolean>;

  /**
   * Read a file as base64-encoded string
   * @param path - Path to file
   * @param fileDir - Directory of the current markdown file (relative to root)
   * @returns Base64-encoded content, or null if file cannot be read
   */
  readAsBase64(path: string, fileDir: string): Promise<string | null>;

  /**
   * Read a file as text
   * @param path - Path to file
   * @param fileDir - Directory of the current markdown file (relative to root)
   * @returns Text content, or null if file cannot be read
   */
  readAsText(path: string, fileDir: string): Promise<string | null>;

  /**
   * Get a URL that can be used to reference the file
   * Used for preview (not export) where we need a URL reference, not embedded content
   *
   * @param path - Path to file
   * @param fileDir - Directory of the current markdown file (relative to root)
   * @returns URL string (could be file://, app://, http://, etc.) or null if not resolvable
   */
  getResourceUrl(path: string, fileDir: string): Promise<string | null>;

  /**
   * Resolve a path to its absolute filesystem path
   * Useful when you need to pass the path to external tools
   *
   * @param path - Path to resolve
   * @param fileDir - Directory of the current markdown file (relative to root)
   * @returns Absolute path, or null if not resolvable
   */
  resolveAbsolute(path: string, fileDir: string): Promise<string | null>;
}

/**
 * Check if a path is a local filesystem path (not a URL or data URI)
 */
export function isLocalPath(path: string): boolean {
  return (
    !path.startsWith('http://') &&
    !path.startsWith('https://') &&
    !path.startsWith('data:') &&
    !path.startsWith('app://') &&
    !path.startsWith('blob:')
  );
}

/**
 * Add MIME type prefix to base64 data to create a data URL
 *
 * @param path - Original file path (used to determine MIME type)
 * @param base64Data - Raw base64-encoded data
 * @returns Complete data URL with MIME type, or null if MIME type cannot be determined
 */
export function createDataUrl(
  path: string,
  base64Data: string,
  getMimeType: (path: string) => string | null,
): string | null {
  const mime = getMimeType(path);
  if (!mime) return null;
  return `data:${mime};base64,${base64Data}`;
}
