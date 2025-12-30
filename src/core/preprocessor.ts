/**
 * Markdown preprocessors for marp-extended
 *
 * These run BEFORE marp-cli processes the markdown.
 * This is important because Marp parses directives from raw markdown.
 */

import { MarpExtendedConfig } from './config';
import type { DiagramRenderer } from './diagrams/types';
import type { PathResolver } from './types';

/**
 * Tokenize a string while preserving quoted substrings
 *
 * Splits on whitespace and colons, but keeps quoted strings intact.
 * Colons inside quotes are not treated as delimiters.
 *
 * @example
 * tokenizePreservingQuotes('lead footer:"links : rechts"')
 * // => ['lead', 'footer', ':', '"links : rechts"']
 *
 * tokenizePreservingQuotes("paginate:skip footer:'Text'")
 * // => ['paginate', ':', 'skip', 'footer', ':', "'Text'"]
 */
export function tokenizePreservingQuotes(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote: string | null = null; // null, '"', or "'"

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if ((char === '"' || char === "'") && !inQuote) {
      // Start of quoted string
      inQuote = char;
      current += char;
    } else if (char === inQuote) {
      // End of quoted string
      inQuote = null;
      current += char;
    } else if (char === ':' && !inQuote) {
      // Colon outside quotes - treat as delimiter
      if (current.trim()) tokens.push(current.trim());
      tokens.push(':');
      current = '';
    } else if (/\s/.test(char) && !inQuote) {
      // Whitespace outside quotes - token boundary
      if (current.trim()) tokens.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Don't forget the last token
  if (current.trim()) tokens.push(current.trim());

  return tokens;
}

/**
 * Parsed Marp directive result
 */
export interface MarpDirectiveResult {
  classes: string[];
  directives: Array<{ key: string; value: string }>;
}

/**
 * Parse Marp directive string into classes and key-value directives
 *
 * Tokens without ":" before the first directive are treated as classes.
 * Tokens with ":" are treated as key-value directives.
 * Quoted values preserve spaces and colons inside.
 *
 * @example
 * parseMarpDirective('lead gaia')
 * // => { classes: ['lead', 'gaia'], directives: [] }
 *
 * parseMarpDirective('paginate:skip')
 * // => { classes: [], directives: [{ key: 'paginate', value: 'skip' }] }
 *
 * parseMarpDirective('lead footer:"links : rechts"')
 * // => { classes: ['lead'], directives: [{ key: 'footer', value: '"links : rechts"' }] }
 */
export function parseMarpDirective(input: string): MarpDirectiveResult | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const tokens = tokenizePreservingQuotes(trimmed);
  if (tokens.length === 0) return null;

  const classes: string[] = [];
  const directives: Array<{ key: string; value: string }> = [];

  // State machine: collect tokens into classes or directives
  let i = 0;

  // First, collect classes (tokens before first ":")
  while (i < tokens.length) {
    // Look ahead to see if next token is ":"
    if (i + 1 < tokens.length && tokens[i + 1] === ':') {
      // This token is a directive key, stop collecting classes
      break;
    }
    if (tokens[i] !== ':') {
      classes.push(tokens[i]);
    }
    i++;
  }

  // Now collect directives (key : value pairs)
  while (i < tokens.length) {
    const key = tokens[i];

    // Expect ":" next
    if (i + 1 >= tokens.length || tokens[i + 1] !== ':') {
      // Malformed - skip this token
      i++;
      continue;
    }

    // Skip the ":"
    i += 2;

    // Collect value tokens until next key (token followed by ":")
    const valueTokens: string[] = [];
    while (i < tokens.length) {
      // Look ahead: if next token is ":", current token is a new key
      if (i + 1 < tokens.length && tokens[i + 1] === ':') {
        break;
      }
      if (tokens[i] !== ':') {
        valueTokens.push(tokens[i]);
      }
      i++;
    }

    if (valueTokens.length > 0) {
      directives.push({ key, value: valueTokens.join(' ') });
    }
  }

  if (classes.length === 0 && directives.length === 0) {
    return null;
  }

  return { classes, directives };
}

/**
 * Generate Marp HTML comments from parsed directive result
 *
 * @example
 * generateMarpComments({ classes: ['lead', 'gaia'], directives: [{ key: 'paginate', value: 'skip' }] })
 * // => '<!-- _class: lead gaia -->\n<!-- _paginate: skip -->'
 */
export function generateMarpComments(result: MarpDirectiveResult): string {
  const comments: string[] = [];

  if (result.classes.length > 0) {
    comments.push(`<!-- _class: ${result.classes.join(' ')} -->`);
  }

  for (const directive of result.directives) {
    comments.push(`<!-- _${directive.key}: ${directive.value} -->`);
  }

  return comments.join('\n');
}

/**
 * Preprocess /// directive shorthand to Marp HTML comments
 *
 * This is safe to run in any mode - it only transforms text, no file access.
 */
export function preprocessDirectives(markdown: string): string {
  const directiveRegex = /^\/\/\/\s+(.+)$/gm;
  return markdown.replace(directiveRegex, (_, params) => {
    const result = parseMarpDirective(params);
    if (result) {
      return generateMarpComments(result);
    }
    return `/// ${params}`; // Leave unchanged if parsing fails
  });
}

/**
 * Mermaid code block regex with optional sizing
 * Examples: ```mermaid, ```mermaid w:400, ```mermaid h:50%
 */
const MERMAID_REGEX = /```mermaid(?:\s+(w|h):(\S+))?\n([\s\S]*?)```/g;

interface MermaidBlockMatch {
  fullMatch: string;
  index: number;
  sizeType: 'w' | 'h' | null;
  sizeValue: string | null;
  code: string;
}

/**
 * Normalize size value: add 'px' if no unit is specified
 */
function normalizeSizeValue(value: string): string {
  if (/^\d+$/.test(value)) {
    return `${value}px`;
  }
  return value;
}

/**
 * Generate inline style for the img tag based on size parameters
 */
function generateImgStyle(
  sizeType: 'w' | 'h' | null,
  sizeValue: string | null,
): string {
  if (!sizeType || !sizeValue) {
    return '';
  }

  const normalizedValue = normalizeSizeValue(sizeValue);

  if (sizeType === 'w') {
    return ` style="width: ${normalizedValue}; height: auto;"`;
  } else {
    return ` style="height: ${normalizedValue}; width: auto;"`;
  }
}

/**
 * Convert SVG to a base64 data URI
 */
function svgToDataUri(svg: string): string {
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Preprocess Mermaid code blocks to inline SVGs
 *
 * Requires a DiagramRenderer implementation (browser or CLI based)
 */
export async function preprocessMermaid(
  markdown: string,
  renderer: DiagramRenderer,
): Promise<string> {
  // Reset regex state
  MERMAID_REGEX.lastIndex = 0;

  const rawMatches = [...markdown.matchAll(MERMAID_REGEX)];

  if (rawMatches.length === 0) {
    return markdown;
  }

  const matches: MermaidBlockMatch[] = rawMatches
    .filter((match) => match.index !== undefined)
    .map((match) => ({
      fullMatch: match[0],
      index: match.index as number,
      sizeType: (match[1] === 'w' || match[1] === 'h') ? match[1] : null,
      sizeValue: match[2] || null,
      code: match[3],
    }));

  // Render all diagrams in parallel for performance
  const svgs = await Promise.all(matches.map((m) => renderer.render(m.code)));

  // Build result by replacing each match (reverse order to preserve indices)
  let result = markdown;
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const svg = svgs[i];

    // Convert SVG to base64 data URI and use <img> tag
    const dataUri = svgToDataUri(svg);
    const style = generateImgStyle(match.sizeType, match.sizeValue);
    const replacement = `<img src="${dataUri}" alt="Mermaid diagram"${style}>`;

    result =
      result.substring(0, match.index) +
      replacement +
      result.substring(match.index + match.fullMatch.length);
  }

  return result;
}

/**
 * PlantUML code block regex
 * Examples: ```plantuml, ```puml
 */
const PLANTUML_REGEX = /```(?:plantuml|puml)\n([\s\S]*?)```/g;

/**
 * Preprocess PlantUML code blocks to inline SVGs
 *
 * Requires a DiagramRenderer implementation
 */
export async function preprocessPlantUML(
  markdown: string,
  renderer: DiagramRenderer,
): Promise<string> {
  // Reset regex state
  PLANTUML_REGEX.lastIndex = 0;

  const matches = [...markdown.matchAll(PLANTUML_REGEX)];

  if (matches.length === 0) {
    return markdown;
  }

  // Render all diagrams in parallel
  const svgs = await Promise.all(matches.map((m) => renderer.render(m[1])));

  // Build result by replacing each match (reverse order to preserve indices)
  let result = markdown;
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const svg = svgs[i];
    const matchIndex = match.index;
    if (matchIndex === undefined) continue;

    const dataUri = svgToDataUri(svg);
    const replacement = `<img src="${dataUri}" alt="PlantUML diagram">`;

    result =
      result.substring(0, matchIndex) +
      replacement +
      result.substring(matchIndex + match[0].length);
  }

  return result;
}

/**
 * Preprocessor context
 */
export interface PreprocessorContext {
  config: MarpExtendedConfig;
  mermaidRenderer?: DiagramRenderer;
  plantumlRenderer?: DiagramRenderer;
  /** Path resolver for file operations (optional, for embedding) */
  pathResolver?: PathResolver;
  /** Base/root path for resolving relative paths (e.g., vault root, project root) */
  basePath: string;
  /** Directory of the markdown file (relative to basePath) */
  fileDir: string;
}

/**
 * Wikilink conversion callback type
 * Takes a wikilink name (e.g., "image.png") and returns the resolved URL
 */
export type WikilinkResolver = (name: string) => string;

/**
 * Context for preview/render preprocessing
 * Simpler than full PreprocessorContext - used by both preview and export
 */
export interface RenderPreprocessContext {
  /** Enable /// directive shorthand conversion */
  enableDirectives?: boolean;
  /** Enable mermaid diagram rendering */
  enableMermaid?: boolean;
  /** Mermaid renderer (browser or CLI) */
  mermaidRenderer?: DiagramRenderer;
  /** Callback to resolve wikilink paths (platform-specific) */
  wikilinkResolver?: WikilinkResolver;
}

/**
 * Wikilink image regex: ![[name]] or ![[name|alt]]
 */
const WIKILINK_IMAGE_REGEX = /!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;

/**
 * Convert Obsidian-style wikilink images to standard markdown images
 *
 * Syntax: ![[image.png]] or ![[image.png|alt text]]
 * Output: ![alt](resolved-url)
 *
 * @param markdown - Input markdown content
 * @param resolver - Callback to resolve wikilink names to URLs
 */
export function preprocessWikilinks(
  markdown: string,
  resolver: WikilinkResolver,
): string {
  return markdown.replace(WIKILINK_IMAGE_REGEX, (_, name, alt) => {
    const url = resolver(name);
    const altText = alt || name;
    return `![${altText}](${url})`;
  });
}

/**
 * Unified preprocessing pipeline for rendering
 *
 * This is the simplified pipeline used by both preview and export.
 * It handles:
 * 1. Wikilink conversion (if resolver provided)
 * 2. /// directive shorthand (if enabled)
 * 3. Mermaid diagrams (if enabled and renderer provided)
 *
 * For export, additional steps (embedding, PlantUML) are handled
 * by the full `preprocess()` function.
 */
export async function preprocessForRender(
  markdown: string,
  context: RenderPreprocessContext,
): Promise<string> {
  let content = markdown;

  // 1. Convert wikilinks to standard markdown images
  if (context.wikilinkResolver) {
    content = preprocessWikilinks(content, context.wikilinkResolver);
  }

  // 2. /// directive shorthand -> HTML comments
  if (context.enableDirectives) {
    content = preprocessDirectives(content);
  }

  // 3. Mermaid diagrams -> inline SVG/img
  if (context.enableMermaid && context.mermaidRenderer) {
    content = await preprocessMermaid(content, context.mermaidRenderer);
  }

  return content;
}

/**
 * Main preprocessing pipeline
 *
 * Transforms markdown before passing to marp-cli.
 * In safe mode, dangerous preprocessors are skipped entirely.
 */
export async function preprocess(
  markdown: string,
  context: PreprocessorContext,
): Promise<string> {
  let content = markdown;

  // 1. /// directive shorthand -> HTML comments (always safe)
  if (context.config.preprocessor.enableDirectiveShorthand) {
    content = preprocessDirectives(content);
  }

  // 2. Mermaid diagrams -> inline SVG/img (requires unsafe mode)
  if (
    context.config.diagrams.mermaid.enabled &&
    context.mermaidRenderer &&
    context.config.mode === 'unsafe'
  ) {
    content = await preprocessMermaid(content, context.mermaidRenderer);
  }

  // 3. PlantUML diagrams -> inline SVG/img (requires unsafe mode)
  if (
    context.config.diagrams.plantuml.enabled &&
    context.plantumlRenderer &&
    context.config.mode === 'unsafe'
  ) {
    content = await preprocessPlantUML(content, context.plantumlRenderer);
  }

  // Note: Image embedding and iframe embedding are handled separately
  // in the export pipeline (not in this preprocessor)

  return content;
}
