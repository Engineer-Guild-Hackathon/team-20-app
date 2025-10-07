# Team 20 App

フルスタック Web アプリケーション（React + Python FastAPI）

---

## チーム情報
- チーム番号: 20
- チーム名: IPUT_OK
- プロダクト名: Reproduce Hub
- メンバー: 福留陽希、平山結也、中島主税、大松隼翔、山口ちひろ、赤松志優、共田仁俊

---

## 開発手法
- スクラム開発
- 共有に使用したmiro: https://miro.com/welcomeonboard/RXB0VVN5K3pGejlocUNxRFFJd1MyQVdka0FmQnYyYTIwWER5UGlCZldOajJGVkhkNEl1QTRkU0ZxSHk0bzJ1b1lDZ3M4LzJXYllydUE0blVlMDQzcDdHTjlVeDhDMEgzdHg3Mm1aL2tCcjlaeG1FTEpTSzZtMlVCOUYralp1UG5QdGo1ZEV3bUdPQWRZUHQzSGl6V2NBPT0hdjE=?share_link_id=263162362613

## 役割
- スクラムマスター: 共田
- プロダクトオーナー: 共田、中島
- プレゼンテーション: 大松、山口、赤松
- テックリード: 平山
- エンジニア: 共田、福留、中島


## デモ　/ プレゼン資料
- デモURL: https://team-20-app-client-tau.vercel.app/
- プレゼンURL：https://docs.google.com/presentation/d/1jvpwPno4Xsct4s_-x2TKKr6VRkYCWcj-/edit?usp=sharing&ouid=116940754129608060449&rtpof=true&sd=true

---

## 機能
このアプリケーションは、以下の主要な機能を提供します。

- **PDFファイルのアップロードとAIによる要約生成**: PDFファイルをアップロードし、AIがその内容を自動的に要約します。
- **AIアシスタントとのチャット**: 要約されたPDFの内容に基づいてAIアシスタントと対話し、質問応答が可能です。
- **ユーザー認証**: 新規登録、ログイン、ログアウト機能により、セキュアなアクセスを提供します。
- **要約履歴管理**: 生成された要約は履歴として保存され、いつでも閲覧・再利用できます。
- **チーム管理**: チームを作成し、メンバーを招待・管理できます。
- **チーム内ファイル共有**: チームメンバー間でファイルを共有し、共同作業を促進します。
- **チーム内メッセージング**: チーム専用のチャット機能で、メンバー間のコミュニケーションを円滑にします。
- **要約へのコメントとリアクション**: 要約に対してコメントを残したり、リアクションを付けたりして、議論を深めることができます。
- **要約へのタグ付け**: 要約にタグを付けて分類し、検索性を向上させます。

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

---

### 2. 開発サーバーの起動

```bash
npm run dev
```

このコマンドで同時に起動されます：
- フロントエンド: http://localhost:3000
- バックエンド: http://localhost:8000

---

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

---

## API ドキュメント

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## ディレクトリ別の詳細情報

- [フロントエンド (client/)](./client/README.md)
- [バックエンド (server/)](./server/README.md)
