Converted from the 2020 svelte/js original in public/2020/earth-as-pie.
Ported the used parts of somehow-circle (polar point, annular arc path, label-flip) into circle.js — no d3.
Note: the original passed `label` to Arc but that version of Arc ignored it, so ocean names never rendered; kept them as svg `<title>` hover tooltips instead.
