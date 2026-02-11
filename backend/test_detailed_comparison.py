#!/usr/bin/env python3
"""
Detailed parser comparison test across multiple files.

Usage:
    source venv/bin/activate
    python test_detailed_comparison.py
"""

import os
import sys
import time
import json
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Test files directory
TEST_DIR = Path("/home/openclaw/.openclaw/workspace/pdf-to-excel-parser/tests/test_statements")


@dataclass
class TestResult:
    filename: str
    file_size_kb: float
    
    # Old parser results
    old_found: int
    old_time: float
    old_success: bool
    old_error: Optional[str]
    
    # New parser results
    new_found: int
    new_time: float
    new_success: bool
    new_error: Optional[str]
    new_statement_type: str
    
    @property
    def speedup(self) -> float:
        if self.old_time > 0:
            return self.old_time / self.new_time if self.new_time > 0 else 0
        return 0
    
    @property
    def improvement(self) -> str:
        if self.new_found > self.old_found:
            return f"+{self.new_found - self.old_found}"
        elif self.new_found < self.old_found:
            return f"{self.new_found - self.old_found}"
        return "="


def test_old_parser(filepath: Path) -> tuple:
    """Test old expense-tracker parsing logic."""
    import pdfplumber
    import re
    
    DATE_PATTERN = re.compile(r"(\d{2}/\d{2}/\d{4})")
    AMOUNT_PATTERN = re.compile(r"([0-9,]+\.\d{2})")
    
    try:
        start = time.time()
        
        with pdfplumber.open(filepath) as pdf:
            count = 0
            for page in pdf.pages:
                text = page.extract_text() or ""
                for line in text.splitlines():
                    if DATE_PATTERN.search(line) and AMOUNT_PATTERN.search(line):
                        count += 1
        
        elapsed = time.time() - start
        return count, elapsed, True, None
        
    except Exception as e:
        return 0, 0, False, str(e)


def test_new_parser(filepath: Path) -> tuple:
    """Test new statement-parser package."""
    from statement_parser import StatementParser
    
    try:
        start = time.time()
        parser = StatementParser()
        result = parser.parse_file(str(filepath))
        elapsed = time.time() - start
        
        return len(result.transactions), elapsed, True, None, result.statement_type
        
    except Exception as e:
        return 0, 0, False, str(e), "unknown"


def run_comparison():
    print("=" * 100)
    print("DETAILED PARSER COMPARISON TEST")
    print("=" * 100)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Find all test files (PDFs and text files)
    test_files = []
    if TEST_DIR.exists():
        test_files = sorted([f for f in TEST_DIR.iterdir() 
                          if f.suffix.lower() in ('.pdf', '.txt')])
    
    if not test_files:
        print(f"No test files found in {TEST_DIR}")
        return
    
    print(f"Found {len(test_files)} test files:\n")
    for f in test_files:
        size_kb = f.stat().st_size / 1024
        print(f"  - {f.name} ({size_kb:.1f} KB)")
    print()
    
    # Run tests
    results: List[TestResult] = []
    
    for i, filepath in enumerate(test_files, 1):
        filename = filepath.name
        size_kb = filepath.stat().st_size / 1024
        
        print(f"[{i}/{len(test_files)}] Testing: {filename[:50]}")
        
        # Test old parser
        old_found, old_time, old_success, old_error = test_old_parser(filepath)
        
        # Test new parser
        new_found, new_time, new_success, new_error, stmt_type = test_new_parser(filepath)
        
        result = TestResult(
            filename=filename,
            file_size_kb=size_kb,
            old_found=old_found,
            old_time=old_time,
            old_success=old_success,
            old_error=old_error,
            new_found=new_found,
            new_time=new_time,
            new_success=new_success,
            new_error=new_error,
            new_statement_type=stmt_type
        )
        results.append(result)
        
        status = "✓" if new_success else "✗"
        print(f"    Old: {old_found:4d} potential | {old_time:.3f}s | {'✓' if old_success else '✗'}")
        print(f"    New: {new_found:4d} actual   | {new_time:.3f}s | {status} ({stmt_type})")
        print()
    
    # Print summary table
    print()
    print("=" * 100)
    print("DETAILED RESULTS TABLE")
    print("=" * 100)
    print()
    print(f"{'File':<45} {'Old Found':<12} {'New Found':<12} {'Δ':<8} {'Old Time':<12} {'New Time':<12} {'Type':<10}")
    print("-" * 100)
    
    for r in results:
        short_name = r.filename[:44]
        delta = r.improvement
        print(f"{short_name:<45} {r.old_found:<12} {r.new_found:<12} {delta:<8} {r.old_time:.3f}s{'':<7} {r.new_time:.3f}s{'':<7} {r.new_statement_type:<10}")
    
    # Calculate statistics
    print()
    print("=" * 100)
    print("STATISTICS")
    print("=" * 100)
    print()
    
    total_old = sum(r.old_found for r in results)
    total_new = sum(r.new_found for r in results)
    total_old_time = sum(r.old_time for r in results)
    total_new_time = sum(r.new_time for r in results)
    
    old_success_rate = sum(1 for r in results if r.old_success) / len(results) * 100
    new_success_rate = sum(1 for r in results if r.new_success) / len(results) * 100
    
    avg_old_time = total_old_time / len(results) if results else 0
    avg_new_time = total_new_time / len(results) if results else 0
    
    print(f"Total Files Tested:        {len(results)}")
    print()
    print(f"Total Transactions:")
    print(f"  Old Logic:               {total_old}")
    print(f"  New Package:             {total_new}")
    print(f"  Difference:              {total_new - total_old:+d} ({(total_new/total_old - 1)*100 if total_old > 0 else 0:.1f}%)")
    print()
    print(f"Success Rate:")
    print(f"  Old Logic:               {old_success_rate:.0f}%")
    print(f"  New Package:             {new_success_rate:.0f}%")
    print()
    print(f"Average Time per File:")
    print(f"  Old Logic:               {avg_old_time:.3f}s")
    print(f"  New Package:             {avg_new_time:.3f}s")
    print(f"  Speedup/Slowdown:        {avg_old_time/avg_new_time:.2f}x")
    print()
    
    # Statement type distribution
    type_counts = {}
    for r in results:
        if r.new_statement_type not in type_counts:
            type_counts[r.new_statement_type] = 0
        type_counts[r.new_statement_type] += 1
    
    print("Statement Types Detected (New Parser):")
    for stmt_type, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"  {stmt_type}: {count} files")
    print()
    
    # Errors
    old_errors = [r for r in results if r.old_error]
    new_errors = [r for r in results if r.new_error]
    
    if old_errors:
        print(f"Old Logic Errors ({len(old_errors)}):")
        for r in old_errors:
            print(f"  - {r.filename}: {r.old_error}")
        print()
    
    if new_errors:
        print(f"New Parser Errors ({len(new_errors)}):")
        for r in new_errors:
            print(f"  - {r.filename}: {r.new_error}")
        print()
    
    # Save results to JSON
    output_file = "parser_comparison_results.json"
    with open(output_file, 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'summary': {
                'total_files': len(results),
                'total_old_found': total_old,
                'total_new_found': total_new,
                'old_success_rate': old_success_rate,
                'new_success_rate': new_success_rate,
                'avg_old_time': avg_old_time,
                'avg_new_time': avg_new_time,
            },
            'results': [asdict(r) for r in results]
        }, f, indent=2)
    
    print(f"Results saved to: {output_file}")
    print()
    print("=" * 100)
    print("CONCLUSION")
    print("=" * 100)
    print()
    
    if total_new > total_old:
        print(f"✅ New package extracts MORE transactions ({total_new} vs {total_old})")
    elif total_new < total_old:
        print(f"⚠️  New package extracts FEWER transactions ({total_new} vs {total_old})")
    else:
        print(f"= Both packages extract similar number of transactions")
    
    if new_success_rate >= old_success_rate:
        print(f"✅ New package has BETTER or EQUAL success rate ({new_success_rate:.0f}%)")
    else:
        print(f"⚠️  New package has LOWER success rate ({new_success_rate:.0f}% vs {old_success_rate:.0f}%)")
    
    print()
    print(f"📝 To use the new package, set: USE_NEW_STATEMENT_PARSER=true")
    print()


if __name__ == "__main__":
    run_comparison()
