const games = require('./games')
const axios = require('axios')
const $ = require('cheerio')
let results = {}
//
const fetchGame = async function (id) {
  let url = `https://www.baseball-reference.com/boxes/TOR/TOR${id}.shtml`
  return axios
    .get(url)
    .then((response) => {
      let html = response.data
      let str = html.match(/weather.{0,100}/gi)[0] || ''
      // console.log(str)
      if (str.match(/in dome/i)) {
        results[id] = false
        console.log(`${id}\t${false}`)
      } else {
        results[id] = true
        console.log(`${id}\t${true}`)
      }
    })
    .catch((error) => {
      console.log(error)
    })
  // let href = $(this).text || ''
  //   console.log(href)
  //   // href = href.replace('/boxscores/', '')
  //   games.push(href)
  // })
  // return games
}
;(async () => {
  for (let i = 0; i < games.length; i += 1) {
    await fetchGame(games[i])
  }
  // await fetchGame(games[200])
  console.log(JSON.stringify(results, null, 2))
})()
// ;(async () => {
//   try {
//     await fetchGame('https://www.baseball-reference.com/boxes/TOR/TOR201906050.shtml')
//   } catch (e) {
//     console.log(e)
//   }
// })()
