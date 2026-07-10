// sankey layout ported from somehow-sankey (the exact version compiled into this post's build/bundle.js)
// items: [{name, to, value, col(1-based), color, stroke, accent, full, opacity, dx, dy}]

const topRoom = 20

// tiny scaleLinear
const scaleLinear = ({ world, minmax }) => (num) => {
  let percent = (num - minmax[0]) / (minmax[1] - minmax[0])
  return parseInt((world[1] - world[0]) * percent, 10)
}

// group into column arrays, by node.col
const byColumn = (items) => {
  let byCol = []
  items.forEach((node) => {
    node.top = 0
    node.froms = []
    node.tos = []
    node.stacked = false
    byCol[node.col] = byCol[node.col] || []
    byCol[node.col].push(node)
  })
  byCol.shift() // cols are 1-based
  return byCol
}

// wire-up forward links by name
const addLinks = (byCol) => {
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
}

// mark nodes that share a destination with the node above
const addStack = (byCol) => {
  byCol.forEach((nodes) => {
    let lastOne = null
    nodes.forEach((node) => {
      if (node.to === lastOne) {
        node.stacked = true
      }
      lastOne = node.to
    })
  })
}

// a node's value is at least the sum of its inputs
const getValues = (byCol) => {
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

// cumulative tops within each column
const bySum = (byCol) => {
  byCol.forEach((nodes) => {
    let already = 0
    nodes.forEach((node) => {
      node.top = already
      already += node.value
    })
  })
}

// align each node with its sole destination, pushing stacked followers down
const byNeighbour = (byCol) => {
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

const getMax = (byCol) => {
  let max = 0
  byCol.forEach((nodes) => {
    nodes.forEach((node) => {
      max = Math.max(max, node.top + node.value)
    })
  })
  return max
}

// splay stacked nodes apart a little
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

// value-space tops → pixel x/y/width/height
const makePoints = (byCol, width, height, nodeWidth) => {
  let max = getMax(byCol)
  let half = nodeWidth / 2
  let yScale = scaleLinear({ minmax: [0, max], world: [0, height - topRoom] })
  let xScale = scaleLinear({ minmax: [0, byCol.length], world: [0, width] })
  byCol.forEach((nodes) => {
    nodes.forEach((node) => {
      node.y = yScale(node.top) + node.dy
      node.height = yScale(node.value)
      node.x = xScale(node.col - 1) + half + node.dx
      node.width = nodeWidth
    })
  })
  // single-node columns get nudged below the top edge
  byCol.forEach((nodes) => {
    if (nodes.length === 1) {
      nodes[0].y += topRoom
    }
  })
}

// filled ribbon polygons between each node and its destinations
const makePaths = (nodes) => {
  let paths = []
  nodes.forEach((node) => {
    let x = node.x + node.width
    let y = node.y
    let h = node.height
    node.tos.forEach((to) => {
      to.already = to.already || 0
      let d = `M${x},${y} L${to.x},${to.y + to.already} L${to.x},${to.y + h + to.already} L${x},${y + h} Z`
      to.already += h
      paths.push(d)
    })
  })
  return paths
}

const layout = (items, width, height, nodeWidth) => {
  let byCol = byColumn(items)
  addLinks(byCol)
  addStack(byCol)
  getValues(byCol)
  // find starting tops
  bySum(byCol)
  byNeighbour(byCol)
  addMargin(byCol)
  byNeighbour(byCol)
  // pixel positions
  makePoints(byCol, width, height, nodeWidth)
  let nodes = byCol.flat().filter((n) => n.value)
  let paths = makePaths(nodes)
  return { nodes, paths }
}
export default layout
