import logging
import time
from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Depends, status, Header, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from passlib.context import CryptContext
import uvicorn
import os
from dotenv import load_dotenv
from google import genai
from google.genai import types
import base64
from sqlalchemy.orm import Session
from .database import Base, engine, SessionLocal, User, SummaryHistory
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional

# ログ設定
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = FastAPI(title="Team 20 API", version="1.0.0")

# データベーステーブルを作成
Base.metadata.create_all(bind=engine)

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

# データベースセッションの依存性注入
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# .envファイルから環境変数を読み込む
logging.info("Attempting to load .env file...")
if load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env')):
    logging.info(".env file loaded successfully.")
else:
    logging.warning(".env file not found or failed to load.")

# Gemini APIキーを設定
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise ValueError("GEMINI_API_KEY not found in .env file")

# パスワードハッシュ化のためのコンテキスト
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT設定
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-super-secret-jwt-key") # 環境変数またはデフォルトを使用
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- 認証関連の依存関係 ---

# トークンを検証し、ユーザー名を返す（旧来の保護されたルート用、主にサンプル）
def verify_access_token(token: str, credentials_exception):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        return username
    except JWTError:
        raise credentials_exception

# 任意認証：ヘッダーからトークンを取得し、ユーザーオブジェクトを返す
async def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> Optional[User]:
    if authorization is None:
        return None
    
    token_prefix = "Bearer "
    if not authorization.startswith(token_prefix):
        return None # スキームが不正
        
    token = authorization.split(" ")[1]

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
    except JWTError:
        return None

    user = db.query(User).filter(User.username == username).first()
    return user

# 必須認証：トークンからユーザーオブジェクトを取得する
def get_required_user(authorization: str = Header(...), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="無効な認証情報です",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token_prefix = "Bearer "
    if not authorization.startswith(token_prefix):
        raise credentials_exception
        
    token = authorization.split(" ")[1]
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user



class ChatRequest(BaseModel):
    message: str

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str

class SaveSummaryRequest(BaseModel):
    filename: str
    summary: str

@app.post("/api/register")
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """ユーザー登録エンドポイント"""
    existing_user = db.query(User).filter(User.username == request.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="ユーザー名は既に存在します")

    hashed_password = pwd_context.hash(request.password)
    new_user = User(username=request.username, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "ユーザー登録成功！", "username": new_user.username}

@app.post("/api/login")
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """ユーザーログインエンドポイント"""
    user = db.query(User).filter(User.username == request.username).first()
    if not user:
        raise HTTPException(status_code=401, detail="無効な認証情報です")

    if not pwd_context.verify(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効な認証情報です",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/")
async def root():
    """ルートエンドポイント"""
    return {"message": "Team 20 API へようこそ！"}

@app.get("/api/protected")
async def protected_route(token: str = Depends(verify_access_token)):
    """保護されたエンドポイント - JWT認証が必要"""
    return {"message": f"認証成功！ユーザー: {token}"}

@app.get("/api/health")
async def health_check():
    """ヘルスチェック用エンドポイント"""
    return {"status": "healthy", "message": "サーバーは正常に動作しています"}

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """チャットエンドポイント"""

    client = genai.Client(api_key=API_KEY)
    try:
        # 新しいモデル名に変更
        response = client.models.generate_content(
            model='gemini-2.0-flash-001', contents=request.message
        )
        
        logging.info(f"Generated response: {response.text}")
        
        if not response or not response.text:
            return {"reply": "応答なし！"}
            
        return {"reply": response.text}
    except Exception as e:
        logging.error(f"Error in chat endpoint: {str(e)}")
        # エラーハンドリングを有効化
        raise HTTPException(status_code=500, detail=f"AI応答エラー: {str(e)}")

@app.post("/api/upload-pdf")
async def upload_pdf(
    file: UploadFile = File(...), 
    save_history: bool = Form(True), # 追加
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """PDF アップロードと要約生成エンドポイント（任意認証）"""
    try:
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="PDFファイルのみアップロード可能です")
        
        if file.size > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="ファイルサイズが大きすぎます (10MB以下にしてください)")
        
        file_content = await file.read()
        base64_content = base64.b64encode(file_content).decode('utf-8')
        
        client = genai.Client(api_key=API_KEY)
        
        response = client.models.generate_content(
            model='gemini-2.0-flash-001',
            contents=[
                {
                    'parts': [
                        {'text': 'このPDFファイルの内容を日本語で要約してください。要点を箇条書きで整理し、わかりやすく説明してください。'},
                        {'inline_data': {'mime_type': 'application/pdf', 'data': base64_content}}
                    ]
                }
            ]
        )
        
        logging.info(f"PDF summary generated for file: {file.filename}")
        
        if hasattr(response, 'text') and response.text:
            summary = response.text
        elif hasattr(response, 'candidates') and response.candidates:
            summary = response.candidates[0].content.parts[0].text
        else:
            summary = "要約の生成に失敗しました"
        
        # ログインしており、かつ保存オプションが有効な場合のみ履歴を保存
        if current_user and save_history: # 条件追加
            new_history = SummaryHistory(
                user_id=current_user.id,
                filename=file.filename,
                summary=summary
            )
            db.add(new_history)
            db.commit()
            logging.info(f"Summary history saved for user: {current_user.username}")

        return {
            "filename": file.filename,
            "summary": summary,
            "status": "success"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in upload_pdf endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"PDF処理エラー: {str(e)}")

@app.get("/api/hello/{name}")
async def say_hello(name: str):
    """挨拶エンドポイント"""
    return {"message": f"こんにちは、{name}さん！"}

@app.get("/api/summaries")
async def get_summaries(current_user: User = Depends(get_required_user), db: Session = Depends(get_db)):
    """認証されたユーザーの要約履歴を取得する"""
    summaries = db.query(SummaryHistory).filter(SummaryHistory.user_id == current_user.id).order_by(SummaryHistory.created_at.desc()).all()
    return summaries

@app.post("/api/save-summary")
async def save_summary(
    request: SaveSummaryRequest,
    current_user: User = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    """要約をデータベースに保存するエンドポイント"""
    try:
        new_history = SummaryHistory(
            user_id=current_user.id,
            filename=request.filename,
            summary=request.summary
        )
        db.add(new_history)
        db.commit()
        db.refresh(new_history)
        logging.info(f"Summary saved via /api/save-summary for user: {current_user.username}")
        return {"message": "要約が正常に保存されました", "id": new_history.id}
    except Exception as e:
        logging.error(f"Error saving summary via /api/save-summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"要約の保存中にエラーが発生しました: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)