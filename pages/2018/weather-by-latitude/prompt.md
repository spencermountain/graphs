Converted from the 2018 browserify/somehow original in public/2018/weather-by-latitude.

Approximations: the `somehow` chart lib was reimplemented as inline svg (integer truncating scales, 588x250 'widescreen' chart, same axis/tick/line attrs); d3-shape's curveMonotoneX was hand-ported into monotoneX.js. Today-line + year are computed onMounted for SSR safety. Spacing between chart and slider (old spencer.css m2/m5 classes) approximated with tailwind margins. Header/footer use the repo's standard card shell; subtitle line is new (original had none).
