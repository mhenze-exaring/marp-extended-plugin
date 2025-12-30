/**
 * Marp-cli engine wrapper for marp-extended
 *
 * This file is a thin wrapper that loads the markdown-it plugins from main.js
 * and registers them with the marp-cli engine.
 *
 * Usage: npx @marp-team/marp-cli --engine "/path/to/plugin/engine.js" ...
 */

const { genericContainerPlugin, markPlugin } = require('./main.js');

module.exports = ({ marp }) =>
  marp
    .use(genericContainerPlugin)
    .use(markPlugin)
    .use((md) => {
      // Allow data: URLs for images (required for embedded base64 images)
      // https://github.com/markdown-it/markdown-it/issues/447#issuecomment-373408654
      const defaultValidateLink = md.validateLink;
      md.validateLink = (url) =>
        /^data:image\/.*?;/.test(url) || defaultValidateLink(url);
    });
