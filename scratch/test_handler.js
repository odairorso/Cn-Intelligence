
import dotenv from 'dotenv';
dotenv.config();

// Carrega o handler dinamicamente após carregar o env
const { default: handler } = await import('../api/index.js');

async function testHandler() {
  const req = {
    method: 'GET',
    query: { route: 'stats', uid: 'guest' }
  };
  const res = {
    status: (code) => {
      console.log('Status:', code);
      return res;
    },
    json: (data) => {
      console.log('Response JSON:', JSON.stringify(data, null, 2));
      return res;
    },
    setHeader: (name, value) => {
      console.log('Header:', name, '=', value);
      return res;
    },
    end: () => {
      console.log('Response ended');
      return res;
    }
  };

  try {
    await handler(req, res);
  } catch (err) {
    console.error('Handler crashed:', err);
  }
}

testHandler();
