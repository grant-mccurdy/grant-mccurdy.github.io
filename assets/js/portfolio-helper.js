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

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

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

  const answerHtml = (payload) => {
    const paragraphs = String(payload.answer || "I could not find a supported answer in the public portfolio sources.")
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join("");
    const citations = (payload.citations || [])
      .slice(0, 3)
      .map((citation) => {
        const title = citation.title || citation.sourcePath || "Source";
        const href = safeHref(citation.url || "#");
        return `<li><a href="${escapeHtml(href)}">${escapeHtml(title)}</a></li>`;
      })
      .join("");
    return `${paragraphs}${citations ? `<div class="portfolio-helper-sources"><strong>Sources</strong><ul>${citations}</ul></div>` : ""}`;
  };

  const statusHtml = (kind, title, content) =>
    `<div class="portfolio-helper-status ${escapeHtml(kind)}"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(content)}</p></div>`;

  const addMessage = (role, content) => {
    const article = document.createElement("article");
    article.className = `portfolio-helper-message ${role}`;
    article.innerHTML = `<div class="portfolio-helper-role">${role === "user" ? "You" : "Helper"}</div><div class="portfolio-helper-content">${content}</div>`;
    thread.append(article);
    thread.scrollTop = thread.scrollHeight;
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
      input.focus();
      thread.scrollTop = thread.scrollHeight;
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
