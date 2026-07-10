Converted from the 2020 svelte original in public/2020/sunset-direction.

Approximations/fixes:
- somehow-circle geometry (Round/Arc/Line/Tick + d3-shape arcs) ported by hand into `circle.js`, with the world config (rotate -90°, margin 10, auto-fit maxR=70) baked in.
- suncalc/spacetime-daylight sun-position math ported into `sun.js` (lng fixed at 0 / utc, like the original's `.in([lat, 0])`).
- plain range input kept (the original also used a plain range input; the somehow-slider import was commented out).
- fixed: E/W compass labels were swapped relative to the plotted azimuths in the original (sunsets rendered beside "E").
- fixed: the original's current-day rise/set used an inverted latitude (90−lat) left over from an older vertical slider, disagreeing with the year ring and subtitle — the slider latitude is now used everywhere.
- fixed: footer date uses `{date-ordinal}` (the original's `{day-ordinal}` printed the weekday number as an ordinal).
- date labels now move when lat/date changes (a svelte prop quirk froze them at their initial angle in the original).
