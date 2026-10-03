"""
database.py - SQLite storage for Research Assistant history, favorites, and reports.
"""

import sqlite3
import json
import os
from typing import List, Dict, Any, Optional

DB_FILE = os.path.join(os.path.dirname(__file__), "research.db")

def init_db(db_path: str = DB_FILE):
    """Initialize database tables and run migrations."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS research_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic TEXT NOT NULL,
            focus TEXT NOT NULL DEFAULT 'general',
            depth TEXT NOT NULL DEFAULT 'comprehensive',
            summary TEXT,
            report_markdown TEXT NOT NULL,
            sources_json TEXT NOT NULL,
            key_insights_json TEXT NOT NULL,
            conflicts_json TEXT DEFAULT '[]',
            bibliography_json TEXT DEFAULT '[]',
            stats_json TEXT NOT NULL,
            is_favorite INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()

    # Check and add columns if upgrading existing table
    cursor.execute("PRAGMA table_info(research_sessions)")
    columns = [row[1] for row in cursor.fetchall()]
    if "is_favorite" not in columns:
        cursor.execute("ALTER TABLE research_sessions ADD COLUMN is_favorite INTEGER DEFAULT 0")
    if "conflicts_json" not in columns:
        cursor.execute("ALTER TABLE research_sessions ADD COLUMN conflicts_json TEXT DEFAULT '[]'")
    if "bibliography_json" not in columns:
        cursor.execute("ALTER TABLE research_sessions ADD COLUMN bibliography_json TEXT DEFAULT '[]'")
    conn.commit()
    conn.close()

def save_research(
    topic: str,
    focus: str,
    depth: str,
    summary: str,
    report_markdown: str,
    sources: List[Dict[str, Any]],
    key_insights: List[Dict[str, Any]],
    conflicts: List[Dict[str, Any]],
    bibliography: List[Dict[str, Any]],
    stats: Dict[str, Any],
    is_favorite: int = 0,
    db_path: str = DB_FILE
) -> int:
    """Save a research report session to database."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO research_sessions 
        (topic, focus, depth, summary, report_markdown, sources_json, key_insights_json, conflicts_json, bibliography_json, stats_json, is_favorite)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        topic,
        focus,
        depth,
        summary,
        report_markdown,
        json.dumps(sources),
        json.dumps(key_insights),
        json.dumps(conflicts),
        json.dumps(bibliography),
        json.dumps(stats),
        is_favorite
    ))
    session_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return session_id

def get_history(
    search_query: str = "",
    favorites_only: bool = False,
    focus_filter: str = "",
    limit: int = 50,
    db_path: str = DB_FILE
) -> List[Dict[str, Any]]:
    """Retrieve filtered research topics summary."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    conditions = []
    params = []

    if search_query.strip():
        conditions.append("(topic LIKE ? OR summary LIKE ?)")
        wildcard = f"%{search_query.strip()}%"
        params.extend([wildcard, wildcard])

    if favorites_only:
        conditions.append("is_favorite = 1")

    if focus_filter and focus_filter != "all":
        conditions.append("focus = ?")
        params.append(focus_filter)

    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    query = f"""
        SELECT id, topic, focus, depth, summary, stats_json, is_favorite, created_at
        FROM research_sessions
        {where_clause}
        ORDER BY is_favorite DESC, id DESC
        LIMIT ?
    """
    params.append(limit)

    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    history = []
    for row in rows:
        stats = {}
        try:
            stats = json.loads(row["stats_json"]) if row["stats_json"] else {}
        except Exception:
            pass
        history.append({
            "id": row["id"],
            "topic": row["topic"],
            "focus": row["focus"],
            "depth": row["depth"],
            "summary": row["summary"],
            "stats": stats,
            "is_favorite": bool(row["is_favorite"]),
            "created_at": row["created_at"]
        })
    conn.close()
    return history

def get_session_by_id(session_id: int, db_path: str = DB_FILE) -> Optional[Dict[str, Any]]:
    """Retrieve full details of a specific research session."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM research_sessions WHERE id = ?
    """, (session_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    
    result = {
        "id": row["id"],
        "topic": row["topic"],
        "focus": row["focus"],
        "depth": row["depth"],
        "summary": row["summary"],
        "report_markdown": row["report_markdown"],
        "sources": json.loads(row["sources_json"]) if row["sources_json"] else [],
        "key_insights": json.loads(row["key_insights_json"]) if row["key_insights_json"] else [],
        "conflicts": json.loads(row["conflicts_json"]) if ("conflicts_json" in row.keys() and row["conflicts_json"]) else [],
        "bibliography": json.loads(row["bibliography_json"]) if ("bibliography_json" in row.keys() and row["bibliography_json"]) else [],
        "stats": json.loads(row["stats_json"]) if row["stats_json"] else {},
        "is_favorite": bool(row["is_favorite"]) if "is_favorite" in row.keys() else False,
        "created_at": row["created_at"]
    }
    conn.close()
    return result

def toggle_favorite(session_id: int, db_path: str = DB_FILE) -> Optional[bool]:
    """Toggle the favorite status of a research session."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT is_favorite FROM research_sessions WHERE id = ?", (session_id,))
    row = cursor.fetchone()
    if row is None:
        conn.close()
        return None
    
    new_status = 1 if row[0] == 0 else 0
    cursor.execute("UPDATE research_sessions SET is_favorite = ? WHERE id = ?", (new_status, session_id))
    conn.commit()
    conn.close()
    return bool(new_status)

def delete_session(session_id: int, db_path: str = DB_FILE) -> bool:
    """Delete a research session by ID."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM research_sessions WHERE id = ?", (session_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

def clear_all_history(db_path: str = DB_FILE):
    """Clear all research sessions."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM research_sessions")
    conn.commit()
    conn.close()
