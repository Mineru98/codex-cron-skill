# Codex Cron 0.2.0

Codex App integration release. This version keeps the 0.1.0 local scheduling behavior and adds Codex App hook context loading.

## Added

- Plugin hook registration through `hooks/user-prompt-submit-loading-cron-context.json`.
- `scripts/codex-app-hook.mjs` for `UserPromptSubmit` events.
- Prompt detection for `loop` and `schedule` requests inside Codex App.
- Automatic skill-context injection when a prompt matches Codex Cron usage.
- Duplicate-injection prevention with the `<codex-cron-app-context>` transcript marker.
- Plugin capability metadata for `Hooks` and `Context Injection`.
- Hook tests covering loop prompts, schedule prompts, non-cron prompts, and duplicate-context prevention.

## Behavior

When Codex App submits a user prompt, the hook reads the JSON payload from stdin.

- Non-`UserPromptSubmit` events are ignored.
- Prompts that do not match `loop` or `schedule` emit no output.
- Matching prompts emit `hookSpecificOutput.additionalContext`.
- The injected context includes the relevant bundled `SKILL.md` and script path.
- Existing transcript context with the marker suppresses reinjection.

## Guidance

The injected App context tells Codex to prefer Codex App Automations for durable, always-on scheduling. Codex Cron remains the local terminal fallback for cases where the user explicitly wants a daemon-backed local runner.

## Compatibility Notes

- Core scripts remain dependency-free Node ESM.
- `codex-exec` and `resume-command` are the preferred cross-platform runner paths.
- `tmux-send` remains tmux-specific and is intended for Unix-like or WSL2 tmux environments.

## Test Coverage

Version 0.2.0 adds 4 hook tests on top of the existing 77 loop/schedule tests.

