// linear life expectency:
// today is 77
// 1900 was 40
// that's 37 years difference
// over 119 years
// +0.3 per year

let diff = new Date().getFullYear() - 1900
const inc = 37 / diff

//
const lifeSpan = function(year) {
  if (year < 1900) {
    return 40
  }
  const baseline = 40
  let since = year - 1900
  return baseline + since * inc
}
module.exports = lifeSpan

// console.log(lifeSpan(1090))
