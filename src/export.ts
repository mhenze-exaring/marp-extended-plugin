import { exec } from 'child_process';
import { access, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { Notice, TFile } from 'obsidian';
import { convertToBase64 } from './convertImage';
import { join, normalize } from 'path';
import fixPath from 'fix-path';
import { getEngine } from './engine';
import { MermaidCacheManager } from './mermaidCache';
import { parseMarpDirective, generateMarpComments } from './markdownItPlugins';

const imgPathReg = /!\[[^\]]*\]\(([^)]+)\)/g;

// Regex to match iframe src attributes with local file paths
const iframeSrcReg = /<iframe([^>]*)\ssrc="([^"]+)"([^>]*)>/gi;

/**
 * Convert a local HTML file to a data URL for embedding in iframes.
 * Only works for self-contained HTML files (no external dependencies).
 */
async function convertHtmlFileToDataUrl(
  filePath: string,
): Promise<string | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const base64 = Buffer.from(content).toString('base64');
    return `data:text/html;base64,${base64}`;
  } catch (e) {
    console.error(`Failed to read HTML file for embedding: ${filePath}`, e);
    return null;
  }
}

/**
 * Check if a path is a local filesystem path (not a URL).
 */
function isLocalPath(src: string): boolean {
  return (
    !src.startsWith('http://') &&
    !src.startsWith('https://') &&
    !src.startsWith('data:') &&
    !src.startsWith('app://')
  );
}

/**
 * Convert all iframe src attributes pointing to local HTML files to data URLs.
 */
async function embedLocalIframes(
  content: string,
  basePath: string,
  fileDir: string,
): Promise<string> {
  const matches = [...content.matchAll(iframeSrcReg)];
  if (matches.length === 0) return content;

  let result = content;

  for (const match of matches) {
    const [fullMatch, before, src, after] = match;

    if (!isLocalPath(src)) continue;

    // Resolve the path
    let resolvedPath: string;
    if (src.startsWith('/')) {
      // Absolute filesystem path
      resolvedPath = src;
    } else {
      // Relative path - resolve from file's directory
      resolvedPath = normalize(join(basePath, fileDir, src));
    }

    // Check if file exists and convert to data URL
    try {
      await access(resolvedPath);
      const dataUrl = await convertHtmlFileToDataUrl(resolvedPath);
      if (dataUrl) {
        result = result.replace(
          fullMatch,
          `<iframe${before} src="${dataUrl}"${after}>`,
        );
      }
    } catch {
      console.warn(`Iframe source file not found: ${resolvedPath}`);
    }
  }

  return result;
}

export interface ExportOptions {
  enableMarkdownItPlugins?: boolean;
  enableMermaid?: boolean;
  mermaidCache?: MermaidCacheManager;
}

export async function exportSlide(
  file: TFile,
  ext: 'html' | 'pdf' | 'pptx',
  basePath: string,
  themeDir: string,
  options: ExportOptions = {},
) {
  const { enableMarkdownItPlugins = false, enableMermaid = false, mermaidCache } = options;
  const exportDir = join(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    process.env[process.platform == 'win32' ? 'USERPROFILE' : 'HOME']!,
    'Downloads',
  );
  if (!file) return;
  const filePath = normalize(join(basePath, file.path));
  const fileDir = file.parent?.path || '';
  const tmpPath = join(exportDir, `${file.basename}.tmp`);
  const tmpEnginePath = join(exportDir, 'engine.js');

  let fileContent = await readFile(filePath, 'utf-8');

  // Preprocess /// directive shorthand to Marp HTML comments
  if (enableMarkdownItPlugins) {
    const directiveRegex = /^\/\/\/\s+(.+)$/gm;
    fileContent = fileContent.replace(directiveRegex, (_, params) => {
      const result = parseMarpDirective(params);
      if (result) {
        return generateMarpComments(result);
      }
      return `/// ${params}`; // Leave unchanged if parsing fails
    });
  }

  // Preprocess Mermaid diagrams to inline SVGs
  if (enableMermaid && mermaidCache) {
    fileContent = await mermaidCache.preprocessMarkdown(fileContent);
  }

  // Embed local iframe sources as data URLs (for self-contained HTML files like Plotly exports)
  fileContent = await embedLocalIframes(fileContent, basePath, fileDir);

  // Convert images to base64
  const srcBase64TupleList = await Promise.all(
    [...new Set([...fileContent.matchAll(imgPathReg)].map(v => v[1]))].map(
      async v => [v, await convertToBase64(v, fileDir)] as const,
    ),
  );

  for (const [src, base64] of srcBase64TupleList) {
    fileContent = fileContent.replace(
      new RegExp(
        String.raw`(!\[[^\]]*\])\(${src.replace(/\\/g, '\\\\')}\)`,
        'g',
      ),
      `$1(${base64})`,
    );
  }

  await mkdir(exportDir, { recursive: true });
  try {
    await writeFile(tmpPath, fileContent);
    await writeFile(tmpEnginePath, getEngine(enableMarkdownItPlugins));
  } catch (e) {
    console.error(e);
  }

  // Build marp-cli command with appropriate flags
  const baseFlags = [
    'npx -y @marp-team/marp-cli@latest',
    '--bespoke.transition',
    '--stdin false',
    '--allow-local-files',
  ];

  // Enable HTML when content requires it (Mermaid SVGs, iframes, or other HTML elements)
  const needsHtml =
    enableMermaid || fileContent.includes('<iframe') || fileContent.includes('<div');
  if (needsHtml) {
    baseFlags.push('--html');
  }

  let cmd: string;
  try {
    await access(themeDir);
    cmd = [
      ...baseFlags,
      `--theme-set "${themeDir}"`,
      `-o "${join(exportDir, file.basename)}.${ext}"`,
      `--engine ${tmpEnginePath}`,
      `-- "${tmpPath}"`,
    ].join(' ');
  } catch (e) {
    cmd = [
      ...baseFlags,
      `-o "${join(exportDir, file.basename)}.${ext}"`,
      `--engine ${tmpEnginePath}`,
      `-- "${tmpPath}"`,
    ].join(' ');
  }

  fixPath();
  new Notice(`Exporting "${file.basename}.${ext}" to "${exportDir}"`, 20000);
  exec(cmd, () => {
    new Notice('Exported successfully', 20000);
    rm(tmpPath);
    rm(tmpEnginePath);
  });
}
