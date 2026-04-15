from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models import User, Workspace
from app.schemas import LoginRequest, TokenResponse, WorkspaceCreate

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
def register_workspace(payload: WorkspaceCreate, db: Session = Depends(get_db)):
    """
    Register a new company workspace + first HR admin account.
    This is the signup flow for new CobbyIQ customers.
    """
    # Check email not already taken
    existing = db.query(User).filter(User.email == payload.admin_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create workspace
    workspace = Workspace(company_name=payload.company_name)
    db.add(workspace)
    db.flush()  # get workspace.id without committing

    # Create HR admin user
    admin = User(
        workspace_id=workspace.id,
        email=payload.admin_email,
        name=payload.admin_name,
        hashed_password=hash_password(payload.admin_password),
        role="hr",
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    token = create_access_token({"sub": str(admin.id), "role": admin.role})
    return TokenResponse(
        access_token=token,
        role=admin.role,
        workspace_id=workspace.id,
        name=admin.name,
        email=admin.email,
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Login with email + password. Returns JWT."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password or ""):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(
        access_token=token,
        role=user.role,
        workspace_id=user.workspace_id,
        name=user.name,
        email=user.email,
    )