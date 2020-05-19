const data = require('../thunder')
Object.keys(data).forEach((year) => {
  console.log(year + ' : ' + data[year].length)
})

/*
2009 : 6
2010 : 20   --   7
2011 : 26   -- 10
2012 : 23 -- 8
2013 : 28
2014 : 26
2015 : 24
2016 : 25
2017 : 33
2018 : 23
2019 : 29
*/
