# CogniStudy デプロイ手順（Vercel + Railway）

## 前提条件
- GitHubアカウント
- Vercelアカウント（GitHub連携）
- Railwayアカウント（GitHub連携）

## STEP 1: GitHubリポジトリの準備

1. GitHubでリポジトリを作成
2. ローカルコードをプッシュ：
```bash
git add .
git commit -m "Ready for deployment"
git push origin deploy
```

## STEP 2: Railway（バックエンド）デプロイ

1. **Railway.app にログイン**
   - https://railway.app/
   - "Login with GitHub"でサインイン

2. **新しいプロジェクト作成**
   - "New Project" → "Deploy from GitHub repo"
   - `team-20-app` リポジトリを選択

3. **環境変数を設定**
   - プロジェクトの "Variables" タブで設定：
   ```
   GEMINI_API_KEY=あなたのGeminiAPIキー
   JWT_SECRET_KEY=ランダムな64文字の文字列
   DATABASE_URL=postgresql://... (Railwayが自動生成)
   PORT=8000
   ```

4. **PostgreSQLデータベース追加**
   - "Add service" → "Database" → "PostgreSQL"
   - 自動的にDATABASE_URLが設定される

5. **デプロイ確認**
   - 自動的にビルド・デプロイが開始
   - "Deployments" タブで進行状況を確認
   - 完了後、URLが発行される（例：`https://team-20-app-production.up.railway.app`）

## STEP 3: Vercel（フロントエンド）デプロイ

1. **Vercel.com にログイン**
   - https://vercel.com/
   - "Continue with GitHub"でサインイン

2. **プロジェクトをインポート**
   - "Add New..." → "Project"
   - GitHubから `team-20-app` を選択

3. **ビルド設定**
   - Framework Preset: "Create React App"
   - Root Directory: `client`
   - Build Command: `npm run build`
   - Output Directory: `build`

4. **環境変数を設定**
   - "Environment Variables" セクション：
   ```
   REACT_APP_API_URL=https://あなたのRailwayのURL
   ```

5. **デプロイ実行**
   - "Deploy" ボタンをクリック
   - 完了後、VercelのURLが発行される

## STEP 4: CORS設定の更新

1. **server/main.py を更新**：
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://あなたのVercelドメイン.vercel.app"
    ],
    # ...
)
```

2. **変更をプッシュ**：
```bash
git add .
git commit -m "Update CORS for production"
git push origin deploy
```

3. **Railwayで自動再デプロイされることを確認**

## STEP 5: 動作確認

1. **バックエンド確認**
   - `https://あなたのRailwayURL/api/health` にアクセス
   - `{"status": "healthy", "message": "サーバーは正常に動作しています"}` が表示されればOK

2. **フロントエンド確認**
   - Vercelで発行されたURLにアクセス
   - CogniStudyが正常に表示されることを確認

3. **統合テスト**
   - ユーザー登録・ログイン
   - PDFアップロード・要約生成
   - チーム作成・共有機能

## トラブルシューティング

### よくある問題

1. **CORS エラー**
   - `server/main.py` のallow_originsにVercelのURLが含まれているか確認

2. **環境変数エラー**
   - Railway、VercelそれぞれでAPI_KEY等が正しく設定されているか確認

3. **データベース接続エラー**
   - RailwayのPostgreSQLサービスが起動しているか確認

4. **ビルドエラー**
   - `requirements.txt` と `package.json` の依存関係を確認

## 更新・再デプロイ

コードを更新する場合：
```bash
git add .
git commit -m "Update message"
git push origin deploy
```

Railway、Vercel両方で自動的に再デプロイされます。