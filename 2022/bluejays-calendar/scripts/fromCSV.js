const fs = require('fs')
const spacetime = require('spacetime')
const path = require('path')
let lines = fs.readFileSync(path.join(__dirname, '../data/schedule.csv')).toString().split(/\n/)
lines.shift()
lines = lines.map(line => {
  let arr = line.split(/,/g)
  let time = arr[1].replace(/^0/, '')
  let daytime = /AM$/.test(time) || /^(11|12|1|2|3|4):/.test(time)
  let parts = arr[0].split('/')
  let obj = {
    month: Number(parts[0].replace(/^0/, '')) - 1,
    date: Number(parts[1]),
    year: 2022,
  }
  let date = spacetime(obj).time(time).iso()
  return {
    date,
    time,
    daytime,
    home: arr[4] === 'Rogers Centre - Toronto',
    vs: arr[3].replace(/blue jays/i, '').replace(' at ', '').trim()
  }
})
// console.log(lines[0])
// let headers = lines.shift()
// console.log(headers)
// console.log(lines)
console.log(JSON.stringify(lines, null, 2))

// https://www.ticketing-client.com/ticketing-client/csv/GameTicketPromotionPrice.tiksrv?team_id=141&display_in=singlegame&ticket_category=Tickets&site_section=Default&sub_category=Default&leave_empty_games=true&event_type=T&year=2022&begin_date=20220201