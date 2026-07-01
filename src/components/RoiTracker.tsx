import React, { useState, useEffect } from "react";
import { 
  PiggyBank, Timer, AlertCircle, ShieldAlert, 
  HelpCircle, CheckCircle2, TrendingUp, RefreshCw 
} from "lucide-react";
import { RoiMetricsData } from "../types";

export default function RoiTracker() {
  const [roiData, setRoiData] = useState<RoiMetricsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRoi = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/roi");
      if (response.ok) {
        const data = await response.json();
        setRoiData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoi();
  }, []);

  if (isLoading || !roiData) {
    return (
      <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-sm">
        <RefreshCw className="h-6 w-6 text-blue-600 animate-spin mx-auto mb-2" />
        <p className="text-xs font-semibold text-slate-500">Gleaning operational metrics...</p>
      </div>
    );
  }

  const sum = roiData.summary;

  const getTaskLabel = (type: string) => {
    switch (type) {
      case "SOP_Prep":
        return "SOP Preparation & Drafting";
      case "APQR_Gen":
        return "APQR Data Compilation";
      case "Batch_Review":
        return "Batch Record Verification";
      case "General_Review":
        return "General Document Compliance Check";
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-2">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-blue-600" />
          GxPilot Return-On-Investment Dashboard
        </h1>
        <p className="text-slate-500 text-sm">
          Measure tangible productivity improvements, hours saved, and quality enhancements achieved via automated AI workflows.
        </p>
      </div>

      {/* KPI stats blocks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-4 hover:border-slate-300 transition-all">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Hours Saved</span>
            <span className="text-3xl font-black text-slate-800 tracking-tight">{sum.total_hours_saved.toFixed(1)} hrs</span>
            <span className="text-[10px] text-slate-500 block">QA staff overhead reduced</span>
          </div>
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-600">
            <Timer className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-4 hover:border-slate-300 transition-all">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Est. Financial Savings</span>
            <span className="text-3xl font-black text-slate-800 tracking-tight">${sum.total_cost_saved_usd.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500 block font-mono">Assumed rate: ${sum.hourly_rate_assumption}/hr</span>
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600">
            <PiggyBank className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-4 hover:border-slate-300 transition-all">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Omission Risks Prevented</span>
            <span className="text-3xl font-black text-slate-800 tracking-tight">{sum.total_errors_prevented}</span>
            <span className="text-[10px] text-slate-500 block">Critical parameter deviations caught</span>
          </div>
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600">
            <ShieldAlert className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Intangible business results */}
        <div className="lg:col-span-1 bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md space-y-4">
          <h3 className="text-xs font-bold text-slate-300 tracking-wider uppercase">Qualitative Quality ROI</h3>
          
          <div className="space-y-4 text-xs leading-relaxed">
            <div className="flex gap-3 items-start">
              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-100 block">Audit Readiness Mode</strong>
                <p className="text-slate-400 mt-1 leading-relaxed">Continuous compliant state indexing reduces manual audit preparation time before regulatory inspects by 85%.</p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-100 block">Minimized Human Fatigue</strong>
                <p className="text-slate-400 mt-1 leading-relaxed">Automating tedious line-by-line batch verification relieves QA staff from repetitive reading tasks.</p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-100 block">Faster Cycle Release</strong>
                <p className="text-slate-400 mt-1 leading-relaxed">Accelerates batch distribution checks, preventing costly stock delays and stabilizing supply lines.</p>
              </div>
            </div>
          </div>
        </div>

        {/* History table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">GxPilot Automated Workflow History</h3>
            <button 
              onClick={fetchRoi}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 animate-pulse" /> Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-100">
              <thead className="bg-slate-50/80 text-slate-500 font-bold">
                <tr>
                  <th className="p-3.5">Assisted Task</th>
                  <th className="p-3.5">Time Saved</th>
                  <th className="p-3.5">Compliance Errors Found</th>
                  <th className="p-3.5">Cost Savings</th>
                  <th className="p-3.5">Completed Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {roiData.history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-slate-400">
                      No automated tasks recorded yet. Launch workflows to build savings track!
                    </td>
                  </tr>
                ) : (
                  roiData.history.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3.5 font-bold text-slate-800">{getTaskLabel(m.task_type)}</td>
                      <td className="p-3.5 text-slate-600 font-mono font-bold">{m.hours_saved.toFixed(1)} hrs</td>
                      <td className="p-3.5 font-mono">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          m.errors_prevented > 0 ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-slate-150/60 text-slate-600"
                        }`}>
                          {m.errors_prevented}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-emerald-600 font-extrabold">+${m.cost_saved_usd.toLocaleString()}</td>
                      <td className="p-3.5 text-slate-400 font-mono">{new Date(m.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
