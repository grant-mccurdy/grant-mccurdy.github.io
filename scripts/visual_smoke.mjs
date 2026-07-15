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
    overflow,
  };
}

async function inspectHelper(page, label) {
  if (!label.startsWith("home-")) return null;
  await page.route("https://portfolio-rag-api.grant-mccurdy.workers.dev/query", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        answer: "Start with the Analytics Dashboard, then open the Portfolio Data Lab. For methods evidence, visit Statistical Methods Evidence.",
        blocks: [
          {
            type: "text",
            content:
              "Start with the **Analytics Dashboard**, then open the Portfolio Data Lab. For methods evidence, visit Statistical Methods Evidence."
          },
          {
            type: "suggestions",
            title: "Suggested follow-ups",
            questions: ["Which project shows analytics work?"]
          }
        ],
        links: [{ title: "Analytics Dashboard", url: "/dashboard/assessment.html" }]
      }),
    });
  });
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
    toggleVisible: toggleRect.width >= 100 && toggleRect.height >= 50,
    initialText: initialText.includes("I can help you find the right project"),
    handoff:
      handoffText.includes("Open Data Lab") &&
      Boolean(handoffUrl?.pathname.endsWith("/data-lab.html")) &&
      handoffUrl?.searchParams.get("question") === "create a trend line" &&
      handoffUrl?.searchParams.get("autorun") === "1",
    recommendationLinks:
      recommendationLinks.some((link) => link.href.endsWith("/dashboard/assessment.html") && link.text.includes("Analytics Dashboard")) &&
      recommendationLinks.some((link) => link.href.endsWith("/data-lab.html") && link.text.includes("Portfolio Data Lab")) &&
      recommendationLinks.some((link) => link.href.endsWith("/projects/graduate-statistics-portfolio.html")),
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
  await page.getByText("Synthetic Education Warehouse").waitFor({ state: "visible", timeout: 1500 });
  return {
    datasetName: (await page.locator("[data-dataset-name]").innerText()).includes("Synthetic Education Warehouse"),
    datasetTables: (await page.locator("[data-dataset-tables]").innerText()).includes("15 tables"),
    datasetMode: (await page.locator("[data-dataset-mode]").innerText()).includes("sqlite analyst"),
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
  await thread.getByText("Content Intelligence RAG").waitFor({ state: "visible", timeout: 1500 });
  await page.locator("[data-chat-input]").fill("How does the artifact-to-RAG workflow work?");
  await page.locator("[data-chat-form] button[type='submit']").click();
  await thread.getByText("Source-grounded answer").waitFor({ state: "visible", timeout: 1500 });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const text = await thread.innerText();
  const sourceHref = await thread.locator(".content-rag-sources a").last().getAttribute("href");
  const answerPosition = await page.evaluate(() => {
    const header = document.querySelector("[data-header]")?.getBoundingClientRect();
    const messages = Array.from(document.querySelectorAll("[data-chat-thread] .chat-message.assistant"));
    const answer = messages.at(-1)?.getBoundingClientRect();
    const clearance = 8;
    return {
      answerTop: answer?.top ?? null,
      headerBottom: header?.bottom ?? null,
      visibleBelowHeader: Boolean(
        answer && header && answer.top >= header.bottom + clearance && answer.top < window.innerHeight
      ),
      alignedBelowHeader: Boolean(
        answer && header && answer.top >= header.bottom + clearance && answer.top <= header.bottom + 20
      ),
    };
  });
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
    rendered: text.includes("Source-grounded answer") && text.includes("Follow-up questions"),
    citation: Boolean(sourceHref?.includes("content-intelligence/blob/main/sample_outputs/rag-index.json")),
    retrieval: text.includes("Hybrid vector + lexical retrieval") && text.includes("@cf/baai/bge-base-en-v1.5"),
    limits: text.includes("public-safe generated index records"),
    answerPosition,
    overflow,
  };
}

async function inspectHotelComp(page, label) {
  if (label.startsWith("hotel-comp-decision-")) {
    const bodyText = await page.locator("body").innerText();
    const pdfHref = await page
      .getByRole("link", { name: "Executive brief PDF", exact: true })
      .getAttribute("href");
    const appendixHref = await page
      .getByRole("link", { name: "Policy selection appendix", exact: true })
      .getAttribute("href");
    const decisionDeskHref = await page
      .getByRole("link", { name: "Open the Decision Desk", exact: true })
      .getAttribute("href");
    return {
      boundary:
        bodyText.includes("historical comp actions, costs, and outcomes in this prototype are synthetic") &&
        bodyText.includes("No Proper Hotels guest records"),
      decisionFramework:
        (await page.locator("h1").innerText()) === "A Comp Decision Engine for Luxury Hotel Service Recovery" &&
        bodyText.includes("The business task") &&
        bodyText.includes("The proposed decision product") &&
        bodyText.includes("An illustrative recommendation") &&
        bodyText.includes("How the real model would be chosen") &&
        bodyText.includes("A focused first step") &&
        bodyText.includes("four weeks or 50 eligible cases") &&
        bodyText.includes("workflow discovery, not proof of impact") &&
        bodyText.includes("90-minute data and policy workshop"),
      workedRecommendation:
        bodyText.includes("late checkout + personal manager note") &&
        bodyText.includes("Modeled guest-facing value: $100") &&
        bodyText.includes("Assumed internal-cost range: $8-$45") &&
        bodyText.includes("not estimates of property economics"),
      interactivePrototype:
        bodyText.includes("Test the prototype") &&
        bodyText.includes("Synthetic scenarios only") &&
        bodyText.includes("Do not enter actual guest or reservation information") &&
        decisionDeskHref === "https://hotel-comp-decision-desk.grant-mccurdy.workers.dev/",
      artifactHierarchy:
        pdfHref === "hotel-comp-decision-framework.pdf" &&
        appendixHref === "technical-appendix.html" &&
        decisionDeskHref === "https://hotel-comp-decision-desk.grant-mccurdy.workers.dev/",
      focusBoundary:
        !["Guardrailed recovery", "5,000", "Snowflake", "Cloudflare", "RAG"].some((text) =>
          bodyText.includes(text),
        ),
      reportFormat:
        pdfHref === "hotel-comp-decision-framework.pdf" &&
        (await page.locator("table").count()) === 0 &&
        (await page.locator("figure").count()) === 0 &&
        (await page.locator("button, [role='tab']").count()) === 0,
    };
  }
  if (label.startsWith("hotel-comp-appendix-")) {
    const bodyText = await page.locator("body").innerText();
    const briefHref = await page
      .getByRole("link", { name: "Return to the executive brief", exact: true })
      .getAttribute("href");
    const pdfHref = await page
      .getByRole("link", { name: "Download the executive PDF", exact: true })
      .getAttribute("href");
    const deskHref = await page
      .getByRole("link", { name: "Open the synthetic Decision Desk", exact: true })
      .getAttribute("href");
    const tableScroll = await page.locator(".cell-output-display:has(table)").evaluateAll((containers) =>
      containers.every((container) => {
        const rect = container.getBoundingClientRect();
        const style = window.getComputedStyle(container);
        return (
          style.overflowX === "auto" &&
          rect.left >= -2 &&
          rect.right <= document.documentElement.clientWidth + 2
        );
      }),
    );
    return {
      appendixBoundary:
        bodyText.includes("evaluates policy rules on synthetic hotel operations") &&
        bodyText.includes("does not establish actual policy effectiveness, savings, margins, or guest outcomes"),
      appendixMethod:
        (await page.locator("h1").innerText()) === "Policy Selection Methodology" &&
        bodyText.includes("policy selection, not final predictive-model selection") &&
        bodyText.includes("2,150 matched case-policy evaluations") &&
        bodyText.includes("10,000-draw paired case bootstrap") &&
        bodyText.includes("5,000-draw shared-world assumption stress") &&
        bodyText.includes("stress-median cost") &&
        bodyText.includes("What real data must establish"),
      appendixEvidence:
        (await page.locator("table").count()) === 4 &&
        (await page.locator("img[role='img']").count()) === 1 &&
        (await page.locator(".selection-flow-list li").count()) === 6 &&
        (await page.locator("figcaption").count()) >= 6 &&
        bodyText.includes("$29,104") &&
        bodyText.includes("$30,467") &&
        bodyText.includes("$27,342-$33,944"),
      appendixNavigation:
        briefHref === "index.html" &&
        pdfHref === "hotel-comp-decision-framework.pdf" &&
        deskHref === "https://hotel-comp-decision-desk.grant-mccurdy.workers.dev/",
      appendixFormat:
        (await page.locator("button, [role='tab'], .site-header, .report-hero").count()) === 0 && tableScroll,
    };
  }
  if (label.startsWith("hotel-comp-technical-")) {
    const boundary = await page.locator("footer").innerText();
    const scenarioButton = page.locator('[data-scenario="parking_friction"]');
    await scenarioButton.click();
    return {
      boundary: boundary.includes("synthetic hotel operations") && boundary.includes("does not use or claim access"),
      technicalPolicyDecision:
        (await page.locator("h1").innerText()) === "Which Comp Policy Should Enter Shadow Validation?" &&
        (await page.locator(".policy-plot-row").count()) === 5 &&
        (await page.locator(".protection-cell").count()) === 5 &&
        (await page.locator(".policy-plot-row.selected").count()) === 1 &&
        (await page.locator(".policy-decision-figure figcaption").innerText()).includes(
          "Policies must clear every guardrail",
        ),
      technicalScenarioChanged:
        (await page.locator("#scenario-amount").innerText()) === "$100" &&
        (await page.locator("#scenario-gesture").innerText()).includes("parking or destination-fee waiver") &&
        (await scenarioButton.getAttribute("aria-pressed")) === "true",
    };
  }
  if (label.startsWith("hotel-comp-audit-")) {
    const bodyText = await page.locator("body").innerText();
    return {
      auditBoundary:
        bodyText.includes("Synthetic policy simulation") &&
        bodyText.includes("not Proper Hotels findings") &&
        bodyText.includes("Selected-Policy Review Queue Preview") &&
        bodyText.includes("Five-Policy Comparison"),
    };
  }
  if (label.startsWith("hotel-comp-engineering-")) {
    const bodyText = await page.locator("body").innerText();
    return {
      engineeringEvidence:
        bodyText.includes("Decision Lineage") &&
        bodyText.includes("Snowflake typed MARTS / AUDIT") &&
        bodyText.includes("Data Contracts And Quality Gates") &&
        bodyText.includes("Security And Cost Controls"),
    };
  }
  return null;
}

const cases = [
  ["home-desktop", "index.html", 1440, 1000],
  ["home-mobile", "index.html", 390, 900],
  ["projects-directory-desktop", path.join("projects", "index.html"), 1440, 1000],
  ["projects-directory-mobile", path.join("projects", "index.html"), 390, 900],
  ["hotel-comp-decision-desktop", path.join("projects", "hotel-comp-policy-model", "index.html"), 1440, 1000],
  ["hotel-comp-decision-mobile", path.join("projects", "hotel-comp-policy-model", "index.html"), 390, 900],
  ["hotel-comp-appendix-desktop", path.join("projects", "hotel-comp-policy-model", "technical-appendix.html"), 1440, 1000],
  ["hotel-comp-appendix-mobile", path.join("projects", "hotel-comp-policy-model", "technical-appendix.html"), 390, 900],
  ["hotel-comp-technical-desktop", path.join("projects", "hotel-comp-policy-model", "technical-prototype.html"), 1440, 1000],
  ["hotel-comp-audit-desktop", path.join("projects", "hotel-comp-policy-model", "simulation-audit.html"), 1440, 1000],
  ["hotel-comp-audit-mobile", path.join("projects", "hotel-comp-policy-model", "simulation-audit.html"), 390, 900],
  ["hotel-comp-methodology-mobile", path.join("projects", "hotel-comp-policy-model", "methodology.html"), 390, 900],
  ["hotel-comp-policy-analysis-mobile", path.join("projects", "hotel-comp-policy-model", "policy-decision-analysis.html"), 390, 900],
  ["hotel-comp-engineering-mobile", path.join("projects", "hotel-comp-policy-model", "engineering-evidence.html"), 390, 900],
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
  ["content-rag-desktop", "projects/content-intelligence.html?content_endpoint=/mock-content-rag", 1440, 1000],
  ["content-rag-mobile", "projects/content-intelligence.html?content_endpoint=/mock-content-rag", 390, 900],
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

try {
  for (const [label, file, width, height] of cases) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(`${baseUrl}/${file.replaceAll(path.sep, "/")}`, { waitUntil: "networkidle" });
    results.push({
      label,
      ...(await inspect(page)),
      helper: await inspectHelper(page, label),
      dataLab: await inspectDataLabPrefill(page, label),
      dataLabCatalog: await inspectDataLabCatalog(page, label),
      capability: await inspectDataLabCapability(page, label),
      contentRag: await inspectContentRag(page, label),
      hotelComp: await inspectHotelComp(page, label),
    });
    await page.close();
  }
} finally {
  await browser.close();
  await closeServer(server);
}

const heroVideoFailed = (result) => {
  if (!result.label.startsWith("home-")) return false;
  return (
    !result.heroVideo ||
    !result.heroVideo.currentSrc.includes("assets/video/workflow-hero.mp4") ||
    !result.heroVideo.loop ||
    !result.heroVideo.muted ||
    result.heroVideo.objectFit !== "cover" ||
    result.heroVideo.playbackRate < 2.5 ||
    result.heroVideo.rect.width < result.heroVideo.viewport.width ||
    result.heroVideo.rect.height < result.heroVideo.viewport.height ||
    result.heroVideo.videoWidth < 1 ||
    result.heroVideo.videoHeight < 1
  );
};

const failures = results.filter(
  (result) =>
    result.overflow.length > 0 ||
    result.dashboardError ||
    heroVideoFailed(result) ||
    result.helper?.overflow.length ||
    result.helper?.opened === false ||
    result.helper?.closed === false ||
    result.helper?.toggleVisible === false ||
    result.helper?.initialText === false ||
    result.helper?.handoff === false ||
    result.helper?.recommendationLinks === false ||
    result.dataLab?.prefilled === false ||
    result.dataLabCatalog?.datasetName === false ||
    result.dataLabCatalog?.datasetTables === false ||
    result.dataLabCatalog?.datasetMode === false ||
    result.capability?.capabilityNote === false ||
    result.contentRag?.rendered === false ||
    result.contentRag?.citation === false ||
    result.contentRag?.retrieval === false ||
    result.contentRag?.limits === false ||
    result.contentRag?.answerPosition?.visibleBelowHeader === false ||
    result.contentRag?.answerPosition?.alignedBelowHeader === false ||
    result.contentRag?.overflow.length ||
    result.hotelComp?.boundary === false ||
    result.hotelComp?.decisionFramework === false ||
    result.hotelComp?.workedRecommendation === false ||
    result.hotelComp?.focusBoundary === false ||
    result.hotelComp?.reportFormat === false ||
    result.hotelComp?.artifactHierarchy === false ||
    result.hotelComp?.appendixBoundary === false ||
    result.hotelComp?.appendixMethod === false ||
    result.hotelComp?.appendixEvidence === false ||
    result.hotelComp?.appendixNavigation === false ||
    result.hotelComp?.appendixFormat === false ||
    result.hotelComp?.technicalPolicyDecision === false ||
    result.hotelComp?.technicalScenarioChanged === false ||
    result.hotelComp?.auditBoundary === false ||
    result.hotelComp?.engineeringEvidence === false,
);
console.log(JSON.stringify(results, null, 2));

if (failures.length) {
  process.exitCode = 1;
}
