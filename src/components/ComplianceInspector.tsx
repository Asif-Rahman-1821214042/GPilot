import React, { useCallback, useEffect, useRef, useState } from "react";
import { 
  X, CheckSquare, AlertTriangle, Play, HelpCircle, 
  ArrowLeft, FileText, CheckCircle2, History, UserCheck, 
  Lock, Sparkles, ClipboardList, RefreshCw, Pencil
} from "lucide-react";
import { Document } from "../types";
import { ComplianceCheck } from "../types";
import NicePdfPreview from "./NicePdfPreview";
import SectionWiseDocumentEditor from "./SectionWiseDocumentEditor";

interface ComplianceInspectorProps {
  document: Document;
  onBack: () => void;
  onActionComplete: () => void;
}

export default function ComplianceInspector({ 
  document: initialDoc, 
  onBack, 
  onActionComplete 
}: ComplianceInspectorProps) {
  const [currentDoc, setCurrentDoc] = useState(initialDoc);
  const [reviewerName, setReviewerName] = useState("");
  const [signaturePin, setSignaturePin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [liveEditedContent, setLiveEditedContent] = useState(initialDoc.content || "");
  const [editGuidanceCheck, setEditGuidanceCheck] = useState<ComplianceCheck | null>(null);
  const requestedScanForRef = useRef<string | null>(null);

  useEffect(() => {
    setCurrentDoc(initialDoc);
    setIsEditingContent(false);
    setLiveEditedContent(initialDoc.content || "");
    setEditGuidanceCheck(null);
    requestedScanForRef.current = null;
  }, [initialDoc]);

  useEffect(() => {
    if (isEditingContent) return;
    if (currentDoc.compliance_check || isScanning) return;
    if (requestedScanForRef.current === currentDoc.id) return;

    const runMissingScan = async () => {
      requestedScanForRef.current = currentDoc.id;
      setIsScanning(true);
      setScanError(null);
      try {
        const response = await fetch(`/api/documents/${currentDoc.id}/scan`, {
          method: "POST"
        });
        if (!response.ok) {
          throw new Error("Compliance scan failed");
        }
        const result = await response.json();
        setCurrentDoc(prev => ({
          ...prev,
          status: result.status || prev.status,
          compliance_check: result.compliance_check,
        }));
        onActionComplete();
      } catch (err) {
        console.error(err);
        setScanError("Compliance report could not be generated. Please check backend and AI configuration.");
      } finally {
        setIsScanning(false);
      }
    };

    runMissingScan();
  }, [currentDoc.id, currentDoc.compliance_check, isEditingContent, isScanning, onActionComplete]);

  const finalizeEditedContent = useCallback(async (content: string) => {
    requestedScanForRef.current = currentDoc.id;
    setIsScanning(true);
    setScanError(null);

    try {
      const response = await fetch(`/api/documents/${currentDoc.id}/scan`, {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("Compliance scan failed");
      }

      const result = await response.json();
      setCurrentDoc((prev) => ({
        ...prev,
        content,
        status: result.status || (prev.status === "Approved" || prev.status === "Rejected" ? prev.status : "Under_Review"),
        compliance_check: result.compliance_check,
      }));
      setLiveEditedContent(content);
      setIsEditingContent(false);
      setEditGuidanceCheck(null);
      onActionComplete();
    } catch (err) {
      console.error(err);
      setCurrentDoc((prev) => ({
        ...prev,
        content,
        compliance_check: null,
        status: prev.status === "Approved" || prev.status === "Rejected" ? prev.status : "Draft",
      }));
      setLiveEditedContent(content);
      setScanError("Updated document was saved, but the new compliance report could not be generated.");
      alert("Updated document was saved, but the new compliance report could not be generated. Please check backend and AI configuration.");
    } finally {
      setIsScanning(false);
    }
  }, [currentDoc.id, onActionComplete]);

  const handleAction = async (action: "Approve" | "Reject") => {
    if (!reviewerName || !signaturePin) {
      alert("Reviewer Name and 21 CFR Part 11 Signature PIN are required for compliant electronic signoff.");
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("action", action);
    formData.append("reviewer_name", reviewerName);

    try {
      const response = await fetch(`/api/documents/${currentDoc.id}/action`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error("Action signature failed");
      }

      onActionComplete();
    } catch (err) {
      console.error(err);
      alert("Verification failed. Please check connection.");
    } finally {
      setIsSubmitting(false);
      setReviewerName("");
      setSignaturePin("");
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "High":
        return "bg-rose-50 border-rose-200 text-rose-800";
      case "Medium":
        return "bg-amber-50 border-amber-200 text-amber-800";
      case "Low":
        return "bg-slate-50 border-slate-200 text-slate-800";
      default:
        return "bg-slate-50 border-slate-100 text-slate-700";
    }
  };

  const doc = currentDoc;
  const chk = doc.compliance_check;
  const canEditDocument = doc.type === "SOP" || doc.type === "APQR";

  const handleLiveContentChange = useCallback((content: string) => {
    setLiveEditedContent(content);
    if (content === currentDoc.content || !currentDoc.compliance_check) return;

    setCurrentDoc((prev) => ({
      ...prev,
      compliance_check: null,
      status: prev.status === "Approved" || prev.status === "Rejected" ? prev.status : "Draft",
    }));
  }, [currentDoc.compliance_check, currentDoc.content]);

  return (
    <div className="space-y-6">
      {/* Back & Breadcrumbs */}
      <button 
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Document Desk
      </button>

      {/* Doc Header Detail */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-600">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight leading-tight">{doc.name}</h2>
            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500 font-mono">
              <span className="font-extrabold px-1.5 py-0.5 bg-slate-150/60 rounded text-slate-700 uppercase tracking-wider text-[9px]">{doc.type}</span>
              <span>•</span>
              <span>Size: {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : "0 KB"}</span>
              <span>•</span>
              <span>Status: <strong className="text-slate-800 font-bold">{doc.status}</strong></span>
            </div>
          </div>
        </div>

        {/* Big Score Radial Badge */}
        {chk && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">GxP Compliance Score</span>
              <span className="text-xs font-semibold text-slate-500">Scan status: 
                <strong className={`ml-1 font-bold ${
                  chk.status === "Approved" ? "text-emerald-600" : chk.status === "Rejected" ? "text-rose-600" : "text-amber-600"
                }`}>{chk.status}</strong>
              </span>
            </div>
            <div className={`h-16 w-16 rounded-full flex flex-col items-center justify-center border-4 ${
              chk.score >= 90 ? "border-emerald-500 bg-emerald-50 text-emerald-800 font-bold" : 
              chk.score >= 75 ? "border-amber-500 bg-amber-50 text-amber-800 font-bold" : 
              "border-rose-500 bg-rose-50 text-rose-800 font-bold"
            }`}>
              <span className="text-base font-black tracking-tight">{chk.score}%</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Columns: Analysis Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          {chk ? (
            <>
              {/* Anomalies Card */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="text-xs font-bold text-slate-900 tracking-wider uppercase mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-500 animate-pulse" />
                  GxP Anomalies & Risk Detections ({chk.anomalies.length})
                </h3>
                
                {chk.anomalies.length === 0 ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    No GxP anomalies detected. Document matches all compliance rules!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {chk.anomalies.map((anom, idx) => (
                      <div 
                        key={idx}
                        className={`p-3.5 rounded-xl border text-xs leading-relaxed flex gap-2.5 items-start ${getSeverityColor(anom.severity)}`}
                      >
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900">{anom.type}</span>
                            <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full ${
                              anom.severity === "High" ? "bg-rose-200 text-rose-800" :
                              anom.severity === "Medium" ? "bg-amber-200 text-amber-800" :
                              "bg-slate-200 text-slate-700"
                            }`}>{anom.severity}</span>
                          </div>
                          <p className="mt-1 text-slate-700 font-sans">{anom.message}</p>
                          {anom.mitigation && (
                            <div className="mt-2 rounded-lg border border-white/70 bg-white/65 px-3 py-2">
                              <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                                AI Mitigation Suggestion
                              </div>
                              <p className="mt-1 text-[11px] leading-relaxed text-slate-700 font-semibold">
                                {anom.mitigation}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Checklist & Pass/Fail Checks */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="text-xs font-bold text-slate-900 tracking-wider uppercase mb-4 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-blue-600" />
                  Automated Reviewer Checklist
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {chk.checklist.map((item, idx) => (
                    <div 
                      key={idx}
                      className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs flex items-center justify-between gap-3"
                    >
                      <span className="text-slate-700 font-sans truncate font-medium">{item.item}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.status === "PASS" ? "badge-pass" : item.status === "FAIL" ? "badge-fail" : "badge-warning"
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations Card */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="text-xs font-bold text-slate-900 tracking-wider uppercase mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  Compliance Recommendations & CAPA Actions
                </h3>
                <ul className="space-y-2.5">
                  {chk.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-xs text-slate-700 flex items-start gap-2.5 leading-relaxed">
                      <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <div className="p-10 bg-slate-50 border rounded-2xl text-center text-slate-500">
              {isScanning ? (
                <>
                  <RefreshCw className="h-8 w-8 text-blue-600 mx-auto animate-spin mb-2" />
                  <p className="text-xs font-semibold text-slate-600">Generating and saving GxP compliance report...</p>
                  <p className="text-[11px] text-slate-400 mt-1">This runs once. Future opens will load the saved report from the database.</p>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold">Compliance report is not available yet.</p>
                  <p className="text-[11px] text-slate-400 mt-1">{scanError || "GxPilot will generate and save a report for this document."}</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Part 11 Signature & Audit Trails */}
        <div className="space-y-6">
          {/* Part 11 Electronic Signature Box */}
          {doc.status !== "Approved" && doc.status !== "Rejected" && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-5">
                <Lock className="h-24 w-24 text-slate-800" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 tracking-wider uppercase mb-1 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-blue-600" />
                21 CFR Part 11 E-Signature
              </h3>
              <p className="text-slate-400 text-[10px] mb-4 leading-relaxed">
                Provide reviewer signoff. Signatures are bound to this electronic record, password-verified, and permanently stamped into the immutable audit trail.
              </p>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">QA Reviewer Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Jennifer Lawrence, QA Director"
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-250 rounded-lg focus:outline-none focus:border-blue-500 bg-slate-50/50 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">E-Signature PIN (Verified password)</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={signaturePin}
                    onChange={(e) => setSignaturePin(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-250 rounded-lg focus:outline-none focus:border-blue-500 bg-slate-50/50 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleAction("Approve")}
                    disabled={isSubmitting}
                    className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1"
                  >
                    <UserCheck className="h-3.5 w-3.5" /> Approve Release
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction("Reject")}
                    disabled={isSubmitting}
                    className="py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1"
                  >
                    <X className="h-3.5 w-3.5" /> Reject Release
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Immutable Audit Trail Box */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-xs font-bold text-slate-900 tracking-wider uppercase mb-4 flex items-center gap-2">
              <History className="h-4 w-4 text-slate-500" />
              Immutable Audit Trail
            </h3>

            <div className="relative border-l-2 border-slate-150 pl-3.5 ml-1.5 space-y-4">
              {doc.audit_trail.map((evt, idx) => (
                <div key={idx} className="relative text-[11px] leading-relaxed">
                  {/* Timeline bullet */}
                  <div className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-400 border border-white"></div>
                  
                  <div className="text-slate-400 font-mono text-[9px] mb-0.5">
                    {new Date(evt.time).toLocaleString()}
                  </div>
                  <div className="font-bold text-slate-800">{evt.event}</div>
                  <div className="text-slate-500 text-[10px] font-mono">Operator: {evt.user}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Document Content View */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <h3 className="text-xs font-bold text-slate-900 tracking-wider uppercase flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              Document PDF Preview
            </h3>
            {canEditDocument && !isEditingContent && (
              <button
                type="button"
                onClick={() => {
                  setLiveEditedContent(doc.content || "");
                  setEditGuidanceCheck(doc.compliance_check || null);
                  setIsEditingContent(true);
                }}
                className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-[10px] font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" />
                Update {doc.type} Fields
              </button>
            )}
          </div>

          {isEditingContent && canEditDocument && (
              <SectionWiseDocumentEditor
                documentId={doc.id}
              docType={doc.type}
              content={doc.content || ""}
              complianceCheck={editGuidanceCheck}
              onContentChange={handleLiveContentChange}
              onCancel={() => {
                setLiveEditedContent(doc.content || "");
                setEditGuidanceCheck(null);
                setIsEditingContent(false);
              }}
              onSaved={finalizeEditedContent}
            />
          )}

          <NicePdfPreview 
            title={doc.name}
            docType={doc.type}
            status={doc.status}
            content={(isEditingContent ? liveEditedContent : doc.content) || "[No content available]"}
            documentId={doc.id}
          />
        </div>
      </div>
    </div>
  );
}
