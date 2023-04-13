// https://www150.statcan.gc.ca/n1/daily-quotidien/220921/dq220921b-eng.htm
let data = [
  { rate: 0, start: 0, label: '0 to 4', total: 1898790 },//	5.4%
  { rate: 0, start: 5, label: '5 to 9', total: 2018130 },//	5.7%
  { rate: 0, start: 10, label: '10 to 14', total: 1922645 },//	5.5%
  { rate: 0.1, start: 15, label: '15 to 19', total: 2026160 },//	5.8%
  { rate: 0.15, start: 20, label: '20 to 24', total: 2242690 },//	6.4%
  { rate: 0.36, start: 25, label: '25 to 29', total: 2285990 },//	6.5%
  { rate: 0.52, start: 30, label: '30 to 34', total: 2329395 },//	6.6%
  { rate: 0.61, start: 35, label: '35 to 39', total: 2288365 },//	6.5%
  { rate: 0.66, start: 40, label: '40 to 44', total: 2255135 },//	6.4%
  { rate: 0.70, start: 45, label: '45 to 49', total: 2359965 },//	6.7%
  { rate: 0.72, start: 50, label: '50 to 54', total: 2678075 },//	7.6%
  { rate: 0.74, start: 55, label: '55 to 59', total: 2620240 },//	7.5%
  { rate: 0.75, start: 60, label: '60 to 64', total: 2290510 },//	6.5%
  { rate: 0.75, start: 65, label: '65 to 69', total: 1972480 },//	5.6%
  { rate: 0.74, start: 70, label: '70 to 74', total: 1420875 },//	4%
  { rate: 0.72, start: 75, label: '75 to 79', total: 1021850 },//	2.9%
  { rate: 0.71, start: 80, label: '80 to 84', total: 749650 },//	2.1%
  { rate: 0.68, start: 85, label: '85+', total: 770780 }//	2.2%
]

let sum = data.reduce((h, n) => h + n.total, 0)

const percent = (part, total) => {
  let num = (part / total) * 100;
  num = Math.round(num * 10) / 10;
  return num;
};

let run = 0
for (let i = data.length - 1; i >= 0; i -= 1) {
  run += data[i].total
  data[i].percentage = percent(run, sum)
}

for (let i = 0; i < data.length; i += 1) {
  data[i].houses = data[i].total * data[i].rate
}
let houses = data.reduce((h, n) => h + n.houses, 0)

run = 0
for (let i = data.length - 1; i >= 0; i -= 1) {
  run += data[i].houses
  data[i].cumulative = percent(run, houses)
}


export default data




