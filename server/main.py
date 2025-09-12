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
from sqlalchemy.orm import Session, joinedload
from .database import Base, engine, SessionLocal, User, SummaryHistory, Team, TeamMember, Comment, HistoryContent, SharedFile, Reaction, Message
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, List
import uuid
from fastapi.responses import FileResponse
import re # 追加

# ファイル保存ディレクトリの設定
UPLOAD_DIRECTORY = "./shared_files"

# ディレクトリが存在しない場合は作成
if not os.path.exists(UPLOAD_DIRECTORY):
    os.makedirs(UPLOAD_DIRECTORY)
    logging.info(f"Created upload directory: {UPLOAD_DIRECTORY}")

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

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str


class SaveSummaryRequest(BaseModel):
    filename: str
    summary: str
    team_id: Optional[int] = None # 追加
    tags: Optional[List[str]] = None # 追加

class TagsUpdateRequest(BaseModel):
    tags: List[str]

class TeamCreateRequest(BaseModel):
    name: str

class CommentCreateRequest(BaseModel):
    summary_id: int
    content: str

class ReactionCreateRequest(BaseModel):
    reaction_type: str

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

class SummaryHistoryDetailResponse(BaseModel):
    id: int
    user_id: int
    team_id: Optional[int] = None
    filename: str
    summary: str
    created_at: datetime
    contents: List[HistoryContentResponse] = []

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
async def chat(request: ChatRequest):
    """チャットエンドポイント"""

    client = genai.Client(api_key=API_KEY)
    try:
        full_content = request.message
        if request.pdf_summary:
            full_content = f"以下のPDF要約を考慮して質問に答えてください。\n\nPDF要約:\n{request.pdf_summary}\n\n質問:\n{request.message}"

        # 新しいモデル名に変更
        response = client.models.generate_content(
            model='gemini-2.0-flash-001', contents=full_content
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
    db: Session = Depends(get_db)
):
    """PDF アップロードと要約生成エンドポイント（認証なし）"""
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
                        {'text': 'このPDFファイルの内容を日本語で要約してください。要点をmarkdownを活用した箇条書きで整理し、わかりやすく説明してください。要約内容に合ったタグを少なくとも3つ生成してください。最大数は5個です．生成したタグに関しては，markdownで見出しなどをつけずにプレーンなテキスト [タグ: tag1, tag2, tag3...] の形式で文末に含めてください。タグが生成できない場合でも、必ず `[タグ: なし]` と記述してください。'},
                        {'inline_data': {'mime_type': 'application/pdf', 'data': base64_content}}
                    ]
                }
            ]
        )
        
        logging.info(f"PDF summary generated for file: {file.filename}")
        
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
            "filename": file.filename,
            "summary": summary,
            "status": "success",
            "tags": generated_tags # 生成されたタグをレスポンスに追加
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
    """認証されたユーザーの要約履歴と、所属チームの共有要約を取得する"""
    try:
        # ユーザー自身の要約を取得
        user_summaries_query = db.query(SummaryHistory, User.username, Team.name).outerjoin(Team, SummaryHistory.team_id == Team.id).join(User, SummaryHistory.user_id == User.id).filter(
            SummaryHistory.user_id == current_user.id
        ).order_by(SummaryHistory.created_at.desc())
        
        user_summaries_data = []
        for summary, username, team_name in user_summaries_query.all():
            user_summaries_data.append({
                "id": summary.id,
                "filename": summary.filename,
                "summary": summary.summary,
                "created_at": summary.created_at,
                "team_id": summary.team_id,
                "username": username, # 自分の要約の作成者名
                "team_name": team_name, # チーム名を追加
                "tags": summary.tags.split(',') if summary.tags else []
            })

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
                shared_summaries_data.append({
                    "id": summary.id,
                    "filename": summary.filename,
                    "summary": summary.summary,
                    "created_at": summary.created_at,
                    "team_id": summary.team_id,
                    "username": username, # 共有要約の作成者名
                    "team_name": team_name, # チーム名を追加
                    "tags": summary.tags.split(',') if summary.tags else []
                })

        # 両方のリストを結合して返す
        all_summaries = user_summaries_data + shared_summaries_data

        # 重複を排除し、作成日時でソート（必要であれば）
        # ここでは単純に結合しているため、重複排除とソートはフロントエンドで行うか、
        # より複雑なクエリを構築する必要があります。
        # 例: set()を使って重複排除し、リストに変換後ソート
        unique_summaries = list({s["id"]: s for s in all_summaries}.values())
        unique_summaries.sort(key=lambda x: x["created_at"], reverse=True)

        return unique_summaries
    except Exception as e:
        logging.error(f"Error fetching summaries for user {current_user.username}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"要約の取得中にエラーが発生しました: {str(e)}")

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
        # team_idが指定されている場合、ユーザーがそのチームのメンバーであることを確認
        if request.team_id:
            team_membership = db.query(TeamMember).filter(
                TeamMember.user_id == current_user.id,
                TeamMember.team_id == request.team_id
            ).first()
            if not team_membership:
                raise HTTPException(status_code=403, detail="指定されたチームに要約を保存する権限がありません")

        new_history = SummaryHistory(
            user_id=current_user.id,
            filename=request.filename,
            summary=request.summary,
            team_id=request.team_id,
            tags=",".join(request.tags) if request.tags else None, # tagsを追加
            created_at=datetime.now(timezone.utc) # 明示的にUTCを設定
        )
        db.add(new_history)
        db.commit()
        db.refresh(new_history)
        return {"message": "要約が正常に保存されました", "id": new_history.id}
    except Exception as e:
        logging.error(f"Error saving summary via /api/save-summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"要約の保存中にエラーが発生しました: {str(e)}")


@app.post("/api/teams/{team_id}/files")
async def upload_shared_file(
    team_id: int,
    file: UploadFile = File(...),
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

    # ファイルのバリデーション
    if not file.filename:
        raise HTTPException(status_code=400, detail="ファイル名がありません")
    
    # ファイル名から拡張子を取得し、許可された拡張子か確認
    file_extension = os.path.splitext(file.filename)[1].lower()
    if file_extension not in [".pdf", ".txt", ".png", ".jpg", ".jpeg", ".gif"]: # 許可する拡張子を定義
        raise HTTPException(status_code=400, detail="許可されていないファイル形式です。PDF, TXT, 画像ファイルのみアップロード可能です。")

    # ファイルサイズの制限 (例: 50MB)
    MAX_FILE_SIZE = 50 * 1024 * 1024 # 50 MB
    file_content = await file.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"ファイルサイズが大きすぎます ({MAX_FILE_SIZE / (1024 * 1024):.0f}MB以下にしてください)")

    # ファイルを保存
    # ファイル名の衝突を避けるため、UUIDなどを利用することも検討
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(UPLOAD_DIRECTORY, unique_filename)

    try:
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
    except Exception as e:
        logging.error(f"Error saving file to disk: {e}")
        raise HTTPException(status_code=500, detail="ファイルの保存中にエラーが発生しました")

    # データベースに記録
    new_shared_file = SharedFile(
        filename=file.filename,
        filepath=file_path,
        team_id=team_id,
        uploaded_by_user_id=current_user.id
    )
    db.add(new_shared_file)
    db.commit()
    db.refresh(new_shared_file)

    return {"message": "ファイルが正常にアップロードされました", "file_id": new_shared_file.id, "filename": new_shared_file.filename}


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
    """共有ファイルをダウンロードするエンドポイント"""
    shared_file = db.query(SharedFile).filter(SharedFile.id == file_id).first()
    if not shared_file:
        raise HTTPException(status_code=404, detail="ファイルが見つかりません")

    # ユーザーがファイルが共有されているチームのメンバーであることを確認
    team_membership = db.query(TeamMember).filter(
        TeamMember.user_id == current_user.id,
        TeamMember.team_id == shared_file.team_id
    ).first()
    if not team_membership:
        raise HTTPException(status_code=403, detail="このファイルをダウンロードする権限がありません")

    file_path = shared_file.filepath
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="ファイルが見つかりません (サーバー上)")

    return FileResponse(path=file_path, filename=shared_file.filename, media_type="application/octet-stream")


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


@app.get("/api/summaries/{summary_id}", response_model=SummaryHistoryDetailResponse)

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

@app.get("/api/users/me")
async def read_users_me(current_user: User = Depends(get_required_user)):
    """現在のユーザー情報を取得するエンドポイント"""
    return {"username": current_user.username, "id": current_user.id}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)