const wtf = require('/Users/spencer/mountain/wtf_wikipedia')

let all = []
;(async () => {
  // saturn 5
  //   all = []
  //   let doc = await wtf.fetch('Saturn_V')
  //   let table = doc.section('Saturn V vehicles and launches').tables(0)
  //   let rows = table.json()
  //   rows.forEach((row) => {
  //     all.push({
  //       date: row['Launch date (UTC)'].text.replace(/ [0-9:]*$/, ''),
  //       name: row['Mission'].text,
  //     })
  //   })
  //   all = all.filter((o) => o.date)
  //   console.log(JSON.stringify(all, null, 2))

  // atlas
  //   let doc = await wtf.fetch('List_of_Atlas_launches_(2000–2009)')
  //   doc.tables().forEach((table) => {
  //     let rows = table.json()
  //     console.log(rows)
  //     rows.forEach((row) => {
  //       console.log(row)
  //       all.push({
  //         // date: row['Date/Time (UTC)'].text,
  //         // name: row['S/N'].text,
  //         date: row['Date / time (UTC) '].text,
  //         name: row['Flight №'].text,
  //       })
  //     })
  //   })

  // china
  let doc = await wtf.fetch('List_of_Long_March_launches')
  let launches = doc.templates().filter((t) => t.template === 'launch')
  launches.forEach((t) => {
    all.push({ date: t.date.replace(/ [0-9:]*$/, ''), name: t.serial })
  })

  console.log(JSON.stringify(all, null, 2))
})()
