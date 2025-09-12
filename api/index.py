from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys
import os

# サーバーディレクトリをパスに追加
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'server'))

try:
    from main import app
except ImportError:
    # フォールバック用の最小限のアプリ
    app = FastAPI()
    
    @app.get("/")
    async def root():
        return {"message": "API is running"}
    
    @app.get("/health")
    async def health():
        return {"status": "healthy"}

# Vercel用の設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番では具体的なドメインに変更
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Vercelのハンドラー
handler = app