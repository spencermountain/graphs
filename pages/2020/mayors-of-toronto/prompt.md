Converted from the 2020 svelte/js original in public/2020/mayors-of-toronto.

Notes: somehow-timeline's Timeline/Column/Ticks/Label/Line/WideLabel were ported inline (CSS taken from the compiled build/bundle.js, which is newer than the lib source — mayor names render rotated 270°, unlike the older thumb.jpg). Props the built lib never implemented (`space`, `side`, `dotted`) were dropped as no-ops. The sitting mayor's pill ends at "now" like the original (`spacetime('')`), computed on mount for SSR-safety. Axis ticks span the full 1834–2026 range.
