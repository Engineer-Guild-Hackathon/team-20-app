import sys
import os

# プロジェクトルートを追加
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

# サーバーディレクトリを追加
server_path = os.path.join(project_root, 'server')
sys.path.insert(0, server_path)

try:
    # サーバーのmain.pyからappをインポート
    from server.main import app
    
    # Vercel用のハンドラーとして設定
    handler = app
    
except ImportError as e:
    print(f"Import error: {e}")
    # フォールバック用の最小限のアプリ
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    
    app = FastAPI()
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    @app.get("/")
    async def root():
        return {"message": "API is running (fallback)"}
    
    @app.get("/health")
    async def health():
        return {"status": "healthy"}
      
    handler = app