#!/bin/bash
# Test script for production AI categorization API

# Configuration - update these before running
PROD_URL="${PROD_URL:-https://your-app.railway.app}"  # Replace with actual prod URL
AUTH_TOKEN="${AUTH_TOKEN:-your-auth-token-here}"       # Replace with valid JWT token

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== Production AI Categorization Test ==="
echo "Target: $PROD_URL"
echo ""

# Test 1: Health check
echo "[Test 1] Health check..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/health" 2>/dev/null || echo "000")
if [ "$HEALTH" = "200" ]; then
    echo -e "${GREEN}✓${NC} Health check passed (HTTP 200)"
else
    echo -e "${RED}✗${NC} Health check failed (HTTP $HEALTH)"
    echo "Server may still be deploying. Waiting..."
fi

# Test 2: Get a transaction to categorize
echo ""
echo "[Test 2] Fetching transactions..."
TRANSACTIONS=$(curl -s "$PROD_URL/transactions" \
    -H "Authorization: Bearer $AUTH_TOKEN" 2>/dev/null)

if [ -z "$TRANSACTIONS" ] || [ "$TRANSACTIONS" = "null" ]; then
    echo -e "${RED}✗${NC} Failed to fetch transactions"
    echo "Check AUTH_TOKEN is valid"
    exit 1
fi

# Extract first transaction ID without AI categorization
TX_ID=$(echo "$TRANSACTIONS" | python3 -c "import json,sys; data=json.load(sys.stdin); print(data[0]['id'])" 2>/dev/null)

if [ -z "$TX_ID" ]; then
    echo -e "${RED}✗${NC} No transactions found"
    exit 1
fi

echo -e "${GREEN}✓${NC} Found transaction ID: $TX_ID"

# Test 3: Call AI categorize endpoint
echo ""
echo "[Test 3] Testing AI categorization..."
echo "POST /ai/categorize/$TX_ID"

RESPONSE=$(curl -s -w "\n%{http_code}" "$PROD_URL/ai/categorize/$TX_ID" \
    -X POST \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    2>/dev/null)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response: $BODY"

# Parse response
if [ "$HTTP_CODE" = "200" ]; then
    echo ""
    echo -e "${GREEN}✓ SUCCESS!${NC} AI categorization worked"
    
    # Try to extract category info
    CATEGORY=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('category_name','N/A'))" 2>/dev/null)
    SUBCATEGORY=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('subcategory_name','N/A'))" 2>/dev/null)
    
    echo "Category: $CATEGORY"
    echo "Subcategory: $SUBCATEGORY"
    
    # Check for confidence if available
    CONFIDENCE=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('confidence','N/A'))" 2>/dev/null)
    if [ "$CONFIDENCE" != "N/A" ]; then
        echo "Confidence: $CONFIDENCE"
    fi
    
    exit 0
else
    echo ""
    echo -e "${RED}✗ FAILED!${NC} AI categorization returned HTTP $HTTP_CODE"
    
    # Try to parse error
    ERROR=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('detail',d.get('error','Unknown error')))" 2>/dev/null)
    if [ -n "$ERROR" ]; then
        echo "Error: $ERROR"
    fi
    
    exit 1
fi