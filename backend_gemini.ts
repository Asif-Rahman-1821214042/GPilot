import { GoogleGenAI } from "@google/genai";

// Lazy-initialize client to avoid crashing on startup if key is missing
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
      aiClient = new GoogleGenAI({ apiKey });
    }
  }
  return aiClient;
}

export async function analyzeGxpDocument(name: string, docType: string, content: string) {
  const ai = getAiClient();
  if (!ai) {
    console.warn("Warning: GEMINI_API_KEY not configured. Using mock compliance report.");
    return {
      score: 75.0,
      status: "Flagged" as const,
      anomalies: [
        { type: "Configuration", severity: "Medium" as const, message: "API Key is missing from the environment. Showing simulated report." }
      ],
      recommendations: ["Configure GEMINI_API_KEY in your environment/secrets to activate live GxP audits."],
      checklist: [
        { item: "Executive summary verification", status: "PASS" as const },
        { item: "Double signature confirmation", status: "FAIL" as const }
      ]
    };
  }

  const systemInstruction = 
    "You are GxPilot, an expert AI pharmaceutical quality assurance (QA) auditor. " +
    "Your task is to analyze documents against pharmaceutical standards (e.g., 21 CFR Part 211, EU GMP, ICH Q7). " +
    "Provide a structured JSON report with a compliance score (0-100), overall status ('Approved', 'Flagged', 'Rejected'), " +
    "a list of GxP anomalies/violations (containing type, severity, message), a list of regulatory recommendations, " +
    "and a checklist of standard checks with pass/fail status.";

  const prompt = `
    Analyze the following pharmaceutical document:
    File Name: ${name}
    Document Type: ${docType}
    
    Content:
    ${content}
    
    Return a JSON object conforming exactly to this structure:
    {
        "score": float, (e.g. 85.5)
        "status": "Approved" | "Flagged" | "Rejected",
        "anomalies": [
            {
                "type": "Deviation Warning" | "Missing Signature" | "Out of Specification" | "Critical Parameter Check" | "Compliance Risk",
                "severity": "High" | "Medium" | "Low",
                "message": "Detailed description of the anomaly or compliance gap"
            }
        ],
        "recommendations": [
            "Actionable recommendation 1 referencing GxP or CFR codes",
            "Actionable recommendation 2"
        ],
        "checklist": [
            {
                "item": "Check item description (e.g. 21 CFR 211 double signature validation)",
                "status": "PASS" | "FAIL" | "N/A"
            }
        ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Error analyzing GxP document with Gemini:", error);
    return {
      score: 60.0,
      status: "Flagged" as const,
      anomalies: [
        { type: "Compliance Risk", severity: "High" as const, message: `Error performing live GxP analysis: ${error.message}` }
      ],
      recommendations: [
        "Re-run analysis once server connectivity is validated.",
        "Ensure standard Operating Procedures are followed for file formats."
      ],
      checklist: [
        { item: "Server analytical connection", status: "FAIL" as const }
      ]
    };
  }
}

export async function draftGxpSop(title: string, steps: string, roles: string, regulations: string[]) {
  const ai = getAiClient();
  if (!ai) {
    return `# SOP Draft: ${title}\n\n**Warning: GEMINI_API_KEY is not configured.** This is a fallback mock SOP document.\n\n### 1. PURPOSE\nTo detail the steps for: ${title}.\n\n### 2. RESPONSIBILITIES\n- **Roles involved**: ${roles}\n\n### 3. PROCEDURE\n${steps}\n\n### 4. COMPLIANCE\nVerified against: ${regulations.join(", ")}. Please configure GEMINI_API_KEY for complete compliant drafting.`;
  }

  const systemInstruction = 
    "You are an expert pharmaceutical technical writer and QA systems architect. " +
    "You draft highly professional Standard Operating Procedures (SOPs) that comply with " +
    "FDA 21 CFR 211, EU GMP, and ICH guidelines.";

  const prompt = `
    Draft a Standard Operating Procedure (SOP) based on these details:
    Title: ${title}
    Operational Steps: ${steps}
    Responsible Roles: ${roles}
    Applicable Regulations: ${regulations.join(", ")}
    
    Format the SOP beautifully using Markdown, with the following standard sections:
    1. PURPOSE
    2. SCOPE
    3. RESPONSIBILITIES
    4. PROCEDURE (detailed, step-by-step instructions based on user inputs)
    5. COMPLIANCE & DOCUMENT CONTROL (detailing double signature verification, 21 CFR Part 11 requirements, versioning)
    6. REFERENCES (including specified CFR/GMP references)
    
    Include placeholder fields like [Document ID: SOP-QA-XXX], [Effective Date: DD-MM-YYYY], [Author Sign], [QA Approver Sign].
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { systemInstruction }
    });
    return response.text || "Failed to generate SOP text";
  } catch (error: any) {
    console.error("Error drafting SOP with Gemini:", error);
    return `# Draft Generation Error\n\nFailed to draft SOP due to: ${error.message}`;
  }
}

export async function draftGxpApqr(batchSummary: string, deviations: string, stability: string) {
  const ai = getAiClient();
  if (!ai) {
    return `# Annual Product Quality Review (APQR) Draft\n\n**Warning: GEMINI_API_KEY is not configured.** This is a fallback mock APQR document.\n\n### 1. BATCH PRODUCTION METRICS\n${batchSummary}\n\n### 2. DEVIATIONS & OOS REPORT\n${deviations}\n\n### 3. STABILITY STUDY ANALYSIS\n${stability}\n\n### 4. CONCLUSION\nPlease configure GEMINI_API_KEY to activate generative compliance trend synthesis.`;
  }

  const systemInstruction = 
    "You are an expert QA Executive specializing in compiling Annual Product Quality Reviews (APQR) " +
    "conforming to EU GMP Annex 15 and FDA guidance.";

  const prompt = `
    Compile a formal Annual Product Quality Review (APQR) summary report with the following input data:
    
    Batch production summary: ${batchSummary}
    Deviations and OOS log: ${deviations}
    Stability and QC data: ${stability}
    
    Format the APQR beautifully using Markdown with these sections:
    1. EXECUTIVE SUMMARY (overall compliance opinion and trend overview)
    2. BATCH PRODUCTION METRICS (analysis of batch counts, yields, and target parameters)
    3. DEVIATIONS & OUT-OF-SPECIFICATION (OOS) REPORT (detailed audit of logged incidents, root causes, and corrective actions)
    4. STABILITY STUDY ANALYSIS (evaluation of assay and purity over time points)
    5. CONCLUSION & CORRECTIVE AND PREVENTIVE ACTIONS (CAPA)
    
    Embed compliance confidence estimates and professional quality summaries.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { systemInstruction }
    });
    return response.text || "Failed to compile APQR";
  } catch (error: any) {
    console.error("Error compiling APQR with Gemini:", error);
    return `# APQR Draft Generation Error\n\nFailed to draft APQR due to: ${error.message}`;
  }
}

export async function answerGxpChat(message: string, history: { role: string; content: string }[]) {
  const ai = getAiClient();
  if (!ai) {
    return "I am running in local fallback mode because GEMINI_API_KEY is not configured. Ask me about 21 CFR Part 211, EU GMP guidelines, or deviation handling once the key is set!";
  }

  const systemInstruction = 
    "You are GxPilot compliance chatbot, a warm, authoritative QA expert assistant. " +
    "Your role is to help pharmaceutical quality executives look up CFR guidelines, explain EU GMP Annexes, " +
    "offer advice on handling out-of-specification (OOS) results, deviations, CAPAs, " +
    "and provide guidance on SOP design. Keep your answers practical, citation-grounded (e.g. citing 21 CFR 211.192), " +
    "and direct. Avoid fluff.";

  let historyStr = "";
  for (const h of history.slice(-8)) {
    const roleLabel = h.role === "user" ? "User" : "GxPilot";
    historyStr += `${roleLabel}: ${h.content}\n`;
  }

  const prompt = `
    Below is the chat history:
    ${historyStr}
    
    User message: ${message}
    
    Please provide your compliance guidance reply:
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { systemInstruction }
    });
    return response.text || "No reply generated";
  } catch (error: any) {
    console.error("Error answering GxP chat with Gemini:", error);
    return `I'm sorry, I encountered an issue consulting the compliance model: ${error.message}`;
  }
}
