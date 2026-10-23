"""IU-01: every writer of pixels, embeddings or model artifacts refuses a destination inside the repository.
Standard library only, so a script can check its arguments before importing anything heavy."""
import os, sys

REPO = os.path.realpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))

def refuse_inside_repo(path: str, what: str) -> None:
    p = os.path.realpath(path)
    if p == REPO or p.startswith(REPO + os.sep):
        sys.stderr.write(f'REFUSED: {what} stays outside the repository ({path})\n')
        sys.exit(2)

def arg_value(flag: str, default=None):
    a = sys.argv
    return a[a.index(flag) + 1] if flag in a and a.index(flag) + 1 < len(a) else default
