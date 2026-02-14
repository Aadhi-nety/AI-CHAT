const WebSocket = require('ws');

const SERVER_URL = 'ws://localhost:3001';
const SESSION_ID = 'test-session-123'; // Use a valid session ID if available, or mock one

async function testConnections(maxConnections = 10) {
  const connections = [];

  console.log(`Testing ${maxConnections} concurrent WebSocket connections...`);

  for (let i = 0; i < maxConnections; i++) {
    try {
      const ws = new WebSocket(`${SERVER_URL}/terminal/${SESSION_ID}`);

      ws.on('open', () => {
        console.log(`Connection ${i + 1} opened successfully`);
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'connected') {
          console.log(`Connection ${i + 1} received: ${message.message}`);
        }
      });

      ws.on('close', (code, reason) => {
        console.log(`Connection ${i + 1} closed: code ${code}, reason: ${reason.toString()}`);
      });

      ws.on('error', (error) => {
        console.error(`Connection ${i + 1} error:`, error.message);
      });

      connections.push(ws);

      // Small delay to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Failed to create connection ${i + 1}:`, error.message);
    }
  }

  // Wait a bit for connections to establish
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log(`\nActive connections: ${connections.filter(ws => ws.readyState === WebSocket.OPEN).length}`);

  // Close all connections
  connections.forEach((ws, index) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
      console.log(`Closed connection ${index + 1}`);
    }
  });

  console.log('Test completed.');
}

// Run the test
testConnections(10).catch(console.error);
