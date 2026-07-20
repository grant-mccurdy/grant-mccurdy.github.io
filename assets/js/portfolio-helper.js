const helper = document.querySelector("[data-portfolio-helper]");

if (helper) {
  const { escapeHtml, renderInlineMarkdown, safeHttpUrl } = window.PortfolioChatUI;
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
  const PANEL_TRANSITION_MS = 260;
  const ANALYTICS_HANDOFF_PATTERN =
    /\b(sql|warehouse|database|average|avg|median|mean|count|compare|correlation|relationship|trend\s*line|trendline|trend|line\s+chart|time\s+series|visuali[sz]e|chart|graph|plot|figure|growth|readiness|attendance|validation|nonparticipation|non-participation|missingness|course\s+track|expected\s+growth|section\s+performance)\b/i;
  const PROJECT_ROUTING_PATTERN = /\b(which\s+project|what\s+project|where\s+should|project|portfolio|grant|demonstrate|evidence)\b/i;
  const DESTINATION_LINKS = [
    {
      title: "Projects directory",
      href: "projects/index.html",
      patterns: [/\bprojects?\s+(directory|index|overview|page|list)\b/i, /\bexplore\s+projects?\b/i]
    },
    {
      title: "Live demos",
      href: "demos/index.html",
      patterns: [/\bdemos?\s+(directory|index|overview|page|list)\b/i, /\bworking\s+demos?\b/i]
    },
    {
      title: "Hotel Comp Policy Model",
      href: "projects/hotel-comp-policy-model.html",
      patterns: [/\bhotel\s+comp\b/i, /\bservice[-\s]+recovery\b/i, /\bdecision\s+desk\b/i]
    },
    {
      title: "Assessment Analytics",
      href: "dashboard/assessment.html",
      patterns: [/\banalytics?\s+dashboard\b/i, /\bdashboard\b/i, /\binteractive\s+demo\b/i]
    },
    {
      title: "Education Data Lab",
      href: "data-lab.html",
      patterns: [/\bportfolio\s+data\s+lab\b/i, /\bdata\s+lab\b/i, /\banalytic\s+chat\b/i]
    },
    {
      title: "Assessment Intelligence",
      href: "projects/assessment-intelligence.html",
      patterns: [/\bassessment\s+intelligence\b/i, /\bsql-backed\s+extracts?\b/i, /\bassessment\s+system\s+work\b/i]
    },
    {
      title: "Education Data Simulation Engine",
      href: "projects/education-data-simulation-engine.html",
      patterns: [/\beducation\s+data\s+simulation\s+engine\b/i, /\bsynthetic\s+education\s+data\b/i, /\bsimulation\s+foundation\b/i]
    },
    {
      title: "Assessment Growth Analytics in R",
      href: "projects/statistical-risk-modeling-r.html",
      patterns: [/\bassessment\s+growth\s+analytics\s+in\s+r\b/i, /\bexpected-growth\s+model/i, /\bsection\s+signal\b/i]
    },
    {
      title: "Statistical Methods Evidence",
      href: "projects/graduate-statistics-portfolio.html",
      patterns: [/\bstatistical\s+methods\s+evidence\b/i, /\bgraduate\s+statistics\s+portfolio\b/i, /\bgraduate\s+statistics\s+work\b/i, /\bexam\s+1\b/i, /\bfinal\s+project\b/i]
    },
    {
      title: "Content Intelligence",
      href: "projects/content-intelligence.html",
      patterns: [/\bcontent\s+intelligence\b/i, /\bartifact-to-rag\b/i, /\bsource-grounded\b/i, /\bcorpus\s+construction\b/i]
    },
    {
      title: "Content Intelligence RAG",
      href: "demos/content-rag.html",
      patterns: [/\bcontent\s+rag\b/i, /\blive\s+rag\b/i, /\bcited\s+retrieval\b/i]
    },
    {
      title: "Instructional AI Workflows",
      href: "projects/instructional-ai-workflows.html",
      patterns: [/\binstructional\s+ai\s+workflows\b/i, /\bhuman-reviewed\s+ai\b/i, /\bfeedback\s+workflows\b/i]
    },
    {
      title: "Assessment-to-Remediation Pipeline",
      href: "projects/assessment-to-remediation-pipeline.html",
      patterns: [/\bassessment-to-remediation\s+pipeline\b/i, /\bremediation\s+pipeline\b/i, /\bdiagnostic\s+evidence\b/i]
    },
    {
      title: "Projects directory",
      href: "projects/index.html",
      patterns: [/\bcase\s+studies\b/i, /\bcase\s+study\b/i]
    }
  ];

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
    return safeHttpUrl(value, window.location.href) || "#";
  };

  const normalizeLink = (link) => {
    const label = link?.title || link?.label || link?.text || link?.name;
    const href = safeHref(link?.href || link?.url || link?.path || "");
    if (!label || href === "#") return null;
    return { title: String(label), href };
  };

  const uniqueLinks = (links) => {
    const seen = new Set();
    return links.filter((link) => {
      if (!link || seen.has(link.href)) return false;
      seen.add(link.href);
      return true;
    });
  };

  const explicitLinksFromPayload = (payload) => {
    const links = [];
    if (Array.isArray(payload.links)) links.push(...payload.links);
    (payload.blocks || []).forEach((block) => {
      if (Array.isArray(block.links)) links.push(...block.links);
      if (block.type === "links" && Array.isArray(block.items)) links.push(...block.items);
    });
    return uniqueLinks(links.map(normalizeLink));
  };

  const destinationSearchText = (payload) =>
    [
      payload.answer,
      ...(payload.blocks || []).flatMap((block) => [
        block.title,
        block.content,
        block.nextBestAction,
        ...(block.questions || []),
        ...(block.links || []).map((link) => `${link.title || link.label || ""} ${link.href || link.url || ""}`),
        ...(block.items || []).map((link) => `${link.title || link.label || ""} ${link.href || link.url || ""}`)
      ])
    ]
      .filter(Boolean)
      .join(" ");

  const inferredDestinationLinks = (payload) => {
    const text = destinationSearchText(payload);
    if (!text) return [];
    return DESTINATION_LINKS.filter((destination) => destination.patterns.some((pattern) => pattern.test(text)))
      .slice(0, 4)
      .map((destination) => normalizeLink(destination))
      .filter(Boolean);
  };

  const renderVisitLinks = (links, title = "Recommended pages") => {
    const usableLinks = uniqueLinks(links).slice(0, 4);
    if (!usableLinks.length) return "";
    return `<div class="portfolio-helper-link-list"><strong>${escapeHtml(title)}</strong><div>${usableLinks
      .map((link) => `<a class="portfolio-helper-link" href="${escapeHtml(link.href)}">${escapeHtml(link.title)}</a>`)
      .join("")}</div></div>`;
  };

  let closeTimer = 0;
  let closeTransitionHandler = null;
  let openFrame = 0;

  const prefersReducedMotion = () =>
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clearCloseState = () => {
    window.clearTimeout(closeTimer);
    closeTimer = 0;
    if (openFrame) {
      window.cancelAnimationFrame(openFrame);
      openFrame = 0;
    }
    if (closeTransitionHandler) {
      panel.removeEventListener("transitionend", closeTransitionHandler);
      closeTransitionHandler = null;
    }
    helper.classList.remove("is-closing");
  };

  const openPanel = () => {
    clearCloseState();
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close portfolio navigator");
    if (prefersReducedMotion()) {
      helper.classList.add("is-open");
      input.focus();
      return;
    }
    openFrame = window.requestAnimationFrame(() => {
      openFrame = 0;
      helper.classList.add("is-open");
    });
    window.setTimeout(() => input.focus(), 160);
  };

  const closePanel = () => {
    if (panel.hidden) return;
    clearCloseState();
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open portfolio navigator");
    helper.classList.remove("is-open");

    const finishClose = () => {
      clearCloseState();
      panel.hidden = true;
      toggle.focus();
    };

    if (prefersReducedMotion()) {
      finishClose();
      return;
    }

    helper.classList.add("is-closing");
    closeTransitionHandler = (event) => {
      if (event.target === panel) finishClose();
    };
    panel.addEventListener("transitionend", closeTransitionHandler);
    closeTimer = window.setTimeout(finishClose, PANEL_TRANSITION_MS);
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
    const title = String(block.title || "").trim();
    if (!title || title.toLowerCase() === "supported scope") return "";
    const nextBestAction = block.nextBestAction ? `<p>Next best action: ${escapeHtml(block.nextBestAction)}</p>` : "";
    return `<div class="portfolio-helper-status ${escapeHtml(block.status || "info")}"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(block.content || "")}</p>${nextBestAction}</div>`;
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
    const visitLinks = uniqueLinks([...explicitLinksFromPayload(payload), ...inferredDestinationLinks(payload)]);
    return `${body}${renderVisitLinks(visitLinks)}${citations ? `<div class="portfolio-helper-sources"><strong>Sources</strong><ul>${citations}</ul></div>` : ""}`;
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
    `<div class="portfolio-helper-status info"><strong>Open Data Lab</strong><p>That looks like an analytics or visualization request for the synthetic education warehouse.</p><p class="portfolio-helper-link-row"><a class="portfolio-helper-link" href="${escapeHtml(href)}">Open Data Lab with this prompt</a></p></div>`;

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

  addMessage("assistant", "<p>Hi. I can help you find the right project brief or live demo on this portfolio.</p>");
}
