import React, { useState, useRef } from "react";
import { 
  ZoomIn, ZoomOut, RotateCcw, Copy, 
  Download, FileText, CheckCircle2, ShieldCheck, 
  FileSpreadsheet, Lock, Sparkles
} from "lucide-react";

interface NicePdfPreviewProps {
  title: string;
  docType: string; // 'SOP', 'APQR', 'MBR', 'EBR', 'General'
  status: string; // 'Draft', 'Under_Review', 'Approved', 'Rejected'
  content: string;
  documentId?: string;
}

type PdfLine = {
  text: string;
  size: number;
  font: "F1" | "F2";
  gapBefore?: number;
};

const sanitizeFilename = (name: string) =>
  name.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 120) || "document";

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const normalizePdfText = (text: string) =>
  text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/•/g, "-")
    .replace(/°/g, " deg ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");

const escapePdfString = (text: string) =>
  normalizePdfText(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const wrapText = (text: string, maxChars: number) => {
  const words = normalizePdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
};

const buildPdfBlob = ({
  title,
  docType,
  status,
  documentId,
  content,
}: {
  title: string;
  docType: string;
  status: string;
  documentId: string;
  content: string;
}) => {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const left = 50;
  const top = 785;
  const bottom = 56;
  const maxChars = 92;
  const lines: PdfLine[] = [
    { text: "GxPilot Compliance Control Desk", size: 16, font: "F2" },
    { text: "GLOBAL PHARMACEUTICAL QUALITY DESK", size: 11, font: "F2" },
    { text: `Document: ${title}`, size: 10, font: "F1", gapBefore: 12 },
    { text: `Type: ${docType}    Status: ${status || "Draft"}    ID: ${documentId}`, size: 9, font: "F1" },
    { text: `Generated: ${new Date().toLocaleDateString()}`, size: 9, font: "F1" },
    { text: "FDA 21 CFR Part 211 / EU GMP Annex 15 Controlled Document Record", size: 9, font: "F1", gapBefore: 8 },
    { text: "", size: 10, font: "F1", gapBefore: 10 },
  ];

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      lines.push({ text: "", size: 10, font: "F1", gapBefore: 8 });
      continue;
    }

    if (line === "---" || line === "___") {
      lines.push({ text: "------------------------------------------------------------", size: 9, font: "F1", gapBefore: 8 });
      continue;
    }

    if (line.startsWith("# ")) {
      for (const wrapped of wrapText(line.replace(/^#\s+/, "").toUpperCase(), 60)) {
        lines.push({ text: wrapped, size: 14, font: "F2", gapBefore: 12 });
      }
      continue;
    }

    if (line.startsWith("## ")) {
      for (const wrapped of wrapText(line.replace(/^##\s+/, "").toUpperCase(), 72)) {
        lines.push({ text: wrapped, size: 12, font: "F2", gapBefore: 10 });
      }
      continue;
    }

    if (line.startsWith("### ")) {
      for (const wrapped of wrapText(line.replace(/^###\s+/, ""), 78)) {
        lines.push({ text: wrapped, size: 10, font: "F2", gapBefore: 8 });
      }
      continue;
    }

    const cleanedLine = line
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/^\|\s*/, "")
      .replace(/\s*\|$/g, "")
      .replace(/\|/g, "   ");
    const bodyPrefix = /^[-*]\s+/.test(cleanedLine) ? "- " : "";
    const bodyText = bodyPrefix ? cleanedLine.replace(/^[-*]\s+/, "") : cleanedLine;

    for (const [idx, wrapped] of wrapText(`${bodyPrefix}${bodyText}`, maxChars).entries()) {
      lines.push({ text: idx > 0 && bodyPrefix ? `  ${wrapped}` : wrapped, size: 10, font: "F1", gapBefore: idx === 0 ? 4 : 0 });
    }
  }

  const pages: string[] = [];
  let y = top;
  let stream = "";
  let pageNumber = 1;

  const addFooter = () => {
    stream += `BT /F1 8 Tf ${left} 34 Td (GxP Controlled Document - Page ${pageNumber}) Tj ET\n`;
  };

  for (const line of lines) {
    const lineHeight = line.size + 5 + (line.gapBefore || 0);
    if (y - lineHeight < bottom) {
      addFooter();
      pages.push(stream);
      stream = "";
      pageNumber += 1;
      y = top;
    }
    y -= line.gapBefore || 0;
    if (line.text) {
      stream += `BT /${line.font} ${line.size} Tf ${left} ${y.toFixed(2)} Td (${escapePdfString(line.text)}) Tj ET\n`;
    }
    y -= line.size + 5;
  }

  addFooter();
  pages.push(stream);

  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("");
  const regularFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds: number[] = [];

  for (const pageStream of pages) {
    const contentId = objects.length + 2;
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    addObject(`<< /Length ${pageStream.length} >>\nstream\n${pageStream}endstream`);
    pageIds.push(pageId);
  }

  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${offsets[i].toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: "application/pdf" });
};

export default function NicePdfPreview({
  title: initialTitle,
  docType,
  status,
  content,
  documentId = "SOP-QA-XXX"
}: NicePdfPreviewProps) {
  const [zoom, setZoom] = useState(100);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const isRawPdfContent = content.trimStart().startsWith("%PDF-");
  const previewContent = isRawPdfContent
    ? `# PDF Document Review Summary

**File:** ${initialTitle}

This is a controlled PDF document. The saved record contains PDF binary structure, so GxPilot generated a review summary instead of displaying raw PDF internals.

## Document Information

- Source format: PDF
- Document type: ${docType}
- Current status: ${status || "Draft"}
- Document ID: ${documentId}

## Compliance Review Focus

- Confirm document title, effective date, version, and approval status.
- Verify required QA signatures and 21 CFR Part 11 audit trail controls.
- Check procedure steps for completeness, cleaning verification, deviation handling, and release criteria.
- Review the compliance findings panel for detected anomalies, CAPA recommendations, and checklist results.

## Preview Note

Text extraction was not available for this saved PDF record. If the file is scanned/image-only, OCR is required for full page-level text preview.`
    : content;

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 150));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 70));
  const handleZoomReset = () => setZoom(100);

  const handleCopy = () => {
    navigator.clipboard.writeText(previewContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([previewContent], { type: "text/markdown" });
    element.href = URL.createObjectURL(file);
    element.download = `${docType}_${initialTitle.replace(/\s+/g, "_") || "document"}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  const handleDownloadPdf = () => {
    const pdf = buildPdfBlob({
      title: initialTitle || "GxPilot Document",
      docType,
      status,
      documentId,
      content: previewContent,
    });
    const url = URL.createObjectURL(pdf);
    const element = document.createElement("a");
    element.href = url;
    element.download = `${docType}_${sanitizeFilename(initialTitle || "document")}.pdf`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
    setPdfDownloaded(true);
    setTimeout(() => setPdfDownloaded(false), 2000);
  };

  // Safe markdown inline formatter
  const formatText = (text: string) => {
    if (!text) return "";
    let formatted = escapeHtml(text);

    // Format bold **text**
    const boldRegex = /\*\*(.*?)\*\*/g;
    formatted = formatted.replace(boldRegex, "<strong>$1</strong>");

    // Format bracketed variables like [Document ID: XXX]
    const bracketRegex = /(\[[^\]]+\])/g;
    formatted = formatted.replace(bracketRegex, '<span class="bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded border border-blue-100">$1</span>');

    return formatted;
  };

  // Structured custom Markdown/Txt Parser to render formal PDF Layout
  const renderParsedContent = () => {
    if (!previewContent) {
      return <p className="text-slate-400 italic text-center py-8">Empty document body.</p>;
    }

    const lines = previewContent.split("\n");
    const elements: React.ReactNode[] = [];
    let currentTableRows: string[][] = [];
    let isInsideTable = false;

    const flushTable = (keyIndex: number) => {
      if (currentTableRows.length > 0) {
        // Find if we have a table separator line (contains --- or :---)
        const headerIndex = currentTableRows.findIndex(row => row.some(cell => cell.includes("---")));
        let headers: string[] = [];
        let dataRows = [...currentTableRows];

        if (headerIndex !== -1) {
          // Row before separator is the header row
          if (headerIndex > 0) {
            headers = currentTableRows[headerIndex - 1];
            // Remove the header and the separator
            dataRows = currentTableRows.filter((_, idx) => idx !== headerIndex && idx !== headerIndex - 1);
          } else {
            // Separator is first row, remove it
            dataRows = currentTableRows.filter((_, idx) => idx !== headerIndex);
          }
        }

        elements.push(
          <div key={`table-${keyIndex}`} className="my-6 overflow-x-auto border border-slate-350 rounded-lg shadow-3xs">
            <table className="w-full text-[11px] border-collapse bg-white leading-normal">
              {headers.length > 0 && (
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-350">
                    {headers.map((h, hIdx) => (
                      <th key={hIdx} className="px-3.5 py-2 font-bold text-slate-800 text-left border-r border-slate-350 last:border-r-0">
                        {h.trim()}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {dataRows.map((row, rIdx) => (
                  <tr key={rIdx} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50/50">
                    {row.map((cell, cIdx) => (
                      <td 
                        key={cIdx} 
                        className="px-3.5 py-2 text-slate-700 border-r border-slate-200 last:border-r-0"
                        dangerouslySetInnerHTML={{ __html: formatText(cell.trim()) }}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        currentTableRows = [];
        isInsideTable = false;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check for table lines (starts and ends with | or contains multiple |)
      if (line.startsWith("|") || (line.includes("|") && line.split("|").length > 2)) {
        isInsideTable = true;
        // Split and filter outer empty cells
        let cells = line.split("|");
        if (cells[0] === "") cells.shift();
        if (cells[cells.length - 1] === "") cells.pop();
        currentTableRows.push(cells);
        continue;
      } else if (isInsideTable) {
        // Table ended, flush it
        flushTable(i);
      }

      // Headers
      if (line.startsWith("# ")) {
        elements.push(
          <h1 key={i} className="text-xl font-extrabold text-blue-900 border-b-2 border-blue-900 pb-1.5 mt-8 mb-4 tracking-tight uppercase font-sans flex items-center justify-between">
            <span>{line.replace("# ", "")}</span>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 border px-2 py-0.5 rounded tracking-normal">SECTION 1.0</span>
          </h1>
        );
      } else if (line.startsWith("## ")) {
        elements.push(
          <h2 key={i} className="text-sm font-black text-slate-800 border-b border-slate-300 pb-1 mt-6 mb-3 tracking-tight uppercase font-sans flex items-center justify-between">
            <span>{line.replace("## ", "")}</span>
            <span className="text-[9px] font-semibold text-slate-400">CONTROL</span>
          </h2>
        );
      } else if (line.startsWith("### ")) {
        elements.push(
          <h3 key={i} className="text-xs font-extrabold text-slate-700 mt-5 mb-2 tracking-tight uppercase font-sans">
            {line.replace("### ", "")}
          </h3>
        );
      }
      // Horizontal Line
      else if (line === "---" || line === "___") {
        elements.push(<hr key={i} className="my-6 border-t border-slate-350" />);
      }
      // Signature lines (e.g. contains _______________________________)
      else if (line.includes("______")) {
        elements.push(
          <div key={i} className="my-5 p-4 bg-slate-50 border border-dashed border-slate-300 rounded-lg flex items-center justify-between">
            <div className="flex-1">
              <span className="text-[10px] font-mono text-slate-400 tracking-wider block mb-2 uppercase">21 CFR PART 11 SECURE HANDWRITTEN PIN STAMP</span>
              <p className="text-xs font-bold text-slate-700 font-mono leading-none" dangerouslySetInnerHTML={{ __html: formatText(line) }} />
            </div>
            <div className="h-8 w-24 border border-slate-300 rounded flex items-center justify-center bg-white text-[9px] font-mono text-slate-400 select-none">
              Stamp Space
            </div>
          </div>
        );
      }
      // Bullet items
      else if (line.startsWith("* ") || line.startsWith("- ")) {
        const itemContent = line.substring(2);
        elements.push(
          <ul key={i} className="list-disc pl-5 my-2.5 space-y-1.5">
            <li 
              className="text-xs text-slate-700 font-serif leading-relaxed text-justify"
              dangerouslySetInnerHTML={{ __html: formatText(itemContent) }}
            />
          </ul>
        );
      }
      // Numbered items
      else if (/^\d+\.\s/.test(line)) {
        const itemContent = line.replace(/^\d+\.\s/, "");
        elements.push(
          <ol key={i} className="list-decimal pl-5 my-2.5 space-y-1.5">
            <li 
              className="text-xs text-slate-700 font-serif leading-relaxed text-justify"
              dangerouslySetInnerHTML={{ __html: formatText(itemContent) }}
            />
          </ol>
        );
      }
      // Empty line
      else if (line === "") {
        continue;
      }
      // Default Paragraph
      else {
        elements.push(
          <p 
            key={i} 
            className="text-xs text-slate-700 font-serif leading-relaxed mb-4 text-justify"
            dangerouslySetInnerHTML={{ __html: formatText(line) }}
          />
        );
      }
    }

    // Edge case: if loop ended while inside a table, flush it
    if (isInsideTable) {
      flushTable(lines.length);
    }

    return elements;
  };

  // Determine Watermark Stamp based on current status
  const getWatermarkText = () => {
    switch (status) {
      case "Approved":
        return "GxP APPROVED & RELEASED";
      case "Rejected":
        return "GxP REJECTED / DISCARDED";
      case "Under_Review":
        return "GxP RECORD UNDER REVIEW";
      default:
        return "GxP SYSTEM DRAFT";
    }
  };

  const getWatermarkStyle = () => {
    switch (status) {
      case "Approved":
        return "text-emerald-500/8 border-emerald-500/15";
      case "Rejected":
        return "text-rose-500/8 border-rose-500/15";
      case "Under_Review":
        return "text-amber-500/8 border-amber-500/15";
      default:
        return "text-slate-400/8 border-slate-300/15";
    }
  };

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white print:border-none print:shadow-none">
      
      {/* Top PDF Controls Bar (hidden in printing) */}
      <div className="bg-slate-800 text-slate-100 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs select-none print:hidden">
        
        {/* Doc Info */}
        <div className="flex items-center gap-2">
          {docType === "APQR" ? (
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
          ) : (
            <FileText className="h-4 w-4 text-blue-400" />
          )}
          <span className="font-bold tracking-tight max-w-[200px] truncate">{initialTitle || "APQR Document"}</span>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
            status === "Approved" ? "bg-emerald-950/80 text-emerald-400 border border-emerald-900/50" :
            status === "Rejected" ? "bg-rose-950/80 text-rose-400 border border-rose-900/50" :
            status === "Under_Review" ? "bg-amber-950/80 text-amber-400 border border-amber-900/50" :
            "bg-slate-900 text-slate-400 border border-slate-700"
          }`}>
            {status || "DRAFT"}
          </span>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-lg border border-slate-700">
          <button 
            type="button"
            onClick={handleZoomOut} 
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="font-mono text-[10px] px-1 font-bold text-slate-300 w-10 text-center">{zoom}%</span>
          <button 
            type="button"
            onClick={handleZoomIn} 
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          {zoom !== 100 && (
            <button 
              type="button"
              onClick={handleZoomReset} 
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
              title="Reset Zoom"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="px-2.5 py-1 bg-slate-750 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy Source"}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="px-2.5 py-1 bg-slate-750 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {downloaded ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Download className="h-3.5 w-3.5" />}
            Download .MD
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold tracking-wide transition-all flex items-center gap-1.5 cursor-pointer shadow-xs shadow-blue-900/30"
          >
            {pdfDownloaded ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
            {pdfDownloaded ? "PDF Saved" : "Download PDF"}
          </button>
        </div>
      </div>

      {/* PDF Desk Canvas Frame */}
      <div className="flex-1 bg-slate-700/90 p-4 md:p-8 overflow-y-auto relative h-[650px] scrollbar-thin shadow-inner print:bg-white print:p-0 print:h-auto print:overflow-visible">
        
        {/* Printable PDF Page Layout */}
        <div 
          id="printable-pdf-area"
          ref={printRef}
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
          className="bg-white text-slate-800 shadow-2xl relative border border-slate-100 transition-all duration-300 mx-auto p-12 md:p-16 max-w-[800px] min-h-[1130px] flex flex-col justify-between print:transform-none print:shadow-none print:border-none print:p-0 print:mx-0 print:max-w-none print:min-h-0"
        >
          {/* GxP Background Watermark Stamp */}
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none select-none">
            <div className={`text-[4.5rem] md:text-[5.5rem] font-black uppercase tracking-widest border-8 px-6 py-4 rounded-3xl opacity-[0.035] -rotate-25 ${getWatermarkStyle()}`}>
              {getWatermarkText()}
            </div>
          </div>

          <div>
            {/* Elegant Pharmaceutical GxP Header */}
            <div className="border-b-4 border-blue-900 pb-5 mb-8 flex items-start justify-between">
              <div>
                <h3 className="text-[10px] font-bold text-blue-900 tracking-wider uppercase flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  GxPilot Compliance Control Desk
                </h3>
                <h2 className="text-sm font-black text-slate-800 tracking-tight mt-1 uppercase font-sans">
                  GLOBAL PHARMACEUTICAL QUALITY DESK
                </h2>
                <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                  FDA 21 CFR PART 211 / EU GMP ANNEX 15 CONTROLLED DOCUMENT RECORD
                </span>
              </div>
              <div className="text-right flex flex-col items-end">
                <span className="bg-slate-100 text-slate-700 text-[10px] font-mono font-extrabold px-2.5 py-1 border border-slate-200 rounded uppercase tracking-wider">
                  {docType} REPORT
                </span>
                <span className="text-[8px] font-mono text-slate-400 mt-2">
                  DOC ID: <strong className="text-slate-700">{documentId}</strong>
                </span>
                <span className="text-[8px] font-mono text-slate-400">
                  DATE: {new Date().toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Rendered Document Body */}
            <div className="prose max-w-none font-serif text-slate-800">
              {renderParsedContent()}
            </div>
          </div>

          {/* Elegant Pharmaceutical GxP Footer */}
          <div className="border-t border-slate-300 pt-4 mt-12 text-[9px] font-mono text-slate-400 flex justify-between items-center print:mt-16">
            <div>
              <span>GxPilot Audit Engine • Version 1.2 • Regulatory Approved Output</span>
              <span className="block text-[8px] text-slate-400 uppercase mt-0.5">
                21 CFR Part 11 Electronically Generated & Authenticated Report
              </span>
            </div>
            <div className="text-right">
              <span>Confidential • Page 1 of 1</span>
              <span className="block text-[8px] text-emerald-600 font-bold uppercase mt-0.5">
                GxP Controlled Document
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Embedded CSS for Isolated Printing */}
      <style>{`
        @media print {
          /* Hide everything except the PDF Area */
          body * {
            visibility: hidden !important;
          }
          #printable-pdf-area, #printable-pdf-area * {
            visibility: visible !important;
          }
          #printable-pdf-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 30px !important;
            box-shadow: none !important;
            border: none !important;
            transform: none !important;
            min-height: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
