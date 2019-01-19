const {BigQuery} = require('@google-cloud/bigquery');
const bigquery = new BigQuery();

//the one with thunderstorms
const toronto = 712650
//the one with snowfall
// const toronto = 715080

function getYear(station, year, cb) {
  const sqlQuery = 'SELECT * FROM \`bigquery-public-data.noaa_gsod.gsod' + year + '\` WHERE stn = "' + toronto + '"';

  const options = {
    query: sqlQuery,
    location: 'US',
  };

  function convert(f) {
    return parseInt((f - 32) * 5 / 9, 10)
  }

  // Runs the query
  bigquery.query(options).then(res => {
    let rows = res[0]
    // rows=rows.sort((a, b) => a.da < b.da ? -1 : 1)
    // rows=rows.sort((a, b) => a.mo < b.mo ? -1 : 1)
    rows = rows.map((o) => {
      let date = [o.year, o.mo, o.da].join('-')
      return {
        date: date,
        // temp: convert(o.temp),
        thunder: o.thunder === '1',
        // snow: o.sndp === 999.9 ? 0 : o.sndp,
        rain: o.prcp === 99.99 ? 0 : o.prcp,
      // pressure: o.stp, //=== 99.99 ? 0 : o.stp,
      }
    })
    rows = rows.sort((a, b) => a.date < b.date ? -1 : 1)
    cb(rows)
  })
}

getYear(toronto, 2000, (data) => {
  console.log('module.exports= ' + JSON.stringify(data, null, 2))
})
