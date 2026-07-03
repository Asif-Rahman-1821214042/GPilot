import os
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field

from app.database import get_db_connection

JWT_SECRET = os.environ.get("JWT_SECRET", "change-this-development-secret")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "1440"))

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer()
password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class SignupRequest(BaseModel):
    name: str = Field(min_length=1)
    staff_id: str = Field(min_length=1)
    password: str = Field(min_length=6)
    designation: str = Field(min_length=1)
    type: str = ""


class LoginRequest(BaseModel):
    staff_id: str = Field(min_length=1)
    password: str = Field(min_length=1)


def public_user(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "staff_id": row["staff_id"],
        "designation": row["designation"],
        "type": row["type"] or "",
        "created_at": row["created_at"],
    }


def create_access_token(user_id: str) -> str:
    expires_at = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expires_at}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_user_by_staff_id(staff_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE staff_id = %s", (staff_id,))
    user = cursor.fetchone()
    conn.close()
    return user


def get_user_by_id(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    user = cursor.fetchone()
    conn.close()
    return user


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@router.post("/signup")
def signup(req: SignupRequest):
    existing_user = get_user_by_staff_id(req.staff_id)
    if existing_user:
        raise HTTPException(status_code=409, detail="Staff ID already exists")

    user_id = f"user-{uuid.uuid4().hex[:10]}"
    now_str = datetime.utcnow().isoformat()
    password_hash = password_context.hash(req.password)

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO users (id, name, staff_id, password_hash, designation, type, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (user_id, req.name, req.staff_id, password_hash, req.designation, req.type or "", now_str))
    conn.commit()
    cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    user = cursor.fetchone()
    conn.close()

    return {"access_token": create_access_token(user_id), "token_type": "bearer", "user": public_user(user)}


@router.post("/login")
def login(req: LoginRequest):
    user = get_user_by_staff_id(req.staff_id)
    if not user or not password_context.verify(req.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid staff ID or password")

    return {"access_token": create_access_token(user["id"]), "token_type": "bearer", "user": public_user(user)}


@router.get("/me")
def me(current_user=Depends(get_current_user)):
    return public_user(current_user)
