Converted from the 2020 svelte/js original in public/2020/cerb-population.
Ported the somehow-sankey layout (byCol/values/tops/points/paths) into sankey.js; node styles taken from the compiled bundle (the shipped lib version, not the scratchpad one). Note the 'Canada' node displays 36.5m — the layout grows a node to the sum of its inputs (8+22+6.5), same as the original render.
