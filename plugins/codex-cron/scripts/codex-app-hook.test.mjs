import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCRIPT_URL = new URL('./codex-app-hook.mjs', import.meta.url);
const SCRIPT_PATH = fileURLToPath(SCRIPT_URL);

const TMP_DIRS = [];

function mkTmp(prefix = 'codex-cron-hook-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_DIRS.push(dir);
  return dir;
}

after(() => {
  for (const dir of TMP_DIRS) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

function runHook(payload) {
  return spawnSync(process.execPath, [SCRIPT_PATH, 'hook', 'user-prompt-submit'], {
    encoding: 'utf8',
    input: JSON.stringify(payload),
  });
}

test('UserPromptSubmit hook: /loop prompt injects loop context for Codex App', () => {
  const res = runHook({
    hook_event_name: 'UserPromptSubmit',
    session_id: 's1',
    turn_id: 't1',
    transcript_path: null,
    cwd: process.cwd(),
    model: 'gpt-5.5',
    permission_mode: 'default',
    prompt: '/loop 10m check CI status',
  });

  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.match(out.hookSpecificOutput.additionalContext, /<codex-cron-app-context>/);
  assert.match(out.hookSpecificOutput.additionalContext, /loop\.mjs/);
  assert.doesNotMatch(out.hookSpecificOutput.additionalContext, /schedule\.mjs add/);
});

test('UserPromptSubmit hook: schedule prompt injects schedule context for Codex App', () => {
  const res = runHook({
    hook_event_name: 'UserPromptSubmit',
    session_id: 's1',
    turn_id: 't1',
    transcript_path: null,
    cwd: process.cwd(),
    model: 'gpt-5.5',
    permission_mode: 'default',
    prompt: '$schedule at 2026-07-04T09:00:00Z draft release notes',
  });

  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.match(out.hookSpecificOutput.additionalContext, /schedule\.mjs/);
  assert.match(out.hookSpecificOutput.additionalContext, /--runner auto/);
});

test('UserPromptSubmit hook: non-cron prompt emits nothing', () => {
  const res = runHook({
    hook_event_name: 'UserPromptSubmit',
    session_id: 's1',
    turn_id: 't1',
    transcript_path: null,
    cwd: process.cwd(),
    model: 'gpt-5.5',
    permission_mode: 'default',
    prompt: 'explain this repository',
  });

  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.stdout, '');
});

test('UserPromptSubmit hook: transcript marker prevents duplicate injection', () => {
  const dir = mkTmp();
  const transcriptPath = path.join(dir, 'transcript.jsonl');
  fs.writeFileSync(transcriptPath, '{"hookSpecificOutput":{"additionalContext":"<codex-cron-app-context>"}}\n');

  const res = runHook({
    hook_event_name: 'UserPromptSubmit',
    session_id: 's1',
    turn_id: 't1',
    transcript_path: transcriptPath,
    cwd: process.cwd(),
    model: 'gpt-5.5',
    permission_mode: 'default',
    prompt: '/schedule --cron "0 9 * * 1" summarize PRs',
  });

  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.stdout, '');
});
