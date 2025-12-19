/**
 * Backwards-compatible re-exports from core
 *
 * This file maintains the original API for existing imports.
 * New code should import from './core' or './core/markdownItPlugins' directly.
 */

// Re-export everything from core markdown-it plugins
export {
  parseSpaceSeparatedStyles,
  parseContainerDefinition,
  genericContainerPlugin,
  markPlugin,
} from './core/markdownItPlugins';

// Re-export preprocessor functions (these were originally in this file)
export {
  tokenizePreservingQuotes,
  parseMarpDirective,
  generateMarpComments,
  type MarpDirectiveResult,
} from './core/preprocessor';

// Legacy containerPlugin export (kept for backwards compatibility)
// The original markdown-it-container plugin - now use genericContainerPlugin instead
import type MarkdownIt from 'markdown-it';

/**
 * @deprecated Use genericContainerPlugin instead
 * Original markdown-it-container plugin for named containers
 */
export function containerPlugin(
  md: MarkdownIt,
  name: string,
  options?: {
    marker?: string;
    validate?: (params: string, markup: string) => boolean;
    render?: (
      tokens: MarkdownIt.Token[],
      idx: number,
      options: MarkdownIt.Options,
      env: unknown,
      slf: MarkdownIt.Renderer,
    ) => string;
  },
): void {
  function validateDefault(params: string): boolean {
    return params.trim().split(' ', 2)[0] === name;
  }

  function renderDefault(
    tokens: MarkdownIt.Token[],
    idx: number,
    _options: MarkdownIt.Options,
    env: unknown,
    slf: MarkdownIt.Renderer,
  ): string {
    if (tokens[idx].nesting === 1) {
      tokens[idx].attrJoin('class', name);
    }
    return slf.renderToken(tokens, idx, _options);
  }

  options = options || {};
  const min_markers = 3;
  const marker_str = options.marker || ':';
  const marker_char = marker_str.charCodeAt(0);
  const marker_len = marker_str.length;
  const validate = options.validate || validateDefault;
  const render = options.render || renderDefault;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function container(
    state: any,
    startLine: number,
    endLine: number,
    silent: boolean,
  ): boolean {
    let pos;
    let auto_closed = false;
    let start = state.bMarks[startLine] + state.tShift[startLine];
    let max = state.eMarks[startLine];

    if (marker_char !== state.src.charCodeAt(start)) {
      return false;
    }

    for (pos = start + 1; pos <= max; pos++) {
      if (marker_str[(pos - start) % marker_len] !== state.src[pos]) {
        break;
      }
    }

    const marker_count = Math.floor((pos - start) / marker_len);
    if (marker_count < min_markers) {
      return false;
    }

    pos -= (pos - start) % marker_len;
    const markup = state.src.slice(start, pos);
    const params = state.src.slice(pos, max);

    if (!validate(params, markup)) {
      return false;
    }

    if (silent) {
      return true;
    }

    let nextLine = startLine;
    for (;;) {
      nextLine++;
      if (nextLine >= endLine) {
        break;
      }

      start = state.bMarks[nextLine] + state.tShift[nextLine];
      max = state.eMarks[nextLine];

      if (start < max && state.sCount[nextLine] < state.blkIndent) {
        break;
      }

      if (marker_char !== state.src.charCodeAt(start)) {
        continue;
      }

      if (state.sCount[nextLine] - state.blkIndent >= 4) {
        continue;
      }

      for (pos = start + 1; pos <= max; pos++) {
        if (marker_str[(pos - start) % marker_len] !== state.src[pos]) {
          break;
        }
      }

      if (Math.floor((pos - start) / marker_len) < marker_count) {
        continue;
      }

      pos -= (pos - start) % marker_len;
      pos = state.skipSpaces(pos);

      if (pos < max) {
        continue;
      }

      auto_closed = true;
      break;
    }

    const old_parent = state.parentType;
    const old_line_max = state.lineMax;
    state.parentType = 'container';
    state.lineMax = nextLine;

    const token_o = state.push('container_' + name + '_open', 'div', 1);
    token_o.markup = markup;
    token_o.block = true;
    token_o.info = params;
    token_o.map = [startLine, nextLine];

    state.md.block.tokenize(state, startLine + 1, nextLine);

    const token_c = state.push('container_' + name + '_close', 'div', -1);
    token_c.markup = state.src.slice(start, pos);
    token_c.block = true;

    state.parentType = old_parent;
    state.lineMax = old_line_max;
    state.line = nextLine + (auto_closed ? 1 : 0);

    return true;
  }

  md.block.ruler.before('fence', 'container_' + name, container, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });
  md.renderer.rules['container_' + name + '_open'] = render;
  md.renderer.rules['container_' + name + '_close'] = render;
}

/**
 * Marp directive plugin for markdown-it
 * Converts /// shorthand syntax to Marp HTML comment directives
 *
 * Note: This is kept for backwards compatibility but is NOT recommended.
 * The preprocessor approach (preprocessDirectives) is more reliable because
 * Marp parses directives from raw markdown before markdown-it runs.
 */
export function marpDirectivePlugin(md: MarkdownIt): void {
  const { parseMarpDirective, generateMarpComments } = require('./core/preprocessor');
  const min_markers = 3;
  const marker_char = 0x2f; // '/'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function marpDirective(
    state: any,
    startLine: number,
    _endLine: number,
    silent: boolean,
  ): boolean {
    let pos;
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];

    if (marker_char !== state.src.charCodeAt(start)) {
      return false;
    }

    for (pos = start + 1; pos < max; pos++) {
      if (state.src.charCodeAt(pos) !== marker_char) {
        break;
      }
    }

    const marker_count = pos - start;
    if (marker_count < min_markers) {
      return false;
    }

    const params = state.src.slice(pos, max).trim();

    const result = parseMarpDirective(params);
    if (!result) {
      return false;
    }

    if (silent) {
      return true;
    }

    const htmlContent = generateMarpComments(result);

    const token = state.push('html_block', '', 0);
    token.content = htmlContent + '\n';
    token.map = [startLine, startLine + 1];

    state.line = startLine + 1;

    return true;
  }

  md.block.ruler.before('fence', 'marp_directive', marpDirective, {
    alt: ['paragraph', 'reference', 'blockquote'],
  });
}
