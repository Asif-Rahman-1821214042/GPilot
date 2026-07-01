import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Lightbulb, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { ComplianceCheck } from "../types";

type EditableSection = {
  id: string;
  level: number;
  heading: string;
  body: string;
};

interface SectionWiseDocumentEditorProps {
  documentId: string;
  docType: "SOP" | "APQR";
  content: string;
  complianceCheck?: ComplianceCheck | null;
  onContentChange?: (content: string) => void;
  onSaved: (content: string) => void | Promise<void>;
  onCancel?: () => void;
}

type EditSuggestion = {
  id: string;
  source: "risk" | "recommendation" | "checklist";
  severity?: "High" | "Medium" | "Low";
  where: string;
  what: string;
};

const parseSections = (content: string): EditableSection[] => {
  const lines = (content || "").replace(/\r\n/g, "\n").split("\n");
  const sections: EditableSection[] = [];
  let current: EditableSection | null = null;

  const pushCurrent = () => {
    if (current) {
      sections.push({ ...current, body: current.body.replace(/\n$/g, "") });
    }
  };

  lines.forEach((line) => {
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      pushCurrent();
      current = {
        id: `section-${sections.length}-${headingMatch[2].slice(0, 24)}`,
        level: headingMatch[1].length,
        heading: headingMatch[2].trim(),
        body: "",
      };
      return;
    }

    if (!current) {
      current = {
        id: "section-opening",
        level: 0,
        heading: "Opening content",
        body: "",
      };
    }

    current.body += `${line}\n`;
  });

  pushCurrent();

  return sections.length
    ? sections
    : [{ id: "section-empty", level: 1, heading: "Document content", body: "" }];
};

const buildContent = (sections: EditableSection[]) =>
  sections
    .map((section) => {
      const body = section.body.trimEnd();
      if (section.level === 0) return body;
      const heading = `${"#".repeat(section.level)} ${section.heading.trim() || "Untitled section"}`;
      return body ? `${heading}\n${body}` : heading;
    })
    .filter(Boolean)
    .join("\n\n");

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const keywordsFrom = (text: string) => {
  const stopWords = new Set([
    "about", "above", "after", "also", "and", "are", "before", "below", "document",
    "for", "from", "has", "have", "into", "must", "not", "should", "that", "the",
    "this", "with", "within", "without", "your",
  ]);
  return normalize(text)
    .split(/\s+/)
    .filter((word) => word.length >= 5 && !stopWords.has(word))
    .slice(0, 12);
};

const buildSuggestions = (check?: ComplianceCheck | null): EditSuggestion[] => {
  if (!check) return [];

  const anomalySuggestions = check.anomalies.map((anomaly, index) => ({
    id: `risk-${index}`,
    source: "risk" as const,
    severity: anomaly.severity,
    where: anomaly.type,
    what: anomaly.mitigation || anomaly.message,
  }));

  const recommendationSuggestions = check.recommendations.map((recommendation, index) => ({
    id: `rec-${index}`,
    source: "recommendation" as const,
    where: "Recommended update",
    what: recommendation,
  }));

  const checklistSuggestions = check.checklist
    .filter((item) => item.status !== "PASS")
    .map((item, index) => ({
      id: `check-${index}`,
      source: "checklist" as const,
      where: item.item,
      what: `Resolve checklist item marked ${item.status}: ${item.item}`,
    }));

  return [...anomalySuggestions, ...checklistSuggestions, ...recommendationSuggestions];
};

const matchesSection = (suggestion: EditSuggestion, section: EditableSection) => {
  const sectionText = normalize(`${section.heading} ${section.body}`);
  const suggestionText = normalize(`${suggestion.where} ${suggestion.what}`);
  const heading = normalize(section.heading);

  if (heading && suggestionText.includes(heading)) return true;
  return keywordsFrom(suggestionText).some((keyword) => sectionText.includes(keyword));
};

export default function SectionWiseDocumentEditor({
  documentId,
  docType,
  content,
  complianceCheck,
  onContentChange,
  onSaved,
  onCancel,
}: SectionWiseDocumentEditorProps) {
  const [sections, setSections] = useState<EditableSection[]>(() => parseSections(content));
  const [isSaving, setIsSaving] = useState(false);
  const suggestions = useMemo(() => buildSuggestions(complianceCheck), [complianceCheck]);
  const unmatchedSuggestions = useMemo(
    () => suggestions.filter((suggestion) => !sections.some((section) => matchesSection(suggestion, section))).slice(0, 5),
    [sections, suggestions]
  );

  useEffect(() => {
    setSections(parseSections(content));
  }, [content]);

  useEffect(() => {
    onContentChange?.(buildContent(sections));
  }, [sections, onContentChange]);

  const updateSection = (id: string, changes: Partial<EditableSection>) => {
    setSections((prev) =>
      prev.map((section) => (section.id === id ? { ...section, ...changes } : section))
    );
  };

  const addSection = () => {
    setSections((prev) => [
      ...prev,
      {
        id: `section-new-${Date.now()}`,
        level: 2,
        heading: docType === "SOP" ? "New SOP Section" : "New APQR Section",
        body: "",
      },
    ]);
  };

  const removeSection = (id: string) => {
    setSections((prev) => prev.filter((section) => section.id !== id));
  };

  const resetSections = () => {
    setSections(parseSections(content));
  };

  const handleSave = async () => {
    const nextContent = buildContent(sections);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: nextContent }),
      });

      if (!response.ok) {
        throw new Error("Document save failed");
      }

      const updatedDocument = await response.json();
      await onSaved(updatedDocument.content || nextContent);
    } catch (err) {
      console.error(err);
      alert(`${docType} could not be saved. Please check backend connection.`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border border-emerald-100 rounded-2xl shadow-xs shadow-emerald-100/60 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            {docType} Section Editor
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            Edit each generated section separately before review and compliance scoring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-250 text-slate-600 rounded-lg text-[10px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={resetSections}
              disabled={isSaving}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-250 text-slate-600 rounded-lg text-[10px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={addSection}
            className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-250 text-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Section
          </button>
        </div>
      </div>

      <div className="px-6 py-5 space-y-6 bg-white">
        {suggestions.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-800">
              <Lightbulb className="h-4 w-4" />
              Suggested Updates From Current Compliance Report
            </div>
            <p className="mt-1 text-[11px] font-medium text-amber-800/80">
              Use these as guidance while editing. The compliance score will refresh after finalization.
            </p>
            {unmatchedSuggestions.length > 0 && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                {unmatchedSuggestions.map((suggestion) => (
                  <div key={suggestion.id} className="rounded-lg border border-amber-200 bg-white/70 p-3 text-[11px] leading-relaxed">
                    <div className="font-black text-slate-800">Where: {suggestion.where}</div>
                    <div className="mt-1 text-slate-600">What to change: {suggestion.what}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {sections.map((section, index) => (
          <div key={section.id} className="space-y-2">
            {(() => {
              const sectionSuggestions = suggestions.filter((suggestion) => matchesSection(suggestion, section)).slice(0, 3);
              return sectionSuggestions.length > 0 ? (
                <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
                  <div className="text-[10px] font-black uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Suggested changes for this section
                  </div>
                  <div className="mt-2 space-y-2">
                    {sectionSuggestions.map((suggestion) => (
                      <div key={suggestion.id} className="text-[11px] leading-relaxed text-slate-700">
                        <span className="font-black text-slate-900">Where:</span> {suggestion.where}
                        <span className="mx-1.5 text-slate-300">|</span>
                        <span className="font-black text-slate-900">What:</span> {suggestion.what}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={section.heading}
                onChange={(event) => updateSection(section.id, { heading: event.target.value })}
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-xs font-black uppercase tracking-[0.18em] text-slate-400 focus:outline-none focus:text-slate-600"
                aria-label="Section title"
              />
              <select
                value={section.level}
                onChange={(event) => updateSection(section.id, { level: Number(event.target.value) })}
                className="px-2 py-1 text-[10px] font-bold border border-slate-200 rounded-lg bg-slate-50 text-slate-500 focus:outline-none focus:border-blue-400"
                aria-label="Section heading level"
              >
                <option value={0}>Intro</option>
                <option value={1}>H1</option>
                <option value={2}>H2</option>
                <option value={3}>H3</option>
              </select>
            </div>
            <div className="flex items-start gap-3">
              <textarea
                value={section.body}
                onChange={(event) => updateSection(section.id, { body: event.target.value })}
                rows={Math.max(3, Math.min(8, section.body.split("\n").length + 1))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/30 px-4 py-3 text-sm leading-relaxed font-semibold text-slate-800 shadow-3xs focus:outline-none focus:border-blue-400 focus:bg-white resize-y"
                spellCheck={false}
                aria-label={`${docType} section body`}
              />
              {sections.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSection(section.id)}
                  className="mt-0.5 h-10 w-10 flex items-center justify-center rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 cursor-pointer"
                  title="Remove section"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mx-6 border-t border-slate-100 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-xs font-semibold text-slate-500">
          Only the finalized updated version is stored in PostgreSQL history.
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || sections.length === 0}
          className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-emerald-200 disabled:opacity-60"
        >
          {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Re-Finalize Updated Version
        </button>
      </div>
    </div>
  );
}
