"use client";

import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import { Info, LogIn, Building2, Link as LinkIcon, Activity, Link2, ShieldAlert } from "lucide-react";

export default function GuidePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "var(--ivory)",
      backgroundImage: "linear-gradient(var(--ivory-dark) 1px, transparent 1px)",
      backgroundSize: "100% 2.5rem",
      backgroundPosition: "0 0.2rem",
      position: "relative",
      paddingBottom: "4rem"
    }}>
      <Navbar />
      
      {/* Pinned Quick Start Box */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backgroundColor: "var(--forest)",
        color: "var(--ivory)",
        padding: "1rem",
        borderBottom: "4px solid var(--gold)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        fontFamily: "'Inter', sans-serif"
      }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.25rem", color: "var(--gold)", margin: "0 0 0.25rem 0" }}>
              Judge Quick Start
            </h2>
            <p style={{ fontSize: "0.85rem", margin: 0, opacity: 0.9 }}>
              Experience the full MSME flow in under 2 minutes.
            </p>
          </div>
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            <div style={{ background: "rgba(255,255,255,0.1)", padding: "0.5rem 1rem", borderRadius: "4px", fontSize: "0.85rem", maxWidth: "250px" }}>
              <strong style={{ color: "var(--gold)", display: "block", marginBottom: "0.2rem" }}>New MSME?</strong>
              Please <strong>Sign Up</strong> using a valid email to receive your OTP securely.
            </div>
            <div style={{ background: "rgba(255,255,255,0.1)", padding: "0.5rem 1rem", borderRadius: "4px", fontSize: "0.85rem", maxWidth: "250px" }}>
              <strong style={{ color: "var(--gold)", display: "block", marginBottom: "0.2rem" }}>New Bank Officer?</strong>
              Please <strong>Sign Up</strong> using a valid email to receive your OTP securely.
            </div>
            <Link href="/login" style={{
              backgroundColor: "var(--gold)",
              color: "var(--forest)",
              fontWeight: 600,
              padding: "0.5rem 1.5rem",
              borderRadius: "4px",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              Go to Login →
            </Link>
          </div>
        </div>
      </div>

      <main style={{ maxWidth: "900px", margin: "3rem auto", padding: "0 1.5rem" }}>
        
        <header style={{ textAlign: "center", marginBottom: "4rem" }}>
          <h1 style={{ 
            fontFamily: "'Playfair Display', serif", 
            fontSize: "3rem", 
            color: "var(--forest)", 
            marginBottom: "1rem",
            fontWeight: 700 
          }}>
            CreditBridge Walkthrough
          </h1>
          <p style={{ 
            fontFamily: "'Inter', sans-serif", 
            fontSize: "1.1rem", 
            color: "var(--charcoal-light)", 
            maxWidth: "600px", 
            margin: "0 auto",
            lineHeight: 1.6
          }}>
            A step-by-step guide to evaluating the CreditBridge platform. Follow this path to see our synthetic data layer, live ML scoring, and on-chain verification in action.
          </p>
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Step 1 */}
          <StepCard 
            number="1"
            title="Sign In & Security"
            icon={<LogIn size={24} color="var(--gold)" />}
            content={
              <>
                Access is OTP-gated. Sign up with your email and password, then receive a one-time passcode. For this hackathon demo, the OTP is delivered securely to the registered email address, so please use a real email that you can check. The underlying generation, verification, and expiry logic is fully built and production-ready for SMS gateway integration.
              </>
            }
          />

          {/* Step 2 */}
          <StepCard 
            number="2"
            title="Business Onboarding via GSTIN"
            icon={<Building2 size={24} color="var(--gold)" />}
            content={
              <>
                Entering a GSTIN triggers a lookup powered by a realistic synthetic data layer that mirrors real GST behavior. For ownership verification, the app displays a masked mobile number (e.g., XXXXXX6808). All demo numbers follow the <code>987654XXXX</code> pattern. Simply type <code>987654</code> followed by the visible last 4 digits to confirm control and proceed.
              </>
            }
          />

          {/* Step 3 */}
          <StepCard 
            number="3"
            title="Connect Alternate Data"
            icon={<LinkIcon size={24} color="var(--gold)" />}
            content={
              <>
                Navigate to the dashboard&apos;s &quot;Data Sources&quot; tab. Grant consent and connect each alternate data stream individually: GST filings, UPI history, EPFO records, and bureau data. Each connection demonstrably increases the &quot;Data Completeness&quot; score and unlocks a highly accurate financial profile.
              </>
            }
          />

          {/* Step 4 */}
          <StepCard 
            number="4"
            title="Live ML Health Score & Explainability"
            icon={<Activity size={24} color="var(--gold)" />}
            content={
              <>
                CreditBridge computes a multidimensional score using a Random Forest model with SHAP explainability. Open the Explainability Panel to see exactly which factors (GST consistency, UPI cash-flow, EPFO trends) drove the score up or down. Use the What-If Simulator to forecast how specific operational improvements affect the score.
              </>
            }
          />

          {/* Step 5 */}
          <StepCard 
            number="5"
            title="Blockchain-Anchored Audit Trail"
            icon={<Link2 size={24} color="var(--gold)" />}
            stamp="DEMO HIGHLIGHT"
            content={
              <>
                Click <strong>&quot;Upload Your Data on Blockchain&quot;</strong> on the dashboard. This anchors the current score hash to the Polygon Amoy testnet. On the Audit page, click <strong>&quot;Verify Hash&quot;</strong> to watch the app re-compute the hash from live data and instantly confirm it matches the on-chain record. This guarantees no MSME can quietly alter their own financial history.
              </>
            }
          />

          {/* Step 6 */}
          <StepCard 
            number="6"
            title="Bank Officer Portal & Fraud Detection"
            icon={<ShieldAlert size={24} color="var(--gold)" />}
            content={
              <>
                Log in as a bank officer to access the portfolio view. The integrated fraud engine runs velocity checks across UPI and GST data (e.g., sudden transaction spikes, filing irregularities) and automatically flags suspicious applicants for manual review before any loan officer acts on the score.
              </>
            }
          />

        </div>

        {/* Closing */}
        <section style={{ 
          marginTop: "4rem", 
          padding: "2.5rem", 
          backgroundColor: "var(--forest)", 
          color: "var(--ivory)",
          borderRadius: "8px",
          border: "1px solid var(--gold)"
        }}>
          <h2 style={{ 
            fontFamily: "'Playfair Display', serif", 
            fontSize: "2rem", 
            color: "var(--gold)", 
            margin: "0 0 1rem 0" 
          }}>
            Why this matters
          </h2>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "1.05rem", lineHeight: 1.7, margin: 0, opacity: 0.9 }}>
            New-to-credit (NTC) and new-to-bank (NTB) MSMEs in tier 2/3 cities are routinely rejected because traditional lenders rely exclusively on legacy financial documents. CreditBridge empowers these businesses to prove their creditworthiness using the operational data they already generate every day (GST, UPI, EPFO), underpinned by a tamper-evident audit trail that institutions can implicitly trust.
          </p>
        </section>

      </main>
    </div>
  );
}

function StepCard({ number, title, icon, content, stamp }: { number: string, title: string, icon: React.ReactNode, content: React.ReactNode, stamp?: string }) {
  return (
    <div style={{
      backgroundColor: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: "8px",
      padding: "2rem",
      display: "flex",
      gap: "1.5rem",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      position: "relative",
      overflow: "hidden"
    }}>
      <div style={{
        width: "48px",
        height: "48px",
        borderRadius: "50%",
        backgroundColor: "var(--forest)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontFamily: "'Playfair Display', serif",
        fontSize: "1.5rem",
        fontWeight: 700,
        color: "var(--gold)"
      }}>
        {number}
      </div>
      
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
          {icon}
          <h3 style={{ 
            fontFamily: "'Playfair Display', serif", 
            fontSize: "1.5rem", 
            color: "var(--forest)",
            margin: 0,
            fontWeight: 600
          }}>
            {title}
          </h3>
        </div>
        <p style={{ 
          fontFamily: "'Inter', sans-serif", 
          fontSize: "1rem", 
          color: "var(--charcoal)", 
          lineHeight: 1.6,
          margin: 0
        }}>
          {content}
        </p>
      </div>

      {stamp && (
        <div style={{
          position: "absolute",
          top: "1rem",
          right: "-1.5rem",
          transform: "rotate(15deg)",
          border: "2px solid #b71c1c",
          color: "#b71c1c",
          padding: "0.25rem 2rem",
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 700,
          fontSize: "0.75rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          opacity: 0.8
        }}>
          {stamp}
        </div>
      )}
    </div>
  );
}
