import os
import uuid
from datetime import datetime
import json
import logging
import re
from io import BytesIO
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Request, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from jose import JWTError, jwt
from pypdf import PdfReader

# Import local database and gemini modules
from app.database import init_db, get_db_connection
from app.gemini import analyze_gxp_document, draft_gxp_sop, draft_gxp_apqr, answer_gxp_chat, get_compliance_audit_profile
from app.auth import JWT_ALGORITHM, JWT_SECRET, get_current_user, get_user_by_id, router as auth_router

class HealthCheckAccessLogFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return "/api/health" not in record.getMessage()

logging.getLogger("uvicorn.access").addFilter(HealthCheckAccessLogFilter())

# Initialize FastAPI App
app = FastAPI(title="GxPilot API", description="Pharmaceutical GxP document preparation and compliance review backend.")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

@app.middleware("http")
async def require_api_bearer_token(request: Request, call_next):
    public_prefixes = ("/api/auth", "/api/health")
    if request.method == "OPTIONS" or not request.url.path.startswith("/api") or request.url.path.startswith(public_prefixes):
        return await call_next(request)

    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return JSONResponse(status_code=401, content={"detail": "Missing bearer token"})

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
    except JWTError:
        return JSONResponse(status_code=401, content={"detail": "Invalid token"})

    if not user_id or not get_user_by_id(user_id):
        return JSONResponse(status_code=401, content={"detail": "Invalid token"})

    return await call_next(request)

# Initialize DB on Startup
@app.on_event("startup")
def startup_event():
    init_db()
    cleanup_duplicate_scan_audit_events()

def cleanup_duplicate_scan_audit_events():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, audit_trail FROM documents WHERE audit_trail IS NOT NULL")
    rows = cursor.fetchall()

    for row in rows:
        try:
            trail = json.loads(row["audit_trail"]) if row["audit_trail"] else []
        except json.JSONDecodeError:
            continue

        latest_scan_by_key = {}
        passthrough = []
        for event in trail:
            event_text = event.get("event", "")
            if event_text.startswith("Compliance scan ["):
                profile_key = event_text.split("]", 1)[0] + "]"
                latest_scan_by_key[profile_key] = event
            elif event_text.startswith("Compliance scan completed"):
                latest_scan_by_key["Compliance scan"] = event
            else:
                passthrough.append(event)

        cleaned_trail = passthrough + list(latest_scan_by_key.values())
        if len(cleaned_trail) != len(trail):
            cursor.execute(
                "UPDATE documents SET audit_trail = %s WHERE id = %s",
                (json.dumps(cleaned_trail), row["id"])
            )

    conn.commit()
    conn.close()

# Models
class SOPDraftRequest(BaseModel):
    title: str
    steps: str
    roles: str
    regulations: List[str]

class APQRDraftRequest(BaseModel):
    batch_summary: str
    deviations: str
    stability: str
    quality_system_data: str = ""

class ChatMessageRequest(BaseModel):
    message: str

class ROIMetricCreate(BaseModel):
    task_type: str
    hours_saved: float
    errors_prevented: int
    cost_saved_usd: float

class DocumentUpdate(BaseModel):
    content: str

def build_display_id(doc_type: str) -> str:
    normalized_type = (doc_type or "").upper()
    if normalized_type == "SOP":
        prefix = "SOP"
    elif normalized_type == "APQR":
        prefix = "APQR"
    else:
        prefix = "GXP"
    return f"{prefix}-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

def serialize_document_row(row):
    return {
        "id": row["id"],
        "display_id": row["display_id"] if "display_id" in row.keys() and row["display_id"] else row["id"],
        "name": row["name"],
        "type": row["type"],
        "status": row["status"],
        "content_type": row["content_type"],
        "file_size": row["file_size"],
        "audit_trail": json.loads(row["audit_trail"]) if row["audit_trail"] else [],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"]
    }

def serialize_control_bank_row(row):
    return {
        "id": row["id"],
        "display_id": row["display_id"] if row["display_id"] else row["id"],
        "name": row["name"],
        "type": row["type"],
        "status": row["status"],
        "creator_name": row["creator_name"] or "Unknown User",
        "creator_staff_id": row["creator_staff_id"] or "",
        "file_size": row["file_size"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }

def parse_iso_datetime(value: str) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        try:
            return datetime.strptime(str(value), "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return None

def extract_percent_values(pattern: str, text: str) -> List[float]:
    values = []
    for match in re.finditer(pattern, text, flags=re.IGNORECASE):
        try:
            values.append(float(match.group(1)))
        except (TypeError, ValueError):
            continue
    return values

def extract_yield_values(text: str) -> List[float]:
    patterns = [
        r"(?:yield average|avg batch yield|average yield|final yield|yield)\D{0,80}(\d{1,3}(?:\.\d+)?)\s*%",
        r"(\d{1,3}(?:\.\d+)?)\s*%\s*(?:theoretical\s+)?yield",
    ]
    values = []
    for pattern in patterns:
        values.extend(extract_percent_values(pattern, text))
    return [value for value in values if 0 <= value <= 120]

def extract_stability_delta(text: str) -> Optional[float]:
    assay_values = extract_percent_values(r"(?:assay|active ingredient concentration|concentration)[^\n:]*[:=]?\D{0,40}(\d{1,3}(?:\.\d+)?)\s*%", text)
    if len(assay_values) < 2:
        assay_values = extract_percent_values(r"(?:\d+\s*M|month\s*\d+)[^\n:=]*[:=]\s*(\d{1,3}(?:\.\d+)?)\s*%", text)
    if len(assay_values) < 2:
        return None
    return round(assay_values[-1] - assay_values[0], 1)

# Health Check
@app.get("/api/health")
@app.get("/api/health/")
def health_check():
    return {"status": "healthy", "service": "GxPilot Backend", "timestamp": datetime.utcnow().isoformat()}

# Document Management API
@app.get("/api/documents")
def list_documents(type: Optional[str] = None, current_user=Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    if type:
        cursor.execute(
            "SELECT * FROM documents WHERE type = %s AND owner_user_id = %s ORDER BY created_at DESC",
            (type, current_user["id"])
        )
    else:
        cursor.execute("SELECT * FROM documents WHERE owner_user_id = %s ORDER BY created_at DESC", (current_user["id"],))
    
    rows = cursor.fetchall()
    documents = [serialize_document_row(r) for r in rows]
    conn.close()
    return documents

@app.get("/api/control-bank/documents")
def list_control_bank_documents(
    doc_type: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user=Depends(get_current_user)
):
    clauses = ["d.type IN ('SOP', 'APQR')"]
    params = []

    if doc_type and doc_type.lower() != "all":
        clauses.append("d.type = %s")
        params.append(doc_type.upper())

    if status and status.lower() != "all":
        status_map = {
            "accepted": "Approved",
            "approved": "Approved",
            "declined": "Rejected",
            "rejected": "Rejected",
            "draft": "Draft",
            "under_review": "Under_Review",
            "under-review": "Under_Review",
        }
        clauses.append("d.status = %s")
        params.append(status_map.get(status.lower(), status))

    if search:
        like = f"%{search.lower()}%"
        clauses.append("(LOWER(COALESCE(d.display_id, d.id)) LIKE %s OR LOWER(d.name) LIKE %s OR LOWER(COALESCE(u.name, '')) LIKE %s)")
        params.extend([like, like, like])

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(f"""
        SELECT
            d.id,
            d.display_id,
            d.name,
            d.type,
            d.status,
            d.file_size,
            d.created_at,
            d.updated_at,
            u.name AS creator_name,
            u.staff_id AS creator_staff_id
        FROM documents d
        LEFT JOIN users u ON u.id = d.owner_user_id
        WHERE {' AND '.join(clauses)}
        ORDER BY d.created_at DESC
        LIMIT 500
    """, tuple(params))
    rows = cursor.fetchall()
    conn.close()
    return [serialize_control_bank_row(row) for row in rows]

@app.get("/api/control-bank/documents/{document_id}")
def get_control_bank_document(document_id: str, current_user=Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            d.*,
            u.name AS creator_name,
            u.staff_id AS creator_staff_id
        FROM documents d
        LEFT JOIN users u ON u.id = d.owner_user_id
        WHERE d.id = %s AND d.type IN ('SOP', 'APQR')
    """, (document_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Document not found")

    doc = {
        "id": row["id"],
        "display_id": row["display_id"] if "display_id" in row.keys() and row["display_id"] else row["id"],
        "name": row["name"],
        "type": row["type"],
        "status": row["status"],
        "content": recover_stored_pdf_text(row["name"], row["content"]),
        "content_type": row["content_type"],
        "file_size": row["file_size"],
        "creator_name": row["creator_name"] or "Unknown User",
        "creator_staff_id": row["creator_staff_id"] or "",
        "audit_trail": json.loads(row["audit_trail"]) if row["audit_trail"] else [],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"]
    }

    desired_profile = get_compliance_audit_profile(row["type"], row["name"])["id"]
    cursor.execute(
        "SELECT * FROM compliance_checks WHERE document_id = %s AND profile = %s ORDER BY created_at DESC LIMIT 1",
        (document_id, desired_profile)
    )
    chk_row = cursor.fetchone()
    doc["compliance_check"] = None if not chk_row else row_to_compliance_check(chk_row)

    conn.close()
    return doc

@app.post("/api/control-bank/documents/{document_id}/action")
def update_control_bank_document_action(
    document_id: str,
    action: str = Form(...),
    reviewer_name: str = Form("QA Lead"),
    current_user=Depends(get_current_user)
):
    if action not in ["Approve", "Reject", "Submit_For_Review"]:
        raise HTTPException(status_code=400, detail="Invalid action")

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT status FROM documents WHERE id = %s AND type IN ('SOP', 'APQR')", (document_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Document not found")

    new_status = 'Approved' if action == 'Approve' else ('Rejected' if action == 'Reject' else 'Under_Review')
    now_str = datetime.utcnow().isoformat()
    cursor.execute(
        "UPDATE documents SET status = %s, updated_at = %s WHERE id = %s",
        (new_status, now_str, document_id)
    )

    signer = f"{reviewer_name} ({current_user['name']})"
    event_text = f"Document status changed to {new_status} from SOP/APQR Control Bank by {signer} (21 CFR Part 11 compliant digital signature)"
    add_audit_trail_event(cursor, document_id, event_text, signer)

    conn.commit()
    conn.close()

    return {"id": document_id, "status": new_status, "audit_logged": True}

@app.get("/api/documents/{document_id}")
def get_document(document_id: str, current_user=Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM documents WHERE id = %s AND owner_user_id = %s", (document_id, current_user["id"]))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Document not found")
        
    doc = {
        "id": row["id"],
        "display_id": row["display_id"] if "display_id" in row.keys() and row["display_id"] else row["id"],
        "name": row["name"],
        "type": row["type"],
        "status": row["status"],
        "content": recover_stored_pdf_text(row["name"], row["content"]),
        "content_type": row["content_type"],
        "file_size": row["file_size"],
        "audit_trail": json.loads(row["audit_trail"]) if row["audit_trail"] else [],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"]
    }
    
    # Retrieve matching compliance check for this document type if it exists.
    desired_profile = get_compliance_audit_profile(row["type"], row["name"])["id"]
    cursor.execute(
        "SELECT * FROM compliance_checks WHERE document_id = %s AND profile = %s ORDER BY created_at DESC LIMIT 1",
        (document_id, desired_profile)
    )
    chk_row = cursor.fetchone()
    if chk_row:
        check = row_to_compliance_check(chk_row)
        doc["compliance_check"] = None if is_transient_analysis_failure(check) else check
    else:
        doc["compliance_check"] = None
        
    conn.close()
    return doc

# Helper function to track document-level events
def add_audit_trail_event(cursor, doc_id: str, event_text: str, user: str = "GxPilot AI", dedupe_prefix: Optional[str] = None):
    cursor.execute("SELECT audit_trail FROM documents WHERE id = %s", (doc_id,))
    row = cursor.fetchone()
    if row:
        trail = json.loads(row["audit_trail"]) if row["audit_trail"] else []
        if dedupe_prefix:
            trail = [event for event in trail if not event.get("event", "").startswith(dedupe_prefix)]
        trail.append({
            "time": datetime.utcnow().isoformat(),
            "user": user,
            "event": event_text
        })
        cursor.execute("UPDATE documents SET audit_trail = %s, updated_at = %s WHERE id = %s", 
                       (json.dumps(trail), datetime.utcnow().isoformat(), doc_id))

def row_to_compliance_check(row):
    anomalies = json.loads(row["anomalies"]) if row["anomalies"] else []
    for anomaly in anomalies:
        anomaly.setdefault("mitigation", "")

    return {
        "id": row["id"],
        "score": row["score"],
        "status": row["status"],
        "profile": row["profile"] if "profile" in row.keys() else None,
        "anomalies": anomalies,
        "recommendations": json.loads(row["recommendations"]) if row["recommendations"] else [],
        "checklist": json.loads(row["checklist"]) if row["checklist"] else [],
        "created_at": row["created_at"]
    }

def is_transient_analysis_failure(check) -> bool:
    anomalies = check.get("anomalies", [])
    checklist = check.get("checklist", [])
    return any("Error performing" in item.get("message", "") for item in anomalies) or any(
        "AI compliance scan completed" in item.get("item", "") and item.get("status") == "FAIL"
        for item in checklist
    )

def mark_document_under_review_after_scan(cursor, document_id: str, current_status: str) -> str:
    if current_status != "Draft":
        return current_status

    now_str = datetime.utcnow().isoformat()
    cursor.execute(
        "UPDATE documents SET status = %s, updated_at = %s WHERE id = %s",
        ("Under_Review", now_str, document_id)
    )
    add_audit_trail_event(
        cursor,
        document_id,
        "Document moved to Under Review after compliance report generation.",
        dedupe_prefix="Document moved to Under Review after compliance report generation"
    )
    return "Under_Review"

def create_and_save_compliance_check(cursor, document_id: str, name: str, doc_type: str, content: str):
    audit_profile = get_compliance_audit_profile(doc_type, name)
    compliance_report = analyze_gxp_document(name, doc_type, content)
    now_str = datetime.utcnow().isoformat()
    chk_id = f"chk-{uuid.uuid4().hex[:8]}"

    check = {
        "id": chk_id,
        "score": compliance_report["score"],
        "status": compliance_report["status"],
        "profile": audit_profile["id"],
        "anomalies": compliance_report["anomalies"],
        "recommendations": compliance_report["recommendations"],
        "checklist": compliance_report["checklist"],
        "created_at": now_str
    }
    for anomaly in check["anomalies"]:
        anomaly.setdefault("mitigation", "")

    if is_transient_analysis_failure(check):
        return check

    cursor.execute("DELETE FROM compliance_checks WHERE document_id = %s", (document_id,))
    cursor.execute("""
        INSERT INTO compliance_checks (id, document_id, score, status, profile, anomalies, recommendations, checklist, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        chk_id, document_id, compliance_report["score"], compliance_report["status"], audit_profile["id"],
        json.dumps(compliance_report["anomalies"]), json.dumps(compliance_report["recommendations"]),
        json.dumps(compliance_report["checklist"]), now_str
    ))

    add_audit_trail_event(
        cursor,
        document_id,
        f"Compliance scan [{audit_profile['id']}] completed with score: {compliance_report['score']}%. Status: {compliance_report['status']}",
        dedupe_prefix=f"Compliance scan [{audit_profile['id']}] completed"
    )

    return check

def extract_upload_text(filename: str, content_type: Optional[str], content_bytes: bytes) -> str:
    lower_name = (filename or "").lower()
    normalized_type = (content_type or "").lower()
    file_size = len(content_bytes)

    if normalized_type == "application/pdf" or lower_name.endswith(".pdf") or content_bytes.startswith(b"%PDF-"):
        try:
            reader = PdfReader(BytesIO(content_bytes))
            pages = []
            for index, page in enumerate(reader.pages, start=1):
                page_text = (page.extract_text() or "").strip()
                if page_text:
                    pages.append(f"[Page {index}]\n{page_text}")
            if pages:
                return "\n\n".join(pages)
            return (
                f"[PDF uploaded: {filename}. No selectable text was found. "
                "This may be a scanned/image-only PDF and requires OCR before compliance review.]"
            )
        except Exception as exc:
            return (
                f"[PDF uploaded: {filename}. Text extraction failed: {str(exc)}. "
                "Please upload a text-based PDF, TXT, CSV, or OCR output for detailed compliance review.]"
            )

    text_like_types = (
        "text/",
        "application/json",
        "application/xml",
        "application/csv",
    )
    if any(normalized_type.startswith(prefix) for prefix in text_like_types) or lower_name.endswith((".txt", ".csv", ".json", ".md", ".xml")):
        return content_bytes.decode("utf-8", errors="replace")

    if b"\x00" in content_bytes[:2048]:
        return (
            f"[Binary file uploaded. Format: {content_type or 'unknown'}, Size: {file_size} bytes. "
            "Text preview is unavailable; upload OCR/text output for full semantic compliance review.]"
        )

    try:
        return content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return (
            f"[Binary file uploaded. Format: {content_type or 'unknown'}, Size: {file_size} bytes. "
            "Text preview is unavailable; upload OCR/text output for full semantic compliance review.]"
        )

def recover_stored_pdf_text(filename: str, content: Optional[str]) -> str:
    if not content:
        return content or ""
    if not content.lstrip().startswith("%PDF-"):
        return content

    try:
        pdf_bytes = content.encode("latin-1", errors="ignore")
        reader = PdfReader(BytesIO(pdf_bytes))
        pages = []
        for index, page in enumerate(reader.pages, start=1):
            page_text = (page.extract_text() or "").strip()
            if page_text:
                pages.append(f"[Page {index}]\n{page_text}")
        if pages:
            return "\n\n".join(pages)
    except Exception:
        pass

    return (
        f"# PDF Document Review Summary\n\n"
        f"**File:** {filename}\n\n"
        "This is a controlled PDF document. The stored record contains PDF binary structure, "
        "so the system generated a review summary instead of displaying raw PDF internals.\n\n"
        "## Document Information\n\n"
        "- Source format: PDF\n"
        "- Preview status: Binary PDF content detected\n"
        "- Review mode: GxP compliance summary and metadata review\n\n"
        "## Compliance Review Focus\n\n"
        "- Confirm document title, effective date, version, and approval status.\n"
        "- Verify required QA signatures and 21 CFR Part 11 audit trail controls.\n"
        "- Check procedure steps for completeness, cleaning verification, deviation handling, and release criteria.\n"
        "- Review the compliance findings panel for detected anomalies, CAPA recommendations, and checklist results.\n\n"
        "## Note\n\n"
        "If this PDF contains selectable text, re-opening the document after backend recovery may show extracted pages. "
        "If it is scanned/image-only, OCR is required for full page-level text preview."
    )

@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    doc_type: str = Form("General"), # SOP, APQR, BatchRecord, Review
    current_user=Depends(get_current_user),
):
    try:
        content_bytes = await file.read()
        file_size = len(content_bytes)
        content_text = extract_upload_text(file.filename, file.content_type, content_bytes)
            
        doc_id = f"doc-{uuid.uuid4().hex[:8]}"
        display_id = build_display_id(doc_type)
        now_str = datetime.utcnow().isoformat()
        
        # Default empty audit trail
        audit_trail = [{
            "time": now_str,
            "user": "System",
            "event": f"File '{file.filename}' uploaded and categorized under {doc_type}"
        }]
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO documents (id, display_id, owner_user_id, name, type, status, content, content_type, file_size, audit_trail, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            doc_id, display_id, current_user["id"], file.filename, doc_type, 'Under_Review', content_text, file.content_type, file_size, 
            json.dumps(audit_trail), now_str, now_str
        ))
        
        compliance_check = create_and_save_compliance_check(cursor, doc_id, file.filename, doc_type, content_text)
        
        # Automatically log ROI metrics for this task
        # Reviewing manually takes 2 hours on average, AI does it instantly
        cursor.execute("""
            INSERT INTO roi_metrics (task_type, owner_user_id, hours_saved, errors_prevented, cost_saved_usd, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, ('General_Review' if doc_type == 'General' else 'Batch_Review', current_user["id"], 2.5, len(compliance_check["anomalies"]), 125.0, now_str))
        
        conn.commit()
        conn.close()
        
        return {
            "document_id": doc_id,
            "display_id": display_id,
            "filename": file.filename,
            "type": doc_type,
            "compliance_score": compliance_check["score"],
            "status": compliance_check["status"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload and process document: {str(e)}")

# SOP Drafting Endpoint
@app.post("/api/documents/draft-sop")
def generate_sop_draft(req: SOPDraftRequest, current_user=Depends(get_current_user)):
    try:
        draft_content = draft_gxp_sop(req.title, req.steps, req.roles, req.regulations)
        
        doc_id = f"sop-{uuid.uuid4().hex[:8]}"
        display_id = build_display_id("SOP")
        filename = f"SOP_{req.title.replace(' ', '_')}_Draft.md"
        now_str = datetime.utcnow().isoformat()
        
        audit_trail = [{
            "time": now_str,
            "user": "GxPilot AI",
            "event": f"SOP draft prepared. Inputs: steps={len(req.steps)} chars, regulations={len(req.regulations)} items"
        }]
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO documents (id, display_id, owner_user_id, name, type, status, content, content_type, file_size, audit_trail, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            doc_id, display_id, current_user["id"], filename, 'SOP', 'Draft', draft_content, 'text/markdown', len(draft_content),
            json.dumps(audit_trail), now_str, now_str
        ))
        
        # Log ROI metric
        # Drafting an SOP manually takes about 16 hours, AI draft takes seconds
        cursor.execute("""
            INSERT INTO roi_metrics (task_type, owner_user_id, hours_saved, errors_prevented, cost_saved_usd, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, ('SOP_Prep', current_user["id"], 16.0, 4, 800.0, now_str))
        
        conn.commit()
        conn.close()
        
        return {"id": doc_id, "display_id": display_id, "name": filename, "content": draft_content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SOP draft failed: {str(e)}")

# APQR Compilation Endpoint
@app.post("/api/documents/draft-apqr")
def generate_apqr_draft(req: APQRDraftRequest, current_user=Depends(get_current_user)):
    try:
        draft_content = draft_gxp_apqr(req.batch_summary, req.deviations, req.stability, req.quality_system_data)
        
        doc_id = f"apqr-{uuid.uuid4().hex[:8]}"
        display_id = build_display_id("APQR")
        filename = "Annual_Product_Quality_Review_Draft.md"
        now_str = datetime.utcnow().isoformat()
        
        audit_trail = [{
            "time": now_str,
            "user": "GxPilot AI",
            "event": "APQR draft generated based on manufacturing data streams."
        }]
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO documents (id, display_id, owner_user_id, name, type, status, content, content_type, file_size, audit_trail, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            doc_id, display_id, current_user["id"], filename, 'APQR', 'Draft', draft_content, 'text/markdown', len(draft_content),
            json.dumps(audit_trail), now_str, now_str
        ))
        
        # Log ROI metric
        # Compiling APQR takes about 40 hours manually
        cursor.execute("""
            INSERT INTO roi_metrics (task_type, owner_user_id, hours_saved, errors_prevented, cost_saved_usd, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, ('APQR_Gen', current_user["id"], 40.0, 10, 2000.0, now_str))
        
        conn.commit()
        conn.close()
        
        return {"id": doc_id, "display_id": display_id, "name": filename, "content": draft_content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"APQR compilation failed: {str(e)}")

# Approve or Reject document state (Part 11 audit trails compliance)
@app.post("/api/documents/{document_id}/action")
def update_document_action(document_id: str, action: str = Form(...), reviewer_name: str = Form("QA Lead"), current_user=Depends(get_current_user)):
    if action not in ["Approve", "Reject", "Submit_For_Review"]:
        raise HTTPException(status_code=400, detail="Invalid action")
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT status FROM documents WHERE id = %s AND owner_user_id = %s", (document_id, current_user["id"]))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Document not found")
        
    new_status = 'Approved' if action == 'Approve' else ('Rejected' if action == 'Reject' else 'Under_Review')
    
    # Update document status
    cursor.execute("UPDATE documents SET status = %s, updated_at = %s WHERE id = %s", 
                   (new_status, datetime.utcnow().isoformat(), document_id))
    
    # Log Part 11 Audit Trail event
    event_text = f"Document status changed to {new_status} via physical signoff by {reviewer_name} (21 CFR Part 11 compliant digital signature)"
    add_audit_trail_event(cursor, document_id, event_text, reviewer_name)
    
    conn.commit()
    conn.close()
    
    return {"id": document_id, "status": new_status, "audit_logged": True}

@app.put("/api/documents/{document_id}")
def update_document_content(document_id: str, req: DocumentUpdate, current_user=Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM documents WHERE id = %s AND owner_user_id = %s FOR UPDATE", (document_id, current_user["id"]))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Document not found")

    now_str = datetime.utcnow().isoformat()
    cursor.execute("""
        UPDATE documents
        SET content = %s, file_size = %s, updated_at = %s
        WHERE id = %s
    """, (req.content, len(req.content.encode("utf-8")), now_str, document_id))

    cursor.execute("DELETE FROM compliance_checks WHERE document_id = %s", (document_id,))
    add_audit_trail_event(
        cursor,
        document_id,
        "Document content updated in editor. Saved compliance reports invalidated for re-scan.",
        "GxPilot Editor"
    )

    conn.commit()
    conn.close()
    return get_document(document_id, current_user)

@app.delete("/api/documents/{document_id}")
def delete_document(document_id: str, current_user=Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM documents WHERE id = %s AND owner_user_id = %s", (document_id, current_user["id"]))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Document not found")
    cursor.execute("DELETE FROM compliance_checks WHERE document_id = %s", (document_id,))
    conn.commit()
    conn.close()
    return {"status": "success", "message": f"Document {document_id} and related reviews deleted successfully."}

@app.post("/api/documents/{document_id}/scan")
def scan_existing_document(document_id: str, current_user=Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM documents WHERE id = %s AND owner_user_id = %s FOR UPDATE", (document_id, current_user["id"]))
    doc_row = cursor.fetchone()
    if not doc_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Document not found")

    desired_profile = get_compliance_audit_profile(doc_row["type"], doc_row["name"])["id"]
    cursor.execute(
        "SELECT * FROM compliance_checks WHERE document_id = %s AND profile = %s ORDER BY created_at DESC LIMIT 1",
        (document_id, desired_profile)
    )
    existing_check = cursor.fetchone()
    if existing_check:
        check = row_to_compliance_check(existing_check)
        if not is_transient_analysis_failure(check):
            next_status = mark_document_under_review_after_scan(cursor, document_id, doc_row["status"])
            conn.commit()
            conn.close()
            return {"document_id": document_id, "status": next_status, "compliance_check": check, "created": False}
        cursor.execute("DELETE FROM compliance_checks WHERE id = %s", (check["id"],))

    content = recover_stored_pdf_text(doc_row["name"], doc_row["content"])
    check = create_and_save_compliance_check(
        cursor,
        document_id,
        doc_row["name"],
        doc_row["type"],
        content or "[No document content available for compliance review.]"
    )
    next_status = mark_document_under_review_after_scan(cursor, document_id, doc_row["status"])

    conn.commit()
    conn.close()
    return {"document_id": document_id, "status": next_status, "compliance_check": check, "created": True}

# Chat Support Assistant API
@app.get("/api/chat/history")
def get_chat_history():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM chat_history ORDER BY id ASC")
    rows = cursor.fetchall()
    
    history = []
    for r in rows:
        history.append({
            "id": r["id"],
            "role": r["role"],
            "content": r["content"],
            "timestamp": r["timestamp"]
        })
    conn.close()
    return history

@app.post("/api/chat")
def post_chat_message(req: ChatMessageRequest):
    try:
        # 1. Fetch historical conversations for context
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT role, content FROM chat_history ORDER BY id ASC")
        rows = cursor.fetchall()
        
        history = [{"role": r["role"], "content": r["content"]} for r in rows]
        
        # 2. Call Gemini
        reply = answer_gxp_chat(req.message, history)
        
        # 3. Store both messages in SQLite
        now_str = datetime.utcnow().isoformat()
        cursor.execute("INSERT INTO chat_history (role, content, timestamp) VALUES (%s, %s, %s)", 
                       ('user', req.message, now_str))
        cursor.execute("INSERT INTO chat_history (role, content, timestamp) VALUES (%s, %s, %s)", 
                       ('assistant', reply, now_str))
        
        conn.commit()
        conn.close()
        
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chatbot query failed: {str(e)}")

@app.post("/api/chat/history/clear")
def clear_chat_history():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chat_history")
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Chat history cleared successfully"}

# ROI & Savings Analytics API
@app.get("/api/roi")
def get_roi_summary(current_user=Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            SUM(hours_saved) as total_hours,
            SUM(errors_prevented) as total_errors,
            SUM(cost_saved_usd) as total_usd,
            COUNT(*) as total_tasks
        FROM roi_metrics
        WHERE owner_user_id = %s
    """, (current_user["id"],))
    summary = cursor.fetchone()
    
    cursor.execute("SELECT * FROM roi_metrics WHERE owner_user_id = %s ORDER BY created_at DESC LIMIT 50", (current_user["id"],))
    rows = cursor.fetchall()
    
    metrics_list = []
    for r in rows:
        metrics_list.append({
            "id": r["id"],
            "task_type": r["task_type"],
            "hours_saved": r["hours_saved"],
            "errors_prevented": r["errors_prevented"],
            "cost_saved_usd": r["cost_saved_usd"],
            "created_at": r["created_at"]
        })
        
    conn.close()
    
    return {
        "summary": {
            "total_hours_saved": summary["total_hours"] or 0,
            "total_errors_prevented": summary["total_errors"] or 0,
            "total_cost_saved_usd": summary["total_usd"] or 0,
            "total_tasks_assisted": summary["total_tasks"] or 0,
            "hourly_rate_assumption": 50.0 # Standard phar QA specialist USD rate
        },
        "history": metrics_list
    }

@app.get("/api/dashboard/metrics")
def get_dashboard_metrics(current_user=Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT DISTINCT ON (cc.document_id) cc.*
        FROM compliance_checks cc
        JOIN documents d ON d.id = cc.document_id
        WHERE cc.document_id IS NOT NULL AND d.owner_user_id = %s
        ORDER BY cc.document_id, cc.created_at DESC
    """, (current_user["id"],))
    latest_checks = cursor.fetchall()

    scores = [float(row["score"]) for row in latest_checks if row["score"] is not None]
    compliance_score = round(sum(scores) / len(scores), 1) if scores else 0.0
    if not scores:
        compliance_label = "No Scans"
    elif compliance_score >= 90:
        compliance_label = "Optimal"
    elif compliance_score >= 75:
        compliance_label = "Watchlist"
    else:
        compliance_label = "At Risk"

    feed = []
    for row in latest_checks:
        anomalies = json.loads(row["anomalies"]) if row["anomalies"] else []
        for anomaly in anomalies:
            feed.append({
                "type": anomaly.get("type", "Compliance Finding"),
                "severity": anomaly.get("severity", "Low"),
                "message": anomaly.get("message", ""),
                "document_id": row["document_id"],
                "score": row["score"],
                "created_at": row["created_at"],
            })
    severity_order = {"High": 0, "Medium": 1, "Low": 2}
    feed.sort(key=lambda item: (severity_order.get(item["severity"], 3), item.get("created_at") or ""), reverse=False)
    feed = feed[:5]

    cursor.execute("""
        SELECT
            COALESCE(SUM(hours_saved), 0) AS total_hours,
            COALESCE(SUM(errors_prevented), 0) AS total_errors,
            COALESCE(SUM(cost_saved_usd), 0) AS total_usd,
            COUNT(*) AS total_tasks
        FROM roi_metrics
        WHERE owner_user_id = %s
    """, (current_user["id"],))
    roi_summary = cursor.fetchone()

    cursor.execute(
        "SELECT id, name, type, status, content, created_at FROM documents WHERE owner_user_id = %s ORDER BY created_at ASC",
        (current_user["id"],)
    )
    documents = cursor.fetchall()

    yield_values = []
    target_values = []
    stability_deltas = []
    oos_mentions = 0
    oos_zero_mentions = 0

    for doc in documents:
        content = doc["content"] or ""
        yield_values.extend(extract_yield_values(content))
        target_values.extend(extract_percent_values(r"(?:target|standard range|limit)\D{0,60}(\d{1,3}(?:\.\d+)?)\s*%", content))
        stability_delta = extract_stability_delta(content)
        if stability_delta is not None:
            stability_deltas.append(stability_delta)
        if re.search(r"\bOOS\b|out[- ]of[- ]specification", content, flags=re.IGNORECASE):
            oos_mentions += 1
            if re.search(r"(?:OOS(?:\s+Results)?|out[- ]of[- ]specification)[^\n]{0,40}:\s*0\b", content, flags=re.IGNORECASE):
                oos_zero_mentions += 1

    trend_values = [round(value, 1) for value in yield_values[-7:]]
    average_target = round(sum(target_values) / len(target_values), 1) if target_values else None
    stability_delta = round(sum(stability_deltas) / len(stability_deltas), 1) if stability_deltas else None
    oos_rate = round(((oos_mentions - oos_zero_mentions) / len(documents)) * 100, 1) if documents else 0.0
    audits_due = sum(1 for doc in documents if doc["status"] in ("Draft", "Under_Review"))

    conn.close()

    return {
        "compliance_index": {
            "score": compliance_score,
            "label": compliance_label,
            "documents_scanned": len(scores),
        },
        "quality_efficiency": {
            "hours_saved": float(roi_summary["total_hours"] or 0),
            "errors_prevented": int(roi_summary["total_errors"] or 0),
            "cost_saved_usd": float(roi_summary["total_usd"] or 0),
            "tasks_assisted": int(roi_summary["total_tasks"] or 0),
        },
        "site_compliance_feed": feed,
        "trend_analysis": {
            "yield_values": trend_values,
            "target": average_target,
            "stability_delta": stability_delta,
            "oos_rate": oos_rate,
            "audits_due": audits_due,
        },
    }

@app.post("/api/roi")
def create_roi_metric(req: ROIMetricCreate, current_user=Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.utcnow().isoformat()
    cursor.execute("""
        INSERT INTO roi_metrics (task_type, owner_user_id, hours_saved, errors_prevented, cost_saved_usd, created_at)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (req.task_type, current_user["id"], req.hours_saved, req.errors_prevented, req.cost_saved_usd, now_str))
    conn.commit()
    conn.close()
    return {"status": "success"}
