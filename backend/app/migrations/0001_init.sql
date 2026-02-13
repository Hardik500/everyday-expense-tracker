CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    hashed_password TEXT,
    email TEXT,
    full_name TEXT,
    disabled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    gmail_refresh_token TEXT,
    gmail_enabled BOOLEAN DEFAULT FALSE,
    gmail_last_sync TIMESTAMP,
    gmail_filter_query TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS statements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    account_id INTEGER NOT NULL,
    source TEXT NOT NULL,
    file_name TEXT NOT NULL,
    imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(account_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    is_system INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS subcategories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    UNIQUE(user_id, category_id, name),
    FOREIGN KEY(category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    pattern TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    subcategory_id INTEGER,
    min_amount REAL,
    max_amount REAL,
    priority INTEGER NOT NULL DEFAULT 50,
    account_type TEXT,
    merchant_contains TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY(category_id) REFERENCES categories(id),
    FOREIGN KEY(subcategory_id) REFERENCES subcategories(id)
);

CREATE TABLE IF NOT EXISTS mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    description_norm TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    subcategory_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, description_norm),
    FOREIGN KEY(category_id) REFERENCES categories(id),
    FOREIGN KEY(subcategory_id) REFERENCES subcategories(id)
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    account_id INTEGER NOT NULL,
    statement_id INTEGER,
    posted_at TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    description_raw TEXT NOT NULL,
    description_norm TEXT NOT NULL,
    category_id INTEGER,
    subcategory_id INTEGER,
    is_uncertain INTEGER NOT NULL DEFAULT 1,
    hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(account_id) REFERENCES accounts(id),
    FOREIGN KEY(statement_id) REFERENCES statements(id),
    FOREIGN KEY(category_id) REFERENCES categories(id),
    FOREIGN KEY(subcategory_id) REFERENCES subcategories(id),
    UNIQUE(user_id, account_id, hash)
);

CREATE TABLE IF NOT EXISTS transaction_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_transaction_id INTEGER NOT NULL,
    target_transaction_id INTEGER NOT NULL,
    link_type TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_transaction_id, target_transaction_id, link_type),
    FOREIGN KEY(source_transaction_id) REFERENCES transactions(id),
    FOREIGN KEY(target_transaction_id) REFERENCES transactions(id)
);
