// Human-readable labels for the 9 ML feature names
export const ML_FEATURE_LABELS: Record<string, string> = {
  promoter_credit_score: "Promoter's Personal Credit Score",
  commercial_assets_value: "Commercial Assets Value",
  bank_asset_value: "Bank Asset Value",
  gst_monthly_turnover_inr: "Monthly GST Turnover",
  gst_filing_regularity_score: "GST Filing Regularity",
  upi_txn_frequency_monthly: "Monthly UPI Transaction Frequency",
  upi_txn_volume_inr_monthly: "Monthly UPI Transaction Volume",
  epfo_contribution_consistency_months: "EPFO Contribution Consistency",
  aa_linked_accounts_count: "Linked Account-Aggregator Accounts",
};

export function getFeatureLabel(featureName: string): string {
  return ML_FEATURE_LABELS[featureName] || featureName;
}
