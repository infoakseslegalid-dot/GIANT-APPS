import { createServer } from 'node:http'
import { parse } from 'node:url'
import next from 'next'
import { getRequestListener } from '@hono/node-server'
import { WebSocketServer } from 'ws'
import { app as api } from './src/server/index.ts'

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

const honoListener = getRequestListener(api.fetch)

app.prepare().then(() => {
  const server = createServer((req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      const { pathname } = parsedUrl

      if (pathname.startsWith('/api') && !pathname.startsWith('/api/ws')) {
        // Rewrite url for hono, e.g. /api/auth -> /auth if api handles without prefix
        // Actually, we should just let Hono handle /api prefix by mounting or letting it handle the full path.
        // If api routes are defined like api.get('/auth'), they won't match /api/auth unless Hono is mounted with basePath('/api')
        // We will change src/server/index.ts to use .basePath('/api')
        honoListener(req, res)
      } else {
        handle(req, res, parsedUrl)
      }
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })
  
  const wss = new WebSocketServer({ noServer: true })
  
  wss.on('connection', (ws, request) => {
    ws.on('message', (message) => {
      ws.send(JSON.stringify({ type: 'pong' }))
    })
  })

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url)
    if (pathname === '/api/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req)
      })
    } else {
      socket.destroy()
    }
  })

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
