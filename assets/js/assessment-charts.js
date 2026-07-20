(function attachAssessmentCharts(global) {
  const pointsToPath = (points, firstCommand = "M") =>
    points
      .map((point, index) => `${index === 0 ? firstCommand : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
      .join(" ");

  const pointsToCurvePath = (points, { firstCommand = "M", smooth = true } = {}) => {
    if (!smooth || points.length < 3) return pointsToPath(points, firstCommand);
    const tension = 0.82;
    const segments = [`${firstCommand} ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`];
    for (let index = 0; index < points.length - 1; index += 1) {
      const p0 = points[index - 1] ?? points[index];
      const p1 = points[index];
      const p2 = points[index + 1];
      const p3 = points[index + 2] ?? p2;
      const c1 = {
        x: p1.x + ((p2.x - p0.x) / 6) * tension,
        y: p1.y + ((p2.y - p0.y) / 6) * tension,
      };
      const c2 = {
        x: p2.x - ((p3.x - p1.x) / 6) * tension,
        y: p2.y - ((p3.y - p1.y) / 6) * tension,
      };
      segments.push(
        `C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
      );
    }
    return segments.join(" ");
  };

  const niceTicks = (rawMin, rawMax, targetCount = 5) => {
    if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) {
      return { min: 0, max: 100, ticks: [0, 25, 50, 75, 100] };
    }
    const span = Math.max(1, rawMax - rawMin);
    const rawStep = span / Math.max(1, targetCount - 1);
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const normalized = rawStep / magnitude;
    const stepFactor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
    const step = stepFactor * magnitude;
    let min = Math.floor(rawMin / step) * step;
    let max = Math.ceil(rawMax / step) * step;
    if (min === max) {
      min -= step * 2;
      max += step * 2;
    }
    const ticks = [];
    for (let tick = min; tick <= max + step * 0.5; tick += step) ticks.push(Number(tick.toFixed(6)));
    return { min, max, ticks };
  };

  const layoutRightLabels = (series, yPosition, top, bottom) => {
    const minimumGap = 22;
    const labels = series
      .map((line) => ({ key: line.key, targetY: yPosition(line.latest.value), y: yPosition(line.latest.value) }))
      .sort((left, right) => left.targetY - right.targetY);
    let cursor = top;
    labels.forEach((label) => {
      label.y = Math.max(label.targetY, cursor);
      cursor = label.y + minimumGap;
    });
    for (let index = labels.length - 1; index >= 0; index -= 1) {
      const maxY = index === labels.length - 1 ? bottom : labels[index + 1].y - minimumGap;
      labels[index].y = Math.min(labels[index].y, maxY);
    }
    cursor = top;
    labels.forEach((label) => {
      label.y = Math.max(label.y, cursor);
      cursor = label.y + minimumGap;
    });
    return new Map(labels.map((label) => [label.key, label.y]));
  };

  global.AssessmentCharts = Object.freeze({ layoutRightLabels, niceTicks, pointsToCurvePath, pointsToPath });
})(window);
