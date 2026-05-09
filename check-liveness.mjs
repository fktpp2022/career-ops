#!/usr/bin/env node

/**
 * check-liveness.mjs — agent-browser job link liveness checker
 *
 * Tests whether job posting URLs are still active or have expired.
 * Uses the same detection logic as scan.md step 7.5.
 * Zero Claude API tokens — pure agent-browser CLI.
 *
 * Usage:
 *   node check-liveness.mjs <url1> [url2] ...
 *   node check-liveness.mjs --file urls.txt
 *
 * Exit code: 0 if all active, 1 if any expired or uncertain
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { classifyLiveness } from './liveness-core.mjs';

const execAsync = promisify(exec);

const AGENT_BROWSER_TIMEOUT = 30000;

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

async function checkUrl(url) {
  try {
    const openResult = await runAgentBrowser(`open "${url}"`);
    if (!openResult.success) {
      return { result: 'expired', reason: `navigation error: ${openResult.stderr.split('\n')[0]}` };
    }

    await runAgentBrowser('wait --load networkidle');
    await runAgentBrowser('wait 2000');

    const urlResult = await runAgentBrowser('get url');
    const finalUrl = urlResult.stdout || url;

    const textResult = await runAgentBrowser('get text body');
    const bodyText = textResult.stdout || '';

    const applyControlsScript = `
      (function() {
        const candidates = Array.from(
          document.querySelectorAll('a, button, input[type="submit"], input[type="button"], [role="button"]')
        );
        return candidates
          .filter((element) => {
            if (element.closest('nav, header, footer')) return false;
            if (element.closest('[aria-hidden="true"]')) return false;
            const style = window.getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            if (!element.getClientRects().length) return false;
            return Array.from(element.getClientRects()).some((rect) => rect.width > 0 && rect.height > 0);
          })
          .map((element) => {
            const label = [
              element.innerText,
              element.value,
              element.getAttribute('aria-label'),
              element.getAttribute('title'),
            ]
              .filter(Boolean)
              .join(' ')
              .replace(/\\s+/g, ' ')
              .trim();
            return label;
          })
          .filter(Boolean);
      })();
    `;

    const controlsResult = await runAgentBrowser(`eval '${applyControlsScript.replace(/'/g, "'\"'\"'").replace(/\n/g, ' ')}'`);
    let applyControls = [];
    if (controlsResult.success && controlsResult.stdout) {
      try {
        applyControls = JSON.parse(controlsResult.stdout);
        if (!Array.isArray(applyControls)) {
          applyControls = controlsResult.stdout.split('\n').filter(Boolean);
        }
      } catch {
        applyControls = controlsResult.stdout.split('\n').filter(Boolean);
      }
    }

    if (applyControls.length === 0) {
      const snapshotResult = await runAgentBrowser('snapshot -i');
      if (snapshotResult.success && snapshotResult.stdout) {
        const snapshotText = snapshotResult.stdout.toLowerCase();
        const applyKeywords = ['apply', 'solicitar', 'bewerben', 'postuler', 'submit', 'start application'];
        for (const keyword of applyKeywords) {
          if (snapshotText.includes(keyword)) {
            applyControls = [keyword];
            break;
          }
        }
      }
    }

    const status = 0;

    return classifyLiveness({ status, finalUrl, bodyText, applyControls });

  } catch (err) {
    return { result: 'expired', reason: `error: ${err.message.split('\n')[0]}` };
  } finally {
    await runAgentBrowser('close');
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node check-liveness.mjs <url1> [url2] ...');
    console.error('       node check-liveness.mjs --file urls.txt');
    process.exit(1);
  }

  let urls;
  if (args[0] === '--file') {
    const text = await readFile(args[1], 'utf-8');
    urls = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  } else {
    urls = args;
  }

  console.log(`Checking ${urls.length} URL(s)...\n`);

  let active = 0, expired = 0, uncertain = 0;

  for (const url of urls) {
    const { result, reason } = await checkUrl(url);
    const icon = { active: '✅', expired: '❌', uncertain: '⚠️' }[result];
    console.log(`${icon} ${result.padEnd(10)} ${url}`);
    if (result !== 'active') console.log(`           ${reason}`);
    if (result === 'active') active++;
    else if (result === 'expired') expired++;
    else uncertain++;
  }

  console.log(`\nResults: ${active} active  ${expired} expired  ${uncertain} uncertain`);
  if (expired > 0 || uncertain > 0) process.exit(1);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
