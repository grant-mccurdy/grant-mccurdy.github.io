#!/usr/bin/env node
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = path.resolve(path.join(import.meta.dirname, ".."));
const requireFromHere = createRequire(import.meta.url);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (originalError) {
    const candidates = [
      process.env.PLAYWRIGHT_MODULE_DIR,
      ...(process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : []),
    ].filter(Boolean);

    for (const candidate of candidates) {
      for (const specifier of [path.join(candidate, "playwright"), candidate]) {
        try {
          return requireFromHere(specifier);
        } catch {
          // Try the next candidate.
        }
      }
    }

    throw originalError;
  }
}

function staticServer() {
  return http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname === "/mock-analytics") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          answer: "I cannot do that exact request from this public demo, but I can suggest a supported analysis.",
          blocks: [
            { type: "text", content: "I cannot do that exact request from this public demo, but I can suggest a supported analysis." },
            {
              type: "capability_note",
              title: "Supported scope",
              status: "warning",
              content: "Data Lab can analyze the bundled synthetic education warehouse, but cannot browse live repos.",
              nextBestAction: "Run a supported aggregate analysis over the synthetic warehouse."
            },
            {
              type: "suggestions",
              title: "Suggested follow-ups",
              questions: ["How does average observed growth change by school year?"]
            }
          ]
        }),
      );
      return;
    }
    if (pathname === "/mock-datasets") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          generatedAt: "2026-07-13T21:53:04.922Z",
          defaultDatasetId: "synthetic_education_warehouse",
          datasets: [
            {
              id: "synthetic_education_warehouse",
              title: "Synthetic Education Warehouse",
              dialect: "sqlite",
              tables: 15,
              columns: 234,
              capabilities: ["dataset_overview"],
              suggestedQuestions: ["What stands out in the data?"]
            }
          ]
        }),
      );
      return;
    }
    if (pathname === "/mock-content-rag") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          answer: [
            "Source-grounded answer about the artifact-to-RAG workflow with cited evidence [1].",
            "Source adapters normalize supported documents into stable text artifacts before indexing.",
            "The conversion layer records provenance and public-safety metadata alongside each information object.",
            "Chunking preserves identifiers that allow retrieval results to map back to the generated public artifact.",
            "Hybrid retrieval combines semantic matches with lexical evidence for precise source selection.",
            "The answer layer cites the selected records and reports retrieval details without exposing private source material.",
          ].join("\n\n"),
          mode: "content_rag_generated",
          retrievalMode: "hybrid",
          vectorConfigured: true,
          vector: {
            model: "@cf/baai/bge-base-en-v1.5",
            dimensions: 768,
            matches: 3,
          },
          limits: ["This route uses public-safe generated index records."],
          suggestedQuestions: ["What is an information object in this project?"],
          citations: [
            {
              number: 1,
              title: "Assessment Review Cycle Planning Notes",
              url: "https://github.com/grant-mccurdy/content-intelligence/blob/main/sample_outputs/rag-index.json",
            },
          ],
        }),
      );
      return;
    }
    if (pathname === "/mock-content-sources") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          chunks: 92,
          retrievalMode: "hybrid",
          corpusFingerprint: "77ed1a608b9286fc2be12646242aae91f94bce003671ee053c9af268f1776b2c",
        }),
      );
      return;
    }
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const target = path.resolve(root, relativePath);

    if (target !== root && !target.startsWith(root + path.sep)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    let filePath = target;
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] ?? "application/octet-stream" });
    fs.createReadStream(filePath).pipe(response);
  });
}

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not start visual smoke server");
  }
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function inspect(page) {
  const bodyText = await page.locator("body").innerText();
  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll("body *"))
      .filter((el) => {
        if (el.closest(".hero-media")) return false;
        if (el.closest(".chart-frame, .table-wrap, .report-table-wrap, .table-scroll, .cell-output-display")) return false;
        const rect = el.getBoundingClientRect();
        return (
          rect.width &&
          rect.height &&
          (rect.right > document.documentElement.clientWidth + 2 || rect.left < -2)
        );
      })
      .slice(0, 5)
      .map((el) => ({
        tag: el.tagName,
        className: String(el.className),
        text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
      })),
  );

  const heroVideo = await page.evaluate(async () => {
    const video = document.querySelector(".hero-video");
    if (!video) return null;
    if (video.readyState < 1) {
      await new Promise((resolve) => {
        video.addEventListener("loadedmetadata", resolve, { once: true });
        window.setTimeout(resolve, 2500);
      });
    }
    return {
      currentSrc: video.currentSrc,
      duration: video.duration,
      loop: video.loop,
      muted: video.muted,
      objectFit: window.getComputedStyle(video).objectFit,
      playbackRate: video.playbackRate,
      readyState: video.readyState,
      rect: (() => {
        const rect = video.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      })(),
      viewport: {
        width: document.documentElement.clientWidth,
        height: window.innerHeight,
      },
      videoHeight: video.videoHeight,
      videoWidth: video.videoWidth,
    };
  });

  return {
    title: await page.title(),
    h1: await page.locator("h1").first().innerText(),
    simulationTitleMention: bodyText.includes("Education Data Simulation Engine"),
    projectCards: await page.locator(".project-card").count(),
    artifactCards: await page.locator(".artifact-link-card").count(),
    dashboardError: bodyText.includes("Dashboard data did not load"),
    heroVideo,
    heroReport: await page.locator(".hero-report").evaluateAll((images) => images.map((img) => ({ loaded: img.complete && img.naturalWidth > 0, source: img.getAttribute("src") }))),
    overflow,
    shell: await page.evaluate(() => {
      if (!document.querySelector("[data-header]")) return null;
      return {
        skipLink: Boolean(document.querySelector('.skip-link[href="#main"]')),
        mainTarget: Boolean(document.querySelector("main#main")),
        footer: Boolean(document.querySelector(".site-footer")),
        navToggle: Boolean(document.querySelector("[data-nav-toggle]")),
      };
    }),
  };
}

async function inspectNavigation(page, label) {
  if (label !== "projects-directory-mobile") return null;
  const toggle = page.locator("[data-nav-toggle]");
  const links = page.locator("[data-nav-links]");
  await toggle.click();
  const opened = (await toggle.getAttribute("aria-expanded")) === "true" && (await links.isVisible());
  await page.keyboard.press("Escape");
  const closed = (await toggle.getAttribute("aria-expanded")) === "false" && !(await links.isVisible());
  return {
    opened,
    closed,
    activeProject: (await links.locator('a[aria-current="page"]').innerText()) === "Systems",
  };
}

async function inspectHelper(page, label) {
  if (!label.startsWith("home-")) return null;
  await page.route("https://portfolio-rag-api.grant-mccurdy.workers.dev/query", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        answer: "Start with Statistical Risk Modeling in R, then open Assessment Analytics. Use the Education Data Lab as supporting evidence.",
        blocks: [
          {
            type: "text",
            content:
              "Start with **Statistical Risk Modeling in R**, then open Assessment Analytics. Use the Education Data Lab as supporting evidence."
          },
          {
            type: "capability_note",
            title: "Supported scope",
            status: "warning",
            content: "This generic scope note should not appear in the portfolio helper."
          },
          {
            type: "suggestions",
            title: "Suggested follow-ups",
            questions: ["Which project shows analytics work?"]
          }
        ],
        links: [{ title: "Assessment Analytics", url: "/dashboard/assessment.html" }]
      }),
    });
  });
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, Math.min(700, document.documentElement.scrollHeight - window.innerHeight));
  });
  await page.waitForTimeout(80);
  const toggle = page.locator("[data-helper-toggle]");
  const panel = page.locator("[data-helper-panel]");
  const toggleRect = await toggle.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  await toggle.click();
  await panel.waitFor({ state: "visible", timeout: 1500 });
  const opened = await panel.isVisible();
  const initialText = await panel.locator("[data-helper-thread]").innerText();
  await panel.locator("[data-helper-input]").fill("create a trend line");
  await panel.locator("[data-helper-form] button[type='submit']").click();
  const handoffLink = panel.locator(".portfolio-helper-status.info a").last();
  await handoffLink.waitFor({ state: "visible", timeout: 1500 });
  const handoffHref = await handoffLink.getAttribute("href");
  const handoffUrl = handoffHref ? new URL(handoffHref, page.url()) : null;
  const handoffText = await panel.locator("[data-helper-thread]").innerText();
  await panel.locator("[data-helper-input]").fill("What should I look at first?");
  await panel.locator("[data-helper-form] button[type='submit']").click();
  await panel.locator(".portfolio-helper-link-list a[href*='dashboard/assessment.html']").last().waitFor({ state: "visible", timeout: 1500 });
  const recommendationText = await panel.locator("[data-helper-thread]").innerText();
  const recommendationLinks = await panel.locator(".portfolio-helper-link-list a").evaluateAll((links) =>
    links.map((link) => ({
      href: link.href,
      text: link.textContent || "",
    })),
  );
  const overflow = await page.evaluate(() => {
    const panelEl = document.querySelector("[data-helper-panel]");
    if (!panelEl) return [];
    const rect = panelEl.getBoundingClientRect();
    return rect.right > document.documentElement.clientWidth + 2 || rect.left < -2
      ? [{ className: String(panelEl.className), right: rect.right, left: rect.left }]
      : [];
  });
  await page.locator("[data-helper-close]").click();
  await panel.waitFor({ state: "hidden", timeout: 1500 });
  const closed = await panel.isHidden();
  return {
    opened,
    closed,
    toggleVisible:
      label === "home-mobile"
        ? toggleRect.width >= 48 && toggleRect.height >= 48
        : toggleRect.width >= 100 && toggleRect.height >= 50,
    initialText: initialText.includes("I can help you find the right project"),
    handoff:
      handoffText.includes("Open Data Lab") &&
      Boolean(handoffUrl?.pathname.endsWith("/data-lab.html")) &&
      handoffUrl?.searchParams.get("question") === "create a trend line" &&
      handoffUrl?.searchParams.get("autorun") === "1",
    recommendationLinks:
      recommendationLinks.some((link) => link.href.endsWith("/dashboard/assessment.html") && link.text.includes("Assessment Analytics")) &&
      recommendationLinks.some((link) => link.href.endsWith("/data-lab.html") && link.text.includes("Education Data Lab")) &&
      recommendationLinks.some((link) => link.href.endsWith("/projects/statistical-risk-modeling-r.html") && link.text.includes("Statistical Risk Modeling in R")),
    supportedScopeHidden:
      !recommendationText.includes("Supported scope") &&
      !recommendationText.includes("This generic scope note should not appear in the portfolio helper."),
    overflow,
  };
}

async function inspectDataLabPrefill(page, label) {
  if (label !== "data-lab-prefill") return null;
  return {
    prefilled: (await page.locator("[data-chat-input]").inputValue()) === "create a trend line",
  };
}

async function inspectDataLabCatalog(page, label) {
  if (label !== "data-lab-catalog") return null;
  await page.locator("[data-dataset-name]").waitFor({ state: "attached", timeout: 1500 });
  return {
    datasetName: (await page.locator("[data-dataset-name]").textContent()).includes("Synthetic Education Warehouse"),
    datasetTables: (await page.locator("[data-dataset-tables]").textContent()).includes("15 tables"),
    datasetMode: (await page.locator("[data-dataset-mode]").textContent()).includes("sqlite analyst"),
    datasetUpdated: (await page.locator("[data-dataset-updated]").textContent()).includes("2026"),
  };
}

async function inspectDataLabCapability(page, label) {
  if (label !== "data-lab-capability") return null;
  const thread = page.locator("[data-chat-thread]");
  await thread.getByText("Supported scope").waitFor({ state: "visible", timeout: 1500 });
  const text = await thread.innerText();
  return {
    capabilityNote: text.includes("cannot browse live repos") && text.includes("How does average observed growth change by school year?"),
  };
}

async function inspectContentRag(page, label) {
  if (!label.startsWith("content-rag-")) return null;
  const thread = page.locator("[data-chat-thread]");
  await thread.getByText("Content Intelligence RAG").waitFor({ state: "visible", timeout: 5000 });
  await page.getByText("92 reviewed records").waitFor({ state: "visible", timeout: 5000 });
  await page.locator("[data-chat-input]").fill("How does the artifact-to-RAG workflow work?");
  const submitButton = page.locator("[data-chat-form] button[type='submit']");
  await submitButton.scrollIntoViewIfNeeded();
  const pageScrollBeforeResponse = await page.evaluate(() => window.scrollY);
  await submitButton.click();
  await thread.getByText("Source-grounded answer").waitFor({ state: "visible", timeout: 5000 });
  await page.waitForFunction(
    () => {
      const chatThread = document.querySelector("[data-chat-thread]");
      const messages = Array.from(document.querySelectorAll("[data-chat-thread] .chat-message.assistant"));
      const answer = messages.at(-1)?.getBoundingClientRect();
      const bounds = chatThread?.getBoundingClientRect();
      return Boolean(answer && bounds && answer.top >= bounds.top + 8 && answer.top < bounds.bottom);
    },
    undefined,
    { timeout: 3000 },
  );
  const text = await thread.innerText();
  const sourceHref = await thread.locator(".content-rag-sources a").last().getAttribute("href");
  const diagnosticsHidden =
    (await thread.locator(".content-rag-retrieval").count()) === 0 &&
    (await thread.getByText("Limits", { exact: true }).count()) === 0;
  const threadScroll = await page.evaluate((pageScrollBefore) => {
    const chatThread = document.querySelector("[data-chat-thread]");
    const messages = Array.from(document.querySelectorAll("[data-chat-thread] .chat-message.assistant"));
    const answer = messages.at(-1)?.getBoundingClientRect();
    const bounds = chatThread?.getBoundingClientRect();
    const clearance = 8;
    return {
      scrollTop: chatThread?.scrollTop ?? null,
      maxScrollTop: chatThread ? chatThread.scrollHeight - chatThread.clientHeight : null,
      hasOverflow: Boolean(chatThread && chatThread.scrollHeight > chatThread.clientHeight),
      latestAnswerVisible: Boolean(
        answer && bounds && answer.top >= bounds.top + clearance && answer.top < bounds.bottom
      ),
      pageStayedPut: Math.abs(window.scrollY - pageScrollBefore) <= 1,
    };
  }, pageScrollBeforeResponse);
  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-content-rag] *"))
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width && rect.height && (rect.right > document.documentElement.clientWidth + 2 || rect.left < -2);
      })
      .slice(0, 5)
      .map((el) => ({
        className: String(el.className),
        text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
      })),
  );
  return {
    corpusMetadata:
      (await page.locator("[data-content-source-status]").innerText()).includes("92 reviewed records") &&
      (await page.locator("[data-content-fingerprint]").getAttribute("title")) ===
        "Corpus fingerprint: 77ed1a608b9286fc2be12646242aae91f94bce003671ee053c9af268f1776b2c",
    rendered: text.includes("Source-grounded answer") && text.includes("Follow-up questions"),
    citation: Boolean(sourceHref?.includes("content-intelligence/blob/main/sample_outputs/rag-index.json")),
    diagnosticsHidden,
    threadScroll,
    overflow,
  };
}

async function inspectContentArtifacts(page, label) {
  if (label !== "content-desktop") return null;
  return page.locator("[data-source-artifacts] a").evaluateAll((links) => ({
    count: links.length,
    openInNewTabs: links.every(
      (link) => link.target === "_blank" && link.rel.split(/\s+/).includes("noopener")
    ),
  }));
}

const cases = [
  ["home-desktop", "index.html", 1440, 1000],
  ["home-mobile", "index.html", 390, 900],
  ["about-desktop", "about.html", 1440, 1000],
  ["about-mobile", "about.html", 390, 900],
  ["evidence-desktop", "evidence-methods.html", 1440, 1000],
  ["evidence-mobile", "evidence-methods.html", 390, 900],
  ["projects-directory-desktop", path.join("projects", "index.html"), 1440, 1000],
  ["projects-directory-mobile", path.join("projects", "index.html"), 390, 900],
  ["demos-directory-desktop", path.join("demos", "index.html"), 1440, 1000],
  ["demos-directory-mobile", path.join("demos", "index.html"), 390, 900],
  ["retired-project-desktop", path.join("projects", "hotel-comp-policy-model.html"), 1440, 1000],
  ["retired-project-mobile", path.join("projects", "hotel-comp-policy-model", "index.html"), 390, 900],
  ["synthetic-desktop", path.join("projects", "education-data-simulation-engine.html"), 1440, 1000],
  ["synthetic-mobile", path.join("projects", "education-data-simulation-engine.html"), 390, 900],
  ["data-lab-desktop", "data-lab.html", 1440, 1000],
  ["data-lab-mobile", "data-lab.html", 390, 900],
  ["data-lab-catalog", "data-lab.html?endpoint=/mock-analytics&datasets_endpoint=/mock-datasets", 390, 900],
  ["data-lab-prefill", "data-lab.html?question=create%20a%20trend%20line", 390, 900],
  ["data-lab-capability", "data-lab.html?endpoint=/mock-analytics&question=Can%20you%20query%20the%20GitHub%20repo%20directly%3F&autorun=1", 390, 900],
  ["assessment-desktop", path.join("projects", "assessment-intelligence.html"), 1440, 1000],
  ["assessment-mobile", path.join("projects", "assessment-intelligence.html"), 390, 900],
  ["risk-desktop", path.join("projects", "statistical-risk-modeling-r.html"), 1440, 1000],
  ["risk-mobile", path.join("projects", "statistical-risk-modeling-r.html"), 390, 900],
  ["graduate-stats-desktop", path.join("projects", "graduate-statistics-portfolio.html"), 1440, 1000],
  ["graduate-stats-mobile", path.join("projects", "graduate-statistics-portfolio.html"), 390, 900],
  ["remediation-desktop", path.join("projects", "assessment-to-remediation-pipeline.html"), 1440, 1000],
  ["remediation-mobile", path.join("projects", "assessment-to-remediation-pipeline.html"), 390, 900],
  ["content-desktop", path.join("projects", "content-intelligence.html"), 1440, 1000],
  ["content-mobile", path.join("projects", "content-intelligence.html"), 390, 900],
  ["content-rag-desktop", "demos/content-rag.html?content_endpoint=/mock-content-rag&content_sources_endpoint=/mock-content-sources", 1440, 1000],
  ["content-rag-mobile", "demos/content-rag.html?content_endpoint=/mock-content-rag&content_sources_endpoint=/mock-content-sources", 390, 900],
  ["workflow-desktop", path.join("projects", "instructional-ai-workflows.html"), 1440, 1000],
  ["workflow-mobile", path.join("projects", "instructional-ai-workflows.html"), 390, 900],
  ["dashboard-desktop", path.join("dashboard", "assessment.html"), 1440, 1000],
  ["dashboard-mobile", path.join("dashboard", "assessment.html"), 390, 900],
];

const { chromium } = await loadPlaywright();
const server = staticServer();
const baseUrl = await listen(server);
const browser = await chromium.launch({ headless: true });
const results = [];
const caseFilter = String(process.env.VISUAL_SMOKE_FILTER || "").trim();
const selectedCases = caseFilter ? cases.filter(([label]) => label.includes(caseFilter)) : cases;

if (!selectedCases.length) {
  throw new Error(`No visual smoke cases matched VISUAL_SMOKE_FILTER=${caseFilter}`);
}

try {
  for (const [label, file, width, height] of selectedCases) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(`${baseUrl}/${file.replaceAll(path.sep, "/")}`, { waitUntil: "networkidle" });
    results.push({
      label,
      ...(await inspect(page)),
      navigation: await inspectNavigation(page, label),
      helper: await inspectHelper(page, label),
      dataLab: await inspectDataLabPrefill(page, label),
      dataLabCatalog: await inspectDataLabCatalog(page, label),
      capability: await inspectDataLabCapability(page, label),
      contentRag: await inspectContentRag(page, label),
      contentArtifacts: await inspectContentArtifacts(page, label),
      retiredRoute: label.startsWith("retired-project-")
        ? {
            noindex: (await page.locator('meta[name="robots"]').getAttribute("content")) === "noindex, nofollow",
            claimFree:
              (await page.locator("h1").innerText()) === "Project evidence is unavailable." &&
              (await page.getByRole("link", { name: "Return to Systems", exact: true }).count()) === 1,
          }
        : null,
    });
    await page.close();
  }
} finally {
  await browser.close();
  await closeServer(server);
}

const heroMediaFailed = (result) => {
  if (!result.label.startsWith("home-")) return false;
  return result.heroReport.length !== 1 || !result.heroReport[0].loaded || !result.heroReport[0].source.includes("logos/course-distributions.png");
};

const failures = results.filter(
  (result) =>
    result.overflow.length > 0 ||
    result.shell?.skipLink === false ||
    result.shell?.mainTarget === false ||
    result.shell?.footer === false ||
    result.shell?.navToggle === false ||
    result.navigation?.opened === false ||
    result.navigation?.closed === false ||
    result.navigation?.activeProject === false ||
    result.dashboardError ||
    heroMediaFailed(result) ||
    result.helper?.overflow.length ||
    result.helper?.opened === false ||
    result.helper?.closed === false ||
    result.helper?.toggleVisible === false ||
    result.helper?.initialText === false ||
    result.helper?.handoff === false ||
    result.helper?.recommendationLinks === false ||
    result.helper?.supportedScopeHidden === false ||
    result.dataLab?.prefilled === false ||
    result.dataLabCatalog?.datasetName === false ||
    result.dataLabCatalog?.datasetTables === false ||
    result.dataLabCatalog?.datasetMode === false ||
    result.dataLabCatalog?.datasetUpdated === false ||
    result.capability?.capabilityNote === false ||
    result.contentRag?.corpusMetadata === false ||
    result.contentRag?.rendered === false ||
    result.contentRag?.citation === false ||
    result.contentRag?.diagnosticsHidden === false ||
    result.contentRag?.threadScroll?.hasOverflow === false ||
    result.contentRag?.threadScroll?.latestAnswerVisible === false ||
    result.contentRag?.threadScroll?.pageStayedPut === false ||
    result.contentRag?.overflow.length ||
    result.contentArtifacts?.count !== undefined && result.contentArtifacts.count !== 4 ||
    result.contentArtifacts?.openInNewTabs === false ||
    result.retiredRoute?.noindex === false ||
    result.retiredRoute?.claimFree === false,
);
console.log(JSON.stringify(results, null, 2));

if (failures.length) {
  process.exitCode = 1;
}
