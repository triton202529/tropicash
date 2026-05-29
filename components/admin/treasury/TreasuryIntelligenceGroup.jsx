import { memo, useCallback, useId, useState } from "react";
import { TREASURY_GROUP_SECTION_COUNTS } from "./constants";
import { groupStatusBadgeStyle, recommendedFirstBadgeStyle } from "./groupStatus";
import { treasuryFocusRingClass } from "./treasuryStyles";

const groupWrapperStyle = {
  scrollMarginTop: "5.5rem",
  marginBottom: "1.875rem",
  maxWidth: "100%",
};

const groupToggleRecommendedStyle = {
  border: "1px solid #7dd3fc",
  background: "linear-gradient(180deg, #ffffff 0%, #f0f9ff 100%)",
  boxShadow: "0 4px 16px rgba(14, 165, 233, 0.12)",
};

const groupToggleDefaultStyle = {
  border: "1px solid #cbd5e1",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)",
};

const groupTitleStyle = {
  margin: 0,
  fontSize: "clamp(0.9rem, 2.5vw, 0.95rem)",
  fontWeight: 700,
  color: "#0f172a",
  letterSpacing: "-0.01em",
  wordBreak: "break-word",
};

const groupSectionCountCollapsedStyle = {
  fontSize: "0.68rem",
  fontWeight: 600,
  color: "#64748b",
};

const groupDescriptionStyle = {
  margin: "0 0 0.35rem",
  fontSize: "0.8125rem",
  color: "#64748b",
  lineHeight: 1.5,
  wordBreak: "break-word",
};

const groupPriorityStyle = {
  margin: 0,
  fontSize: "0.72rem",
  color: "#94a3b8",
  lineHeight: 1.4,
  fontWeight: 600,
  wordBreak: "break-word",
};

const groupSectionCountOpenStyle = {
  margin: "0.35rem 0 0",
  fontSize: "0.68rem",
  color: "#94a3b8",
};

const groupChevronStyle = {
  flexShrink: 0,
  fontSize: "1.1rem",
  color: "#64748b",
  transition: "transform 0.2s ease",
  marginTop: "0.15rem",
};

const groupPanelStyle = { paddingTop: "1.15rem", maxWidth: "100%" };


function TreasuryIntelligenceGroupInner({
  id,
  title,
  subtitle,
  description,
  sectionCount,
  statusLabel,
  statusVariant = "neutral",
  priorityLabel,
  recommendedFirst = false,
  defaultOpen = false,
  onActivate,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reactId = useId();
  const headerId = `${id}-heading-${reactId.replace(/:/g, "")}`;
  const contentId = `${id}-panel`;
  const resolvedDescription = description || subtitle;
  const resolvedSectionCount = sectionCount ?? TREASURY_GROUP_SECTION_COUNTS[id] ?? null;
  const sectionCountLabel =
    resolvedSectionCount != null
      ? `${resolvedSectionCount} section${resolvedSectionCount === 1 ? "" : "s"}`
      : null;

  const handleToggle = useCallback(() => {
    onActivate?.(id);
    setOpen((v) => !v);
  }, [id, onActivate]);

  const titleRowMarginBottom = resolvedDescription || priorityLabel ? "0.4rem" : 0;

  const chevronStyle = open
    ? { ...groupChevronStyle, transform: "rotate(180deg)" }
    : { ...groupChevronStyle, transform: "rotate(0deg)" };

  const panelContent = typeof children === "function" ? children() : children;
  const toggleVisualStyle = recommendedFirst ? groupToggleRecommendedStyle : groupToggleDefaultStyle;

  return (
    <div id={id} style={groupWrapperStyle} className="sm:mb-7">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        aria-controls={contentId}
        style={toggleVisualStyle}
        className={`flex min-h-[44px] w-full max-w-full items-start justify-between gap-3 rounded-[14px] px-3 py-3 text-left sm:gap-3.5 sm:px-4 sm:py-3.5 ${treasuryFocusRingClass}`}
      >
        <div className="min-w-0 flex-1">
          <div
            className="flex flex-col items-start gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1.5"
            style={{ marginBottom: titleRowMarginBottom }}
          >
            <h2 id={headerId} style={groupTitleStyle}>
              {title}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {recommendedFirst ? (
                <span style={recommendedFirstBadgeStyle()} aria-label="Recommended first section">
                  Recommended first
                </span>
              ) : null}
              {statusLabel ? (
                <span style={groupStatusBadgeStyle(statusVariant)} aria-label={`Group status: ${statusLabel}`}>
                  {statusLabel}
                </span>
              ) : null}
              {!open && sectionCountLabel ? (
                <span style={groupSectionCountCollapsedStyle} aria-label={`${sectionCountLabel} in this group`}>
                  {sectionCountLabel}
                </span>
              ) : null}
            </div>
          </div>
          {resolvedDescription ? <p style={groupDescriptionStyle}>{resolvedDescription}</p> : null}
          {priorityLabel ? <p style={groupPriorityStyle}>{priorityLabel}</p> : null}
          {open && sectionCountLabel ? (
            <p style={groupSectionCountOpenStyle} aria-label={`${sectionCountLabel} in this group`}>
              {sectionCountLabel}
            </p>
          ) : null}
        </div>
        <span aria-hidden="true" style={chevronStyle}>
          ▾
        </span>
      </button>
      {open ? (
        <div
          id={contentId}
          role="region"
          aria-labelledby={headerId}
          style={groupPanelStyle}
          className="max-w-full break-words"
        >
          {panelContent}
        </div>
      ) : null}
    </div>
  );
}

const TreasuryIntelligenceGroup = memo(TreasuryIntelligenceGroupInner);
export default TreasuryIntelligenceGroup;
