// /root/workspace/longcut/tests/api/setup/supertest-agent.ts
import { createTestServer } from './test-server'
import supertest from 'supertest'

interface TestServer {
  server: any
  port: number
}

let testServer: TestServer | null = null

export async function getTestAgent() {
  if (!testServer) {
    testServer = await createTestServer()
  }
  return supertest(`http://localhost:${testServer.port}`)
}

export async function closeTestServer() {
  if (testServer) {
    testServer.server.close()
    testServer = null
  }
}
