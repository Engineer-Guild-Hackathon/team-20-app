## 2025-09-13

- Vercelのデプロイでバックエンドの依存関係が正しく解決されるように、`api/requirements.txt` にプロジェクトルートの `requirements.txt` の内容を統合しました。
- **[デバッグ対応]** Vercelでのバックエンドデプロイ問題を調査するため、`api/index.py` を一時的に最小限のテストコードに置き換え。
- **[デバッグ対応]** ビルド失敗の原因を切り分けるため、`api/requirements.txt` の内容を `fastapi` のみに限定。
