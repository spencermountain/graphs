import chroma from 'chroma-js'

let orRd = ["#fff7ec", "#7f0000"]
let greens = ['#2C2D14', '#5A612C', '#849445', '#E4D89A'].reverse()
// let aquas = ['#fff', '#6ce282', '#47c67d', '#29aa80', '#118e84', '#005f72']

// let aquas = ['#f5faf5', '#e0ffdd', '#afeab5', '#85d69c', '#60c28e', '#41ae87', '#269a85', '#108685', '#005f72',]
let aquas = ['white', '#d1edce', '#afeab5', '#85d69c', '#60c28e', '#41ae87', '#269a85', '#108685', '#005f72', '#013742', '#011a42']
//a very-tiny linear scale
const scaleLinear = function (obj) {
  let output = obj.output || []
  let input = obj.input || obj.input || []
  const calc = (num) => {
    let range = input[1] - input[0]
    let percent = (num - input[0]) / range
    let size = output[1] - output[0]
    return parseInt(size * percent, 10)
  }
  return calc
}

let linear = scaleLinear({ input: [0, 1], output: [0, 100], })
// console.log(linear(0.5))
let scale = chroma.scale(aquas);

const toHex = function (val) {
  let n = linear(val)
  let hex = scale(n / 100).hex();
  return hex
}
export default toHex 