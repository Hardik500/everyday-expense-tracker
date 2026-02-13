"""
Database connection module with support for both SQLite (development) and PostgreSQL (production).

Set DATABASE_URL environment variable:
- SQLite: sqlite:///path/to/database.db
- PostgreSQL: postgresql://user:password@host:port/database
"""
import os
import sqlite3
import json
from pathlib import Path
from typing import Union, Any, List, Optional

# MED-001: Use relative path or environment variable
import tempfile

DEFAULT_DB_PATH = os.getenv(
    "SQLITE_DB_PATH", 
    os.path.join(tempfile.gettempdir(), "expense-tracker", "expense.db")
)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{DEFAULT_DB_PATH}",
)

# Detect database type
IS_POSTGRES = DATABASE_URL.startswith("postgresql://") or DATABASE_URL.startswith("postgres://")

# HIGH-005: Query timeout configuration (30 seconds default)
DB_QUERY_TIMEOUT = int(os.getenv("DB_QUERY_TIMEOUT", "30"))


class PostgresCursorWrapper:
    """Wrapper for psycopg2 cursor to provide SQLite-compatible interface."""
    
    def __init__(self, cursor, lastrowid=None):
        self._cursor = cursor
        self.lastrowid = lastrowid
        self.rowcount = cursor.rowcount
    
    def fetchone(self):
        return self._cursor.fetchone()
    
    def fetchall(self):
        return self._cursor.fetchall()
    
    def fetchmany(self, size=None):
        return self._cursor.fetchmany(size) if size is not None else self._cursor.fetchmany()
    
    def close(self):
        self._cursor.close()
    
    def __iter__(self):
        return iter(self._cursor)
    
    def __getattr__(self, name):
        """Proxy other attributes to the underlying cursor."""
        return getattr(self._cursor, name)


class PostgresConnectionWrapper:
    """
    Wrapper for psycopg2 connection that provides SQLite-compatible interface.
    
    SQLite connections have .execute() method directly on the connection,
    but psycopg2 requires using a cursor. This wrapper provides that compatibility.
    """
    
    def __init__(self, conn):
        self._conn = conn
    
    def cursor(self):
        """Return a new cursor."""
        return self._conn.cursor()
    
    def execute(self, sql, params=None):
        """Execute SQL directly on connection (SQLite-compatible interface)."""
        cursor = self._conn.cursor()
        
        # Convert ? placeholders to %s for PostgreSQL
        if params:
            sql = sql.replace("?", "%s")
        
        # Handle lastrowid by appending RETURNING id to INSERT statements
        lastrowid = None
        sql_stripped = sql.strip()
        is_insert = sql_stripped.upper().startswith("INSERT")
        
        if is_insert and "RETURNING" not in sql_stripped.upper():
            # Append RETURNING id to get the lastrowid equivalent
            sql_with_returning = f"{sql_stripped.rstrip(';')} RETURNING id"
            try:
                cursor.execute(sql_with_returning, params)
                result = cursor.fetchone()
                if result:
                    # Handle both dict-like and tuple-like row results
                    if hasattr(result, 'get'):
                        lastrowid = result.get('id')
                    elif isinstance(result, (list, tuple)) and len(result) > 0:
                        lastrowid = result[0]
            except Exception:
                # Fallback in case RETURNING id fails (e.g. table has no 'id' column)
                self._conn.rollback() # Important to rollback after failed execution
                cursor = self._conn.cursor() # Get fresh cursor
                cursor.execute(sql, params)
        else:
            cursor.execute(sql, params)
            
        return PostgresCursorWrapper(cursor, lastrowid)
    
    def executemany(self, sql, params_list):
        """Execute SQL with multiple parameter sets."""
        cursor = self._conn.cursor()
        sql = sql.replace("?", "%s")
        cursor.executemany(sql, params_list)
        return PostgresCursorWrapper(cursor)
    
    def executescript(self, sql):
        """Execute multiple SQL statements (for migrations)."""
        # PostgreSQL doesn't have a direct equivalent to executescript, 
        # but execute() can handle multiple statements if they are separated by semicolons.
        cursor = self._conn.cursor()
        cursor.execute(sql)
        return PostgresCursorWrapper(cursor)
    
    def commit(self):
        """Commit the transaction."""
        self._conn.commit()
    
    def rollback(self):
        """Rollback the transaction."""
        self._conn.rollback()
    
    def close(self):
        """Close the connection."""
        self._conn.close()
    
    def __enter__(self):
        """Context manager entry - return self."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - commit on success, rollback on error."""
        if exc_type is None:
            try:
                self.commit()
            except Exception:
                self.rollback()
        else:
            self.rollback()
        self.close()
        return False


class TimeoutCursor:
    """Wrapper that enforces timeouts on long-running queries."""
    def __init__(self, cursor, timeout):
        self._cursor = cursor
        self._timeout = timeout
        
    def execute(self, sql, params=None):
        import signal
        def timeout_handler(signum, frame):
            raise TimeoutError(f"Database query timed out after {self._timeout} seconds")
        
        # Set timeout using signal alarm (Unix only)
        old_handler = signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(self._timeout)
        try:
            self._cursor.execute(sql, params)
        finally:
            signal.alarm(0)
            signal.signal(signal.SIGALRM, old_handler)
    
    def __getattr__(self, name):
        return getattr(self._cursor, name)
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - commit on success, rollback on error."""
        if exc_type is None:
            try:
                self.commit()
            except Exception:
                self.rollback()
        else:
            self.rollback()
        self.close()
        return False


def _sqlite_path() -> Path:
    """Extract SQLite file path from DATABASE_URL."""
    if not DATABASE_URL.startswith("sqlite:///"):
        raise ValueError("Expected sqlite:/// URL")
    return Path(DATABASE_URL.replace("sqlite:///", "", 1))


def get_conn():
    """
    Get a database connection. Works with both SQLite and PostgreSQL.
    
    For SQLite: Returns sqlite3.Connection with Row factory
    For PostgreSQL: Returns wrapped psycopg2 connection with RealDictCursor
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
        return PostgresConnectionWrapper(conn)
    else:
        db_path = _sqlite_path()
        db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn


def apply_migrations() -> None:
    """
    Apply database migrations based on the database type.
    """
    if IS_POSTGRES:
        migrations_dir = Path(__file__).parent / "migrations_pg"
        migration_files = sorted(migrations_dir.glob("*.sql"))
        
        with get_conn() as conn:
            # 1. Ensure migrations table exists
            conn.execute("""
                CREATE TABLE IF NOT EXISTS migrations (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL UNIQUE,
                    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()
            
            # 2. Get applied migrations
            # We fetch as a list of dicts from our wrapper
            applied_rows = conn.execute("SELECT name FROM migrations").fetchall()
            applied = {row["name"] for row in applied_rows}
            
            # 3. Apply missing migrations
            for migration in migration_files:
                if migration.name in applied:
                    continue
                
                print(f"Applying PostgreSQL migration: {migration.name}")
                sql = migration.read_text(encoding="utf-8")
                # executescript is just execute in our wrapper for pg
                conn.executescript(sql)
                conn.execute(
                    "INSERT INTO migrations (name) VALUES (?)",
                    (migration.name,),
                )
                conn.commit()
        
        print("PostgreSQL: Migrations complete.")
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
            
            # Special case for commented out migrations or manual skips
            sql = migration.read_text(encoding="utf-8")
            if not sql.strip() or sql.strip().startswith("--"):
                # Still mark as applied if it's just comments/empty
                conn.execute("INSERT INTO migrations (name) VALUES (?)", (migration.name,))
                conn.commit()
                continue

            try:
                conn.executescript(sql)
                conn.execute(
                    "INSERT INTO migrations (name) VALUES (?)",
                    (migration.name,),
                )
            except sqlite3.OperationalError as e:
                msg = str(e)
                # Make migrations resilient across partially-initialized DBs
                # (especially when users reset DBs or when earlier migrations were edited).
                if "duplicate column name" in msg:
                    print(f"Skipping duplicate column migration: {migration.name} ({msg})")
                    conn.execute("INSERT INTO migrations (name) VALUES (?)", (migration.name,))
                elif "no such table" in msg:
                    print(f"Skipping migration due to missing table: {migration.name} ({msg})")
                    conn.execute("INSERT INTO migrations (name) VALUES (?)", (migration.name,))
                elif "no such column" in msg:
                    print(f"Skipping migration due to missing column: {migration.name} ({msg})")
                    conn.execute("INSERT INTO migrations (name) VALUES (?)", (migration.name,))
                else:
                    raise
        conn.commit()
