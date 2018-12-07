const somehow = require('somehow');
let el = document.querySelector('#stage');

let w = somehow({
  height: 200,
  aspect: 'widescreen',
});

w.y.fit(0, 9);
w.x.fit('Jan 1 2018', 'Dec 31 2018');

el.innerHTML = w.build()
