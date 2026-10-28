(() => {
  const galleries = {
    assessment: [
      ['assets/images/previews/logos-assessment.png', 'Multiple-choice questions', 'An algebra question with answer choices and review controls.'],
      ['assets/images/previews/logos-question.png', 'Geometry questions', 'A geometry question with a triangle diagram and answer choices.'],
      ['assets/images/previews/logos-feedback.png', 'Personal practice diagnostic', 'Browser-calculated practice feedback from illustrative test responses.'],
    ],
    report: [
      ['assets/images/previews/report-courses.png', 'Courses and tracks', 'Interactive course distributions in the Logos math program report.'],
      ['assets/images/previews/report-comparisons.png', 'Course comparisons', 'Interactive comparison heatmap and selected-pair statistics.'],
      ['assets/images/previews/report-classes.png', 'Class patterns', 'Class-level distributions and filters in the interactive report.'],
      ['assets/images/previews/report-content.png', 'Content areas', 'Content-area profiles and chart controls in the interactive report.'],
    ],
  };
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-gallery]').forEach((gallery) => {
    const slides = galleries[gallery.dataset.gallery];
    if (!slides) return;
    const image = gallery.querySelector('.project-preview img');
    let index = 0, paused = motion.matches, visible = false, hovered = false, timer, request = 0, pointerToggle = null;
    const controls = document.createElement('div');
    controls.className = 'gallery-controls';
    const caption = document.createElement('span');
    caption.className = 'gallery-caption';
    caption.setAttribute('aria-live', 'off');
    controls.append(caption);
    function button(label, icon, action) {
      const el = document.createElement('button');
      el.type = 'button'; el.title = label; el.setAttribute('aria-label', label);
      const glyph = document.createElement('img');
      glyph.src = `assets/icons/${icon}.svg`; glyph.alt = ''; glyph.width = 18; glyph.height = 18;
      el.append(glyph); el.addEventListener('click', action); controls.append(el);
      return el;
    }
    function update() {
      caption.textContent = `${index + 1} / ${slides.length} · ${slides[index][1]}`;
      caption.setAttribute('aria-live', paused ? 'polite' : 'off');
      const label = paused ? 'Play previews' : 'Pause previews';
      toggle.title = label; toggle.setAttribute('aria-label', label);
      toggle.firstChild.src = `assets/icons/${paused ? 'play' : 'pause'}.svg`;
      gallery.dataset.slide = String(index);
      gallery.dataset.paused = String(paused);
    }
    function schedule() {
      clearTimeout(timer);
      if (!paused && visible && !hovered && !document.hidden) timer = setTimeout(() => show(index + 1), 5500);
    }
    async function show(next) {
      const ticket = ++request;
      const target = (next + slides.length) % slides.length;
      const preload = new Image(); preload.src = slides[target][0];
      try { await preload.decode(); } catch { paused = true; update(); schedule(); return; }
      if (ticket !== request) return;
      index = target; image.src = preload.src; image.alt = slides[index][2];
      if (!motion.matches) image.animate([{ opacity: 0, transform: 'translateX(20px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 420, easing: 'ease-out' });
      update(); schedule();
    }
    button('Previous preview', 'arrow-left', () => { paused = true; show(index - 1); });
    const toggle = button('Pause previews', 'pause', () => { paused = pointerToggle ?? !paused; pointerToggle = null; update(); schedule(); });
    // Preserve pointer intent across the focus event, which also pauses rotation.
    toggle.addEventListener('pointerdown', () => { pointerToggle = !paused; });
    toggle.addEventListener('pointercancel', () => { pointerToggle = null; });
    toggle.addEventListener('keydown', () => { pointerToggle = null; });
    toggle.addEventListener('blur', () => { pointerToggle = null; });
    button('Next preview', 'arrow-right', () => { paused = true; show(index + 1); });
    gallery.append(controls); update();
    gallery.addEventListener('mouseenter', () => { hovered = true; schedule(); });
    gallery.addEventListener('mouseleave', () => { hovered = false; schedule(); });
    // Keyboard interaction stops rotation until the visitor explicitly resumes it.
    gallery.addEventListener('focusin', (event) => {
      if (!gallery.contains(event.relatedTarget)) { paused = true; update(); schedule(); }
    });
    document.addEventListener('visibilitychange', schedule);
    motion.addEventListener('change', () => { if (motion.matches) paused = true; update(); schedule(); });
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); }, { threshold: .25 }).observe(gallery);
  });
})();
