const lab = document.querySelector("[data-data-lab]");

if (lab) {
  const thread = lab.querySelector("[data-chat-thread]");
  const form = lab.querySelector("[data-chat-form]");
  const input = lab.querySelector("[data-chat-input]");
  const submitButton = form.querySelector("button");
  const presetButtons = [...lab.querySelectorAll("[data-question]")];
  const REQUEST_TIMEOUT_MS = 15000;
  const params = new URLSearchParams(window.location.search);
  const endpoint =
    params.get("endpoint") ||
    lab.dataset.apiEndpoint ||
    window.PORTFOLIO_ANALYTICS_ENDPOINT ||
    "";
  const datasetsEndpoint =
    params.get("datasets_endpoint") ||
    lab.dataset.datasetsEndpoint ||
    window.PORTFOLIO_ANALYTICS_DATASETS_ENDPOINT ||
    (endpoint ? endpoint.replace(/\/analytics\/query\/?$/, "/analytics/datasets") : "");
  const demoToken = params.get("demo_token") || lab.dataset.demoToken || window.PORTFOLIO_ANALYTICS_TOKEN || "";
  const initialQuestion = String(params.get("question") || params.get("prompt") || "").trim();
  const autorunInitialQuestion = params.get("autorun") === "1";
  const datasetName = lab.querySelector("[data-dataset-name]");
  const datasetTables = lab.querySelector("[data-dataset-tables]");
  const datasetMode = lab.querySelector("[data-dataset-mode]");
  const datasetUpdated = lab.querySelector("[data-dataset-updated]");
  let activeDatasetId = "";

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const renderInlineMarkdown = (value) =>
    escapeHtml(value)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");

  const orderedMarkerPattern = /(^|\s)(\d+)\.\s+/g;
  const orderedLinePattern = /^\d+\.\s+/;
  const bulletLinePattern = /^[-*]\s+/;

  const renderList = (items, ordered) => {
    const tag = ordered ? "ol" : "ul";
    return `<${tag}>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</${tag}>`;
  };

  const renderInlineOrderedList = (block) => {
    const markers = [];
    let match = orderedMarkerPattern.exec(block);
    while (match) {
      markers.push({
        number: Number(match[2]),
        markerStart: match.index + match[1].length,
        contentStart: orderedMarkerPattern.lastIndex
      });
      match = orderedMarkerPattern.exec(block);
    }
    orderedMarkerPattern.lastIndex = 0;
    if (markers.length < 2 || !markers.every((marker, index) => marker.number === markers[0].number + index)) {
      return "";
    }

    const prefix = block.slice(0, markers[0].markerStart).trim();
    const items = markers.map((marker, index) =>
      block.slice(marker.contentStart, markers[index + 1]?.markerStart ?? block.length).trim()
    );
    let suffix = "";
    const lastIndex = items.length - 1;
    const suffixMatch = items[lastIndex].match(/\s+(These|This|The results?|Results?|They|It)\b/);
    if (suffixMatch && suffixMatch.index > 20) {
      suffix = items[lastIndex].slice(suffixMatch.index).trim();
      items[lastIndex] = items[lastIndex].slice(0, suffixMatch.index).trim();
    }

    return [
      prefix ? `<p>${renderInlineMarkdown(prefix)}</p>` : "",
      renderList(items, true),
      suffix ? `<p>${renderInlineMarkdown(suffix)}</p>` : ""
    ].join("");
  };

  const renderMarkdownText = (value) =>
    String(value || "")
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => {
        const lines = block.split(/\n+/).map((line) => line.trim()).filter(Boolean);
        if (lines.length && lines.every((line) => orderedLinePattern.test(line))) {
          return renderList(lines.map((line) => line.replace(orderedLinePattern, "")), true);
        }
        if (lines.length && lines.every((line) => bulletLinePattern.test(line))) {
          return renderList(lines.map((line) => line.replace(bulletLinePattern, "")), false);
        }
        return renderInlineOrderedList(block) || `<p>${renderInlineMarkdown(block).replace(/\n/g, "<br>")}</p>`;
      })
      .join("");

  const formatValue = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value.toLocaleString("en-US", { maximumFractionDigits: Math.abs(value) >= 100 ? 1 : 2 });
    }
    return String(value ?? "");
  };

  const message = (role, content) => {
    const article = document.createElement("article");
    article.className = `chat-message ${role}`;
    const label = role === "user" ? "You" : "Analysis";
    article.innerHTML = `<div class="chat-role">${label}</div><div class="chat-content">${content}</div>`;
    thread.append(article);
    return article;
  };

  const renderText = (block) => renderMarkdownText(block.content || "");

  const renderMetric = (block) => {
    const metrics = (block.metrics || [])
      .map(
        (metric) =>
          `<div class="chat-metric"><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(metric.displayValue ?? metric.value)}</strong></div>`
      )
      .join("");
    return `<div class="chat-metrics">${metrics}</div>`;
  };

  const renderTable = (block) => {
    const columns = block.columns || Object.keys((block.rows || [])[0] || {});
    const header = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
    const rows = (block.rows || [])
      .map(
        (row) =>
          `<tr>${columns.map((column) => `<td>${escapeHtml(formatValue(row[column]))}</td>`).join("")}</tr>`
      )
      .join("");
    return `<div class="chat-table-wrap"><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>`;
  };

  const field = (channel) => channel?.field;
  const markType = (mark) => (typeof mark === "string" ? mark : mark?.type);
  const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
  const chartPalette = ["#2563eb", "#0f766e", "#b45309", "#7c3aed", "#be123c", "#15803d", "#4338ca", "#a16207"];

  const renderChart = (block) => {
    const spec = block.spec || {};
    const values = spec.data?.values || [];
    if (!values.length) return "";
    const mark = markType(spec.mark);
    if (mark === "line") return renderLineChart(spec, values);
    if (mark === "scatter") return renderScatterChart(spec, values);
    if (spec.encoding?.x?.bin) return renderHistogram(spec, values);
    return renderBarChart(spec, values);
  };

  const chartShell = (title, svg) =>
    `<div class="chat-chart"><div class="chat-chart-title">${escapeHtml(title || "Chart")}</div>${svg}</div>`;

  const chartBounds = { width: 720, height: 320, left: 60, right: 24, top: 28, bottom: 72 };

  const renderBarChart = (spec, values) => {
    const xField = field(spec.encoding?.x);
    const yField = field(spec.encoding?.y);
    if (!xField || !yField) return "";
    const max = Math.max(...values.map((row) => Number(row[yField]) || 0), 1);
    const innerW = chartBounds.width - chartBounds.left - chartBounds.right;
    const innerH = chartBounds.height - chartBounds.top - chartBounds.bottom;
    const gap = 10;
    const barW = Math.max(12, (innerW - gap * (values.length - 1)) / Math.max(values.length, 1));
    const bars = values
      .map((row, index) => {
        const value = Number(row[yField]) || 0;
        const height = (value / max) * innerH;
        const x = chartBounds.left + index * (barW + gap);
        const y = chartBounds.top + innerH - height;
        const label = String(row[xField] ?? "");
        return `<rect class="chat-chart-bar" x="${x}" y="${y}" width="${barW}" height="${height}"><title>${escapeHtml(label)}: ${escapeHtml(formatValue(value))}</title></rect><text class="chat-chart-label" x="${x + barW / 2}" y="${chartBounds.top + innerH + 20}" text-anchor="middle">${escapeHtml(label.slice(0, 14))}</text>`;
      })
      .join("");
    const axis = chartAxis(max);
    return chartShell(
      spec.title,
      `<svg viewBox="0 0 ${chartBounds.width} ${chartBounds.height}" role="img">${axis}${bars}</svg>`
    );
  };

  const renderLineChart = (spec, values) => {
    const xField = field(spec.encoding?.x);
    const yField = field(spec.encoding?.y);
    if (!xField || !yField) return "";
    const seriesField = field(spec.encoding?.color);
    if (seriesField) return renderGroupedLineChart(spec, values, xField, yField, seriesField);
    const nums = values.map((row) => Number(row[yField]) || 0);
    const max = Math.max(...nums, 1);
    const min = Math.min(...nums, 0);
    const innerW = chartBounds.width - chartBounds.left - chartBounds.right;
    const innerH = chartBounds.height - chartBounds.top - chartBounds.bottom;
    const span = Math.max(max - min, 1);
    const points = values.map((row, index) => {
      const x = chartBounds.left + (index / Math.max(values.length - 1, 1)) * innerW;
      const y = chartBounds.top + innerH - ((Number(row[yField]) - min) / span) * innerH;
      return { x, y, label: row[xField], value: row[yField] };
    });
    const path = points.map((point) => `${point.x},${point.y}`).join(" ");
    const dots = points
      .map(
        (point) =>
          `<circle class="chat-chart-dot" cx="${point.x}" cy="${point.y}" r="4"><title>${escapeHtml(point.label)}: ${escapeHtml(formatValue(point.value))}</title></circle><text class="chat-chart-label" x="${point.x}" y="${chartBounds.top + innerH + 20}" text-anchor="middle">${escapeHtml(String(point.label).slice(0, 12))}</text>`
      )
      .join("");
    return chartShell(
      spec.title,
      `<svg viewBox="0 0 ${chartBounds.width} ${chartBounds.height}" role="img">${chartAxis(max)}<polyline class="chat-chart-line" points="${path}"></polyline>${dots}</svg>`
    );
  };

  const renderGroupedLineChart = (spec, values, xField, yField, seriesField) => {
    const nums = values.map((row) => Number(row[yField])).filter(isNumber);
    if (!nums.length) return "";
    const xValues = [...new Set(values.map((row) => row[xField]))];
    const seriesValues = [...new Set(values.map((row) => row[seriesField]))].slice(0, chartPalette.length);
    if (xValues.length < 2 || seriesValues.length < 2) return "";
    const max = Math.max(...nums, 1);
    const min = Math.min(...nums, 0);
    const innerW = chartBounds.width - chartBounds.left - chartBounds.right;
    const innerH = chartBounds.height - chartBounds.top - chartBounds.bottom;
    const span = Math.max(max - min, 1);
    const xPosition = (value) => chartBounds.left + (xValues.indexOf(value) / Math.max(xValues.length - 1, 1)) * innerW;
    const yPosition = (value) => chartBounds.top + innerH - ((Number(value) - min) / span) * innerH;
    const lines = seriesValues
      .map((series, seriesIndex) => {
        const color = chartPalette[seriesIndex % chartPalette.length];
        const points = values
          .filter((row) => row[seriesField] === series && isNumber(Number(row[yField])))
          .sort((a, b) => xValues.indexOf(a[xField]) - xValues.indexOf(b[xField]))
          .map((row) => ({ x: xPosition(row[xField]), y: yPosition(row[yField]), label: row[xField], value: row[yField] }));
        if (points.length < 2) return "";
        const path = points.map((point) => `${point.x},${point.y}`).join(" ");
        const dots = points
          .map(
            (point) =>
              `<circle class="chat-chart-dot" cx="${point.x}" cy="${point.y}" r="3.5" style="fill:${color}"><title>${escapeHtml(series)} ${escapeHtml(point.label)}: ${escapeHtml(formatValue(point.value))}</title></circle>`
          )
          .join("");
        return `<polyline class="chat-chart-line" points="${path}" style="stroke:${color}"></polyline>${dots}`;
      })
      .join("");
    const labels = xValues
      .map(
        (label) =>
          `<text class="chat-chart-label" x="${xPosition(label)}" y="${chartBounds.top + innerH + 20}" text-anchor="middle">${escapeHtml(String(label).slice(0, 12))}</text>`
      )
      .join("");
    const legend = seriesValues
      .map((series, index) => {
        const y = chartBounds.top + index * 18;
        const color = chartPalette[index % chartPalette.length];
        return `<g><rect x="${chartBounds.left + 8}" y="${y - 9}" width="10" height="10" fill="${color}"></rect><text class="chat-chart-label" x="${chartBounds.left + 24}" y="${y}">${escapeHtml(String(series).slice(0, 18))}</text></g>`;
      })
      .join("");
    return chartShell(
      spec.title,
      `<svg viewBox="0 0 ${chartBounds.width} ${chartBounds.height}" role="img">${chartAxis(max)}${legend}${lines}${labels}</svg>`
    );
  };

  const renderScatterChart = (spec, values) => {
    const xField = field(spec.encoding?.x);
    const yField = field(spec.encoding?.y);
    if (!xField || !yField) return "";
    const xs = values.map((row) => Number(row[xField])).filter(isNumber);
    const ys = values.map((row) => Number(row[yField])).filter(isNumber);
    if (!xs.length || !ys.length) return "";
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const innerW = chartBounds.width - chartBounds.left - chartBounds.right;
    const innerH = chartBounds.height - chartBounds.top - chartBounds.bottom;
    const dots = values
      .map((row) => {
        const xValue = Number(row[xField]);
        const yValue = Number(row[yField]);
        if (!isNumber(xValue) || !isNumber(yValue)) return "";
        const x = chartBounds.left + ((xValue - xMin) / Math.max(xMax - xMin, 1)) * innerW;
        const y = chartBounds.top + innerH - ((yValue - yMin) / Math.max(yMax - yMin, 1)) * innerH;
        return `<circle class="chat-chart-dot" cx="${x}" cy="${y}" r="4"><title>${escapeHtml(formatValue(xValue))}, ${escapeHtml(formatValue(yValue))}</title></circle>`;
      })
      .join("");
    return chartShell(
      spec.title,
      `<svg viewBox="0 0 ${chartBounds.width} ${chartBounds.height}" role="img">${chartAxis(yMax)}${dots}</svg>`
    );
  };

  const renderHistogram = (spec, values) => {
    const xField = field(spec.encoding?.x);
    const nums = values.map((row) => Number(row[xField])).filter(isNumber);
    if (!nums.length) return "";
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const binCount = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(nums.length))));
    const size = Math.max((max - min) / binCount, 1);
    const bins = Array.from({ length: binCount }, (_, index) => ({
      label: `${formatValue(min + index * size)}-${formatValue(min + (index + 1) * size)}`,
      count: 0
    }));
    nums.forEach((value) => {
      const index = Math.min(binCount - 1, Math.floor((value - min) / size));
      bins[index].count += 1;
    });
    return renderBarChart(
      {
        title: spec.title,
        encoding: { x: { field: "label" }, y: { field: "count" } }
      },
      bins
    );
  };

  const chartAxis = (max) => {
    const innerH = chartBounds.height - chartBounds.top - chartBounds.bottom;
    const y = chartBounds.top + innerH;
    return `<line class="chat-chart-axis" x1="${chartBounds.left}" y1="${chartBounds.top}" x2="${chartBounds.left}" y2="${y}"></line><line class="chat-chart-axis" x1="${chartBounds.left}" y1="${y}" x2="${chartBounds.width - chartBounds.right}" y2="${y}"></line><text class="chat-chart-label" x="12" y="${chartBounds.top + 8}">${escapeHtml(formatValue(max))}</text>`;
  };

  const renderAnalysisNote = (block) =>
    `<div class="chat-note"><strong>${escapeHtml(block.title || "Analysis")}</strong><p>${escapeHtml(block.content || "")}</p></div>`;

  const renderCapabilityNote = (block) => {
    const nextBestAction = block.nextBestAction ? `<p>Next best action: ${escapeHtml(block.nextBestAction)}</p>` : "";
    return `<div class="chat-status ${escapeHtml(block.status || "info")}"><strong>${escapeHtml(block.title || "Supported scope")}</strong><p>${escapeHtml(block.content || "")}</p>${nextBestAction}</div>`;
  };

  const renderStatus = (kind, title, content) =>
    `<div class="chat-status ${escapeHtml(kind)}"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(content)}</p></div>`;

  const renderSuggestions = (block) => {
    const questions = block.questions || [];
    if (!questions.length) return "";
    return `<div class="chat-suggestions"><strong>${escapeHtml(block.title || "Suggested questions")}</strong><div>${questions
      .map(
        (question) =>
          `<button class="preset-button chat-suggestion" type="button" data-suggested-question="${escapeHtml(question)}">${escapeHtml(question)}</button>`
      )
      .join("")}</div></div>`;
  };

  const renderInitialLabIntro = () =>
    [
      renderStatus(
        "info",
        "Connected analyst workspace",
        "Ask broad inspection questions, compare segments, request trends, check relationships, or ask what the dataset can and cannot support."
      ),
      renderAnalysisNote({
        title: "Good first pass",
        content:
          "Start with Analyst readout to let the backend inspect coverage and choose high-signal follow-up analyses before drilling into one metric."
      }),
      renderSuggestions({
        title: "Try one of these",
        questions: [
          "What stands out in the data?",
          "Which courses show the strongest average observed growth?",
          "How does average observed growth change by school year?",
          "What should I not conclude from this?"
        ]
      })
    ].join("");

  const updateDatasetStatus = (dataset, generatedAt = "") => {
    if (!dataset) return;
    activeDatasetId = dataset.id || activeDatasetId;
    if (datasetName) datasetName.textContent = dataset.title || dataset.id || "Connected dataset";
    if (datasetTables) datasetTables.textContent = `${dataset.tables || 0} tables`;
    if (datasetMode) datasetMode.textContent = `${dataset.dialect || "SQL"} analyst`;
    if (datasetUpdated) {
      const timestamp = generatedAt || dataset.generatedAt;
      const parsed = timestamp ? new Date(timestamp) : null;
      datasetUpdated.textContent = parsed && !Number.isNaN(parsed.valueOf())
        ? parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
        : "Not reported";
    }
  };

  const loadDatasetCatalog = async () => {
    if (!datasetsEndpoint) return;
    try {
      const headers = {};
      if (demoToken) headers["x-demo-token"] = demoToken;
      const response = await fetch(datasetsEndpoint, { headers });
      if (!response.ok) return;
      const payload = await response.json().catch(() => ({}));
      const dataset =
        (payload.datasets || []).find((item) => item.id === payload.defaultDatasetId) ||
        (payload.datasets || [])[0];
      updateDatasetStatus(dataset, payload.generatedAt);
    } catch {
      if (datasetName) datasetName.textContent = "Dataset unavailable";
    }
  };

  const renderSqlDebug = (block) =>
    `<details class="chat-debug"><summary>${escapeHtml(block.title || "Query")}</summary><pre>${escapeHtml(block.sql || "")}</pre></details>`;

  const renderUnknown = (block) =>
    `<details class="chat-debug"><summary>${escapeHtml(block.type || "Block")}</summary><pre>${escapeHtml(JSON.stringify(block, null, 2))}</pre></details>`;

  const renderBlocks = (payload) => {
    const blocks = payload.blocks?.length ? payload.blocks : [{ type: "text", content: payload.answer || "" }];
    return blocks
      .map((block) => {
        if (block.type === "text") return renderText(block);
        if (block.type === "metric") return renderMetric(block);
        if (block.type === "table") return renderTable(block);
        if (block.type === "chart") return renderChart(block);
        if (block.type === "analysis_note") return renderAnalysisNote(block);
        if (block.type === "capability_note") return renderCapabilityNote(block);
        if (block.type === "suggestions") return renderSuggestions(block);
        if (block.type === "sql_debug") return renderSqlDebug(block);
        return renderUnknown(block);
      })
      .join("");
  };

  const setBusy = (busy) => {
    submitButton.disabled = busy;
    input.disabled = busy;
    presetButtons.forEach((button) => {
      button.disabled = busy;
    });
  };

  const apiErrorMessage = (status, payload) => {
    if (status === 401) return "This demo is gated. Open it with a valid private demo token.";
    if (status === 429) return `The demo rate limit was reached. Try again in ${payload.resetSeconds || "a few"} seconds.`;
    return payload.error?.message || payload.error || `The analytics backend returned HTTP ${status}.`;
  };

  const runQuestion = async (question) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    message("user", `<p>${escapeHtml(trimmed)}</p>`);
    const loading = message("assistant", `<p>Running analysis...</p>`);
    if (!endpoint) {
      loading.querySelector(".chat-content").innerHTML =
        renderStatus(
          "warning",
          "Analytics endpoint not configured",
          "The static interface is ready, but this build has not been connected to the private Worker endpoint."
        );
      return;
    }

    setBusy(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const headers = { "content-type": "application/json" };
      if (demoToken) headers["x-demo-token"] = demoToken;
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({ question: trimmed, topK: 4, datasetId: activeDatasetId || undefined })
      });
      window.clearTimeout(timeoutId);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(apiErrorMessage(response.status, payload));
        error.status = response.status;
        throw error;
      }
      updateDatasetStatus(payload.dataset);
      loading.querySelector(".chat-content").innerHTML = renderBlocks(payload);
    } catch (error) {
      window.clearTimeout(timeoutId);
      const title =
        error.name === "AbortError"
          ? "Analytics request timed out"
          : error.status === 401
          ? "Demo token required"
          : error.status === 429
            ? "Rate limit reached"
            : "Analytics backend unavailable";
      const message =
        error.name === "AbortError"
          ? "The analytics backend did not respond within 15 seconds. Try again in a moment or use another prompt."
          : error.message || "The analytics request could not be completed.";
      loading.querySelector(".chat-content").innerHTML = renderStatus(
        "error",
        title,
        message
      );
    } finally {
      setBusy(false);
    }
  };

  presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.dataset.question || "";
      runQuestion(input.value);
    });
  });

  thread.addEventListener("click", (event) => {
    const button = event.target.closest("[data-suggested-question]");
    if (!button) return;
    input.value = button.dataset.suggestedQuestion || "";
    runQuestion(input.value);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    runQuestion(input.value);
    input.value = "";
  });

  loadDatasetCatalog();
  message("assistant", renderInitialLabIntro());
  if (initialQuestion) {
    input.value = initialQuestion;
    if (autorunInitialQuestion) {
      runQuestion(initialQuestion);
      if (endpoint) input.value = "";
    }
  }
}
