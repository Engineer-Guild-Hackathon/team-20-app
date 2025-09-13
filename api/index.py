from fastapi import FastAPI
import logging

# Vercelでログが出力されるように設定
logging.basicConfig(level=logging.INFO)

app = FastAPI()

@app.get("/api/test")
def read_root():
    """
    テスト用のエンドポイント。
    呼び出されるとログを記録し、JSONを返す。
    """
    logging.info("Test endpoint was called successfully!")
    return {"message": "バックエンドは正常に動作しています！"}

# VercelがAPIリクエストを処理するために参照する変数
handler = app
