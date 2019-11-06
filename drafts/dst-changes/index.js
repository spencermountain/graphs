const somehow = require('somehow');

let w = somehow({
  height: 200,
  aspect: 'widescreen',
});

w.fit()

let el = document.querySelector('#stage');
el.innerHTML = w.build()
