// @ts-expect-error - Virtual module generated at build time by esbuild
import { markdownItPluginsCode } from 'markdown-it-plugins-string';

// To properly export SVGs as data URLs, see https://github.com/orgs/marp-team/discussions/425
const marpEngineJs = `
module.exports = ({ marp }) => marp.use((md) => {
  // https://github.com/markdown-it/markdown-it/issues/447#issuecomment-373408654
  const defaultValidateLink = md.validateLink;
  md.validateLink = url => /^data:image\\/.*?;/.test(url) || defaultValidateLink(url);
})`;

export function getEngine(enableMarkdownItPlugins = false): string {
  if (!enableMarkdownItPlugins) {
    return marpEngineJs;
  }

  // Engine with embedded markdown-it plugins (compiled from markdownItPlugins.ts at build time)
  return `
// Embedded markdown-it plugins (compiled from src/markdownItPlugins.ts)
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
