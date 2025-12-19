import { Marp } from '@marp-team/marp-core';

export interface MarpRenderOptions {
  html?: boolean;
}

// Default instance for theme loading
export const marp = new Marp();

export const marpThemeSet = marp.themeSet.default;

/**
 * Create a Marp instance with specific options.
 * This is needed because Marp's html option must be set at construction time.
 */
export function createMarpInstance(options: MarpRenderOptions = {}): Marp {
  const instance = new Marp({
    html: options.html ?? false,
  });

  // Copy themes from the default instance
  const themes = Array.from(marp.themeSet.themes);
  for (const theme of themes) {
    if (theme !== marp.themeSet.default) {
      try {
        instance.themeSet.add(theme.css);
      } catch {
        // Theme may already exist
      }
    }
  }

  return instance;
}
