Converted from the 2020 svelte original in public/2020/toronto-budget.
Sankey layout math ported by hand from somehow-sankey (2020 build, verified against build/bundle.js) into sankey.js — same port as leafs-budget.
Kept this post's extra lib features: `fmt` values ('4.4b'), `show_num`, per-node `stroke` colors, the 87.2%-`full` Toronto node with white-dot shortfall pattern, and the '* 1.5bn covid short-fall' append.
Approximations: unused label/brace + show_percent features not ported; width measured on mount + resize (original bound clientWidth); 'Catamaran' font falls back to sans-serif. 'Governace' typo kept from the original.
