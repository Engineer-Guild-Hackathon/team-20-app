# Team 20 App

フルスタック Web アプリケーション（React + Python FastAPI）

## チーム情報
- チーム番号: 20
- チーム名: IPUT_OK
- プロダクト名: Reproduce Hub
- メンバー: 福留陽希、平山結也、中島主税、大松隼翔、山口ちひろ、赤松志優、共田仁俊

---

## デモ　/ プレゼン資料
- デモURL: 
- プレゼンURL：https://docs.google.com/presentation/d/1jvpwPno4Xsct4s_-x2TKKr6VRkYCWcj-/edit?usp=sharing&ouid=116940754129608060449&rtpof=true&sd=true

---

## プロジェクト構造

```
team-20-app/
├── client/                 # フロントエンド (React + TypeScript)
│   ├── src/               # Reactソースコード
│   ├── public/            # 静的ファイル
│   └── package.json       # フロントエンド依存関係
├── server/                # バックエンド (Python FastAPI)
│   ├── main.py           # FastAPIメインアプリ
│   ├── requirements.txt   # Python依存関係
│   └── README.md         # サーバー固有のドキュメント
├── package.json          # ルートレベル設定
└── README.md             # このファイル
```

## 必要な環境

- **Node.js** (v14以上) - フロントエンド用
- **Python** (v3.8以上) - バックエンド用
- **npm** - パッケージ管理

## クイックスタート

### 1. すべての依存関係をインストール

```bash
npm run install:all
```

### 2. 開発サーバーの起動

```bash
npm run dev
```

このコマンドで同時に起動されます：
- フロントエンド: http://localhost:3000
- バックエンド: http://localhost:8000

## 個別の操作

### フロントエンドのみ起動
```bash
npm run dev:client
```

### バックエンドのみ起動
```bash
npm run dev:server
```

### プロダクションビルド
```bash
npm run build
```

## API ドキュメント

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## ディレクトリ別の詳細情報

- [フロントエンド (client/)](./client/README.md)
- [バックエンド (server/)](./server/README.md)
