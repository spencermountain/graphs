const somehow = require('somehow');

let w = somehow({
  height: 200,
  aspect: 'widescreen',
});

w.y.fit(0, 9);
w.x.fit('Jan 1 2018', 'Dec 31 2018');

let el = document.querySelector('#stage');
el.innerHTML = w.build()
