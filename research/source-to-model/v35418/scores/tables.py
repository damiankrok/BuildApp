#!/usr/bin/env python3
"""Markdown tables of the trial from the recorded scores (author.json, grader-decoded.json, runs.json). Prints to stdout."""
import json, os
here = os.path.dirname(os.path.abspath(__file__))
A = json.load(open(os.path.join(here, 'author.json')))['houses']
G = {r['house']: r for r in json.load(open(os.path.join(here, 'grader-decoded.json')))['rows']}
R = json.load(open(os.path.join(here, 'runs.json')))
T = {'alaska': 'Alaska (Studio Atrium)', 'aurora': 'Aurora maxi II bis sz (Studio Atrium)', 'ballina': 'Ballina (Lipińscy)', 'alberto': 'Alberto (Studio Atrium)', 'medulin': 'Medulin (Lipińscy)', 'jeziorko': 'Domek letniskowy nad jeziorkiem (ARCHON)', 'mindelo': 'Mindelo (Lipińscy)', 'sakura': 'Dom pod sakurą E (ARCHON)', 'g6': 'G6 (Dobre Domy)'}
def cnt(code, ids):
    t = {}
    for c, i in zip(code, ids):
        k = i[0]; t.setdefault(k, [0, 0])
        if c != 'N': t[k][1] += 1
        if c == 'O': t[k][0] += 1
    return ' '.join(f"{k} {t[k][0]}/{t[k][1]}" for k in 'FSOCM' if k in t)
yn = lambda b: 'TAK' if b else 'nie'
run = lambda h, v: next((r for r in R if r['house'] == h and r['variant'] == v), None)
print('| Dom | Zbiór | Cechy OK — baseline (autor) | Cechy OK — po zmianie (autor) | Baseline (ślepy oceniający) | Po zmianie (ślepy oceniający) | Użyteczna: baseline → po (autor / ślepy) | Bliższy źródłu (ślepy) |')
print('|---|---|---|---|---|---|---|---|')
for h, a in A.items():
    g = G[h]
    gc = lambda v: ' '.join(f"{k} {g[v]['counts'][k]}" for k in 'FSOCM' if k in g[v]['counts'])
    print(f"| {T[h]} | {a['set']} | {cnt(a['baseline'], a['ids'])} | {cnt(a['final'], a['ids'])} | {gc('baseline')}; widma {g['baseline']['phantoms']} | {gc('final')}; widma {g['final']['phantoms']} | {yn(a['baselineUseful'])} → {yn(a['finalUseful'])} / {yn(g['baseline']['useful'])} → {yn(g['final']['useful'])} | {'po zmianie' if g['better'] == 'final' else 'baseline' if g['better'] == 'baseline' else 'bez różnicy'} |")
print()
print('| Dom | Wariant | LOCAL | Wynik | Stan jakości z biegu | Otwory zewn. | Okna poł. | Kominy | Pomieszczenia | Strefy wykończ. | Odpowiedzi API | USD | s |')
print('|---|---|---|---|---|---|---|---|---|---|---|---|---|')
for r in R:
    print(f"| {T[r['house']].split(' (')[0]} | {r['variant']} | {r['local']} | {'model ' + str(r['modelSha12']) if r['model'] else 'NO_MODEL'} | {r['quality']} | {r['ext_openings']} | {r['roofWindows']} | {r['chimneys']} | {r['rooms']} | {r['regions']} | {r['turns']} | {r['usd']:.4f} | {r['seconds']} |")
