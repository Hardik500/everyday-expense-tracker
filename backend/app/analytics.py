"""
Analytics module for spending insights and month-over-month comparisons.
"""
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from app.db import get_conn, IS_POSTGRES


def get_spending_insights(user_id: int) -> Dict:
    """
    Get spending insights for the current user.
    
    Returns:
        - Month-over-month comparison (current vs previous month)
        - Top spending categories for current month
        - Trending indicators
    """
    now = datetime.now()
    current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    prev_month_start = (current_month_start - timedelta(days=1)).replace(day=1)
    prev_month_end = current_month_start - timedelta(seconds=1)
    
    with get_conn() as conn:
        # Current month spending (only expenses, negative amounts)
        current_query = """
            SELECT COALESCE(SUM(ABS(t.amount)), 0) as total,
                   COUNT(*) as count
            FROM transactions t
            LEFT JOIN transaction_links l
              ON (l.source_transaction_id = t.id OR l.target_transaction_id = t.id)
             AND l.link_type = 'card_payment'
            WHERE t.user_id = ?
              AND t.amount < 0
              AND l.id IS NULL
              AND t.posted_at >= ?
        """
        
        # Previous month spending (same period)
        prev_query = """
            SELECT COALESCE(SUM(ABS(t.amount)), 0) as total,
                   COUNT(*) as count
            FROM transactions t
            LEFT JOIN transaction_links l
              ON (l.source_transaction_id = t.id OR l.target_transaction_id = t.id)
             AND l.link_type = 'card_payment'
            WHERE t.user_id = ?
              AND t.amount < 0
              AND l.id IS NULL
              AND t.posted_at >= ?
              AND t.posted_at <= ?
        """
        
        current_row = conn.execute(current_query, (user_id, current_month_start)).fetchone()
        prev_row = conn.execute(prev_query, (user_id, prev_month_start, prev_month_end)).fetchone()
        
        current_total = float(current_row["total"]) if current_row else 0
        prev_total = float(prev_row["total"]) if prev_row else 0
        current_count = current_row["count"] if current_row else 0
        prev_count = prev_row["count"] if prev_row else 0
        
        # Month-over-month change percentage
        percent_change = 0
        if prev_total > 0:
            percent_change = ((current_total - prev_total) / prev_total) * 100
        elif current_total > 0:
            percent_change = 100  # Previous was 0, now we have spending
            
        # Daily average
        days_in_current_month = now.day
        daily_avg = current_total / days_in_current_month if days_in_current_month > 0 else 0
        
        days_in_prev_month = (current_month_start - prev_month_start).days
        prev_daily_avg = prev_total / days_in_prev_month if days_in_prev_month > 0 else 0
        
        # Top spending categories for current month
        top_categories_query = """
            SELECT c.id, c.name, c.color, c.icon,
                   SUM(ABS(t.amount)) as total,
                   COUNT(*) as transaction_count
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            LEFT JOIN transaction_links l
              ON (l.source_transaction_id = t.id OR l.target_transaction_id = t.id)
             AND l.link_type = 'card_payment'
            WHERE t.user_id = ?
              AND t.amount < 0
              AND l.id IS NULL
              AND t.posted_at >= ?
              AND c.id IS NOT NULL
            GROUP BY c.id, c.name, c.color, c.icon
            ORDER BY total DESC
            LIMIT 5
        """
        
        top_categories = conn.execute(top_categories_query, (user_id, current_month_start)).fetchall()
        
        # Get previous month totals for each top category
        top_categories_with_trend = []
        for cat in top_categories:
            prev_cat_query = """
                SELECT COALESCE(SUM(ABS(t.amount)), 0) as total
                FROM transactions t
                LEFT JOIN transaction_links l
                  ON (l.source_transaction_id = t.id OR l.target_transaction_id = t.id)
                 AND l.link_type = 'card_payment'
                WHERE t.user_id = ?
                  AND t.amount < 0
                  AND l.id IS NULL
                  AND t.posted_at >= ?
                  AND t.posted_at <= ?
                  AND t.category_id = ?
            """
            prev_cat_row = conn.execute(prev_cat_query, (user_id, prev_month_start, prev_month_end, cat["id"])).fetchone()
            prev_cat_total = float(prev_cat_row["total"]) if prev_cat_row else 0
            
            cat_change = 0
            if prev_cat_total > 0:
                cat_change = ((float(cat["total"]) - prev_cat_total) / prev_cat_total) * 100
            elif float(cat["total"]) > 0:
                cat_change = 100
                
            top_categories_with_trend.append({
                "id": cat["id"],
                "name": cat["name"],
                "color": cat["color"],
                "icon": cat["icon"],
                "total": float(cat["total"]),
                "transaction_count": cat["transaction_count"],
                "previous_total": prev_cat_total,
                "percent_change": round(cat_change, 1)
            })
        
        # Get biggest single expenses this month
        biggest_expenses_query = """
            SELECT t.id, t.description_raw, ABS(t.amount) as amount,
                   t.posted_at, c.name as category_name
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            LEFT JOIN transaction_links l
              ON (l.source_transaction_id = t.id OR l.target_transaction_id = t.id)
             AND l.link_type = 'card_payment'
            WHERE t.user_id = ?
              AND t.amount < 0
              AND l.id IS NULL
              AND t.posted_at >= ?
            ORDER BY ABS(t.amount) DESC
            LIMIT 5
        """
        
        biggest_expenses = conn.execute(biggest_expenses_query, (user_id, current_month_start)).fetchall()
        
        return {
            "current_month": {
                "total_spent": round(current_total, 2),
                "transaction_count": current_count,
                "daily_average": round(daily_avg, 2),
                "month_name": now.strftime("%B %Y"),
            },
            "previous_month": {
                "total_spent": round(prev_total, 2),
                "transaction_count": prev_count,
                "month_name": prev_month_start.strftime("%B %Y"),
            },
            "comparison": {
                "percent_change": round(percent_change, 1),
                "amount_change": round(current_total - prev_total, 2),
                "trend": "up" if percent_change > 0 else "down" if percent_change < 0 else "same",
                "daily_avg_change": round(daily_avg - prev_daily_avg, 2),
            },
            "top_categories": top_categories_with_trend,
            "biggest_expenses": [
                {
                    "id": row["id"],
                    "description": row["description_raw"],
                    "amount": float(row["amount"]),
                    "posted_at": row["posted_at"],
                    "category_name": row["category_name"],
                }
                for row in biggest_expenses
            ],
        }


def get_year_over_year(user_id: int, year: Optional[int] = None) -> List[Dict]:
    """
    Get month-by-month spending for a given year.
    
    Args:
        user_id: The user ID
        year: The year to analyze (defaults to current year)
    
    Returns:
        List of monthly totals
    """
    if year is None:
        year = datetime.now().year
        
    with get_conn() as conn:
        query = """
            SELECT 
                EXTRACT(MONTH FROM posted_at) as month,
                COALESCE(SUM(ABS(amount)), 0) as total,
                COUNT(*) as count
            FROM transactions t
            LEFT JOIN transaction_links l
              ON (l.source_transaction_id = t.id OR l.target_transaction_id = t.id)
             AND l.link_type = 'card_payment'
            WHERE t.user_id = ?
              AND t.amount < 0
              AND l.id IS NULL
              AND EXTRACT(YEAR FROM posted_at) = ?
            GROUP BY EXTRACT(MONTH FROM posted_at)
            ORDER BY month
        """ if IS_POSTGRES else """
            SELECT 
                CAST(strftime('%m', posted_at) AS INTEGER) as month,
                COALESCE(SUM(ABS(amount)), 0) as total,
                COUNT(*) as count
            FROM transactions t
            LEFT JOIN transaction_links l
              ON (l.source_transaction_id = t.id OR l.target_transaction_id = t.id)
             AND l.link_type = 'card_payment'
            WHERE t.user_id = ?
              AND t.amount < 0
              AND l.id IS NULL
              AND CAST(strftime('%Y', posted_at) AS INTEGER) = ?
            GROUP BY strftime('%m', posted_at)
            ORDER BY month
        """
        
        rows = conn.execute(query, (user_id, year)).fetchall()
        
        # Fill in missing months with zeros
        month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                       "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        
        results = []
        month_data = {row["month"]: row for row in rows}
        
        for i, name in enumerate(month_names, 1):
            if i in month_data:
                results.append({
                    "month": name,
                    "month_num": i,
                    "total": float(month_data[i]["total"]),
                    "count": month_data[i]["count"],
                })
            else:
                results.append({
                    "month": name,
                    "month_num": i,
                    "total": 0,
                    "count": 0,
                })
        
        return results
