import os
import sqlite3
from pathlib import Path

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:////home/hardik/projects/expense-tracker/backend/data/expense.db",
)


def _sqlite_path() -> Path:
    if not DATABASE_URL.startswith("sqlite:///"):
        raise ValueError("Only sqlite:/// URLs are supported for now.")
    return Path(DATABASE_URL.replace("sqlite:///", "", 1))


def get_conn() -> sqlite3.Connection:
    db_path = _sqlite_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def apply_migrations() -> None:
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
