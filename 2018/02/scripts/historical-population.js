const wtf = require('/Users/spencer/mountain/wtf_wikipedia/')

wtf.fetch(['Montreal', 'Demographics_of_Toronto'], (err, docs) => {
  let data = docs.map((doc) => {
    let years = doc.templates('historical populations')[0].data
    years.forEach((o) => o.val = String(o.val).replace(/,/g, ''))
    return {
      title: doc.title(),
      years: years.map((o) => [Number(o.year), Number(o.val)]),
    }
  })
  console.log(JSON.stringify(data, null, 2))
})
