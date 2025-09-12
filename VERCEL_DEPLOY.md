# Vercelフルスタックデプロイ手順

## 事前準備

1. **Supabase でデータベース作成**
   - https://supabase.com/ でプロジェクト作成
   - PostgreSQL URLを取得

2. **Vercelアカウント準備**
   - https://vercel.com/ でサインアップ

## デプロイ手順

### STEP 1: Vercelプロジェクト作成

1. **Vercel Dashboard**
   - https://vercel.com/dashboard
   - "Add New..." > "Project"

2. **リポジトリ選択**
   - GitHubリポジトリを選択
   - Framework: "Other"
   - Root Directory: "." (ルート)

### STEP 2: 環境変数設定

Vercel プロジェクト設定で以下を追加：

```
GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET_KEY=your_jwt_secret_64_chars
DATABASE_URL=postgresql://postgres:[password]@[host]:[port]/[database]
```

### STEP 3: ビルド設定

```
Build Command: cd client && npm install && npm run build
Output Directory: client/build
Install Command: npm install --prefix client && pip install -r server/requirements.txt
```

### STEP 4: デプロイ実行

- "Deploy" ボタンをクリック
- 自動的にビルド・デプロイが開始

## 利点・欠点

### 利点
✅ 1つのサービスで完結
✅ 自動スケーリング
✅ 無料枠が大きい
✅ CDN標準装備

### 欠点
❌ Serverless Functions の制限（実行時間、メモリ）
❌ WebSocket未対応
❌ ファイルストレージの制限

## 制限事項

- **実行時間**: 10秒（Hobby）/ 60秒（Pro）
- **メモリ**: 1GB
- **ファイルアップロード**: 一時的のみ（永続化不可）

## 代替案

もし制限に引っかかる場合：
- **Railway**: バックエンド専用
- **Supabase**: データベース + ストレージ
- **Vercel**: フロントエンドのみ