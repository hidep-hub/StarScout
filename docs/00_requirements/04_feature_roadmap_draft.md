# StarScout 機能ロードマップ ドラフト

## Phase 0: コンセプト

目的:

> 利用者に言われる前に、サービス異常へ気づく。

基本価値:

- お手軽
- 常にタスクトレイ
- すぐ気づく

## Phase 1: MVP

### Monitoring

- [x] URL登録
- [x] 複数URL
- [x] HTTP/HTTPS監視
- [x] ポート番号(任意項目、Phase3 TCP/Ping監視向けの補助フィールド)(※DBスキーマ・APIは対応済み。Web UIからの入力欄は未実装)
- [x] HTTPステータス取得
- [x] Timeout検知
- [x] Connection Error検知
- [x] DNS Error検知

### State

- [x] NORMAL
- [x] WARNING(応答遅延、監視対象ごとに閾値設定)
- [x] DOWN(2回連続失敗で判定)
- [x] RECOVERED
- [x] UNKNOWN(起動直後・初回チェック未実施)
- [x] 障害開始時刻
- [x] 復旧時刻
- [x] 障害継続時間

### Windows

- [x] System Tray
- [x] 状態に応じたアイコン
- [x] Tooltip
- [x] Windows Toast(DOWN/RECOVERED)
- [x] Windows Toast(WARNING、監視対象ごとにON/OFF設定可)
- [x] Dashboard起動

### Web

- [x] Dashboard
- [x] URL登録画面
- [x] 監視設定画面(正常ステータス上書き、WARNING遅延閾値、WARNING通知ON/OFF含む)
- [x] 現在の障害一覧(監視対象一覧テーブルの状態バッジで確認可能)
- [ ] 障害履歴(APIは実装済み `GET /api/targets/:id/history`・`/incidents` だが、閲覧するWeb UIは未実装)

### Storage

- [x] 軽量DB
- [x] 監視対象情報
- [x] 状態
- [x] Incident情報

## Phase 2: 利便性向上

- [ ] 応答時間表示
- [ ] 応答時間グラフ
- [ ] 稼働率
- [ ] インシデント統計
- [ ] Page Title確認
- [ ] Page Title変更検知
- [ ] Keywordチェック
- [ ] Expected Status設定
- [ ] 監視間隔設定
- [ ] Timeout設定

## Phase 3: 監視機能拡張

- [ ] JSONレスポンスチェック
- [ ] SSL証明書期限
- [ ] DNS監視
- [ ] TCP監視
- [ ] ICMP/Ping
- [ ] 外部監視
- [ ] 複数監視拠点

## Phase 4: 企業利用

- [ ] 認証
- [ ] RBAC
- [ ] HTTPS
- [ ] 複数ユーザー
- [ ] 監査ログ
- [ ] API
- [ ] Webhook
- [ ] Teams連携

## 重要な優先順位

機能を増やすことより、以下を優先する。

1. セットアップが簡単
2. 監視登録が簡単
3. 状態が一目でわかる
4. 異常にすぐ気づける
5. 通知がうるさくない
6. 障害開始時刻がわかる
7. 復旧がわかる

## プロダクト原則

> StarScoutは「全部入り監視製品」にならない。

Zabbix等の代替を目指すのではなく、

> 「Zabbixを見るほどではないが、落ちたら困る」

という領域を簡単に監視する。

そして、

> 「あっ、落ちてる」

を最短距離で運用者へ届ける。
