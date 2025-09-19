import logging
import time
import json
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
from sqlalchemy.orm import Session, joinedload
from database import Base, engine, SessionLocal, User, UserSession, SummaryHistory, Team, TeamMember, Comment, HistoryContent, SharedFile, Reaction, Message, AiSummaryResponse
# (SQLite-specific migration utilities removed)
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any, Union
import uuid
from fastapi.responses import Response
import re # 追加
from starlette.concurrency import run_in_threadpool
from collections import defaultdict
from sentence_transformers import SentenceTransformer, util

import torch # NEW: torchをインポート

# Lazy initialize SentenceTransformer to avoid long cold-start
embedding_model = None

def get_embedding_model():
    global embedding_model
    if embedding_model is None:
        embedding_model = SentenceTransformer('all-mpnet-base-v2')
    return embedding_model

# Files are stored in PostgreSQL (SharedFile.content); no local storage is used.

# ログ設定
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

app = FastAPI(title="Team 20 API", version="1.0.0")

# データベーステーブルを作成（初回起動時のみ作成）
Base.metadata.create_all(bind=engine)

# CORS設定 - フロントエンドからのアクセスを許可
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
allowed_origin_regex = os.getenv("ALLOWED_ORIGINS_REGEX", "").strip()
allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]

# Helpful debug logs
logging.info(f"CORS: ALLOWED_ORIGINS={allowed_origins}")
if allowed_origin_regex:
    logging.info(f"CORS: ALLOWED_ORIGINS_REGEX={allowed_origin_regex}")

if allowed_origin_regex:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[],
        allow_origin_regex=allowed_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
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
    pdf_summary: Optional[str] = None
    summary_id: Optional[int] = None
    # Accept both int and str IDs from client for compatibility
    original_file_paths: Optional[List[Union[int, str]]] = None
    parent_summary_id: Optional[int] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str

class SessionDataRequest(BaseModel):
    session_data: str

class SaveSummaryRequest(BaseModel):
    filename: str
    summary: str
    team_id: Optional[int] = None # 追加
    tags: Optional[List[str]] = None # 追加
    # Accept both int and str IDs from client
    original_file_path: Optional[List[Union[int, str]]] = None
    ai_chat_history: Optional[str] = None # 追加: AI Assistantのチャット履歴 (JSON文字列)
    parent_summary_id: Optional[int] = None # NEW FIELD

class TagsUpdateRequest(BaseModel):
    tags: List[str]

class TeamCreateRequest(BaseModel):
    name: str

class CommentCreateRequest(BaseModel):
    summary_id: int
    content: str

class ReactionCreateRequest(BaseModel):
    reaction_type: str

class SummaryTitleUpdateRequest(BaseModel):
    filename: str

class ReactionResponse(BaseModel):
    id: int
    comment_id: int
    user_id: int
    username: str
    reaction_type: str
    created_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
        }


class HistoryContentCreateRequest(BaseModel):
    summary_history_id: int
    section_type: str
    content: str # JSON string
    question_text: Optional[str] = None # NEW FIELD
    ai_answer_text: Optional[str] = None # NEW FIELD
    user_provided_summary: Optional[str] = None # NEW FIELD: ユーザーが提供する要約

class HistoryContentResponse(BaseModel):
    id: int
    summary_history_id: int
    section_type: str
    content: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
        }

class SummaryListItemResponse(BaseModel):
    id: int
    filename: str
    summary: str
    created_at: datetime
    team_id: Optional[int] = None
    username: Optional[str] = None
    team_name: Optional[str] = None
    tags: List[str] = []
    chat_history_id: Optional[int] = None  # チャット履歴IDを追加
    # IDs may be stored as strings or ints
    original_file_path: Optional[List[Union[int, str]]] = None
    parent_summary_id: Optional[int] = None # NEW FIELD

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
        }

class SummaryHistoryDetailResponse(BaseModel):
    id: int
    user_id: int
    team_id: Optional[int] = None
    filename: str
    summary: str
    created_at: datetime
    contents: Optional[List[HistoryContentResponse]] = None # 変更
    original_file_path: Optional[List[Union[int, str]]] = None
    parent_summary_id: Optional[int] = None # NEW FIELD

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
        }


class SharedFileResponse(BaseModel):
    id: int
    filename: str
    team_id: int
    uploaded_by_user_id: int
    uploaded_by_username: str
    uploaded_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
        }

class MessageCreateRequest(BaseModel):
    content: str

class MessageResponse(BaseModel):
    id: int
    team_id: int
    user_id: int
    username: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
        }

class GraphNode(BaseModel):
    id: str
    label: str
    type: str # 'summary', 'user_question'
    summary_id: Optional[int] = None # For chat messages, links back to the summary
    question_id: Optional[str] = None # For user question nodes, unique ID within the chat
    ai_answer: Optional[str] = None # For user question nodes, stores the AI's answer
    ai_answer_summary: Optional[str] = None # NEW FIELD: Stores the summarized AI answer
    parent_summary_id: Optional[int] = None # NEW FIELD
    question_created_at: Optional[datetime] = None # NEW FIELD
    summary_created_at: Optional[datetime] = None # NEW FIELD
    category: Optional[str] = None # NEW FIELD: Add category to GraphNode
    history_content_id: Optional[int] = None # NEW FIELD: Reference to HistoryContent.id
    original_summary_id: Optional[int] = None # NEW FIELD: 質問が紐づく元の要約ID
    grouped_question_ids: Optional[List[str]] = None # NEW FIELD: 統合された質問ノードのIDリスト
    original_questions_details: Optional[List[Dict[str, Any]]] = None # NEW FIELD: 統合された質問の詳細


class GraphLink(BaseModel):
    source: str
    target: str
    type: Optional[str] = None
    directed: Optional[bool] = True # NEW FIELD: エッジの方向性を示す

class GraphData(BaseModel):
    nodes: List[GraphNode]
    links: List[GraphLink]

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

@app.post("/api/session")
async def save_user_session(
    request: SessionDataRequest,
    current_user: User = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    """ユーザーのセッションデータを保存または更新するエンドポイント"""
    user_session = db.query(UserSession).filter(UserSession.user_id == current_user.id).first()

    if user_session:
        user_session.session_data = request.session_data
    else:
        user_session = UserSession(user_id=current_user.id, session_data=request.session_data)
        db.add(user_session)
    
    db.commit()
    db.refresh(user_session)
    return {"message": "セッションデータが正常に保存されました"}

@app.get("/api/session")
async def get_user_session(
    current_user: User = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    """ユーザーのセッションデータを取得するエンドポイント"""
    user_session = db.query(UserSession).filter(UserSession.user_id == current_user.id).first()

    if user_session:
        return {"session_data": user_session.session_data}
    else:
        return {"session_data": "{}"} # データがない場合は空のJSONを返す


@app.post("/api/teams")
async def create_team(request: TeamCreateRequest, current_user: User = Depends(get_required_user), db: Session = Depends(get_db)):
    """チーム作成エンドポイント"""
    existing_team = db.query(Team).filter(Team.name == request.name).first()
    if existing_team:
        raise HTTPException(status_code=400, detail="チーム名は既に存在します")

    new_team = Team(name=request.name, created_by_user_id=current_user.id)
    db.add(new_team)
    db.commit()
    db.refresh(new_team)

    # チーム作成者を管理者として追加
    new_team_member = TeamMember(user_id=current_user.id, team_id=new_team.id, role="admin")
    db.add(new_team_member)
    db.commit()

    return {"message": "チームが正常に作成されました", "team_id": new_team.id, "team_name": new_team.name}

@app.post("/api/teams/{team_id}/members")
async def add_team_member(team_id: int, member_username: str = Form(...), current_user: User = Depends(get_required_user), db: Session = Depends(get_db)):
    """チームにメンバーを追加するエンドポイント"""
    # チームが存在するか確認
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="チームが見つかりません")

    # 現在のユーザーがチームの管理者であるか確認
    current_user_membership = db.query(TeamMember).filter(
        TeamMember.user_id == current_user.id,
        TeamMember.team_id == team_id
    ).first()
    if not current_user_membership or current_user_membership.role != "admin":
        raise HTTPException(status_code=403, detail="チームメンバーを追加する権限がありません")

    # 追加するユーザーが存在するか確認
    user_to_add = db.query(User).filter(User.username == member_username).first()
    if not user_to_add:
        raise HTTPException(status_code=404, detail="追加するユーザーが見つかりません")

    # ユーザーが既にチームのメンバーであるか確認
    existing_member = db.query(TeamMember).filter(
        TeamMember.user_id == user_to_add.id,
        TeamMember.team_id == team_id
    ).first()
    if existing_member:
        raise HTTPException(status_code=400, detail="ユーザーは既にこのチームのメンバーです")

    # メンバーを追加
    new_member = TeamMember(user_id=user_to_add.id, team_id=team_id, role="member")
    db.add(new_member)
    db.commit()

    return {"message": f"{member_username}をチームに追加しました", "team_id": team_id, "user_id": user_to_add.id}

@app.delete("/api/teams/{team_id}/members/{user_id}")
async def remove_team_member(team_id: int, user_id: int, current_user: User = Depends(get_required_user), db: Session = Depends(get_db)):
    """チームからメンバーを削除するエンドポイント"""
    # チームが存在するか確認
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="チームが見つかりません")

    # 現在のユーザーがチームの管理者であるか確認
    current_user_membership = db.query(TeamMember).filter(
        TeamMember.user_id == current_user.id,
        TeamMember.team_id == team_id
    ).first()
    if not current_user_membership or current_user_membership.role != "admin":
        raise HTTPException(status_code=403, detail="チームメンバーを削除する権限がありません")

    # 削除対象のメンバーが存在するか確認
    member_to_remove = db.query(TeamMember).filter(
        TeamMember.user_id == user_id,
        TeamMember.team_id == team_id
    ).first()
    if not member_to_remove:
        raise HTTPException(status_code=404, detail="指定されたユーザーはこのチームのメンバーではありません")

    # 削除対象が管理者である場合、最後の管理者でないことを確認
    if member_to_remove.role == "admin":
        admin_count = db.query(TeamMember).filter(
            TeamMember.team_id == team_id,
            TeamMember.role == "admin"
        ).count()
        if admin_count == 1 and member_to_remove.user_id == current_user.id:
            raise HTTPException(status_code=400, detail="最後の管理者を削除することはできません")

    db.delete(member_to_remove)
    db.commit()

    return {"message": "チームメンバーを削除しました", "team_id": team_id, "user_id": user_id}

@app.put("/api/teams/{team_id}/members/{user_id}/role")
async def update_team_member_role(team_id: int, user_id: int, new_role: str = Form(...), current_user: User = Depends(get_required_user), db: Session = Depends(get_db)):
    """チームメンバーの役割を更新するエンドポイント"""
    # チームが存在するか確認
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="チームが見つかりません")

    # 現在のユーザーがチームの管理者であるか確認
    current_user_membership = db.query(TeamMember).filter(
        TeamMember.user_id == current_user.id,
        TeamMember.team_id == team_id
    ).first()
    if not current_user_membership or current_user_membership.role != "admin":
        raise HTTPException(status_code=403, detail="チームメンバーの役割を変更する権限がありません")

    # 変更対象のメンバーが存在するか確認
    member_to_update = db.query(TeamMember).filter(
        TeamMember.user_id == user_id,
        TeamMember.team_id == team_id
    ).first()
    if not member_to_update:
        raise HTTPException(status_code=404, detail="指定されたユーザーはこのチームのメンバーではありません")

    # 役割の有効性をチェック
    if new_role not in ["admin", "member"]:
        raise HTTPException(status_code=400, detail="無効な役割です。'admin'または'member'を指定してください。")

    # 最後の管理者を降格させないチェック
    if member_to_update.role == "admin" and new_role == "member":
        admin_count = db.query(TeamMember).filter(
            TeamMember.team_id == team_id,
            TeamMember.role == "admin"
        ).count()
        if admin_count == 1:
            raise HTTPException(status_code=400, detail="最後の管理者を降格させることはできません")

    member_to_update.role = new_role
    db.commit()

    return {"message": f"{member_to_update.user_id}の役割を{new_role}に更新しました", "team_id": team_id, "user_id": user_id, "new_role": new_role}

@app.get("/api/teams/{team_id}/members")
async def get_team_members(team_id: int, current_user: User = Depends(get_required_user), db: Session = Depends(get_db)):
    """チームのメンバーリストを取得するエンドポイント"""
    # チームが存在するか確認
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="チームが見つかりません")

    # 現在のユーザーがチームのメンバーであるか確認
    current_user_membership = db.query(TeamMember).filter(
        TeamMember.user_id == current_user.id,
        TeamMember.team_id == team_id
    ).first()
    if not current_user_membership:
        raise HTTPException(status_code=403, detail="このチームのメンバーではありません")

    # チームメンバーとそのユーザー情報を取得
    team_members = db.query(TeamMember, User).join(User).filter(
        TeamMember.team_id == team_id
    ).all()

    # 必要な情報だけを抽出して返す
    members_data = [
        {"user_id": member.user_id, "username": user.username, "role": member.role}
        for member, user in team_members
    ]

    return members_data

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
async def chat(request: ChatRequest, db: Session = Depends(get_db)):
    """チャットエンドポイント"""

    client = genai.Client(api_key=API_KEY)
    try:
        # summary_idが指定されていて、関連PDFをDBから参照する場合
        if request.summary_id:
            summary = db.query(SummaryHistory).filter(SummaryHistory.id == request.summary_id).first()
            if summary and summary.original_file_path:
                logging.info(f"summary.original_file_path: {summary.original_file_path}")
                try:
                    # original_file_pathをJSON文字列からリストに変換（SharedFileのIDの配列を想定）
                    file_ids = json.loads(summary.original_file_path)
                    if not isinstance(file_ids, list):
                        file_ids = [file_ids]
                    logging.info(f"Deserialized file_ids: {file_ids}")

                    pdf_parts = []
                    for fid in file_ids:
                        try:
                            sf = db.query(SharedFile).filter(SharedFile.id == int(fid)).first()
                            if sf and sf.content:
                                base64_content = await run_in_threadpool(lambda: base64.b64encode(sf.content).decode('utf-8'))
                                pdf_parts.append({'inline_data': {'mime_type': 'application/pdf', 'data': base64_content}})
                                logging.info(f"Using PDF content from DB: file_id={fid}")
                            else:
                                logging.warning(f"SharedFile not found or empty content: file_id={fid}")
                        except Exception as e:
                            logging.warning(f"Failed to load SharedFile content for id={fid}: {e}")

                    if pdf_parts:  # PDFファイルが1つ以上存在する場合
                        contents_parts = [
                            {'text': f"以下のPDFファイルの内容と要約を参考に質問に答えてください。より詳細な情報が必要な場合はPDFファイルの内容を優先してください。\n\n要約:\n{request.pdf_summary or summary.summary}\n\n質問:\n{request.message}"},
                        ]
                        contents_parts.extend(pdf_parts)  # PDFデータを追加

                        response = await client.aio.models.generate_content(
                            model='gemini-2.0-flash-001',
                            contents=[
                                {'parts': contents_parts}
                            ]
                        )

                        if hasattr(response, 'text') and response.text:
                            return {"reply": response.text}
                        elif hasattr(response, 'candidates') and response.candidates:
                            return {"reply": response.candidates[0].content.parts[0].text}

                except Exception as pdf_error:
                    logging.error(f"Error processing PDF file: {str(pdf_error)}")
                    # PDFファイルの読み込みに失敗した場合は要約のみで処理
        elif request.original_file_paths: # original_file_paths が指定されている場合（SharedFileのIDの配列を想定）
            logging.info(f"request.original_file_paths: {request.original_file_paths}")
            try:
                file_ids = request.original_file_paths
                pdf_parts = []
                for fid in file_ids:
                    try:
                        sf = db.query(SharedFile).filter(SharedFile.id == int(fid)).first()
                        if sf and sf.content:
                            base64_content = await run_in_threadpool(lambda: base64.b64encode(sf.content).decode('utf-8'))
                            pdf_parts.append({'inline_data': {'mime_type': 'application/pdf', 'data': base64_content}})
                            logging.info(f"Using PDF content from DB (request): file_id={fid}")
                        else:
                            logging.warning(f"SharedFile not found or empty content (request): file_id={fid}")
                    except Exception as e:
                        logging.warning(f"Failed to load SharedFile content for id={fid} from request: {e}")

                if pdf_parts: # PDFファイルが1つ以上存在する場合
                    contents_parts = [
                        {'text': f"以下のPDFファイルの内容と要約を参考に質問に答えてください。より詳細な情報が必要な場合はPDFファイルの内容を優先してください。\n\n要約:\n{request.pdf_summary or ''}\n\n質問:\n{request.message}"},
                    ]
                    contents_parts.extend(pdf_parts) # PDFデータを追加

                    response = await client.aio.models.generate_content(
                        model='gemini-2.0-flash-001',
                        contents=[
                            {'parts': contents_parts}
                        ]
                    )
                
                if hasattr(response, 'text') and response.text:
                    return {"reply": response.text}
                elif hasattr(response, 'candidates') and response.candidates:
                    return {"reply": response.candidates[0].content.parts[0].text}
            
            except Exception as pdf_error:
                logging.error(f"Error processing PDF file from request.original_file_paths: {str(pdf_error)}")
                # PDFファイルの読み込みに失敗した場合は要約のみで処理
        
        # 従来の要約のみの処理
        full_content = request.message
        if request.pdf_summary:
            full_content = f"以下のPDF要約を考慮して質問に答えてください。\n\nPDF要約:\n{request.pdf_summary}\n\n質問:\n{request.message}"

        response = await client.aio.models.generate_content(
            model='gemini-2.0-flash-001', contents=full_content
        )
        
        logging.info(f"Generated response using summary only")
        
        if not response or not response.text:
            return {"reply": "応答なし！"}
            
        return {"reply": response.text}
    except Exception as e:
        logging.error(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI応答エラー: {str(e)}")

async def summarize_text_with_gemini(text: str) -> str:
    """Gemini APIを使用してテキストを要約する"""
    client = genai.Client(api_key=API_KEY)
    try:
        prompt = f"以下のテキストを簡潔に要約してください。要点のみを抽出し、箇条書きで3点程度にまとめてください。\n\nテキスト:\n{text}"
        response = await client.aio.models.generate_content(
            model='gemini-2.0-flash-001',
            contents=prompt
        )
        if hasattr(response, 'text') and response.text:
            return response.text
        elif hasattr(response, 'candidates') and response.candidates:
            return response.candidates[0].content.parts[0].text
        else:
            return "要約の生成に失敗しました"
    except Exception as e:
        logging.error(f"Error summarizing text with Gemini API: {str(e)}")
        return "要約の生成中にエラーが発生しました"

async def generate_category_with_gemini(question_text: str) -> str:
    """Gemini APIを使用して質問テキストからカテゴリを生成する"""
    client = genai.Client(api_key=API_KEY)
    try:
        prompt = (
            f"以下の質問テキストに最も適したカテゴリ名を質問内容から簡潔に生成してください。\n"
            f"回答はカテゴリ名のみを返してください。\n\n質問テキスト:\n{question_text}"
        )
        response = await client.aio.models.generate_content(
            model='gemini-2.0-flash-001',
            contents=prompt
        )
        if hasattr(response, 'text') and response.text:
            return response.text.strip()
        elif hasattr(response, 'candidates') and response.candidates:
            return response.candidates[0].content.parts[0].text.strip()
        else:
            return "その他"
    except Exception as e:
        logging.error(f"Error generating category with Gemini API: {str(e)}")
        return "その他"



@app.post("/api/upload-pdf")
async def upload_pdf(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    """PDF アップロードと要約生成エンドポイント（認証なし）"""
    try:
        if not files:
            raise HTTPException(status_code=400, detail="ファイルが選択されていません")

        all_base64_contents = []
        all_filenames = []
        file_ids = []
        
        for file in files:
            if not file.filename.lower().endswith('.pdf'):
                raise HTTPException(status_code=400, detail=f"'{file.filename}': PDFファイルのみアップロード可能です")
            
            if file.size > 10 * 1024 * 1024:
                raise HTTPException(status_code=400, detail=f"'{file.filename}': ファイルサイズが大きすぎます (10MB以下にしてください)")
            
            file_content = await file.read()
            base64_content = await run_in_threadpool(lambda: base64.b64encode(file_content).decode('utf-8'))
            all_base64_contents.append(base64_content)
            all_filenames.append(file.filename)

            # PDFファイルをDBに保存（チャット時に参照するため）
            new_shared_file = SharedFile(
                filename=file.filename,
                content=file_content,
                team_id=None,
                uploaded_by_user_id=None
            )
            db.add(new_shared_file)
            db.flush()
            file_ids.append(new_shared_file.id)
        
        client = genai.Client(api_key=API_KEY)
        
        # Gemini APIへのプロンプトとコンテンツの構築
        parts = [
            {'text': '以下の複数のPDFファイルの内容を日本語で要約してください。要点をmarkdownを活用した箇条書きで整理し、わかりやすく説明してください。要約内容に合ったタグを少なくとも3つ生成してください。最大数は5個です．生成したタグに関しては，markdownで見出しなどをつけずにプレーンなテキスト [タグ: tag1, tag2, tag3...] の形式で文末に含めてください。タグが生成できない場合でも、必ず `[タグ: なし]` と記述してください。'},
        ]
        for base64_content in all_base64_contents:
            parts.append({'inline_data': {'mime_type': 'application/pdf', 'data': base64_content}})

        response = await client.aio.models.generate_content(
            model='gemini-2.0-flash-001',
            contents=[
                {'parts': parts}
            ]
        )
        
        logging.info(f"Combined PDF summary generated for files: {', '.join(all_filenames)}")
        
        if hasattr(response, 'text') and response.text:
            full_response_text = response.text
        elif hasattr(response, 'candidates') and response.candidates:
            full_response_text = response.candidates[0].content.parts[0].text
        else:
            full_response_text = "要約の生成に失敗しました"
        
        summary = full_response_text # 初期値はフルレスポンス
        generated_tags = []
        
        # タグを正規表現で抽出
        tag_match = re.search(r'\[タグ:\s*(.*?)\s*\]', full_response_text)
        if tag_match:
            tags_str = tag_match.group(1)
            generated_tags = [tag.strip() for tag in tags_str.split(',') if tag.strip()]
            # 要約からタグ部分を削除
            summary = re.sub(r'\[タグ:\s*(.*?)\s*\]', '', full_response_text).strip()
        
        return {
            "filename": ", ".join(all_filenames), # 複数のファイル名を結合
            "summary": summary,
            "status": "success",
            "tags": generated_tags,
            # DBのファイルID一覧を返す
            "file_path": file_ids
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

@app.get("/api/summaries", response_model=List[SummaryListItemResponse])
async def get_summaries(current_user: User = Depends(get_required_user), db: Session = Depends(get_db)):
    """認証されたユーザーの要約履歴と、所属チームの共有要約を取得する"""
    try:
        # ユーザー自身の要約を取得
        user_summaries_query = db.query(SummaryHistory, User.username, Team.name).outerjoin(Team, SummaryHistory.team_id == Team.id).join(User, SummaryHistory.user_id == User.id).filter(
            SummaryHistory.user_id == current_user.id
        ).order_by(SummaryHistory.created_at.desc())
        
        user_summaries_data = []
        for summary, username, team_name in user_summaries_query.all():
            # created_at を明示的にUTCに変換
            if summary.created_at.tzinfo is None:
                created_at_utc = summary.created_at.replace(tzinfo=timezone.utc)
            else:
                created_at_utc = summary.created_at.astimezone(timezone.utc)

            user_summaries_data.append(SummaryListItemResponse(
                id=summary.id,
                filename=summary.filename,
                summary=summary.summary,
                created_at=created_at_utc,
                team_id=summary.team_id,
                username=username,
                team_name=team_name,
                tags=summary.tags.split(',') if summary.tags else [],
                chat_history_id=summary.chat_history_id,
                original_file_path=(
                    json.loads(summary.original_file_path)
                    if summary.original_file_path and summary.original_file_path.startswith('[')
                    else ([summary.original_file_path] if summary.original_file_path else None)
                ),
                parent_summary_id=summary.parent_summary_id # NEW FIELD
            ))

        # ユーザーが所属するチームのIDを取得
        user_team_ids = [tm.team_id for tm in db.query(TeamMember).filter(TeamMember.user_id == current_user.id).all()]


        # 所属チームに共有された要約を取得
        shared_summaries_data = []
        if user_team_ids:
            shared_summaries_query = db.query(SummaryHistory, User.username, Team.name).join(User, SummaryHistory.user_id == User.id).join(Team, SummaryHistory.team_id == Team.id).filter(
                SummaryHistory.team_id.in_(user_team_ids),
                SummaryHistory.user_id != current_user.id # 自分の要約はuser_summariesに含まれるため除外
            ).order_by(SummaryHistory.created_at.desc())
            
            shared_summaries_results = shared_summaries_query.all()

            for summary, username, team_name in shared_summaries_results:
                # created_at を明示的にUTCに変換
                if summary.created_at.tzinfo is None:
                    created_at_utc = summary.created_at.replace(tzinfo=timezone.utc)
                else:
                    created_at_utc = summary.created_at.astimezone(timezone.utc)

                shared_summaries_data.append(SummaryListItemResponse(
                    id=summary.id,
                    filename=summary.filename,
                    summary=summary.summary,
                    created_at=created_at_utc,
                    team_id=summary.team_id,
                    username=username,
                    team_name=team_name,
                    tags=summary.tags.split(',') if summary.tags else [],
                    chat_history_id=summary.chat_history_id,
                    original_file_path=(
                        json.loads(summary.original_file_path)
                        if summary.original_file_path and summary.original_file_path.startswith('[')
                        else ([summary.original_file_path] if summary.original_file_path else None)
                    ),
                    parent_summary_id=summary.parent_summary_id # NEW FIELD
                ))

        # 両方のリストを結合して返す
        all_summaries = user_summaries_data + shared_summaries_data

        # 重複を排除し、作成日時でソート（必要であれば）
        # ここでは単純に結合しているため、重複排除とソートはフロントエンドで行うか、
        # より複雑なクエリを構築する必要があります。
        # 例: set()を使って重複排除し、リストに変換後ソート
        unique_summaries = list({s.id: s for s in all_summaries}.values())
        unique_summaries.sort(key=lambda x: x.created_at, reverse=True)

        return unique_summaries
    except Exception as e:
        logging.error(f"Error fetching summaries for user {current_user.username}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"要約の取得中にエラーが発生しました: {str(e)}")

@app.get("/api/summaries/{summary_id}", response_model=SummaryHistoryDetailResponse)
async def get_summary_by_id(
    summary_id: int,
    current_user: User = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    """IDに基づいて特定の要約履歴とその関連コンテンツを取得するエンドポイント"""
    summary_history = db.query(SummaryHistory).options(
        joinedload(SummaryHistory.contents)
    ).filter(SummaryHistory.id == summary_id).first()

    if not summary_history:
        raise HTTPException(status_code=404, detail="要約履歴が見つかりません")

    # 権限チェック
    is_owner = summary_history.user_id == current_user.id
    is_team_member = False
    if summary_history.team_id:
        membership = db.query(TeamMember).filter(
            TeamMember.team_id == summary_history.team_id,
            TeamMember.user_id == current_user.id
        ).first()
        if membership:
            is_team_member = True

    if not is_owner and not is_team_member:
        raise HTTPException(status_code=403, detail="この履歴を閲覧する権限がありません")

    # original_file_pathをJSON文字列からリストに変換
    deserialized_file_path = (
        json.loads(summary_history.original_file_path)
        if summary_history.original_file_path and summary_history.original_file_path.startswith('[')
        else ([summary_history.original_file_path] if summary_history.original_file_path else None)
    )

    return SummaryHistoryDetailResponse(
        id=summary_history.id,
        user_id=summary_history.user_id,
        team_id=summary_history.team_id,
        filename=summary_history.filename,
        summary=summary_history.summary,
        created_at=summary_history.created_at.astimezone(timezone.utc) if summary_history.created_at.tzinfo is None else summary_history.created_at,
        contents=summary_history.contents,
        original_file_path=deserialized_file_path,
        parent_summary_id=summary_history.parent_summary_id
    )

@app.post("/api/comments")
async def add_comment(request: CommentCreateRequest, current_user: User = Depends(get_required_user), db: Session = Depends(get_db)):
    """要約にコメントを追加するエンドポイント"""
    # 要約が存在するか確認
    summary = db.query(SummaryHistory).filter(SummaryHistory.id == request.summary_id).first()
    if not summary:
        raise HTTPException(status_code=404, detail="要約が見つかりません")

    # ユーザーが要約にアクセスできるか確認（自身の要約、または所属チームの要約）
    can_access = False
    if summary.user_id == current_user.id:
        can_access = True
    elif summary.team_id:
        team_membership = db.query(TeamMember).filter(
            TeamMember.user_id == current_user.id,
            TeamMember.team_id == summary.team_id
        ).first()
        if team_membership:
            can_access = True

    if not can_access:
        raise HTTPException(status_code=403, detail="この要約にコメントする権限がありません")

    new_comment = Comment(
        summary_id=request.summary_id,
        user_id=current_user.id,
        content=request.content,
        created_at=datetime.now(timezone.utc) # 明示的にUTCを設定
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)

    return {"message": "コメントが追加されました", "comment_id": new_comment.id}

@app.post("/api/comments/{comment_id}/reactions")
async def add_reaction(
    comment_id: int,
    request: ReactionCreateRequest,
    current_user: User = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    """コメントにリアクションを追加するエンドポイント"""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="コメントが見つかりません")

    # ユーザーが要約にアクセスできるか確認（コメント追加時と同じロジック）
    summary = db.query(SummaryHistory).filter(SummaryHistory.id == comment.summary_id).first()
    if not summary: # Should not happen if comment exists, but for safety
        raise HTTPException(status_code=404, detail="関連する要約が見つかりません")

    can_access = False
    if summary.user_id == current_user.id:
        can_access = True
    elif summary.team_id:
        team_membership = db.query(TeamMember).filter(
            TeamMember.user_id == current_user.id,
            TeamMember.team_id == summary.team_id
        ).first()
        if team_membership:
            can_access = True

    if not can_access:
        raise HTTPException(status_code=403, detail="このコメントにリアクションする権限がありません")

    # 同じユーザーが同じリアクションを既にしているか確認
    existing_reaction = db.query(Reaction).filter(
        Reaction.comment_id == comment_id,
        Reaction.user_id == current_user.id,
        Reaction.reaction_type == request.reaction_type
    ).first()

    if existing_reaction:
        raise HTTPException(status_code=400, detail="既に同じリアクションをしています")

    new_reaction = Reaction(
        comment_id=comment_id,
        user_id=current_user.id,
        reaction_type=request.reaction_type
    )
    db.add(new_reaction)
    db.commit()
    db.refresh(new_reaction)

    return {"message": "リアクションが追加されました", "reaction_id": new_reaction.id}

@app.delete("/api/comments/{comment_id}/reactions")
async def remove_reaction(
    comment_id: int,
    request: ReactionCreateRequest, # Use ReactionCreateRequest to specify reaction_type to remove
    current_user: User = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    """コメントからリアクションを削除するエンドポイント"""
    reaction_to_remove = db.query(Reaction).filter(
        Reaction.comment_id == comment_id,
        Reaction.user_id == current_user.id,
        Reaction.reaction_type == request.reaction_type
    ).first()

    if not reaction_to_remove:
        raise HTTPException(status_code=404, detail="指定されたリアクションが見つかりません")

    db.delete(reaction_to_remove)
    db.commit()

    return {"message": "リアクションが削除されました"}

@app.get("/api/summaries/{summary_id}/comments")
async def get_comments_for_summary(summary_id: int, current_user: User = Depends(get_required_user), db: Session = Depends(get_db)):
    """要約のコメントを取得するエンドポイント"""
    # 要約が存在するか確認
    summary = db.query(SummaryHistory).filter(SummaryHistory.id == summary_id).first()
    if not summary:
        raise HTTPException(status_code=404, detail="要約が見つかりません")

    # ユーザーが要約にアクセスできるか確認（自身の要約、または所属チームの要約）
    can_access = False
    if summary.user_id == current_user.id:
        can_access = True
    elif summary.team_id:
        team_membership = db.query(TeamMember).filter(
            TeamMember.user_id == current_user.id,
            TeamMember.team_id == summary.team_id
        ).first()
        if team_membership:
            can_access = True

    if not can_access:
        raise HTTPException(status_code=403, detail="この要約のコメントを閲覧する権限がありません")

    comments_query = db.query(Comment, User).join(User).filter(
        Comment.summary_id == summary_id
    ).order_by(Comment.created_at.asc())

    comments_data = []
    for comment, user in comments_query.all():
        # 各コメントのリアクションを取得
        reactions = db.query(Reaction, User).join(User).filter(
            Reaction.comment_id == comment.id
        ).all()

        reaction_counts = {}
        user_reactions = []
        for reaction, reaction_user in reactions:
            if reaction.reaction_type not in reaction_counts:
                reaction_counts[reaction.reaction_type] = 0
            reaction_counts[reaction.reaction_type] += 1
            
            user_reactions.append({
                "id": reaction.id,
                "user_id": reaction.user_id,
                "username": reaction_user.username,
                "reaction_type": reaction.reaction_type,
                "created_at": reaction.created_at
            })

        comments_data.append({
            "id": comment.id,
            "user_id": comment.user_id,
            "username": user.username,
            "content": comment.content,
            "created_at": comment.created_at,
            "reactions": user_reactions, # 全てのリアクション詳細
            "reaction_counts": reaction_counts # リアクションの種類ごとのカウント
        })

    return comments_data

@app.get("/api/users/me/teams")
async def get_my_teams(current_user: User = Depends(get_required_user), db: Session = Depends(get_db)):
    """現在のユーザーが所属するチームのリストを取得するエンドポイント"""
    my_memberships = db.query(TeamMember).filter(TeamMember.user_id == current_user.id).all()
    
    teams_data = []
    for membership in my_memberships:
        team = db.query(Team).filter(Team.id == membership.team_id).first()
        if team:
            teams_data.append({
                "id": team.id,
                "name": team.name,
                "role": membership.role,
                "created_by_user_id": team.created_by_user_id
            })
    return teams_data

@app.post("/api/save-summary")
async def save_summary(
    request: SaveSummaryRequest,
    current_user: User = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    """要約をデータベースに保存するエンドポイント"""
    try:
        logging.info(f"SaveSummaryRequest received. team_id: {request.team_id}")
        if request.team_id:
            logging.info(f"Saving as team summary for team_id: {request.team_id}")
            # チーム要約として保存 (1つのエントリ)
            new_history = SummaryHistory(
                user_id=current_user.id, # 保存を実行したユーザーのID
                filename=request.filename,
                summary=request.summary,
                team_id=request.team_id, # リクエストで指定されたteam_idを使用
                                tags=",".join(request.tags) if request.tags else None,
                original_file_path=json.dumps(request.original_file_path) if request.original_file_path else None,
                created_at=datetime.now(timezone.utc),
                parent_summary_id=request.parent_summary_id # NEW FIELD
            )
            db.add(new_history)
            db.flush() # IDを取得するためにflush
            saved_summary_id = new_history.id

            # AI Assistantのチャット履歴をHistoryContentとして保存し、IDを参照する
            if request.ai_chat_history:
                logging.info(f"[save_summary] Received ai_chat_history (team): {request.ai_chat_history[:500]}...") # Log first 500 chars
                try:
                    chat_content_data = json.loads(request.ai_chat_history)
                    # 各チャットメッセージにタイムスタンプを追加
                    for message in chat_content_data:
                        if "timestamp" not in message:
                            message["timestamp"] = datetime.now(timezone.utc).isoformat()
                    
                    # ユーザーメッセージにカテゴリを追加 (AI生成)
                    for message in chat_content_data:
                        if message.get("sender") == "user" and "category" not in message:
                            generated_category = await generate_category_with_gemini(message.get("text", ""))
                            message["category"] = generated_category

                    # ユーザーメッセージとAI回答、関連する要約を結合して埋め込みを計算
                    combined_texts_for_embedding = []
                    for i, message in enumerate(chat_content_data):
                        if message.get("sender") == "user":
                            user_question_text = message.get("text", "")
                            ai_answer_text = ""
                            # 次のメッセージがAIの回答であれば取得
                            if i + 1 < len(chat_content_data) and chat_content_data[i+1].get("sender") == "ai":
                                ai_answer_text = chat_content_data[i+1].get("text", "")
                            
                            # 関連する要約テキストを取得
                            related_summary_text = new_history.summary # 現在保存しようとしている要約

                            combined_text = f"質問: {user_question_text} 回答: {ai_answer_text} 要約: {related_summary_text}"
                            combined_texts_for_embedding.append(combined_text)

                    user_question_embeddings = None
                    if combined_texts_for_embedding:
                        model = get_embedding_model()
                        embeddings_list = [model.encode(t, convert_to_tensor=True) for t in combined_texts_for_embedding]
                        avg_embedding = sum([e.cpu().numpy() for e in embeddings_list]) / len(embeddings_list)
                        user_question_embeddings = avg_embedding

                    new_chat_history_content = HistoryContent(
                        summary_history_id=new_history.id,
                        section_type='ai_chat',
                        content=json.dumps(chat_content_data), # JSON文字列として保存
                        embedding=json.dumps(user_question_embeddings.tolist()) if user_question_embeddings is not None else None, # NEW: ユーザー質問の埋め込みを保存
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc)
                    )
                    db.add(new_chat_history_content)
                    db.flush()
                    new_history.chat_history_id = new_chat_history_content.id

                    # NEW: AI Assistantの回答を抽出し、要約してAiSummaryResponseに保存
                    ai_responses = [msg["text"] for msg in chat_content_data if msg.get("sender") == "ai"]
                    if ai_responses:
                        combined_ai_response = "\n\n".join(ai_responses)
                        summarized_ai_response = await summarize_text_with_gemini(combined_ai_response) # 新しい関数を呼び出す

                        new_ai_summary_response = AiSummaryResponse(
                            summary_history_id=new_history.id,
                            original_history_content_id=new_chat_history_content.id,
                            summarized_content=summarized_ai_response,
                            created_at=datetime.now(timezone.utc)
                        )
                        db.add(new_ai_summary_response)

                except json.JSONDecodeError as e:
                    logging.error(f"Failed to decode ai_chat_history JSON for team summary: {e}")
                except Exception as e:
                    logging.error(f"Error saving AI chat history for team summary: {e}")
            db.commit()
            return {"message": "要約がチーム履歴として保存されました", "id": saved_summary_id}
        else:
            logging.info("Saving as personal summary for current user.")
            # 従来の個人要約として保存
            new_history = SummaryHistory(
                user_id=current_user.id,
                filename=request.filename,
                summary=request.summary,
                team_id=None, # 個人要約なのでteam_idはNone
                tags=",".join(request.tags) if request.tags else None,
                original_file_path=json.dumps(request.original_file_path) if request.original_file_path else None,
                created_at=datetime.now(timezone.utc),
                parent_summary_id=request.parent_summary_id # NEW FIELD
            )
            db.add(new_history)
            db.flush()
            saved_summary_id = new_history.id

            # AI Assistantのチャット履歴をHistoryContentとして保存し、IDを参照する
            if request.ai_chat_history:
                logging.info(f"[save_summary] Received ai_chat_history (personal): {request.ai_chat_history[:500]}...") # Log first 500 chars
                try:
                    chat_content_data = json.loads(request.ai_chat_history)
                    # 各チャットメッセージにタイムスタンプを追加
                    for message in chat_content_data:
                        if "timestamp" not in message:
                            message["timestamp"] = datetime.now(timezone.utc).isoformat()
                    
                    # ユーザーメッセージにカテゴリを追加 (AI生成)
                    for message in chat_content_data:
                        if message.get("sender") == "user" and "category" not in message:
                            generated_category = await generate_category_with_gemini(message.get("text", ""))
                            message["category"] = generated_category

                    # ユーザーメッセージとAI回答、関連する要約を結合して埋め込みを計算
                    combined_texts_for_embedding = []
                    for i, message in enumerate(chat_content_data):
                        if message.get("sender") == "user":
                            user_question_text = message.get("text", "")
                            ai_answer_text = ""
                            # 次のメッセージがAIの回答であれば取得
                            if i + 1 < len(chat_content_data) and chat_content_data[i+1].get("sender") == "ai":
                                ai_answer_text = chat_content_data[i+1].get("text", "")
                            
                            # 関連する要約テキストを取得
                            related_summary_text = new_history.summary # 現在保存しようとしている要約

                            combined_text = f"質問: {user_question_text} 回答: {ai_answer_text} 要約: {related_summary_text}"
                            combined_texts_for_embedding.append(combined_text)

                    user_question_embeddings = None
                    if combined_texts_for_embedding:
                        model = get_embedding_model()
                        embeddings_list = [model.encode(t, convert_to_tensor=True) for t in combined_texts_for_embedding]
                        avg_embedding = sum([e.cpu().numpy() for e in embeddings_list]) / len(embeddings_list)
                        user_question_embeddings = avg_embedding

                    new_chat_history_content = HistoryContent(
                        summary_history_id=new_history.id,
                        section_type='ai_chat',
                        content=json.dumps(chat_content_data), # JSON文字列として保存
                        embedding=json.dumps(user_question_embeddings.tolist()) if user_question_embeddings is not None else None, # NEW: ユーザー質問の埋め込みを保存
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc)
                    )
                    db.add(new_chat_history_content)
                    db.flush()
                    new_history.chat_history_id = new_chat_history_content.id

                    # NEW: AI Assistantの回答を抽出し、要約してAiSummaryResponseに保存
                    ai_responses = [msg["text"] for msg in chat_content_data if msg.get("sender") == "ai"]
                    if ai_responses:
                        combined_ai_response = "\n\n".join(ai_responses)
                        summarized_ai_response = await summarize_text_with_gemini(combined_ai_response) # 新しい関数を呼び出す

                        new_ai_summary_response = AiSummaryResponse(
                            summary_history_id=new_history.id,
                            original_history_content_id=new_chat_history_content.id,
                            summarized_content=summarized_ai_response,
                            created_at=datetime.now(timezone.utc)
                        )
                        db.add(new_ai_summary_response)

                except json.JSONDecodeError as e:
                    logging.error(f"Failed to decode ai_chat_history JSON for user {current_user.id}: {e}")
                except Exception as e:
                    logging.error(f"Error saving AI chat history for user {current_user.id}: {e}")
            db.commit()
            return {"message": "要約が正常に保存されました", "id": saved_summary_id}
    except Exception as e:
        logging.error(f"Error saving summary via /api/save-summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"要約の保存中にエラーが発生しました: {str(e)}")


@app.post("/api/teams/{team_id}/files")
async def upload_shared_file(
    team_id: int,
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    """チームにファイルをアップロードするエンドポイント"""
    # チームが存在するか確認
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="チームが見つかりません")

    # ユーザーがチームのメンバーであることを確認
    team_membership = db.query(TeamMember).filter(
        TeamMember.user_id == current_user.id,
        TeamMember.team_id == team_id
    ).first()
    if not team_membership:
        raise HTTPException(status_code=403, detail="このチームにファイルをアップロードする権限がありません")

    uploaded_files_info = []
    for file in files:
        if not file.filename:
            raise HTTPException(status_code=400, detail=f"'{file.filename}': ファイル名がありません")
        
        file_extension = os.path.splitext(file.filename)[1].lower()
        if file_extension not in [".pdf", ".txt", ".png", ".jpg", ".jpeg", ".gif"]:
            raise HTTPException(status_code=400, detail=f"'{file.filename}': 許可されていないファイル形式です。PDF, TXT, 画像ファイルのみアップロード可能です。")

        MAX_FILE_SIZE = 50 * 1024 * 1024
        file_content = await file.read()
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"'{file.filename}': ファイルサイズが大きすぎます ({MAX_FILE_SIZE / (1024 * 1024):.0f}MB以下にしてください)")

        new_shared_file = SharedFile(
            filename=file.filename,
            content=file_content,
            team_id=team_id,
            uploaded_by_user_id=current_user.id
        )
        db.add(new_shared_file)
        db.flush() # Flush to get ID before commit for all files
        uploaded_files_info.append({"file_id": new_shared_file.id, "filename": new_shared_file.filename})

    db.commit() # Commit all changes at once

    # Summarization logic (similar to /api/upload-pdf)
    all_base64_contents = []
    for file_info in uploaded_files_info:
        sf = db.query(SharedFile).filter(SharedFile.id == file_info["file_id"]).first()
        if not sf or not sf.content:
            continue
        all_base64_contents.append(await run_in_threadpool(lambda: base64.b64encode(sf.content).decode('utf-8')))

    client = genai.Client(api_key=API_KEY)
    
    parts = [
        {'text': '以下の複数のPDFファイルの内容を日本語で要約してください。要点をmarkdownを活用した箇条書きで整理し、わかりやすく説明してください。要約内容に合ったタグを少なくとも3つ生成してください。最大数は5個です．生成したタグに関しては，markdownで見出しなどをつけずにプレーンなテキスト [タグ: tag1, tag2, tag3...] の形式で文末に含めてください。タグが生成できない場合でも、必ず `[タグ: なし]` と記述してください。'},
    ]
    for base64_content in all_base64_contents:
        parts.append({'inline_data': {'mime_type': 'application/pdf', 'data': base64_content}})

    response = await client.aio.models.generate_content(
        model='gemini-2.0-flash-001',
        contents=[
            {'parts': parts}
        ]
    )
    
    logging.info(f"Combined PDF summary generated for shared files: {', '.join([f['filename'] for f in uploaded_files_info])}")
    
    if hasattr(response, 'text') and response.text:
        full_response_text = response.text
    elif hasattr(response, 'candidates') and response.candidates:
        full_response_text = response.candidates[0].content.parts[0].text
    else:
        full_response_text = "要約の生成に失敗しました"
    
    summary_text = full_response_text # 初期値はフルレスポンス
    generated_tags = []
    
    tag_match = re.search(r'\[タグ:\s*(.*?)\s*\]', full_response_text)
    if tag_match:
        tags_str = tag_match.group(1)
        generated_tags = [tag.strip() for tag in tags_str.split(',') if tag.strip()]
        summary_text = re.sub(r'\[タグ:\s*(.*?)\s*\]', '', full_response_text).strip()
    
    # Save summary to SummaryHistory
    combined_filenames = ", ".join([f["filename"] for f in uploaded_files_info])
    # Store related file IDs (as JSON string) in original_file_path field
    combined_file_paths = json.dumps([f["file_id"] for f in uploaded_files_info])

    # チームメンバー全員の個人要約として保存
    team_members = db.query(TeamMember).filter(TeamMember.team_id == team_id).all()
    if not team_members:
        raise HTTPException(status_code=404, detail="指定されたチームのメンバーが見つかりません")

    saved_summary_ids = []
    dt = datetime.now(timezone.utc)
    for member in team_members:
        new_history = SummaryHistory(
            user_id=member.user_id, # 各メンバーのuser_idを使用
            filename=combined_filenames,
            summary=summary_text,
            team_id=None, # チーム要約ではなく個人要約として保存
            tags=",".join(generated_tags) if generated_tags else None,
            original_file_path=combined_file_paths,
            created_at=dt
        )
        db.add(new_history)
        db.flush() # IDを取得するためにflush
        saved_summary_ids.append(new_history.id)
    db.commit() # 全ての変更をコミット

    return {
        "message": "ファイルが正常にアップロードされ、要約がチームメンバー全員の個人履歴に保存されました！",
        "uploaded_files": uploaded_files_info,
        "summary_details": {
            "summary": summary_text,
            "filename": combined_filenames,
            "tags": generated_tags,
            "file_path": json.loads(combined_file_paths), # Return as list
            "summary_id": saved_summary_ids[0] if saved_summary_ids else None # Return the first ID, or None if no summaries saved
        }
    }


@app.post("/api/save-question-summary")
async def save_question_summary(
    request: HistoryContentCreateRequest,
    current_user: User = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    """質問と回答のペアを要約してデータベースに保存するエンドポイント"""
    try:
        summary_history = db.query(SummaryHistory).filter(SummaryHistory.id == request.summary_history_id).first()
        if not summary_history:
            raise HTTPException(status_code=404, detail="指定された要約履歴が見つかりません")

        # 権限チェック
        is_owner = summary_history.user_id == current_user.id
        is_team_member = False
        if summary_history.team_id:
            membership = db.query(TeamMember).filter(
                TeamMember.team_id == summary_history.team_id,
                TeamMember.user_id == current_user.id
            ).first()
            if membership:
                is_team_member = True

        if not is_owner and not is_team_member:
            raise HTTPException(status_code=403, detail="このコンテンツを保存する権限がありません")

        # 質問と回答のペアを要約 (AI生成)
        combined_text = f"質問: {request.question_text}\n回答: {request.ai_answer_text}"
        ai_generated_summary = await summarize_text_with_gemini(combined_text)

        # ユーザーが提供した要約があればそれを使用、なければAI生成の要約を使用
        final_content = request.user_provided_summary if request.user_provided_summary is not None else ai_generated_summary

        new_history_content = HistoryContent(
            summary_history_id=request.summary_history_id,
            section_type='user_question_summary', # 質問単位の要約であることを示す
            content=final_content, # ユーザー提供またはAI生成の要約を保存
            question_text=request.question_text,
            ai_answer_text=request.ai_answer_text,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        db.add(new_history_content)
        db.flush()

        # NEW: 質問と回答の要約をAiSummaryResponseに保存 (AI生成の要約を保存)
        new_ai_summary_response = AiSummaryResponse(
            summary_history_id=request.summary_history_id,
            original_history_content_id=new_history_content.id,
            summarized_content=ai_generated_summary, # AI生成の要約を保存
            created_at=datetime.now(timezone.utc)
        )
        db.add(new_ai_summary_response)

        db.commit()
        db.refresh(new_history_content)

        return {"message": "質問単位の要約が正常に保存されました", "content_id": new_history_content.id}

    except Exception as e:
        logging.error(f"Error saving question summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"質問単位の要約保存中にエラーが発生しました: {str(e)}")

@app.put("/api/history-contents")
async def upsert_history_content(
    request: HistoryContentCreateRequest,
    current_user: User = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    """履歴コンテンツ（チャット履歴など）を作成または更新する"""
    summary_history = db.query(SummaryHistory).filter(SummaryHistory.id == request.summary_history_id).first()
    if not summary_history:
        raise HTTPException(status_code=404, detail="指定された要約履歴が見つかりません")

    # 権限チェック
    is_owner = summary_history.user_id == current_user.id
    is_team_member = False
    if summary_history.team_id:
        membership = db.query(TeamMember).filter(
            TeamMember.team_id == summary_history.team_id,
            TeamMember.user_id == current_user.id
        ).first()
        if membership:
            is_team_member = True

    if not is_owner and not is_team_member:
        raise HTTPException(status_code=403, detail="このコンテンツを更新する権限がありません")

    # 既存のコンテンツを検索
    history_content = db.query(HistoryContent).filter(
        HistoryContent.summary_history_id == request.summary_history_id,
        HistoryContent.section_type == request.section_type
    ).first()

    if history_content:
        # 更新
        history_content.content = request.content
        message = "コンテンツが更新されました"
    else:
        # 作成
        history_content = HistoryContent(
            summary_history_id=request.summary_history_id,
            section_type=request.section_type,
            content=request.content
        )
        db.add(history_content)
        message = "コンテンツが作成されました"
    
    db.commit()
    db.refresh(history_content)
    return {"message": message, "content_id": history_content.id}


@app.get("/api/teams/{team_id}/files", response_model=List[SharedFileResponse])
async def get_shared_files(
    team_id: int,
    current_user: User = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    """チームに共有されたファイルの一覧を取得するエンドポイント"""
    # チームが存在するか確認
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="チームが見つかりません")

    # ユーザーがチームのメンバーであることを確認
    team_membership = db.query(TeamMember).filter(
        TeamMember.user_id == current_user.id,
        TeamMember.team_id == team_id
    ).first()
    if not team_membership:
        raise HTTPException(status_code=403, detail="このチームのファイルリストを閲覧する権限がありません")

    # チームに共有されたファイルを取得
    shared_files = db.query(SharedFile, User.username).join(User, SharedFile.uploaded_by_user_id == User.id).filter(
        SharedFile.team_id == team_id
    ).order_by(SharedFile.uploaded_at.desc()).all()

    # レスポンスモデルに合うようにデータを整形
    files_data = []
    for file, username in shared_files:
        files_data.append(SharedFileResponse(
            id=file.id,
            filename=file.filename,
            team_id=file.team_id,
            uploaded_by_user_id=file.uploaded_by_user_id,
            uploaded_by_username=username,
            uploaded_at=file.uploaded_at
        ))
    return files_data


@app.get("/api/files/{file_id}")
async def download_shared_file(
    file_id: int,
    current_user: User = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    """共有ファイルをダウンロードするエンドポイント。
    チームに紐づくファイルはチームメンバーのみ許可。
    チーム未紐づけ(None)のファイルは、アップロード者が設定されていれば本人のみ、
    未設定(None)なら認証済みユーザーであれば許可（個人作業フローの利便性優先）。
    """
    shared_file = db.query(SharedFile).filter(SharedFile.id == file_id).first()
    if not shared_file:
        raise HTTPException(status_code=404, detail="ファイルが見つかりません")

    # アクセス許可判定
    if shared_file.team_id is None:
        # 個人用（または匿名アップロード）ファイル
        if shared_file.uploaded_by_user_id is not None and shared_file.uploaded_by_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="このファイルをダウンロードする権限がありません")
        # uploaded_by_user_id が None の場合は、認証済みユーザーであれば許可
    else:
        # チームに紐づく場合はメンバーシップ必須
        team_membership = db.query(TeamMember).filter(
            TeamMember.user_id == current_user.id,
            TeamMember.team_id == shared_file.team_id
        ).first()
        if not team_membership:
            raise HTTPException(status_code=403, detail="このファイルをダウンロードする権限がありません")

    if not shared_file.content:
        raise HTTPException(status_code=404, detail="ファイルコンテンツが見つかりません")
    # Try to set a simple content type based on extension (fallback to octet-stream)
    ext = os.path.splitext(shared_file.filename)[1].lower()
    mime = "application/pdf" if ext == ".pdf" else (
        "text/plain" if ext == ".txt" else (
        "image/png" if ext == ".png" else (
        "image/jpeg" if ext in [".jpg", ".jpeg"] else (
        "image/gif" if ext == ".gif" else "application/octet-stream"))))
    headers = {"Content-Disposition": f"attachment; filename=\"{shared_file.filename}\""}
    return Response(content=shared_file.content, media_type=mime, headers=headers)

## Removed: local file serving endpoint. Use /api/files/{file_id} instead.

@app.post("/api/teams/{team_id}/messages", response_model=MessageResponse)
async def send_message(
    team_id: int,
    request: MessageCreateRequest,
    current_user: User = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    """チームにメッセージを送信するエンドポイント"""
    # チームが存在するか確認
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="チームが見つかりません")

    # ユーザーがチームのメンバーであることを確認
    team_membership = db.query(TeamMember).filter(
        TeamMember.user_id == current_user.id,
        TeamMember.team_id == team_id
    ).first()
    if not team_membership:
        raise HTTPException(status_code=403, detail="このチームにメッセージを送信する権限がありません")

    new_message = Message(
        team_id=team_id,
        user_id=current_user.id,
        content=request.content,
        created_at=datetime.now(timezone.utc)
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    return MessageResponse(
        id=new_message.id,
        team_id=new_message.team_id,
        user_id=new_message.user_id,
        username=current_user.username, # current_userから取得
        content=new_message.content,
        created_at=new_message.created_at
    )


@app.get("/api/teams/{team_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    team_id: int,
    current_user: User = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    """チームのメッセージ履歴を取得するエンドポイント"""
    # チームが存在するか確認
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="チームが見つかりません")

    # ユーザーがチームのメンバーであることを確認
    team_membership = db.query(TeamMember).filter(
        TeamMember.user_id == current_user.id,
        TeamMember.team_id == team_id
    ).first()
    if not team_membership:
        raise HTTPException(status_code=403, detail="このチームのメッセージを閲覧する権限がありません")

    messages = db.query(Message, User.username).join(User, Message.user_id == User.id).filter(
        Message.team_id == team_id
    ).order_by(Message.created_at).all()

    messages_data = []
    for message, username in messages:
        messages_data.append(MessageResponse(
            id=message.id,
            team_id=message.team_id,
            user_id=message.user_id,
            username=username,
            content=message.content,
            created_at=message.created_at
        ))
    return messages_data


@app.get("/api/summary-tree-graph", response_model=GraphData)
async def get_summary_tree_graph(
    current_user: User = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    """
    ユーザーの要約履歴とそれに関連するAIチャット履歴をネットワークグラフ形式で取得するエンドポイント。
    """
    nodes: List[GraphNode] = []
    links: List[GraphLink] = []
    
    # ユーザー自身の要約履歴を取得
    summaries = db.query(SummaryHistory).filter(
        SummaryHistory.user_id == current_user.id
    ).order_by(SummaryHistory.created_at.desc()).all()

    for summary in summaries:
        summary_node_id = f"summary_{summary.id}"
        # created_at を明示的にUTCに変換
        if summary.created_at.tzinfo is None:
            created_at_utc = summary.created_at.replace(tzinfo=timezone.utc)
        else:
            created_at_utc = summary.created_at.astimezone(timezone.utc)

        nodes.append(GraphNode(
            id=summary_node_id,
            label=summary.filename,
            type="summary",
            summary_id=summary.id,
            parent_summary_id=summary.parent_summary_id,
            summary_created_at=created_at_utc # NEW FIELD: summary_created_at を追加
        ))

        # 親要約へのリンクを追加
        if summary.parent_summary_id:
            parent_node_id = f"summary_{summary.parent_summary_id}"
            links.append(GraphLink(source=parent_node_id, target=summary_node_id, type="parent_summary_link"))

        # カテゴリごとの質問をグループ化するための辞書
        questions_by_category: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

        # この要約に関連するユーザー質問要約コンテンツを取得
        user_question_summaries = db.query(HistoryContent).filter(
            HistoryContent.summary_history_id == summary.id,
            HistoryContent.section_type == 'user_question_summary'
        ).order_by(HistoryContent.created_at).all()

        for uqs_content in user_question_summaries:
            qa_pair = {
                "question": uqs_content.question_text or "",
                "answer": uqs_content.ai_answer_text or "",
                "timestamp": uqs_content.created_at,
                "category": "質問要約", # デフォルトカテゴリ
                "summarized_qa": uqs_content.content, # 質問と回答の要約
                "history_content_id": uqs_content.id # HistoryContentのID
            }
            category = qa_pair.get("category", "未分類")
            questions_by_category[category].append(qa_pair)

        # 既存のai_chat履歴も処理（もしあれば）
        ai_chat_content = db.query(HistoryContent).filter(
            HistoryContent.summary_history_id == summary.id,
            HistoryContent.section_type == 'ai_chat'
        ).first()

        if ai_chat_content:
            try:
                chat_history_data = json.loads(ai_chat_content.content)
                if not isinstance(chat_history_data, list):
                    logging.warning(f"Chat history content for SummaryHistory ID {summary.id}, HistoryContent ID {ai_chat_content.id} is not a list. Skipping.")
                else:
                    # ai_chat全体の要約を取得
                    overall_chat_summary = None
                    ai_summary_response = db.query(AiSummaryResponse).filter(
                        AiSummaryResponse.original_history_content_id == ai_chat_content.id
                    ).first()
                    overall_chat_summary = ai_summary_response.summarized_content if ai_summary_response else None

                    # チャット履歴を解析し、質問と回答のペアを抽出
                    questions_with_answers: List[Dict[str, Any]] = []
                    current_question_data: Optional[Dict[str, Any]] = None

                    for i, message in enumerate(chat_history_data):
                        message_role = message.get('sender', 'unknown')
                        message_text = message.get('text', 'No text')
                        timestamp_str = message.get('timestamp')
                        message_timestamp = None
                        if timestamp_str:
                            try:
                                message_timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                            except ValueError:
                                logging.warning(f"Invalid timestamp format in chat history: {timestamp_str}")

                        if message_role == "user":
                            if current_question_data is not None:
                                questions_with_answers.append({
                                    "question": current_question_data["question"],
                                    "answer": "",
                                    "timestamp": current_question_data["timestamp"],
                                    "category": current_question_data.get("category")
                                })
                            current_question_data = {"question": message_text, "timestamp": message_timestamp, "category": message.get("category")}
                        elif message_role == "ai" and current_question_data is not None:
                            questions_with_answers.append({
                                "question": current_question_data["question"],
                                "answer": message_text,
                                "timestamp": current_question_data["timestamp"],
                                "category": current_question_data.get("category")
                            })
                            current_question_data = None

                    if current_question_data is not None:
                        questions_with_answers.append({
                            "question": current_question_data["question"],
                            "answer": "",
                            "timestamp": current_question_data["timestamp"],
                            "category": current_question_data.get("category")
                        })
                    
                    # ai_chatから抽出した質問もカテゴリごとにグループ化
                    for qa_pair in questions_with_answers:
                        category = qa_pair.get("category", "未分類")
                                            # ai_chatから抽出した質問には、全体の要約を紐付ける
                                            #qa_pair["summarized_qa"] = overall_chat_summary # 全体の要約を個別の質問に紐付け
                        qa_pair["history_content_id"] = ai_chat_content.id # ai_chatのHistoryContent IDを紐付け
                        questions_by_category[category].append(qa_pair)
            except json.JSONDecodeError as e:
                logging.error(f"Failed to decode chat history JSON for SummaryHistory ID {summary.id}, HistoryContent ID {ai_chat_content.id}: {e}")
            except Exception as e:
                logging.error(f"Error processing chat history for SummaryHistory ID {summary.id}, HistoryContent ID {ai_chat_content.id}: {e}")

        # カテゴリノードと質問ノード、およびリンクを構築
        for category_name, qa_pairs in questions_by_category.items():
            category_node_id = f"category_{summary.id}_{category_name}"
            nodes.append(GraphNode(
                id=category_node_id,
                label=category_name,
                type="category",
                summary_id=summary.id, # どの要約に属するカテゴリか
                category=category_name,
            ))
            links.append(GraphLink(source=summary_node_id, target=category_node_id, type="summary_category_link"))

            for i, qa_pair in enumerate(qa_pairs):
                question_node_id = f"question_{summary.id}_{category_name}_{i}"
                
                # 質問ノードに紐づく要約を決定
                current_question_node_summary = qa_pair.get("summarized_qa")

                nodes.append(GraphNode(
                    id=question_node_id,
                    label=qa_pair["question"],
                    type="user_question",
                    summary_id=summary.id,
                    question_id=question_node_id,
                    ai_answer=qa_pair["answer"],
                    ai_answer_summary=current_question_node_summary, # NEW: 要約されたAI回答を追加
                    question_created_at=qa_pair["timestamp"], # NEW FIELD: question_created_at を追加
                    category=qa_pair.get("category"), # NEW FIELD: category を追加
                    history_content_id=qa_pair.get("history_content_id") # NEW FIELD: HistoryContent.id を追加
                ))
                
                links.append(GraphLink(source=category_node_id, target=question_node_id, type="category_question_link")) # カテゴリノードから質問ノードへリンク

    # 質問ノード間の類似度に基づいてノードを統合
    question_nodes_data = [
        node for node in nodes if node.type == "user_question"
    ]
    
    # 質問テキストとIDのマップを作成
    question_texts = {node.id: node.label for node in question_nodes_data}
    question_ids = list(question_texts.keys())

    # 埋め込みベクトルを生成
    embeddings = {}
    history_content_embeddings_map = {}
    history_content_ids = [node.history_content_id for node in question_nodes_data if node.history_content_id is not None]
    if history_content_ids:
        db_history_contents = db.query(HistoryContent).filter(HistoryContent.id.in_(history_content_ids)).all()
        for hc in db_history_contents:
            if hc.embedding:
                try:
                    history_content_embeddings_map[hc.id] = json.loads(hc.embedding)
                except json.JSONDecodeError:
                    logging.warning(f"Failed to decode embedding for HistoryContent ID {hc.id}")

    for node in question_nodes_data:
        q_id = node.id
        q_text = node.label
        
        embedding = None
        if node.history_content_id and node.history_content_id in history_content_embeddings_map:
            embedding_list = history_content_embeddings_map[node.history_content_id]
            embedding = torch.tensor(embedding_list)
            model = get_embedding_model()
            if embedding.shape[-1] != model.get_sentence_embedding_dimension():
                logging.warning(f"Embedding dimension mismatch for HistoryContent ID {node.history_content_id}. Expected {model.get_sentence_embedding_dimension()}, got {embedding.shape[-1]}. Regenerating embedding.")
                embedding = None

        if embedding is None:
            model = get_embedding_model()
            embedding = model.encode(q_text, convert_to_tensor=True)
        
        if embedding is not None:
            embeddings[q_id] = embedding

    def calculate_cosine_similarity(vec1, vec2):
        if vec1.dim() == 1:
            vec1 = vec1.unsqueeze(0)
        if vec2.dim() == 1:
            vec2 = vec2.unsqueeze(0)
        cosine_scores = util.cos_sim(vec1, vec2)
        return cosine_scores.item()

    SIMILARITY_THRESHOLD = 0.85

    # 類似ノードをグループ化するロジック
    node_to_group_map = {}
    groups = [] # 各グループはノードIDのリスト

    # 質問ノードをcreated_atでソートし、古いものから順に処理することで、代表ノードの選出を安定させる
    # ソート前にquestion_created_atがoffset-awareであることを保証
    for node in question_nodes_data:
        if node.question_created_at and node.question_created_at.tzinfo is None:
            node.question_created_at = node.question_created_at.replace(tzinfo=timezone.utc)
        elif node.question_created_at is None:
            node.question_created_at = datetime.min.replace(tzinfo=timezone.utc) # Noneの場合は最小値のUTC aware datetimeを設定

    sorted_question_nodes_data = sorted(question_nodes_data, key=lambda x: x.question_created_at)
    sorted_question_ids = [node.id for node in sorted_question_nodes_data]

    for q_id1 in sorted_question_ids:
        if q_id1 not in embeddings:
            continue

        if q_id1 in node_to_group_map:
            continue

        current_group = [q_id1]
        node_to_group_map[q_id1] = current_group

        for q_id2 in sorted_question_ids:
            if q_id1 == q_id2 or q_id2 not in embeddings:
                continue
            
            if q_id2 in node_to_group_map:
                continue

            vec1_tensor = embeddings[q_id1]
            vec2_tensor = embeddings[q_id2]
            
            sim = calculate_cosine_similarity(vec1_tensor, vec2_tensor)
            if sim >= SIMILARITY_THRESHOLD:
                current_group.append(q_id2)
                node_to_group_map[q_id2] = current_group
        
        groups.append(current_group)

    # 統合されたノードとリンクを生成
    final_nodes: List[GraphNode] = []
    final_links: List[GraphLink] = []
    
    # 統合された質問ノードのIDと、それが置き換える元の質問ノードIDのマップ
    integrated_node_replacements: Dict[str, str] = {} # {元の質問ノードID: 統合ノードID}

    for group_index, group in enumerate(groups):
        if len(group) > 1: # 類似ノードが複数ある場合のみ統合
            # 代表ノードを選出 (ここではグループ内の最も古いノードを代表とする)
            representative_node_id = group[0] # ソート済みリストから取得した最初のノード
            representative_node_data = next(node for node in question_nodes_data if node.id == representative_node_id)
            
            integrated_label = f"類似質問 ({len(group)}件): {representative_node_data.label}"
            integrated_node_id = f"integrated_question_group_{representative_node_data.summary_id}_{group_index}"
            
            original_questions_details_list = []
            for original_q_id in group:
                original_node = next(node for node in question_nodes_data if node.id == original_q_id)
                original_questions_details_list.append({
                    "id": original_node.id,
                    "label": original_node.label,
                    "question_id": original_node.question_id
                })

            integrated_node = GraphNode(
                id=integrated_node_id,
                label=integrated_label,
                type="user_question_group",
                summary_id=representative_node_data.summary_id,
                question_id=integrated_node_id,
                ai_answer=None,
                ai_answer_summary=None,
                question_created_at=representative_node_data.question_created_at,
                category=representative_node_data.category,
                history_content_id=None,
                original_summary_id=representative_node_data.original_summary_id,
                grouped_question_ids=group,
                original_questions_details=original_questions_details_list # ここで詳細情報を追加
            )
            final_nodes.append(integrated_node)

            for original_q_id in group:
                integrated_node_replacements[original_q_id] = integrated_node_id
        else: # 類似ノードがない単独の質問ノードはそのまま追加
            q_id = group[0]
            node = next(node for node in question_nodes_data if node.id == q_id)
            final_nodes.append(node)

    # 元のノードリストから質問ノード以外のノードをfinal_nodesに追加
    for node in nodes:
        if node.type != "user_question":
            final_nodes.append(node)
    
    # 元のリンクリストを再構築
    # まず、カテゴリノードから統合された質問ノードへのリンクを生成
    for category_name, qa_pairs in questions_by_category.items():
        category_node_id = f"category_{summary.id}_{category_name}"
        # このカテゴリに属する質問ノードが統合された場合、統合ノードへのリンクを作成
        for qa_pair in qa_pairs:
            question_node_id = f"question_{summary.id}_{category_name}_{qa_pairs.index(qa_pair)}"
            if question_node_id in integrated_node_replacements:
                integrated_node_id = integrated_node_replacements[question_node_id]
                # 重複を避けてリンクを追加
                if not any(fl.source == category_node_id and fl.target == integrated_node_id and fl.type == "category_question_link" for fl in final_links):
                    final_links.append(GraphLink(source=category_node_id, target=integrated_node_id, type="category_question_link"))
            else:
                # 統合されなかった質問ノードへのリンクはそのまま追加
                final_links.append(GraphLink(source=category_node_id, target=question_node_id, type="category_question_link"))

    # その他のリンクを処理
    for link in links:
        # category_question_link は既に処理済みなのでスキップ
        if link.type == "category_question_link":
            continue

        source_id = link.source
        target_id = link.target

        # リンクのソースまたはターゲットが統合された質問ノードの場合、統合ノードIDに置き換える
        if source_id in integrated_node_replacements:
            source_id = integrated_node_replacements[source_id]
        if target_id in integrated_node_replacements:
            target_id = integrated_node_replacements[target_id]
        
        # 統合された質問ノードへのリンクで、ソースとターゲットが同じになる場合は追加しない
        if source_id == target_id:
            continue

        # 既に同じリンクが存在しないかチェック (特に統合ノードへのリンクで重複が発生しやすいため)
        if not any(fl.source == source_id and fl.target == target_id and fl.type == link.type for fl in final_links):
            final_links.append(GraphLink(source=source_id, target=target_id, type=link.type, directed=link.directed))

    logging.info(f"Generated final nodes count: {len(final_nodes)}")
    for node in final_nodes:
        logging.info(f"  Node: id={node.id}, label={node.label}, type={node.type}, grouped_question_ids={node.grouped_question_ids}")

    return GraphData(nodes=final_nodes, links=final_links)
async def get_summary_detail(
    summary_id: int,
    current_user: User = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    """IDに基づいて特定の要約履歴とその関連コンテンツを取得する"""
    summary_history = db.query(SummaryHistory).options(
        joinedload(SummaryHistory.contents)
    ).filter(SummaryHistory.id == summary_id).first()

    if not summary_history:
        raise HTTPException(status_code=404, detail="要約履歴が見つかりません")

    # 権限チェック
    is_owner = summary_history.user_id == current_user.id
    is_team_member = False
    if summary_history.team_id:
        membership = db.query(TeamMember).filter(
            TeamMember.team_id == summary_history.team_id,
            TeamMember.user_id == current_user.id
        ).first()
        if membership:
            is_team_member = True

    if not is_owner and not is_team_member:
        raise HTTPException(status_code=403, detail="この履歴を閲覧する権限がありません")

    # original_file_pathをJSON文字列からリストに変換
    deserialized_file_path = (
        json.loads(summary_history.original_file_path)
        if summary_history.original_file_path and summary_history.original_file_path.startswith('[')
        else ([summary_history.original_file_path] if summary_history.original_file_path else None)
    )

    return SummaryHistoryDetailResponse(
        id=summary_history.id,
        user_id=summary_history.user_id,
        team_id=summary_history.team_id,
        filename=summary_history.filename,
        summary=summary_history.summary,
        created_at=summary_history.created_at.astimezone(timezone.utc) if summary_history.created_at.tzinfo is None else summary_history.created_at,
                contents=summary_history.contents,
        original_file_path=deserialized_file_path,
        parent_summary_id=summary_history.parent_summary_id # NEW FIELD
    )

@app.put("/api/summaries/{summary_id}/tags")
async def update_summary_tags(
    summary_id: int,
    request: TagsUpdateRequest,
    current_user: User = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    """要約履歴のタグを更新するエンドポイント"""
    summary = db.query(SummaryHistory).filter(SummaryHistory.id == summary_id).first()
    if not summary:
        raise HTTPException(status_code=404, detail="要約履歴が見つかりません")

    # 権限チェック：要約の所有者のみがタグを編集できる
    if summary.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="この要約のタグを編集する権限がありません")

    # タグリストをカンマ区切りの文字列に変換
    tags_str = ",".join(request.tags)
    summary.tags = tags_str
    
    db.commit()
    db.refresh(summary)

    return {"message": "タグが正常に更新されました", "summary_id": summary.id, "tags": request.tags}

@app.put("/api/summaries/{summary_id}/title")
async def update_summary_title(
    summary_id: int,
    request: SummaryTitleUpdateRequest,
    current_user: User = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    """要約履歴のタイトルを更新するエンドポイント"""
    summary = db.query(SummaryHistory).filter(SummaryHistory.id == summary_id).first()
    if not summary:
        raise HTTPException(status_code=404, detail="要約履歴が見つかりません")

    # 権限チェック：要約の所有者のみがタイトルを編集できる
    if summary.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="この要約のタイトルを編集する権限がありません")

    summary.filename = request.filename
    
    db.commit()
    db.refresh(summary)

    return {"message": "タイトルが正常に更新されました", "summary_id": summary.id, "filename": request.filename}

@app.get("/api/users/me")
async def read_users_me(current_user: User = Depends(get_required_user)):
    """現在のユーザー情報を取得するエンドポイント"""
    return {"username": current_user.username, "id": current_user.id}

@app.get("/api/history-contents/{content_id}")
async def get_history_content_by_id(
    content_id: int,
    current_user: User = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    """IDに基づいて履歴コンテンツを取得するエンドポイント"""
    history_content = db.query(HistoryContent).filter(HistoryContent.id == content_id).first()

    if not history_content:
        raise HTTPException(status_code=404, detail="履歴コンテンツが見つかりません")

    # 権限チェック：関連する要約履歴の所有者またはチームメンバーかを確認
    summary_history = db.query(SummaryHistory).filter(SummaryHistory.id == history_content.summary_history_id).first()
    if not summary_history:
        raise HTTPException(status_code=404, detail="関連する要約履歴が見つかりません")

    is_owner = summary_history.user_id == current_user.id
    is_team_member = False
    if summary_history.team_id:
        membership = db.query(TeamMember).filter(
            TeamMember.team_id == summary_history.team_id,
            TeamMember.user_id == current_user.id
        ).first()
        if membership:
            is_team_member = True

    if not is_owner and not is_team_member:
        raise HTTPException(status_code=403, detail="この履歴コンテンツを閲覧する権限がありません")

    return HistoryContentResponse(
        id=history_content.id,
        summary_history_id=history_content.summary_history_id,
        section_type=history_content.section_type,
        content=history_content.content,
        created_at=history_content.created_at,
        updated_at=history_content.updated_at
    )

if __name__ == "__main__":
    # CPUコア数の半分に基づいてワーカー数を設定（最低1ワーカー）
    num_workers = max(1, (os.cpu_count() or 1) // 2)
    config = uvicorn.Config("main:app", host="0.0.0.0", port=8000, reload=True, workers=num_workers)
    server = uvicorn.Server(config)
    server.run()
