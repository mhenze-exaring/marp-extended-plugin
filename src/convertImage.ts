import { access, readFile } from 'fs/promises';
import { FileSystemAdapter, requestUrl } from 'obsidian';
import { join, normalize } from 'path';
import mimes from 'mime/lite';

const prefix = 'app://local';

async function readFileAsBase64(path: string): Promise<string | null> {
  try {
    return addMimeToBase64Data(
      path,
      await readFile(path, {
        encoding: 'base64',
      }),
    );
  } catch {
    return null;
  }
}

async function convertPathToLocalLink(
  path: string,
  fileDir: string = '',
): Promise<string | null> {
  // Skip URLs and data URIs
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('data:') ||
    path.startsWith('app://')
  ) {
    return null;
  }

  // Construct vault-relative path from the file's directory
  const vaultRelativePath = fileDir ? `${fileDir}/${path}` : path;

  // First try with the vault-relative path
  if (await app.vault.adapter.exists(vaultRelativePath)) {
    return app.vault.adapter.getResourcePath(vaultRelativePath);
  }

  // Fall back to checking if it's already a full vault path
  if (await app.vault.adapter.exists(path)) {
    return app.vault.adapter.getResourcePath(path);
  }

  // Try as absolute filesystem path
  try {
    await access(path);
    return `${prefix}/${normalize(path)}`;
  } catch {
    return null;
  }
}

export async function convertToBase64(
  path: string,
  fileDir: string = '',
): Promise<string | null> {
  const mime = mimes.getType(path);
  if (!mime) return null;

  // Construct vault-relative path
  const vaultRelativePath = fileDir ? `${fileDir}/${path}` : path;

  if (await app.vault.adapter.exists(vaultRelativePath)) {
    const basePath = (app.vault.adapter as FileSystemAdapter).getBasePath();
    return readFileAsBase64(normalize(join(basePath, vaultRelativePath)));
  }

  // Fall back to direct path
  if (await app.vault.adapter.exists(path)) {
    const basePath = (app.vault.adapter as FileSystemAdapter).getBasePath();
    return readFileAsBase64(normalize(join(basePath, path)));
  }

  try {
    await access(path);
    return readFileAsBase64(normalize(path));
  } catch {
    /* empty */
  }

  try {
    if (path.startsWith(prefix)) {
      // remove `app://local`
      const newPath = path.slice(prefix.length);
      await access(newPath);
      return readFileAsBase64(normalize(newPath));
    }
  } catch {
    /* empty */
  }

  // try to get image from web
  return urlToBase64(path);
}

async function urlToBase64(url: string): Promise<string | null> {
  try {
    return addMimeToBase64Data(
      url,
      Buffer.from(await requestUrl(url).arrayBuffer).toString('base64'),
    );
  } catch {
    return null;
  }
}

function addMimeToBase64Data(path: string, data: string): string | null {
  const mime = mimes.getType(path);
  if (!mime) return null;
  return `data:${mime};base64,${data}`;
}

// Convert absolute filesystem path to app:// URL
function convertAbsolutePathToAppUrl(path: string): string | null {
  if (path.startsWith('/')) {
    return `${prefix}${path}`;
  }
  return null;
}

export async function convertHtml(
  html: string,
  fileDir: string = '',
): Promise<Document> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Process img elements
  const images = doc.getElementsByTagName('img');
  for (let i = 0; i < images.length; i++) {
    const el = images[i];
    const src = el.getAttribute('src');
    if (!src) continue;
    const link = await convertPathToLocalLink(decodeURI(src), fileDir);
    if (!link) continue;
    el.setAttribute('src', link.replace(/\\/g, '/'));
  }

  // Process iframe elements (for embedded local HTML files)
  const iframes = doc.getElementsByTagName('iframe');
  for (let i = 0; i < iframes.length; i++) {
    const el = iframes[i];
    const src = el.getAttribute('src');
    if (!src) continue;

    // Skip already absolute URLs
    if (
      src.startsWith('http://') ||
      src.startsWith('https://') ||
      src.startsWith('data:') ||
      src.startsWith('app://')
    ) {
      continue;
    }

    // Try absolute filesystem path first
    const absoluteLink = convertAbsolutePathToAppUrl(src);
    if (absoluteLink) {
      el.setAttribute('src', absoluteLink);
      continue;
    }

    // Try vault-relative path
    const link = await convertPathToLocalLink(decodeURI(src), fileDir);
    if (link) {
      el.setAttribute('src', link.replace(/\\/g, '/'));
    }
  }
  // Process background-image styles on various elements (figure, section, div)
  // Marp can render background images in different container elements
  const bgImageReg = /background(?:-image)?:\s*url\(["']?([^"')]+)["']?\)/g;

  const processElementsWithBackgroundImages = async (
    elements: HTMLCollectionOf<Element>,
  ) => {
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const style = el.getAttribute('style');
      if (!style || !style.includes('url(')) continue;

      let newStyle = style;
      let match;
      bgImageReg.lastIndex = 0;

      while ((match = bgImageReg.exec(style)) !== null) {
        const originalUrl = match[1];
        const converted = await convertPathToLocalLink(
          decodeURI(originalUrl),
          fileDir,
        );
        if (converted) {
          newStyle = newStyle.replace(
            originalUrl,
            converted.replace(/\\/g, '/'),
          );
        }
      }

      if (newStyle !== style) {
        el.setAttribute('style', newStyle);
      }
    }
  };

  // Process figure elements (Marp background images)
  await processElementsWithBackgroundImages(doc.getElementsByTagName('figure'));

  // Process section elements (Marp slide backgrounds)
  await processElementsWithBackgroundImages(
    doc.getElementsByTagName('section'),
  );

  // Process div elements (potential wrapper elements)
  await processElementsWithBackgroundImages(doc.getElementsByTagName('div'));

  return doc;
}
