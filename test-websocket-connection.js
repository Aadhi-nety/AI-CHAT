// Test script to verify WebSocket connection stability with ping/pong
const WebSocket = require('ws');

console.log('Testing WebSocket connection stability...');

const testSessionId = 'test-session-123';
const wsUrl = `ws://localhost:3002/terminal/${testSessionId}`;

const ws = new WebSocket(wsUrl);

let pingCount = 0;
let pongCount = 0;
let messageCount = 0;

ws.on('open', () => {
  console.log('✅ WebSocket connection opened');
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    messageCount++;

    if (message.type === 'ping') {
      console.log('📥 Received ping from server');
      pingCount++;
      // Respond with pong
      ws.send(JSON.stringify({ type: 'pong' }));
      console.log('📤 Sent pong to server');
    } else if (message.type === 'pong') {
      console.log('📥 Received pong from server');
      pongCount++;
    } else if (message.type === 'connected') {
      console.log('📥 Received connected message:', message.message);
    } else {
      console.log('📥 Received message:', message);
    }
  } catch (err) {
    console.error('❌ Failed to parse message:', err);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
  console.log('🔌 Connection closed:', code, reason.toString());
  console.log('📊 Test Summary:');
  console.log(`   Messages received: ${messageCount}`);
  console.log(`   Pings received: ${pingCount}`);
  console.log(`   Pongs received: ${pongCount}`);
});

// Send a test ping after connection
setTimeout(() => {
  if (ws.readyState === WebSocket.OPEN) {
    console.log('📤 Sending test ping to server');
    ws.send(JSON.stringify({ type: 'ping' }));
  }
}, 2000);

// Monitor for 30 seconds
setTimeout(() => {
  console.log('⏰ Test timeout - closing connection');
  ws.close(1000, 'Test completed');
}, 30000);
