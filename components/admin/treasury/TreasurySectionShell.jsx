import { memo } from "react";
import { TREASURY_INTELLIGENCE_FALLBACK } from "./constants";
import { sectionFallbackCardStyle, sectionFallbackTextStyle } from "./treasuryStyles";

export function treasurySectionStatusMessage(loading, loadingLabel = "Loading…") {
  return loading ? loadingLabel : TREASURY_INTELLIGENCE_FALLBACK;
}

function TreasurySectionShellInner({ loading, loadingLabel = "Loading…" }) {
  const message = treasurySectionStatusMessage(loading, loadingLabel);

  return (
    <div style={sectionFallbackCardStyle} aria-busy={loading || undefined}>
      <p style={sectionFallbackTextStyle} role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}

const TreasurySectionShell = memo(TreasurySectionShellInner);
export default TreasurySectionShell;
