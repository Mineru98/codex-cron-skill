# codex-cron

A Codex plugin that ships two standalone skills for running Codex prompts on a schedule:

- **`loop`** — fixed-interval repeats (`Ns` / `Nm` / `Nh` / `Nd`; default `10m`).
- **`schedule`** — standard 5-field cron, plus one-shot `--at <ISO-8601>`.

Both are independent: separate state roots (`.codex/loop/`, `.codex/schedule/`), daemons, and locks.

## Skills

```
skills/
├── loop/       — parse-loop, add, list, cancel, status, run-due, daemon, doctor
└── schedule/   — parse-schedule, add, list, cancel, status, run-due, daemon, doctor
```

Each skill bundles `SKILL.md`, `scripts/<name>.mjs` (+ tests), `references/<name>-contract.md`, and `agents/openai.yaml`.

## How a run happens

The daemon (or a one-shot `run-due`) selects due tasks. `schedule` uses the `auto` runner by default:

1. `tmux-send` when `--tmux-target` or `TMUX_PANE` points at a running Codex pane.
2. `resume-command` when `--resume-command` is provided.
3. `codex-exec` as the compatibility fallback.

The `codex-exec` fallback executes:

```
codex exec --cd <task.cwd> --json --output-last-message <path> -
```

with the prompt on stdin. Stdout streams straight to `runs/<taskId>/<ts>.jsonl` (no buffer limit); the last message lands in `<ts>.last.txt`.

## Safety model

- `--codex-arg` pass-through is a **default-deny allowlist** (only `--model`/`-m`). Any sandbox / approval / config / profile flag is rejected — the default `codex exec` argv never carries a bypass flag.
- `tmux-send` does not invoke `codex exec`; it injects the prompt into the target pane with a verified named buffer, clears the composer, pastes, then presses Enter.
- `resume-command` runs a trusted local hook with the prompt on stdin and the task cwd as the process cwd.
- The lock (`scheduled_tasks.lock/`) is a single-runner mutex: atomic `mkdir` acquire, rename compare-and-swap stale reclaim, guaranteed release on exit/SIGINT/SIGTERM. See `references/*-contract.md` §2 for the concurrency model.
- `doctor` is read-only and never creates the state root.
- No OS cron/launchd is installed.

## Local-only state

`tasks.json`, `scheduled_tasks.lock/`, and `runs/` are runtime state. Git-ignore them; do not commit.

## Tests

```bash
node --test skills/loop/scripts/loop.test.mjs        # 33 tests
node --test skills/schedule/scripts/schedule.test.mjs # 44 tests
```

MIT © 2026 Mineru98.
