import { memo, useCallback } from "react";
import { TREASURY_INTELLIGENCE_GROUPS } from "./constants";
import { btnOptionActive, btnSm, treasuryFocusRingClass } from "./treasuryStyles";

const quickNavStyle = {
  position: "sticky",
  top: "3.5rem",
  zIndex: 20,
  marginBottom: "1.25rem",
  padding: "0.65rem 0.75rem",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  background: "rgba(248, 250, 252, 0.95)",
  backdropFilter: "blur(8px)",
  boxShadow: "0 4px 12px rgba(15, 23, 42, 0.06)",
  maxWidth: "100%",
  overflowX: "hidden",
  boxSizing: "border-box",
};

const quickNavLabelStyle = {
  margin: "0 0 0.45rem",
  fontSize: "0.65rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#94a3b8",
};

const quickNavButtonBaseStyle = {
  ...btnSm,
  marginTop: 0,
  fontSize: "0.72rem",
  lineHeight: 1.3,
  maxWidth: "100%",
  whiteSpace: "normal",
  textAlign: "left",
  minHeight: "44px",
  padding: "0.5rem 0.75rem",
  boxSizing: "border-box",
};

function TreasuryIntelligenceQuickNavInner({ activeId, onNavigate }) {
  const jump = useCallback(
    (targetId) => {
      onNavigate?.(targetId);
      const el = document.getElementById(targetId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [onNavigate],
  );

  return (
    <nav
      aria-label="Treasury intelligence sections"
      style={quickNavStyle}
      className="sm:px-4 sm:py-3"
    >
      <p style={quickNavLabelStyle}>Jump to section</p>
      <div className="flex max-w-full flex-wrap items-stretch gap-2 sm:gap-2.5">
        {TREASURY_INTELLIGENCE_GROUPS.map((item) => {
          const isActive = activeId === item.id;
          const buttonStyle = isActive
            ? { ...quickNavButtonBaseStyle, ...btnOptionActive }
            : quickNavButtonBaseStyle;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? "true" : undefined}
              aria-label={`Jump to ${item.label}`}
              onClick={() => jump(item.id)}
              style={buttonStyle}
              className={`min-h-[44px] max-w-full break-words px-3 py-2 sm:px-3.5 ${treasuryFocusRingClass}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

const TreasuryIntelligenceQuickNav = memo(TreasuryIntelligenceQuickNavInner);
export default TreasuryIntelligenceQuickNav;
