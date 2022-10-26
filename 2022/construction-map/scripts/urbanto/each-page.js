import { load } from 'cheerio'
import https from 'https'

const fetch = function (url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, resp => {
        let data = ''
        resp.on('data', chunk => {
          data += chunk
        })
        resp.on('end', () => {
          resolve(data)
        })
      })
      .on('error', err => {
        console.log('Error: ' + err.message)
        reject()
      })
  })
}

let url = "https://urbantoronto.ca/database/projects/8-wellesley-west"
let html = await fetch(url)
console.log(html)
// const $ = load(html)
// console.log($('.project-details').text())


