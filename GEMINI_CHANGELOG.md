# 変更履歴

## 2025-09-09

- 参考になりそうな情報
https://stackblitz.com/edit/react-ts-mtxxop

- **Pyodide `indexURL` の修正:**
  - `client/src/components/Pyodide.tsx` で使用するPyodideの `indexURL` を、プロジェクトで使用しているPyodideのバージョン (`v0.24.0`) に合わせて `https://cdn.jsdelivr.net/pyodide/v0.24.0/full/` に修正しました。これにより、Pyodideが正しいファイルをダウンロードできるようになり、初期化が成功する可能性が高まります。
- **TypeScriptエラーの解消（StackBlitzのコード統合に伴うもの）（継続）:**
  - `client/src/components/Pyodide.tsx` の `evaluatePython` 関数内で、Pyodideインスタンスの正しい参照を使用するように修正しました。
  - `client/src/components/Pyodide.tsx` と `client/src/components/Workspace.tsx` の `React.useContext(PyodideContext)` の呼び出しに非nullアサーション演算子 `!` を追加しました。
  - `client/src/components/PyodideProvider.tsx` にContextの型定義を追加しました。
  - `client/src/App.tsx` の `PyodideProvider` インポートをdefault importに修正し、インポート順序を調整しました。
  - `client/src/components/Pyodide.tsx` のコンポーネントpropsと関数の引数に型定義を追加し、`@ts-ignore` を削除しました。
- **Pyodide統合の抜本的改善（StackBlitzの例を参考に）（継続）:**
  - `client/src/components/PyodideProvider.tsx` と `client/src/components/Pyodide.tsx` を新規作成し、Pyodideインスタンスのロードと管理をContext APIを通じて行うようにしました。
  - `client/src/App.tsx` を修正し、アプリケーション全体を `PyodideProvider` でラップするようにしました。
  - `client/src/components/Workspace.tsx` を全面的に書き換え、Pyodideのロードロジックを削除し、`PyodideContext` からPyodideインスタンスとロード状態を取得するように変更しました。
  - このアプローチにより、Pyodideの初期化とReactのライフサイクルとの間の競合をより堅牢な方法で解決し、安定した実行環境を提供します。
- **Pyodideロード処理に1秒の遅延を追加（継続）:**
  - `client/src/components/Pyodide.tsx` の `useEffect` 内で `window.loadPyodide` の呼び出しを1秒遅延させるようにしました。
- **PyScript関連コンポーネントの遅延ロード（継続）:**
  - `client/src/App.tsx` で `Workspace` コンポーネントを `React.lazy` と `Suspense` を使って遅延ロードするように変更したままです。
- **React StrictMode の一時的な無効化（継続）:**
  - `client/src/index.tsx` から `React.StrictMode` をコメントアウトしたままです。
- **TypeScriptコンパイルエラー `TS2722` の修正（継続）:**
  - `client/src/components/Workspace.tsx` の `window.loadPyodide` の呼び出しに非nullアサーション演算子 `!` を追加したままです。
- **TypeScriptコンパイルエラー `TS2774` の修正（継続）:**
  - `client/src/components/Workspace.tsx` の `window.loadPyodide` の型定義に `?` を追加したままです。
- **`loadPyodide is not available` エラーの最終修正（継続）:**
  - `client/src/components/Workspace.tsx`の`useEffect`フックは、`window.loadPyodide`関数が利用可能になるまでポーリング（待機）する方式のままです。
- **PyScript実行方式の抜本的見直し（継続）:**
  - `client/src/components/Workspace.tsx` は、PyScriptの低レベルAPIである `window.loadPyodide` を直接呼び出す実装のままです。
- **関連ファイルのクリーンアップ（継続）:**
  - `client/public/index.html`には、`core.js`を読み込むための公式の`<link>`と`<script type="module" defer>`タグのみがある状態です。
  - `client/App.tsx`から、一時的に導入した`PyScriptProvider`を削除済みです。

## 2025-09-08

- `client/src/App.tsx`の`UPLOAD PDF`ボタンに`onClick`イベントハンドラを追加し、クリック時にコンソールにメッセージが出力されるようにしました。
- `client/src/components/FileUploadButton.tsx`を更新し、PDFファイルを選択してバックエンドにアップロードする機能を追加しました。
- `server/main.py`を更新し、`/api/upload-pdf`エンドポイントを追加しました。このエンドポイントは、アップロードされたPDFファイルをGemini APIに送信します。