"""
Database connection module with support for both SQLite (development) and PostgreSQL (production).

Set DATABASE_URL environment variable:
- SQLite: sqlite:///path/to/database.db
- PostgreSQL: postgresql://user:password@host:port/database
"""
import os
import sqlite3
from pathlib import Path
from contextlib import contextmanager
from typing import Union, Any

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:////home/hardik/projects/expense-tracker/backend/data/expense.db",
)

# Detect database type
IS_POSTGRES = DATABASE_URL.startswith("postgresql://") or DATABASE_URL.startswith("postgres://")


class DictRowFactory:
    """A row factory that returns dict-like objects for PostgreSQL compatibility."""
    def __init__(self, cursor, row):
        self._row = row
        self._keys = [col[0] for col in cursor.description] if cursor.description else []
    
    def __getitem__(self, key):
        if isinstance(key, int):
            return self._row[key]
        if isinstance(key, str):
            try:
                idx = self._keys.index(key)
                return self._row[idx]
            except ValueError:
                raise KeyError(key)
        raise TypeError(f"Invalid key type: {type(key)}")
    
    def keys(self):
        return self._keys
    
    def values(self):
        return self._row
    
    def items(self):
        return zip(self._keys, self._row)
    
    def get(self, key, default=None):
        try:
            return self[key]
        except (KeyError, IndexError):
            return default


def _sqlite_path() -> Path:
    """Extract SQLite file path from DATABASE_URL."""
    if not DATABASE_URL.startswith("sqlite:///"):
        raise ValueError("Expected sqlite:/// URL")
    return Path(DATABASE_URL.replace("sqlite:///", "", 1))


def get_conn():
    """
    Get a database connection. Works with both SQLite and PostgreSQL.
    
    For SQLite: Returns sqlite3.Connection with Row factory
    For PostgreSQL: Returns psycopg2 connection with RealDictCursor
    """
    if IS_POSTGRES:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        
        # Handle Railway/Supabase connection strings
        conn_str = DATABASE_URL
        if conn_str.startswith("postgres://"):
            conn_str = conn_str.replace("postgres://", "postgresql://", 1)
        
        conn = psycopg2.connect(conn_str, cursor_factory=RealDictCursor)
        conn.autocommit = False
        return conn
    else:
        db_path = _sqlite_path()
        db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn


def apply_migrations() -> None:
    """
    Apply database migrations based on the database type.
    
    - For SQLite: Uses migrations/ directory
    - For PostgreSQL: Uses migrations_pg/ directory (should be run manually via Supabase SQL editor)
    """
    if IS_POSTGRES:
        # For PostgreSQL, migrations are typically run via Supabase dashboard
        # or a dedicated migration tool. We just ensure migrations table exists.
        with get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS migrations (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL UNIQUE,
                    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()
        print("PostgreSQL: Migrations table ready. Run migrations via Supabase SQL editor.")
        return
    
    # SQLite migrations
    migrations_dir = Path(__file__).parent / "migrations"
    migration_files = sorted(migrations_dir.glob("*.sql"))
    if not migration_files:
        return

    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        applied = {
            row["name"]
            for row in conn.execute("SELECT name FROM migrations").fetchall()
        }
        for migration in migration_files:
            if migration.name in applied:
                continue
            sql = migration.read_text(encoding="utf-8")
            conn.executescript(sql)
            conn.execute(
                "INSERT INTO migrations (name) VALUES (?)",
                (migration.name,),
            )
        conn.commit()
