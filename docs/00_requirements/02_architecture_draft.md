# StarScout アーキテクチャ検討書ドラフト

## 0. 技術スタック

**【決定】** Server / Windows Tray / Dashboard は全てNode.jsで実装する。

理由: SQLite等の軽量DBとの親和性が高く、単一言語でServer・Tray・Dashboardを構成できるためセットアップ・保守コストを抑えられる。

Tray実装方式(Electron / ネイティブ通知連携ライブラリ等)やDBアクセス方式(`node:sqlite` / `better-sqlite3`等)の詳細は、本ドキュメントの構成案・データストア方針が確定した後の実装技術選定時に決定する。

## 1. 基本方針

StarScoutは、監視ロジックとWindows固有の通知・常駐機能を分離できる構成を基本候補とする。

主な構成要素:

```text
┌──────────────────────────────┐
│        StarScout Server      │
│                              │
│  Monitor Engine              │
│       │                      │
│       ├── HTTP/HTTPS Check   │
│       ├── State Management   │
│       └── Incident Detection │
│                              │
│  API / Web Server            │
│       │                      │
│       ├── Dashboard          │
│       └── Settings           │
│                              │
│  Data Store                  │
└──────────────┬───────────────┘
               │ HTTP/HTTPS API
               ▼
┌──────────────────────────────┐
│       StarScout Tray         │
│                              │
│  Windows System Tray         │
│  Toast Notification          │
│  Tooltip                     │
│  Dashboard Launch            │
└──────────────────────────────┘
```

## 2. 構成案A: オールインワンWindows

Windows PC上で以下をすべて動かす。

- Monitor Engine
- Web Server
- Database
- Dashboard
- Settings
- Windows Tray

### メリット

- 個人利用に非常に簡単
- インストールが容易
- localhostだけで完結できる

### デメリット

- PCを停止すると監視も停止する
- 企業で複数人が利用する場合に拡張しにくい

## 3. 構成案B: Monitor Server + Windows Tray

現在の有力候補。

### Server

VM等に配置。

- Monitor Engine
- Web Server
- API
- Database
- Dashboard
- Settings

### Windows Tray

各運用者PCに配置。

- タスクトレイ表示
- サーバー状態取得
- Tooltip
- Toast Notification
- Dashboard起動

### メリット

- 企業環境に適している
- 複数Windowsクライアントで同じ監視状態を共有可能
- Monitor Serverを停止しない限り監視を継続できる
- 個人利用時にはローカルPC上に同じServerを配置することも可能

### デメリット

- オールインワンより構成が複雑
- ServerとTray間の通信設計が必要

## 4. 構成案C: Cloud

クラウド上にMonitor Serverを配置し、Windows Trayから接続する。

現時点では優先度を下げる。

理由:

- MVPとしては過剰
- 内部・ローカルサービス監視との相性に課題がある
- セキュリティ・ネットワーク設計が複雑になる

## 5. 推奨方針

構造としては「Monitor Server + Thin Windows Tray」を基本設計候補とする。

ただし、個人利用ではServerをローカルで動作させることで、同じソフトウェアを個人・企業の双方で利用できる形を目指す。

```text
個人利用

Windows PC
 ├─ StarScout Server
 └─ StarScout Tray
        │
        └─ Browser → Dashboard


企業利用

VM
 └─ StarScout Server
        │
        ├─ Browser → Dashboard
        │
        ├─ Windows Tray
        ├─ Windows Tray
        └─ Windows Tray
```

## 6. データストア検討

ダッシュボードで以下を扱うことを考えると、ログファイルだけではなく構造化データを保存することが望ましい。

- 現在状態
- 監視履歴
- 障害開始時刻
- 復旧時刻
- 障害継続時間
- インシデント件数
- 応答時間
- 稼働率

MVPではSQLite等の軽量DBを候補とする。Node.js採用決定によりSQLiteとの同梱が容易なため、有力候補である。

具体的なアクセス方式(`node:sqlite` / `better-sqlite3`等)の最終決定は実装技術選定時に行う。

## 7. ログ

ログには少なくとも以下を記録する候補とする。

- 日時
- 監視対象
- URL
- HTTPステータス
- 応答時間
- エラー内容
- 状態遷移

監視周期ごとの全リクエストをログに残すか、状態遷移・インシデント中心とするかは設計時に決定する。

## 8. セキュリティ検討事項

企業内で利用する場合、以下を検討する。

- Server APIへのアクセス制御
- HTTPS
- 認証
- 権限管理
- URLに含まれる機密情報の取り扱い
- ログへの機密情報出力防止
- 内部ネットワークからのみアクセス可能とする構成

**【決定】** MVPでは認証・権限管理を実装しない。信頼された内部ネットワーク(閉域網)での利用を前提とし、閲覧(ダッシュボード)・設定変更(Web設定画面)ともに認証なしでアクセス可能とする。この前提はREADME等のドキュメントに明記する。

認証・RBAC等は将来の企業利用拡張(機能ロードマップPhase4)で対応する候補とする。
