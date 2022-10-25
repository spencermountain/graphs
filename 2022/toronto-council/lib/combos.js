import colors from './colors.js'
let combos = {

  // juno: ['blue', 'mud', 'navy', 'slate', 'pink', 'burn'],
  // barrow: ['rouge', 'red', 'orange', 'burnt', 'brown', 'greygreen'],
  // roma: ["#8a849a", "#b5b0bf", 'rose', "lighter", "greygreen", 'mud'],
  // palmer: ['red', 'navy', 'olive', 'pink', 'suede', 'sky'],
  // mark: ["#848f9a", "#9aa4ac", 'slate', "#b0b8bf", 'mud', 'grey'],
  // salmon: ['sky', 'sea', 'fuscia', 'slate', 'mud', 'fudge'],
  // dupont: ['green', 'brown', 'orange', 'red', 'olive', 'blue'],
  // bloor: ['night', 'navy', 'beige', 'rouge', 'mud', 'grey'],
  yukon: ['sky', //denison
    'beige', //crombie
    'red', //sewell
    '#978BA3', //eggleton
    '#8C8C88',//rowlands 
    '', //hall
    '#cc6966',//lastman
    'blue', //miller
    '', //ford
    '#2D85A8'//tory
  ],//'mud', 'slate','brown',
  // david: ['blue', 'green', 'yellow', 'red', 'pink', 'light'],

  // neste: ['mud', 'cherry', 'royal', 'rouge', 'greygreen', 'greypurple'],
  // ken: ["red", "sky", "#c67a53", "greygreen", "#dfb59f", "mud"],
  // slug: ['', '', '', '',]

  // reds: ['#cc6966', '#cc6f66', '#e6b3bc', 'orange']
  // browns: ["#9a9484", "#a39e8f", "#aca89a", "#b6b1a5", "#bfbbb0", "#c8c5bc", "#d1cec7", "#dad8d2", "#e3e2dd"],
  // reds: ["#9a8487", "#a38f92", "#ac9a9d", "#b6a5a8", "#bfb0b3", "#c8bcbe", "#d1c7c8", "#dad2d3", "#e3ddde"],
  // blues: ["#2d5086", "#335b99", "#3966ac", "#4072bf", "#5380c6", "#668ecc", "#799cd2", "#8caad9", "#9fb8df", "#b3c6e6"],
  // reds: ["#862d35", "#99333d", "#ac3944", "#bf404c", "#c6535e", "#cc6670", "#d27982", "#d98c94", "#df9fa6", "#e6b3b7"],
  // greens: ["#2d864c", "#339957", "#39ac62", "#40bf6d", "#53c67b", "#66cc8a", "#79d298", "#8cd9a7", "#9fdfb6", "#b3e6c4"],
  // purples: ["#4e2d86", "#593399", "#6439ac", "#6f40bf", "#7d53c6", "#8c66cc", "#9a79d2", "#a88cd9", "#b79fdf", "#c5b3e6"]
}

Object.keys(combos).forEach((k) => {
  combos[k] = combos[k].map((c) => colors[c] || c)
})
export default combos