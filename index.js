const htm = require('htm')
const h = htm.bind(require('vhtml'))

const manifest = require('./manifest')
let el = document.querySelector('#stage')

let years = Object.keys(manifest).sort().reverse()
let result = []
years.forEach((y) => {
  let posts = manifest[y].reverse().map((o) => {
    let path = y + '/' + o.num
    return h`<a class="block" >
    <div class="">
      <span class="link">${o.title}</span>
    </div>
    <div >
      <img  style="margin-left:95px; max-width:450px; max-height:100px;" src="${path + '/' + o.thumb}" />
    </div>
    </a>
    `
  })
  result.push(h`<h3 style="margin-left:1rem;">${y}</h3>`)
  result = result.concat(posts)
})

el.innerHTML = result.join(' ')
