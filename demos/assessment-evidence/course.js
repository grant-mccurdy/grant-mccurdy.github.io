(() => {
  document.documentElement.classList.add('js');
  const key = 'assessment-evidence-course-v1';
  const answers = { compare: 'spread', missing: 'denominator', decide: 'targeted' };
  const feedback = {
    compare: { same: 'Equal means can hide different distributions. Compare the ranges (2 versus 8) and inspect individual responses.', spread: 'Supported. Class B has a wider range, but individual work is needed before selecting support.', teacher: 'These scores do not isolate teacher effects. Differences could reflect many factors, and there is no causal comparison.' },
    missing: { mastery: 'A correct response on one item does not establish mastery. The 75% denominator includes only the eight respondents.', denominator: 'Supported. This distinguishes observed accuracy (6/8) from missing evidence (2/10).', zeros: 'Only two students submitted incorrect responses. The two missing responses do not tell us how those students would solve the task.' },
    decide: { repeat: 'A whole-unit response is not yet justified. Repeating the same question also confounds fresh evidence with familiarity.', targeted: 'Supported. This separates the possible sign error from missing evidence and plans a fresh check.', placement: 'One item and two missing responses are insufficient for course-placement decisions. Use a lower-stakes, reversible response.' },
  };
  let state = { choices: {}, checked: {}, reflection: '', rubric: {} };
  const saveStatus = document.querySelector('#save-status');
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && typeof saved === 'object') {
      for (const id of Object.keys(answers)) {
        if (Object.hasOwn(feedback[id], saved.choices?.[id])) state.choices[id] = saved.choices[id];
        if (saved.checked?.[id] === state.choices[id] && state.choices[id]) state.checked[id] = saved.checked[id];
      }
      if (typeof saved.reflection === 'string') state.reflection = saved.reflection.slice(0, 4000);
      for (const id of ['evidence', 'limit', 'action', 'check']) state.rubric[id] = saved.rubric?.[id] === true;
    }
  } catch { saveStatus.textContent = 'Browser storage unavailable or invalid; this attempt works in memory.'; }
  function save() {
    try { localStorage.setItem(key, JSON.stringify(state)); saveStatus.textContent = 'Saved only in this browser. Nothing is submitted.'; }
    catch { saveStatus.textContent = 'Browser storage unavailable; download your brief before leaving.'; }
  }
  function progress() {
    const count = Object.keys(answers).filter(id => state.checked[id] === answers[id]).length;
    document.querySelector('#progress').textContent = `${count} of 3 knowledge checks correct`;
    document.querySelector('#meter').value = count;
  }
  for (const form of document.querySelectorAll('[data-check]')) {
    const id = form.dataset.check, result = form.querySelector('.feedback');
    const restore = form.querySelector(`input[value="${state.choices[id]}"]`);
    if (restore) restore.checked = true;
    if (state.checked[id]) { result.textContent = feedback[id][state.checked[id]]; result.dataset.correct = String(state.checked[id] === answers[id]); }
    form.addEventListener('change', () => {
      state.choices[id] = new FormData(form).get(id); delete state.checked[id]; result.textContent = ''; delete result.dataset.correct; save(); progress();
    });
    form.addEventListener('submit', event => {
      event.preventDefault(); const choice = new FormData(form).get(id);
      if (!choice) { result.textContent = 'Choose a response before checking your reasoning.'; form.querySelector('input').focus(); return; }
      state.choices[id] = choice; state.checked[id] = choice; result.textContent = feedback[id][choice]; result.dataset.correct = String(choice === answers[id]); save(); progress();
    });
  }
  const reflection = document.querySelector('#reflection'); reflection.value = state.reflection;
  reflection.addEventListener('input', () => { state.reflection = reflection.value; save(); });
  for (const input of document.querySelectorAll('[data-rubric]')) {
    input.checked = !!state.rubric[input.dataset.rubric];
    input.addEventListener('change', () => { state.rubric[input.dataset.rubric] = input.checked; save(); });
  }
  document.querySelector('#download').addEventListener('click', () => {
    const status = document.querySelector('#brief-status');
    if (!reflection.value.trim()) { status.textContent = 'Write a brief before downloading.'; reflection.focus(); return; }
    const text = `Reading Assessment Evidence - learner decision brief\nFictional scenario / self-review, not a scored certification\n\n${reflection.value}\n\nSelf-review:\n${Object.entries(state.rubric).map(([id, checked]) => `${id}: ${checked ? 'reviewed' : 'not reviewed'}`).join('\n')}`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); const link = document.createElement('a'); link.href = url; link.download = 'assessment-evidence-brief.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); status.textContent = 'Your brief was prepared for download.';
  });
  document.querySelector('#print').addEventListener('click', () => window.print());
  const model = document.querySelector('#model'), toggle = document.querySelector('#model-toggle'); model.hidden = true;
  toggle.addEventListener('click', () => { model.hidden = !model.hidden; toggle.setAttribute('aria-expanded', String(!model.hidden)); });
  const reset = document.querySelector('#reset'), dialog = document.querySelector('#reset-dialog'); reset.hidden = false;
  reset.addEventListener('click', () => dialog.showModal());
  dialog.addEventListener('close', () => {
    if (dialog.returnValue !== 'reset') return;
    state = { choices: {}, checked: {}, reflection: '', rubric: {} };
    try { localStorage.removeItem(key); } catch { /* Memory-only attempts still reset. */ }
    document.querySelectorAll('input').forEach(input => { input.checked = false; }); reflection.value = '';
    document.querySelectorAll('.feedback').forEach(el => { el.textContent = ''; delete el.dataset.correct; });
    model.hidden = true; toggle.setAttribute('aria-expanded', 'false'); document.querySelector('#brief-status').textContent = ''; progress(); saveStatus.textContent = 'Attempt reset. Nothing is submitted.'; location.hash = 'start';
  });
  function route(focus = true) {
    const requested = location.hash.slice(1), sections = [...document.querySelectorAll('.lesson')];
    const active = sections.find(section => section.id === requested) || sections[0];
    sections.forEach(section => { section.hidden = section !== active; });
    document.querySelectorAll('aside nav a').forEach(link => { if (link.hash === '#' + active.id) link.setAttribute('aria-current', 'step'); else link.removeAttribute('aria-current'); });
    if (focus) active.querySelector('h2').focus();
  }
  window.addEventListener('hashchange', () => route()); route(false); progress();
})();
