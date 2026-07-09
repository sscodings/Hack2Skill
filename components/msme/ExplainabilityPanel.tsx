"use client";

import { ScoreExplanation } from "@/lib/api";
import { ML_FEATURE_LABELS } from "@/lib/mlFeatures";

interface ExplainabilityPanelProps {
  explanation?: ScoreExplanation;
}

// Helper to format feature value into human-readable form
function formatFeatureValue(feature: string, value: number): string {
  if (value === undefined || value === null || isNaN(value)) return "N/A";
  
  if (feature === "promoter_credit_score") {
    return Math.round(value).toString();
  }
  if (feature.endsWith("_value") || feature.endsWith("_inr") || feature.endsWith("_monthly_inr") || feature.endsWith("_volume_inr_monthly")) {
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(1)}Cr`;
    }
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(1)}L`;
    }
    return `₹${Math.round(value).toLocaleString("en-IN")}`;
  }
  if (feature === "gst_filing_regularity_score") {
    return `${value.toFixed(1)}%`;
  }
  if (feature === "upi_txn_frequency_monthly") {
    return `${Math.round(value)} txns`;
  }
  if (feature === "epfo_contribution_consistency_months") {
    return `${Math.round(value)} months`;
  }
  if (feature === "aa_linked_accounts_count") {
    return `${Math.round(value)} accounts`;
  }
  return value.toString();
}

export default function ExplainabilityPanel({ explanation }: ExplainabilityPanelProps) {
  if (!explanation || !explanation.contributions || explanation.contributions.length === 0) {
    return (
      <div
        className="card-static"
        style={{
          backgroundColor: "#FAF8F3",
          border: "1px solid rgba(201,166,107,0.2)",
          borderTop: "3px solid #9B9188",
          borderRadius: "5px",
          boxShadow: "0 2px 8px rgba(58, 52, 44, 0.055)",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "0.85rem",
            color: "#9B9188",
            margin: 0,
            fontStyle: "italic",
          }}
        >
          Detailed AI explanation available once your score is model-generated.
        </p>
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "0.65rem",
            color: "#BCAE9F",
            marginTop: "1rem",
            marginBottom: 0,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Powered by ML model ml-rf-v1 · SHAP explainability
        </p>
      </div>
    );
  }

  // Get top 6 by absolute SHAP value
  const topContributions = [...explanation.contributions]
    .sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value))
    .slice(0, 6);

  // Find max absolute SHAP value to normalize the progress bars
  const maxAbsShap = Math.max(...topContributions.map((c) => Math.abs(c.shap_value)), 0.1);

  return (
    <div
      className="card-static"
      style={{
        backgroundColor: "#FAF8F3",
        border: "1px solid rgba(201,166,107,0.2)",
        borderTop: "3px solid #1B3A2F",
        borderRadius: "5px",
        boxShadow: "0 2px 8px rgba(58, 52, 44, 0.055)",
        padding: "1.5rem",
      }}
    >
      <h3
        style={{
          fontFamily: "Playfair Display, serif",
          fontSize: "1rem",
          fontWeight: 600,
          color: "#3A342C",
          margin: "0 0 1rem 0",
        }}
      >
        AI Score Driver Analysis
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {topContributions.map((c, index) => {
          const isPositive = c.shap_value >= 0;
          const pct = Math.min(100, Math.max(5, (Math.abs(c.shap_value) / maxAbsShap) * 100));
          const label = ML_FEATURE_LABELS[c.feature] || c.feature;
          const formattedVal = formatFeatureValue(c.feature, c.feature_value);
          const barColor = isPositive ? "#2E5E4E" : "#8B3A3A";
          const sign = isPositive ? "+" : "";

          return (
            <div key={c.feature} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  fontFamily: "Inter, sans-serif",
                  fontSize: "0.75rem",
                }}
              >
                <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, color: "#3A342C" }}>{label}</span>
                  <span style={{ color: "#9B9188", fontSize: "0.7rem" }}>({formattedVal})</span>
                </div>
                <span style={{ fontWeight: 700, color: barColor }}>
                  {sign}{c.shap_value.toFixed(2)}
                </span>
              </div>
              <div
                style={{
                  width: "100%",
                  height: "8px",
                  backgroundColor: "rgba(201, 166, 107, 0.08)",
                  borderRadius: "4px",
                  overflow: "hidden",
                  display: "flex",
                  justifyContent: isPositive ? "flex-start" : "flex-end",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    backgroundColor: barColor,
                    borderRadius: "4px",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "0.65rem",
          color: "#9B9188",
          marginTop: "1.25rem",
          marginBottom: 0,
          textAlign: "center",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Powered by ML model ml-rf-v1 · SHAP explainability
      </p>
    </div>
  );
}
