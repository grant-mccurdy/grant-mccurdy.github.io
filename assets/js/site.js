const navToggle = document.querySelector("[data-nav-toggle]");
const navLinks = document.querySelector("[data-nav-links]");
const year = document.querySelector("[data-year]");
const header = document.querySelector("[data-header]");
const revealItems = Array.from(document.querySelectorAll("[data-reveal]"));
const playbackVideos = Array.from(document.querySelectorAll("video[data-playback-rate]"));

document.documentElement.classList.add("js-reveal");

if (year) {
  year.textContent = new Date().getFullYear();
}

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!isOpen));
    navLinks.classList.toggle("is-open", !isOpen);
  });

  navLinks.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      navToggle.setAttribute("aria-expanded", "false");
      navLinks.classList.remove("is-open");
    }
  });
}

if (header) {
  const updateHeader = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  };

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });
}

playbackVideos.forEach((video) => {
  const playbackRate = Number.parseFloat(video.dataset.playbackRate || "");

  if (!Number.isFinite(playbackRate) || playbackRate <= 0) {
    return;
  }

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
