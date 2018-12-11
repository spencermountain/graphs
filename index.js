const htm = require('htm')
const h = htm.bind(require('vhtml'));

const manifest = require('./manifest')
let el = document.querySelector('#stage');

let pages = manifest.map((o) => {
  return h`<a href="${o.path}" class="left flex-start w30 m2" >
    <span class="m3 olive" >${o.path}</span>
    <span class="link">${o.title}</span>
    <img class="block" style="margin-left:95px; max-width:450px; max-height:100px;" src="${o.path + '/' + o.thumb}" />
  </a>
  `
})
el.innerHTML = pages.join(' ')
