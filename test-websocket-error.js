// Test script to verify WebSocket error handling
const WebSocket = require('ws');

console.log('Testing WebSocket error handling...');

// Try to connect to an invalid WebSocket URL to trigger an error
const invalidUrl = 'ws://localhost:9999/invalid'; // Invalid port
const ws = new WebSocket(invalidUrl);

ws.on('open', () => {
  console.log('Unexpected: Connection opened');
});

ws.on('error', (error) => {
  console.log('WebSocket error triggered:', error.message);
  console.log('Error code:', error.code);
  console.log('Error type:', error.constructor.name);
});

ws.on('close', (code, reason) => {
  console.log('Connection closed:', code, reason.toString());
});

// Timeout after 5 seconds
setTimeout(() => {
  console.log('Test timeout - closing connection');
  ws.close();
}, 5000);
