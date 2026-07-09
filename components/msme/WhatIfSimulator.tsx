"use client";
 
import { useState, useEffect, useRef } from "react";
import { simulateScore as simulateScoreApi, type ScoreExplanation } from "@/lib/api";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { getBandFromScore, getScoreBandColor, getBandLabel } from "@/lib/utils";
import ExplainabilityPanel from "./ExplainabilityPanel";
 
interface WhatIfSimulatorProps {
  baseScore: number;
  msmeId: string;
  profileData?: any;
}
 
// Local simulation calculation to ensure deterministic and correct signs/contributions
export function simulateScore(params: {
  gstCompliance: number;
  upiTurnover: number;
  upiTxnFrequency: number;
  promoterCreditScore: number;
}): number {
  const base = 42;
  const gst_contribution = (params.gstCompliance / 100) * 18;
  const upi_turnover_contrib = (Math.min(30, params.upiTurnover) / 30) * 15;
  const upi_freq_contrib = (params.upiTxnFrequency / 100) * 15;
  const promoter_contrib = ((params.promoterCreditScore - 300) / 600) * 10;
  return Math.round(base + gst_contribution + upi_turnover_contrib + upi_freq_contrib + promoter_contrib);
}
 
export default function WhatIfSimulator({ baseScore, msmeId, profileData }: WhatIfSimulatorProps) {
  const [gstCompliance, setGstCompliance] = useState(75);
  const [upiTurnover, setUpiTurnover] = useState(8);
  const [upiTxnFrequency, setUpiTxnFrequency] = useState(15);
  const [promoterCreditScore, setPromoterCreditScore] = useState(650);
 
  const [initialGst, setInitialGst] = useState<number | null>(null);
  const [initialUpiTurnover, setInitialUpiTurnover] = useState<number | null>(null);
  const [initialUpiFreq, setInitialUpiFreq] = useState<number | null>(null);
  const [initialPromoter, setInitialPromoter] = useState<number | null>(null);

  const [isModified, setIsModified] = useState(false);
  const [simScore, setSimScore] = useState(baseScore);
  const [explanation, setExplanation] = useState<ScoreExplanation | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
 
  // Sync sliders with profileData once loaded
  useEffect(() => {
    if (profileData) {
      const gst = profileData.gst_filing_regularity_score ?? 75;
      const upiT = Math.min(30, (profileData.upi_txn_volume_inr_monthly ?? 800000) / 100000);
      const upiF = profileData.upi_txn_frequency_monthly ?? 15;
      const prom = profileData.promoter_credit_score ?? 650;

      setGstCompliance(gst);
      setUpiTurnover(upiT);
      setUpiTxnFrequency(upiF);
      setPromoterCreditScore(prom);

      setInitialGst(gst);
      setInitialUpiTurnover(upiT);
      setInitialUpiFreq(upiF);
      setInitialPromoter(prom);
    }
  }, [profileData]);
 
  // Sync simulated score locally using relative delta scaling from the baseScore
  useEffect(() => {
    if (isModified && initialGst !== null && initialUpiTurnover !== null && initialUpiFreq !== null && initialPromoter !== null) {
      const baseContrib = 
        (initialGst / 100) * 18 +
        (initialUpiTurnover / 30) * 15 +
        (initialUpiFreq / 100) * 15 +
        ((initialPromoter - 300) / 600) * 10;

      const currentContrib = 
        (gstCompliance / 100) * 18 +
        (upiTurnover / 30) * 15 +
        (upiTxnFrequency / 100) * 15 +
        ((promoterCreditScore - 300) / 600) * 10;

      const delta = currentContrib - baseContrib;
      const maxDelta = 58 - baseContrib;
      const minDelta = 0 - baseContrib;

      let calculated = baseScore;
      if (delta > 0 && maxDelta > 0) {
        calculated = baseScore + (delta / maxDelta) * (100 - baseScore);
      } else if (delta < 0 && minDelta < 0) {
        calculated = baseScore + (delta / minDelta) * (30 - baseScore);
      }

      setSimScore(Math.max(30, Math.min(100, Math.round(calculated))));
    } else {
      setSimScore(baseScore);
    }
  }, [gstCompliance, upiTurnover, upiTxnFrequency, promoterCreditScore, isModified, baseScore, initialGst, initialUpiTurnover, initialUpiFreq, initialPromoter]);
 
  // Debounced effect for running the What-If simulation for backend validation & SHAP explanations
  useEffect(() => {
    if (!isModified) {
      setExplanation(undefined);
      return;
    }

    // Cancel any previous in-flight request immediately
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
 
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const features = {
          gst_compliance_score: gstCompliance / 100,
          upi_turnover_score: upiTurnover / 20,
          upi_txn_frequency_monthly: upiTxnFrequency,
          epfo_stability_score: profileData?.epfo_stability_score || 0.7,
          revenue_growth_score: profileData?.revenue_growth_score || 0.5,
          debt_service_ratio: profileData?.debt_service_ratio || 0.35,
          promoter_credit_score: promoterCreditScore,
          business_age_score: profileData?.business_age_score || 0.6,
          data_completeness_score: profileData?.data_completeness_score || 0.8,
          fraud_risk_score: profileData?.fraud_risk_score || 0.1
        };
 
        // Try direct call to Python ML Service (/simulate endpoint) first
        let res;
        try {
          const response = await fetch("http://127.0.0.1:8000/simulate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(features),
            signal: controller.signal
          });
          if (!response.ok) throw new Error("direct 8000 failed");
          res = await response.json();
        } catch (e: any) {
          if (e.name === 'AbortError') return;
          try {
            // Final fallback to simulateScoreApi helper (which goes through Express server.js /simulate)
            const { promoter_credit_score, upi_txn_frequency_monthly, ...restFeatures } = features;
            const compatFeatures = {
              promoter_credit_score: promoterCreditScore,
              commercial_assets_value: profileData?.commercial_assets_value ?? 0,
              bank_asset_value: profileData?.bank_asset_value ?? 0,
              gst_monthly_turnover_inr: profileData?.gst_monthly_turnover_inr ?? 0,
              gst_filing_regularity_score: gstCompliance,
              upi_txn_frequency_monthly: upiTxnFrequency,
              upi_txn_volume_inr_monthly: upiTurnover * 100000,
              epfo_contribution_consistency_months: profileData?.epfo_contribution_consistency_months ?? 0,
              aa_linked_accounts_count: profileData?.aa_linked_accounts_count ?? 1,
              ...restFeatures
            };
            res = await simulateScoreApi(msmeId, compatFeatures);
          } catch (err: any) {
            if (err.name === 'AbortError') return;
            console.error("Direct and proxy fallback simulation failed:", err);
          }
        }
 
        if (controller.signal.aborted) return;
 
        if (res) {
          // Do not overwrite display score with the model's saturated prediction
          setExplanation(res.explanation || undefined);
        }
        setLoading(false);
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.error("Simulation error:", err);
        setLoading(false);
      }
    }, 250); // 250ms debounce
 
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [gstCompliance, upiTurnover, upiTxnFrequency, promoterCreditScore, isModified, msmeId, profileData]);

  const band = getBandFromScore(simScore);
  const color = getScoreBandColor(band);

  const handleReset = () => {
    setGstCompliance(profileData?.gst_filing_regularity_score ?? 75);
    setUpiTurnover(Math.min(30, (profileData?.upi_txn_volume_inr_monthly ?? 800000) / 100000));
    setUpiTxnFrequency(profileData?.upi_txn_frequency_monthly ?? 15);
    setPromoterCreditScore(profileData?.promoter_credit_score ?? 650);
    setIsModified(false);
    setSimScore(baseScore);
    setExplanation(undefined);
  };

  /*
    Exposed sliders mapped to features (tied back to feature_importance.json model priorities):
    - gst_compliance_score: ~0.18 importance. Higher filing compliance rate positively boosts overall score.
    - upi_txn_frequency_monthly: ~0.15 importance. Indicates customer activity and business operational continuity.
    - upi_turnover_score: ~0.15 importance. Represents UPI cash inflow volume in lakhs (gains taper off beyond 20L-30L).
    - promoter_credit_score: ~0.10 importance. Positive promoter bureau score mapping (range 300-900).
  */
  const sliders = [
    {
      id: "credit",
      label: "Promoter Credit Score",
      value: promoterCreditScore,
      min: 300,
      max: 900,
      step: 5,
      suffix: "",
      onChange: (v: number) => {
        setPromoterCreditScore(v);
        setIsModified(true);
      },
      hint: "Promoter credit score rating from bureau records (higher is better)",
    },
    {
      id: "gst",
      label: "GST Compliance Rate",
      value: gstCompliance,
      min: 0,
      max: 100,
      step: 1,
      suffix: "%",
      onChange: (v: number) => {
        setGstCompliance(v);
        setIsModified(true);
      },
      hint: "Percentage of months with on-time GST return filing",
    },
    {
      id: "upi_freq",
      label: "Monthly UPI Txn Frequency",
      value: upiTxnFrequency,
      min: 0,
      max: 100,
      step: 1,
      suffix: " txns",
      onChange: (v: number) => {
        setUpiTxnFrequency(v);
        setIsModified(true);
      },
      hint: "Number of monthly UPI transactions (higher indicates active business operations)",
    },
    {
      id: "upi",
      label: "Avg. Monthly UPI Turnover",
      value: upiTurnover,
      min: 0,
      max: 30,
      step: 0.5,
      suffix: "L",
      onChange: (v: number) => {
        setUpiTurnover(v);
        setIsModified(true);
      },
      hint: "Average monthly UPI credit in lakhs (₹) (score gains taper off past ₹20L–₹30L)",
    },
  ];

  return (
    <div className="card-static" style={{ padding: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: "0.25rem" }}>
            What-If Simulator
          </p>
          <h3
            style={{
              fontFamily: "Playfair Display, serif",
              fontSize: "1rem",
              fontWeight: 600,
              color: "#3A342C",
              margin: 0,
            }}
          >
            Explore how changes affect your score
          </h3>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "#9B9188", margin: "0.25rem 0 0" }}>
            Adjust the sliders to simulate different scenarios. No data is changed.
          </p>
        </div>

        {/* Live score preview */}
        <div
          style={{
            textAlign: "center",
            flexShrink: 0,
            backgroundColor: "#F7F4ED",
            border: `1.5px solid ${color}30`,
            borderRadius: "5px",
            padding: "0.625rem 1rem",
            minWidth: "80px",
            opacity: loading ? 0.6 : 1,
            transition: "opacity 150ms",
          }}
        >
          <AnimatedNumber
            value={simScore}
            className="font-serif"
            style={{
              fontFamily: "Playfair Display, serif",
              fontSize: "2rem",
              fontWeight: 600,
              color: loading ? "#9B9188" : color,
              lineHeight: 1,
              display: "block",
              opacity: loading ? 0.5 : 1,
              transition: "color 150ms, opacity 150ms",
            } as React.CSSProperties}
          />
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "0.6rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: loading ? "#9B9188" : color,
              display: "block",
              marginTop: "0.2rem",
              opacity: loading ? 0.5 : 1,
              transition: "color 150ms, opacity 150ms",
            }}
          >
            {loading ? "Updating..." : getBandLabel(band)}
          </span>
        </div>
      </div>

      {/* Sliders */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {sliders.map((slider) => (
          <div key={slider.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.375rem" }}>
              <label
                htmlFor={`sim-${slider.id}`}
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  color: "#3A342C",
                }}
              >
                {slider.label}
              </label>
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "#1B3A2F",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {slider.value}{slider.suffix}
              </span>
            </div>
            <input
              id={`sim-${slider.id}`}
              type="range"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={slider.value}
              onChange={(e) => slider.onChange(Number(e.target.value))}
              style={{
                width: "100%",
                accentColor: "#A8854A",
              }}
            />
            <p
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "0.7rem",
                color: "#9B9188",
                margin: "0.25rem 0 0",
              }}
            >
              {slider.hint}
            </p>
          </div>
        ))}
      </div>

      {/* Reset */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.25rem" }}>
        <button
          onClick={handleReset}
          style={{
            backgroundColor: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontFamily: "Inter, sans-serif",
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#9B9188",
            transition: "color 200ms",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#C9A66B")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#9B9188")}
        >
          Reset to defaults
        </button>
        {loading && (
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.7rem", color: "#A8854A" }}>
            Calculating...
          </span>
        )}
      </div>

      {/* Explainability Panel */}
      <div style={{ marginTop: "1.5rem" }}>
        <ExplainabilityPanel explanation={explanation} />
      </div>
    </div>
  );
}
