const inputs = require('somehow-input')
const draw = require('./draw')

let gens = 10
let age = 33
let genLength = 25

draw(gens, age, genLength)

let ageSlider = inputs.slider({
  width: 800,
  max: 120,
  min: 1,
  value: 33,
  label: 'your age',
  debounce: true,
  cb: val => {
    age = val
    draw(gens, age, genLength)
  }
})
document.querySelector('#age').innerHTML = ageSlider.build()

let genderSelect = inputs.select({
  width: 800,
  max: 75,
  min: 1,
  value: 'paternal',
  options: ['paternal', 'maternal'],
  label: 'line',
  debounce: true,
  cb: val => {
    gens = val
    draw(gens, age, genLength)
  }
})
document.querySelector('#gender').innerHTML = genderSelect.build()

let genSlider = inputs.slider({
  width: 800,
  max: 75,
  min: 3,
  value: 10,
  label: 'generations',
  debounce: true,
  cb: val => {
    gens = val
    draw(gens, age, genLength)
  }
})
document.querySelector('#generations').innerHTML = genSlider.build()
