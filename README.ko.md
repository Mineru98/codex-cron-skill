<div align="center">

![Codex Cron](plugins/codex-cron/assets/op-image.png)

# Codex Cron

**Codex 프롬프트를 위한 cron.**
터미널이나 tmux에서 로컬로, 안전하게, Codex 프롬프트를 반복하거나 예약하세요.

![license](https://img.shields.io/badge/license-MIT-C6A15B?style=flat-square)
![codex](https://img.shields.io/badge/Codex-plugin-111827?style=flat-square)
![deps](https://img.shields.io/badge/dependencies-0-2ea44f?style=flat-square)
![tests](https://img.shields.io/badge/tests-77%20passing-2ea44f?style=flat-square)
![node](https://img.shields.io/badge/node-%E2%89%A518-111827?style=flat-square)

[English](README.md) | 한국어 | [中文](README.zh-CN.md) | [日本語](README.ja.md)

</div>

---

Codex는 프롬프트를 **한 번** 실행합니다. Codex Cron은 그 프롬프트를 **일정에 따라** 실행합니다. _N_분마다, cron 표현식에 맞춰, 또는 지정한 시각에 한 번 실행할 수 있으며, 단일 실행자 잠금, 제한 없는 실행 로그, 샌드박스를 약화시키지 않는 안전 allowlist로 기본 배관을 견고하게 유지합니다.

`schedule`은 기본적으로 `auto` runner로 due 프롬프트를 전달합니다.

1. `tmux-send` — `--tmux-target` 또는 `TMUX_PANE`이 실행 중인 Codex pane을 가리키면 그 pane에 붙여넣고 Enter를 입력합니다.
2. `resume-command` — `--resume-command`가 있으면 해당 로컬 hook을 실행하고 프롬프트를 stdin으로 전달합니다.
3. `codex-exec` — 둘 다 없으면 호환성을 위해 새 `codex exec` 실행으로 fallback합니다.

작고 의존성 없는 두 가지 스킬을 제공합니다.

- **`loop`** — 고정 간격 반복(`10m`, `2h`, `1d`, ...)
- **`schedule`** — 5필드 cron과 일회성 `--at <ISO-8601>`

## 설치 - 명령 2개

```bash
codex plugin marketplace add Mineru98/codex-cron-skill
codex plugin add codex-cron@mineru98
```

이제 Codex에 `loop`와 `schedule`이 등록됩니다. 설정은 이것으로 끝입니다.

## 사용하기

Codex에 자연어로 요청하면 알맞은 스킬을 선택합니다.

```
10분마다 반복해서 CI 상태를 확인하고 실패하면 알려줘
매주 월요일 09시에 열린 PR을 요약해서 다이제스트를 작성해줘
2026-07-04T09:00:00Z에 한 번만 릴리스 노트를 초안으로 작성해줘
```

라우팅을 확실히 지정하고 싶다면 `$loop` / `$schedule`처럼 스킬 이름을 명시할 수 있습니다.

```
$loop 10분마다 CI 상태를 확인하고 실패하면 알려줘
$schedule "0 9 * * 1": 열린 PR을 요약해서 다이제스트를 작성해줘
$schedule at 2026-07-04T09:00:00Z: 릴리스 노트를 초안으로 작성해줘
```

번들 스크립트를 직접 실행할 수도 있습니다.

```bash
# loop - 10분마다 프롬프트 실행
node plugins/codex-cron/skills/loop/scripts/loop.mjs \
  add --state-root .codex/loop --interval 10m \
  --prompt "check CI status" --cwd "$PWD"
node plugins/codex-cron/skills/loop/scripts/loop.mjs daemon --state-root .codex/loop

# schedule - 평일 09:00마다 실행
node plugins/codex-cron/skills/schedule/scripts/schedule.mjs \
  add --state-root .codex/schedule --cron "0 9 * * 1" \
  --prompt "summarize open PRs" --cwd "$PWD"
node plugins/codex-cron/skills/schedule/scripts/schedule.mjs daemon \
  --state-root .codex/schedule \
  --runner auto \
  --tmux-target "$TMUX_PANE"
```

`daemon`이 실행 중일 때만 작업이 발화됩니다. daemon은 단일 실행자 잠금을 잡기 때문에 같은 작업이 중복 실행되지 않습니다.

## 장난감이 아닙니다

- **단일 실행자 잠금** — atomic `mkdir` 획득과 rename compare-and-swap 회수. 중복 daemon을 막고, 충돌로 남은 잠금은 살아 있는 잠금을 삭제하지 않고 안전하게 회복합니다.
- **대화형 전달 우선** — `schedule`은 tmux 입력 주입, 로컬 resume hook, `codex exec` 순서로 선택합니다. `--runner tmux-send`, `--runner resume-command`, `--runner codex-exec`로 특정 모드를 강제할 수 있습니다.
- **기본 안전성** — `--codex-arg` 전달은 *default-deny allowlist*입니다. 샌드박스, 승인, 설정 우회 플래그(`--sandbox danger-full-access`, `--full-auto`, `--dangerously-...`)는 거부되어 `codex exec`에 도달하지 않습니다.
- **전체 실행 캡처** — 모든 실행은 각자의 `runs/<taskId>/<ts>.jsonl`과 마지막 메시지 파일로 제한 없이 스트리밍됩니다. 1 MB 잘림이 없고 실제 종료 코드를 보존합니다.
- **의존성 없음** — 순수 Node ESM과 `node:test`만 사용합니다. 안전성 및 잠금 경쟁 adversarial 케이스를 포함해 77개 테스트가 통과합니다(loop 33개, schedule 44개).
- **OS cron / launchd 없음** — 몰래 설치되는 것이 없습니다. daemon은 사용자가 실행하는 동안에만 동작합니다.

## loop vs schedule

```
                loop                     schedule
  cadence   fixed interval           5-field cron  |  one-shot --at
  grammar   Ns / Nm / Nh / Nd        m h dom mon dow (., */n, a-b, lists)
  example   --interval 10m           --cron "0 9 * * 1"   |   --at <ISO>
  state     .codex/loop/             .codex/schedule/
  default   10m if omitted           next cron time  |  fires once, then done
```

둘은 같은 runner, 잠금 규칙, 안전 모델을 공유합니다. 차이는 작업이 **언제** due가 되는지뿐입니다.

## 항상 켜진 예약이 필요하다면

재부팅이나 닫힌 터미널 이후에도 살아 있는 durable, always-on 예약은 공식 표면인 **Codex app Automations**를 사용하세요. Codex Cron은 **터미널 네이티브 로컬 fallback**입니다. 개발 머신, tmux pane, CI runner, 셸 중심 환경에 적합합니다.

## 내부 구조

- `parse-loop` / `parse-schedule` — 상태를 건드리지 않고 스펙을 JSON으로 검증
- `add` / `list` / `cancel` / `status` — `tasks.json`에서 작업 관리(atomic temp+rename 쓰기)
- `run-due` — 한 번의 pass에서 due 작업 실행(CI 트리거에 유용)
- `daemon` — 간격별 polling. `--once`, `--max-runs N`, `--poll-ms`, `--runner`, `--codex-bin`, `--tmux-target`, `--resume-command`
- `doctor` — 읽기 전용 health check(상태 루트, 잠금, codex 바이너리, local-ignore 안내)

실행 상태(`tasks.json`, `scheduled_tasks.lock/`, `runs/`)는 **로컬 전용**입니다. git-ignore하고 커밋하지 마세요.

## 라이선스

MIT © 2026 Mineru98. [LICENSE](LICENSE)를 참고하세요.
