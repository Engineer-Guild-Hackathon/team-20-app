from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.sql import func

DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)

    teams = relationship("TeamMember", back_populates="user")
    summaries = relationship("SummaryHistory", back_populates="user")
    comments = relationship("Comment", back_populates="user")
    uploaded_files = relationship("SharedFile", back_populates="uploaded_by_user")
    reactions = relationship("Reaction", back_populates="user")
    messages = relationship("Message", back_populates="user")
    session = relationship("UserSession", back_populates="user", uselist=False)

class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    session_data = Column(Text, nullable=False) # Stores JSON string of session state
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="session")

class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    members = relationship("TeamMember", back_populates="team")
    summaries = relationship("SummaryHistory", back_populates="team")
    shared_files = relationship("SharedFile", back_populates="team")
    messages = relationship("Message", back_populates="team")

class TeamMember(Base):
    __tablename__ = "team_members"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    team_id = Column(Integer, ForeignKey("teams.id"), primary_key=True)
    role = Column(String, nullable=False, default="member") # e.g., "admin", "member"
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="teams")
    team = relationship("Team", back_populates="members")

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    summary_id = Column(Integer, ForeignKey("summary_histories.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    summary = relationship("SummaryHistory", back_populates="comments")
    user = relationship("User", back_populates="comments")
    reactions = relationship("Reaction", back_populates="comment", cascade="all, delete-orphan")

class Reaction(Base):
    __tablename__ = "reactions"

    id = Column(Integer, primary_key=True, index=True)
    comment_id = Column(Integer, ForeignKey("comments.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reaction_type = Column(String, nullable=False) # 例: "👍", "❤️", "😂"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    comment = relationship("Comment", back_populates="reactions")
    user = relationship("User", back_populates="reactions")

class SummaryHistory(Base):
    __tablename__ = "summary_histories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    filename = Column(String, nullable=False)
    summary = Column(String, nullable=False)
    tags = Column(String, nullable=True)
    original_file_path = Column(String, nullable=True)  # PDFファイルの保存パス
    chat_history_id = Column(Integer, nullable=True)  # AI チャット履歴への参照（外部キー制約なし）
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    parent_summary_id = Column(Integer, ForeignKey("summary_histories.id"), nullable=True) # NEW FIELD

    user = relationship("User", back_populates="summaries")
    team = relationship("Team", back_populates="summaries")
    comments = relationship("Comment", back_populates="summary", cascade="all, delete-orphan")
    contents = relationship("HistoryContent", back_populates="summary_history", cascade="all, delete-orphan")
    ai_summary_responses = relationship("AiSummaryResponse", back_populates="summary_history", cascade="all, delete-orphan") # NEW
    parent = relationship("SummaryHistory", remote_side=[id]) # NEW RELATIONSHIP

class HistoryContent(Base):
    __tablename__ = "history_contents"

    id = Column(Integer, primary_key=True, index=True)
    summary_history_id = Column(Integer, ForeignKey("summary_histories.id"), nullable=False)
    section_type = Column(String, nullable=False, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    summary_history = relationship("SummaryHistory", back_populates="contents")
    ai_summary_responses = relationship("AiSummaryResponse", back_populates="original_history_content", cascade="all, delete-orphan") # NEW

class AiSummaryResponse(Base): # NEW TABLE
    __tablename__ = "ai_summary_responses"

    id = Column(Integer, primary_key=True, index=True)
    summary_history_id = Column(Integer, ForeignKey("summary_histories.id"), nullable=False)
    original_history_content_id = Column(Integer, ForeignKey("history_contents.id"), nullable=False) # どのHistoryContentから生成されたか
    summarized_content = Column(Text, nullable=False) # 短くまとめたAIの回答
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    summary_history = relationship("SummaryHistory", back_populates="ai_summary_responses")
    original_history_content = relationship("HistoryContent", back_populates="ai_summary_responses")

class SharedFile(Base):
    __tablename__ = "shared_files"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    filepath = Column(String, unique=True, nullable=False) # サーバー上の保存パス
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    team = relationship("Team", back_populates="shared_files")
    uploaded_by_user = relationship("User", back_populates="uploaded_files")

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    team = relationship("Team", back_populates="messages")
    user = relationship("User", back_populates="messages")