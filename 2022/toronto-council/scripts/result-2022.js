let url = 'https://mediaresults.toronto.ca/results/unofficialresult.json'
const axios = require('axios')

axios.get(url).then((res) => {
  let wards = res.data.office[1].ward
  wards.forEach(o => {
    console.log(o.candidate[0].name)
  })
})