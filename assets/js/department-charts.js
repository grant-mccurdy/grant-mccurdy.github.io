import { domainNames, pairwiseCells } from "./department-model.js?v=20261026a";

export const escapeText = (value) => String(value ?? "").replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
export const number = (value, digits = 1) => value == null ? "Not estimable" : Number(value).toFixed(digits);
export const percent = (value) => value == null ? "Not estimable" : number(value) + "%";
export const signed = (value) => (value > 0 ? "+" : "") + number(value);
export const domainColors = { Algebra: "#2563a6", "Advanced Math": "#178075",
  "Problem-Solving/Data Analysis": "#864f8d", "Geometry/Trigonometry": "#b05932" };
export const domainShapes = { Algebra: "circle", "Advanced Math": "square",
  "Problem-Solving/Data Analysis": "triangle", "Geometry/Trigonometry": "diamond" };
const shortCourse = { "Algebra I": "Algebra I", Geometry: "Geometry", "Algebra II": "Algebra II",
  Precalculus: "Precalculus", "AP Calculus AB": "AP Calc AB", "AP Statistics": "AP Statistics" };
const courseCode = { "Algebra I": "A1", Geometry: "Geo", "Algebra II": "A2",
  Precalculus: "Pre", "AP Calculus AB": "Calc", "AP Statistics": "Stats" };
const trackColor = (row) => row.track === "Regular" ? "#6486a5" : "#244c73";
const text = (x, y, label, attrs = "") => '<text x="' + x + '" y="' + y + '" ' + attrs + ">" + escapeText(label) + "</text>";
const line = (x1, y1, x2, y2, attrs = "") => '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" ' + attrs + "/>";
const rect = (x, y, width, height, attrs = "") => '<rect x="' + x + '" y="' + y + '" width="' + width + '" height="' + height + '" ' + attrs + "/>";
const circle = (x, y, radius, attrs = "") => '<circle cx="' + x + '" cy="' + y + '" r="' + radius + '" ' + attrs + "/>";
const mark = (label, content, attrs = "") => '<g class="chart-mark" role="button" tabindex="-1" aria-label="' + escapeText(label) + '" data-tooltip="' + escapeText(label) + '" ' + attrs + ">" + content + "</g>";
const svg = (width, height, title, body) => '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + " " + height + '" role="group" aria-label="' + escapeText(title) + '">' + body + "</svg>";
const widthOf = (container) => Math.max(240, Math.round(container.clientWidth));
const empty = '<p class="chart-empty">No groups match these filters.</p>';

function mount(container, markup, label, columns = 1) {
  container.innerHTML = '<div class="chart-viewport" tabindex="0" role="region" aria-label="' + escapeText(label) + '">' + markup + '</div><p class="chart-selection" aria-live="polite" hidden></p>';
  container.dataset.columns = columns;
  const first = container.querySelector(".chart-mark");
  if (first) first.setAttribute("tabindex", "0");
}

export function intervalChart(container, rows, { interval = "ci", reference = null, section = false } = {}) {
  if (!rows.length) { mount(container, empty, "Score comparison"); return; }
  const width = widthOf(container), compact = width < 460;
  const left = compact ? 12 : 156, right = width - 54;
  const step = compact ? 78 : 43, top = 32, bottom = top + step * rows.length;
  const x = (value) => left + value / 100 * (right - left);
  let body = text(left, 15, "Mean score (%)", 'class="axis-title"');
  for (const tick of [0, 25, 50, 75, 100]) {
    body += line(x(tick), top, x(tick), bottom, 'class="chart-grid"');
    body += text(x(tick), bottom + 20, tick, 'class="axis-label" text-anchor="middle"');
  }
  if (reference != null) body += line(x(reference), top, x(reference), bottom, 'class="reference-line"');
  rows.forEach((row, index) => {
    const y = top + step * index + (compact ? 56 : 23);
    const label = section ? row.section_id + " / P" + row.period : row.course;
    const color = trackColor(row);
    const low = interval === "ci" ? row.low : row.mean - row.sd;
    const high = interval === "ci" ? row.high : row.mean + row.sd;
    const range = interval === "none" ? "" : line(x(Math.max(0, low)), y, x(Math.min(100, high)), y,
      'class="score-interval" stroke="' + color + '" stroke-width="' + (interval === "sd" ? 8 : 3) + '"')
      + line(x(Math.max(0, low)), y - 5, x(Math.max(0, low)), y + 5, 'stroke="' + color + '"')
      + line(x(Math.min(100, high)), y - 5, x(Math.min(100, high)), y + 5, 'stroke="' + color + '"');
    const shape = row.track === "Regular" ? circle(x(row.mean), y, 5, 'fill="' + color + '" stroke="white" stroke-width="1.5"')
      : rect(x(row.mean) - 5, y - 5, 10, 10, 'fill="' + color + '" stroke="white" stroke-width="1.5"');
    const detail = row.course + " / " + row.track + (section ? " / " + row.section_id + " / period " + row.period : "")
      + ": mean " + percent(row.mean) + "; median " + percent(row.median) + "; n=" + row.n
      + "; " + (interval === "sd" ? "SD " + number(row.sd) + "; displayed mean +/- SD, not a percentile interval."
        : "95% CI " + number(row.low) + " to " + number(row.high) + "%.");
    body += mark(detail, rect(0, top + step * index, width, step - 1, 'class="mark-hit"')
      + text(compact ? left : 0, compact ? y - 36 : y - 5, label, 'class="row-label"')
      + text(compact ? left : 0, compact ? y - 19 : y + 12, (section ? shortCourse[row.course] + " / " + (row.track === "Regular" ? "R" : "H") : row.track) + " / n=" + row.n,
        'class="row-secondary"')
      + range + shape + text(width - 2, y + 4, number(row.mean), 'class="value-label" text-anchor="end"'),
      'data-value="' + row.mean + '"');
  });
  mount(container, svg(width, bottom + 36, "Course or class mean scores", body), "Score comparison");
}

export function violinChart(container, groups, distributions, { reference = null } = {}) {
  if (!groups.length) { mount(container, empty, "Course score distributions"); return; }
  const courses = [...new Set(groups.map((row) => row.course))];
  const width = Math.max(widthOf(container), courses.length * 112 + 66);
  const left = 44, right = width - 18, top = 44, bottom = 336, step = (right - left) / courses.length;
  const y = (value) => bottom - value / 100 * (bottom - top);
  const center = (course) => left + (courses.indexOf(course) + .5) * step;
  let body = text(left, 14, "Percent correct", 'class="axis-title"');
  for (const tick of [0, 25, 50, 75, 100]) {
    body += line(left, y(tick), right, y(tick), 'class="chart-grid"')
      + text(left - 9, y(tick) + 4, tick, 'class="axis-label" text-anchor="end"');
  }
  if (reference != null) body += line(left, y(reference), right, y(reference), 'class="reference-line"');
  if (courses.includes("AP Statistics") && courses.length > 1) {
    const boundary = center("AP Statistics") - step / 2;
    body += line(boundary, 20, boundary, bottom + 48, 'class="pathway-divider"');
    body += text(center("AP Statistics"), 28, "Separate pathway", 'class="axis-label" text-anchor="middle"');
  }
  courses.forEach((course) => {
    const parts = shortCourse[course].split(" ");
    body += text(center(course), bottom + 23, parts.length > 1 ? parts.slice(0, -1).join(" ") : course, 'class="axis-label" text-anchor="middle"');
    if (parts.length > 1) body += text(center(course), bottom + 39, parts.at(-1), 'class="axis-label" text-anchor="middle"');
  });
  groups.forEach((group) => {
    const row = distributions.find((entry) => entry.course === group.course && entry.track === group.track);
    if (!row) throw new Error("Missing verified score distribution");
    const both = groups.filter((entry) => entry.course === group.course).length === 2;
    const cx = center(group.course) + (both ? (group.track === "Regular" ? -23 : 23) : 0);
    const half = both ? 21 : 27, color = group.track === "Regular" ? "#6486a5" : "#244c73";
    const outline = row.density.map(([score, density]) => [cx - density * half, y(score)])
      .concat([...row.density].reverse().map(([score, density]) => [cx + density * half, y(score)]));
    const path = "M" + outline.map((point) => point.map((value) => value.toFixed(2)).join(",")).join("L") + "Z";
    const label = row.course + " / " + row.track + ": mean " + percent(row.mean) + "; median " + percent(row.median)
      + "; middle 50% " + number(row.q1) + " to " + number(row.q3) + "%; observed " + number(row.min) + " to " + number(row.max) + "%; n=" + row.n + ".";
    body += mark(label, rect(cx - half - 2, top - 12, half * 2 + 4, bottom - top + 18, 'class="mark-hit"')
      + '<path class="violin-density" d="' + path + '" fill="' + color + '" fill-opacity=".48" stroke="' + color + '" stroke-width="1.2"/>'
      + line(cx, y(row.whisker_high), cx, y(row.whisker_low), 'stroke="#202020"')
      + rect(cx - 6, y(row.q3), 12, y(row.q1) - y(row.q3), 'fill="' + color + '" stroke="#202020"')
      + line(cx - 6, y(row.median), cx + 6, y(row.median), 'stroke="#fff" stroke-width="2"')
      + '<path d="M' + cx + "," + (y(row.mean) - 4) + "l4,4 -4,4 -4,-4Z" + '" fill="#fff" stroke="#202020"/>'
      + row.outliers.map((value) => circle(cx, y(value), 2.4, 'fill="#fff" stroke="#202020"')).join("")
      + text(cx, 39, "n=" + row.n, 'class="axis-label" text-anchor="middle"'),
      'data-value="' + row.mean + '" data-course="' + escapeText(row.course) + '" data-track="' + escapeText(row.track) + '"');
  });
  mount(container, svg(width, bottom + 50, "Score distributions across course progression", body), "Course score distributions");
}

export function profileChart(container, rows, courses, domain = "") {
  if (!rows.length) { mount(container, empty, "Content-area profiles"); return; }
  const width = Math.max(widthOf(container), courses.length * 112 + 70);
  const height = 328, left = 40, right = width - 44, top = 28, bottom = 266;
  const x = (course) => courses.length === 1 ? (left + right) / 2 : left + courses.indexOf(course) / (courses.length - 1) * (right - left);
  const y = (value) => bottom - value / 100 * (bottom - top);
  let body = text(left, 14, "Correct (%)", 'class="axis-title"');
  for (const tick of [0, 25, 50, 75, 100]) {
    body += line(left, y(tick), right, y(tick), 'class="chart-grid"') + text(left - 10, y(tick) + 4, tick, 'class="axis-label" text-anchor="end"');
  }
  courses.forEach((course) => {
    const label = shortCourse[course].split(" ");
    body += text(x(course), bottom + 24, label.length > 1 ? label.slice(0, -1).join(" ") : label[0], 'class="axis-label" text-anchor="middle"');
    if (label.length > 1) body += text(x(course), bottom + 40, label.at(-1), 'class="axis-label" text-anchor="middle"');
  });
  if (courses.includes("AP Statistics") && courses.length > 1) body += line(x("AP Statistics") - (right - left) / (courses.length - 1) / 2, top, x("AP Statistics") - (right - left) / (courses.length - 1) / 2, bottom, 'class="pathway-divider"');
  Object.keys(domainNames).filter((key) => !domain || key === domain).forEach((key) => {
    const selected = rows.filter((row) => row.domain === key);
    const points = selected.filter((row) => row.course !== "AP Statistics").map((row) => ({ x: x(row.course), y: y(row.mean) }));
    const color = domainColors[key];
    const dash = { circle: "", square: "7 3", triangle: "2 3", diamond: "8 3 2 3" }[domainShapes[key]];
    if (points.length > 1) body += '<path class="domain-line" d="' + window.AssessmentCharts.pointsToPath(points) + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-dasharray="' + dash + '"/>';
    selected.forEach((row) => {
      const cx = x(row.course), cy = y(row.mean), attrs = 'fill="' + color + '" stroke="white" stroke-width="1.5"';
      const shape = domainShapes[key];
      const symbol = shape === "circle" ? circle(cx, cy, 5, attrs) : shape === "square" ? rect(cx - 5, cy - 5, 10, 10, attrs)
        : '<polygon points="' + (shape === "triangle" ? (cx - 6) + ',' + (cy + 5) + ' ' + (cx + 6) + ',' + (cy + 5) + ' ' + cx + ',' + (cy - 6)
          : cx + ',' + (cy - 7) + ' ' + (cx + 6) + ',' + cy + ' ' + cx + ',' + (cy + 7) + ' ' + (cx - 6) + ',' + cy) + '" ' + attrs + '/>';
      body += mark(row.course + " / " + domainNames[key] + ": " + percent(row.mean) + "; n=" + row.n + ". Cross-sectional, not growth.",
        circle(cx, cy, 13, 'class="mark-hit"') + symbol,
        'data-value="' + row.mean + '"');
    });
  });
  mount(container, svg(width, height, "Content-area means across selected courses", body), "Content-area profiles");
}

export function differenceChart(container, rows) {
  if (!rows.length) { mount(container, '<p class="chart-empty">No planned comparisons involve this course.</p>', "Planned comparisons"); return; }
  const width = widthOf(container), left = 18, right = width - 50, top = 24, step = 88;
  const extent = Math.max(10, ...rows.flatMap((r) => [Math.abs(r.low), Math.abs(r.high)]));
  const ticks = window.AssessmentCharts.niceTicks(-extent, extent, 5);
  const x = (value) => left + (value - ticks.min) / (ticks.max - ticks.min) * (right - left);
  const bottom = rows.length * step + top;
  let body = "";
  for (const tick of ticks.ticks) body += line(x(tick), top, x(tick), bottom, tick === 0 ? 'class="zero-line"' : 'class="chart-grid"')
    + text(x(tick), bottom + 20, tick, 'class="axis-label" text-anchor="middle"');
  rows.forEach((row, index) => {
    const y = top + index * step + 60, color = row.interpretation === "inconclusive" ? "#667681" : "#2563a6";
    const a = row.a.replace("Honors/AP", "Honors"), b = row.b.replace("Honors/AP", "Honors");
    const label = row.a + " minus " + row.b + ": " + signed(row.difference) + " pp; 95% CI " + number(row.low)
      + " to " + number(row.high) + "; Holm p=" + number(row.p_holm, 3) + "; " + row.interpretation + ".";
    body += mark(label, rect(0, y - 58, width, step - 2, 'class="mark-hit"')
      + text(left, y - 38, a + " minus", 'class="row-label"') + text(left, y - 22, b, 'class="row-secondary"')
      + line(x(row.low), y, x(row.high), y, 'stroke="' + color + '" stroke-width="3"')
      + circle(x(row.difference), y, 5, 'fill="' + color + '" stroke="white" stroke-width="1.5"')
      + text(width - 2, y + 4, signed(row.difference), 'class="value-label" text-anchor="end"'),
      'data-value="' + row.difference + '"');
  });
  body += text((left + right) / 2, bottom + 43, "Difference (percentage points)", 'class="axis-label" text-anchor="middle"');
  mount(container, svg(width, bottom + 57, "Planned differences with 95% intervals", body), "Planned comparisons");
}

function blend(color, amount) {
  const rgb = color.match(/[a-f0-9]{2}/gi).map((value) => parseInt(value, 16));
  return "rgb(" + rgb.map((value) => Math.round(255 + (value - 255) * amount)).join(",") + ")";
}

function contrastText(background) {
  const luminance = background.match(/\d+/g).map(Number).map((value) => {
    const channel = value / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  }).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
  return luminance < .179 ? "#fff" : "#000";
}
const groupCode = (row) => courseCode[row.course] + " " + (row.track === "Regular" ? "R" : "H");
function matrixKey(groups) {
  return '<div class="matrix-key">' + groups.map((row) => "<span><strong>" + escapeText(groupCode(row)) + "</strong> " + escapeText(row.course + " / " + row.track) + "</span>").join("") + "</div>";
}

export function questionChart(container, questions, groups, data) {
  if (!groups.length) { mount(container, empty, "Question results"); return; }
  if (!questions.length) { mount(container, '<p class="chart-empty">No questions match these filters.</p>', "Question results"); return; }
  const left = 180, top = 67, cell = 74, step = 44;
  const width = Math.max(left + cell * groups.length + 8, widthOf(container)), bottom = top + questions.length * step;
  let body = text(0, 22, "Question / skill", 'class="axis-title"');
  groups.forEach((group, column) => {
    const x = left + column * cell;
    body += text(x + cell / 2, 22, groupCode(group), 'class="column-label" text-anchor="middle"')
      + text(x + cell / 2, 41, "n=" + group.n, 'class="row-secondary" text-anchor="middle"');
    if (["Geometry", "Algebra II"].includes(group.course)) body += rect(x - 1, top - 3, cell - 1, questions.length * step + 4, 'fill="none" stroke="#6e5a30" stroke-width="2"');
  });
  questions.forEach((question, row) => {
    const y = top + row * step;
    body += text(0, y + 16, "Q" + question.position, 'class="row-label"')
      + text(0, y + 33, question.skill.length > 26 ? question.skill.slice(0, 25) + "..." : question.skill, 'class="row-secondary"');
    groups.forEach((group, column) => {
      const record = data.item_course.find((r) => r.position === question.position && r.course === group.course && r.track === group.track);
      if (!record) return;
      const x = left + column * cell, value = record.correct_rate;
      const background = blend("#235788", 1 - value / 100);
      const label = "Q" + question.position + ", " + question.skill + "; " + group.course + " / " + group.track + ": " + percent(value) + " correct (" + record.correct + "/" + record.n + ").";
      body += mark(label, rect(x + 2, y, cell - 6, step - 4, 'fill="' + background + '"')
        + text(x + cell / 2 - 1, y + 24, number(value, 0), 'fill="' + contrastText(background) + '" class="cell-value" text-anchor="middle"'),
        'data-position="' + question.position + '" data-row="' + row + '" data-column="' + column + '" data-course="' + escapeText(group.course) + '" data-track="' + escapeText(group.track) + '" data-value="' + value + '"');
    });
  });
  mount(container, svg(width, bottom + 6, "Percent correct by question and course-track group", body), "Question results", groups.length);
  container.insertAdjacentHTML("beforeend", matrixKey(groups));
}

export function pairwiseChart(container, data, groups) {
  if (groups.length < 2) { mount(container, '<p class="chart-empty">At least two groups are needed for a comparison map.</p>', "Pairwise comparisons"); return; }
  const left = 70, top = 35, cell = Math.max(52, Math.min(67, Math.floor((widthOf(container) - left - 4) / groups.length))), width = left + cell * groups.length + 4;
  let body = "";
  groups.forEach((group, index) => {
    body += text(left + (index + .5) * cell, 19, groupCode(group), 'class="column-label" text-anchor="middle"')
      + text(left - 12, top + (index + .5) * cell + 4, groupCode(group), 'class="row-label" text-anchor="end"')
      + text(left + (index + .5) * cell, top + (index + .5) * cell + 4, "-", 'class="axis-label" text-anchor="middle"');
  });
  pairwiseCells(data, groups).forEach((row) => {
    const x = left + row.column * cell, y = top + row.row * cell;
    const ns = row.p_holm >= .05, strength = Math.min(.78, Math.abs(row.difference) / 42);
    const background = blend(row.difference >= 0 ? "#244c73" : "#ae6233", strength);
    const foreground = contrastText(background);
    const label = row.a + " minus " + row.b + ": " + signed(row.difference) + " pp; 95% CI " + number(row.low) + " to " + number(row.high) + "; Holm p=" + number(row.p_holm, 3) + "; " + (ns ? "inconclusive" : "difference detected") + ".";
    const outline = groups[row.row].course === groups[row.column].course ? ' stroke="#244c73" stroke-width="2"' : "";
    body += mark(label, rect(x + 2, y + 2, cell - 4, cell - 4, 'fill="' + background + '"' + outline)
      + text(x + cell / 2, y + cell / 2 - 2, signed(row.difference), 'fill="' + foreground + '" class="cell-value" text-anchor="middle"')
      + text(x + cell / 2, y + cell / 2 + 14, ns ? "NS" : "p<.05", 'fill="' + foreground + '" class="cell-note" text-anchor="middle"'),
      'data-row="' + row.row + '" data-column="' + row.column + '" data-value="' + row.difference + '"');
  });
  mount(container, svg(width, top + groups.length * cell + 4, "Original exploratory pairwise differences", body), "Pairwise comparisons", groups.length - 1);
  container.insertAdjacentHTML("beforeend", matrixKey(groups));
}

export function responseChart(container, rows, total) {
  const width = widthOf(container);
  let x = 0, body = text(0, 26, "15,000 item responses", 'class="axis-title"');
  rows.forEach((row) => {
    const span = row.count / total * width;
    if (span) body += mark(row.label + ": " + row.count + " responses (" + percent(row.count / total * 100) + ").",
      rect(x, 42, span, 32, 'fill="' + row.color + '"'));
    x += span;
  });
  mount(container, svg(width, 92, "Department response coverage", body), "Response coverage");
}
