// sankey layout, ported from somehow-sankey (the version compiled in public/2022/missing-middle/build/bundle.js)
// items: [{ name, value, col, color, from, to, full, stroke, accent, dx, dy, opacity }]

const topRoom = 20

// a very-tiny version of d3-scale's scaleLinear
const scaleLinear = ({ minmax, world }) => (num) => {
  let percent = (num - minmax[0]) / (minmax[1] - minmax[0])
  return parseInt((world[1] - world[0]) * percent, 10)
}

// fill in Node.svelte's default props
const normalize = (items) =>
  items.map((o) => ({
    to: '',
    from: null,
    full: 100,
    stroke: '#d98b89',
    accent: '#d98b89',
    dx: 0,
    dy: 0,
    opacity: 1,
    ...o,
    value: Number(o.value),
  }))

// turn into array of arrays (by column), add forward links + stacked flags
const byColumn = function (items) {
  let byCol = []
  items.forEach((node) => {
    byCol[node.col] = byCol[node.col] || []
    node.top = 0
    node.froms = []
    node.tos = []
    node.stacked = false
    byCol[node.col].push(node)
  })
  byCol.shift()
  // forward links (via 'to')
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
  // consecutive same-'to' nodes are stacked
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

// bump value up to sum of inputs
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

// align each node with its right-neighbour
const byNeighbour = function (byCol) {
  byCol.forEach((nodes) => {
    nodes.forEach((node, n) => {
      if (node.tos.length === 1 && node.tos[0].top > node.top) {
        node.top = node.tos[0].top
        // move down stacked-nodes as well
        let already = node.top + node.value
        for (let i = n + 1; i < nodes.length; i += 1) {
          if (nodes[i].stacked === true) {
            nodes[i].top = already
            already += nodes[i].value
          } else {
            break
          }
        }
      }
    })
  })
}

// stack tops, then splay-out stacked nodes a bit
const getTops = function (byCol) {
  byCol.forEach((nodes) => {
    let already = 0
    nodes.forEach((node) => {
      node.top = already
      already += node.value
    })
  })
  byNeighbour(byCol)
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

// add x, y, width, height
const makePoints = function (byCol, width, height, nodeWidth) {
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
  // give lone-node columns some top-room
  byCol.forEach((nodes) => {
    if (nodes.length === 1) {
      nodes[0].y += topRoom
    }
  })
}

// straight-edge ribbon between two node rects
const backwardPath = function (from, to) {
  let already = from.alreadyFrom
  let path = `M${from.x + from.width},${from.y + already}` // source-top
  path += ` L${to.x},${to.y}` // dest-top
  path += ` L${to.x},${to.y + to.height}` // dest-bottom
  path += ` L${from.x + from.width},${from.y + to.height + already}` // source-bottom
  return path + ` Z`
}

const makePaths = function (nodes) {
  let paths = []
  // forward links (via 'to')
  nodes.forEach((node) => {
    let fromX = node.x + node.width
    node.tos.forEach((to) => {
      to.already = to.already || 0
      let d = `M${fromX},${node.y}`
      d += ` L${to.x},${to.y + to.already}`
      d += ` L${to.x},${to.y + node.height + to.already}`
      d += ` L${fromX},${node.y + node.height}`
      d += ` Z`
      to.already += node.height
      paths.push(d)
    })
  })
  // backward links (via 'from')
  nodes.forEach((to) => {
    if (to.from) {
      let source = nodes.find((n) => n.name === to.from)
      source.alreadyFrom = source.alreadyFrom || 0
      paths.push(backwardPath(source, to))
      source.alreadyFrom += to.height
    }
  })
  return paths
}

const layout = function (items, width, height, nodeWidth = 120) {
  let byCol = byColumn(normalize(items))
  getValues(byCol)
  getTops(byCol)
  makePoints(byCol, width, height, nodeWidth)
  let nodes = byCol.flat().filter((n) => n.value)
  let paths = makePaths(nodes)
  return { nodes, paths }
}
export default layout
