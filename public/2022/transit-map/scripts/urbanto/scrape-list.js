let all = []
document.querySelectorAll(".database-header-container").forEach(e => {
  let title = e.querySelector(".database-header-info-container")
  let status = e.querySelector('.database-header-status2')
  let complete = e.querySelector('.database-header-completion2')
  let category = e.querySelector('.database-header-category-container')
  let story = e.querySelector('.database-header-storeys2')
  all.push({
    title: title.innerText,
    href: title.querySelector('a').getAttribute("href"),
    status: status ? status.innerText : null,
    complete: complete ? complete.innerText : null,
    category: category ? category.innerText : null,
    stories: story ? story.innerText : null,
  })
})


document.querySelector(".database-header-container").querySelector('.database-header-storeys2')