import React, { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, FileText, RefreshCw, Search, ShieldCheck, UserRound } from "lucide-react";
import { ControlBankDocument } from "../types";
import { Document } from "../types";

type DocTypeFilter = "all" | "SOP" | "APQR";
type StatusFilter = "all" | "Draft" | "Under_Review" | "Approved" | "Rejected";

const statusLabels: Record<StatusFilter, string> = {
  all: "All Status",
  Draft: "Draft",
  Under_Review: "Under Review",
  Approved: "Accepted",
  Rejected: "Declined",
};

interface ControlBankViewProps {
  onSelectDocument: (document: Document) => void;
}

export default function ControlBankView({ onSelectDocument }: ControlBankViewProps) {
  const [documents, setDocuments] = useState<ControlBankDocument[]>([]);
  const [docType, setDocType] = useState<DocTypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (docType !== "all") params.set("doc_type", docType);
      if (status !== "all") params.set("status", status);
      if (search.trim()) params.set("search", search.trim());

      const response = await fetch(`/api/control-bank/documents?${params.toString()}`);
      if (response.ok) {
        setDocuments(await response.json());
      }
    } catch (err) {
      console.error("Error fetching control bank documents:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(fetchDocuments, 180);
    return () => window.clearTimeout(timeout);
  }, [docType, status, search]);

  const totals = useMemo(() => {
    return documents.reduce(
      (acc, doc) => {
        acc.total += 1;
        acc[doc.type] += 1;
        acc[doc.status] += 1;
        return acc;
      },
      { total: 0, SOP: 0, APQR: 0, Draft: 0, Under_Review: 0, Approved: 0, Rejected: 0 }
    );
  }, [documents]);

  const getStatusBadge = (docStatus: ControlBankDocument["status"]) => {
    const styles = {
      Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
      Rejected: "bg-rose-50 text-rose-700 border-rose-200",
      Under_Review: "bg-amber-50 text-amber-700 border-amber-200",
      Draft: "bg-slate-100 text-slate-700 border-slate-200",
    };
    return (
      <span className={`px-2 py-1 rounded-full border text-[10px] font-black uppercase tracking-wide ${styles[docStatus]}`}>
        {statusLabels[docStatus]}
      </span>
    );
  };

  const openDocument = async (doc: ControlBankDocument) => {
    try {
      const response = await fetch(`/api/control-bank/documents/${doc.id}`);
      if (!response.ok) {
        throw new Error("Document could not be opened");
      }
      onSelectDocument(await response.json());
    } catch (err) {
      console.error(err);
      alert("Could not open this SOP/APQR record.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-2">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-blue-600" />
          All User SOP/APQR Control Bank
        </h1>
        <p className="text-slate-500 text-sm">
          Cross-user document registry for SOP and APQR lifecycle tracking, creator accountability, and unique ID lookup.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Visible Records</p>
          <p className="text-2xl font-black text-slate-800">{totals.total}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-[10px] text-slate-400 font-bold uppercase">SOP</p>
          <p className="text-2xl font-black text-indigo-600">{totals.SOP}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-[10px] text-slate-400 font-bold uppercase">APQR</p>
          <p className="text-2xl font-black text-emerald-600">{totals.APQR}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Draft</p>
          <p className="text-2xl font-black text-slate-700">{totals.Draft}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Review</p>
          <p className="text-2xl font-black text-amber-600">{totals.Under_Review}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Accepted</p>
          <p className="text-2xl font-black text-emerald-600">{totals.Approved}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-tight text-slate-900">SOP/APQR Registry</h2>
            <p className="text-[11px] text-slate-500 mt-1">Search by unique ID, creator name, or document title.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ID, creator, or name"
                className="w-full sm:w-64 pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={docType}
              onChange={(event) => setDocType(event.target.value as DocTypeFilter)}
              className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-semibold"
            >
              <option value="all">All Types</option>
              <option value="SOP">SOP</option>
              <option value="APQR">APQR</option>
            </select>

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
              className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-semibold"
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <button
              onClick={fetchDocuments}
              className="px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 flex items-center justify-center gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-3.5 font-black uppercase">Unique ID</th>
                <th className="p-3.5 font-black uppercase">Document</th>
                <th className="p-3.5 font-black uppercase">Creator</th>
                <th className="p-3.5 font-black uppercase">Type</th>
                <th className="p-3.5 font-black uppercase">Status</th>
                <th className="p-3.5 font-black uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400 font-semibold">
                    No SOP/APQR records match the current filters.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => openDocument(doc)}
                    className="hover:bg-slate-50/70 cursor-pointer"
                  >
                    <td className="p-3.5 font-mono font-black text-blue-700">{doc.display_id}</td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5 min-w-64">
                        <div className="p-2 bg-slate-100 rounded-lg border border-slate-200">
                          {doc.type === "SOP" ? <FileText className="h-4 w-4 text-indigo-500" /> : <FileSpreadsheet className="h-4 w-4 text-emerald-500" />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{doc.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Updated {new Date(doc.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <UserRound className="h-3.5 w-3.5 text-slate-400" />
                        <div>
                          <p className="font-bold text-slate-700">{doc.creator_name}</p>
                          {doc.creator_staff_id && <p className="text-[10px] text-slate-400 font-mono">{doc.creator_staff_id}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded font-black border border-slate-200">{doc.type}</span>
                    </td>
                    <td className="p-3.5">{getStatusBadge(doc.status)}</td>
                    <td className="p-3.5 text-slate-500 font-mono">{new Date(doc.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
