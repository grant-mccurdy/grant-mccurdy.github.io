(() => {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-walkthrough]').forEach((container) => {
    const image = container.querySelector('[data-walkthrough-image]');
    const toggle = container.querySelector('[data-walkthrough-toggle]');
    if (!image || !toggle) return;
    const poster = image.getAttribute('src');
    const animation = image.dataset.animation;
    const icon = toggle.querySelector('img');
    const iconBase = icon.getAttribute('src').replace(/play\.svg$/, '');
    let requested = !motion.matches, visible = false, playing = false, failed = false;

    function render() {
      const next = requested && visible && !document.hidden && !failed;
      if (next !== playing) {
        playing = next;
        // GIF playback is suspended by restoring the static poster. Play restarts the loop.
        image.src = playing ? animation : poster;
      }
      container.dataset.playing = String(playing);
      const action = requested && !failed ? 'Pause' : 'Play';
      toggle.setAttribute('aria-label', action + ' Schools walkthrough');
      toggle.title = action + ' Schools walkthrough';
      icon.src = iconBase + (action === 'Pause' ? 'pause' : 'play') + '.svg';
    }

    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      requested = !requested;
      failed = false;
      render();
    });
    image.addEventListener('error', () => {
      if (!playing) return;
      failed = true;
      requested = false;
      render();
      toggle.title = 'Walkthrough unavailable. Retry playback';
      toggle.setAttribute('aria-label', 'Retry Schools walkthrough');
    });
    motion.addEventListener('change', () => {
      // A new reduced-motion preference always stops playback, including manual playback.
      if (motion.matches) requested = false;
      render();
    });
    document.addEventListener('visibilitychange', render);
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      render();
    }, {threshold: 0.15}).observe(container);
    render();
  });
})();
