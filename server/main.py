from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="Team 20 API", version="1.0.0")

# CORS設定 - フロントエンドからのアクセスを許可
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Reactアプリのポート
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """ルートエンドポイント"""
    return {"message": "Team 20 API へようこそ！"}

@app.get("/api/health")
async def health_check():
    """ヘルスチェック用エンドポイント"""
    return {"status": "healthy", "message": "サーバーは正常に動作しています"}

@app.get("/api/hello/{name}")
async def say_hello(name: str):
    """挨拶エンドポイント"""
    return {"message": f"こんにちは、{name}さん！"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)