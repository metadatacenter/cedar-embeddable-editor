#!/usr/bin/env bash
#
# The visual suite, in the one place its baselines mean anything.
#
# Screenshot baselines record a *machine's* text rasterisation, not just the
# application's rendering, so a suite that runs on a developer's laptop and again
# on a CI runner is comparing two things that were never going to agree. Measured
# across that boundary on 2026-08-16: 7 of 106 baselines differed, by 124 to 393
# pixels of glyph antialiasing, against a budget of 120 — every failure marginal,
# none of them a rendering change, and no way to tell those apart from a real one.
#
# So both sides run the same container. Playwright publishes an image per release
# carrying the browsers that release drives and the fonts they rasterise with, and
# `v1.62.1-noble` is the one matching `visual/package.json`. Move that pin and the
# baselines move with it, exactly as an OS upgrade used to.
#
# `node_modules` is a named volume rather than the host's directory: the host's is
# built for darwin-arm64 and its binaries do not run here.
set -euo pipefail

IMAGE="mcr.microsoft.com/playwright:v1.62.1-noble"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! docker info >/dev/null 2>&1; then
  echo "The visual suite runs in a container, and the Docker daemon is not up." >&2
  echo "Start Docker and run this again." >&2
  exit 1
fi

# Both sides on arm64, so neither emulates. CI names an arm64 Linux runner for the
# same reason; a runner label that resolves to x86_64 would rasterise differently
# and the baselines would be wrong again, quietly.
exec docker run --rm --init \
  --platform linux/arm64 \
  --ipc=host \
  -v "$REPO":/repo \
  -v cee-visual-node-modules:/repo/visual/node_modules \
  -w /repo/visual \
  -e CI="${CI:-}" \
  "$IMAGE" \
  bash -lc 'npm ci --no-audit --no-fund && npm run prepare:all && npm test -- "$@"' -- "$@"
