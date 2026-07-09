// ── API Layer ──
// Connected to Node.js/Express backend running at http://localhost:4000/api/v1

import {
  type MSMERecord,
  type AuditRecord,
  type ScoreBand,
} from "./mockData";

const API_BASE = "http://localhost:4000/api/v1";

const getHeaders = () => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("saksham_jwt");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return headers;
};

// ── Auth ──
export async function loginUser(
  email: string,
  password: string,
  role: "msme" | "bank_officer" | "admin"
): Promise<{ success: boolean; error?: string; otpRequired?: boolean; email?: string }> {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role }),
    });
    
    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || "Login failed" };
    }
    
    return {
      success: true,
      otpRequired: data.otpRequired,
      email: data.email,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error. Is backend server running?" };
  }
}

export async function registerUser(
  email: string,
  password: string,
  role: "msme" | "bank_officer" | "admin"
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role }),
    });
    
    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || "Registration failed" };
    }
    
    return {
      success: true,
      message: data.message,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error. Is backend server running?" };
  }
}

export async function verifyOtp(
  email: string,
  otp: string
): Promise<{ success: boolean; error?: string; role?: string; user?: any }> {
  try {
    const response = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || "OTP verification failed" };
    }

    if (typeof window !== "undefined" && data.token) {
      localStorage.setItem("saksham_jwt", data.token);
    }

    return {
      success: true,
      role: data.role,
      user: data.user
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error." };
  }
}

// ── MSME ──
export async function getCurrentMSMEDashboard(): Promise<MSMERecord | null> {
  const response = await fetch(`${API_BASE}/msme/me/dashboard`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!response.ok) {
    return null;
  }
  return response.json();
}

export async function getMSMEById(id: string): Promise<MSMERecord | null> {
  // If logged in as bank officer, fetch officer applicants details, else fetch own dashboard
  if (typeof window !== "undefined") {
    const userStr = localStorage.getItem("msme_fhc_user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.role === "bank_officer") {
          return getMSMEDetail(id);
        }
      } catch (e) {}
    }
  }

  // MSME endpoint
  const response = await fetch(`${API_BASE}/msme/${id}/score`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!response.ok) return null;
  
  // Combine score endpoint details with default profile values for display, or use dashboard
  return getCurrentMSMEDashboard();
}

// ── Bank Officer ──
export async function getAllMSMEs(): Promise<MSMERecord[]> {
  const response = await fetch(`${API_BASE}/officer/applicants`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!response.ok) {
    return [];
  }
  return response.json();
}

export async function getMSMEDetail(id: string): Promise<MSMERecord | null> {
  const response = await fetch(`${API_BASE}/officer/applicants/${id}`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!response.ok) return null;
  return response.json();
}

export async function approveMSME(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/officer/applicants/${id}/decision`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ decision: "approve", note: "Approved by bank officer." }),
  });
  return { success: response.ok };
}

export async function rejectMSME(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/officer/applicants/${id}/decision`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ decision: "reject", note: "Rejected due to credit/fraud flags." }),
  });
  return { success: response.ok };
}

export async function requestMoreInfo(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/officer/applicants/${id}/decision`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ decision: "request_info", note: "More details requested on transaction spikes." }),
  });
  return { success: response.ok };
}

// ── Audit ──
export async function getAuditRecord(auditId: string): Promise<AuditRecord | null> {
  const response = await fetch(`${API_BASE}/audit/${auditId}`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!response.ok) return null;
  return response.json();
}

export async function getAuditByMSMEId(msmeId: string): Promise<AuditRecord | null> {
  const response = await fetch(`${API_BASE}/audit/${msmeId}`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!response.ok) return null;
  return response.json();
}

export async function verifyAuditHash(auditId: string): Promise<{ verified: boolean; hash: string }> {
  const response = await fetch(`${API_BASE}/audit/${auditId}/verify`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ scoreId: auditId }), // auditId maps to scoreId in our routes
  });
  if (!response.ok) {
    return { verified: false, hash: "" };
  }
  return response.json();
}

// ── Onboarding ──
export async function submitBusinessInfo(data: {
  businessName: string;
  sector: string;
  registrationType: string;
  gstin: string;
  ownerName?: string;
  city?: string;
  annualTurnover?: string;
  employeeCount?: string;
}): Promise<{ success: boolean; msmeId: string }> {
  const response = await fetch(`${API_BASE}/onboarding/business-info`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to submit business details");
  }
  return response.json();
}

export async function submitConsent(sources: string[]): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/onboarding/consent`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ sources }),
  });
  return { success: response.ok };
}

export async function connectDataSource(
  source: "gst" | "upi" | "epfo" | "credit"
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/onboarding/connect/${source}`, {
    method: "POST",
    headers: getHeaders(),
  });
  return { success: response.ok };
}

export async function generateScore(): Promise<{ msmeId: string; score: number; band: ScoreBand }> {
  const response = await fetch(`${API_BASE}/onboarding/generate-score`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!response.ok) {
    throw new Error("Failed to compute score");
  }
  return response.json();
}

export interface ScoreExplanation {
  base_value_0_100: number;
  contributions: {
    feature: string;
    shap_value: number;
    feature_value: number;
  }[];
}

declare module "./mockData" {
  export interface MSMERecord {
    explanation?: ScoreExplanation;
    profileData?: {
      promoter_credit_score: number;
      commercial_assets_value: number;
      bank_asset_value: number;
      gst_monthly_turnover_inr: number;
      gst_filing_regularity_score: number;
      upi_txn_frequency_monthly: number;
      upi_txn_volume_inr_monthly: number;
      epfo_contribution_consistency_months: number;
      aa_linked_accounts_count: number;
    };
  }
}

// ── Score simulation (async API call) ──
export async function simulateScore(
  msmeId: string,
  features: {
    promoter_credit_score: number;
    commercial_assets_value: number;
    bank_asset_value: number;
    gst_monthly_turnover_inr: number;
    gst_filing_regularity_score: number;
    upi_txn_frequency_monthly: number;
    upi_txn_volume_inr_monthly: number;
    epfo_contribution_consistency_months: number;
    aa_linked_accounts_count: number;
  }
): Promise<{
  simulated_score: number;
  band: string;
  explanation: ScoreExplanation;
}> {
  const response = await fetch(`${API_BASE}/msme/${msmeId}/simulate`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(features),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to simulate score");
  }

  return response.json();
}

export interface CreditJourney {
  stage: string;
  next_action: string;
  projected_score_low: number;
  projected_score_high: number;
  updated_at: string;
}

export async function getCreditJourney(msmeId: string): Promise<CreditJourney> {
  const response = await fetch(`${API_BASE}/msme/${msmeId}/journey`, {
    headers: getHeaders(),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to fetch credit journey");
  }
  return response.json();
}

export async function sendOtp(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || "Failed to send OTP" };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function lookupGstin(gstin: string): Promise<{ success: boolean; business?: any; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/onboarding/lookup-gstin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gstin }),
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || "GSTIN lookup failed" };
    }
    return { success: true, business: data.business };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function recomputeScore(id: string): Promise<{ success: boolean; score: number; band: string }> {
  const response = await fetch(`${API_BASE}/msme/${id}/score/recompute`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to recompute score");
  }
  return response.json();
}

export async function estimateAnchorScore(id: string): Promise<{ success: boolean; estimate: any }> {
  const response = await fetch(`${API_BASE}/msme/${id}/anchor-score/estimate`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to estimate blockchain gas");
  }
  return response.json();
}

export async function anchorScore(id: string): Promise<{ success: boolean; auditRecord: any }> {
  const response = await fetch(`${API_BASE}/msme/${id}/anchor-score`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to anchor score to blockchain");
  }
  return response.json();
}

