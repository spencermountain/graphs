var connect = require('connect')
var statc = require('serve-static')
var server = connect()
const port = 5000

const startServer = function (abs) {
  console.log('running server')

  server.use(statc(abs))

  server.use(
    require('connect-livereload')({
      port: 35729,
    })
  )

  server.listen(port)
  console.log(`http://localhost:${port}`)

  var livereload = require('livereload')
  var lrserver = livereload.createServer()
  lrserver.watch(abs + '/**')
}
module.exports = startServer
