/**
 * Type declaration for markdown-it-mark
 *
 * This plugin adds support for ==marked text== syntax in markdown-it.
 */
declare module 'markdown-it-mark' {
  import type MarkdownIt from 'markdown-it';

  const markPlugin: MarkdownIt.PluginSimple;
  export default markPlugin;
}
