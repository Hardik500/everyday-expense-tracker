#!/bin/bash
# One-time script to copy production data to local Supabase
# Run this once to seed your local database with production data

set -e

echo "📦 Copying Production Data to Local Supabase"
echo ""

# Production database credentials
PROD_HOST="aws-1-ap-southeast-1.pooler.supabase.com"
PROD_USER="postgres.wljvvrwsgakfflflexbv"
PROD_PASS="GkDIFrEZz3mrEC7Z"
PROD_DB="postgres"

# Local database URL
LOCAL_DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# Temporary dump file
DUMP_FILE="./prod-dump.sql"

echo "1️⃣  Dumping production database using Docker (PG 17)..."
# Use Docker with PostgreSQL 17 to avoid version mismatch
docker run --rm \
  -e PGPASSWORD="$PROD_PASS" \
  postgres:17 \
  pg_dump \
  -h "$PROD_HOST" \
  -U "$PROD_USER" \
  -d "$PROD_DB" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --exclude-schema=_realtime \
  --exclude-schema=realtime \
  --exclude-schema=storage \
  --exclude-schema=supabase_functions \
  --exclude-table-data='auth.*' \
  --exclude-table-data='storage.*' \
  > "$DUMP_FILE"

echo "✅ Production data dumped to $DUMP_FILE"
echo ""

echo "2️⃣  Restoring to local database..."
docker run --rm -i \
  -e PGPASSWORD="postgres" \
  --network host \
  postgres:17 \
  psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  < "$DUMP_FILE"

echo "✅ Data restored to local Supabase"
echo ""

echo "3️⃣  Cleaning up..."
rm "$DUMP_FILE"

echo "✅ Production data successfully copied to local!"
echo ""
echo "📊 You can now view your data at: http://127.0.0.1:54323"
