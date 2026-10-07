#!/usr/bin/env python3
"""hfget.py - download a Hugging Face model repository at one pinned revision, OUTSIDE the BuildApp repository.

    python -I -B research/analyzer-005m/hfget.py <owner/repo> <full 40-hex revision> <out dir outside the repo> [skip,prefixes]

The revision must resolve to itself (no branch names, no silent forks). Every file's SHA-256 is checked against the
hub's LFS hash and written to <out>/_download.json; that record (text) is what 005M commits, never the files.
"""
import hashlib
import json
import os
import sys

import requests

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def main():
    repo, rev, out = sys.argv[1], sys.argv[2], sys.argv[3]
    skip = sys.argv[4].split(',') if len(sys.argv) > 4 and sys.argv[4] else []
    if os.path.abspath(out).startswith(REPO):
        raise SystemExit('weights stay outside the repository')
    if len(rev) != 40:
        raise SystemExit('pin a full commit revision')
    os.makedirs(out, exist_ok=True)
    s = requests.Session()
    info = s.get(f'https://huggingface.co/api/models/{repo}/revision/{rev}?blobs=true', timeout=60).json()
    assert info['sha'] == rev, (info.get('sha'), rev)
    rec = {'repo': repo, 'revision': rev, 'files': {}}
    for sib in info['siblings']:
        f = sib['rfilename']
        if any(f.startswith(p) or f.endswith(p) for p in skip):
            continue
        dst = os.path.join(out, f)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        h = hashlib.sha256()
        with s.get(f'https://huggingface.co/{repo}/resolve/{rev}/{f}', stream=True, timeout=600) as r:
            r.raise_for_status()
            with open(dst, 'wb') as fh:
                for chunk in r.iter_content(1 << 22):
                    fh.write(chunk)
                    h.update(chunk)
        lfs = (sib.get('lfs') or {}).get('sha256')
        rec['files'][f] = {'bytes': os.path.getsize(dst), 'sha256': h.hexdigest(), 'lfsSha256': lfs}
        if lfs:
            assert lfs == h.hexdigest(), f
        print(f, rec['files'][f]['bytes'], flush=True)
    json.dump(rec, open(os.path.join(out, '_download.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
