import argparse
from pathlib import Path

from app.db import apply_migrations, get_conn
from app.ingest.csv import ingest_csv
from app.ingest.ofx import ingest_ofx
from app.ingest.pdf import ingest_pdf
from app.ingest.xls import ingest_xls
from app.linking import link_card_payments
from app.rules.engine import apply_rules
from app.seed import seed_categories_and_rules


def main() -> None:
    parser = argparse.ArgumentParser(description="Expense Tracker CLI")
    parser.add_argument("account_id", type=int)
    parser.add_argument("file_path", type=str)
    parser.add_argument("--source", choices=["csv", "ofx", "xls", "pdf"], required=True)
    parser.add_argument("--profile", type=str)
    args = parser.parse_args()

    apply_migrations()
    seed_categories_and_rules()

    path = Path(args.file_path)
    payload = path.read_bytes()

    with get_conn() as conn:
        statement_id = conn.execute(
            "INSERT INTO statements (account_id, source, file_name) VALUES (?, ?, ?)",
            (args.account_id, args.source, path.name),
        ).lastrowid
        conn.commit()

        if args.source == "csv":
            inserted, skipped, _ = ingest_csv(
                conn, args.account_id, statement_id, payload, args.profile
            )
        elif args.source == "xls":
            inserted, skipped, _ = ingest_xls(
                conn, args.account_id, statement_id, payload, args.profile
            )
        elif args.source == "pdf":
            inserted, skipped = ingest_pdf(conn, args.account_id, statement_id, payload)
        else:
            inserted, skipped = ingest_ofx(conn, args.account_id, statement_id, payload)

        apply_rules(conn, account_id=args.account_id, statement_id=statement_id)
        link_card_payments(conn, account_id=args.account_id)
        conn.commit()

    print(f"Inserted {inserted} transactions, skipped {skipped}.")


if __name__ == "__main__":
    main()
