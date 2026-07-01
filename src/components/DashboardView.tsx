import React, { useEffect, useState, useRef } from "react";
import { 
  FileText, Upload, Trash2, AlertTriangle, CheckCircle, HelpCircle, 
  Search, ShieldCheck, FileSpreadsheet, Play, Sparkles, TrendingUp 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { DashboardMetrics, Document } from "../types";
import InteractiveStory from "./InteractiveStory";

interface DashboardViewProps {
  documents: Document[];
  onUploadSuccess: (docType: string, result: any) => void;
  onSelectDocument: (doc: Document) => void;
  onDeleteDocument: (id: string) => void;
  onNavigate?: (tab: "desk" | "sop" | "apqr" | "roi") => void;
}

export default function DashboardView({ 
  documents, 
  onUploadSuccess, 
  onSelectDocument, 
  onDeleteDocument,
  onNavigate
}: DashboardViewProps) {
  const [docType, setDocType] = useState<string>("Review");
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDashboardMetrics = async () => {
    try {
      const response = await fetch("/api/dashboard/metrics");
      if (response.ok) {
        setDashboardMetrics(await response.json());
      }
    } catch (err) {
      console.error("Error fetching dashboard metrics:", err);
    }
  };

  useEffect(() => {
    fetchDashboardMetrics();
  }, [documents]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await uploadFile(e.target.files[0]);
    }
  };

  const uploadFile = async (file: File, overrideDocType?: string) => {
    setIsUploading(true);
    const activeType = overrideDocType || docType;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("doc_type", activeType);

    try {
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("File upload failed");
      }

      const result = await response.json();
      onUploadSuccess(activeType, result);
      fetchDashboardMetrics();
    } catch (err) {
      console.error("Error uploading document:", err);
      alert("Error parsing document. Please check backend connection and API key.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleLoadDemoDocument = async (type: "Review" | "SOP" | "APQR") => {
    let filename = "";
    let content = "";
    if (type === "Review") {
      filename = "Acetaminophen_Batch_94812_Manufacturing_Record.txt";
      content = `BENEPHI LABS INC. - MANUFACTURING BATCH RECORD
Product: Acetaminophen 500mg Tablets
Batch Number: AL-94812
Date: June 15, 2026
Operator: J. Carter

[CRITICAL PROCESS PARAMETERS & OBSERVATIONS]
1. Blending Stage: Blended for 20 minutes at 45 RPM. Approved by Supervisor.
2. Compression Stage: Target thickness: 4.2mm. Dynamic range checked: 4.15mm - 4.25mm.
3. IN-PROCESS DEVIATION DETECTED:
At 14:32 during compression, machine temperature sensor T-02 spiked to 54°C (Limit: 45°C) for 8 minutes due to cooling line blockage.
Action: Blockage cleared, sensor cooled down. No manual investigation or OOS report was registered in log book.
4. Final Yield: 98,420 tablets (98.42% theoretical yield).

[CFR CONTROLS]
Electronic signature authorization: Operator J. Carter (Pin: 8492)`;
    } else if (type === "SOP") {
      filename = "SOP-PRO-402_Ribbon_Blender_Cleaning_Procedure.txt";
      content = `SOP NUMBER: SOP-PRO-402
TITLE: Cleaning and Sanitation of Ribbon Blender RB-102
DEPARTMENT: Production Operations
VERSION: 1.0
EFFECTIVE DATE: 2026-06-30

1.0 PURPOSE
To establish the exact sequence for disassembly, washing, and sanitization of the Ribbon Blender to prevent batch cross-contamination.

2.0 RESPONSIBILITY
Production Operators are responsible for washing, QA Inspectors are responsible for swab sampling, and QA Supervisors sign off on the clean tag.

3.0 PROCEDURE STEPS
- Ensure power is locked out / tagged out (LOTO).
- Disassemble the outer shaft seals and remove blending blades.
- Wash blade surfaces with hot purified water (60°C) and 2% Alconox detergent solution.
- Critical deviation check: Ensure rinse water conductivity is below 1.3 uS/cm.
- Spray contact areas with 70% Isopropyl Alcohol (IPA) and allow to air dry.
- Note: QA Inspector forgot to take swab sample for Batch 94812 due to schedule conflicts, tag applied anyway.`;
    } else {
      filename = "APQR_2025_Acetaminophen_Annual_Quality_Review.txt";
      content = `ANNUAL PRODUCT QUALITY REVIEW (APQR) - YEAR 2025
PRODUCT: Acetaminophen 500mg Coated Tablets
SITE: Manufacturing Block B, Line 3

1.0 BATCH PRODUCTION SUMMARY
Total batches manufactured: 42. Approved batches: 40. Rejected batches: 2.
Avg Batch Yield: 97.4%. Standard deviation: 1.8%.

2.0 DEVIATIONS AND OUT-OF-SPECIFICATION (OOS) LOGS
- Deviation DV-2025-081: Heat excursion on compression machine during Batch 94812. Closed with CAPA-112.
- OOS Analytical Deviation: Batch 94825 QC dissolution assay was 82.5% (Limit: >= 85.0%). Re-tested and approved without identifying root cause.

3.0 STABILITY AND ANALYTICAL STUDIES
Long-term stability studies at 25°C/60% RH show no significant degradation after 12 months.
Accelerated stability studies at 40°C/75% RH for Batch 94812 showed a sudden drop in active ingredient concentration to 93.4% at Month 6.`;
    }

    const file = new File([content], filename, { type: "text/plain" });
    setDocType(type);
    await uploadFile(file, type);
  };

  const filteredDocs = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Approved":
        return <span className="px-2 py-1 text-xs font-semibold badge-pass rounded-full">Approved</span>;
      case "Rejected":
        return <span className="px-2 py-1 text-xs font-semibold badge-fail rounded-full">Rejected</span>;
      case "Under_Review":
        return <span className="px-2 py-1 text-xs font-semibold badge-warning rounded-full animate-pulse">Under Review</span>;
      default:
        return <span className="px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200 rounded-full">{status}</span>;
    }
  };

  const getDocIcon = (type: string) => {
    switch (type) {
      case "SOP":
        return <FileText className="h-5 w-5 text-indigo-500" />;
      case "APQR":
        return <FileSpreadsheet className="h-5 w-5 text-emerald-500" />;
      case "BatchRecord":
      case "MBR":
      case "EBR":
        return <ShieldCheck className="h-5 w-5 text-blue-500" />;
      default:
        return <FileText className="h-5 w-5 text-slate-500" />;
    }
  };

  const complianceScore = dashboardMetrics?.compliance_index.score ?? 0;
  const complianceLabel = dashboardMetrics?.compliance_index.label ?? "No Scans";
  const scannedCount = dashboardMetrics?.compliance_index.documents_scanned ?? 0;
  const scoreDashOffset = 301.6 - (301.6 * Math.max(0, Math.min(complianceScore, 100))) / 100;
  const scoreColor =
    complianceScore >= 90 ? "text-emerald-500" :
    complianceScore >= 75 ? "text-amber-500" :
    complianceScore > 0 ? "text-rose-500" :
    "text-slate-300";
  const auditState =
    complianceScore >= 90 ? "Audit Ready State" :
    complianceScore >= 75 ? "Review Watchlist" :
    complianceScore > 0 ? "Remediation Required" :
    "No Scans Yet";
  const feedItems = dashboardMetrics?.site_compliance_feed ?? [];
  const yieldValues = dashboardMetrics?.trend_analysis.yield_values ?? [];
  const targetValue = dashboardMetrics?.trend_analysis.target;
  const stabilityDelta = dashboardMetrics?.trend_analysis.stability_delta;
  const oosRate = dashboardMetrics?.trend_analysis.oos_rate ?? 0;
  const auditsDue = dashboardMetrics?.trend_analysis.audits_due ?? documents.filter(doc => doc.status === "Draft" || doc.status === "Under_Review").length;

  const getFeedTone = (severity: string) => {
    switch (severity) {
      case "High":
        return { card: "bg-rose-50/60 border-rose-150", rail: "bg-rose-500" };
      case "Medium":
        return { card: "bg-amber-50/60 border-amber-150", rail: "bg-amber-500" };
      default:
        return { card: "bg-slate-50 border-slate-150", rail: "bg-slate-400" };
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Section */}
      <div className="pb-2">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          Compliance & Document Control Desk
        </h1>
        <p className="text-slate-500 text-sm">
          A centralized, audit-ready cockpit for real-time document compliance checking, automated GxP audits, and 21 CFR Part 11 electronic records.
        </p>
      </div>

      {/* Interactive Storyteller */}
      {onNavigate && (
        <InteractiveStory 
          onSelectSOP={() => onNavigate("sop")}
          onSelectAPQR={() => onNavigate("apqr")}
          onSelectDesk={() => onNavigate("desk")}
        />
      )}

      {/* Main Bento Grid Container */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
        
        {/* CARD 1: Upload & AI Input (col-span-8) */}
        <div className="md:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between relative overflow-hidden group hover:border-slate-300 transition-all min-h-[250px]">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Upload className="w-32 h-32 text-slate-800" />
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">New Documentation Task</h2>
              <span className="text-[10px] bg-blue-50 border border-blue-100 text-blue-700 font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                Automated Parsing
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4 max-w-xl">
              Drag and drop batch records, LIMS analytical exports, or raw manufacturing documents. Our AI compiler extracts critical parameters and checks for regulatory compliance gaps.
            </p>

            {/* Class option toggles */}
            <div className="mb-4">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Document Compliance Class
              </label>
              <div className="flex flex-wrap gap-2">
                {["Review", "SOP", "APQR"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setDocType(type)}
                    className={`py-1.5 px-3 text-xs font-semibold rounded-lg border transition-all ${
                      docType === type
                        ? "bg-blue-50 text-blue-700 border-blue-200 shadow-2xs font-bold"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {type === "Review" ? "Batch Record" : type === "SOP" ? "SOP Draft" : "APQR Summary"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Drag and drop / file input zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
              isDragging
                ? "border-blue-500 bg-blue-50/50"
                : "border-slate-250 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".txt,.csv,.json,.pdf,.png,.jpg,.jpeg,.doc,.docx"
            />
            
            {isUploading ? (
              <div className="space-y-2">
                <div className="h-7 w-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs font-bold text-slate-700">Extracting data & reviewing compliance...</p>
                <p className="text-[10px] text-slate-400 font-mono">Comparing with FDA 21 CFR Part 211</p>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-3.5 justify-center">
                <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-3xs text-blue-600">
                  <Upload className="h-5 w-5 animate-pulse" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-slate-800">
                    <span className="text-blue-600 font-bold hover:underline">Click to upload file</span> or drag & drop here
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">Supports TXT, CSV, raw compliance reports & images</p>
                </div>
              </div>
            )}
          </div>

          {/* Quick Demo Templates */}
          <div className="mt-4 pt-4 border-t border-slate-150 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
            <div>
              <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider block">Testing GxPilot?</span>
              <p className="text-[11px] text-slate-500 font-medium">Inject a template to test our 21 CFR compliance auditing instantly:</p>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLoadDemoDocument("Review");
                }}
                disabled={isUploading}
                className="px-3 py-1.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-250 hover:border-blue-200 rounded-xl text-[11px] font-bold transition-all text-slate-600 cursor-pointer flex items-center gap-1 shadow-3xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                📄 Batch Record
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLoadDemoDocument("SOP");
                }}
                disabled={isUploading}
                className="px-3 py-1.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-250 hover:border-blue-200 rounded-xl text-[11px] font-bold transition-all text-slate-600 cursor-pointer flex items-center gap-1 shadow-3xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                📝 Clean SOP
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLoadDemoDocument("APQR");
                }}
                disabled={isUploading}
                className="px-3 py-1.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-250 hover:border-blue-200 rounded-xl text-[11px] font-bold transition-all text-slate-600 cursor-pointer flex items-center gap-1 shadow-3xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                📊 APQR Log
              </button>
            </div>
          </div>
        </div>

        {/* CARD 2: Compliance Score Widget (col-span-4) */}
        <div className="md:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col items-center justify-center text-center">
          <div className="relative w-28 h-28 mb-3 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="56"
                cy="56"
                r="48"
                stroke="currentColor"
                strokeWidth="7"
                fill="transparent"
                className="text-slate-100"
              />
              <circle
                cx="56"
                cy="56"
                r="48"
                stroke="currentColor"
                strokeWidth="7"
                fill="transparent"
                strokeDasharray="301.6"
                strokeDashoffset={scoreDashOffset}
                className={`${scoreColor} transition-all duration-1000`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-slate-800 tracking-tight">{complianceScore.toFixed(1)}%</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Score</span>
            </div>
          </div>
          <h3 className="font-bold text-slate-800 text-sm tracking-tight">Regulatory Compliance Index</h3>
          <p className="text-[11px] text-slate-500 mt-1 max-w-[200px] leading-relaxed">
            Overall site quality index is standing at <strong className="text-emerald-600 font-bold">{complianceLabel}</strong> based on {scannedCount} saved compliance scan{scannedCount === 1 ? "" : "s"}.
          </p>
          <div className="mt-3.5 py-1 px-2.5 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            {auditState}
          </div>
        </div>

        {/* CARD 3: ROI Tracking (col-span-4) */}
        <div className="md:col-span-4 bg-slate-900 text-white rounded-2xl p-5 flex items-center justify-between shadow-md relative overflow-hidden group">
          <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 p-4 opacity-5 pointer-events-none">
            <Sparkles className="w-24 h-24 text-white" />
          </div>
          <div>
            <div className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-1.5">Quality Efficiency</div>
            <div className="text-3xl font-black tracking-tight text-white">{(dashboardMetrics?.quality_efficiency.hours_saved ?? 0).toFixed(1)} hrs</div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono">Overhead saved from logged tasks</div>
          </div>
          <div className="p-3 bg-white/10 rounded-xl border border-white/10 text-blue-400 group-hover:scale-110 transition-transform">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        {/* CARD 4: Anomaly Feed (col-span-8 or col-span-5 depending on arrangement) */}
        <div className="md:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden justify-between">
          <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Site Compliance Feed</h3>
            <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase">
              Action Required
            </span>
          </div>
          
          <div className="flex-1 p-4 space-y-2.5 max-h-[220px] overflow-y-auto">
            {feedItems.length === 0 ? (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                No active compliance anomalies from saved scans.
              </div>
            ) : (
              feedItems.map((item, idx) => {
                const tone = getFeedTone(item.severity);
                return (
                  <div key={`${item.document_id}-${idx}`} className={`p-3 border rounded-xl flex gap-3 text-xs ${tone.card}`}>
                    <div className={`w-1 rounded-full shrink-0 ${tone.rail}`}></div>
                    <div>
                      <div className="font-bold text-slate-800">{item.type}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 font-mono">{item.message}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
            <span className="text-blue-600 text-xs font-bold hover:underline cursor-pointer flex items-center justify-center gap-1">
              GxP Validation Engine Status: Active
            </span>
          </div>
        </div>

        {/* CARD 5: APQR Trend Chart (col-span-4) */}
        <div className="md:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between min-h-[250px]">
          <div>
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Trend Analysis</h3>
                <p className="text-[10px] text-slate-500 italic uppercase">Batch Yield Q3 vs Forecast</p>
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  <span className="text-[8px] font-bold text-slate-400 uppercase">Yield</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                  <span className="text-[8px] font-bold text-slate-400 uppercase">Target</span>
                </div>
              </div>
            </div>

            <div className="h-24 flex items-end gap-2.5 px-1 border-b border-slate-100 pb-2">
              {yieldValues.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-[11px] text-slate-400 font-semibold">
                  No yield data parsed yet
                </div>
              ) : (
                yieldValues.map((val, idx) => (
                  <div key={idx} className="flex-1 bg-slate-100 rounded-t-sm relative h-full group cursor-pointer">
                    {targetValue !== null && (
                      <div
                        className="absolute w-full border-t border-dashed border-emerald-400/70 z-10"
                        style={{ bottom: `${Math.max(0, Math.min(targetValue, 100))}%` }}
                      ></div>
                    )}
                    <div 
                      className="absolute bottom-0 w-full bg-blue-600 hover:bg-blue-700 rounded-t-sm transition-all" 
                      style={{ height: `${Math.max(2, Math.min(val, 100))}%` }}
                      title={`Batch Yield: ${val}%`}
                    >
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-[8px] font-mono py-0.5 px-1 rounded shadow-xs transition-opacity z-20">
                        {val}%
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center pt-3 mt-1">
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Stability</div>
              <div className={`text-xs font-black mt-0.5 ${stabilityDelta === null ? "text-slate-400" : stabilityDelta >= 0 ? "text-emerald-600" : "text-amber-600"}`}>
                {stabilityDelta === null ? "N/A" : `${stabilityDelta > 0 ? "+" : ""}${stabilityDelta}%`}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">OOS Rate</div>
              <div className="text-xs font-black text-slate-800 mt-0.5">{oosRate}%</div>
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Audits Due</div>
              <div className="text-xs font-black text-blue-600 mt-0.5">{auditsDue}</div>
            </div>
          </div>
        </div>

        {/* CARD 6: GxP Document Bank - Filtered List (col-span-12) */}
        <div className="md:col-span-12 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          {/* List Search Header */}
          <div className="p-4 bg-slate-50/60 border-b border-slate-200 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-900 text-sm tracking-tight uppercase">
                GxP Document Control Bank
              </h3>
              <span className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-800 text-[10px] font-bold font-mono rounded">
                FDA 21 CFR §211
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by name, class, status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-48 pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                {filteredDocs.length} items cataloged
              </span>
            </div>
          </div>

          {/* List Entries */}
          <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
            <AnimatePresence>
              {filteredDocs.length === 0 ? (
                <div className="p-10 text-center text-slate-400 flex flex-col items-center justify-center">
                  <FileText className="h-10 w-10 stroke-1 text-slate-300 mb-2" />
                  <p className="text-xs font-medium">No files registered in GxP repository</p>
                  <p className="text-[10px] text-slate-400 mt-1">Upload a Batch Record or draft an SOP/APQR to start.</p>
                </div>
              ) : (
                filteredDocs.map((doc, idx) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: Math.min(idx * 0.04, 0.25) }}
                    className="p-4 hover:bg-slate-50/80 transition-all flex items-center justify-between gap-4 cursor-pointer border-l-3 border-transparent hover:border-blue-600"
                    onClick={() => onSelectDocument(doc)}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="p-2 bg-slate-100 rounded-lg border border-slate-200 flex-shrink-0">
                        {getDocIcon(doc.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-slate-800 hover:text-blue-600 transition-colors truncate">
                          {doc.name}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] text-slate-500 font-mono">
                          <span className="font-extrabold px-1.5 py-0.5 bg-slate-150/60 rounded text-slate-700 uppercase tracking-wider text-[9px]">
                            {doc.type}
                          </span>
                          <span>Size: {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : "N/A"}</span>
                          <span>•</span>
                          <span>Stamper: {new Date(doc.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      {getStatusBadge(doc.status)}
                      
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Irreversibly delete document "${doc.name}" from compliance records?`)) {
                            onDeleteDocument(doc.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        title="Delete record"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>
    </div>
  );
}
