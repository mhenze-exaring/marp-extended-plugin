/**
 * Marp-cli engine generation
 *
 * This module generates JavaScript code that can be used as a custom marp-cli engine.
 * The engine includes our markdown-it plugins (container, mark).
 *
 * Note: The /// directive plugin is NOT included here - it's handled as a pre-processor
 * because Marp parses directives from raw markdown before markdown-it runs.
 */

// @ts-expect-error - Virtual module generated at build time by esbuild
import { markdownItPluginsCode } from 'markdown-it-plugins-string';

/**
 * Basic marp engine (no custom plugins)
 * Only includes data URL validation for images
 */
const basicMarpEngineJs = `
module.exports = ({ marp }) => marp.use((md) => {
  // https://github.com/markdown-it/markdown-it/issues/447#issuecomment-373408654
  const defaultValidateLink = md.validateLink;
  md.validateLink = url => /^data:image\\/.*?;/.test(url) || defaultValidateLink(url);
})`;

/**
 * Get marp-cli engine JavaScript code
 *
 * @param enableMarkdownItPlugins - Whether to include custom markdown-it plugins
 * @returns JavaScript code string for use as marp-cli engine
 */
export function getEngine(enableMarkdownItPlugins = false): string {
  if (!enableMarkdownItPlugins) {
    return basicMarpEngineJs;
  }

  // Engine with embedded markdown-it plugins (compiled from markdownItPlugins.ts at build time)
  return `
// Embedded markdown-it plugins (compiled from src/core/markdownItPlugins.ts)
${markdownItPluginsCode}

// Note: marp_directive_plugin is NOT used here - it's handled as a pre-processor
// because Marp parses directives from raw markdown before markdown-it runs
module.exports = ({ marp }) => marp
  .use(generic_container_plugin)
  .use(mark_plugin)
  .use((md) => {
    // https://github.com/markdown-it/markdown-it/issues/447#issuecomment-373408654
    const defaultValidateLink = md.validateLink;
    md.validateLink = url => /^data:image\\/.*?;/.test(url) || defaultValidateLink(url);
  })`;
}
