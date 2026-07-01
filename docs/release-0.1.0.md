# Codex Cron 0.1.0

Initial release of Codex Cron as a terminal-native Codex scheduling plugin.

## Included Skills

- `loop`: fixed-interval Codex prompt repeats.
- `schedule`: 5-field cron schedules and one-shot `--at <ISO-8601>` runs.

## Loop

`loop` registers prompts that repeat after a fixed interval.

- Supports `s`, `m`, `h`, and `d` interval units.
- Defaults to `10m` when no interval is provided.
- Rounds second-based intervals up to a whole-minute floor.
- Provides `parse-loop`, `add`, `list`, `cancel`, `status`, `run-due`, `daemon`, and `doctor`.
- Stores local state under `.codex/loop/`.

## Schedule

`schedule` registers prompts that run on cron expressions or at one specific time.

- Supports standard 5-field cron: minute, hour, day-of-month, month, day-of-week.
- Supports one-shot runs with `--at <ISO-8601>`.
- Provides `parse-schedule`, `add`, `list`, `cancel`, `status`, `run-due`, `daemon`, and `doctor`.
- Stores local state under `.codex/schedule/`.

## Runner Behavior

Version 0.1.0 introduced the shared local runner model.

- `daemon` keeps a scheduler process alive and polls for due tasks.
- `run-due` performs one due-task pass without a long-running daemon.
- `schedule` defaults to the `auto` runner:
  - `tmux-send` when a tmux target is available.
  - `resume-command` when a local resume hook is provided.
  - `codex-exec` as the fallback.
- `loop` runs due prompts through `codex exec`.

## Safety And State

- Single-runner lock with atomic directory creation.
- Stale-lock reclaim through rename compare-and-swap.
- Per-run JSONL output and last-message capture.
- Default-deny `--codex-arg` allowlist; only `--model` and `-m` are accepted.
- Sandbox, approval, config, profile, and bypass flags are rejected.
- `doctor` is read-only and does not create state.
- No OS cron, launchd, or system service is installed.

## Test Coverage

The 0.1.0 release shipped with 77 Node tests:

- 33 `loop` tests.
- 44 `schedule` tests.

