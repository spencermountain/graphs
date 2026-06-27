const htm = require('htm');
const h = htm.bind(require('vhtml'));

const build = function(id, val = 0) {
  id = id || 'plusMinus'
  return h`<div class="row mw10">
    <input id="${'minus' + id}" type="button" value="-"/>
    <input class="w5 f2 grey rounded center" id="${id}" type="text" value="${val}"/>
    <input id="${'plus' + id}" type="button" value="+"/>
  </div>`
}

const events = function(id, cb) {
  id = id || 'plusMinus'
  cb = cb || function() {}
  setTimeout(() => {
    document.querySelector('#plus' + id).onclick = function() {
      let input = document.querySelector('#' + id)
      let val = Number(input.value || '') + 1
      input.value = val
      cb(val)
    }
    document.querySelector('#minus' + id).onclick = function() {
      let input = document.querySelector('#' + id)
      let val = Number(input.value || '') - 1
      input.value = val
      cb(val)
    }
  }, 500)
}

module.exports = {
  build: build,
  events: events
}
