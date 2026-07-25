#!/usr/bin/env node

import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'

const siteRoot = join(import.meta.dirname, '..', 'site')
const port = Number.parseInt(process.env.SITE_PORT ?? '4173', 10)
const types = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
])

const server = createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method ?? '')) {
    response.writeHead(405, { allow: 'GET, HEAD' })
    response.end()
    return
  }

  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname)
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1)
  const requestedPath = normalize(join(siteRoot, relativePath))

  if (!requestedPath.startsWith(`${siteRoot}/`) || !existsSync(requestedPath)) {
    response.writeHead(404)
    response.end('Not found')
    return
  }

  const file = statSync(requestedPath).isDirectory()
    ? join(requestedPath, 'index.html')
    : requestedPath
  response.writeHead(200, {
    'cache-control': 'no-store',
    'content-type': types.get(extname(file)) ?? 'application/octet-stream',
  })
  if (request.method === 'HEAD') response.end()
  else createReadStream(file).pipe(response)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Elements Pages preview: http://127.0.0.1:${port}`)
})
