import wtf from 'wtf_wikipedia'

let arr = [

  '1951 Toronto municipal election',
  '1952 Toronto municipal election',
  '1953 Toronto municipal election',
  '1954 Toronto municipal election',
  '1955 Toronto municipal election',
  '1956 Toronto municipal election',
  '1958 Toronto municipal election',
  '1960 Toronto municipal election',
  '1962 Toronto municipal election',
  '1964 Toronto municipal election',
  '1966 Toronto municipal election',
  '1969 Toronto municipal election',
  '1972 Toronto municipal election',
  '1974 Toronto municipal election',
  '1976 Toronto municipal election',
  '1978 Toronto municipal election',
  '1980 Toronto municipal election',
  '1982 Toronto municipal election',
  '1985 Toronto municipal election',
  '1988 Toronto municipal election',
  '1991 Toronto municipal election',
  '1994 Toronto municipal election',
  //amalgamation
  '1997 Toronto municipal election',
  '2000 Toronto municipal election',
  '2003 Toronto municipal election',
  '2006 Toronto municipal election',
  '2010 Toronto mayoral election',
  '2014 Toronto mayoral election',
  '2018 Toronto mayoral election',
  '2022 Toronto mayoral election',
]
let getData = function (doc) {
  let obj = doc.infoboxes()[0].json()
  let people = []
  people.push({ name: obj.nominee1.text, num: obj.popular_vote1.number, percent: obj.percentage1.text })
  people.push({ name: obj.nominee2.text, num: obj.popular_vote2.number, percent: obj.percentage2.text })
  if (obj.candidate3) {
    people.push({ name: obj.nominee3.text, num: obj.popular_vote3.number, percent: obj.percentage3.text })
  }
  return { date: obj.election_date, people, turnout: obj.turnout }
}
// for (let i = 0; i < arr.length; i += 1) {
//   let doc = await wtf.fetch(arr[i])
//   console.log(getData(doc), ',')
// }
wtf.fetch('1949 Toronto municipal election').then((doc) => {
  console.log(getData(doc))
})