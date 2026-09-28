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
