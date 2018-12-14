const wtf = require('wtf_wikipedia')
// const wtf = require('../src');
//fetch a list of all apollo astronauts
// page may have changed. made on Nov-2018

const options = {
  'Api-User-Agent': 'wtf_wikipedia example'
};
const missions = {};

(async () => {
  //there's a good list here
  // https://en.wikipedia.org/wiki/List_of_Apollo_astronauts
  let doc = await wtf.fetch('List of Apollo astronauts', options);

  //grab the first table
  let s = doc.sections('Apollo astronauts who walked on the Moon');
  let list = s.tables(0).json();

  //grab the second table
  s = doc.sections('Apollo astronauts who flew to the Moon without landing');
  let list2 = s.tables(0).json();

  //combine them together
  list = list.concat(list2);

  //grab the data we want
  list.forEach((row) => {
    let m = row.mission.text
    missions[m] = missions[m] || {
      date: '',
      people: []
    }
    let person = {
      name: row.name.text,
      birth: row.born.text,
      death: row.died.text || '',
    // age: row['age on mission'].text
    };
    missions[m].people.push(person)
  });
  console.log(JSON.stringify(missions, null, 2));
})();
