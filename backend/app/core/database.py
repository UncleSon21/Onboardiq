from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import settings

# Create the SQLAlchemy engine
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,       # test connections before using them
    pool_size=10,             # max 10 persistent connections
    max_overflow=20,          # allow 20 extra connections under load
)

# Session factory — one session per request
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class all models inherit from."""
    pass


def get_db():
    """
    FastAPI dependency — yields a DB session per request,
    closes it when the request is done.

    Usage:
        @router.get("/example")
        def example(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()