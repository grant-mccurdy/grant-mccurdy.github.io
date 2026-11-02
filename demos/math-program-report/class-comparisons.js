(() => {
  'use strict';
  const workspace = document.querySelector('#workspace');
  const section = document.createElement('section');
  section.className = 'within-track';
  section.setAttribute('aria-labelledby', 'within-track-heading');
  section.hidden = true;
  workspace.after(section);
  let evidence, failure = false;
  const node = (tag, text, cls) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
  const signed = value => `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
  const sourceLink = () => {
    const a = node('a', 'Reviewed comparisons and methods at Logos');
    a.href = 'https://logoseducation.group/sample-report/supporting-evidence/#classes-within-course-and-track';
    return a;
  };
  function render() {
    const course = document.querySelector('#class-course');
    section.hidden = !course;
    section.replaceChildren();
    if (!course) return;
    const heading = node('h2', 'Class differences within tracks');
    heading.id = 'within-track-heading';
    section.append(heading);
    if (!evidence) {
      section.append(node('p', failure ? 'Reviewed class comparisons could not be loaded.' : 'Loading reviewed class comparisons...'), sourceLink());
      return;
    }
    const selectedTrack = document.querySelector('#class-track').value;
    const tracks = selectedTrack === 'all' ? ['Regular', 'Honors/AP'] : [selectedTrack];
    section.append(node('p', 'Same course, same track. Differences are class A minus class B in percentage points.', 'within-intro'));
    for (const track of tracks) {
      const classes = window.TRIAL_DATA.classes.filter(c => c.course === course.value && c.track === track);
      const pairs = evidence.pairs.filter(p => p.course === course.value && p.track === track);
      const group = node('section', undefined, 'within-group');
      group.dataset.track = track;
      group.append(node('h3', `${course.value} / ${track}`));
      const means = classes.map(c => c.mean);
      group.append(node('p', `${classes.length} classes · ${classes.reduce((n, c) => n + c.n, 0)} students${means.length ? ` · Class means ${Math.min(...means).toFixed(1)}% to ${Math.max(...means).toFixed(1)}%` : ''}`, 'within-scope'));
      if (classes.length < 2) {
        group.append(node('p', 'At least two classes are needed for a within-track comparison.'));
      } else if (!pairs.length) {
        group.append(node('p', 'No reviewed comparison is available for these classes.'));
      } else {
        const detected = pairs.filter(p => p.interpretation === 'difference detected').length;
        group.append(node('p', detected ? `${detected} of ${pairs.length} comparisons show evidence of a difference after the original 14-comparison adjustment.` : 'No differences detected after the original 14-comparison adjustment. The results do not establish that the classes are equivalent.', 'within-reading'));
        const list = node('ul', undefined, 'within-pairs');
        for (const pair of pairs) {
          const item = node('li', undefined, 'within-pair');
          item.dataset.pair = `${pair.a}-${pair.b}`;
          const label = node('div');
          label.append(node('strong', `${pair.label_a} minus ${pair.label_b}`), node('span', `n = ${pair.n_a} and ${pair.n_b}`, 'within-n'));
          const interval = node('div', undefined, 'within-interval');
          interval.setAttribute('aria-hidden', 'true');
          const band = node('span', undefined, 'within-band');
          band.style.left = `${(pair.low + 30) / 60 * 100}%`;
          band.style.width = `${(pair.high - pair.low) / 60 * 100}%`;
          const point = node('span', undefined, 'within-point');
          point.style.left = `${(pair.difference + 30) / 60 * 100}%`;
          interval.append(band, point);
          const values = node('div');
          values.append(node('strong', `${signed(pair.difference)} pp`), node('span', `95% CI ${signed(pair.low)} to ${signed(pair.high)}`, 'within-n'), node('span', `Holm p = ${pair.p_holm.toFixed(4)} · ${pair.interpretation === 'difference detected' ? 'Difference detected' : 'Inconclusive'}`, 'within-n'));
          item.append(label, interval, values);
          list.append(item);
        }
        group.append(list, node('p', 'Interval scale: −30 to +30 percentage points; center line = no mean difference.', 'within-scope'));
      }
      section.append(group);
    }
    section.append(node('p', 'Student-level Welch comparisons. Intervals are pointwise, unadjusted 95% intervals; p-values retain Holm adjustment across all 14 planned class comparisons, regardless of the selected course or track.', 'within-method'));
    section.append(node('p', 'Fictional data. Differences cannot separate prior readiness, content exposure, and classroom effects. A pair of individual classes cannot support a section-cluster sensitivity estimate. These results are not teacher-effectiveness measures.', 'within-method'), sourceLink());
  }
  new MutationObserver(render).observe(workspace, {childList: true});
  render();
  fetch('class-comparisons.json').then(r => {
    if (!r.ok) throw new Error('Comparison data unavailable');
    return r.json();
  }).then(data => {
    if (data.family_size !== 14 || data.pairs?.length !== 14) throw new Error('Unexpected comparison family');
    for (const p of data.pairs) {
      const a = window.TRIAL_DATA.classes.find(c => c.id === p.a);
      const b = window.TRIAL_DATA.classes.find(c => c.id === p.b);
      if (!a || !b || a.course !== p.course || b.course !== p.course || a.track !== p.track || b.track !== p.track || a.n !== p.n_a || b.n !== p.n_b || Math.abs(a.mean - b.mean - p.difference) > 1e-8 || ![p.low,p.high,p.p_holm,p.difference].every(Number.isFinite) || p.low < -30 || p.high > 30 || p.low > p.high) throw new Error('Comparison snapshot mismatch');
    }
    evidence = data;
    render();
  }).catch(() => {failure = true; render();});
})();
