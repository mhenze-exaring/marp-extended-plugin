import { describe, it, expect } from 'vitest';
import {
  parseSpaceSeparatedStyles,
  parseContainerDefinition,
  tokenizePreservingQuotes,
  parseMarpDirective,
  generateMarpComments,
} from './markdownItPlugins';

describe('parseSpaceSeparatedStyles', () => {
  it('parses single property', () => {
    expect(parseSpaceSeparatedStyles('left:240px')).toBe('left: 240px');
  });

  it('parses multiple simple properties', () => {
    expect(parseSpaceSeparatedStyles('left:240px top:90px')).toBe(
      'left: 240px; top: 90px',
    );
  });

  it('handles multi-word values (border)', () => {
    expect(parseSpaceSeparatedStyles('border:1px solid red')).toBe(
      'border: 1px solid red',
    );
  });

  it('handles mixed properties with multi-word values', () => {
    expect(
      parseSpaceSeparatedStyles('left:240px border:1px solid red top:90px'),
    ).toBe('left: 240px; border: 1px solid red; top: 90px');
  });

  it('handles properties with spaces around colon in input', () => {
    expect(parseSpaceSeparatedStyles('left : 240px top : 90px')).toBe(
      'left: 240px; top: 90px',
    );
  });

  it('handles percentage values', () => {
    expect(parseSpaceSeparatedStyles('width:60% height:100%')).toBe(
      'width: 60%; height: 100%',
    );
  });

  it('handles text-align and similar hyphenated properties', () => {
    expect(parseSpaceSeparatedStyles('text-align:center')).toBe(
      'text-align: center',
    );
  });

  it('handles CSS custom properties (variables)', () => {
    expect(parseSpaceSeparatedStyles('--font-scale:0.8')).toBe(
      '--font-scale: 0.8',
    );
  });

  it('handles complex real-world example from presentation', () => {
    expect(
      parseSpaceSeparatedStyles(
        'left:240px border:1px solid red top:90px width:60% text-align:center',
      ),
    ).toBe(
      'left: 240px; border: 1px solid red; top: 90px; width: 60%; text-align: center',
    );
  });

  it('returns empty string for empty input', () => {
    expect(parseSpaceSeparatedStyles('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(parseSpaceSeparatedStyles('   ')).toBe('');
  });

  it('handles multiple spaces between declarations', () => {
    expect(parseSpaceSeparatedStyles('left:240px    top:90px')).toBe(
      'left: 240px; top: 90px',
    );
  });
});

describe('parseContainerDefinition', () => {
  describe('selector parsing', () => {
    it('parses simple class name', () => {
      const result = parseContainerDefinition(' columns');
      expect(result).toEqual({
        tag: 'div',
        className: 'columns',
        id: null,
        style: null,
      });
    });

    it('parses tag.class pattern', () => {
      const result = parseContainerDefinition(' span.highlight');
      expect(result).toEqual({
        tag: 'span',
        className: 'highlight',
        id: null,
        style: null,
      });
    });

    it('parses class#id pattern', () => {
      const result = parseContainerDefinition(' warning#alert1');
      expect(result).toEqual({
        tag: 'div',
        className: 'warning',
        id: 'alert1',
        style: null,
      });
    });

    it('parses tag.class#id pattern', () => {
      const result = parseContainerDefinition(' aside.note#sidebar');
      expect(result).toEqual({
        tag: 'aside',
        className: 'note',
        id: 'sidebar',
        style: null,
      });
    });
  });

  describe('space-separated styles (no semicolons)', () => {
    it('parses single style property', () => {
      const result = parseContainerDefinition(' box left:240px');
      expect(result?.style).toBe('left: 240px');
    });

    it('parses multiple style properties', () => {
      const result = parseContainerDefinition(' box left:240px top:90px');
      expect(result?.style).toBe('left: 240px; top: 90px');
    });

    it('parses multi-word value (border)', () => {
      const result = parseContainerDefinition(' box border:1px solid red');
      expect(result?.style).toBe('border: 1px solid red');
    });

    it('parses complex real-world example', () => {
      const result = parseContainerDefinition(
        ' caption-top left:240px border:1px solid red top:90px width:60% text-align:center',
      );
      expect(result?.className).toBe('caption-top');
      expect(result?.style).toBe(
        'left: 240px; border: 1px solid red; top: 90px; width: 60%; text-align: center',
      );
    });
  });

  describe('literal CSS styles (with semicolons)', () => {
    it('preserves literal CSS when semicolon present', () => {
      const result = parseContainerDefinition(
        ' box left:240px; border: 1px solid red;',
      );
      expect(result?.style).toBe('left:240px; border: 1px solid red;');
    });

    it('handles URLs with colons when using semicolons', () => {
      const result = parseContainerDefinition(
        ' box background:url(https://example.com/img.png);',
      );
      expect(result?.style).toBe('background:url(https://example.com/img.png);');
    });
  });

  describe('multiple classes', () => {
    it('parses multiple space-separated classes', () => {
      const result = parseContainerDefinition(' caption small transparent');
      expect(result).toEqual({
        tag: 'div',
        className: 'caption small transparent',
        id: null,
        style: null,
      });
    });

    it('parses multiple classes with styles', () => {
      const result = parseContainerDefinition(
        ' caption small transparent border:2px width:50%',
      );
      expect(result?.className).toBe('caption small transparent');
      expect(result?.style).toBe('border: 2px; width: 50%');
    });

    it('parses tag.class with additional classes', () => {
      const result = parseContainerDefinition(' aside.note small centered');
      expect(result).toEqual({
        tag: 'aside',
        className: 'note small centered',
        id: null,
        style: null,
      });
    });

    it('parses tag.class#id with additional classes', () => {
      const result = parseContainerDefinition(
        ' aside.note#sidebar small centered',
      );
      expect(result).toEqual({
        tag: 'aside',
        className: 'note small centered',
        id: 'sidebar',
        style: null,
      });
    });

    it('parses multiple classes with multi-word CSS values', () => {
      const result = parseContainerDefinition(
        ' caption small border:1px solid red width:50%',
      );
      expect(result?.className).toBe('caption small');
      expect(result?.style).toBe('border: 1px solid red; width: 50%');
    });

    it('handles hyphenated class names', () => {
      const result = parseContainerDefinition(
        ' caption-top text-center left:100px',
      );
      expect(result?.className).toBe('caption-top text-center');
      expect(result?.style).toBe('left: 100px');
    });
  });

  describe('edge cases', () => {
    it('returns null for empty input', () => {
      expect(parseContainerDefinition('')).toBeNull();
    });

    it('returns null for whitespace-only input', () => {
      expect(parseContainerDefinition('   ')).toBeNull();
    });

    it('returns null when first token is a style (no class)', () => {
      expect(parseContainerDefinition(' left:240px')).toBeNull();
    });
  });
});

describe('tokenizePreservingQuotes', () => {
  it('tokenizes simple input', () => {
    expect(tokenizePreservingQuotes('lead gaia')).toEqual(['lead', 'gaia']);
  });

  it('tokenizes with colons as separate tokens', () => {
    expect(tokenizePreservingQuotes('paginate:skip')).toEqual([
      'paginate',
      ':',
      'skip',
    ]);
  });

  it('preserves double-quoted strings', () => {
    expect(tokenizePreservingQuotes('footer:"hello world"')).toEqual([
      'footer',
      ':',
      '"hello world"',
    ]);
  });

  it('preserves single-quoted strings', () => {
    expect(tokenizePreservingQuotes("footer:'hello world'")).toEqual([
      'footer',
      ':',
      "'hello world'",
    ]);
  });

  it('preserves colons inside quotes', () => {
    expect(tokenizePreservingQuotes('footer:"links : rechts"')).toEqual([
      'footer',
      ':',
      '"links : rechts"',
    ]);
  });

  it('handles mixed classes and directives', () => {
    expect(tokenizePreservingQuotes('lead paginate:skip')).toEqual([
      'lead',
      'paginate',
      ':',
      'skip',
    ]);
  });

  it('handles complex real-world example', () => {
    expect(
      tokenizePreservingQuotes('lead gaia paginate:skip footer:"Text"'),
    ).toEqual(['lead', 'gaia', 'paginate', ':', 'skip', 'footer', ':', '"Text"']);
  });

  it('returns empty array for empty input', () => {
    expect(tokenizePreservingQuotes('')).toEqual([]);
  });

  it('returns empty array for whitespace-only input', () => {
    expect(tokenizePreservingQuotes('   ')).toEqual([]);
  });
});

describe('parseMarpDirective', () => {
  describe('classes only', () => {
    it('parses single class', () => {
      const result = parseMarpDirective('lead');
      expect(result).toEqual({
        classes: ['lead'],
        directives: [],
      });
    });

    it('parses multiple classes', () => {
      const result = parseMarpDirective('lead gaia small');
      expect(result).toEqual({
        classes: ['lead', 'gaia', 'small'],
        directives: [],
      });
    });
  });

  describe('directives only', () => {
    it('parses single directive', () => {
      const result = parseMarpDirective('paginate:skip');
      expect(result).toEqual({
        classes: [],
        directives: [{ key: 'paginate', value: 'skip' }],
      });
    });

    it('parses multiple directives', () => {
      const result = parseMarpDirective('paginate:skip footer:""');
      expect(result).toEqual({
        classes: [],
        directives: [
          { key: 'paginate', value: 'skip' },
          { key: 'footer', value: '""' },
        ],
      });
    });
  });

  describe('mixed classes and directives', () => {
    it('parses classes followed by directive', () => {
      const result = parseMarpDirective('lead paginate:skip');
      expect(result).toEqual({
        classes: ['lead'],
        directives: [{ key: 'paginate', value: 'skip' }],
      });
    });

    it('parses multiple classes followed by multiple directives', () => {
      const result = parseMarpDirective('lead gaia paginate:skip footer:""');
      expect(result).toEqual({
        classes: ['lead', 'gaia'],
        directives: [
          { key: 'paginate', value: 'skip' },
          { key: 'footer', value: '""' },
        ],
      });
    });
  });

  describe('quoted values', () => {
    it('preserves double-quoted value with spaces', () => {
      const result = parseMarpDirective('footer:"Raumschiff BS-CAP"');
      expect(result).toEqual({
        classes: [],
        directives: [{ key: 'footer', value: '"Raumschiff BS-CAP"' }],
      });
    });

    it('preserves quoted value with colons', () => {
      const result = parseMarpDirective('footer:"links : rechts"');
      expect(result).toEqual({
        classes: [],
        directives: [{ key: 'footer', value: '"links : rechts"' }],
      });
    });

    it('handles complex example with classes, directives, and quoted values', () => {
      const result = parseMarpDirective(
        'lead footer:"links : rechts" paginate:skip',
      );
      expect(result).toEqual({
        classes: ['lead'],
        directives: [
          { key: 'footer', value: '"links : rechts"' },
          { key: 'paginate', value: 'skip' },
        ],
      });
    });
  });

  describe('edge cases', () => {
    it('returns null for empty input', () => {
      expect(parseMarpDirective('')).toBeNull();
    });

    it('returns null for whitespace-only input', () => {
      expect(parseMarpDirective('   ')).toBeNull();
    });
  });
});

describe('generateMarpComments', () => {
  it('generates class comment only', () => {
    const result = generateMarpComments({
      classes: ['lead', 'gaia'],
      directives: [],
    });
    expect(result).toBe('<!-- _class: lead gaia -->');
  });

  it('generates directive comment only', () => {
    const result = generateMarpComments({
      classes: [],
      directives: [{ key: 'paginate', value: 'skip' }],
    });
    expect(result).toBe('<!-- _paginate: skip -->');
  });

  it('generates both class and directive comments', () => {
    const result = generateMarpComments({
      classes: ['lead'],
      directives: [{ key: 'paginate', value: 'skip' }],
    });
    expect(result).toBe('<!-- _class: lead -->\n<!-- _paginate: skip -->');
  });

  it('generates multiple directive comments', () => {
    const result = generateMarpComments({
      classes: ['lead', 'gaia'],
      directives: [
        { key: 'paginate', value: 'skip' },
        { key: 'footer', value: '""' },
      ],
    });
    expect(result).toBe(
      '<!-- _class: lead gaia -->\n<!-- _paginate: skip -->\n<!-- _footer: "" -->',
    );
  });

  it('preserves quoted values in output', () => {
    const result = generateMarpComments({
      classes: [],
      directives: [{ key: 'footer', value: '"links : rechts"' }],
    });
    expect(result).toBe('<!-- _footer: "links : rechts" -->');
  });
});
