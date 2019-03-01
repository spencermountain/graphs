const sometime = require('sometime');
const input = require('somehow-input');

let w = somehow({
  height: 200,
  aspect: 'widescreen',
});

w.fit()

let el = document.querySelector('#calendar');
el.innerHTML = w.build()
