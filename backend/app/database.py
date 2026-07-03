import os
import json
from datetime import datetime
import psycopg2
from psycopg2.extras import DictCursor

DB_CONFIG = {
    "host": os.environ.get("POSTGRES_HOST", "localhost"),
    "port": int(os.environ.get("POSTGRES_PORT", "5432")),
    "dbname": os.environ.get("POSTGRES_DB", "gxpilot"),
    "user": os.environ.get("POSTGRES_USER", "gxpilot"),
    "password": os.environ.get("POSTGRES_PASSWORD", "gxpilot_password"),
}

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG, cursor_factory=DictCursor)

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create documents table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL, -- 'SOP', 'APQR', 'MBR', 'EBR', 'General'
            status TEXT NOT NULL, -- 'Draft', 'Under_Review', 'Approved', 'Rejected'
            content TEXT,
            content_type TEXT,
            file_size INTEGER,
            display_id TEXT,
            owner_user_id TEXT,
            audit_trail TEXT, -- JSON array of events
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    cursor.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS display_id TEXT")
    cursor.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS owner_user_id TEXT")
    
    # Create compliance_checks table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS compliance_checks (
            id TEXT PRIMARY KEY,
            document_id TEXT,
            score REAL, -- 0 to 100 compliance score
            status TEXT NOT NULL, -- 'Approved', 'Flagged', 'Rejected'
            profile TEXT,
            anomalies TEXT, -- JSON array of found anomalies
            recommendations TEXT, -- JSON array of next best actions
            checklist TEXT, -- JSON array of checklist items
            created_at TEXT NOT NULL,
            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
        )
    """)
    cursor.execute("ALTER TABLE compliance_checks ADD COLUMN IF NOT EXISTS profile TEXT")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            staff_id TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            designation TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        )
    """)
    
    # Create chat_history table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id SERIAL PRIMARY KEY,
            role TEXT NOT NULL, -- 'user', 'assistant'
            content TEXT NOT NULL,
            timestamp TEXT NOT NULL
        )
    """)
    
    # Create roi_metrics table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS roi_metrics (
            id SERIAL PRIMARY KEY,
            task_type TEXT NOT NULL, -- 'SOP_Prep', 'APQR_Gen', 'Batch_Review', 'General_Review'
            owner_user_id TEXT,
            hours_saved REAL NOT NULL,
            errors_prevented INTEGER NOT NULL,
            cost_saved_usd REAL NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    cursor.execute("ALTER TABLE roi_metrics ADD COLUMN IF NOT EXISTS owner_user_id TEXT")
    
    # Insert some initial mock ROI data if table is empty to show beautiful analytics
    cursor.execute("SELECT COUNT(*) FROM roi_metrics")
    if cursor.fetchone()[0] == 0:
        initial_metrics = [
            ('SOP_Prep', 14.5, 3, 725.0, '2026-06-25 10:00:00'),
            ('APQR_Gen', 38.0, 8, 1900.0, '2026-06-26 14:30:00'),
            ('Batch_Review', 24.0, 5, 1200.0, '2026-06-28 09:15:00'),
            ('General_Review', 12.0, 2, 600.0, '2026-06-29 16:45:00'),
        ]
        cursor.executemany("""
            INSERT INTO roi_metrics (task_type, hours_saved, errors_prevented, cost_saved_usd, created_at)
            VALUES (%s, %s, %s, %s, %s)
        """, initial_metrics)
        
    # Insert initial mock documents if empty
    cursor.execute("SELECT COUNT(*) FROM documents")
    if cursor.fetchone()[0] == 0:
        now_str = datetime.utcnow().isoformat()
        initial_docs = [
            ('doc-1', 'SOP-QA-001_v1.0_Standard_Operating_Procedure_for_Batch_Release.txt', 'SOP', 'Approved', 
             'This document details the standard operating procedure for reviewing and releasing finished pharmaceutical batches. All critical process parameters (CPPs) must be validated by double QA signatures.', 
             'text/plain', 178, 
             json.dumps([{'time': now_str, 'user': 'System', 'event': 'Initial SOP Imported (21 CFR 211 compliant)'}]),
             now_str, now_str),
            ('doc-2', 'APQR_Acetaminophen_2025_Draft.txt', 'APQR', 'Under_Review', 
             'Annual Product Quality Review (APQR) for Acetaminophen 500mg Tablets. Reporting period: Jan 2025 - Dec 2025. Total batches manufactured: 120. Deviations logged: 4 (2 production, 2 packaging). Out of specification (OOS) results: 1 (retested and resolved). Stability trends remain within normal limits (assay 98.5% - 101.2%).', 
             'text/plain', 320, 
             json.dumps([{'time': now_str, 'user': 'System', 'event': 'APQR Report Draft Generated by GxPilot'}]),
             now_str, now_str),
        ]
        cursor.executemany("""
            INSERT INTO documents (id, name, type, status, content, content_type, file_size, audit_trail, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, initial_docs)
        
        # Insert matching compliance check for APQR draft
        cursor.execute("""
            INSERT INTO compliance_checks (id, document_id, score, status, profile, anomalies, recommendations, checklist, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, (
            'chk-1', 'doc-2', 88.5, 'Flagged', 'apqr',
            json.dumps([
                {'type': 'Deviation Warning', 'severity': 'Medium', 'message': '4 deviations logged. Ensure all deviation investigations are signed off in the QMS.'},
                {'type': 'OOS Warning', 'severity': 'High', 'message': '1 OOS result noted. Retest verification documents must be appended to the final report.'}
            ]),
            json.dumps([
                'Verify Acetaminophen Batch #ACT25042 retest documentation',
                'Add section 4.3 for Packaging Materials change control',
                'Request QA signoff for deviation DEV-2025-089'
            ]),
            json.dumps([
                {'item': 'Executive Summary included', 'status': 'PASS'},
                {'item': 'Yield trend analysis completed', 'status': 'PASS'},
                {'item': 'Stability data updated', 'status': 'PASS'},
                {'item': 'OOS/OOT investigations summarized', 'status': 'FAIL'},
                {'item': 'Change controls and deviations referenced', 'status': 'PASS'}
            ]),
            now_str
        ))
        
    conn.commit()
    conn.close()
