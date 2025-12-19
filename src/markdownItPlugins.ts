// Embedded markdown-it plugins for use in both preview and export
// These are self-contained copies to avoid npm dependency issues with marp-cli export

import type MarkdownIt from 'markdown-it';

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
 * markdown-it-container plugin (v4.0.0)
 * Creates block-level custom containers
 * Source: https://github.com/markdown-it/markdown-it-container
 * License: MIT
 *
 * Usage: ::: container
 *        content
 *        :::
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
  function container(state: any, startLine: number, endLine: number, silent: boolean): boolean {
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
 * Parse container definition string
 * Syntax: [tag.]class[#id][ additional-classes][ style-declarations]
 *
 * Multiple classes: Tokens without ":" before the first style are additional classes
 * Style declarations support two formats:
 * 1. Space-separated shorthand (no semicolons): left:240px top:90px border:1px solid red
 * 2. CSS-literal (with semicolons): left:240px; border: 1px solid red;
 *
 * Use semicolons when values contain colons (e.g., URLs like background:url(https://...))
 *
 * Examples:
 * - "columns" → { tag: 'div', class: 'columns', id: null, style: null }
 * - "span.highlight" → { tag: 'span', class: 'highlight', id: null, style: null }
 * - "warning#alert1" → { tag: 'div', class: 'warning', id: 'alert1', style: null }
 * - "caption small transparent" → { ..., class: 'caption small transparent', style: null }
 * - "caption small border:2px" → { ..., class: 'caption small', style: 'border: 2px' }
 * - "box left:240px top:90px" → { ..., style: 'left: 240px; top: 90px' }
 * - "aside.note#sidebar --font-scale: 0.8;" → { ..., style: '--font-scale: 0.8;' } (literal)
 */
interface ContainerDefinition {
  tag: string;
  className: string | null;
  id: string | null;
  style: string | null;
}

/**
 * Parse space-separated CSS style declarations (without semicolons)
 *
 * Normalizes colons, tokenizes on whitespace, and reconstructs valid CSS.
 * Properties are detected by the pattern: token followed by ":"
 *
 * @example
 * parseSpaceSeparatedStyles("left:240px top:90px")
 * // => "left: 240px; top: 90px"
 *
 * parseSpaceSeparatedStyles("border:1px solid red")
 * // => "border: 1px solid red"
 *
 * parseSpaceSeparatedStyles("left:240px border:1px solid red top:90px")
 * // => "left: 240px; border: 1px solid red; top: 90px"
 */
export function parseSpaceSeparatedStyles(input: string): string {
  // 1. Normalize: ensure spaces around colons
  const normalized = input.replace(/:/g, ' : ');

  // 2. Tokenize: split on whitespace, filter empty strings
  const tokens = normalized.split(/\s+/).filter((t) => t.length > 0);

  if (tokens.length === 0) return '';

  // 3. Reconstruct: collect property-value pairs
  const properties: Array<{ prop: string; values: string[] }> = [];
  let current: { prop: string; values: string[] } | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === ':') {
      if (current === null && i > 0) {
        // First property found - previous token is the property name
        current = { prop: tokens[i - 1], values: [] };
      } else if (current !== null && current.values.length > 0) {
        // New property begins - last value token is actually the new property name
        const newProp: string = current.values.pop()!;
        properties.push(current);
        current = { prop: newProp, values: [] };
      }
    } else if (current !== null) {
      // Accumulate value tokens
      current.values.push(token);
    }
  }

  // Finalize last property
  if (current !== null && current.values.length > 0) {
    properties.push(current);
  }

  // 4. Generate CSS
  return properties.map((p) => `${p.prop}: ${p.values.join(' ')}`).join('; ');
}

export function parseContainerDefinition(
  params: string,
): ContainerDefinition | null {
  const trimmed = params.trim();
  if (!trimmed) return null;

  // Tokenize entire input
  const tokens = trimmed.split(/\s+/);

  // Find first token containing ":" - this marks start of styles
  const styleStartIndex = tokens.findIndex((t) => t.includes(':'));

  let selectorTokens: string[];
  let stylePart: string | null = null;

  if (styleStartIndex === -1) {
    // No styles - all tokens are selector/classes
    selectorTokens = tokens;
  } else if (styleStartIndex === 0) {
    // First token is already a style - need at least one class
    return null;
  } else {
    // Tokens before styleStartIndex are selector/classes
    selectorTokens = tokens.slice(0, styleStartIndex);
    const rawStyle = tokens.slice(styleStartIndex).join(' ');

    // If semicolon present: use as literal CSS (allows colons in values like URLs)
    // Otherwise: parse space-separated shorthand syntax
    stylePart = rawStyle.includes(';')
      ? rawStyle
      : parseSpaceSeparatedStyles(rawStyle);
  }

  // First token is the primary selector (tag.class#id)
  // Remaining tokens are additional classes
  const primarySelector = selectorTokens[0];
  const additionalClasses = selectorTokens.slice(1);

  // Parse primary selector: [tag.]class[#id]
  let tag = 'div';
  let className: string | null = null;
  let id: string | null = null;
  let selectorPart = primarySelector;

  // Check for id (#)
  const hashIndex = selectorPart.indexOf('#');
  if (hashIndex !== -1) {
    id = selectorPart.slice(hashIndex + 1);
    selectorPart = selectorPart.slice(0, hashIndex);
  }

  // Check for tag.class pattern
  const dotIndex = selectorPart.indexOf('.');
  if (dotIndex !== -1) {
    tag = selectorPart.slice(0, dotIndex) || 'div';
    className = selectorPart.slice(dotIndex + 1);
  } else {
    // No dot - entire thing is the class name
    className = selectorPart || null;
  }

  // Append additional classes
  if (additionalClasses.length > 0) {
    className = className
      ? `${className} ${additionalClasses.join(' ')}`
      : additionalClasses.join(' ');
  }

  if (!className && !id && !stylePart) {
    return null;
  }

  return { tag, className, id, style: stylePart };
}

/**
 * Generic container plugin for markdown-it
 * Creates block-level custom containers with flexible syntax
 *
 * Syntax: ::: [tag.]class[#id][ additional-classes][ style-declarations]
 *         content
 *         :::
 *
 * Multiple classes: Tokens without ":" are treated as additional CSS classes
 * Style declarations support two formats:
 * - Space-separated shorthand: ::: box left:240px border:1px solid red top:90px
 * - CSS-literal (with semicolons): ::: box left:240px; border: 1px solid red;
 *
 * Use semicolons when values contain colons (e.g., URLs)
 *
 * Examples:
 * - ::: columns
 * - ::: span.highlight
 * - ::: warning#alert1
 * - ::: caption small transparent
 * - ::: caption small border:2px width:50%
 * - ::: box left:240px top:90px width:60%
 * - ::: aside.note#sidebar background:url(https://...);
 */
export function genericContainerPlugin(md: MarkdownIt): void {
  const min_markers = 3;
  const marker_str = ':';
  const marker_char = marker_str.charCodeAt(0);
  const marker_len = marker_str.length;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function container(state: any, startLine: number, endLine: number, silent: boolean): boolean {
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

    // Parse the container definition
    const definition = parseContainerDefinition(params);
    if (!definition) {
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

    // Create opening token with parsed attributes
    const token_o = state.push('generic_container_open', definition.tag, 1);
    token_o.markup = markup;
    token_o.block = true;
    token_o.info = params;
    token_o.map = [startLine, nextLine];

    // Store definition for renderer
    token_o.meta = definition;

    state.md.block.tokenize(state, startLine + 1, nextLine);

    const token_c = state.push('generic_container_close', definition.tag, -1);
    token_c.markup = state.src.slice(start, pos);
    token_c.block = true;

    state.parentType = old_parent;
    state.lineMax = old_line_max;
    state.line = nextLine + (auto_closed ? 1 : 0);

    return true;
  }

  // Renderer for opening tag
  md.renderer.rules['generic_container_open'] = function (
    tokens: MarkdownIt.Token[],
    idx: number,
  ): string {
    const token = tokens[idx];
    const def = token.meta as ContainerDefinition;

    let attrs = '';
    if (def.className) {
      attrs += ` class="${def.className}"`;
    }
    if (def.id) {
      attrs += ` id="${def.id}"`;
    }
    if (def.style) {
      attrs += ` style="${def.style}"`;
    }

    return `<${def.tag}${attrs}>\n`;
  };

  // Renderer for closing tag
  md.renderer.rules['generic_container_close'] = function (
    tokens: MarkdownIt.Token[],
    idx: number,
  ): string {
    // Find the corresponding opening token to get the tag
    let level = 1;
    for (let i = idx - 1; i >= 0; i--) {
      if (tokens[i].type === 'generic_container_close') {
        level++;
      } else if (tokens[i].type === 'generic_container_open') {
        level--;
        if (level === 0) {
          const def = tokens[i].meta as ContainerDefinition;
          return `</${def.tag}>\n`;
        }
      }
    }
    return '</div>\n';
  };

  md.block.ruler.before('fence', 'generic_container', container, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });
}

/**
 * markdown-it-mark plugin (v4.0.0)
 * Adds <mark> tag support for ==highlighted text==
 * Source: https://github.com/markdown-it/markdown-it-mark
 * License: MIT
 *
 * Usage: ==highlighted text==
 */
export function markPlugin(md: MarkdownIt): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function tokenize(state: any, silent: boolean): boolean {
    const start = state.pos;
    const marker = state.src.charCodeAt(start);

    if (silent) {
      return false;
    }

    if (marker !== 0x3d /* = */) {
      return false;
    }

    const scanned = state.scanDelims(state.pos, true);
    let len = scanned.length;
    const ch = String.fromCharCode(marker);

    if (len < 2) {
      return false;
    }

    if (len % 2) {
      const token = state.push('text', '', 0);
      token.content = ch;
      len--;
    }

    for (let i = 0; i < len; i += 2) {
      const token = state.push('text', '', 0);
      token.content = ch + ch;

      if (!scanned.can_open && !scanned.can_close) {
        continue;
      }

      state.delimiters.push({
        marker,
        length: 0,
        jump: i / 2,
        token: state.tokens.length - 1,
        end: -1,
        open: scanned.can_open,
        close: scanned.can_close,
      });
    }

    state.pos += scanned.length;
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function postProcess(state: any, delimiters: any[]): void {
    const loneMarkers: number[] = [];
    const max = delimiters.length;

    for (let i = 0; i < max; i++) {
      const startDelim = delimiters[i];

      if (startDelim.marker !== 0x3d /* = */) {
        continue;
      }

      if (startDelim.end === -1) {
        continue;
      }

      const endDelim = delimiters[startDelim.end];

      const token_o = state.tokens[startDelim.token];
      token_o.type = 'mark_open';
      token_o.tag = 'mark';
      token_o.nesting = 1;
      token_o.markup = '==';
      token_o.content = '';

      const token_c = state.tokens[endDelim.token];
      token_c.type = 'mark_close';
      token_c.tag = 'mark';
      token_c.nesting = -1;
      token_c.markup = '==';
      token_c.content = '';

      if (
        state.tokens[endDelim.token - 1].type === 'text' &&
        state.tokens[endDelim.token - 1].content === '='
      ) {
        loneMarkers.push(endDelim.token - 1);
      }
    }

    while (loneMarkers.length) {
      const i = loneMarkers.pop()!;
      let j = i + 1;

      while (j < state.tokens.length && state.tokens[j].type === 'mark_close') {
        j++;
      }

      j--;

      if (i !== j) {
        const token = state.tokens[j];
        state.tokens[j] = state.tokens[i];
        state.tokens[i] = token;
      }
    }
  }

  md.inline.ruler.before('emphasis', 'mark', tokenize);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  md.inline.ruler2.before('emphasis', 'mark', function (state: any) {
    const tokens_meta = state.tokens_meta;
    const max = (state.tokens_meta || []).length;

    postProcess(state, state.delimiters);

    for (let curr = 0; curr < max; curr++) {
      if (tokens_meta[curr] && tokens_meta[curr].delimiters) {
        postProcess(state, tokens_meta[curr].delimiters);
      }
    }
  });
}

/**
 * Marp directive plugin for markdown-it
 * Converts /// shorthand syntax to Marp HTML comment directives
 *
 * Syntax: /// [classes] [key:value directives]
 *
 * Classes: Tokens without ":" before the first directive
 * Directives: key:value pairs (use quotes for values with spaces/colons)
 *
 * Examples:
 * - /// lead                        → <!-- _class: lead -->
 * - /// lead gaia                   → <!-- _class: lead gaia -->
 * - /// paginate:skip               → <!-- _paginate: skip -->
 * - /// lead paginate:skip          → <!-- _class: lead -->\n<!-- _paginate: skip -->
 * - /// footer:"Text with : colon"  → <!-- _footer: "Text with : colon" -->
 */
export function marpDirectivePlugin(md: MarkdownIt): void {
  const min_markers = 3;
  const marker_char = 0x2f; // '/'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function marpDirective(
    state: any,
    startLine: number,
    endLine: number,
    silent: boolean,
  ): boolean {
    let pos;
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];

    // Check if line starts with '/'
    if (marker_char !== state.src.charCodeAt(start)) {
      return false;
    }

    // Count consecutive '/' characters
    for (pos = start + 1; pos < max; pos++) {
      if (state.src.charCodeAt(pos) !== marker_char) {
        break;
      }
    }

    const marker_count = pos - start;
    if (marker_count < min_markers) {
      return false;
    }

    // Get the rest of the line after the markers
    const params = state.src.slice(pos, max).trim();

    // Parse the directive
    const result = parseMarpDirective(params);
    if (!result) {
      return false;
    }

    if (silent) {
      return true;
    }

    // Generate HTML comments
    const htmlContent = generateMarpComments(result);

    // Create HTML block token
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
