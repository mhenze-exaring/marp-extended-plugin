#!/usr/bin/env node
/**
 * marp-extended CLI
 *
 * Marp CLI with extended syntax support including:
 * - /// directive shorthand
 * - ::: container plugin
 * - ==highlight== mark plugin
 * - Mermaid/PlantUML diagram rendering
 * - Image/iframe embedding
 */

import { program } from 'commander';
import { readFile, writeFile, unlink } from 'fs/promises';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { join, dirname, basename, extname, resolve } from 'path';
import {
  loadConfig,
  type MarpExtendedConfig,
  type ExportFormat,
} from '../core/config';
import { preprocess, type PreprocessorContext } from '../core/preprocessor';
import { getEngine } from '../core/engine';
import { MermaidCliRenderer } from '../core/diagrams/mermaid-cli';
import { PlantUMLRenderer } from '../core/diagrams/plantuml';

// Package version (will be set during build)
const VERSION = '1.0.0';

/**
 * Apply safe mode restrictions to config
 * In safe mode, disable all features that read local files or generate HTML
 */
function applySafeModeRestrictions(config: MarpExtendedConfig): string[] {
  const skipped: string[] = [];

  if (config.preprocessor.enableContainerPlugin) {
    config.preprocessor.enableContainerPlugin = false;
    skipped.push('::: container plugin');
  }
  if (config.preprocessor.enableMarkPlugin) {
    config.preprocessor.enableMarkPlugin = false;
    skipped.push('==highlight== mark plugin');
  }
  if (config.diagrams.mermaid.enabled) {
    config.diagrams.mermaid.enabled = false;
    skipped.push('Mermaid diagrams');
  }
  if (config.diagrams.plantuml.enabled) {
    config.diagrams.plantuml.enabled = false;
    skipped.push('PlantUML diagrams');
  }
  if (config.embedding.images) {
    config.embedding.images = false;
    skipped.push('Image base64 embedding');
  }
  if (config.embedding.iframes) {
    config.embedding.iframes = false;
    skipped.push('Iframe data URL embedding');
  }

  return skipped;
}

program
  .name('marp-extended')
  .description('Marp CLI with extended syntax support')
  .version(VERSION)
  .argument('<input>', 'Input markdown file')
  .option('-o, --output <file>', 'Output file (default: input with new extension)')
  .option('-c, --config <file>', 'Config file (default: marp-extended.config.json)')
  .option(
    '--format <type>',
    'Output format: html, pdf, pptx (default: html)',
    'html',
  )
  .option(
    '--unsafe',
    'Enable unsafe mode (--html, --allow-local-files) for full extended features',
  )
  .option('--theme-dir <dir>', 'Theme directory')
  .option('--no-mermaid', 'Disable Mermaid preprocessing')
  .option('--no-plantuml', 'Disable PlantUML preprocessing')
  .option('--no-directives', 'Disable /// directive shorthand')
  .option('--no-containers', 'Disable ::: container plugin')
  .option('--no-mark', 'Disable ==highlight== mark plugin')
  .option('--no-embed-images', 'Disable image embedding as base64')
  .option('--no-embed-iframes', 'Disable iframe embedding as data URLs')
  .option('--mermaid-cli <path>', 'Path to mmdc (mermaid-cli)')
  .option('--mermaid-theme <theme>', 'Mermaid theme (default, dark, forest, neutral, base)')
  .option('--plantuml-jar <path>', 'Path to plantuml.jar')
  .option('--java <path>', 'Path to java executable')
  .option('--verbose', 'Verbose output')
  .allowUnknownOption(true) // Allow pass-through to marp-cli
  .action(async (input: string, options: Record<string, unknown>) => {
    const verbose = options.verbose as boolean;

    // Load config (file -> defaults -> CLI overrides)
    const config = loadConfig(options.config as string | undefined);

    // Apply CLI overrides
    if (options.unsafe) config.mode = 'unsafe';
    if (options.mermaid === false) config.diagrams.mermaid.enabled = false;
    if (options.plantuml === false) config.diagrams.plantuml.enabled = false;
    if (options.directives === false)
      config.preprocessor.enableDirectiveShorthand = false;
    if (options.containers === false)
      config.preprocessor.enableContainerPlugin = false;
    if (options.mark === false) config.preprocessor.enableMarkPlugin = false;
    if (options.embedImages === false) config.embedding.images = false;
    if (options.embedIframes === false) config.embedding.iframes = false;
    if (options.mermaidCli)
      config.diagrams.mermaid.cliPath = options.mermaidCli as string;
    if (options.mermaidTheme)
      config.diagrams.mermaid.theme = options.mermaidTheme as typeof config.diagrams.mermaid.theme;
    if (options.plantumlJar)
      config.diagrams.plantuml.jarPath = options.plantumlJar as string;
    if (options.java)
      config.diagrams.plantuml.javaPath = options.java as string;
    if (options.themeDir) config.themeDir = options.themeDir as string;
    if (options.format) config.export.format = options.format as ExportFormat;

    // In safe mode, disable all dangerous preprocessors
    if (config.mode === 'safe') {
      const skipped = applySafeModeRestrictions(config);

      if (skipped.length > 0) {
        console.warn('Safe mode: The following features are disabled:');
        skipped.forEach((f) => console.warn(`  - ${f}`));
        console.warn(
          'Use --unsafe flag or set mode: "unsafe" in config for full functionality.',
        );
      }
    }

    // Get pass-through args (unknown options go to marp-cli)
    const passThrough = program.args.slice(1); // Everything after input file

    if (verbose) {
      console.log('Config:', JSON.stringify(config, null, 2));
      console.log('Pass-through args:', passThrough);
    }

    // Create diagram renderers
    const mermaidRenderer = config.diagrams.mermaid.enabled
      ? new MermaidCliRenderer({
          cliPath: config.diagrams.mermaid.cliPath,
          theme: config.diagrams.mermaid.theme,
        })
      : undefined;

    const plantumlRenderer =
      config.diagrams.plantuml.enabled && config.diagrams.plantuml.jarPath
        ? new PlantUMLRenderer({
            jarPath: config.diagrams.plantuml.jarPath,
            javaPath: config.diagrams.plantuml.javaPath,
          })
        : undefined;

    // Resolve input path
    const inputPath = resolve(input);
    const inputDir = dirname(inputPath);

    // Read markdown file
    let markdown: string;
    try {
      markdown = await readFile(inputPath, 'utf-8');
    } catch (err) {
      console.error(`Error reading input file: ${input}`);
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }

    if (verbose) {
      console.log(`Processing: ${inputPath}`);
    }

    // Preprocess
    const context: PreprocessorContext = {
      config,
      mermaidRenderer,
      plantumlRenderer,
      basePath: process.cwd(),
      fileDir: inputDir,
    };

    let processed: string;
    try {
      processed = await preprocess(markdown, context);
    } catch (err) {
      console.error('Error during preprocessing:');
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }

    // Write temp files
    const timestamp = Date.now();
    const tmpMd = join(tmpdir(), `marp-${timestamp}.md`);
    const tmpEngine = join(tmpdir(), `engine-${timestamp}.js`);

    await writeFile(tmpMd, processed);
    await writeFile(tmpEngine, getEngine(true));

    // Determine output path
    const format = config.export.format;
    const outputPath =
      (options.output as string) ||
      join(inputDir, `${basename(input, extname(input))}.${format}`);

    // Build marp-cli command
    const isUnsafe = config.mode === 'unsafe';
    const cmdParts = [
      'npx',
      '-y',
      '@marp-team/marp-cli@latest',
      `--engine "${tmpEngine}"`,
      `-o "${outputPath}"`,
    ];

    // Add format-specific options
    if (format === 'pdf') {
      cmdParts.push('--pdf');
    } else if (format === 'pptx') {
      cmdParts.push('--pptx');
    }

    // Only enable dangerous flags in unsafe mode
    if (isUnsafe) {
      cmdParts.push('--html');
      cmdParts.push('--allow-local-files');
    }

    // Theme directory
    if (config.themeDir) {
      cmdParts.push(`--theme-set "${resolve(config.themeDir)}"`);
    }

    // User's additional pass-through args from config
    if (config.marpCliArgs) {
      cmdParts.push(...config.marpCliArgs);
    }

    // CLI pass-through args
    cmdParts.push(...passThrough);

    // Input file (preprocessed)
    cmdParts.push(`"${tmpMd}"`);

    const cmd = cmdParts.join(' ');

    if (verbose) {
      console.log('Executing:', cmd);
    }

    try {
      execSync(cmd, { stdio: 'inherit' });
      console.log(`Exported: ${outputPath}`);
    } catch (err) {
      console.error('marp-cli failed');
      if (err instanceof Error && 'status' in err) {
        process.exit((err as { status: number }).status || 1);
      }
      process.exit(1);
    } finally {
      // Cleanup temp files
      await unlink(tmpMd).catch(() => {});
      await unlink(tmpEngine).catch(() => {});
    }
  });

// Parse command line
program.parse();
