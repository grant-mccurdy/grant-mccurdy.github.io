const siteScript = document.currentScript;
const siteRoot = siteScript?.src ? new URL("../../", siteScript.src) : new URL("./", window.location.href);

document.documentElement.classList.add("js", "js-reveal");

const siteUrl = (path) => new URL(path, siteRoot).href;
const main = document.querySelector("main");
const header = document.querySelector("[data-header]");
const navLinks = document.querySelector(".nav-links");
const revealItems = Array.from(document.querySelectorAll("[data-reveal]"));
const playbackVideos = Array.from(document.querySelectorAll("video[data-playback-rate]"));
const portfolioHelper = document.querySelector("[data-portfolio-helper]");

if (main && !main.id) {
  main.id = "main";
}

if (main && !document.querySelector(".skip-link")) {
  const skipLink = document.createElement("a");
  skipLink.className = "skip-link";
  skipLink.href = "#main";
  skipLink.textContent = "Skip to content";
  document.body.prepend(skipLink);
}

let navToggle = document.querySelector("[data-nav-toggle]");

if (navLinks) {
  navLinks.classList.remove("static");
  navLinks.dataset.navLinks = "";

  if (!navToggle) {
    navToggle = document.createElement("button");
    navToggle.className = "nav-toggle";
    navToggle.type = "button";
    navToggle.setAttribute("aria-label", "Toggle navigation");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.dataset.navToggle = "";
    navToggle.innerHTML = "<span></span><span></span><span></span>";
    navLinks.before(navToggle);
  }

  const closeNavigation = ({ restoreFocus = false } = {}) => {
    navToggle.setAttribute("aria-expanded", "false");
    navLinks.classList.remove("is-open");
    if (restoreFocus) navToggle.focus();
  };

  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!isOpen));
    navLinks.classList.toggle("is-open", !isOpen);
  });

  navLinks.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) closeNavigation();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && navLinks.classList.contains("is-open")) {
      closeNavigation({ restoreFocus: true });
    }
  });

  document.addEventListener("click", (event) => {
    if (
      navLinks.classList.contains("is-open") &&
      event.target instanceof Node &&
      !navLinks.contains(event.target) &&
      !navToggle.contains(event.target)
    ) {
      closeNavigation();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 860) closeNavigation();
  });

  const currentPath = window.location.pathname.replace(/\/$/, "/index.html");
  navLinks.querySelectorAll("a").forEach((link) => {
    const target = new URL(link.href, window.location.href);
    const targetPath = target.pathname.replace(/\/$/, "/index.html");
    const isProjectPage = targetPath.endsWith("/projects/index.html") && currentPath.includes("/projects/");
    const isCaseStudyPage = targetPath.endsWith("/case-studies/index.html") && currentPath.includes("/case-studies/");
    const isCurrentPage =
      target.origin === window.location.origin &&
      targetPath === currentPath &&
      (!target.hash || target.hash === window.location.hash);
    if (isProjectPage || isCaseStudyPage || isCurrentPage) link.setAttribute("aria-current", "page");
  });
}

if (!document.querySelector(".site-footer")) {
  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="footer-shell">
      <p>&copy; <span data-year></span> Grant McCurdy</p>
      <div class="footer-links">
        <a href="${siteUrl("projects/index.html")}">Projects</a>
        <a href="${siteUrl("dashboard/assessment.html")}">Dashboard</a>
        <a href="${siteUrl("data-lab.html")}">Data Lab</a>
        <a href="${siteUrl("case-studies/index.html")}">Case Studies</a>
        <a href="https://github.com/grant-mccurdy">GitHub</a>
      </div>
    </div>`;
  document.body.append(footer);
}

document.querySelectorAll("[data-year]").forEach((year) => {
  year.textContent = new Date().getFullYear();
});

if (header) {
  const updateHeader = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  };
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });
}

if (portfolioHelper) {
  const updateHelperVisibility = () => {
    const revealAfter = Math.min(560, window.innerHeight * 0.58);
    portfolioHelper.classList.toggle("is-deferred", window.scrollY < revealAfter);
  };
  updateHelperVisibility();
  window.addEventListener("scroll", updateHelperVisibility, { passive: true });
  window.addEventListener("resize", updateHelperVisibility);
}

playbackVideos.forEach((video) => {
  const playbackRate = Number.parseFloat(video.dataset.playbackRate || "");
  if (!Number.isFinite(playbackRate) || playbackRate <= 0) return;
  const applyPlaybackRate = () => {
    video.playbackRate = playbackRate;
  };
  applyPlaybackRate();
  video.addEventListener("loadedmetadata", applyPlaybackRate, { once: true });
});

if (revealItems.length) {
  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );
    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }
}
