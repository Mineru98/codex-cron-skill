#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTEXT_MARKER = '<codex-cron-app-context>';
const TRANSCRIPT_SEARCH_BYTES = 512000;

function pluginRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function readAll(stdin) {
  return new Promise((resolve, reject) => {
    let data = '';
    stdin.setEncoding('utf8');
    stdin.on('data', (chunk) => { data += String(chunk); });
    stdin.once('error', reject);
    stdin.once('end', () => resolve(data));
  });
}

function parsePayload(raw) {
  if (raw.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if (parsed.hook_event_name !== 'UserPromptSubmit') return null;
    if (typeof parsed.prompt !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function selectedSkills(prompt) {
  const normalized = prompt.trim();
  const skills = [];
  if (isLoopPrompt(normalized)) skills.push('loop');
  if (isSchedulePrompt(normalized)) skills.push('schedule');
  return skills;
}

function isLoopPrompt(prompt) {
  return /(?:^|\s)(?:\/loop|\$loop)(?:\s|$)/i.test(prompt)
    || /\b(?:loop|repeat|poll)\b[\s\S]{0,80}\bevery\s+\d+\s*(?:second|seconds|minute|minutes|hour|hours|day|days|[smhd])\b/i.test(prompt);
}

function isSchedulePrompt(prompt) {
  return /(?:^|\s)(?:\/schedule|\$schedule)(?:\s|$)/i.test(prompt)
    || /\bcron\b/i.test(prompt)
    || /\b(?:schedule|run once|run this|remind me)\b[\s\S]{0,80}\b(?:at|on)\b/i.test(prompt);
}

function hasExistingContext(transcriptPath) {
  if (transcriptPath === undefined || transcriptPath === null) return false;
  if (typeof transcriptPath !== 'string' || transcriptPath.length === 0) return false;
  try {
    const transcript = fs.readFileSync(transcriptPath);
    return transcript
      .subarray(Math.max(0, transcript.byteLength - TRANSCRIPT_SEARCH_BYTES))
      .toString('utf8')
      .includes(CONTEXT_MARKER);
  } catch {
    return false;
  }
}

function loadSkillContext(skill) {
  const root = pluginRoot();
  const skillPath = path.join(root, 'skills', skill, 'SKILL.md');
  const scriptPath = path.join(root, 'skills', skill, 'scripts', `${skill}.mjs`);
  const skillBody = fs.readFileSync(skillPath, 'utf8').trim();
  const relativeScriptPath = path.relative(root, scriptPath).replaceAll(path.sep, '/');
  return [
    `## ${skill}`,
    `Use \`${relativeScriptPath}\` for this request.`,
    skillBody,
  ].join('\n\n');
}

function formatAdditionalContext(skills) {
  if (skills.length === 0) return '';
  const body = [
    CONTEXT_MARKER,
    'Codex Cron is running inside Codex App without tmux. Treat this hook output as the active skill context for the current prompt.',
    'Prefer Codex app Automations for durable always-on schedules. Use the bundled local scripts only when the user explicitly wants the terminal-local fallback.',
    ...skills.map(loadSkillContext),
  ].join('\n\n').trim();
  return `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: body,
    },
  })}\n`;
}

async function runUserPromptSubmitHook(stdin, stdout) {
  const payload = parsePayload(await readAll(stdin));
  if (payload === null) return;
  if (hasExistingContext(payload.transcript_path)) return;
  const skills = selectedSkills(payload.prompt);
  const output = formatAdditionalContext(skills);
  if (output.length > 0) stdout.write(output);
}

async function main(argv) {
  const [command, event] = argv;
  if (command === 'hook' && event === 'user-prompt-submit') {
    await runUserPromptSubmitHook(process.stdin, process.stdout);
    return;
  }
  process.stderr.write('usage: codex-app-hook.mjs hook user-prompt-submit\n');
  process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}

export {
  CONTEXT_MARKER,
  formatAdditionalContext,
  hasExistingContext,
  isLoopPrompt,
  isSchedulePrompt,
  parsePayload,
  selectedSkills,
};
