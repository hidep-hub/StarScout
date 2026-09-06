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

- [ ] URL登録
- [ ] 複数URL
- [ ] HTTP/HTTPS監視
- [ ] ポート指定
- [ ] HTTPステータス取得
- [ ] Timeout検知
- [ ] Connection Error検知
- [ ] DNS Error検知

### State

- [ ] NORMAL
- [ ] WARNING(応答遅延、監視対象ごとに閾値設定)
- [ ] DOWN(2回連続失敗で判定)
- [ ] RECOVERED
- [ ] UNKNOWN(起動直後・初回チェック未実施)
- [ ] 障害開始時刻
- [ ] 復旧時刻
- [ ] 障害継続時間

### Windows

- [ ] System Tray
- [ ] 状態に応じたアイコン
- [ ] Tooltip
- [ ] Windows Toast(DOWN/RECOVERED)
- [ ] Windows Toast(WARNING、監視対象ごとにON/OFF設定可)
- [ ] Dashboard起動

### Web

- [ ] Dashboard
- [ ] URL登録画面
- [ ] 監視設定画面(正常ステータス上書き、WARNING遅延閾値、WARNING通知ON/OFF含む)
- [ ] 現在の障害一覧
- [ ] 障害履歴

### Storage

- [ ] 軽量DB
- [ ] 監視対象情報
- [ ] 状態
- [ ] Incident情報

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
