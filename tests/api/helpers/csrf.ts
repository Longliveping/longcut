// /root/workspace/longcut/tests/api/helpers/csrf.ts
import * as supertest from 'supertest'

export class CSRFHelper {
  static async getCSRFToken(agent: supertest.SuperAgentTest): Promise<string> {
    const response = await agent
      .get('/api/csrf-token')
      .expect(200)

    return response.headers['x-csrf-token'] as string || response.body.token
  }

  static buildCSRFHeaders(token: string) {
    return {
      'x-csrf-token': token,
      'cookie': `csrf-token=${token}`
    }
  }
}
