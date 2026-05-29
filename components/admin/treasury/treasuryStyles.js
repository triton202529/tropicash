export const cardBase = {
  background: "#ffffff",
  borderRadius: "14px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
};

export const btnSm = {
  padding: "0.32rem 0.55rem",
  fontSize: "0.68rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
  cursor: "pointer",
  fontWeight: 600,
  color: "#0f172a",
  marginTop: "0.25rem",
};

export const btnOptionActive = {
  padding: "0.28rem 0.5rem",
  fontSize: "0.68rem",
  borderRadius: "8px",
  border: "1px solid #0ea5e9",
  background: "#f0f9ff",
  color: "#0369a1",
  cursor: "pointer",
  fontWeight: 600,
};

/** Shared focus ring for treasury interactive controls */
export const treasuryFocusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2";

/** Tailwind utility bundles for readability rhythm */
export const treasurySectionSpacingClass = "mb-6 sm:mb-7";
export const treasuryExecutiveSectionSpacingClass = "mb-7 sm:mb-8";
export const treasuryKpiGridClass = "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3";
export const treasurySummaryTextClass = "text-sm leading-relaxed text-slate-600";
export const treasuryListSpacingClass = "space-y-2";
export const treasuryBadgeClass = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

export const sectionHeading = {
  margin: "0 0 0.75rem",
  fontSize: "0.8rem",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#94a3b8",
};

export const treasurySectionStyle = { marginBottom: "1.625rem" };

export const treasuryExecutiveSectionStyle = { marginBottom: "1.875rem" };

export const treasurySectionIntroStyle = {
  margin: "0 0 0.85rem",
  fontSize: "0.8125rem",
  color: "#64748b",
  lineHeight: 1.5,
};

export const treasuryCardPaddingStyle = { padding: "1.15rem 1.25rem" };

export const treasuryKpiCardStyle = {
  ...cardBase,
  padding: "1rem 1.1rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.45rem",
};

export const treasuryKpiLabelStyle = {
  margin: 0,
  fontSize: "0.75rem",
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "#64748b",
};

export const treasuryKpiGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
  gap: "0.875rem",
  marginBottom: "1.1rem",
};

export const treasuryKpiGridMediumStyle = {
  ...treasuryKpiGridStyle,
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
};

export const treasuryKpiGridWideStyle = {
  ...treasuryKpiGridStyle,
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))",
  gap: "1rem",
};

export const treasuryInnerKpiTileStyle = {
  padding: "0.8rem 0.9rem",
  borderRadius: "12px",
  background: "#f8fafc",
  border: "1px solid #f1f5f9",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: "0.4rem",
};

export const treasurySummaryTextStyle = {
  margin: 0,
  fontSize: "0.875rem",
  color: "#475569",
  lineHeight: 1.625,
};

export const treasurySummaryLeadStyle = {
  ...treasurySummaryTextStyle,
  fontWeight: 600,
  color: "#334155",
};

export const treasurySummaryLabelStyle = {
  margin: "0 0 0.45rem",
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#64748b",
};

export const treasurySummaryBlockStyle = {
  padding: "0.9rem 1.05rem",
  borderRadius: "10px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

export const treasuryPanelHighlightStyle = {
  marginBottom: "1.1rem",
  padding: "0.9rem 1.05rem",
  borderRadius: "10px",
  background: "#f0f9ff",
  border: "1px solid #bae6fd",
};

export const treasuryListStyle = {
  margin: 0,
  paddingLeft: "1.15rem",
  display: "grid",
  gap: "0.5rem",
};

export const treasuryListItemStyle = {
  fontSize: "0.8125rem",
  color: "#475569",
  lineHeight: 1.5,
};

export const treasuryBadgeBaseStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.125rem 0.5rem",
  borderRadius: "999px",
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
  lineHeight: 1.35,
};

export function treasuryBadgeStyle(palette) {
  return {
    ...treasuryBadgeBaseStyle,
    background: palette.bg,
    color: palette.fg,
    border: `1px solid ${palette.border}`,
  };
}

export const sectionFallbackCardStyle = { ...cardBase, padding: "1rem 1.1rem" };

export const sectionFallbackTextStyle = {
  margin: 0,
  color: "#64748b",
  lineHeight: 1.625,
  fontSize: "0.875rem",
};
