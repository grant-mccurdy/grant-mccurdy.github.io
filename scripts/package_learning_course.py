"""Build a portable web package, not a Canvas cartridge."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
source = root / 'demos' / 'assessment-evidence'
target = root / 'artifacts' / 'instructional-design' / 'reading-assessment-evidence.zip'
target.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
    for name in ('index.html', 'course.css', 'course.js', 'evidence-path.svg', 'distributions.svg'):
        if name == 'index.html':
            html = (source / name).read_text()
            html = html.replace('href="../../index.html"', 'href="https://grant-mccurdy.github.io/"')
            html = html.replace('href="../../projects/instructional-design.html"', 'href="README.txt"')
            html = html.replace('Design case study', 'Design notes').replace('Review the design case study', 'Read the design notes')
            archive.writestr(name, html)
        else:
            archive.write(source / name, name)
    archive.write(root / 'scripts' / 'build_learning_graphics.mjs', 'sources/build_learning_graphics.mjs')
    archive.writestr('README.txt', 'Reading Assessment Evidence\nOpen index.html in a browser. No server or account is needed.\nThis is a standalone web course, not a Canvas export. All examples are fictional.\nCreated with Codex assistance for Grant McCurdy; human content review and learner testing pending. No learner-outcome claims.\nAudience: teachers comfortable with percentages, new to data interpretation.\nAlignment: compare distributions, distinguish missing evidence, recommend a proportionate action. Each objective has practice with feedback. The final brief uses an evidence/limitation/action/follow-up self-review rubric.\nUDL choices: visual and tabular representations, open navigation, retries, prose or bullets, oral rehearsal, no time limit.\nAccessibility: semantic headings, labeled inputs, keyboard focus, alternative text, print fallback. No conformance certification or independent screen-reader audit.\nThe SVGs are editable sources. Regenerate them from this directory with Node: node sources/build_learning_graphics.mjs .\nProgress is browser-local when supported. Reset removes this course attempt.\n')
print(target.relative_to(root))
