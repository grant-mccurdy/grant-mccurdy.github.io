(function attachAssessmentCore(global) {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const fmtPct = (value) => `${Math.round(value)}%`;
  const unique = (items) =>
    [...new Set(items)].sort((left, right) => String(left).localeCompare(String(right), undefined, { numeric: true }));

  const fmtPts = (value, precision = 0) => {
    if (!Number.isFinite(value)) return "-";
    const rounded = Number(value.toFixed(precision));
    const displayValue = Object.is(rounded, -0) ? 0 : rounded;
    return `${displayValue > 0 ? "+" : ""}${displayValue.toFixed(precision)} pts`;
  };

  const fmtPtsAuto = (value) => fmtPts(value, Math.abs(value) > 0 && Math.abs(value) < 1 ? 1 : 0);

  const quantile = (values, pct) => {
    const sorted = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
    if (!sorted.length) return 0;
    const index = (sorted.length - 1) * pct;
    const low = Math.floor(index);
    const high = Math.ceil(index);
    if (low === high) return sorted[low];
    return sorted[low] * (high - index) + sorted[high] * (index - low);
  };

  const mean = (values) => {
    const numeric = values.filter((value) => Number.isFinite(value));
    return numeric.length ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length : 0;
  };

  const averageFinite = (values) => {
    const numeric = values.filter((value) => Number.isFinite(value));
    return numeric.length ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length : NaN;
  };

  const periodWindowText = (period) =>
    `${period.assessmentWindow ?? ""} ${period.season ?? ""} ${period.label ?? ""}`.toLowerCase();
  const isBeginningWindow = (period) => periodWindowText(period).includes("beginning") || /\bboy\b/.test(periodWindowText(period));
  const isEndWindow = (period) => periodWindowText(period).includes("end") || /\beoy\b/.test(periodWindowText(period));

  const boyEoyPairs = (periods) => {
    const sorted = [...periods].sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
    const pairs = [];
    sorted.forEach((period, index) => {
      if (!isBeginningWindow(period)) return;
      for (let nextIndex = index + 1; nextIndex < sorted.length; nextIndex += 1) {
        const candidate = sorted[nextIndex];
        if (isBeginningWindow(candidate)) break;
        if (isEndWindow(candidate)) {
          pairs.push({ begin: period, end: candidate });
          break;
        }
      }
    });
    return pairs;
  };

  const escapeSvgText = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const escapeHtml = (value) =>
    escapeSvgText(value).replaceAll("'", "&#39;");

  global.AssessmentCore = Object.freeze({
    averageFinite,
    boyEoyPairs,
    clamp,
    escapeHtml,
    escapeSvgText,
    fmtPct,
    fmtPts,
    fmtPtsAuto,
    mean,
    quantile,
    unique,
  });
})(window);
