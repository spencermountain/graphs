const htm = require('htm')
const h = htm.bind(require('vhtml'));

const manifest = require('./manifest')
let el = document.querySelector('#stage');

let pages = manifest.map((o) => {
  return h`<div class="left flex-start outline w30 m2" >
    <span class="m3 olive" >${o.path}</span>
    <a href="${o.path}" class="link">${o.title}</a>
      <img class="block" style="margin-left:90px; max-width:450px; max-height:100px;" src="${o.path + '/' + o.thumb}" />
  </div>
  `
})
el.innerHTML = pages.join(' ')
