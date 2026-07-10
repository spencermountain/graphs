Converted from the 2022 svelte original in public/2022/bluejays-calendar.

Notes: the Quarter/Month components were ported from somehow-calendar — using the build-time
version recovered from build/bundle.js (it has the tops/bottoms/isHome half-square gradients
that the current lib source lacks). Approximations: game-date keys are matched by their ISO
date part (`slice(0,10)`) instead of a local-timezone spacetime parse, so SSR and all viewer
timezones agree on Toronto game dates; `showToday`/`onClick` (both disabled in the original
post) were dropped; the quarter's 3 months are enumerated directly instead of via
spacetime's `every()`.
