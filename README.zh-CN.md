<div align="center">

![Codex Cron](plugins/codex-cron/assets/op-image.png)

# Codex Cron

**给 Codex 提示词用的 cron。**
在终端或 tmux 里本地、安全地循环或定时运行 Codex 提示词。

![license](https://img.shields.io/badge/license-MIT-C6A15B?style=flat-square)
![codex](https://img.shields.io/badge/Codex-plugin-111827?style=flat-square)
![deps](https://img.shields.io/badge/dependencies-0-2ea44f?style=flat-square)
![tests](https://img.shields.io/badge/tests-81%20passing-2ea44f?style=flat-square)
![node](https://img.shields.io/badge/node-%E2%89%A518-111827?style=flat-square)

[English](README.md) | [한국어](README.ko.md) | 中文 | [日本語](README.ja.md)

</div>

---

Codex 只会把提示词运行 **一次**。Codex Cron 可以让它 **按计划** 运行：每 _N_ 分钟一次、按 cron 表达式运行，或在指定时间运行一次。同时它会把基础机制做扎实：单运行者锁、无限制运行日志，以及不会削弱沙箱的安全 allowlist。

`schedule` 默认使用 `auto` runner，并按以下优先级投递到期提示词：

1. `tmux-send` — 如果 `--tmux-target` 或 `TMUX_PANE` 指向正在运行的 Codex pane，就把提示词粘贴进去并按 Enter。
2. `resume-command` — 如果提供了 `--resume-command`，就运行该本地 hook，并把提示词通过 stdin 传入。
3. `codex-exec` — 如果前两者都不可用，则为了兼容性 fallback 到新的 `codex exec` 运行。

两个很小、零依赖的技能：

- **`loop`** — 固定间隔重复执行（`10m`、`2h`、`1d` 等）
- **`schedule`** — 5 字段 cron，加一次性 `--at <ISO-8601>`

## 安装 - 2 条命令

```bash
codex plugin marketplace add Mineru98/codex-cron-skill
codex plugin add codex-cron@mineru98
```

`loop` 和 `schedule` 现在会注册到 Codex。设置到此结束。

## 使用

直接告诉 Codex，它会选择正确的技能：

```
每 10 分钟检查 CI 状态，如果失败就提醒我
每周一 09:00 汇总打开的 PR 并生成摘要
在 2026-07-04T09:00:00Z 只运行一次，起草发布说明
```

如果想明确指定路由，也可以用 `$loop` / `$schedule` 写出技能名：

```
$loop 每 10 分钟检查 CI 状态，如果失败就提醒我
$schedule "0 9 * * 1": 汇总打开的 PR 并生成摘要
$schedule at 2026-07-04T09:00:00Z: 起草发布说明
```

也可以直接运行打包的脚本：

```bash
# loop - 每 10 分钟运行一次提示词
node plugins/codex-cron/skills/loop/scripts/loop.mjs \
  add --state-root .codex/loop --interval 10m \
  --prompt "check CI status" --cwd "$PWD"
node plugins/codex-cron/skills/loop/scripts/loop.mjs daemon --state-root .codex/loop

# schedule - 每个工作日 09:00 运行
node plugins/codex-cron/skills/schedule/scripts/schedule.mjs \
  add --state-root .codex/schedule --cron "0 9 * * 1" \
  --prompt "summarize open PRs" --cwd "$PWD"
node plugins/codex-cron/skills/schedule/scripts/schedule.mjs daemon \
  --state-root .codex/schedule \
  --runner auto \
  --tmux-target "$TMUX_PANE"
```

只有在 `daemon` 运行时任务才会触发。它持有单运行者锁，因此不会重复触发。

## 不是玩具

- **单运行者锁** — atomic `mkdir` 获取锁，并用 rename compare-and-swap 回收。不会出现重复 daemon；崩溃遗留的锁会安全恢复，而不是删除仍在使用的锁。
- **优先投递到交互会话** — `schedule` 会依次选择 tmux 输入注入、本地 resume hook、`codex exec`。也可以用 `--runner tmux-send`、`--runner resume-command`、`--runner codex-exec` 强制指定模式。
- **默认安全** — `--codex-arg` 透传采用 *default-deny allowlist*。沙箱、审批、配置绕过类参数（`--sandbox danger-full-access`、`--full-auto`、`--dangerously-...`）都会被拒绝，绝不会传到 `codex exec`。
- **完整运行捕获** — 每次运行都会无限制流式写入自己的 `runs/<taskId>/<ts>.jsonl` 和最后消息文件。没有 1 MB 截断，并保留真实退出码。
- **零依赖** — 纯 Node ESM + `node:test`。81 个测试通过（loop 33 个，schedule 44 个，app hook 4 个），覆盖对抗性安全场景和锁竞争场景。
- **不使用 OS cron / launchd** — 不会在背后安装任何东西。daemon 只在你运行它时运行。

## loop vs schedule

```
                loop                     schedule
  cadence   fixed interval           5-field cron  |  one-shot --at
  grammar   Ns / Nm / Nh / Nd        m h dom mon dow (., */n, a-b, lists)
  example   --interval 10m           --cron "0 9 * * 1"   |   --at <ISO>
  state     .codex/loop/             .codex/schedule/
  default   10m if omitted           next cron time  |  fires once, then done
```

两者共享同一个 runner、锁纪律和安全模型，唯一差别是任务 **何时** 到期。

## 如果需要一直在线的计划任务

如果需要能跨重启、跨关闭终端存活的 durable always-on 调度，请使用官方入口 **Codex app Automations**。Codex Cron 是 **终端原生的本地 fallback**，适合开发机、tmux pane、CI runner，或任何以 shell 为中心的环境。

## 内部机制

- `parse-loop` / `parse-schedule` — 在不触碰状态的情况下把规格验证成 JSON
- `add` / `list` / `cancel` / `status` — 在 `tasks.json` 中管理任务（atomic temp+rename 写入）
- `run-due` — 一次执行所有到期任务（适合 CI 触发）
- `daemon` — 按间隔轮询；支持 `--once`、`--max-runs N`、`--poll-ms`、`--runner`、`--codex-bin`、`--tmux-target`、`--resume-command`
- `doctor` — 只读健康检查（状态根目录、锁、codex 二进制、local-ignore 指引）

运行状态（`tasks.json`、`scheduled_tasks.lock/`、`runs/`）是 **仅本地** 数据。请 git-ignore，不要提交。

## 许可证

MIT © 2026 Mineru98。见 [LICENSE](LICENSE)。
