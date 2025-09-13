# Client (React TypeScript)

このディレクトリには、Reactを使用したフロントエンドアプリケーションが含まれています。ユーザーインターフェースを提供し、バックエンドAPIと連携して動作します。

## セットアップ

### 1. 依存関係のインストール

`client`ディレクトリに移動し、以下のコマンドで依存関係をインストールします。

```bash
cd client
npm install
# または
yarn install
```

### 2. 環境変数の設定（オプション）

必要に応じて、`.env`ファイルを作成し、環境変数を設定します。
例:
```
REACT_APP_API_BASE_URL=http://localhost:8000
```

## 起動方法

依存関係のインストールが完了したら、以下のコマンドで開発サーバーを起動できます。

```bash
npm start
# または
yarn start
```

アプリケーションは通常、`http://localhost:3000`で利用可能になります。

## 主要コンポーネント

`src/components`ディレクトリには、アプリケーションを構成する主要なUIコンポーネントが含まれています。

-   `AiAssistant.tsx`: AIアシスタント機能
-   `FileUploadButton.tsx`: ファイルアップロード機能
-   `LoginModal.tsx`: ログインモーダル
-   `MyPage.tsx`: マイページ
-   `PdfViewer.tsx`: PDFビューア
-   `RegisterModal.tsx`: 登録モーダル
-   `SummaryHistory.tsx`: 要約履歴
-   `TeamManagement.tsx`: チーム管理
-   `Workspace.tsx`: ワークスペース

## テスト

テストを実行するには、以下のコマンドを使用します。

```bash
npm test
# または
yarn test
```