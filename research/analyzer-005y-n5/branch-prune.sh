#!/bin/bash
# 005Y-N5: prune stale remote branches safely. usage: branch-prune.sh --dry-run|--execute <manifest.tsv>
# Keeps: the default branch, the mirror, the active analyzer branch. Refuses a branch that has an open PR or is
# named in a workflow on the default branch. A branch whose tip is an ancestor of the active branch is deleted as a
# ref (its commits stay reachable); a diverged one is first tagged archive/branch-prune-20261021/<branch>, the tag
# pushed and verified to point at the same SHA, and only then deleted. Tags and releases are never touched.
set -u
MODE=$1; OUT=$2; REPO=damiankrok/BuildApp
ACTIVE=analyzer/005y-n4-general-architectural-understanding-v1
MIRROR=claude/new-session-3kzcgh
DEFAULT=$(gh api repos/$REPO --jq .default_branch)
KEEP=" $DEFAULT $MIRROR $ACTIVE "
OPEN=$(gh api "repos/$REPO/pulls?state=open&per_page=100" --jq '.[].head.ref' | tr '\n' ' ')
WF=$(git show origin/$DEFAULT:.github/workflows 2>/dev/null >/dev/null && for f in $(git ls-tree --name-only origin/$DEFAULT .github/workflows/); do git show origin/$DEFAULT:$f; done)
git fetch -q origin $ACTIVE
ACTIVE_SHA=$(git rev-parse origin/$ACTIVE)
printf 'branch\tsha\trelation\taction\tresult\n' > $OUT
git ls-remote --heads origin | while read sha ref; do
  b=${ref#refs/heads/}
  if [[ "$KEEP" == *" $b "* ]]; then printf '%s\t%s\tkept\tKEEP\t-\n' "$b" "$sha" >> $OUT; continue; fi
  if [[ " $OPEN " == *" $b "* ]]; then printf '%s\t%s\topen-pr\tREFUSED\topen pull request\n' "$b" "$sha" >> $OUT; continue; fi
  if grep -qF -- "$b" <<<"$WF"; then printf '%s\t%s\tworkflow\tREFUSED\tnamed in a workflow\n' "$b" "$sha" >> $OUT; continue; fi
  git fetch -q origin "$sha" 2>/dev/null || git fetch -q origin "$b"
  if git merge-base --is-ancestor "$sha" "$ACTIVE_SHA"; then rel=ancestor; act=DELETE_REF; else rel=diverged; act=ARCHIVE_TAG_THEN_DELETE; fi
  res=planned
  if [ "$MODE" = "--execute" ]; then
    if [ $rel = diverged ]; then
      tag="archive/branch-prune-20261021/$b"
      git push -q origin "$sha:refs/tags/$tag" 2>/dev/null
      t=$(git ls-remote origin "refs/tags/$tag" | cut -f1)
      if [ "$t" != "$sha" ]; then printf '%s\t%s\t%s\t%s\tTAG_FAILED (not deleted)\n' "$b" "$sha" "$rel" "$act" >> $OUT; continue; fi
    fi
    if git push -q origin --delete "$b" 2>/dev/null && [ -z "$(git ls-remote --heads origin "$b")" ]; then res=deleted; else res=DELETE_FAILED; fi
  fi
  printf '%s\t%s\t%s\t%s\t%s\n' "$b" "$sha" "$rel" "$act" "$res" >> $OUT
done
cat $OUT
