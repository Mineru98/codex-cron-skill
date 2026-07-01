<div align="center">

![Codex Cron](plugins/codex-cron/assets/og.png)

# Codex Cron

**Codex プロンプトのための cron。**
Codex プロンプトを、ターミナルや tmux からローカルかつ安全にループ実行またはスケジュール実行できます。

![license](https://img.shields.io/badge/license-MIT-C6A15B?style=flat-square)
![codex](https://img.shields.io/badge/Codex-plugin-111827?style=flat-square)
![deps](https://img.shields.io/badge/dependencies-0-2ea44f?style=flat-square)
![tests](https://img.shields.io/badge/tests-77%20passing-2ea44f?style=flat-square)
![node](https://img.shields.io/badge/node-%E2%89%A518-111827?style=flat-square)

[English](README.md) | [한국어](README.ko.md) | [中文](README.zh-CN.md) | 日本語

</div>

---

Codex はプロンプトを **一度だけ** 実行します。Codex Cron はそれを **スケジュールに沿って** 実行します。_N_ 分ごと、cron 式、または指定時刻に一度だけ実行でき、単一ランナーのロック、制限なしの実行ログ、サンドボックスを弱めない安全な allowlist で基本部分を堅牢に保ちます。

`schedule` はデフォルトで `auto` runner を使い、due になったプロンプトを次の優先順で届けます。

1. `tmux-send` — `--tmux-target` または `TMUX_PANE` が実行中の Codex pane を指していれば、そこへ貼り付けて Enter を送ります。
2. `resume-command` — `--resume-command` が指定されていれば、そのローカル hook を実行し、プロンプトを stdin で渡します。
3. `codex-exec` — どちらもなければ、互換性のため新しい `codex exec` 実行へ fallback します。

小さく、依存関係のない 2 つのスキルを提供します。

- **`loop`** — 固定間隔の繰り返し（`10m`、`2h`、`1d` など）
- **`schedule`** — 5 フィールド cron と一回限りの `--at <ISO-8601>`

## インストール - 2 コマンド

```bash
codex plugin marketplace add Mineru98/codex-cron-skill
codex plugin add codex-cron@mineru98
```

これで `loop` と `schedule` が Codex に登録されます。設定はこれだけです。

## 使い方

Codex にそのまま依頼すると、適切なスキルが選ばれます。

```
10分ごとにCIの状態を確認し、失敗していたら知らせて
毎週月曜09:00に未対応のPRを要約してダイジェストを作って
2026-07-04T09:00:00Zに一度だけリリースノートの下書きを作って
```

ルーティングを明示したい場合は、`$loop` / `$schedule` のようにスキル名を指定できます。

```
$loop 10分ごとにCIの状態を確認し、失敗していたら知らせて
$schedule "0 9 * * 1": 未対応のPRを要約してダイジェストを作って
$schedule at 2026-07-04T09:00:00Z: リリースノートの下書きを作って
```

同梱スクリプトを直接実行することもできます。

```bash
# loop - 10 分ごとにプロンプトを実行
node plugins/codex-cron/skills/loop/scripts/loop.mjs \
  add --state-root .codex/loop --interval 10m \
  --prompt "check CI status" --cwd "$PWD"
node plugins/codex-cron/skills/loop/scripts/loop.mjs daemon --state-root .codex/loop

# schedule - 平日 09:00 に実行
node plugins/codex-cron/skills/schedule/scripts/schedule.mjs \
  add --state-root .codex/schedule --cron "0 9 * * 1" \
  --prompt "summarize open PRs" --cwd "$PWD"
node plugins/codex-cron/skills/schedule/scripts/schedule.mjs daemon \
  --state-root .codex/schedule \
  --runner auto \
  --tmux-target "$TMUX_PANE"
```

`daemon` が実行中のときだけジョブは発火します。daemon は単一ランナーのロックを保持するため、二重発火は起きません。

## おもちゃではありません

- **単一ランナーのロック** — atomic `mkdir` で取得し、rename compare-and-swap で回収します。重複 daemon を防ぎ、クラッシュで残ったロックも稼働中のロックを削除せず安全に復旧します。
- **対話型配信を優先** — `schedule` は tmux 入力注入、ローカル resume hook、`codex exec` の順に選びます。`--runner tmux-send`、`--runner resume-command`、`--runner codex-exec` で特定のモードを強制できます。
- **デフォルトで安全** — `--codex-arg` のパススルーは *default-deny allowlist* です。サンドボックス、承認、設定回避フラグ（`--sandbox danger-full-access`、`--full-auto`、`--dangerously-...`）は拒否され、`codex exec` には届きません。
- **完全な実行キャプチャ** — 各実行はそれぞれの `runs/<taskId>/<ts>.jsonl` と最後のメッセージファイルへ制限なしでストリーミングされます。1 MB の切り捨てはなく、実際の終了コードを保持します。
- **依存関係ゼロ** — 純粋な Node ESM と `node:test`。安全性とロック競合の adversarial ケースを含む 77 テストが通っています（loop 33、schedule 44）。
- **OS cron / launchd なし** — 裏で何かをインストールしません。daemon はユーザーが実行している間だけ動きます。

## loop vs schedule

```
                loop                     schedule
  cadence   fixed interval           5-field cron  |  one-shot --at
  grammar   Ns / Nm / Nh / Nd        m h dom mon dow (., */n, a-b, lists)
  example   --interval 10m           --cron "0 9 * * 1"   |   --at <ISO>
  state     .codex/loop/             .codex/schedule/
  default   10m if omitted           next cron time  |  fires once, then done
```

どちらも同じ runner、ロック規律、安全モデルを共有します。違いはジョブが **いつ** due になるかだけです。

## 常時稼働のスケジュールが必要な場合

再起動や閉じたターミナルをまたいで存続する durable always-on スケジュールには、公式の **Codex app Automations** を使ってください。Codex Cron は **ターミナルネイティブなローカル fallback** です。開発マシン、tmux pane、CI runner、シェル中心の環境に向いています。

## 内部構造

- `parse-loop` / `parse-schedule` — 状態に触れず、仕様を JSON として検証
- `add` / `list` / `cancel` / `status` — `tasks.json` でタスクを管理（atomic temp+rename 書き込み）
- `run-due` — due になったものを 1 回の pass で実行（CI トリガーに便利）
- `daemon` — 一定間隔で polling。`--once`、`--max-runs N`、`--poll-ms`、`--runner`、`--codex-bin`、`--tmux-target`、`--resume-command`
- `doctor` — 読み取り専用の health check（状態ルート、ロック、codex バイナリ、local-ignore ガイダンス）

実行状態（`tasks.json`、`scheduled_tasks.lock/`、`runs/`）は **ローカル専用** です。git-ignore し、コミットしないでください。

## ライセンス

MIT © 2026 Mineru98。[LICENSE](LICENSE) を参照してください。
