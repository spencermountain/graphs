const inputs = require('somehow-input')
const draw = require('./draw')

let gens = 10
let age = 33
let gender = 'paternal'

draw(gens, age, gender)

let ageSlider = inputs.slider({
  width: 800,
  max: 120,
  min: 1,
  value: 33,
  label: 'your age',
  debounce: false,
  cb: val => {
    age = val
    draw(gens, age, gender)
  }
})
document.querySelector('#age').innerHTML = ageSlider.build()

let genderSelect = inputs.select({
  width: 800,
  value: 'paternal',
  options: ['paternal', 'maternal'],
  label: 'line',
  debounce: false,
  cb: val => {
    gender = val
    draw(gens, age, gender)
  }
})
document.querySelector('#gender').innerHTML = genderSelect.build()

let genSlider = inputs.slider({
  width: 800,
  max: 40,
  min: 3,
  value: 10,
  label: 'generations',
  debounce: true,
  cb: val => {
    gens = val
    draw(gens, age, gender)
  }
})
document.querySelector('#generations').innerHTML = genSlider.build()
