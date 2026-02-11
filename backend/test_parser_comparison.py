#!/usr/bin/env python3
"""
Test script to compare old PDF parsing logic vs new statement-parser package.

Usage:
    cd /home/openclaw/.openclaw/workspace/everyday-expense-tracker/backend
    source venv/bin/activate
    python test_parser_comparison.py
"""

import os
import sys
import io
import time
from pathlib import Path
from typing import List, Tuple, Dict, Any

# Add app to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# New package
from statement_parser import StatementParser

# Old logic
from app.ingest.pdf import ingest_pdf, _detect_card_type, _detect_card_type_from_text, _detect_pdf_type
from app.ingest.normalize import parse_date, parse_amount, normalize_description
import pdfplumber

# Test files directory
TEST_DIR = Path("/home/openclaw/.openclaw/workspace/pdf-to-excel-parser/tests/test_statements")

def test_new_package(filepath: Path) -> Tuple[int, List[Dict], float, str]:
    """Test the new statement-parser package."""
    try:
        start_time = time.time()
        parser = StatementParser()
        result = parser.parse_file(str(filepath))
        elapsed = time.time() - start_time
        
        transactions = result.transactions
        return len(transactions), transactions, elapsed, "success"
    except Exception as e:
        return 0, [], 0.0, f"error: {str(e)}"

def test_old_logic(filepath: Path) -> Tuple[int, float, str]:
    """Test the old expense-tracker parsing logic (without DB)."""
    try:
        start_time = time.time()
        
        with pdfplumber.open(filepath) as pdf:
            card_type = _detect_card_type(pdf)
            pdf_type = _detect_pdf_type(pdf)
            
            # Count transactions by extracting text
            total_lines = 0
            potential_txs = 0
            
            for page in pdf.pages:
                text = page.extract_text() or ""
                total_lines += len(text.splitlines())
                
                # Simple heuristic: lines with date+amount patterns
                import re
                DATE_PATTERN = re.compile(r"(\d{2}/\d{2}/\d{4})")
                AMOUNT_PATTERN = re.compile(r"([0-9,]+\.\d{2})")
                
                for line in text.splitlines():
                    if DATE_PATTERN.search(line) and AMOUNT_PATTERN.search(line):
                        potential_txs += 1
        
        elapsed = time.time() - start_time
        return potential_txs, elapsed, f"detected: {card_type}/{pdf_type}"
        
    except Exception as e:
        return 0, 0.0, f"error: {str(e)}"

def compare_parsers():
    """Compare both parsing approaches on test files."""
    
    # Get list of test PDFs
    test_files = sorted([f for f in TEST_DIR.iterdir() if f.suffix.lower() == '.pdf'])
    
    if not test_files:
        print(f"No PDF files found in {TEST_DIR}")
        return
    
    print(f"Found {len(test_files)} test PDF files\n")
    print("=" * 100)
    print(f"{'File':<50} {'Old Logic':<25} {'New Package':<25}")
    print("=" * 100)
    
    results = []
    
    for filepath in test_files[:5]:  # Test first 5 files
        filename = filepath.name[:48]
        
        # Test new package
        new_count, new_txs, new_time, new_status = test_new_package(filepath)
        
        # Test old logic
        old_count, old_time, old_status = test_old_logic(filepath)
        
        print(f"{filename:<50} {old_count} tx/{old_time:.2f}s ({old_status:<15}) {new_count} tx/{new_time:.2f}s ({new_status:<15})")
        
        results.append({
            'file': filename,
            'old_count': old_count,
            'old_time': old_time,
            'old_status': old_status,
            'new_count': new_count,
            'new_time': new_time,
            'new_status': new_status,
            'new_txs': new_txs[:3] if new_txs else []  # Store sample transactions
        })
    
    print("=" * 100)
    print("\n📊 Summary:\n")
    
    total_old = sum(r['old_count'] for r in results)
    total_new = sum(r['new_count'] for r in results)
    total_old_time = sum(r['old_time'] for r in results)
    total_new_time = sum(r['new_time'] for r in results)
    
    print(f"Total transactions (Old): {total_old}")
    print(f"Total transactions (New): {total_new}")
    print(f"Success rate (Old): {sum(1 for r in results if 'error' not in r['old_status'])}/{len(results)}")
    print(f"Success rate (New): {sum(1 for r in results if 'error' not in r['new_status'])}/{len(results)}")
    print(f"Avg time (Old): {total_old_time/len(results):.3f}s")
    print(f"Avg time (New): {total_new_time/len(results):.3f}s")
    
    print("\n📝 Sample transactions from new package:")
    for r in results[:3]:
        if r['new_txs']:
            print(f"\n{r['file']}:")
            for tx in r['new_txs']:
                print(f"  - {tx.get('date', 'N/A')}: {tx.get('description', 'N/A')[:40]}... {tx.get('amount', 0)}")
    
    return results

if __name__ == "__main__":
    compare_parsers()
