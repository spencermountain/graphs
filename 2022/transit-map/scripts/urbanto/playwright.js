import { chromium } from 'playwright'
import list from './data.js'
import fs from 'fs'
console.log(list[0])

let pages = list.filter(obj => {
  if (obj.status === "Complete" || obj.category === "Commercial (Retail)" || obj.category === "Institutional") {
    return false
  }
  if (obj.title.match(/ \((Burlington|Barrie|Hamilton|Kitchener|London|Oakville)\)/)) {
    return false
  }
  return true
})
console.log(pages.length)

const doit = async function (page, url) {
  await page.goto(url)
  await page.waitForTimeout(2500) // wait for 1 seconds

  let data = { url: url }
  let rows = await page.locator('.project-info')
  const count = await rows.count()
  for (let i = 0; i < count; ++i) {
    let row = await rows.nth(i)
    let key = await row.locator('.heading').textContent()
    let val = await row.locator('.project-details').textContent()
    val = val.trim()
    if (val.match(/^[0-9]+$/)) {
      val = Number(val)
    }
    data[key.trim()] = val
  }
  let map = await page.locator('a[target=_blank] > .project-map').locator('..')
  let href = await map.getAttribute('href')
  data.map = href
  let str = '\n' + JSON.stringify(data, null, 2) + ',\n'
  fs.writeFileSync('./results.txt', str, { flag: 'a' })

  return data
}

const doAll = async function () {
  const browser = await chromium.launch({
    headless: false // Show the browser. 
  })
  const page = await browser.newPage()

  for (let i = 0; i < pages.length; i += 1) {
    let url = pages[i].href
    let meta = await doit(page, url)
    console.log(meta)

  }
  await browser.close()

}
doAll()