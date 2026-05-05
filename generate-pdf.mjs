#!/usr/bin/env node

/**
 * generate-pdf.mjs — HTML → PDF via agent-browser
 *
 * Usage:
 *   node career-ops/generate-pdf.mjs <input.html> <output.pdf> [--format=letter|a4]
 *
 * Requires: agent-browser installed globally.
 * Uses Chromium headless via agent-browser to render HTML and produce
 * a clean, ATS-parseable PDF.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { resolve, dirname } from 'path';
import { readFile, writeFile, stat, mkdirSync } from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const execAsync = promisify(exec);

mkdirSync(resolve(__dirname, 'output'), { recursive: true });

const AGENT_BROWSER_TIMEOUT = 60000;

async function runAgentBrowser(args, options = {}) {
  const cmd = `agent-browser ${args}`;
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: options.timeout || AGENT_BROWSER_TIMEOUT,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout: stdout.trim(), stderr: stderr.trim(), success: true };
  } catch (err) {
    return {
      stdout: err.stdout?.trim() || '',
      stderr: err.stderr?.trim() || err.message,
      success: false,
    };
  }
}

/**
 * Normalize text for ATS compatibility by converting problematic Unicode.
 *
 * ATS parsers and legacy systems often fail on em-dashes, smart quotes,
 * zero-width characters, and non-breaking spaces. These cause mojibake,
 * parsing errors, or display issues. See issue #1.
 *
 * Only touches body text — preserves CSS, JS, tag attributes, and URLs.
 * Returns { html, replacements } so the caller can log what was changed.
 */
function normalizeTextForATS(html) {
  const replacements = {};
  const bump = (key, n) => { replacements[key] = (replacements[key] || 0) + n; };

  const masks = [];
  const masked = html.replace(
    /<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi,
    (match) => {
      const token = `\u0000MASK${masks.length}\u0000`;
      masks.push(match);
      return token;
    }
  );

  let out = '';
  let i = 0;
  while (i < masked.length) {
    const lt = masked.indexOf('<', i);
    if (lt === -1) { out += sanitizeText(masked.slice(i)); break; }
    out += sanitizeText(masked.slice(i, lt));
    const gt = masked.indexOf('>', lt);
    if (gt === -1) { out += masked.slice(lt); break; }
    out += masked.slice(lt, gt + 1);
    i = gt + 1;
  }

  const restored = out.replace(/\u0000MASK(\d+)\u0000/g, (_, n) => masks[Number(n)]);
  return { html: restored, replacements };

  function sanitizeText(text) {
    if (!text) return text;
    let t = text;
    t = t.replace(/\u2014/g, () => { bump('em-dash', 1); return '-'; });
    t = t.replace(/\u2013/g, () => { bump('en-dash', 1); return '-'; });
    t = t.replace(/[\u201C\u201D\u201E\u201F]/g, () => { bump('smart-double-quote', 1); return '"'; });
    t = t.replace(/[\u2018\u2019\u201A\u201B]/g, () => { bump('smart-single-quote', 1); return "'"; });
    t = t.replace(/\u2026/g, () => { bump('ellipsis', 1); return '...'; });
    t = t.replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, () => { bump('zero-width', 1); return ''; });
    t = t.replace(/\u00A0/g, () => { bump('nbsp', 1); return ' '; });
    return t;
  }
}

/**
 * Inject CSS @page rules for PDF formatting.
 * agent-browser doesn't support PDF options like Playwright,
 * so we inject CSS to control page size, margins, etc.
 */
function injectPrintCSS(html, format) {
  const pageSize = format === 'letter' ? 'letter' : 'a4';
  const margin = '0.6in';

  const printCSS = `
@media print {
  @page {
    size: ${pageSize};
    margin: ${margin};
  }
  body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
`;

  if (html.includes('</head>')) {
    return html.replace('</head>', `<style>${printCSS}</style></head>`);
  } else if (html.includes('<body')) {
    return html.replace('<body', `<style>${printCSS}</style><body`);
  }
  return `<style>${printCSS}</style>` + html;
}

async function generatePDF() {
  const args = process.argv.slice(2);

  let inputPath, outputPath, format = 'a4';

  for (const arg of args) {
    if (arg.startsWith('--format=')) {
      format = arg.split('=')[1].toLowerCase();
    } else if (!inputPath) {
      inputPath = arg;
    } else if (!outputPath) {
      outputPath = arg;
    }
  }

  if (!inputPath || !outputPath) {
    console.error('Usage: node generate-pdf.mjs <input.html> <output.pdf> [--format=letter|a4]');
    process.exit(1);
  }

  inputPath = resolve(inputPath);
  outputPath = resolve(outputPath);

  const validFormats = ['a4', 'letter'];
  if (!validFormats.includes(format)) {
    console.error(`Invalid format "${format}". Use: ${validFormats.join(', ')}`);
    process.exit(1);
  }

  console.log(`📄 Input:  ${inputPath}`);
  console.log(`📁 Output: ${outputPath}`);
  console.log(`📏 Format: ${format.toUpperCase()}`);

  let html = await readFile(inputPath, 'utf-8');

  const fontsDir = resolve(__dirname, 'fonts');
  html = html.replace(
    /url\(['"]?\.\/fonts\//g,
    `url('file://${fontsDir}/`
  );
  html = html.replace(
    /file:\/\/([^'")]+)\.(woff2?|ttf|otf)['"]?\)/g,
    `file://$1.$2')`
  );

  const normalized = normalizeTextForATS(html);
  html = normalized.html;
  const totalReplacements = Object.values(normalized.replacements).reduce((a, b) => a + b, 0);
  if (totalReplacements > 0) {
    const breakdown = Object.entries(normalized.replacements).map(([k, v]) => `${k}=${v}`).join(', ');
    console.log(`🧹 ATS normalization: ${totalReplacements} replacements (${breakdown})`);
  }

  html = injectPrintCSS(html, format);

  const tempHtmlPath = resolve(__dirname, 'output', `temp-pdf-${Date.now()}.html`);
  await writeFile(tempHtmlPath, html, 'utf-8');

  const fileUrl = `file://${tempHtmlPath}`;

  try {
    const openResult = await runAgentBrowser(`--allow-file-access open "${fileUrl}"`);
    if (!openResult.success) {
      throw new Error(`Failed to open HTML: ${openResult.stderr}`);
    }

    await runAgentBrowser('wait --load networkidle');
    await runAgentBrowser('wait 2000');

    await runAgentBrowser(`eval 'document.fonts.ready'`);
    await runAgentBrowser('wait 1000');

    const pdfResult = await runAgentBrowser(`pdf "${outputPath}"`);
    if (!pdfResult.success) {
      throw new Error(`PDF generation failed: ${pdfResult.stderr}`);
    }

    await runAgentBrowser('close');

    const outputStats = await stat(outputPath);
    const pdfContent = await readFile(outputPath, 'latin1');
    const pageCount = (pdfContent.match(/\/Type\s*\/Page[^s]/g) || []).length;

    console.log(`✅ PDF generated: ${outputPath}`);
    console.log(`📊 Pages: ${pageCount}`);
    console.log(`📦 Size: ${(outputStats.size / 1024).toFixed(1)} KB`);

    return { outputPath, pageCount, size: outputStats.size };

  } finally {
    try {
      const { unlink } = await import('fs/promises');
      await unlink(tempHtmlPath);
    } catch {
      // Ignore cleanup errors
    }
    await runAgentBrowser('close').catch(() => {});
  }
}

generatePDF().catch((err) => {
  console.error('❌ PDF generation failed:', err.message);
  process.exit(1);
});
