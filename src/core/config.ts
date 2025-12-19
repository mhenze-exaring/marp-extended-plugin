/**
 * Configuration types for marp-extended
 * Shared between CLI and Obsidian plugin
 */

import { readFileSync, existsSync } from 'fs';

export type MermaidTheme = 'default' | 'dark' | 'forest' | 'neutral' | 'base';

export type MathTypesetting = 'mathjax' | 'katex' | false;

export type ExportFormat = 'html' | 'pdf' | 'pptx';

export type SecurityMode = 'safe' | 'unsafe';

export interface MarpExtendedConfig {
  // Preprocessor options
  preprocessor: {
    enableDirectiveShorthand: boolean; // /// syntax
    enableContainerPlugin: boolean; // ::: syntax
    enableMarkPlugin: boolean; // ==highlight== syntax
  };

  // Diagram rendering
  diagrams: {
    mermaid: {
      enabled: boolean;
      backend: 'browser' | 'cli'; // browser = mermaid.js, cli = mmdc
      cliPath?: string; // Path to mmdc if not in PATH
      theme: MermaidTheme;
    };
    plantuml: {
      enabled: boolean;
      jarPath?: string; // Path to plantuml.jar
      javaPath?: string; // Path to java if not in PATH
    };
  };

  // Embedding options
  embedding: {
    images: boolean; // Embed images as base64 data URLs
    iframes: boolean; // Embed local HTML iframes as data URLs
  };

  // Theme
  themeDir?: string;

  // Export defaults
  export: {
    format: ExportFormat; // Default output format
  };

  // Security mode (CLI only)
  // 'safe': Vanilla marp-cli passthrough, no extended features requiring --html/--allow-local-files
  // 'unsafe': Full extended features enabled (--html, --allow-local-files)
  mode: SecurityMode;

  // marp-cli pass-through (additional args beyond the defaults)
  marpCliArgs?: string[];
}

export const DEFAULT_CONFIG: MarpExtendedConfig = {
  preprocessor: {
    enableDirectiveShorthand: true,
    enableContainerPlugin: true,
    enableMarkPlugin: true,
  },
  diagrams: {
    mermaid: {
      enabled: true,
      backend: 'cli', // CLI default for CLI usage
      theme: 'default',
    },
    plantuml: {
      enabled: false,
    },
  },
  embedding: {
    images: true, // Embed images as base64 for portable output
    iframes: true, // Embed local HTML (e.g., Plotly exports) as data URLs
  },
  export: {
    format: 'html', // HTML is default (most portable, viewable anywhere)
  },
  mode: 'safe', // Safe by default - requires --unsafe for extended features
};

/**
 * Deep merge two objects
 */
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        sourceValue !== undefined &&
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === 'object' &&
        targetValue !== null &&
        !Array.isArray(targetValue)
      ) {
        // Recursively merge nested objects
        result[key] = deepMerge(
          targetValue as object,
          sourceValue as object,
        ) as T[Extract<keyof T, string>];
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }

  return result;
}

/**
 * Load config from file, merging with defaults
 */
export function loadConfig(configPath?: string): MarpExtendedConfig {
  const defaultPaths = [
    'marp-extended.config.json',
    '.marp-extended.json',
    'marp-extended.json',
  ];

  let configFile: string | undefined;

  if (configPath) {
    configFile = configPath;
  } else {
    // Try default paths
    for (const path of defaultPaths) {
      if (existsSync(path)) {
        configFile = path;
        break;
      }
    }
  }

  if (!configFile || !existsSync(configFile)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const content = readFileSync(configFile, 'utf-8');
    const parsed = JSON.parse(content) as Partial<MarpExtendedConfig>;
    return deepMerge(DEFAULT_CONFIG, parsed);
  } catch (e) {
    console.warn(`Warning: Failed to load config from ${configFile}:`, e);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Obsidian plugin settings interface (for reference)
 * This is defined in src/settings.ts
 */
export interface ObsidianMarpSettings {
  // Preview settings
  autoReload: boolean;
  createNewSplitTab: boolean;
  enableSyncPreview: boolean;

  // Theme settings
  themeDir: string;

  // Marp rendering options
  enableHTML: boolean;
  mathTypesetting: MathTypesetting;
  enableMarkdownItPlugins: boolean;

  // Mermaid settings
  enableMermaid: boolean;
  mermaidTheme: MermaidTheme;

  // Export settings
  exportPath: string;
  chromePath: string;
}

/**
 * Convert Obsidian plugin settings to core config format
 * Obsidian always runs in "unsafe" mode (local context, user controls input)
 */
export function fromObsidianSettings(
  settings: ObsidianMarpSettings,
): MarpExtendedConfig {
  return {
    preprocessor: {
      enableDirectiveShorthand: settings.enableMarkdownItPlugins,
      enableContainerPlugin: settings.enableMarkdownItPlugins,
      enableMarkPlugin: settings.enableMarkdownItPlugins,
    },
    diagrams: {
      mermaid: {
        enabled: settings.enableMermaid,
        backend: 'browser', // Obsidian uses browser-based rendering
        theme: settings.mermaidTheme,
      },
      plantuml: {
        enabled: false, // Not yet implemented in Obsidian plugin
      },
    },
    embedding: {
      images: true,
      iframes: true,
    },
    themeDir: settings.themeDir,
    export: {
      format: 'html',
    },
    mode: 'unsafe', // Obsidian always runs in unsafe mode
  };
}
