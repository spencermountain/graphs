// the four charts, ported 1:1 from the original growth.js / rules.js / players.js / teams.js
// each takes `today` (epoch ms) so the x-axes run from 1942 to now
import somehow from './somehow.js'
import colors from '~/assets/colors.js'
import teamColors from './team-colors.js'
import history from './history.js'

// --- league size over time ---
export const growth = (today) => {
  const data = [
    ['Oct 1 1942', 6],
    ['Oct 1 1967', 12], //la, phili, pitsburg, st louis
    ['Oct 1 1970', 14], //buffalo, vancouver
    ['Oct 1 1972', 16], //buffalo, vancouver
    ['Oct 1 1974', 18], //Washington, kansas
    ['Oct 1 1978', 17], //shrink
    ['Oct 1 1979', 21], //edmonton, hartford, quebec, winnipeg
    ['Oct 1 1991', 22], //san jose
    ['Oct 1 1992', 22], //Ottawa, tampa bay
    ['Oct 1 1993', 26], //florida, anaheim
    ['Oct 1 1998', 27], //nashville
    ['Oct 1 1999', 28], //atlanta
    ['Oct 1 2000', 30], //Columbus, minnesota
    ['Oct 1 2016', 31], // Las Vegas
    ['Oct 1 2018', 31],
    ['Oct 1 2020', 32], //seattle
  ]
  //add-in the end-of-season
  const points = []
  data.forEach((a, i) => {
    if (i === 0) {
      points.push(a)
      return
    }
    points.push([a[0].replace(/Oct 1 /, 'May 1 '), data[i - 1][1]])
    points.push(a)
  })

  const w = somehow({ height: 400, width: 700 })
  const mid = w.midArea().color('sea')
  mid.attrs.stroke = colors.blue
  mid.set(points)

  w.annotation(['original', 'six']).font(12).on('Oct 1 1942', 3).nudge(10, 30)
  w.annotation(['1967', 'league', 'doubles', 'to 12']).font(12).on('Apr 1 1967', 3).nudge(-120, 50)
  w.annotation(['1960s', 'league adds 2 teams', 'every 2 years']).font(12).on('Oct 1 1971', 14 / 2).nudge(70, -60)
  w.annotation(['1979', 'merges with WHL']).font(12).on('Oct 1 1979', -10).nudge(-130, -40)
  w.annotation(['2000', 'columbus', 'minnesota']).font(12).on('Oct 1 2000', 30 / 2).nudge(40, -80)
  w.annotation(['1978', 'league shrinks']).font(12).on('Sept 1 1978', 17 / 2).nudge(-120, 40)
  w.annotation(['1993', 'flordia,', 'anaheim']).font(12).on('Sept 1 1993', 26 / 2).nudge(0, 50)
  w.annotation(['2016', 'Las Vegas']).font(12).on('Sept 1 2016', 31 / 2).nudge(-80, 50)
  w.annotation(['2020', 'Seattle']).font(12).on('Sept 1 2019', -16).nudge(-80, -35)

  w.text('NHL Expansion:').at('0px', '100%')
  w.x.fit('Jan 1 1942', today)
  w.y.fit(-28, 28)
  w.yAxis.remove()
  return w.build()
}

// --- rule-changes & lockouts ---
export const rules = (today) => {
  const w = somehow({ height: 100, width: 700 })

  // goalie masks - 1960 - 1969
  w.text('goalie masks').font(12).at('oct 1 1960', '90%')
  w.rect().color('sky').set([
    ['oct 1 1960', '0%'],
    ['oct 1 1969', '80%'],
  ])
  // player helmets - 1972 - 1979
  w.text('player helmets').font(12).at('oct 1 1972', '90%')
  w.rect().color('green').set([
    ['oct 1 1972', '0%'],
    ['oct 1 1979', '80%'],
  ])
  //nhl lockouts 94, 2004, 2012
  w.text(["'95", 'lockout']).font(12).at('oct 1 1993', '90%')
  w.rect().color('orange').set([
    ['oct 1 1995', '0%'],
    ['jan 11 1996', '80%'],
  ])
  w.text(['2004', 'lockout']).font(12).at('oct 1 2002', '90%')
  w.rect().color('orange').set([
    ['oct 1 2004', '0%'],
    ['march 30 2005', '80%'],
  ])
  w.text(['2012', 'lockout']).font(12).at('oct 1 2010', '90%')
  w.rect().color('orange').set([
    ['oct 1 2012', '0%'],
    ['January 12, 2013', '80%'],
  ])

  w.x.fit('Jan 1 1942', today)
  w.y.fit(-28, 28)
  w.yAxis.remove()
  return w.build()
}

// --- star players ---
export const players = (today) => {
  const year = new Date(today).getUTCFullYear()
  const list = [
    ['Maurice Richard', 1942, 1960, 'Montreal Canadiens'],
    ['Gordie Howe', 1946, 1980, 'Detroit Red Wings'],
    ['Bobby Hull', 1957, 1980, 'Chicago Blackhawks'],
    ['Bobby Orr', 1966, 1978, 'Boston Bruins'],
    ['Bobby Clarke', 1969, 1984, 'Philadelphia Flyers'],
    ['Wayne Gretzky', 1979, 1999, 'Edmonton Oilers'],
    ['Steve Yzerman', 1983, 2006, 'Detroit Red Wings'],
    ['Mario Lemieux', 1984, 2005, 'Pittsburgh Penguins'],
    ['Sidney Crosby', 2005, year, 'Pittsburgh Penguins'],
  ]

  const w = somehow({ height: 200, width: 700 })
  list.forEach((a, i) => {
    w.line().color(teamColors[a[3]] || 'red').width(1).set([
      ['Oct 1 ' + a[1], i],
      ['Apr 1 ' + a[2], i],
    ])
    w.text(a[0]).at('Oct 1 ' + a[1], i)
  })

  w.fit()
  w.x.fit('Jan 1 1942', today)
  w.y.fit(-1)
  w.yAxis.remove()
  return w.build()
}

// --- every team's run ---
export const teams = (today) => {
  const list = [...history].reverse()
  const w = somehow({ height: 900, width: 700 })

  list.forEach((team, i) => {
    const end = team.end ? 'April 1 ' + team.end : today
    const start = 'Oct 1 ' + team.start
    const color = teamColors[team.team]
    w.line().width(12).color(color).set([
      [start, i],
      [end, i],
    ])
    w.text(team.team).color(color).dx(5).font(12).at(end, i)
  })

  w.text('Teams:').at('0px', '105%')
  w.fit()
  w.x.fit('Jan 1 1942', today)
  w.y.fit(-1)
  // the original kept the y-axis here (faint tick numbers on the left)
  return w.build()
}
