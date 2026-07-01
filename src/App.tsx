import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, FileText, FileSpreadsheet, MessageSquareCode, 
  TrendingUp, Sparkles, RefreshCw, AlertCircle, HelpCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Document } from "./types";

// Import custom views
import DashboardView from "./components/DashboardView";
import SOPPreparer from "./components/SOPPreparer";
import APQRCompiler from "./components/APQRCompiler";
import ComplianceInspector from "./components/ComplianceInspector";
import RoiTracker from "./components/RoiTracker";

export default function App() {
  const [activeTab, setActiveTab] = useState<"desk" | "sop" | "apqr" | "roi">("desk");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  // Fetch documents list from Python backend
  const fetchDocuments = async () => {
    setIsLoadingDocs(true);
    try {
      const response = await fetch("/api/documents");
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
        
        // If a document is currently selected, refresh its details as well
        if (selectedDocument) {
          const refreshedDoc = data.find((d: Document) => d.id === selectedDocument.id);
          if (refreshedDoc) {
            // Re-fetch individual doc to get full compliance check details
            const detailRes = await fetch(`/api/documents/${selectedDocument.id}`);
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              setSelectedDocument(detailData);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error fetching documents:", err);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [activeTab]);

  const handleDeleteDocument = async (id: string) => {
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: "DELETE"
      });
      if (response.ok) {
        setDocuments(documents.filter(d => d.id !== id));
        if (selectedDocument?.id === id) {
          setSelectedDocument(null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectDocument = async (doc: Document) => {
    // Fetch full details including compliance analysis
    try {
      const response = await fetch(`/api/documents/${doc.id}`);
      if (response.ok) {
        const fullDoc = await response.json();
        setSelectedDocument(fullDoc);
      } else {
        setSelectedDocument(doc);
      }
    } catch (err) {
      console.error(err);
      setSelectedDocument(doc);
    }
  };

  const renderActiveView = () => {
    if (selectedDocument) {
      return (
        <ComplianceInspector
          document={selectedDocument}
          onBack={() => setSelectedDocument(null)}
          onActionComplete={() => {
            fetchDocuments();
          }}
        />
      );
    }

    switch (activeTab) {
      case "desk":
        return (
          <DashboardView
            documents={documents}
            onUploadSuccess={(type, result) => {
              fetchDocuments();
              // Auto focus/inspect the newly uploaded file
              if (result && result.document_id) {
                fetchDocuments().then(() => {
                  const matchingDoc = documents.find(d => d.id === result.document_id);
                  if (matchingDoc) {
                    handleSelectDocument(matchingDoc);
                  }
                });
              }
            }}
            onSelectDocument={handleSelectDocument}
            onDeleteDocument={handleDeleteDocument}
            onNavigate={(tab) => {
              setSelectedDocument(null);
              setActiveTab(tab);
            }}
          />
        );
      case "sop":
        return (
          <SOPPreparer
            onDraftGenerated={() => {
              fetchDocuments();
            }}
          />
        );
      case "apqr":
        return (
          <APQRCompiler
            onDraftGenerated={() => {
              fetchDocuments();
            }}
          />
        );
      case "roi":
        return <RoiTracker />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Banner and Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo Group */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-lg shadow-sm shadow-blue-200">
                G
              </div>
              <div>
                <span className="font-bold tracking-tight text-slate-800 text-lg underline decoration-blue-600 decoration-2 underline-offset-4 cursor-pointer" onClick={() => { setSelectedDocument(null); setActiveTab("desk"); }}>
                  GxPilot<span className="text-blue-600 font-extrabold font-mono">.ai</span>
                </span>
                <span className="ml-3.5 hidden sm:inline-block px-2.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-mono font-bold rounded border border-slate-200 uppercase tracking-widest">
                  21 CFR PART 11 COMPLIANT
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex space-x-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
              <button
                onClick={() => { setSelectedDocument(null); setActiveTab("desk"); }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "desk" && !selectedDocument
                    ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                Compliance Desk
              </button>
              <button
                onClick={() => { setSelectedDocument(null); setActiveTab("sop"); }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "sop" && !selectedDocument
                    ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                SOP Preparer
              </button>
              <button
                onClick={() => { setSelectedDocument(null); setActiveTab("apqr"); }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "apqr" && !selectedDocument
                    ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                APQR Compiler
              </button>
              <button
                onClick={() => { setSelectedDocument(null); setActiveTab("roi"); }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "roi" && !selectedDocument
                    ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                ROI Insights
              </button>
            </nav>

            {/* Quick Status / Refresh */}
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 text-slate-500">
                <span className="text-xs font-semibold italic">Audit Trail: Enabled</span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <button
                onClick={fetchDocuments}
                disabled={isLoadingDocs}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg border border-slate-200 bg-white shadow-3xs hover:bg-slate-50 transition-all cursor-pointer"
                title="Refresh datasets"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingDocs ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + (selectedDocument ? `_detail_${selectedDocument.id}` : "_list")}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
          >
            {renderActiveView()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-[10px] text-slate-400 font-mono">
        GxPilot Complies with FDA 21 CFR Part 11 Audit Trail Guidelines. All recommendations are AI-assisted and require human signoff.
      </footer>
    </div>
  );
}
