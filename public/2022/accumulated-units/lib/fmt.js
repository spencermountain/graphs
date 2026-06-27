const fmt = n => {
  if (n > 1000000) {
    n = Math.round(n * 10) / 10
    n = (n / 1000000).toLocaleString() + 'm'
    return String(n)
  }
  if (n > 1000) {
    n = (n / 1000)
    n = Math.round(n * 1) / 1
    return n.toLocaleString() + 'k'
  }
  return n
}
export default fmt