// up-to 2010:
/*
SELECT
  year, mo, da
FROM
  [bigquery-public-data:noaa_gsod.gsod2008]
WHERE
  stn = '712650'
  and
  thunder = "1"
*/

// more weather stations:
/*
SELECT
*
FROM
[bigquery-public-data:noaa_gsod.stations]
WHERE
name LIKE '%TORONTO%'
LIMIT
1000
*/
// -- for 2018: --
// 710333
// 712654
// 716249
// 716390   6  - has history, but very few thunder
// 726240
// 726247
// 712650  23 -
// 715080

// before 2010:
/*
SELECT
  year, mo, da
FROM
  [bigquery-public-data:noaa_gsod.gsod2008]
WHERE
  stn = '716390'
  and
  thunder = "1"
*/
