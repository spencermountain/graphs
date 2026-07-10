Converted from the 2020 svelte/js original in public/2020/leafs-roster.
Ported the used parts of somehow-timeline (Timeline/Ticks/Column/Line) inline; dropped the Line "topLabel" branch (every bar is >20px tall so only the rotated white midLabel ever rendered) and tick underlining (no tick year in range matched /00$/). Dates pinned to America/Toronto for SSR determinism.
