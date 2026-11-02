(() => {
  'use strict';
  const nav = document.querySelector('.view-tabs');
  const workspace = document.querySelector('#workspace');
  if (!nav || !workspace.children.length) return;
  const main = workspace.closest('main');
  const panel = document.createElement('section');
  panel.id = 'report-guide';
  panel.className = 'report-guide';
  panel.setAttribute('role', 'tabpanel');
  panel.tabIndex = 0;
  panel.hidden = true;
  workspace.before(panel);

  const views = {
    overview: `<header class="guide-heading"><h2>Report overview</h2><p>This evaluation uses a common mathematics assessment to review a school's program beyond course grades. It examines achievement across the course sequence, differences between academic tracks and classes, and strengths and gaps in mathematical knowledge.</p></header>
      <section class="guide-assessment" aria-labelledby="report-scope-title">
        <h3 id="report-scope-title">Scope and scoring</h3>
        <p>This demonstration includes 500 students in 21 classes across six courses: Algebra I, Geometry, Algebra II, Precalculus, AP Calculus AB, and AP Statistics. The first four courses offer Regular and Honors tracks; the AP courses are separate groups.</p>
        <p>Scores represent the percentage of questions answered correctly, not course grades or a proficiency designation. All 30 questions count, including unanswered questions. The schoolwide average is 61.8%.</p>
      </section>
      <section class="guide-assessment" aria-labelledby="assessment-basis-title">
        <h3 id="assessment-basis-title">Assessment design and mapping</h3>
        <p>30 original questions in 45 minutes: 22 multiple-choice and 8 numeric responses, combining calculation, interpretation, and reasoning with equations, tables, graphs, and diagrams.</p>
        <p>The blueprint follows <a href="https://satsuite.collegeboard.org/sat/whats-on-the-test/math/overview">SAT Math domains and skills</a>: Algebra (10 questions), Advanced Math (10), Problem-Solving/Data Analysis (5), and Geometry/Trigonometry (5). Each item has skill, prerequisite, and provisional course mappings.</p>
      </section>
      <ol class="guide-findings">
        <li><h3>Courses &amp; Tracks</h3><p>The violin and box plots show typical assessment scores and the spread of student results across courses and Regular/Honors tracks.</p><p>Average scores are higher in each successive course from Algebra I through AP Calculus AB, but results vary widely within courses and overlap substantially between tracks.</p><p>Course averages range from 48% in Algebra I to 82% in AP Calculus AB. AP Statistics follows a separate pathway, averaging 69%.</p><button class="guide-link" data-open-view="courses">View Courses &amp; Tracks <span aria-hidden="true">&rarr;</span></button></li>
        <li><h3>Classes</h3><p>Class distributions and within-track comparisons examine whether students taking the same course at the same level have similar assessment results.</p><p>Most comparisons do not detect clear differences; the statistically significant differences are concentrated in Regular Geometry.</p><p>One Regular Geometry class averages 67% correct, compared with about 52% in each of two others. Both differences remain significant after adjustment across 14 comparisons; the other 12 do not detect clear differences. The analysis covers 19 classes and 440 students in Algebra I through Precalculus; each AP course has only one class.</p><button class="guide-link" data-open-view="classes">View Classes: Regular Geometry <span aria-hidden="true">&rarr;</span></button></li>
        <li><h3>Comparisons</h3><p>The heatmap and paired comparisons show the size of differences between course-and-track average scores, with statistical tests identifying which differences are supported by the evidence.</p><p>Many courses differ significantly in average scores, while Honors and Regular averages within the same course remain close.</p><p>Within each of the four courses offering both tracks, Honors and Regular students' average assessment scores differ by no more than 2.5 percentage points on the same assessment. Honors is not consistently higher: Geometry averages 55.3% in Honors and 56.9% in Regular, while Precalculus averages 75.6% and 73.1%, respectively.</p><button class="guide-link" data-open-view="comparisons">View Comparisons <span aria-hidden="true">&rarr;</span></button></li>
        <li><h3>Math Domains</h3><p>The domain profiles trace accuracy across the course sequence; within-course bars compare the four areas of mathematical knowledge.</p><p>Across the main sequence, course-level accuracy rises in Algebra, Advanced Math, and Problem-Solving/Data Analysis. Geometry/Trigonometry is less consistent: accuracy is higher in Geometry than in Algebra II, and remains below the algebra domains in later courses.</p><p>Across both tracks, Geometry/Trigonometry accuracy is 57% in Geometry and 46% in Algebra II. In Precalculus, Algebra and Advanced Math accuracy reaches 83% and 80%, while Data Analysis is 62% and Geometry/Trigonometry is 57%. AP Calculus AB shows the same ordering at 90%, 85%, 77%, and 62%.</p><button class="guide-link" data-open-view="content">View Math Domains: Algebra II <span aria-hidden="true">&rarr;</span></button></li>
      </ol>`,
    priorities: `<header class="guide-heading"><h2>Priorities for the mathematics program</h2><p>The analysis identifies three priorities: a marked gap between mathematics domains in Algebra II, statistically significant differences among Regular Geometry classes, and limited separation between Honors and Regular average assessment scores.</p></header>
      <ol class="guide-findings">
        <li><h3>Target the geometry gap in Algebra II.</h3><p>Algebra II students answer 46% of Geometry/Trigonometry questions correctly, compared with 77% of Algebra questions: an observed gap of about 31 percentage points within the same student group. At the next curriculum meeting, the Geometry and Algebra II teams should check which skills assessed by the five geometry-domain questions have been taught and practised. Use a short follow-up task to identify skills needing reteaching, then reassess those skills after instruction.</p><button class="guide-link" data-open-view="content">View Math Domains: Algebra II <span aria-hidden="true">&rarr;</span></button></li>
        <li><h3>Investigate the significant Geometry class differences.</h3><p>One Regular Geometry class averages 67% correct, compared with about 52% in each of two others: roughly a 15-percentage-point difference. Both differences are statistically significant after adjustment across all 14 planned class comparisons. At the next department meeting, the department lead and Geometry teachers should compare prior preparation, topics taught, and pacing across the three classes. Score a common task with one rubric to decide whether the lower-scoring classes need prerequisite support or more time on particular topics.</p><button class="guide-link" data-open-view="classes">View Classes: Regular Geometry <span aria-hidden="true">&rarr;</span></button></li>
        <li><h3>Verify how Honors expectations differ in practice.</h3><p>Within each of the four courses offering both tracks, Honors and Regular students' average assessment scores differ by no more than 2.5 percentage points on the same assessment. Course leads should compare Regular and Honors assignments and student work against the department's stated Honors expectations, identifying where additional reasoning, complexity, or independence is required before revising entry criteria.</p><button class="guide-link" data-open-view="courses">View Courses &amp; Tracks <span aria-hidden="true">&rarr;</span></button></li>
      </ol>`
  };

  function addTab(view, label, first) {
    const tab = document.createElement('button');
    tab.id = 'tab-' + view;
    tab.dataset.view = view;
    tab.textContent = label;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
    tab.setAttribute('aria-selected', 'false');
    tab.tabIndex = -1;
    if (first) nav.prepend(tab); else nav.append(tab);
  }
  addTab('overview', 'Overview', true);
  addTab('priorities', 'Priorities', true);
  document.getElementById('tab-content').textContent = 'Math Domains';
  const tabs = [...nav.querySelectorAll('[role="tab"]')];

  // Keep the canonical chart handlers intact; only the portfolio navigation expands.
  for (const [index, tab] of tabs.entries()) {
    const chartHandler = tab.onclick;
    tab.onclick = () => {
      const guide = Object.hasOwn(views, tab.dataset.view);
      main.dataset.reportView = guide ? 'guide' : 'chart';
      workspace.hidden = guide;
      panel.hidden = !guide;
      if (guide) {
        panel.innerHTML = views[tab.dataset.view];
        panel.setAttribute('aria-labelledby', tab.id);
      } else chartHandler.call(tab);
      for (const t of tabs) {
        t.setAttribute('aria-selected', String(t === tab));
        t.tabIndex = t === tab ? 0 : -1;
      }
      tab.scrollIntoView({block: 'nearest', inline: 'nearest', behavior: 'instant'});
    };
    tab.onkeydown = event => {
      const target = {ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1}[event.key];
      if (target === undefined) return;
      event.preventDefault();
      tabs[target].click();
      tabs[target].focus({preventScroll: true});
    };
  }
  panel.addEventListener('click', event => {
    const link = event.target.closest('[data-open-view]');
    if (!link) return;
    const tab = document.querySelector('#tab-' + link.dataset.openView);
    tab.click();
    if (link.dataset.openView === 'classes') {
      for (const [id, value] of [['class-course', 'Geometry'], ['class-track', 'Regular']]) {
        const field = document.getElementById(id);
        field.value = value;
        field.dispatchEvent(new Event('change', {bubbles: true}));
      }
    }
    if (link.dataset.openView === 'courses') {
      const field = document.getElementById('course-track');
      field.value = 'all';
      field.dispatchEvent(new Event('change', {bubbles: true}));
    }
    if (link.dataset.openView === 'content') {
      document.getElementById('mode-chart').click();
      document.getElementById('choice-bars').click();
      for (const [id, value] of [['content-course', 'Algebra II'], ['content-track', 'all']]) {
        const field = document.getElementById(id);
        field.value = value;
        field.dispatchEvent(new Event('change', {bubbles: true}));
      }
    }
    workspace.focus({preventScroll: true});
  });
  const initial = tabs.find(t => '#' + t.dataset.view === location.hash) || tabs[0];
  initial.click();
})();
