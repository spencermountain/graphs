// layout math ported from spencer's somehow-sankey (svelte, 2020)
// cols: array of columns, each an array of {name, to, value, ...}
const topRoom = 20 // px of headroom above the tallest column

// tiny version of d3's scaleLinear (truncates, like the original)
const scale = ({ minmax, world }) => (num) =>
  parseInt(((num - minmax[0]) / (minmax[1] - minmax[0])) * (world[1] - world[0]), 10)

// wire each node to its named target in the next column
const addLinks = (byCol) => {
  byCol.forEach((nodes, i) => {
    nodes.forEach((node) => {
      let found = node.to && byCol[i + 1] ? byCol[i + 1].find((n) => n.name === node.to) : null
      if (found) {
        node.tos.push(found)
        found.froms.push(node)
      }
    })
  })
}

// consecutive nodes pointing at the same target are 'stacked'
const addStack = (byCol) => {
  byCol.forEach((nodes) => {
    let last = null
    nodes.forEach((node) => {
      node.stacked = node.to === last
      last = node.to
    })
  })
}

// a node grows to the sum of its inputs
const getValues = (byCol) => {
  byCol.forEach((nodes) =>
    nodes.forEach((node) => {
      let sum = node.froms.reduce((h, n) => h + n.value, 0)
      if (sum > node.value) node.value = sum
    })
  )
}

const getMax = (byCol) => Math.max(...byCol.flat().map((n) => n.top + n.value))

// stack tops within each column
const bySum = (byCol) => {
  byCol.forEach((nodes) => {
    let already = 0
    nodes.forEach((node) => {
      node.top = already
      already += node.value
    })
  })
}

// pull each node down to line-up with its (single) target, dragging stacked followers
const byNeighbour = (byCol) => {
  byCol.forEach((nodes) => {
    nodes.forEach((node, n) => {
      if (node.tos.length === 1 && node.tos[0].top > node.top) {
        node.top = node.tos[0].top
        let already = node.top + node.value
        for (let i = n + 1; i < nodes.length && nodes[i].stacked; i += 1) {
          nodes[i].top = already
          already += nodes[i].value
        }
      }
    })
  })
}

// splay-out stacked nodes a bit
const addMargin = (byCol) => {
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
}

// straight-edged ribbon between each node and its targets
const makePaths = (nodes) => {
  let paths = []
  nodes.forEach((node) => {
    let x = node.x + node.width
    let h = node.height
    node.tos.forEach((to) => {
      to.already = to.already || 0
      let d = `M${x},${node.y}`
      d += ` L${to.x},${to.y + to.already}` // dest top-left
      d += ` L${to.x},${to.y + h + to.already}` // dest bottom-left
      d += ` L${x},${node.y + h} Z` // back to node bottom
      to.already += h
      paths.push(d)
    })
  })
  return paths
}

const layout = function (cols, width, height, nodeWidth = 120) {
  let byCol = cols.map((nodes) => nodes.map((n) => ({ top: 0, froms: [], tos: [], ...n })))
  addLinks(byCol)
  addStack(byCol)
  getValues(byCol)
  // find each node's vertical start
  bySum(byCol)
  byNeighbour(byCol)
  addMargin(byCol)
  byNeighbour(byCol)
  // project to pixels
  let yScale = scale({ minmax: [0, getMax(byCol)], world: [0, height - topRoom] })
  let xScale = scale({ minmax: [0, byCol.length], world: [0, width] })
  byCol.forEach((nodes, i) => {
    nodes.forEach((node) => {
      node.y = yScale(node.top)
      node.height = yScale(node.value)
      node.x = xScale(i) + nodeWidth / 2
      node.width = nodeWidth
    })
    // single-node columns get breathing room
    if (nodes.length === 1) {
      nodes[0].y += topRoom
    }
  })
  let nodes = byCol.flat().filter((n) => n.value)
  return { nodes, paths: makePaths(nodes) }
}
export default layout
