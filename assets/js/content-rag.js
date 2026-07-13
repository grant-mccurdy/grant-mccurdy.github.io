const contentRag = document.querySelector("[data-content-rag]");

if (contentRag) {
  const thread = contentRag.querySelector("[data-chat-thread]");
  const form = contentRag.querySelector("[data-chat-form]");
  const input = contentRag.querySelector("[data-chat-input]");
  const submitButton = form.querySelector("button");
  const presetButtons = [...contentRag.querySelectorAll("[data-question]")];
  const REQUEST_TIMEOUT_MS = 30000;
  const params = new URLSearchParams(window.location.search);
  const endpoint =
    params.get("content_endpoint") ||
    contentRag.dataset.apiEndpoint ||
    window.PORTFOLIO_CONTENT_RAG_ENDPOINT ||
    "";
  const demoToken = params.get("demo_token") || contentRag.dataset.demoToken || window.PORTFOLIO_CONTENT_RAG_TOKEN || "";

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

  const safeHttpUrl = (value) => {
    try {
      const url = new URL(String(value || ""), window.location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  };

  const renderText = (value) =>
    String(value || "")
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => `<p>${renderInlineMarkdown(block).replace(/\n/g, "<br>")}</p>`)
      .join("");

  const message = (role, content) => {
    const article = document.createElement("article");
    article.className = `chat-message ${role}`;
    article.innerHTML = `<div class="chat-role">${role === "user" ? "You" : "Content RAG"}</div><div class="chat-content">${content}</div>`;
    thread.append(article);
    return article;
  };

  const revealMessage = (article) => {
    window.requestAnimationFrame(() => {
      article.scrollIntoView({ behavior: "instant", block: "start", inline: "nearest" });
      const headerBottom = document.querySelector("[data-header]")?.getBoundingClientRect().bottom || 0;
      const messageTop = article.getBoundingClientRect().top;
      const clearance = 12;
      window.scrollBy({ top: messageTop - headerBottom - clearance, behavior: "instant" });
    });
  };

  const renderStatus = (kind, title, detail) =>
    `<div class="chat-status ${kind}"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail)}</p></div>`;

  const renderCitations = (citations = []) => {
    if (!citations.length) return "";
    const items = citations
      .slice(0, 5)
      .map((citation) => {
        const url = safeHttpUrl(citation.url);
        const label = `[${escapeHtml(citation.number)}] ${escapeHtml(citation.title)}`;
        return url ? `<li><a href="${escapeHtml(url)}" target="_blank" rel="noopener">${label}</a></li>` : `<li>${label}</li>`;
      })
      .join("");
    return `<div class="portfolio-helper-sources content-rag-sources"><strong>Sources</strong><ul>${items}</ul></div>`;
  };

  const renderLimits = (limits = []) => {
    if (!limits.length) return "";
    return `<div class="chat-note"><strong>Limits</strong><p>${escapeHtml(limits.join(" "))}</p></div>`;
  };

  const retrievalLabel = (mode) => {
    if (mode === "hybrid") return "Hybrid vector + lexical retrieval";
    if (mode === "lexical_fallback") return "Lexical fallback";
    return "Lexical retrieval";
  };

  const renderRetrievalMeta = (payload) => {
    const mode = payload?.retrievalMode || payload?.corpus?.retrievalMode;
    if (!mode) return "";
    const details = [retrievalLabel(mode)];
    const vector = payload.vector || {};
    if (payload.vectorConfigured && vector.model) {
      details.push(
        `${vector.model}${vector.dimensions ? `, ${vector.dimensions}d` : ""}${vector.pooling ? `, ${vector.pooling} pooling` : ""}`
      );
    }
    if (payload.vectorConfigured && Number.isFinite(Number(vector.matches))) {
      details.push(`${Number(vector.matches)} vector matches`);
    }
    if (payload.vectorConfigured && payload.fallbackReason && mode === "lexical_fallback") {
      details.push(`fallback: ${String(payload.fallbackReason).replaceAll("_", " ")}`);
    }
    return `<div class="chat-note content-rag-retrieval"><strong>Retrieval</strong><p>${escapeHtml(details.join(" | "))}</p></div>`;
  };

  const renderSuggestions = (questions = []) => {
    const unique = [...new Set(questions.filter(Boolean))].slice(0, 4);
    if (!unique.length) return "";
    return `<div class="chat-suggestions"><strong>Follow-up questions</strong><div>${unique
      .map(
        (question) =>
          `<button class="chat-suggestion button outline" type="button" data-suggested-question="${escapeHtml(question)}">${escapeHtml(question)}</button>`
      )
      .join("")}</div></div>`;
  };

  const renderPayload = (payload) =>
    [
      renderText(payload.answer || "No answer was returned."),
      renderCitations(payload.citations),
      renderRetrievalMeta(payload),
      renderLimits(payload.limits),
      renderSuggestions(payload.suggestedQuestions)
    ].join("");

  const apiErrorMessage = (status, payload) => {
    if (status === 401) return "This demo requires a token that is not configured in the static page.";
    if (status === 429) {
      const seconds = Number(payload?.resetSeconds || 0);
      return seconds > 0
        ? `The public demo rate limit was reached. Try again in about ${seconds} seconds.`
        : "The public demo rate limit was reached. Try again later.";
    }
    return payload?.error || payload?.message || "The Content RAG backend could not complete the request.";
  };

  const setBusy = (busy) => {
    submitButton.disabled = busy;
    input.disabled = busy;
  };

  const runQuestion = async (question) => {
    const trimmed = String(question || "").trim();
    if (!trimmed) return;
    message("user", renderText(trimmed));
    const loading = message("assistant", renderStatus("info", "Thinking", "Retrieving public-safe content records."));

    if (!endpoint) {
      loading.querySelector(".chat-content").innerHTML = renderStatus(
        "warning",
        "Content RAG endpoint missing",
        "The static page is ready, but this build has not been connected to the Worker route."
      );
      revealMessage(loading);
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
        body: JSON.stringify({ question: trimmed, topK: 5 })
      });
      window.clearTimeout(timeoutId);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const retryAfterSeconds = Number(response.headers.get("retry-after") || 0);
        const errorPayload =
          retryAfterSeconds > 0 && !payload?.resetSeconds ? { ...payload, resetSeconds: retryAfterSeconds } : payload;
        const error = new Error(apiErrorMessage(response.status, errorPayload));
        error.status = response.status;
        throw error;
      }
      loading.querySelector(".chat-content").innerHTML = renderPayload(payload);
      revealMessage(loading);
    } catch (error) {
      window.clearTimeout(timeoutId);
      const title =
        error.name === "AbortError"
          ? "Content RAG request timed out"
          : error.status === 401
            ? "Demo token required"
            : error.status === 429
              ? "Rate limit reached"
              : "Content RAG backend unavailable";
      const detail =
        error.name === "AbortError"
          ? "The Content RAG backend did not respond within 15 seconds."
          : error.message || "The Content RAG request could not be completed.";
      loading.querySelector(".chat-content").innerHTML = renderStatus("error", title, detail);
      revealMessage(loading);
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

  message(
    "assistant",
    renderStatus(
      "info",
      "Content Intelligence RAG",
      "The index contains public-safe records for source adapters, artifact conversion, information objects, retrieval, citations, and safety review."
    )
  );
}
