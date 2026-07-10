// sankey layout math, ported from spencer's somehow-sankey (2020 build)
const topRoom = 20

// a very-tiny scaleLinear — parseInt kept to match original pixel math
const linear = ({ minmax, world }) => (num) =>
  parseInt((world[1] - world[0]) * ((num - minmax[0]) / (minmax[1] - minmax[0])), 10)

const toPercent = (part, total) => Math.round((part / total) * 100) + '%'

const getMax = function (byCol) {
  let max = 0
  byCol.forEach((nodes) => nodes.forEach((n) => (max = Math.max(max, n.top + n.value))))
  return max
}

// group into columns, wire-up forward links, flag stacked nodes
const byColumn = function (items) {
  let byCol = []
  items.forEach((o) => {
    let node = Object.assign({ to: '', from: null, full: 100, opacity: 1, dx: 0, dy: 0 }, o)
    node.value = Number(node.value)
    node.top = 0
    node.froms = []
    node.tos = []
    node.stacked = false
    byCol[node.col] = byCol[node.col] || []
    byCol[node.col].push(node)
  })
  byCol.shift() // cols are 1-based
  // forward links
  byCol.forEach((nodes, i) => {
    nodes.forEach((node) => {
      if (node.to && byCol[i + 1]) {
        let found = byCol[i + 1].find((n) => n.name === node.to)
        if (found) {
          node.tos.push(found)
          found.froms.push(node)
        }
      }
    })
  })
  // consecutive nodes with the same target get splayed-out later
  byCol.forEach((nodes) => {
    let lastOne = null
    nodes.forEach((node) => {
      if (node.to === lastOne) {
        node.stacked = true
      }
      lastOne = node.to
    })
  })
  return byCol
}

// a node's value must cover the sum of its inputs
const getValues = function (byCol) {
  byCol.forEach((nodes) => {
    nodes.forEach((node) => {
      let sum = 0
      node.froms.forEach((n) => (sum += n.value))
      if (sum > node.value) {
        node.value = sum
      }
    })
  })
  return byCol
}

// stack tops within each column
const bySum = function (byCol) {
  byCol.forEach((nodes) => {
    let already = 0
    nodes.forEach((node) => {
      node.top = already
      already += node.value
    })
  })
  return byCol
}

// nudge a node down to line-up with its only destination
const byNeighbour = function (byCol) {
  byCol.forEach((nodes) => {
    nodes.forEach((node, n) => {
      if (node.tos.length === 1 && node.tos[0].top > node.top) {
        node.top = node.tos[0].top
        // move down stacked-nodes as well
        let already = node.top + node.value
        for (let i = n + 1; i < nodes.length; i += 1) {
          if (nodes[i].stacked !== true) {
            break
          }
          nodes[i].top = already
          already += nodes[i].value
        }
      }
    })
  })
  return byCol
}

// splay-out stacked nodes a bit
const addMargin = function (byCol) {
  let margin = getMax(byCol) * 0.015
  byCol.forEach((nodes) => {
    let count = 1
    nodes.forEach((node) => {
      if (node.stacked) {
        node.top += margin * count
        count += 1
      } else {
        count = 1
      }
    })
  })
  return byCol
}

// x, y, width, height in px + percent-of-column
const makePoints = function (byCol, width, height, nodeWidth) {
  let max = getMax(byCol)
  let half = nodeWidth / 2
  let yScale = linear({ minmax: [0, max], world: [0, height - topRoom] })
  let xScale = linear({ minmax: [0, byCol.length], world: [0, width] })
  byCol.forEach((nodes) => {
    let total = nodes.reduce((sum, n) => sum + n.value, 0)
    nodes.forEach((node) => {
      node.y = yScale(node.top) + node.dy
      node.percent = toPercent(node.value, total)
      node.height = yScale(node.value)
      node.x = xScale(node.col - 1) + half + node.dx
      node.width = nodeWidth
    })
  })
  // single-node columns get breathing-room up top
  byCol.forEach((nodes) => {
    if (nodes.length === 1) {
      nodes[0].y += topRoom
    }
  })
  return byCol
}

// polygon from a node's right edge to each of its targets
const makePaths = function (nodes) {
  let paths = []
  nodes.forEach((node) => {
    let fromX = node.x + node.width
    let h = node.height
    node.tos.forEach((to) => {
      to.already = to.already || 0
      let d = `M${fromX},${node.y}`
      d += ` L${to.x},${to.y + to.already}`
      d += ` L${to.x},${to.y + h + to.already}`
      d += ` L${fromX},${node.y + h} Z`
      to.already += node.height
      paths.push(d)
    })
  })
  // 'from'-declared links draw backwards, out of the source's right side
  nodes.forEach((to) => {
    if (to.from) {
      let source = nodes.find((n) => n.name === to.from)
      source.alreadyFrom = source.alreadyFrom || 0
      let already = source.alreadyFrom
      let x = source.x + source.width
      paths.push(`M${x},${source.y + already} L${to.x},${to.y} L${to.x},${to.y + to.height} L${x},${source.y + to.height + already} Z`)
      source.alreadyFrom += to.height
    }
  })
  return paths
}

const layout = function (items, { width = 500, height = 800, nodeWidth = 120 } = {}) {
  let byCol = byColumn(items)
  byCol = getValues(byCol)
  byCol = bySum(byCol)
  byCol = byNeighbour(byCol)
  byCol = addMargin(byCol)
  byCol = byNeighbour(byCol)
  byCol = makePoints(byCol, width, height, nodeWidth)
  let nodes = byCol.flat().filter((n) => n.value)
  let paths = makePaths(nodes)
  return { nodes, paths }
}
export default layout
