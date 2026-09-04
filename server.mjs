import os from "os";
import { createServer } from 'node:http'
import { parse } from 'node:url'
import next from 'next'
import { getRequestListener } from '@hono/node-server'
import { WebSocketServer } from 'ws'
import { app as api } from './src/server/index.ts'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

const honoListener = getRequestListener(api.fetch)

app.prepare().then(() => {
  // Upgrade handler milik Next (HMR websocket saat dev) — hanya tersedia setelah prepare().
  const nextUpgrade = app.getUpgradeHandler()
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

  // Registry semua koneksi klien yang aktif. Hidup di scope custom-server ini
  // (tidak ikut ter-reload oleh HMR), jadi aman dipakai sebagai anchor global.
  const wsClients = new Set()

  // Dipanggil oleh layer API (src/server/deps.ts -> WSManager.broadcast) lewat globalThis.
  globalThis.__WS_BROADCAST__ = (payload) => {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload)
    for (const ws of wsClients) {
      try {
        if (ws.readyState === 1) ws.send(data)
      } catch {
        wsClients.delete(ws)
      }
    }
  }

  wss.on('connection', (ws) => {
    wsClients.add(ws)
    ws.on('message', () => {
      try { ws.send(JSON.stringify({ type: 'pong' })) } catch {}
    })
    ws.on('close', () => wsClients.delete(ws))
    ws.on('error', () => wsClients.delete(ws))
  })

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url)
    if (pathname === '/api/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req)
      })
    } else {
      // HMR / _next websocket dll → biarkan Next yang menangani.
      nextUpgrade(req, socket, head)
    }
  })

  server.listen(port, '0.0.0.0', () => {
    
    const nets = os.networkInterfaces();
    let localIp = 'localhost';
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          localIp = net.address;
        }
      }
    }

    console.log(`> Siap melayani!\n> Akses Lokal: http://localhost:${port}\n> Akses Jaringan: http://${localIp}:${port}`)
  })
})
