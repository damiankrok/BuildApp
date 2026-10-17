"""005S-N2 research-only contract check: ledger schema, edition isolation, source-rights invariants.

python3 -I research/analyzer-005s-technical-pdf/check-ledger.py   (from the repo root; reads only this directory and git)
"""
import hashlib, json, pathlib, subprocess, sys

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[1]
led = json.loads((HERE / 'ledger.json').read_text())
fail = []
def need(ok, msg):
    if not ok: fail.append(msg)

need(hashlib.sha256((HERE / 'preregistration.md').read_bytes()).hexdigest() == led['preregistrationSha256'], 'preregistration hash drift')
need(len(led['cases']) <= 3, 'more than 3 DEV candidates')
ctl = {r['case'] for r in json.loads((REPO / 'research/analyzer-005s-openings/controls-base.json').read_text())['rows']}
need(len(ctl) == 23, 'control set is not 23 rows')
for c in led['cases']:
    need(c['case'] in ctl, f"{c['case']} not in the 23-row control set")
    need(c['edition'] in c['page'], f"{c['case']}: edition id not in page URL")
    need(c['status'] != 'QUALIFIED' or c['publicNoLogin'], f"{c['case']}: qualified without public access")
    need(c['pdfDownloaded'] or c['pdfSha256'] is None, f"{c['case']}: checksum without bytes")
o = led['ownerExample']
need(o['edition'] == 'm3ea28300f9b3e' and not o['attachedToModelledRow'], 'OWNER example attached to a model')
need(all(o['edition'] not in c['page'] for c in led['cases']), 'OWNER edition among DEV cases')
need(led['summary']['qualifyingPairs'] == 0 or led['summary']['verdict'] != 'NO_USABLE_PUBLIC_TECHNICAL_PDF', 'verdict/qualifying mismatch')
tracked = subprocess.run(['git', 'ls-files'], cwd=REPO, capture_output=True, text=True, check=True).stdout.split()
need(not [t for t in tracked if t.lower().endswith('.pdf')], 'a PDF is tracked in Git')
print('FAIL' if fail else 'PASS', *fail, sep='\n')
sys.exit(1 if fail else 0)
