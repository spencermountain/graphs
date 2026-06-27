//
const axios = require('axios')
const $ = require('cheerio')

const fetchGames = async function (year) {
  let url = ` https://www.baseball-reference.com/teams/TOR/${year}-schedule-scores.shtml#all_results`
  return axios.get(url).then((res) => {
    let games = []
    // console.log(res.data)
    $('td[data-stat="boxscore"]', res.data).each(function () {
      let href = $(this).html()
      console.log(href)
      // href = href.replace('/boxscores/', '')
      games.push(href)
    })
    // console.log(games)
    return games
  })
}

// let els = document.querySelectorAll('td[data-stat="boxscore"]')
// let arr = []
// for (let i = 0; i < els.length; i += 1) {
//   console.log(i)
//   arr.push(els[i].querySelector('a').href)
// }

console.log(fetchGames(2021))
