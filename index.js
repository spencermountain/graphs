const htm = require('htm');
const h = htm.bind(require('vhtml'));

const manifest = require('./manifest');
let el = document.querySelector('#stage');


let years = Object.keys(manifest).sort();
let result = [];
years.forEach((y) => {
  let posts = manifest[y].map((o) => {
    let path = y + '/' + o.num;
    return h`<a href="${path}" class="left flex-start w30 m3" >
    <span class="olive" >${o.num}</span>
    <span class="link"> / ${o.title}</span>
    <img class="block" style="margin-left:95px; max-width:450px; max-height:100px;" src="${path + '/' + o.thumb}" />
    </a>
    `;
  });
  result.push(h`<h3 class="left dimgrey">${y}</h3>`);
  result = result.concat(posts);
});

el.innerHTML = result.join(' ');
