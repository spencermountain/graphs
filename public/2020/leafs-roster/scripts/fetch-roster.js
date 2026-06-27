const request = require('got')
const $ = require('cheerio')
const year = 2019

const fetchGames = async function(team) {
  let url = `https://www.hockey-reference.com/teams/${team}/${year}_gamelog.html`
  let res = await request(url)
  let games = []
  $(`#tm_gamelog_rs > tbody > tr`, res.body).each(function() {
    let href =
      $(this)
        .find('td')
        .first()
        .find('a')['0'].attribs.href || ''
    console.log(href)
    // href = href.replace('/boxscores/', '')
    games.push(href)
  })
  return games
}

const getGame = async function(gameID, teamID) {
  let url = `https://www.hockey-reference.com/boxscores/${gameID}.html`
  let res = await request(url)
  // let doc = $('#TOR_skaters', res.body)
  let result = {
    players: [],
    goalies: []
  }
  $(`#${teamID}_skaters > tbody > tr`, res.body).each(function() {
    var name = $(this)
      .find('td')
      .first()
      .text()
    result.players.push(name)
  })

  $(`#${teamID}_goalies > tbody > tr`, res.body).each(function() {
    var name = $(this)
      .find('td')
      .first()
      .text()
    result.goalies.push(name)
  })
  return result
}

async function doAll() {
  const team = 'TOR'
  console.log(await fetchGames(team))
  // console.log(await getGame('201904130BOS',team))
}
doAll()
