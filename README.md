# StarScout
<img width="783" height="117" alt="image" src="https://github.com/user-attachments/assets/bd8f8e99-3aa8-49b7-9046-8d5783bca1b7" />

Webサービスや内部サービスを手軽に登録して定期監視し、異常発生時に運用者が「利用者に言われる前に」気づけるようにする軽量な監視ツールです。

- **Monitor**: 登録したURLを定期的にチェック
- **Notify**: 異常検知時にWindows Toast通知
- **Stay Alert**: Windowsタスクトレイに常駐し、常に状態を視界の片隅に

詳しいコンセプト・要件は [docs/00_requirements](docs/00_requirements) を参照してください。

## 構成

npm workspacesによるモノレポ構成です。

| パッケージ | 役割 |
| --- | --- |
| `packages/server` | Monitor Engine・REST API・Webダッシュボード・SQLiteデータストア |
| `packages/tray` | Windows タスクトレイ常駐アプリ(Electron)。Serverへポーリングし状態アイコン表示・Toast通知 |

## セットアップ

前提: Node.js 24以上

```bash
npm install
```

### 1. Serverを起動する

```bash
npm run start --workspace=@starscout/server
```

初回起動時に `packages/server/data/config.json` が自動生成されます(既定ポート **3300**)。ポートを変更したい場合はこのファイルを編集してからServerを再起動してください。

### 2. ダッシュボードを開く

ブラウザで [http://localhost:3300](http://localhost:3300) を開きます。「+ 新規登録」から監視したいURLを登録すると、即座に監視が始まります。

### 3. Trayを起動する(任意)

```bash
npm run start --workspace=@starscout/tray
```

初回起動時に `packages/tray/data/config.json` が自動生成されます(既定 `serverUrl: http://localhost:3300`)。Serverを別ホストで動かす場合はこのファイルを編集してください。

タスクトレイに状態アイコン(緑=正常 / 黄=警告 / 赤=異常)が表示され、右クリックメニューからダッシュボードを開く・終了ができます。

### 4. (任意) Trayをexe化する

開発モード(`electron .`)のままだとWindowsの「タスクバーに表示するアイコンを選択」設定にElectronとして表示されてしまうため、配布・常用するには実行ファイル化を推奨します。

```bash
npm run dist --workspace=@starscout/tray
```

`packages/tray/dist/StarScout <version>.exe` (ポータブル版、インストール不要でそのまま実行可能)が生成されます。パッケージ版はconfig.jsonを `%APPDATA%\StarScout\config.json` に保存します(開発モードは `packages/tray/data/config.json` のまま)。

## セキュリティに関する注意

MVPでは認証・権限管理を実装していません。信頼された内部ネットワーク(閉域網)での利用を前提としています。インターネットに公開されたネットワークでの利用は避けてください。

## 開発

```bash
npm test --workspaces
```

各パッケージの `test/` 配下にNode.js標準の `node --test` によるテストがあります。
