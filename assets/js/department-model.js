export const domainNames = {
  Algebra: "Algebra",
  "Advanced Math": "Advanced Math",
  "Problem-Solving/Data Analysis": "Data Analysis",
  "Geometry/Trigonometry": "Geometry & Trigonometry",
};

export function selectRows(rows, { course = "", track = "" }) {
  return rows.filter((row) => (!course || row.course === course) && (!track || row.track === track));
}

export function questionRows(data, filters, scope = "priority", domain = "") {
  const groups = selectRows(data.item_course, filters);
  return data.questions
    .filter((question) => (scope === "all" || data.selected_positions.includes(question.position)) && (!domain || question.domain === domain))
    .map((question) => {
      const rows = groups.filter((row) => row.position === question.position);
      const n = rows.reduce((sum, row) => sum + row.n, 0);
      const correct = rows.reduce((sum, row) => sum + row.correct, 0);
      return { ...question, n, correct, mean: n ? 100 * correct / n : null };
    }).filter((row) => row.n);
}

export function domainRows(data, filters) {
  const selected = selectRows(data.domain, filters);
  return Object.keys(domainNames).map((domain) => {
    const rows = selected.filter((row) => row.domain === domain);
    const n = rows.reduce((sum, row) => sum + row.n, 0);
    return { domain, n, mean: n ? rows.reduce((sum, row) => sum + row.mean * row.n, 0) / n : null };
  }).filter((row) => row.n);
}

export function comparisonRows(data, family, course = "") {
  const belongs = (label) => data.section.some((row) => row.section_id === label && row.course === course)
    || label === course || label.startsWith(`${course} `);
  return data.comparisons.filter((row) => row.family === family && (!course || belongs(row.a) || belongs(row.b)));
}

export function toCsv(headers, rows) {
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [headers, ...rows].map((row) => row.map(quote).join(",")).join("\r\n");
}

export function orderedGroups(data, rows, sort = "course") {
  return [...rows].sort((a, b) => sort === "low" ? a.mean - b.mean : sort === "high" ? b.mean - a.mean
    : data.course_order.indexOf(a.course) - data.course_order.indexOf(b.course)
      || Number(a.track !== "Regular") - Number(b.track !== "Regular")
      || (a.period ?? 0) - (b.period ?? 0));
}

export function populationSummary(data, filters) {
  const groups = selectRows(data.course, filters);
  const n = groups.reduce((sum, row) => sum + row.n, 0);
  return { n, classes: selectRows(data.section, filters).length,
    mean: n ? groups.reduce((sum, row) => sum + row.n * row.mean, 0) / n : null };
}

export function profileRows(data, filters, domain = "") {
  return data.course_order.filter((course) => !filters.course || filters.course === course).flatMap((course) =>
    domainRows(data, { ...filters, course }).filter((row) => !domain || row.domain === domain).map((row) => ({ ...row, course })));
}

// Keep the original exploratory family and reverse only the signed display direction.
export function pairwiseCells(data, groups) {
  return groups.flatMap((a, row) => groups.flatMap((b, column) => {
    if (row === column) return [];
    const aLabel = a.course + " " + a.track;
    const bLabel = b.course + " " + b.track;
    const source = data.pairwise.find((r) => (r.a === aLabel && r.b === bLabel) || (r.a === bLabel && r.b === aLabel));
    if (!source) return [];
    const sign = source.a === aLabel ? 1 : -1;
    return [{ ...source, row, column, a: aLabel, b: bLabel, difference: source.difference * sign,
      low: sign === 1 ? source.low : -source.high, high: sign === 1 ? source.high : -source.low }];
  }));
}

export function responseCounts(data) {
  const correct = Math.round(data.items.reduce((sum, row) => sum + row.facility * row.students, 0));
  return [
    { label: "Correct", count: correct, color: "#2563a6" },
    { label: "Incorrect", count: data.response_count - correct - data.skipped - data.not_reached - data.invalid, color: "#697782" },
    { label: "Skipped", count: data.skipped, color: "#ae6233" },
    { label: "Not reached", count: data.not_reached, color: "#8d4474" },
    { label: "Invalid", count: data.invalid, color: "#555555" },
  ];
}
