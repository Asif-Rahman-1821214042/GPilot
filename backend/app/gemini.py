import os
import json
import socket
from typing import Dict, Any, List
from google import genai
from google.genai import types

GEMINI_TIMEOUT_SECONDS = float(os.environ.get("GEMINI_TIMEOUT_SECONDS", "20"))
MAX_ANALYSIS_CHARS = int(os.environ.get("MAX_ANALYSIS_CHARS", "12000"))

socket.setdefaulttimeout(GEMINI_TIMEOUT_SECONDS)

def get_compliance_audit_profile(doc_type: str, name: str) -> Dict[str, str]:
    doc_hint = f"{doc_type} {name}".lower()

    if "apqr" in doc_hint or "annual product quality review" in doc_hint:
        return {
            "id": "apqr",
            "label": "APQR / Annual Product Quality Review",
            "focus": (
                "Perform an APQR-specific GxP audit. Evaluate whether the report includes product identity, "
                "review period, batch manufacturing summary, rejected/approved batch counts, yield and quality trends, "
                "deviation and OOS/OOT investigation summaries, CAPA effectiveness, change controls, complaints/recalls, "
                "stability data and trend analysis, validation status, analytical method performance, supplier/material issues, "
                "regulatory commitments, previous APQR action follow-up, and a scientifically justified annual quality conclusion."
            ),
            "anomaly_types": (
                '"Missing APQR Section" | "OOS/OOT Gap" | "Deviation/CAPA Gap" | '
                '"Stability Trend Risk" | "Batch Trend Risk" | "Change Control Gap" | "Compliance Risk"'
            ),
            "checklist": (
                "Checklist must include APQR-specific items: batch summary complete, deviations/OOS/OOT reviewed, "
                "stability trends assessed, CAPA/change controls reviewed, complaints/recalls assessed, previous actions closed, "
                "annual product quality conclusion justified."
            ),
        }

    if "sop" in doc_hint or "standard operating procedure" in doc_hint:
        return {
            "id": "sop",
            "label": "SOP / Standard Operating Procedure",
            "focus": (
                "Perform an SOP-specific GxP audit. Evaluate whether the procedure includes clear purpose, scope, "
                "responsibilities, definitions, prerequisites/materials/equipment, step-by-step procedure controls, "
                "critical parameters and acceptance criteria, safety/contamination controls, deviation handling, "
                "documentation records, training requirements, references, version/effective-date controls, QA approval, "
                "and 21 CFR Part 11 compliant signature/audit trail expectations where applicable."
            ),
            "anomaly_types": (
                '"Missing SOP Section" | "Procedure Ambiguity" | "Missing Acceptance Criteria" | '
                '"Missing Signature" | "Training Gap" | "Document Control Gap" | "Compliance Risk"'
            ),
            "checklist": (
                "Checklist must include SOP-specific items: purpose/scope present, roles/responsibilities defined, "
                "procedure steps complete, acceptance criteria specified, deviation handling included, training/records defined, "
                "version/effective date/QA approval controlled."
            ),
        }

    return {
        "id": "general",
        "label": "General GxP Controlled Document",
        "focus": (
            "Perform a general GxP document audit. Evaluate data integrity, missing approvals, incomplete records, "
            "deviation/OOS handling, traceability, document control, signature controls, and regulatory completeness."
        ),
        "anomaly_types": (
            '"Deviation Warning" | "Missing Signature" | "Out of Specification" | '
            '"Critical Parameter Check" | "Document Control Gap" | "Compliance Risk"'
        ),
        "checklist": (
            "Checklist must include general GxP controls: document control, completeness, signatures, traceability, "
            "deviation/OOS handling, and data integrity."
        ),
    }

def call_gemini(prompt: str, system_instruction: str = None, json_format: bool = False) -> str:
    """
    Calls Gemini through the official google-genai SDK.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        # Fallback/Development mode if key is missing
        print("Warning: GEMINI_API_KEY environment variable not found.")
        if json_format:
            return json.dumps({
                "error": "GEMINI_API_KEY not configured. Showing mock compliance report.",
                "score": 75.0,
                "status": "Flagged",
                "anomalies": [{
                    "type": "Configuration",
                    "severity": "Medium",
                    "message": "API Key is missing from the environment.",
                    "mitigation": "Configure GEMINI_API_KEY in the backend environment and re-run the compliance scan."
                }],
                "recommendations": ["Configure GEMINI_API_KEY in the Secrets panel."],
                "checklist": [{"item": "API configured", "status": "FAIL"}]
            })
        return "Gemini API key is not configured in the backend environment. Please check your environment variables."

    model = os.environ.get("MODEL", "gemini-3.5-flash")

    client = genai.Client(api_key=api_key)
    config_kwargs = {}
    if system_instruction:
        config_kwargs["system_instruction"] = system_instruction
    if json_format:
        config_kwargs["response_mime_type"] = "application/json"
    
    try:
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(**config_kwargs) if config_kwargs else None,
        )
        return response.text or "Error: No response text found from the Gemini API."
    except Exception as e:
        print(f"Error calling Gemini: {str(e)}")
        raise e

def analyze_gxp_document(name: str, doc_type: str, content: str) -> Dict[str, Any]:
    """
    Performs GxP compliance review and anomaly detection on a uploaded file.
    """
    audit_profile = get_compliance_audit_profile(doc_type, name)

    system_instruction = (
        "You are GxPilot, an expert AI pharmaceutical quality assurance (QA) auditor. "
        f"Your task is to analyze {audit_profile['label']} documents against pharmaceutical standards "
        "(e.g., 21 CFR Part 211, 21 CFR Part 11, EU GMP, ICH Q7/Q9/Q10, and EU GMP Chapter 1 where relevant). "
        "Provide a structured JSON report with a compliance score (0-100), overall status ('Approved', 'Flagged', 'Rejected'), "
        "a list of GxP anomalies/violations (containing type, severity, message, mitigation), a list of regulatory recommendations, "
        "and a checklist of standard checks with pass/fail status. "
        "For every anomaly, provide a specific AI mitigation suggestion that tells the reviewer what change to make to reduce or remove the risk. "
        "If the file name or document content clearly indicates a Draft or Under Review document, treat pending approval names, signatures, "
        "and approval dates as finalization items rather than major technical APQR/SOP content failures; flag them as Low severity unless the "
        "document is presented as Approved or final. "
        f"{audit_profile['focus']}"
    )
    
    analysis_content = content
    if len(analysis_content) > MAX_ANALYSIS_CHARS:
        analysis_content = (
            analysis_content[:MAX_ANALYSIS_CHARS]
            + f"\n\n[Content truncated for live scan: original length {len(content)} characters.]"
        )

    prompt = f"""
    Analyze the following pharmaceutical document using the {audit_profile['label']} audit profile:
    File Name: {name}
    Document Type: {doc_type}

    Audit focus:
    {audit_profile['focus']}

    Checklist instruction:
    {audit_profile['checklist']}
    
    Content:
    {analysis_content}
    
    Return a JSON object conforming exactly to this structure:
    {{
        "score": float, (e.g. 85.5)
        "status": "Approved" | "Flagged" | "Rejected",
        "anomalies": [
            {{
                "type": {audit_profile['anomaly_types']},
                "severity": "High" | "Medium" | "Low",
                "message": "Detailed description of the anomaly or compliance gap",
                "mitigation": "Specific AI suggestion explaining what to change, add, clarify, or verify to mitigate this risk"
            }}
        ],
        "recommendations": [
            "Actionable recommendation 1 referencing GxP or CFR codes",
            "Actionable recommendation 2"
        ],
        "checklist": [
            {{
                "item": "Check item description (e.g. 21 CFR 211 double signature validation)",
                "status": "PASS" | "FAIL" | "N/A"
            }}
        ]
    }}
    """
    
    try:
        raw_response = call_gemini(prompt, system_instruction, json_format=True)
        return json.loads(raw_response)
    except Exception as e:
        # Fallback response in case of API or parsing issues
        return {
            "score": 60.0,
            "status": "Flagged",
            "anomalies": [
                {
                    "type": "Compliance Risk",
                    "severity": "High",
                    "message": f"Error performing {audit_profile['label']} compliance analysis: {str(e)}",
                    "mitigation": "Validate backend connectivity and API configuration, then re-run the compliance scan. Perform manual QA review until AI analysis is available."
                }
            ],
            "recommendations": [
                "Re-run analysis once server connectivity is validated.",
                f"Review the document manually using the {audit_profile['label']} audit profile."
            ],
            "checklist": [
                {"item": f"{audit_profile['label']} AI compliance scan completed", "status": "FAIL"}
            ]
        }

def draft_gxp_sop(title: str, steps: str, roles: str, regulations: List[str]) -> str:
    """
    Drafts a fully GxP compliant SOP based on author inputs.
    """
    system_instruction = (
        "You are a senior pharmaceutical QA technical writer and GMP document-control specialist. "
        "You write controlled Standard Operating Procedures that are practical for shop-floor execution, "
        "audit-ready, unambiguous, and aligned with FDA 21 CFR Part 11/211, EU GMP, ICH Q7, ICH Q9, and ICH Q10. "
        "Use precise imperative language, define measurable acceptance criteria where inputs allow, and mark unknowns as [TBD] instead of inventing data."
    )
    
    prompt = f"""
    Draft a complete GMP-controlled Standard Operating Procedure (SOP).

    INPUTS
    Title: {title}
    Operational steps / process description:
    {steps}

    Responsible roles:
    {roles}

    Applicable regulations / standards:
    {', '.join(regulations) if regulations else '[TBD - user did not specify]'}

    OUTPUT REQUIREMENTS
    Return only the SOP in polished Markdown. Make it suitable for direct review by QA.

    Required SOP structure:
    # {title}

    ## Document Control
    Include a compact table with:
    - Document ID: [SOP-XXX]
    - Version: [1.0]
    - Effective Date: [DD-MMM-YYYY]
    - Supersedes: [New / SOP-XXX]
    - Department / Process Owner: [TBD]
    - Prepared By / Reviewed By / Approved By signature lines
    - Review Cycle: [e.g., 2 years]

    ## 1. Purpose
    Explain why the SOP exists and what GxP risk it controls.

    ## 2. Scope
    Define included and excluded activities, equipment, departments, products, or sites. Use [TBD] where inputs are missing.

    ## 3. Definitions and Abbreviations
    Define all technical terms implied by the input. Include terms such as SOP, GMP, QA, deviation, CAPA, critical parameter, and any equipment/process-specific terms.

    ## 4. Roles and Responsibilities
    Provide a responsibility matrix table with Role, Responsibility, Required Records/Signoff.

    ## 5. Materials, Equipment, Systems, and Prerequisites
    List prerequisites before execution: training, line clearance, equipment status, calibration, cleaning status, approved forms, safety controls, and electronic system access if relevant.

    ## 6. Procedure
    Convert the user-provided steps into a numbered, detailed, executable procedure.
    For each major step include:
    - responsible role
    - required action
    - required record/evidence
    - critical parameter or acceptance criterion when applicable
    - what to do if the criterion is not met

    ## 7. Critical Process Parameters and Acceptance Criteria
    Include a table with Parameter, Target/Limit, Monitoring Method, Frequency, Responsible Role, Action if Out of Limit.
    Use [TBD] rather than making up values not provided.

    ## 8. Deviations, OOS/OOT, and CAPA Handling
    Explain when to stop work, quarantine product/equipment, notify QA, open deviation/OOS/OOT, assess impact, and initiate CAPA.

    ## 9. Data Integrity and 21 CFR Part 11 Controls
    Include ALCOA+ expectations, audit trail review, electronic signature requirements, password/PIN controls, contemporaneous recording, and change-control expectations.

    ## 10. Training Requirements
    State who must be trained, when retraining is required, and where training evidence is retained.

    ## 11. Records and Attachments
    List required forms/logbooks/attachments generated by this SOP.

    ## 12. References
    Include the supplied regulations plus relevant GMP references. Do not cite unsupported clause numbers unless confident.

    ## 13. Revision History
    Include a table with Version, Effective Date, Summary of Change, Author, QA Approval.

    QUALITY RULES
    - Do not invent specific batch numbers, equipment IDs, limits, dates, or names unless supplied.
    - Use [TBD] for missing controlled values.
    - Write in formal SOP language with clear SHALL/MUST statements.
    - Make the procedure specific to the provided title and steps, not a generic SOP template.
    - Include practical QA checks and record evidence throughout.
    """
    
    try:
        return call_gemini(prompt, system_instruction, json_format=False)
    except Exception as e:
        return f"# Draft Generation Error\n\nFailed to draft SOP due to: {str(e)}"

def draft_gxp_apqr(batch_summary: str, deviations: str, stability: str, quality_system_data: str = "") -> str:
    """
    Drafts an Annual Product Quality Review (APQR) summary.
    """
    system_instruction = (
        "You are a senior pharmaceutical QA executive and Product Quality Review author. "
        "You compile APQR/PQR reports that are scientifically reasoned, trend-based, CAPA-oriented, and aligned with "
        "EU GMP Chapter 1, EU GMP Annex 15 where applicable, FDA 21 CFR 211.180(e), ICH Q9, and ICH Q10. "
        "Use the provided data only; when data is missing, clearly mark gaps and required follow-up instead of inventing values."
    )
    
    prompt = f"""
    Compile a formal Annual Product Quality Review (APQR/PQR) report from the provided data.

    INPUT DATA
    Batch production summary:
    {batch_summary}

    Deviations, investigations, OOS/OOT, and quality events:
    {deviations}

    Stability and QC data:
    {stability}

    Quality system, lifecycle, and regulatory data:
    {quality_system_data or "[TBD - no quality system data provided]"}

    OUTPUT REQUIREMENTS
    Return only the APQR report in polished Markdown. It must read like a QA-reviewed annual quality report, not a generic summary.

    Required APQR structure:
    # Annual Product Quality Review (APQR)

    ## Document Control
    Include a compact table with:
    - Product Name / Strength / Dosage Form: [extract if available, otherwise TBD]
    - Review Period: [extract if available, otherwise TBD]
    - Site / Line: [TBD if missing]
    - Report ID: [APQR-XXX]
    - Version: [1.0]
    - Prepared By / QA Reviewed By / Approved By
    - Approval Date: [DD-MMM-YYYY]

    ## 1. Executive Summary
    Provide a concise but meaningful quality conclusion:
    - overall state of control
    - major trends
    - major risks
    - whether continued process verification is acceptable, conditional, or not acceptable
    - confidence level with justification

    ## 2. Data Sources and Review Scope
    State what data was reviewed. Treat provided quality-system/lifecycle data as reviewed evidence. Only list items as data gaps when they are not supplied.

    ## 3. Batch Manufacturing and Yield Trend Review
    Summarize batch counts, approved/rejected batches, yield trends, recurring process issues, and possible process capability concerns.
    Include a table: Metric, Observed Result, Trend/Interpretation, Quality Impact, Required Action.
    If process capability or SPC metrics are supplied, include Cpk/Ppk/control-chart interpretation. If not supplied, state that SPC attachments are required.

    ## 4. Deviations, OOS/OOT, Investigations, and CAPA Effectiveness
    Analyze each event type. Distinguish deviation, OOS, OOT, complaint, recall, and CAPA where data allows.
    Include root-cause adequacy, recurrence risk, closure status, and CAPA effectiveness.
    Include deviation/CAPA IDs and short root-cause/effectiveness summaries where supplied.

    ## 5. Stability and QC Trend Analysis
    Evaluate assay, degradation, dissolution, impurities, microbiological or other QC/stability results provided.
    Identify adverse trends, specification risks, shelf-life/storage implications, and whether more investigation is needed.
    Include analytical method performance/system suitability/validation status when supplied.

    ## 6. Change Controls, Validation, and Process State
    Discuss whether changes, validation status, cleaning/process validation, analytical methods, and continued process verification remain adequate.
    Use the quality-system/lifecycle data where supplied. Mark missing areas as data gaps only when not supplied.

    ## 7. Complaints, Returns, Recalls, and Regulatory Commitments
    Include this section. If complaints/returns/recalls/regulatory commitment data is supplied as zero or closed, state that it was reviewed and do not mark it missing.

    ## 8. Previous APQR Actions, Supplier Quality, and Material Review
    Explicitly state the status of prior APQR commitments/CAPAs, supplier quality performance, critical material deviations, and whether any material-related changes impacted product quality.

    ## 9. Risk Assessment
    Include a table with Risk, Evidence, Severity, Probability, Detectability, Risk Rating, Recommended Action.
    Use High/Medium/Low ratings and justify them from the provided data.

    ## 10. CAPA and Quality Improvement Plan
    Provide practical CAPA recommendations with Owner, Due Date [TBD], Effectiveness Check, and Priority.

    ## 11. Final APQR Conclusion
    Give a formal QA conclusion:
    - product/process state of control
    - whether process remains validated
    - whether additional monitoring/investigation is required
    - disposition recommendation for next review cycle

    ## 12. Appendices / Required Follow-Up Data
    List only genuinely missing data needed for a complete APQR. If all required streams are supplied, state that no critical APQR data gaps remain and list routine attachments retained by QA.

    QUALITY RULES
    - Do not invent exact metrics, dates, batch IDs, owners, or results not supplied.
    - If input data is weak, produce a useful APQR with clear data gaps and follow-up actions.
    - If input data shows controlled/no-event quality streams, use those facts as evidence of compliance instead of creating artificial gaps.
    - Use professional QA language and explicit regulatory reasoning.
    - Tie every risk and CAPA recommendation back to the supplied data.
    - Make the report specific to the supplied batch/deviation/stability information.
    """
    
    try:
        return call_gemini(prompt, system_instruction, json_format=False)
    except Exception as e:
        return f"# APQR Draft Generation Error\n\nFailed to draft APQR due to: {str(e)}"

def answer_gxp_chat(message: str, history: List[Dict[str, str]]) -> str:
    """
    Chatbot assistant for compliance, CFR lookups, and audit readiness.
    """
    system_instruction = (
        "You are GxPilot compliance chatbot, a warm, authoritative QA expert assistant. "
        "Your role is to help pharmaceutical quality executives look up CFR guidelines, explain EU GMP Annexes, "
        "offer advice on handling out-of-specification (OOS) results, deviations, CAPAs, "
        "and provide guidance on SOP design. Keep your answers practical, citation-grounded (e.g. citing 21 CFR 211.192), "
        "and direct. Avoid fluff."
    )
    
    # Format history for prompt
    history_str = ""
    for h in history[-8:]: # keep last 8 exchanges to avoid token bloat
        role_label = "User" if h["role"] == "user" else "GxPilot"
        history_str += f"{role_label}: {h['content']}\n"
        
    prompt = f"""
    Below is the chat history:
    {history_str}
    
    User message: {message}
    
    Please provide your compliance guidance reply:
    """
    
    try:
        return call_gemini(prompt, system_instruction, json_format=False)
    except Exception as e:
        return f"I'm sorry, I encountered an issue consulting the compliance model: {str(e)}"
