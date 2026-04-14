#!/usr/bin/env python3
"""Initialize the Wolf Pack SQLite database."""

import sqlite3
import os
import json

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wolfpack.db")
REGISTRY_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "registry.json")


def init_db():
    db = sqlite3.connect(DB_PATH)
    cursor = db.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            agent TEXT NOT NULL,
            subject TEXT NOT NULL,
            task_id TEXT,
            status TEXT NOT NULL DEFAULT 'complete',
            summary TEXT,
            decisions TEXT,
            deliverables TEXT,
            issues TEXT,
            next_steps TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT UNIQUE NOT NULL,
            date TEXT NOT NULL,
            title TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            assigned_to TEXT,
            objective TEXT,
            context TEXT,
            subtasks_json TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS session_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            session_id TEXT NOT NULL,
            timestamp TEXT NOT NULL DEFAULT (datetime('now')),
            event_type TEXT NOT NULL,
            agent TEXT,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS agents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            file TEXT,
            reports_to TEXT,
            description TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            deactivated_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_reports_agent ON reports(agent);
        CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date);
        CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
        CREATE INDEX IF NOT EXISTS idx_session_logs_date ON session_logs(date);
        CREATE INDEX IF NOT EXISTS idx_session_logs_event ON session_logs(event_type);
        CREATE INDEX IF NOT EXISTS idx_session_logs_agent ON session_logs(agent);
    """)

    # Seed agents from registry.json if it exists
    if os.path.exists(REGISTRY_PATH):
        with open(REGISTRY_PATH, "r") as f:
            registry = json.load(f)
        for agent in registry.get("agents", []):
            cursor.execute(
                """INSERT OR IGNORE INTO agents (name, role, status, file, reports_to, description, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    agent["name"],
                    agent["role"],
                    agent["status"],
                    agent.get("file"),
                    agent.get("reports_to"),
                    agent.get("description"),
                    agent.get("created", datetime_now()),
                ),
            )

    db.commit()
    db.close()
    print(f"Wolf Pack database initialized at {DB_PATH}")


def datetime_now():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


if __name__ == "__main__":
    init_db()
