const year = new Date().getFullYear()
const months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sept',
  'Oct',
  'Nov',
  'Dec',
]

const drawCity = function(w, city) {
  let arr = city.weather.split(',').map((temp, i) => {
    let date = months[i] + ' 1 ' + year
    return [date, Number(temp)]
  })
  //add start to very end
  arr.push([`Dec 31 ${year}`, arr[0][1]])
  let line = w.getShape('line')
  line.set(arr)
  let label = w.getShape('label')
  label.text(city.city)
  let june = arr[6]
  label.set([june])
  label.dx(-12)
  label.dy(7)
// console.log(arr[6])
}
module.exports = drawCity


// Object.keys(latitudes).forEach((k, n) => {
//   let city = latitudes[k]
//   let arr = city.weather.split(',').map((temp, i) => {
//     let date = months[i] + ' 1 2018'
//     return [date, Number(temp)]
//   })
//   //add start to very end
//   arr.push(['Dec 31 2018', arr[0][1]])
//   let color = colors[n]
//   let l = w.line()
//   l.set(arr)
//   l.color(color)
//   let t = w.text(latitudes[k].city).font(8)
//   t.dx(5).color(color)
//   t.after('Dec 31 2018', arr[arr.length - 1][1])
// })
