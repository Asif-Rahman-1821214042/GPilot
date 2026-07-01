import React, { useState } from "react";
import { FileText, Sparkles, AlertTriangle, ArrowRight, CheckCircle2, Copy } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import NicePdfPreview from "./NicePdfPreview";

interface SOPPreparerProps {
  onDraftGenerated: () => void;
}

export default function SOPPreparer({ onDraftGenerated }: SOPPreparerProps) {
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState("");
  const [roles, setRoles] = useState("");
  const [regulations, setRegulations] = useState<string[]>(["21 CFR Part 211"]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [draftResult, setDraftResult] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleRegulation = (reg: string) => {
    if (regulations.includes(reg)) {
      setRegulations(regulations.filter(r => r !== reg));
    } else {
      setRegulations([...regulations, reg]);
    }
  };

  const handleCopy = () => {
    if (draftResult?.content) {
      navigator.clipboard.writeText(draftResult.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFillDemo = () => {
    setTitle("Operation, Disassembly, and Cleaning of Ribbon Blender RB-102");
    setRoles("Production Operator, QC Inspector, Production Supervisor");
    setSteps(`1. Verify blender is tagged 'Clean' and power isolation LOTO is verified.
2. Load dry Acetaminophen powder and lactose binders through intake port.
3. Secure safety lid interlock sensor. Blend at 45 RPM for exactly 20 minutes.
4. Record product yield and tag blender as 'To Be Cleaned' before final QA discharge.`);
    setRegulations(["21 CFR Part 211", "EU GMP Annex 15"]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !steps || !roles) {
      alert("Please fill in all standard details.");
      return;
    }

    setIsGenerating(true);
    setDraftResult(null);

    try {
      const response = await fetch("/api/documents/draft-sop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          steps,
          roles,
          regulations
        })
      });

      if (!response.ok) {
        throw new Error("SOP Drafting failed");
      }

      const result = await response.json();
      setDraftResult(result);
      onDraftGenerated(); // Refresh files list
    } catch (err) {
      console.error(err);
      alert("Error compiling draft. Ensure backend is running and Gemini API key is configured.");
    } finally {
      setIsGenerating(false);
    }
  };

  const availableRegulations = [
    "21 CFR Part 211 (cGMP Fin. Pharm)",
    "21 CFR Part 11 (Elec Records/Signatures)",
    "EU GMP Annex 1 (Sterile Prep)",
    "EU GMP Annex 11 (Computer Systems)",
    "ICH Q7 (cGMP Active Substances)",
    "ICH Q10 (Pharm Quality System)"
  ];

  return (
    <div className="space-y-6">
      <div className="pb-2">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <FileText className="h-6 w-6 text-blue-600" />
          SOP Auto-Drafting Engine
        </h1>
        <p className="text-slate-500 text-sm">
          Generate production-ready pharmaceutical Standard Operating Procedures matching regulatory clauses automatically.
        </p>
      </div>

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Left Hand Form */}
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider">Draft details</span>
            <button
              type="button"
              onClick={handleFillDemo}
              className="px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1 shadow-3xs"
            >
              ✨ Load SOP Demo Template
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">SOP Title</label>
              <input
                type="text"
                placeholder="e.g., Operation and Cleaning of Ribbon Blender"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-250 rounded-lg focus:outline-none focus:border-blue-500 bg-slate-50/50 font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Responsible Roles</label>
              <input
                type="text"
                placeholder="e.g., Production Operator, QC Inspector, QA Specialist"
                value={roles}
                onChange={(e) => setRoles(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-250 rounded-lg focus:outline-none focus:border-blue-500 bg-slate-50/50 font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Procedure Steps</label>
              <textarea
                rows={5}
                placeholder="Provide details about the procedure: e.g., 
1. Operators verify machine logs and tag as clean.
2. Fill ribbon blender with specified quantities of Acetaminophen active powder.
3. Blend at 45 RPM for 20 minutes.
4. QA supervisor signs off before discharge."
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs border border-slate-250 rounded-lg focus:outline-none focus:border-blue-500 font-mono leading-relaxed bg-slate-50/50"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Reference Regulations</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableRegulations.map((reg) => (
                  <label 
                    key={reg} 
                    className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-[11px] font-semibold cursor-pointer transition-all ${
                      regulations.includes(reg) 
                        ? "bg-blue-50 border-blue-200 text-blue-700 font-bold shadow-3xs" 
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={regulations.includes(reg)}
                      onChange={() => toggleRegulation(reg)}
                      className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 hidden"
                    />
                    <span>{reg}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isGenerating}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-blue-100"
            >
              {isGenerating ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Drafting GxP Document...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Generate SOP Draft</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Hand Output Preview */}
        <div className="min-h-[300px]">
          {isGenerating ? (
            <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 border border-slate-800 shadow-md h-[400px] flex flex-col items-center justify-center space-y-4">
              <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-center">
                <p className="font-bold text-slate-300">Aligning with GxP clauses...</p>
                <p className="text-[10px] text-slate-500 mt-1">Applying 21 CFR 211 regulatory structure</p>
              </div>
            </div>
          ) : draftResult ? (
            <div className="space-y-4">
              <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-200 flex items-center gap-2.5 text-blue-800">
                <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <div className="text-[11px] leading-relaxed">
                  Draft successfully compiled as <span className="font-semibold">{draftResult.name}</span>. Go to the Compliance Desk to add e-signatures and release the document.
                </div>
              </div>

              <NicePdfPreview 
                title={title || "Standard Operating Procedure"}
                docType="SOP"
                status="Draft"
                content={draftResult.content}
                documentId={draftResult.id}
              />

            </div>
          ) : (
            <div className="bg-slate-50 text-slate-500 rounded-2xl p-8 border border-dashed border-slate-300 shadow-3xs text-center py-10 flex flex-col items-center justify-center">
              <FileText className="h-10 w-10 stroke-1 text-slate-400 mb-2" />
              <p className="text-xs font-bold text-slate-700">No SOP drafted yet</p>
              <p className="text-[11px] text-slate-400 mt-1">Complete the operational details above and hit 'Generate SOP Draft' to compile document.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
