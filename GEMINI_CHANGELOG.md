## 2025年09月13日

### Vercelデプロイ設定の修正

- **目的:** Vercelにデプロイした際にバックエンド(FastAPI)との通信が失敗する問題を解決し、フロントエンド(React)のルーティングを安定させる。

### 変更点

1.  **`server/main.py` の修正:**
    - FastAPIの `CORSMiddleware` の設定を更新。
    - **変更前:** 特定の本番URLのみを許可していた。
    - **変更後:** 以下からのアクセスを許可するように修正。
        - 本番URL: `https://iputreproducehub.vercel.app`
        - ローカル開発環境: `http://localhost:3000`
        - Vercelの全プレビュー環境 (正規表現を使用: `https://iputreproducehub-.*\.vercel\.app`)

2.  **`vercel.json` の修正:**
    - `routes` の設定を全面的に更新。
    - APIリクエスト (`/api/.*`) を正しくバックエンドにルーティング。
    - Reactの静的ファイル (`/static/*`, `favicon.ico` など) へのパスを修正。
    - 上記以外のすべてのリクエストを `client/build/index.html` にフォールバックさせることで、React Routerによるクライアントサイドでのページ遷移が正しく機能するようにした（SPA対応）。