from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys
import os

# サーバーディレクトリをパスに追加
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'server'))

from server.main import app

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