"""Extract reviewed class results; verify against published Logos table precision."""
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://logoseducation.group/sample-report/supporting-evidence/'
SOURCE = ROOT / 'sources/logos-report/class-evidence.html'
OUTPUT = ROOT / 'demos/math-program-report/class-comparisons.json'

class Tables(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables, self.table, self.cell, self.row = [], None, None, None
    def handle_starttag(self, tag, attrs):
        if tag == 'table': self.table = {'caption': '', 'rows': []}
        if self.table is not None:
            if tag == 'tr': self.row = []
            if tag in ('td', 'th', 'caption'): self.cell = [tag, '']
    def handle_data(self, data):
        if self.cell is not None: self.cell[1] += data
    def handle_endtag(self, tag):
        if self.table is None: return
        if self.cell is not None and tag == self.cell[0]:
            value = ' '.join(self.cell[1].split())
            if tag == 'caption': self.table['caption'] = value
            else: self.row.append(value)
            self.cell = None
        if tag == 'tr' and self.row:
            self.table['rows'].append(self.row)
            self.row = None
        if tag == 'table':
            self.tables.append(self.table)
            self.table = None

check = '--check' in sys.argv
raw = SOURCE.read_bytes() if check or '--saved-source' in sys.argv else urllib.request.urlopen(URL, timeout=30).read()
parser = Tables()
parser.feed(raw.decode('utf-8'))
table = next(t for t in parser.tables if t['caption'] == 'All 14 class comparisons')
rows = table['rows'][1:]
assert len(rows) == 14
data_bytes = (ROOT / 'data/logos/report-data.json').read_bytes()
data = json.loads(data_bytes)
sections = {s['section_id']: s for s in data['section']}
labels = {}
for s in data['section']:
    peers = [v for v in data['section'] if (v['course'], v['track']) == (s['course'], s['track'])]
    labels[s['section_id']] = f"{'R' if s['track'] == 'Regular' else 'H'}{peers.index(s)+1} / P{s['period']}"
pairs = [p for p in data['comparisons'] if p['family'] == 'Classes within course and track']
assert len(pairs) == len(rows)
result = []
for p, row in zip(pairs, rows):
    a, b = sections[p['a']], sections[p['b']]
    assert (a['course'], a['track']) == (b['course'], b['track'])
    expected = [a['course'], a['track'], labels[p['a']], labels[p['b']], f"{p['difference']:.1f}", f"{p['low']:.1f} to {p['high']:.1f}", f"{p['p_holm']:.4f}", p['interpretation']]
    assert row == expected, (row, expected)
    result.append({**p, 'course': a['course'], 'track': a['track'], 'label_a': labels[p['a']], 'label_b': labels[p['b']]})
payload = {'source_url': URL+'#classes-within-course-and-track', 'source_sha256': hashlib.sha256(raw).hexdigest(), 'aggregate_sha256': hashlib.sha256(data_bytes).hexdigest(), 'family_size': 14, 'method': 'Student-level Welch comparisons; Holm adjustment across all 14 planned class comparisons. Intervals are pointwise, unadjusted 95% intervals.', 'pairs': result}
if check:
    assert json.loads(OUTPUT.read_text()) == payload
else:
    SOURCE.write_bytes(raw)
    OUTPUT.write_text(json.dumps(payload, indent=2)+'\n', encoding='utf-8')
print('PASS: all 14 comparisons match published Logos labels, differences, intervals, adjusted p-values, and interpretations. No tests recalculated.')
