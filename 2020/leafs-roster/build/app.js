import Post from '../Post.svelte'

let name = ''
// wire-in query params
const URLSearchParams = window.URLSearchParams
if (typeof URLSearchParams !== undefined) {
  const urlParams = new URLSearchParams(window.location.search)
  const myParam = urlParams.get('name')
  if (myParam) {
    name = myParam
  }
}

const app = new Post({
  target: document.body,
  props: {
    name: name,
  },
})

export default app
