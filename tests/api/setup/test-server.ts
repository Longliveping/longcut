// /root/workspace/longcut/tests/api/setup/test-server.ts
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'

export async function createTestServer() {
  const app = next({ dev: false, dir: process.cwd() })
  await app.prepare()

  const handle = app.getRequestHandler()

  const server = createServer(async (req, res) => {
    const parsedUrl = parse(req.url!, true)
    await handle(req, res, parsedUrl)
  })

  return new Promise<{ server: any; port: number }>((resolve) => {
    server.listen(0, () => {
      const port = (server.address() as any).port
      resolve({ server, port })
    })
  })
}
