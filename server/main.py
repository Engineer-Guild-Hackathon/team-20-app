import logging
import time
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
from dotenv import load_dotenv
import google.generativeai as genai

# ログ設定
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = FastAPI(title="Team 20 API", version="1.0.0")

# CORS設定 - フロントエンドからのアクセスを許可
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Reactアプリのポート
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ログミドルウェア
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    
    logging.info(
        f"ip={request.client.host} method={request.method} path={request.url.path} "
        f"status_code={response.status_code} process_time={process_time:.4f}s"
    )
    
    return response

# .envファイルから環境変数を読み込む
logging.info("Attempting to load .env file...")
if load_dotenv():
    logging.info(".env file loaded successfully.")
else:
    logging.warning(".env file not found or failed to load.")

# Gemini APIキーを設定
api_key = "YOUR_API"#os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY not found in .env file")
genai.configure(api_key=api_key)

class ChatRequest(BaseModel):
    message: str

@app.get("/")
async def root():
    """ルートエンドポイント"""
    return {"message": "Team 20 API へようこそ！"}

@app.get("/api/health")
async def health_check():
    """ヘルスチェック用エンドポイント"""
    return {"status": "healthy", "message": "サーバーは正常に動作しています"}

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """チャットエンドポイント"""
    try:
        # 新しいモデル名に変更
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(request.message)
        
        logging.info(f"Generated response: {response}")
        
        if not response or not response.text:
            return {"reply": "応答なし！"}
            
        return {"reply": response.text}
    except Exception as e:
        logging.error(f"Error in chat endpoint: {str(e)}")
        # エラーハンドリングを有効化
        raise HTTPException(status_code=500, detail=f"AI応答エラー: {str(e)}")

@app.get("/api/hello/{name}")
async def say_hello(name: str):
    """挨拶エンドポイント"""
    return {"message": f"こんにちは、{name}さん！"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)