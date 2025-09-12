# Server (Python FastAPI)

このディレクトリには、PythonのFastAPIを使用したバックエンドAPIサーバーが含まれています。

## セットアップ

### 1. 仮想環境の作成と有効化

```bash
cd server
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### 2. 依存関係のインストール

```bash
pip install -r requirements.txt
```

### 3. 環境変数の設定（オプション）

```bash
cp .env.example .env
# .envファイルを編集して必要な環境変数を設定
```

## 起動方法

```bash
# 開発サーバーの起動
python main.py

# または
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

サーバーは http://localhost:8000 で起動します。

## API ドキュメント

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## エンドポイント

- `GET /` - ルートエンドポイント
- `GET /api/health` - ヘルスチェック
- `GET /api/hello/{name}` - 挨拶エンドポイント