/**
 * Embedding utilities for converting images and iframes to base64 data URLs
 *
 * These utilities work with any PathResolver implementation, allowing
 * the same embedding logic to work in both CLI and Obsidian contexts.
 */

import type { PathResolver } from './types';
import { isLocalPath, createDataUrl } from './types';

/**
 * MIME type lookup function signature
 * Allows different implementations (e.g., 'mime' package, browser APIs)
 */
export type MimeTypeLookup = (path: string) => string | null;

/**
 * URL fetcher function signature
 * Allows different implementations (e.g., fetch, Obsidian's requestUrl)
 */
export type UrlFetcher = (url: string) => Promise<ArrayBuffer>;

/**
 * Embedding context containing dependencies
 */
export interface EmbeddingContext {
  pathResolver: PathResolver;
  getMimeType: MimeTypeLookup;
  fetchUrl?: UrlFetcher;
}

/**
 * Convert an image path to a base64 data URL
 *
 * @param path - Path to the image (can be relative, absolute, or URL)
 * @param fileDir - Directory of the markdown file (for relative path resolution)
 * @param context - Embedding context with dependencies
 * @returns Base64 data URL, or null if conversion fails
 */
export async function imageToDataUrl(
  path: string,
  fileDir: string,
  context: EmbeddingContext,
): Promise<string | null> {
  const { pathResolver, getMimeType, fetchUrl } = context;

  // Check MIME type first
  const mime = getMimeType(path);
  if (!mime) return null;

  // Try to read as local file
  if (isLocalPath(path)) {
    const base64 = await pathResolver.readAsBase64(path, fileDir);
    if (base64) {
      return createDataUrl(path, base64, getMimeType);
    }
  }

  // Try as URL if fetcher is available
  if (
    fetchUrl &&
    (path.startsWith('http://') || path.startsWith('https://'))
  ) {
    try {
      const buffer = await fetchUrl(path);
      const base64 = Buffer.from(buffer).toString('base64');
      return createDataUrl(path, base64, getMimeType);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Convert a local HTML file to a base64 data URL
 * Used for embedding local iframes (e.g., Plotly exports)
 *
 * @param path - Path to the HTML file
 * @param fileDir - Directory of the markdown file
 * @param context - Embedding context
 * @returns Base64 data URL, or null if conversion fails
 */
export async function htmlFileToDataUrl(
  path: string,
  fileDir: string,
  context: EmbeddingContext,
): Promise<string | null> {
  if (!isLocalPath(path)) return null;

  const content = await context.pathResolver.readAsText(path, fileDir);
  if (!content) return null;

  const base64 = Buffer.from(content).toString('base64');
  return `data:text/html;base64,${base64}`;
}

// Regex patterns for markdown content

/** Match markdown image syntax: ![alt](path) */
export const IMG_PATH_REGEX = /!\[[^\]]*\]\(([^)]+)\)/g;

/** Match iframe src attributes with local file paths */
export const IFRAME_SRC_REGEX = /<iframe([^>]*)\ssrc="([^"]+)"([^>]*)>/gi;

/**
 * Embed all images in markdown content as base64 data URLs
 *
 * @param content - Markdown content
 * @param fileDir - Directory of the markdown file
 * @param context - Embedding context
 * @returns Content with images embedded as base64
 */
export async function embedImages(
  content: string,
  fileDir: string,
  context: EmbeddingContext,
): Promise<string> {
  // Reset regex state
  IMG_PATH_REGEX.lastIndex = 0;

  // Find all unique image paths
  const matches = [...content.matchAll(IMG_PATH_REGEX)];
  const uniquePaths = [...new Set(matches.map((m) => m[1]))];

  if (uniquePaths.length === 0) return content;

  // Convert all images in parallel
  const conversions = await Promise.all(
    uniquePaths.map(async (path) => {
      const dataUrl = await imageToDataUrl(path, fileDir, context);
      return [path, dataUrl] as const;
    }),
  );

  // Replace paths with data URLs
  let result = content;
  for (const [src, dataUrl] of conversions) {
    if (dataUrl) {
      // Escape special regex characters in the path
      const escapedSrc = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(
        new RegExp(`(!\\[[^\\]]*\\])\\(${escapedSrc}\\)`, 'g'),
        `$1(${dataUrl})`,
      );
    }
  }

  return result;
}

/**
 * Embed all local iframes in content as base64 data URLs
 *
 * @param content - HTML/Markdown content
 * @param fileDir - Directory of the markdown file
 * @param context - Embedding context
 * @returns Content with local iframes embedded as base64
 */
export async function embedIframes(
  content: string,
  fileDir: string,
  context: EmbeddingContext,
): Promise<string> {
  // Reset regex state
  IFRAME_SRC_REGEX.lastIndex = 0;

  const matches = [...content.matchAll(IFRAME_SRC_REGEX)];
  if (matches.length === 0) return content;

  let result = content;

  for (const match of matches) {
    const [fullMatch, before, src, after] = match;

    if (!isLocalPath(src)) continue;

    const dataUrl = await htmlFileToDataUrl(src, fileDir, context);
    if (dataUrl) {
      result = result.replace(
        fullMatch,
        `<iframe${before} src="${dataUrl}"${after}>`,
      );
    }
  }

  return result;
}

/**
 * Embed all images and iframes in content
 *
 * @param content - Markdown/HTML content
 * @param fileDir - Directory of the markdown file
 * @param context - Embedding context
 * @param options - Which embeddings to perform
 * @returns Content with assets embedded as base64
 */
export async function embedAssets(
  content: string,
  fileDir: string,
  context: EmbeddingContext,
  options: { images?: boolean; iframes?: boolean } = {},
): Promise<string> {
  let result = content;

  if (options.images !== false) {
    result = await embedImages(result, fileDir, context);
  }

  if (options.iframes !== false) {
    result = await embedIframes(result, fileDir, context);
  }

  return result;
}
