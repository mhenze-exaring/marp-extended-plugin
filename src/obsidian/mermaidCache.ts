import mermaid from 'mermaid';
import type { DiagramRenderer } from '../core/diagrams/types';

export type MermaidTheme =
  | 'default'
  | 'dark'
  | 'forest'
  | 'neutral'
  | 'base';

export interface MermaidConfig {
  theme: MermaidTheme;
}

// Regex to match mermaid code blocks with optional sizing (w:VALUE or h:VALUE)
// VALUE can be a number (defaults to px) or include units (%, pt, em, etc.)
// Examples: ```mermaid, ```mermaid w:400, ```mermaid h:50%, ```mermaid w:10em
const MERMAID_REGEX = /```mermaid(?:\s+(w|h):(\S+))?\n([\s\S]*?)```/g;

interface MermaidBlockMatch {
  fullMatch: string;
  index: number;
  sizeType: 'w' | 'h' | null;
  sizeValue: string | null;
  code: string;
}

/**
 * Manages Mermaid diagram rendering with caching.
 * SVGs are cached by content hash to avoid re-rendering unchanged diagrams.
 * Implements DiagramRenderer interface for use with core preprocessor.
 */
export class MermaidCacheManager implements DiagramRenderer {
  private cache = new Map<string, string>();
  private initialized = false;
  private renderContainer: HTMLElement | null = null;

  constructor(private config: MermaidConfig = { theme: 'default' }) {}

  /**
   * Initialize Mermaid with current configuration.
   * Must be called before rendering.
   * Returns Promise for DiagramRenderer interface compatibility.
   */
  initialize(): Promise<void> {
    if (this.initialized) return Promise.resolve();

    mermaid.initialize({
      startOnLoad: false,
      theme: this.config.theme,
      // 'loose' allows rendering in detached DOM elements
      securityLevel: 'loose',
    });

    this.initialized = true;
    return Promise.resolve();
  }

  /**
   * Update Mermaid theme configuration.
   * Clears cache since theme change affects all SVGs.
   */
  setTheme(theme: MermaidTheme): void {
    if (this.config.theme === theme) return;

    this.config.theme = theme;
    this.initialized = false;
    this.cache.clear();
  }

  /**
   * Simple hash function for cache keys.
   */
  private hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /**
   * Ensure we have a container for Mermaid rendering.
   * Mermaid requires a DOM element to render into.
   */
  private ensureRenderContainer(): HTMLElement {
    if (this.renderContainer && document.body.contains(this.renderContainer)) {
      return this.renderContainer;
    }

    // Create hidden container for rendering
    // Uses CSS class from styles.css for positioning
    this.renderContainer = document.createElement('div');
    this.renderContainer.className = 'marp-ext-mermaid-container';
    document.body.appendChild(this.renderContainer);

    return this.renderContainer;
  }

  /**
   * Render a single Mermaid diagram to SVG.
   * Returns cached version if available.
   */
  async render(code: string): Promise<string> {
    const trimmedCode = code.trim();
    const key = this.hash(trimmedCode);

    // Return cached SVG if available
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    await this.initialize();
    this.ensureRenderContainer();

    try {
      const id = `mermaid-${key}-${Date.now()}`;
      const { svg } = await mermaid.render(id, trimmedCode);

      // Clean up the SVG for inline embedding
      const cleanedSvg = this.cleanSvg(svg);

      this.cache.set(key, cleanedSvg);
      return cleanedSvg;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('Mermaid render error:', errorMessage);

      // Return error placeholder
      const errorSvg = this.createErrorSvg(errorMessage);
      // Don't cache errors - allow retry on next render
      return errorSvg;
    }
  }

  /**
   * Clean SVG for embedding.
   * Removes XML declaration and comments.
   */
  private cleanSvg(svg: string): string {
    return svg
      // Remove XML declaration if present
      .replace(/<\?xml[^?]*\?>/g, '')
      // Remove comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Normalize whitespace (but preserve content)
      .trim();
  }

  /**
   * Convert SVG to a base64 data URI for use in <img> tags.
   * This isolates the SVG from parent document CSS completely.
   */
  private svgToDataUri(svg: string): string {
    // Encode the SVG as base64
    // Use decodeURIComponent with a replace pattern instead of deprecated unescape
    const encoded = encodeURIComponent(svg).replace(
      /%([0-9A-F]{2})/g,
      (_, p1) => String.fromCharCode(parseInt(p1, 16)),
    );
    const base64 = btoa(encoded);
    return `data:image/svg+xml;base64,${base64}`;
  }

  /**
   * Create an error SVG placeholder.
   */
  private createErrorSvg(message: string): string {
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
   * Check if markdown contains any Mermaid code blocks.
   */
  hasMermaidBlocks(markdown: string): boolean {
    return MERMAID_REGEX.test(markdown);
  }

  /**
   * Parse mermaid code block matches into structured data.
   * Regex groups: [0]=full match, [1]=w|h, [2]=size value, [3]=code
   */
  private parseMatches(
    matches: RegExpMatchArray[],
  ): MermaidBlockMatch[] {
    return matches.map((match) => ({
      fullMatch: match[0],
      index: match.index!,
      sizeType: (match[1] as 'w' | 'h') || null,
      sizeValue: match[2] || null,
      code: match[3],
    }));
  }

  /**
   * Normalize size value: add 'px' if no unit is specified.
   */
  private normalizeSizeValue(value: string): string {
    // If value is purely numeric, add 'px'
    if (/^\d+$/.test(value)) {
      return `${value}px`;
    }
    // Otherwise pass through as-is (e.g., 50%, 10em, 2rem, 100pt)
    return value;
  }

  /**
   * Generate inline style for the img tag based on size parameters.
   * w:VALUE -> width: VALUE; height: auto
   * h:VALUE -> height: VALUE; width: auto
   * no size -> (no style, let it scale naturally)
   *
   * VALUE defaults to px if no unit specified, otherwise passed through.
   */
  private generateImgStyle(
    sizeType: 'w' | 'h' | null,
    sizeValue: string | null,
  ): string {
    if (!sizeType || !sizeValue) {
      return '';
    }

    const normalizedValue = this.normalizeSizeValue(sizeValue);

    if (sizeType === 'w') {
      return ` style="width: ${normalizedValue}; height: auto;"`;
    } else {
      return ` style="height: ${normalizedValue}; width: auto;"`;
    }
  }

  /**
   * Preprocess markdown by converting all Mermaid code blocks to inline SVGs.
   * This is the main entry point for both preview and export.
   *
   * Supports optional sizing in code block header:
   * - ```mermaid w:400   -> width: 400px (number defaults to px)
   * - ```mermaid h:300   -> height: 300px
   * - ```mermaid w:50%   -> width: 50%
   * - ```mermaid h:10em  -> height: 10em
   */
  async preprocessMarkdown(markdown: string): Promise<string> {
    // Reset regex state
    MERMAID_REGEX.lastIndex = 0;

    const rawMatches = [...markdown.matchAll(MERMAID_REGEX)];

    if (rawMatches.length === 0) {
      return markdown;
    }

    const matches = this.parseMatches(rawMatches);

    // Render all diagrams in parallel for performance
    const renderPromises = matches.map((m) => this.render(m.code));
    const svgs = await Promise.all(renderPromises);

    // Build result by replacing each match (reverse order to preserve indices)
    let result = markdown;
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      const svg = svgs[i];

      // Convert SVG to base64 data URI and use <img> tag
      // This completely isolates the SVG from parent document CSS
      const dataUri = this.svgToDataUri(svg);
      const style = this.generateImgStyle(match.sizeType, match.sizeValue);
      const replacement = `<img src="${dataUri}" alt="Mermaid diagram"${style}>`;

      result =
        result.substring(0, match.index) +
        replacement +
        result.substring(match.index + match.fullMatch.length);
    }

    return result;
  }

  /**
   * Clear the entire cache.
   * Useful when theme changes or for debugging.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics for debugging.
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: [...this.cache.keys()],
    };
  }

  /**
   * Clean up DOM resources.
   * Call this when the plugin is unloaded.
   */
  destroy(): void {
    if (this.renderContainer && this.renderContainer.parentNode) {
      this.renderContainer.parentNode.removeChild(this.renderContainer);
    }
    this.renderContainer = null;
    this.cache.clear();
    this.initialized = false;
  }
}

// Default singleton instance
let defaultInstance: MermaidCacheManager | null = null;

/**
 * Get or create the default MermaidCacheManager instance.
 */
export function getMermaidCacheManager(
  config?: MermaidConfig,
): MermaidCacheManager {
  if (!defaultInstance) {
    defaultInstance = new MermaidCacheManager(config);
  }
  return defaultInstance;
}

/**
 * Destroy the default instance.
 * Call this when the plugin is unloaded.
 */
export function destroyMermaidCacheManager(): void {
  if (defaultInstance) {
    defaultInstance.destroy();
    defaultInstance = null;
  }
}
