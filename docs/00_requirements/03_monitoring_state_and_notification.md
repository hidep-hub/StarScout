# StarScout 状態・通知設計 検討書

## 1. 基本思想

StarScoutの通知は「監視周期ごとの失敗」を知らせるのではなく、「状態が変化したこと」を知らせる。

これにより通知疲れを防ぐ。

## 2. 状態遷移(決定)

MVPで採用する5状態と遷移は以下の通り。

```text
UNKNOWN ── 初回チェック完了 ──→ NORMAL / DOWN

NORMAL ── 2回連続失敗 ──→ DOWN
NORMAL ── 遅延閾値超過 ──→ WARNING
WARNING ── check OK(閾値内) ──→ NORMAL
WARNING ── 2回連続失敗 ──→ DOWN
DOWN ── check OK ──→ RECOVERED ──→ (次回check OK確定で)NORMAL
```

- UNKNOWNは登録直後・StarScout起動直後で、まだ一度もチェックが完了していない状態にのみ使う。初回チェックが完了した時点でNORMAL/DOWNのいずれかへ遷移し、以降UNKNOWNには戻らない。
- WARNINGは「応答はあるが遅延閾値超過」を表すNORMAL系のサブ状態。DOWN判定基準(2回連続失敗)はWARNING中も同様に適用する。

## 3. 障害検知

例:

```text
10:00:00  HTTP 200 → NORMAL
10:01:00  HTTP 200 → NORMAL
10:02:00  Timeout  → DOWN
10:03:00  Timeout  → DOWN
10:04:00  Timeout  → DOWN
10:05:00  HTTP 200 → RECOVERED
```

通知は原則として、

- 10:02 障害通知
- 10:05 復旧通知

のみとする。

10:03、10:04の失敗では追加通知しない。

## 4. 障害開始時刻

最初に異常を検知した時刻をincident_start_atとして保持する。

これにより、

> 「このサービスはいつから落ちているのか？」

を即座に確認できるようにする。

## 5. 復旧

正常状態に戻った時点をrecovered_atとして記録する。

障害継続時間:

```text
recovered_at - incident_start_at
```

## 6. Windows通知案

障害:

```text
StarScout
🔴 Web API is DOWN

Web API
https://api.example.local

Reason: Timeout
```

復旧:

```text
StarScout
🟢 Web API recovered

HTTP 200
Downtime: 4m 12s
```

WARNING(遅延、監視対象ごとに通知ON/OFF設定時のみ):

```text
StarScout
🟡 Web API is slow

Web API
https://api.example.local

Response time: 1500ms (threshold: 1000ms)
```

## 7. タスクトレイ

### 正常

🟢 StarScout

### 異常

🔴 StarScout

### 複数異常

🔴 2 sites DOWN

Tooltip例:

```text
StarScout
🔴 2 sites DOWN

社内ポータル
HTTP 500

Web API
Timeout
```

## 8. 将来的な通知

MVPではWindows Toastを中心とする。

将来的な候補:

- Teams
- Email
- Webhook
- Slack
- PagerDuty等

ただし、StarScoutの主目的は「通知先を増やすこと」ではなく「人間がすぐ気づくこと」であるため、通知連携を過度に複雑化しない。

## 9. 決定事項(旧: 検討事項)

- 何回連続失敗でDOWNとするか → **2回連続失敗**
- HTTP 3xxを正常とするか → **正常としない**(既定は2xxのみ正常。監視対象ごとに上書き可)
- HTTP 4xxをどう扱うか → **DOWN扱い**
- HTTP 5xxをどう扱うか → **DOWN扱い**
- タイムアウト・接続エラー・DNSエラーをどう扱うか → **すべてDOWN扱い**
- UNKNOWNの意味 → **起動直後・初回チェック未実施の状態のみ**
- WARNINGをMVPに含めるか → **含める**(応答遅延、監視対象ごとに閾値・通知有無を設定可能)

### 9.1 未決事項

- タイムアウト値・WARNING遅延閾値の具体的な既定値(ミリ秒)
- 上記の運用面の既定値は実装技術選定・設計フェーズで確定する
