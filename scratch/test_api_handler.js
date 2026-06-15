import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env') });

const req = {
  method: 'GET',
  query: { route: 'stats' },
  headers: {
    'x-cn-security': process.env.SECURITY_TOKEN || 'CN-INT-2024-SECURE-HARDENED-V1'
  }
};

const res = {
  statusCode: 200,
  headers: {},
  getHeader(name) {
    return this.headers[name.toLowerCase()];
  },
  setHeader(name, value) {
    this.headers[name.toLowerCase()] = value;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    console.log('Status:', this.statusCode);
    console.log('Response JSON:', JSON.stringify(data, null, 2));
    return this;
  },
  end() {
    console.log('End called');
    return this;
  }
};

async function test() {
  try {
    const handler = (await import('../api/index.js')).default;
    await handler(req, res);
  } catch (err) {
    console.error('Handler error:', err);
  }
}

test();
