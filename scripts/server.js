import connect from 'connect'
import statc from 'serve-static'
import connectLivereload from 'connect-livereload'
import livereload from 'livereload'

var server = connect()
const port = 5050

const startServer = function (abs) {
  console.log('running server')

  server.use(statc(abs))

  server.use(
    connectLivereload({
      port: 35729,
    })
  )

  server.listen(port)
  console.log(`http://localhost:${port}`)

  var lrserver = livereload.createServer()
  lrserver.watch(abs + '/**')
}
export default startServer
