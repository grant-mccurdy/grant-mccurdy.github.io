const contentRag = document.querySelector("[data-content-rag]");

if (contentRag) {
  const { escapeHtml, renderInlineMarkdown, safeHttpUrl } = window.PortfolioChatUI;
  const thread = contentRag.querySelector("[data-chat-thread]");
  const form = contentRag.querySelector("[data-chat-form]");
  const input = contentRag.querySelector("[data-chat-input]");
  const submitButton = form.querySelector("button");
  const presetButtons = [...contentRag.querySelectorAll("[data-question]")];
  const sourceMeta = contentRag.querySelector(".content-rag-live-meta");
  const sourceStatus = contentRag.querySelector("[data-content-source-status]");
  const sourceFingerprint = contentRag.querySelector("[data-content-fingerprint]");
  const REQUEST_TIMEOUT_MS = 30000;
  const params = new URLSearchParams(window.location.search);
  const endpoint =
    params.get("content_endpoint") ||
    contentRag.dataset.apiEndpoint ||
    window.PORTFOLIO_CONTENT_RAG_ENDPOINT ||
    "";
  const sourcesEndpoint =
    params.get("content_sources_endpoint") ||
    contentRag.dataset.sourcesEndpoint ||
    (endpoint ? endpoint.replace(/\/content\/query$/, "/content/sources") : "");
  const demoToken = params.get("demo_token") || contentRag.dataset.demoToken || window.PORTFOLIO_CONTENT_RAG_TOKEN || "";

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

  let revealFrame = 0;
  const revealMessage = (article) => {
    if (revealFrame) window.cancelAnimationFrame(revealFrame);
    revealFrame = window.requestAnimationFrame(() => {
      revealFrame = 0;
      const threadTop = thread.getBoundingClientRect().top;
      const messageTop = article.getBoundingClientRect().top;
      const clearance = 12;
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      thread.scrollTo({
        top: Math.max(0, thread.scrollTop + messageTop - threadTop - clearance),
        behavior: reduceMotion ? "auto" : "smooth"
      });
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

  const loadCorpusMetadata = async () => {
    if (!sourceMeta || !sourceStatus || !sourcesEndpoint) return;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(sourcesEndpoint, { signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("Corpus metadata unavailable");
      const count = Number(payload.chunks || 0);
      const mode = payload.retrievalMode === "hybrid" ? "hybrid retrieval" : "lexical retrieval";
      sourceStatus.textContent = count > 0 ? `${count.toLocaleString()} reviewed records · ${mode}` : `Published corpus · ${mode}`;
      sourceMeta.classList.add("is-ready");
      if (sourceFingerprint && payload.corpusFingerprint) {
        sourceFingerprint.textContent = `${String(payload.corpusFingerprint).slice(0, 12)}…`;
        sourceFingerprint.title = `Corpus fingerprint: ${payload.corpusFingerprint}`;
      }
    } catch {
      sourceStatus.textContent = "Published public-safe corpus; live metadata unavailable";
      sourceMeta.classList.add("is-unavailable");
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const runQuestion = async (question) => {
    const trimmed = String(question || "").trim();
    if (!trimmed) return;
    message("user", renderText(trimmed));
    const loading = message("assistant", renderStatus("info", "Thinking", "Finding the most useful response."));
    revealMessage(loading);

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
          ? "The Content RAG backend did not respond within 30 seconds."
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
  loadCorpusMetadata();
}
