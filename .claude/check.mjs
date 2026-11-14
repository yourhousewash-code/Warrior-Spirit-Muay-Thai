// Claude Code hooks for this repo (order A-061, 13 Nov 2026). They only report; they never change files.
// after-edit: after each Write or Edit, run the tests (about half a second). stop: run them once more before a session ends.
// A failure exits with code 2 so Claude sees it and fixes it; the Stop hook lets the session end on its second try.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const mode = process.argv[2];
let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch {}
if (mode === 'stop' && input.stop_hook_active) process.exit(0);
try {
  execSync('npm test --silent', { stdio: ['ignore', 'pipe', 'pipe'], timeout: 55000 });
} catch (e) {
  const out = String(e.stdout || '') + String(e.stderr || '');
  const fails = out.split('\n').filter(l => /^not ok|^\s+(error|expected|actual):|AssertionError|Error:/.test(l)).slice(0, 20).join('\n');
  process.stderr.write(`npm test failed:\n${fails || out.slice(-2000)}\n`);
  process.exit(2);
}
