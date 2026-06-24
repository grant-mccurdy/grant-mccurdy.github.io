const helper = document.querySelector("[data-portfolio-helper]");

if (helper) {
  const endpoint = helper.dataset.apiEndpoint || "";
  const toggle = helper.querySelector("[data-helper-toggle]");
  const closeButton = helper.querySelector("[data-helper-close]");
  const panel = helper.querySelector("[data-helper-panel]");
  const thread = helper.querySelector("[data-helper-thread]");
  const form = helper.querySelector("[data-helper-form]");
  const input = helper.querySelector("[data-helper-input]");
  const presetButtons = [...helper.querySelectorAll("[data-helper-question]")];
  const submitButton = form.querySelector("button[type='submit']");
  const REQUEST_TIMEOUT_MS = 15000;
  const ANALYTICS_HANDOFF_PATTERN =
    /\b(sql|warehouse|database|average|avg|median|mean|count|compare|correlation|relationship|trend\s*line|trendline|trend|line\s+chart|time\s+series|visuali[sz]e|chart|graph|plot|figure|growth|readiness|attendance|validation|nonparticipation|non-participation|missingness|course\s+track|expected\s+growth|section\s+performance)\b/i;
  const PROJECT_ROUTING_PATTERN = /\b(which\s+project|what\s+project|where\s+should|project|portfolio|grant|demonstrate|evidence)\b/i;

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

  const safeHref = (value) => {
    try {
      const url = new URL(value || "#", window.location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
    } catch {
      return "#";
    }
  };

  const openPanel = () => {
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    window.setTimeout(() => input.focus(), 0);
  };

  const closePanel = () => {
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    toggle.focus();
  };

  const setBusy = (busy) => {
    input.disabled = busy;
    submitButton.disabled = busy;
    presetButtons.forEach((button) => {
      button.disabled = busy;
    });
  };

  const renderTextBlock = (block) => renderMarkdownText(block.content || "");

  const renderCapabilityNote = (block) => {
    const nextBestAction = block.nextBestAction ? `<p>Next best action: ${escapeHtml(block.nextBestAction)}</p>` : "";
    return `<div class="portfolio-helper-status ${escapeHtml(block.status || "info")}"><strong>${escapeHtml(block.title || "Supported scope")}</strong><p>${escapeHtml(block.content || "")}</p>${nextBestAction}</div>`;
  };

  const renderSuggestions = (block) => {
    const questions = block.questions || [];
    if (!questions.length) return "";
    return `<div class="portfolio-helper-suggestions"><strong>${escapeHtml(block.title || "Suggested questions")}</strong>${questions
      .map(
        (question) =>
          `<button type="button" data-helper-suggested-question="${escapeHtml(question)}">${escapeHtml(question)}</button>`
      )
      .join("")}</div>`;
  };

  const renderBlocks = (blocks) =>
    blocks
      .map((block) => {
        if (block.type === "text") return renderTextBlock(block);
        if (block.type === "capability_note") return renderCapabilityNote(block);
        if (block.type === "suggestions") return renderSuggestions(block);
        return "";
      })
      .join("");

  const answerHtml = (payload) => {
    const body = payload.blocks?.length
      ? renderBlocks(payload.blocks)
      : String(payload.answer || "I could not find a supported answer in the public portfolio sources.")
          .split(/\n{2,}/)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean)
          .map((paragraph) => renderMarkdownText(paragraph))
          .join("");
    const citations = (payload.citations || [])
      .slice(0, 3)
      .map((citation) => {
        const title = citation.title || citation.sourcePath || "Source";
        const href = safeHref(citation.url || "#");
        return `<li><a href="${escapeHtml(href)}">${escapeHtml(title)}</a></li>`;
      })
      .join("");
    return `${body}${citations ? `<div class="portfolio-helper-sources"><strong>Sources</strong><ul>${citations}</ul></div>` : ""}`;
  };

  const statusHtml = (kind, title, content) =>
    `<div class="portfolio-helper-status ${escapeHtml(kind)}"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(content)}</p></div>`;

  const analyticsHandoffHref = (question) => {
    if (!ANALYTICS_HANDOFF_PATTERN.test(question)) return "";
    if (PROJECT_ROUTING_PATTERN.test(question)) return "";
    const url = new URL("data-lab.html", window.location.href);
    url.searchParams.set("question", question);
    url.searchParams.set("autorun", "1");
    return url.href;
  };

  const dataLabHandoffHtml = (href) =>
    `<div class="portfolio-helper-status info"><strong>Open Data Lab</strong><p>That looks like an analytics or visualization request for the synthetic education warehouse.</p><p><a class="text-link" href="${escapeHtml(href)}">Open Data Lab with this prompt</a></p></div>`;

  const addMessage = (role, content) => {
    const article = document.createElement("article");
    article.className = `portfolio-helper-message ${role}`;
    article.innerHTML = `<div class="portfolio-helper-role">${role === "user" ? "You" : "Helper"}</div><div class="portfolio-helper-content">${content}</div>`;
    thread.append(article);
    return article;
  };

  const errorMessage = (status, payload) => {
    if (status === 429) return `The helper rate limit was reached. Try again in ${payload.resetSeconds || "a few"} seconds.`;
    if (status === 401) return "This helper is currently gated.";
    return payload.error?.message || payload.error || `The helper returned HTTP ${status}.`;
  };

  const ask = async (question) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    if (panel.hidden) openPanel();
    addMessage("user", `<p>${escapeHtml(trimmed)}</p>`);
    const loading = addMessage("assistant", "<p>Checking the public portfolio sources...</p>");
    const dataLabHref = analyticsHandoffHref(trimmed);

    if (dataLabHref) {
      loading.querySelector(".portfolio-helper-content").innerHTML = dataLabHandoffHtml(dataLabHref);
      return;
    }

    if (!endpoint) {
      loading.querySelector(".portfolio-helper-content").innerHTML = statusHtml(
        "warning",
        "Helper endpoint not configured",
        "The portfolio helper is installed, but this page has not been connected to the Worker endpoint."
      );
      return;
    }

    setBusy(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: trimmed, topK: 5 }),
        signal: controller.signal
      });
      window.clearTimeout(timeoutId);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(errorMessage(response.status, payload));
        error.status = response.status;
        throw error;
      }
      loading.querySelector(".portfolio-helper-content").innerHTML = answerHtml(payload);
    } catch (error) {
      window.clearTimeout(timeoutId);
      loading.querySelector(".portfolio-helper-content").innerHTML = statusHtml(
        "error",
        error.name === "AbortError" ? "Helper request timed out" : "Helper unavailable",
        error.name === "AbortError" ? "The helper did not respond within 15 seconds. Try again in a moment." : error.message || "The helper request could not be completed."
      );
    } finally {
      setBusy(false);
    }
  };

  toggle.addEventListener("click", () => {
    if (panel.hidden) {
      openPanel();
    } else {
      closePanel();
    }
  });

  closeButton.addEventListener("click", closePanel);

  presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.dataset.helperQuestion || "";
      ask(input.value);
    });
  });

  thread.addEventListener("click", (event) => {
    const button = event.target.closest("[data-helper-suggested-question]");
    if (!button) return;
    input.value = button.dataset.helperSuggestedQuestion || "";
    ask(input.value);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    ask(input.value);
    input.value = "";
  });

  helper.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) closePanel();
  });

  addMessage("assistant", "<p>Hi. I can help you find the right project, demo, or case study on this portfolio.</p>");
}
