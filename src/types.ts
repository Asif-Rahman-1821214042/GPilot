export interface AuditTrailEvent {
  time: string;
  user: string;
  event: string;
}

export interface Anomaly {
  type: string;
  severity: "High" | "Medium" | "Low";
  message: string;
  mitigation?: string;
}

export interface Recommendation {
  text: string;
}

export interface ChecklistItem {
  item: string;
  status: "PASS" | "FAIL" | "N/A";
}

export interface ComplianceCheck {
  id: string;
  score: number;
  status: "Approved" | "Flagged" | "Rejected";
  anomalies: Anomaly[];
  recommendations: string[];
  checklist: ChecklistItem[];
  created_at: string;
}

export interface Document {
  id: string;
  name: string;
  type: "SOP" | "APQR" | "MBR" | "EBR" | "General";
  status: "Draft" | "Under_Review" | "Approved" | "Rejected";
  content?: string;
  content_type?: string;
  file_size?: number;
  audit_trail: AuditTrailEvent[];
  compliance_check?: ComplianceCheck | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface RoiSummary {
  total_hours_saved: number;
  total_errors_prevented: number;
  total_cost_saved_usd: number;
  total_tasks_assisted: number;
  hourly_rate_assumption: number;
}

export interface RoiMetricHistory {
  id: number;
  task_type: string;
  hours_saved: number;
  errors_prevented: number;
  cost_saved_usd: number;
  created_at: string;
}

export interface RoiMetricsData {
  summary: RoiSummary;
  history: RoiMetricHistory[];
}

export interface DashboardFeedItem {
  type: string;
  severity: "High" | "Medium" | "Low";
  message: string;
  document_id: string;
  score: number;
  created_at: string;
}

export interface DashboardMetrics {
  compliance_index: {
    score: number;
    label: string;
    documents_scanned: number;
  };
  quality_efficiency: {
    hours_saved: number;
    errors_prevented: number;
    cost_saved_usd: number;
    tasks_assisted: number;
  };
  site_compliance_feed: DashboardFeedItem[];
  trend_analysis: {
    yield_values: number[];
    target: number | null;
    stability_delta: number | null;
    oos_rate: number;
    audits_due: number;
  };
}
