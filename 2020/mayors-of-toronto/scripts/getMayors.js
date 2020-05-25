const wtf = require('/Users/spencer/mountain/wtf_wikipedia')
let arr = []
wtf.fetch('List of mayors of Toronto').then((doc) => {
  doc.tables().map((table) => {
    let rows = table
      .json()
      .map((row) => [row.Mayor.text, row['Took office'].text, row['Left office'].text])
    arr = arr.concat(rows)
  })
  console.log(JSON.stringify(arr))
})
