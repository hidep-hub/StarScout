# StarScout アーキテクチャ検討書ドラフト

## 0. 技術スタック

**【決定】** Server / Windows Tray / Dashboard は全てNode.jsで実装する。

理由: SQLite等の軽量DBとの親和性が高く、単一言語でServer・Tray・Dashboardを構成できるためセットアップ・保守コストを抑えられる。

**【決定・SS-005】** Tray実装技術は **Electron** を採用する。

理由: Windows System Tray / Toast Notification / Tooltipを標準APIで一通りカバーでき、実装速度・保守性が高い。常駐アプリとしてのメモリ消費(概ね100〜200MB程度)は許容範囲と判断する。将来的に軽量化が必要になった場合は`node-notifier`+ネイティブtrayライブラリ構成への移行を検討する。

**【決定・SS-005】** DBアクセス方式は **`node:sqlite`** を採用する。

理由: Node.js組み込みのネイティブモジュールであり、`better-sqlite3`のようなネイティブアドオンのビルド・prebuiltバイナリ配布に依存しない。追加依存を減らせる点を優先した。

注意点: `node:sqlite`は導入時点でexperimental機能であるため、採用するNode.jsバージョンの前提(最低要求バージョン)を実装技術選定・環境構築時に明記し、READMEやセットアップ手順に反映すること。将来Node.jsのAPI変更があった場合の追従コストは許容する前提とする。

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

**【決定・SS-005】** 具体的なアクセス方式は `node:sqlite` を採用する(詳細・理由は「0. 技術スタック」参照)。

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

**【決定】** 監視履歴/ログの保持期間は90日とする。90日超過分の自動削除ロジックをMVPで実装するかは設計フェーズで判断する。

## 9. リポジトリ構成

**【決定】** モノレポ構成とする。Server / Windows Tray / Dashboard を `hidep-hub/StarScout` 単一リポジトリに集約する。

**【決定・SS-005】** パッケージ管理は **npm workspaces** を採用する。追加ツール(pnpm/Turborepo/Nx等)は導入せず、npm標準機能のみで構成する。MVP規模(Server/Tray/Dashboardの3パッケージ程度)には十分と判断する。

パッケージ構成案:

```text
packages/
  server/     … Monitor Engine, API/Web Server, Data Store
  tray/       … Windows Tray(Electron)
  dashboard/  … Web Dashboard
  shared/     … 型定義・共通ユーティリティ等(必要に応じて)
```

具体的なディレクトリ名・パッケージ名は実装着手時に確定する。

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

## 10. Server⇔Tray通信プロトコル(SS-005決定)

**【決定・SS-005】** Server⇔Tray間の通信は **REST/HTTPポーリング** を採用する。

方式:

- Trayは数秒〜十数秒間隔で、ServerのAPI(例: `GET /api/status`)を定期的にポーリングする。
- Server側に新規のプッシュ機構(WebSocket/SSE等)は設けない。

理由:

- 監視間隔自体が既定1分であり、状態変化の検知にはもともとその程度の遅延が織り込まれている。ポーリング間隔を数秒〜十数秒に設定すれば、体感上の即時性は十分確保できる。
- HTTPクライアントのみで完結するため、Tray側の実装・再接続処理・保守コストが最も小さい。
- 複数Windows Trayが同一Serverへ接続する企業利用構成(構成案B)でも、コネクション管理が不要でシンプルに拡張できる。

将来的な拡張候補: より高いリアルタイム性が必要になった場合、SSE(Server→Tray一方向プッシュ)への切り替えを検討する。MVPでは対象外とする。

## 11. Serverポート設計(SS-005決定)

**【決定・SS-005】** Serverの待受ポートは起動時設定ファイル(config.json等)で指定する。インストール(セットアップ)時にポート番号を指定でき、以降はServer起動時にその設定ファイルを読み込む。

**【決定・SS-005】** 既定ポート番号は **3300** とする。

理由:

- 起動パラメータであり、FR-015で「真のデータ」と定めた監視対象設定(DB管理)とは別次元のため、設定ファイルで管理しDBの二重管理を避ける。
- 環境変数よりも設定ファイルの方が発見性・引き継ぎのしやすさで優れ、インストール時に値を確定させる運用と相性が良い。
- 既定値3300は、同一環境で稼働しうる他社内ツール(例: backlog-hubの3333)との衝突を避けつつ覚えやすい番号として選定した。
