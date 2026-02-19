/**
 * WebSocket Test Script for AWS App Runner
 * 
 * This script tests WebSocket connectivity specifically for AWS App Runner deployment
 * to diagnose and verify the 1006 error fix.
 * 
 * Usage:
 *   node test-websocket-aws-apprunner.js <websocket-url> [session-id]
 * 
 * Example:
 *   node test-websocket-aws-apprunner.js wss://2rrfaahu3d.ap-south-1.awsapprunner.com/terminal/test-session
 */

const WebSocket = require('ws');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(level, message) {
  const timestamp = new Date().toISOString();
  const color = {
    info: colors.cyan,
    success: colors.green,
    warn: colors.yellow,
    error: colors.red,
  }[level] || colors.reset;
  
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

function testWebSocket(url, sessionId = 'test-session') {
  return new Promise((resolve, reject) => {
    const fullUrl = url.includes('/terminal/') ? url : `${url}/terminal/${sessionId}`;
    
    log('info', `Testing WebSocket connection to: ${fullUrl}`);
    log('info', `Session ID: ${sessionId}`);
    
    const startTime = Date.now();
    let connected = false;
    let messagesReceived = 0;
    let pingPongCount = 0;
    
    // Connection timeout (30 seconds)
    const connectionTimeout = setTimeout(() => {
      if (!connected) {
        log('error', 'Connection timeout - no response from server after 30s');
        ws.close(1008, 'Test timeout');
        reject(new Error('Connection timeout'));
      }
    }, 30000);
    
    const ws = new WebSocket(fullUrl, {
      headers: {
        'Origin': 'https://ai-chat-two-ecru.vercel.app',
      },
      handshakeTimeout: 30000,
    });
    
    ws.on('open', () => {
      connected = true;
      const connectionTime = Date.now() - startTime;
      clearTimeout(connectionTimeout);
      log('success', `Connected in ${connectionTime}ms`);
      
      // Send initial ping
      ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    });
    
    ws.on('message', (data) => {
      messagesReceived++;
      try {
        const message = JSON.parse(data.toString());
        log('info', `Received: ${JSON.stringify(message)}`);
        
        if (message.type === 'pong') {
          pingPongCount++;
          log('success', `Ping-pong successful (${pingPongCount})`);
          
          // Send another ping after 5 seconds
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
            }
          }, 5000);
        }
        
        if (message.type === 'connected') {
          log('success', 'Server confirmed connection');
        }
        
        // After 3 successful ping-pongs, consider test passed
        if (pingPongCount >= 3) {
          log('success', 'Test passed - WebSocket is working correctly');
          ws.close(1000, 'Test completed successfully');
          resolve({
            success: true,
            connectionTime,
            messagesReceived,
            pingPongCount,
          });
        }
      } catch (err) {
        log('warn', `Received non-JSON message: ${data}`);
      }
    });
    
    ws.on('ping', () => {
      log('info', 'Received server ping, sending pong');
      ws.pong();
    });
    
    ws.on('pong', () => {
      log('info', 'Received server pong');
    });
    
    ws.on('close', (code, reason) => {
      const duration = Date.now() - startTime;
      log('info', `Connection closed: code=${code}, reason=${reason}, duration=${duration}ms`);
      
      if (!connected && code === 1006) {
        log('error', 'Abnormal closure (1006) - This is the error we are trying to fix!');
        log('error', 'Possible causes:');
        log('error', '  1. AWS App Runner load balancer closing connection');
        log('error', '  2. Socket timeout on server side');
        log('error', '  3. Proxy/firewall interference');
        log('error', '  4. Session not found in Redis');
        reject(new Error(`Abnormal closure (1006) - ${reason}`));
      } else if (code !== 1000 && code !== 1001) {
        reject(new Error(`Connection closed with code ${code}: ${reason}`));
      }
    });
    
    ws.on('error', (error) => {
      log('error', `WebSocket error: ${error.message}`);
      clearTimeout(connectionTimeout);
      reject(error);
    });
  });
}

async function runTests() {
  const args = process.argv.slice(2);
  const url = args[0] || 'wss://2rrfaahu3d.ap-south-1.awsapprunner.com';
  const sessionId = args[1] || `test-${Date.now()}`;
  
  console.log(`${colors.bright}========================================`);
  console.log('AWS App Runner WebSocket Test');
  console.log('========================================' + colors.reset);
  
  // Test 1: Health check endpoint
  log('info', 'Test 1: Checking health endpoint...');
  try {
    const healthUrl = url.replace('wss://', 'https://').replace('/terminal/', '/').replace(/\/terminal$/, '');
    const response = await fetch(`${healthUrl}/health`);
    const data = await response.json();
    log('success', `Health check passed: ${JSON.stringify(data)}`);
  } catch (err) {
    log('error', `Health check failed: ${err.message}`);
  }
  
  // Test 2: WebSocket test endpoint
  log('info', 'Test 2: Testing WebSocket /ws-test endpoint...');
  try {
    const wsTestUrl = url.replace(/\/terminal\/.*$/, '/ws-test');
    await testWebSocket(wsTestUrl, 'test-session');
    log('success', 'WebSocket test endpoint passed');
  } catch (err) {
    log('error', `WebSocket test endpoint failed: ${err.message}`);
  }
  
  // Test 3: Terminal endpoint with session
  log('info', 'Test 3: Testing terminal endpoint...');
  try {
    await testWebSocket(url, sessionId);
    log('success', 'Terminal endpoint test passed');
  } catch (err) {
    log('error', `Terminal endpoint test failed: ${err.message}`);
  }
  
  console.log(`${colors.bright}========================================`);
  console.log('Test Summary');
  console.log('========================================' + colors.reset);
}

runTests().catch(err => {
  log('error', `Test suite failed: ${err.message}`);
  process.exit(1);
});
