// sankey layout ported from somehow-sankey, 2022 version (verified against build/bundle.js)
// computes node boxes + link polygons. cols here are 0-indexed (original was 1-indexed via a svelte store)
const topRoom = 20 // px reserved at the top

// tiny d3-style linear scale
const linear = ({ minmax, world }) => (num) => {
  let percent = (num - minmax[0]) / (minmax[1] - minmax[0])
  return parseInt((world[1] - world[0]) * percent, 10)
}

// group into array-of-arrays by col, wire forward links, mark stacked runs
const byColumn = function (items) {
  let byCol = []
  items.forEach((node) => {
    node.top = 0
    node.froms = []
    node.tos = []
    node.stacked = false
    byCol[node.col] = byCol[node.col] || []
    byCol[node.col].push(node)
  })
  // forward links ('to' pointing at a node in the next col)
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
  // consecutive nodes with the same 'to' form a stack (they get splayed apart)
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

// a node's value is at least the sum of its inputs
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
}

const getMax = function (byCol) {
  let max = 0
  byCol.forEach((nodes) => {
    nodes.forEach((node) => {
      max = Math.max(max, node.top + node.value)
    })
  })
  return max
}

// align a node with its single right-neighbour, dragging stacked nodes down after it
const byNeighbour = function (byCol) {
  byCol.forEach((nodes) => {
    nodes.forEach((node, n) => {
      if (node.tos.length === 1 && node.tos[0].top > node.top) {
        node.top = node.tos[0].top
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
}

// vertical placement, in value-units
const getTops = function (byCol) {
  byCol.forEach((nodes) => {
    let already = 0
    nodes.forEach((node) => {
      node.top = already
      already += node.value
    })
  })
  byNeighbour(byCol)
  // splay-out stacked nodes a bit
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
  byNeighbour(byCol)
}

// value-units → pixels. also computes each node's percent of its column
const makePoints = function (byCol, width, height, nodeWidth) {
  let max = getMax(byCol)
  let yScale = linear({ minmax: [0, max], world: [0, height - topRoom] })
  let xScale = linear({ minmax: [0, byCol.length], world: [0, width] })
  byCol.forEach((nodes) => {
    let total = nodes.reduce((h, n) => h + n.value, 0)
    nodes.forEach((node) => {
      node.y = yScale(node.top)
      node.percent = Math.round((node.value / total) * 100) + '%'
      node.height = yScale(node.value)
      node.x = xScale(node.col) + nodeWidth / 2
      node.width = nodeWidth
    })
    // single-node columns get nudged down
    if (nodes.length === 1) {
      nodes[0].y += topRoom
    }
  })
}

// straight-edged link polygons
const makePaths = function (nodes) {
  let paths = []
  // forward links
  nodes.forEach((node) => {
    let fromX = node.x + node.width
    let h = node.height
    node.tos.forEach((to) => {
      to.already = to.already || 0
      let d = `M${fromX},${node.y}`
      d += ` L${to.x},${to.y + to.already}`
      d += ` L${to.x},${to.y + h + to.already}`
      d += ` L${fromX},${node.y + h}`
      d += ` Z`
      to.already += node.height
      paths.push(d)
    })
  })
  // backward-declared links ('from' pointing at a node in the previous col)
  nodes.forEach((to) => {
    if (to.from) {
      let source = nodes.find((n) => n.name === to.from)
      let already = source.alreadyFrom || 0
      let d = `M${source.x + source.width},${source.y + already}`
      d += ` L${to.x},${to.y}`
      d += ` L${to.x},${to.y + to.height}`
      d += ` L${source.x + source.width},${source.y + to.height + already}`
      d += ` Z`
      source.alreadyFrom = already + to.height
      paths.push(d)
    }
  })
  return paths
}

// main entry: items → { nodes, paths }. mutates items — pass a fresh copy
const layout = function (items, width, height, nodeWidth = 120) {
  let byCol = byColumn(items)
  getValues(byCol)
  getTops(byCol)
  makePoints(byCol, width, height, nodeWidth)
  let nodes = byCol.flat().filter((n) => n.value)
  let paths = makePaths(nodes)
  return { nodes, paths }
}
export default layout
