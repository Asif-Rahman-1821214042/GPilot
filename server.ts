import express from "express";
import path from "path";
import multer from "multer";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import {
  initDb,
  getDocuments,
  getDocument,
  getComplianceCheck,
  insertDocument,
  insertComplianceCheck,
  addAuditTrailEvent,
  updateDocumentStatus,
  deleteDocumentAndReviews,
  getChatHistory,
  insertChatMessage,
  clearChatHistory,
  getRoiSummary,
  insertRoiMetric
} from "./backend_db.js";
import {
  analyzeGxpDocument,
  draftGxpSop,
  draftGxpApqr,
  answerGxpChat
} from "./backend_gemini.js";

// Load environment variables
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log("[Server] Launching native full-stack GxPilot container...");

  // Initialize JSON database
  initDb();

  // Configure middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Multer configuration for file uploads
  const upload = multer({ storage: multer.memoryStorage() });

  // 1. GxPilot Backend API Endpoints
  
  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "healthy",
      service: "GxPilot Native Express Backend",
      timestamp: new Date().toISOString()
    });
  });

  // List Documents
  app.get("/api/documents", (req, res) => {
    const { type } = req.query;
    const docs = getDocuments(type as string);
    res.json(docs);
  });

  // Get Document Detail with Compliance report
  app.get("/api/documents/:id", (req, res) => {
    const doc = getDocument(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }
    const check = getComplianceCheck(req.params.id);
    res.json({
      ...doc,
      compliance_check: check || null
    });
  });

  // Upload Document
  app.post("/api/documents/upload", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      const docType = req.body.doc_type || "General";

      if (!file) {
        return res.status(400).json({ error: "No file was uploaded" });
      }

      const file_size = file.size;
      const originalName = file.originalname;
      let content_text = "";

      // Try decoding as standard text for analysis
      try {
        content_text = file.buffer.toString("utf8");
      } catch (err) {
        content_text = `[Binary file uploaded. Format: ${file.mimetype}, Size: ${file_size} bytes. Initiating automatic GxPilot content OCR processing and analysis...]`;
      }

      const docId = `doc-${Math.random().toString(36).substr(2, 9)}`;
      const nowStr = new Date().toISOString();

      const audit_trail = [{
        time: nowStr,
        user: "System",
        event: `File '${originalName}' uploaded and categorized under ${docType}`
      }];

      // Create document
      const newDoc = {
        id: docId,
        name: originalName,
        type: docType,
        status: "Under_Review",
        content: content_text,
        content_type: file.mimetype || "text/plain",
        file_size,
        audit_trail,
        created_at: nowStr,
        updated_at: nowStr
      };

      insertDocument(newDoc);

      // Trigger GxP compliance check with Gemini
      const complianceReport = await analyzeGxpDocument(originalName, docType, content_text);

      const chkId = `chk-${Math.random().toString(36).substr(2, 9)}`;
      const newCheck = {
        id: chkId,
        document_id: docId,
        score: complianceReport.score ?? 75.0,
        status: complianceReport.status ?? "Flagged",
        anomalies: complianceReport.anomalies ?? [],
        recommendations: complianceReport.recommendations ?? [],
        checklist: complianceReport.checklist ?? [],
        created_at: nowStr
      };

      insertComplianceCheck(newCheck);

      // Add audit event
      addAuditTrailEvent(
        docId,
        `Compliance scan completed with score: ${newCheck.score}%. Status: ${newCheck.status}`
      );

      // Save ROI Metric (Reviewing manually takes ~2.5 hours)
      const numAnomalies = newCheck.anomalies.length;
      insertRoiMetric(
        docType === "General" ? "General_Review" : "Batch_Review",
        2.5,
        numAnomalies,
        125.0
      );

      res.json({
        document_id: docId,
        filename: originalName,
        type: docType,
        compliance_score: newCheck.score,
        status: newCheck.status
      });

    } catch (error: any) {
      console.error("[Upload Error]", error);
      res.status(500).json({ error: `Failed to upload and process document: ${error.message}` });
    }
  });

  // SOP Drafting Endpoint
  app.post("/api/documents/draft-sop", async (req, res) => {
    try {
      const { title, steps, roles, regulations } = req.body;
      if (!title || !steps || !roles) {
        return res.status(400).json({ error: "Missing required SOP drafting details" });
      }

      const draft_content = await draftGxpSop(title, steps, roles, regulations || []);
      const docId = `sop-${Math.random().toString(36).substr(2, 9)}`;
      const filename = `SOP_${title.replace(/\s+/g, "_")}_Draft.md`;
      const nowStr = new Date().toISOString();

      const audit_trail = [{
        time: nowStr,
        user: "GxPilot AI",
        event: `SOP draft prepared. Inputs: steps=${steps.length} chars, regulations=${(regulations || []).length} items`
      }];

      const newDoc = {
        id: docId,
        name: filename,
        type: "SOP",
        status: "Draft",
        content: draft_content,
        content_type: "text/markdown",
        file_size: Buffer.byteLength(draft_content),
        audit_trail,
        created_at: nowStr,
        updated_at: nowStr
      };

      insertDocument(newDoc);

      // Log ROI Metric (SOP prep manually takes ~16 hours)
      insertRoiMetric("SOP_Prep", 16.0, 4, 800.0);

      res.json({ id: docId, name: filename, content: draft_content });
    } catch (error: any) {
      console.error("[SOP drafting error]", error);
      res.status(500).json({ error: `SOP draft failed: ${error.message}` });
    }
  });

  // APQR Compilation Endpoint
  app.post("/api/documents/draft-apqr", async (req, res) => {
    try {
      const { batch_summary, deviations, stability } = req.body;
      if (!batch_summary || !deviations || !stability) {
        return res.status(400).json({ error: "Missing required APQR manufacturing data streams" });
      }

      const draft_content = await draftGxpApqr(batch_summary, deviations, stability);
      const docId = `apqr-${Math.random().toString(36).substr(2, 9)}`;
      const filename = "Annual_Product_Quality_Review_Draft.md";
      const nowStr = new Date().toISOString();

      const audit_trail = [{
        time: nowStr,
        user: "GxPilot AI",
        event: "APQR draft generated based on manufacturing data streams."
      }];

      const newDoc = {
        id: docId,
        name: filename,
        type: "APQR",
        status: "Draft",
        content: draft_content,
        content_type: "text/markdown",
        file_size: Buffer.byteLength(draft_content),
        audit_trail,
        created_at: nowStr,
        updated_at: nowStr
      };

      insertDocument(newDoc);

      // Log ROI Metric (APQR compilation manually takes ~40 hours)
      insertRoiMetric("APQR_Gen", 40.0, 10, 2000.0);

      res.json({ id: docId, name: filename, content: draft_content });
    } catch (error: any) {
      console.error("[APQR compilation error]", error);
      res.status(500).json({ error: `APQR compilation failed: ${error.message}` });
    }
  });

  // Approve or Reject document state (CFR Part 11 Audit Trail Compliant)
  app.post("/api/documents/:id/action", upload.none(), (req, res) => {
    const docId = req.params.id;
    const action = req.body.action;
    const reviewerName = req.body.reviewer_name || "QA Lead";

    if (!["Approve", "Reject", "Submit_For_Review"].includes(action)) {
      return res.status(400).json({ error: "Invalid action parameter" });
    }

    const doc = getDocument(docId);
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    const newStatus = action === "Approve" ? "Approved" : (action === "Reject" ? "Rejected" : "Under_Review");
    updateDocumentStatus(docId, newStatus, reviewerName);

    res.json({ id: docId, status: newStatus, audit_logged: true });
  });

  // Delete Document
  app.delete("/api/documents/:id", (req, res) => {
    deleteDocumentAndReviews(req.params.id);
    res.json({ status: "success", message: `Document ${req.params.id} and related reviews deleted successfully.` });
  });

  // Chat History
  app.get("/api/chat/history", (req, res) => {
    res.json(getChatHistory());
  });

  // Chat message query
  app.post("/api/chat", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Missing chat message" });
      }

      const history = getChatHistory();
      const reply = await answerGxpChat(message, history);

      insertChatMessage("user", message);
      insertChatMessage("assistant", reply);

      res.json({ reply });
    } catch (error: any) {
      console.error("[Chat error]", error);
      res.status(500).json({ error: `Chatbot query failed: ${error.message}` });
    }
  });

  // Clear Chat History
  app.post("/api/chat/history/clear", (req, res) => {
    clearChatHistory();
    res.json({ status: "success", message: "Chat history cleared successfully" });
  });

  // ROI summary statistics
  app.get("/api/roi", (req, res) => {
    res.json(getRoiSummary());
  });

  // Create Custom ROI Metric
  app.post("/api/roi", (req, res) => {
    const { task_type, hours_saved, errors_prevented, cost_saved_usd } = req.body;
    insertRoiMetric(task_type, hours_saved, errors_prevented, cost_saved_usd);
    res.json({ status: "success" });
  });


  // 2. Client Asset Compilation & Static File Serving
  if (process.env.NODE_ENV !== "production") {
    console.log("[Server] Development mode: Injecting Vite asset-compilation middlewares");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[Server] Production mode: Serving pre-built static assets");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] GxPilot is accessible externally at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[Server] Initialization crashed:", err);
});
