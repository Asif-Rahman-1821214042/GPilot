import React, { useState } from "react";
import { FileSpreadsheet, Sparkles, CheckCircle2, Copy } from "lucide-react";
import NicePdfPreview from "./NicePdfPreview";

interface APQRCompilerProps {
  onDraftGenerated: () => void;
}

export default function APQRCompiler({ onDraftGenerated }: APQRCompilerProps) {
  const [batchSummary, setBatchSummary] = useState(
    "Product: Acetaminophen 500mg Tablets.\nTotal Batches Manufactured: 140\nYield Average: 99.1% (Standard range: 97%-101%)\nBatches Rejected: 0"
  );
  const [deviations, setDeviations] = useState(
    "Minor Deviations logged: 3 (DEV-2025-012: line clearance form correction, DEV-2025-045: balance printer paper replacement, DEV-2025-110: brief room differential pressure excursion). All were investigated, QA-approved, closed on time, and assessed as no product impact.\nCritical Deviations: 0.\nOut-of-Specification (OOS) Results: 0.\nOut-of-Trend (OOT) Results: 0."
  );
  const [stability, setStability] = useState(
    "Stability trials on batch ACT-25001 at 25C/60%RH time points (0M, 3M, 6M, 12M):\nAssay values: 0M = 100.2%, 3M = 99.8%, 6M = 99.5%, 12M = 99.1%.\nAll purity parameters remain well within GxP threshold limits."
  );
  const [qualitySystemData, setQualitySystemData] = useState(
    "Review Period: January 1, 2025 to December 31, 2025.\nSite / Line: Solid Dose Manufacturing Line 2.\nChange Controls: 2 minor approved changes (packaging artwork update and preventive maintenance interval update), both QA-approved with no product quality impact.\nComplaints: 0 confirmed product quality complaints. Returns: 0 quality-related returns. Recalls: 0.\nRegulatory Commitments: No open regulatory commitments for this product.\nProcess Validation / Continued Process Verification: Process remains validated; annual CPV review completed with no adverse trend.\nProcess Capability / SPC: Assay Cpk 1.68, dissolution Cpk 1.59, tablet weight Ppk 1.44; all control charts remained within alert/action limits.\nAnalytical Method Performance: Assay and dissolution methods remain validated; system suitability pass rate 100%; no method-related deviations.\nSupplier / Material Quality: No critical supplier deviations; incoming API and excipient lots met approved specifications.\nCleaning Validation: Current and effective; no cleaning failures reported.\nPrevious APQR Action Follow-Up: 2024 APQR action APQR-2024-01 closed; effectiveness verified by QA with no recurrence."
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [draftResult, setDraftResult] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (draftResult?.content) {
      navigator.clipboard.writeText(draftResult.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFillDemo = () => {
    setBatchSummary(
      "Product: Ibuprofen 400mg Tablets.\nReview Period: January 1, 2025 to December 31, 2025.\nTotal Batches Manufactured: 215\nBatches Approved: 215\nBatches Rejected: 0\nYield Average: 98.7% (Target: 98.0%-101.0%)\nTheoretical yield range observed: 98.1% - 100.4%."
    );
    setDeviations(
      "Minor Deviations logged: 3.\nDEV-2025-012: Line clearance form correction; root cause was documentation sequencing; QA assessed no product impact and closed on time.\nDEV-2025-045: Balance printer paper replacement during compression; root cause was consumable depletion; no data loss and no product impact.\nDEV-2025-110: Brief room differential pressure excursion; engineering confirmed HVAC recovery within alert limit; no contamination risk.\nMajor Deviations: 0.\nCritical Deviations: 0.\nOOS Results: 0.\nOOT Results: 0.\nCAPA: CAPA-2025-008 preventive checklist simplification; effectiveness check completed with no recurrence."
    );
    setStability(
      "Stability studies conducted at long-term 25°C/60% RH and accelerated 40°C/75% RH conditions.\nRepresentative batch IBU-25004 assay values: 0M: 100.1%, 3M: 99.7%, 6M: 99.2%, 12M: 98.8%.\nImpurities, dissolution, and assay remained within approved specifications. No adverse stability trend identified."
    );
    setQualitySystemData(
      "Review Period: January 1, 2025 to December 31, 2025.\nSite / Line: Solid Dose Manufacturing Line 2.\nChange Controls: 3 QA-approved minor changes; all impact assessments completed and no validation impact identified.\nComplaints: 1 non-critical packaging scuff complaint; investigation closed as handling-related with no product quality impact. Returns: 0 quality-related returns. Recalls: 0.\nRegulatory Commitments: No open regulatory commitments for this product.\nProcess Validation / Continued Process Verification: Process remains validated; CPV review completed and critical process parameters remained within approved limits.\nProcess Capability / SPC: Assay Cpk 1.72, dissolution Cpk 1.61, tablet weight Ppk 1.48; all control charts remained within alert/action limits.\nAnalytical Method Performance: Assay, dissolution, and impurity methods remain validated; system suitability pass rate 100%; no method-related deviations.\nSupplier / Material Quality: No critical supplier deviations; incoming API and excipient lots met approved specifications.\nCleaning Validation: Current and effective; no cleaning failures or cross-contamination events.\nPrevious APQR Action Follow-Up: 2024 APQR action APQR-2024-01 closed; effectiveness verified by QA with no recurrence."
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchSummary || !deviations || !stability || !qualitySystemData) {
      alert("Please fill in APQR details.");
      return;
    }

    setIsGenerating(true);
    setDraftResult(null);

    try {
      const response = await fetch("/api/documents/draft-apqr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch_summary: batchSummary,
          deviations,
          stability,
          quality_system_data: qualitySystemData
        })
      });

      if (!response.ok) {
        throw new Error("APQR Compilation failed");
      }

      const result = await response.json();
      setDraftResult(result);
      onDraftGenerated(); // Refresh files list
    } catch (err) {
      console.error(err);
      alert("Error generating APQR. Check backend API key configuration.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-2">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-blue-600" />
          APQR Auto-Compiler
        </h1>
        <p className="text-slate-500 text-sm">
          Compile cross-departmental batch yields, deviations, and QC stability streams into compliance-ready Annual Product Quality Reviews.
        </p>
      </div>

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Form Inputs */}
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider">Compile inputs</span>
            <button
              type="button"
              onClick={handleFillDemo}
              className="px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1 shadow-3xs"
            >
              ✨ Load APQR Demo Template
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Batch Production Summary</label>
              <textarea
                rows={4}
                value={batchSummary}
                onChange={(e) => setBatchSummary(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs border border-slate-250 rounded-lg focus:outline-none focus:border-blue-500 font-mono bg-slate-50/50 leading-relaxed"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Deviations & Out-Of-Specification (OOS) Logs</label>
              <textarea
                rows={4}
                value={deviations}
                onChange={(e) => setDeviations(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs border border-slate-250 rounded-lg focus:outline-none focus:border-blue-500 font-mono bg-slate-50/50 leading-relaxed"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Stability & Analytical Studies</label>
              <textarea
                rows={4}
                value={stability}
                onChange={(e) => setStability(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs border border-slate-250 rounded-lg focus:outline-none focus:border-blue-500 font-mono bg-slate-50/50 leading-relaxed"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Quality System, Validation & Market Events</label>
              <textarea
                rows={6}
                value={qualitySystemData}
                onChange={(e) => setQualitySystemData(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs border border-slate-250 rounded-lg focus:outline-none focus:border-blue-500 font-mono bg-slate-50/50 leading-relaxed"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isGenerating}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-blue-100"
            >
              {isGenerating ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Compiling APQR Streams...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Compile Annual Product Quality Review</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Preview Output */}
        <div className="min-h-[300px]">
          {isGenerating ? (
            <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 border border-slate-800 shadow-md h-[400px] flex flex-col items-center justify-center space-y-4">
              <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-center">
                <p className="font-bold text-slate-300">Aggregating stability and manufacturing logs...</p>
                <p className="text-[10px] text-slate-500 mt-1">Structuring report in compliance with EU GMP Annex 15</p>
              </div>
            </div>
          ) : draftResult ? (
            <div className="space-y-4">
              <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-200 flex items-center gap-2.5 text-blue-800">
                <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <div className="text-[11px] leading-relaxed">
                  APQR compiled successfully as <span className="font-semibold">{draftResult.name}</span>. GxPilot verified stable assay margins.
                </div>
              </div>
              
              <NicePdfPreview 
                title="Annual Product Quality Review"
                docType="APQR"
                status="Draft"
                content={draftResult.content}
                documentId={draftResult.id}
              />

            </div>
          ) : (
            <div className="bg-slate-50 text-slate-500 rounded-2xl p-8 border border-dashed border-slate-300 shadow-3xs text-center py-10 flex flex-col items-center justify-center">
              <FileSpreadsheet className="h-10 w-10 stroke-1 text-slate-400 mb-2" />
              <p className="text-xs font-bold text-slate-700">No report compiled yet</p>
              <p className="text-[11px] text-slate-400 mt-1">Complete product dataset and hit 'Compile APQR' to generate the Annual Report.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
