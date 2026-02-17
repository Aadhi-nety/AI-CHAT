/**
 * Comprehensive WebSocket Testing Script
 * Tests all endpoints against AWS App Runner deployment
 */

const https = require('https');
const WebSocket = require('ws');

const BASE_URL = '2rrfaahu3d.ap-south-1.awsapprunner.com';
const HTTP_URL = `https://${BASE_URL}`;
const WS_URL = `wss://${BASE_URL}`;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

// Test 1: Health Endpoint
async function testHealth() {
  logSection('TEST 1: Health Endpoint');
  
  return new Promise((resolve) => {
    const req = https.get(`${HTTP_URL}/health`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          log(`Status: ${result.status}`, result.status === 'ok' ? 'green' : 'red');
          log(`WebSocket: ${result.websocket}`, 'blue');
          log(`Endpoints: ${JSON.stringify(result.endpoints)}`, 'blue');
          log(`Timestamp: ${result.timestamp}`, 'blue');
          resolve({ success: true, data: result });
        } catch (e) {
          log(`Error parsing response: ${e.message}`, 'red');
          resolve({ success: false, error: e.message });
        }
      });
    });
    
    req.on('error', (err) => {
      log(`Request failed: ${err.message}`, 'red');
      resolve({ success: false, error: err.message });
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      log('Health check timeout', 'red');
      resolve({ success: false, error: 'Timeout' });
    });
  });
}

// Test 2: WebSocket Diagnostics
async function testDiagnostics() {
  logSection('TEST 2: WebSocket Diagnostics Endpoint');
  
  return new Promise((resolve) => {
    const req = https.get(`${HTTP_URL}/api/diagnostics/websocket`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          log(`Status: ${result.status}`, result.status === 'ok' ? 'green' : 'red');
          log(`WebSocket Endpoints:`, 'blue');
          result.websocketEndpoints.forEach(ep => {
            log(`  - ${ep.path}: ${ep.description}`, 'blue');
          });
          log(`CORS Origins: ${result.corsOrigins.length} allowed`, 'blue');
          log(`Connection Timeout: ${result.connectionTimeout}ms`, 'blue');
          log(`Active Sessions: ${result.activeSessions}`, 'blue');
          log(`Server Info: ${JSON.stringify(result.serverInfo)}`, 'blue');
          resolve({ success: true, data: result });
        } catch (e) {
          log(`Error parsing response: ${e.message}`, 'red');
          resolve({ success: false, error: e.message });
        }
      });
    });
    
    req.on('error', (err) => {
      log(`Request failed: ${err.message}`, 'red');
      resolve({ success: false, error: err.message });
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      log('Diagnostics check timeout', 'red');
      resolve({ success: false, error: 'Timeout' });
    });
  });
}

// Test 3: WebSocket Test Endpoint
async function testWebSocketEcho() {
  logSection('TEST 3: WebSocket Test Endpoint (/ws-test)');
  
  return new Promise((resolve) => {
    const ws = new WebSocket(`${WS_URL}/ws-test`);
    const startTime = Date.now();
    let messageReceived = false;
    
    ws.on('open', () => {
      log('WebSocket connected', 'green');
      log(`Connection time: ${Date.now() - startTime}ms`, 'blue');
      
      // Send test message
      const testMessage = { type: 'test', message: 'Hello from client', timestamp: Date.now() };
      ws.send(JSON.stringify(testMessage));
      log('Sent test message', 'blue');
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        log(`Received: ${JSON.stringify(message)}`, 'green');
        
        if (message.type === 'connected') {
          log('Server welcome message received', 'blue');
        } else if (message.type === 'echo') {
          messageReceived = true;
          log('Echo response received', 'green');
          log(`Round-trip time: ${Date.now() - message.received.timestamp}ms`, 'blue');
          
          // Close connection after echo
          setTimeout(() => {
            ws.close(1000, 'Test complete');
          }, 500);
        }
      } catch (e) {
        log(`Error parsing message: ${e.message}`, 'red');
      }
    });
    
    ws.on('error', (err) => {
      log(`WebSocket error: ${err.message}`, 'red');
      resolve({ success: false, error: err.message });
    });
    
    ws.on('close', (code, reason) => {
      log(`WebSocket closed: ${code} ${reason}`, code === 1000 ? 'green' : 'yellow');
      resolve({ success: messageReceived, code, messageReceived });
    });
    
    // Timeout after 15 seconds
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1008, 'Test timeout');
        log('Test timeout - closing connection', 'yellow');
      }
    }, 15000);
  });
}

// Test 4: WebSocket Connection with Invalid Session
async function testInvalidSession() {
  logSection('TEST 4: WebSocket with Invalid Session');
  
  return new Promise((resolve) => {
    const ws = new WebSocket(`${WS_URL}/terminal/invalid-session-id`);
    let errorReceived = false;
    let closeCode = null;
    
    ws.on('open', () => {
      log('Connected (unexpected for invalid session)', 'yellow');
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        log(`Received: ${JSON.stringify(message)}`, 'blue');
        
        if (message.type === 'error') {
          errorReceived = true;
          log(`Error message received: ${message.message}`, 'green');
        }
      } catch (e) {
        log(`Error parsing message: ${e.message}`, 'red');
      }
    });
    
    ws.on('error', (err) => {
      log(`WebSocket error: ${err.message}`, 'red');
    });
    
    ws.on('close', (code, reason) => {
      closeCode = code;
      log(`WebSocket closed: ${code} ${reason}`, code === 4000 ? 'green' : 'yellow');
      
      if (code === 4000) {
        log('Correct close code for invalid session (4000)', 'green');
      } else if (code === 1006) {
        log('ERROR: Got 1006 (abnormal closure) - this is the issue we are fixing!', 'red');
      }
      
      resolve({ 
        success: errorReceived && code === 4000, 
        code, 
        errorReceived,
        got1006: code === 1006
      });
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }, 10000);
  });
}

// Test 5: Long-running connection (idle timeout test)
async function testIdleTimeout() {
  logSection('TEST 5: Idle Timeout Test (3 minutes)');
  
  return new Promise((resolve) => {
    const ws = new WebSocket(`${WS_URL}/ws-test`);
    const startTime = Date.now();
    let pingCount = 0;
    let lastActivity = Date.now();
    
    ws.on('open', () => {
      log('WebSocket connected for idle test', 'green');
      log('Will keep connection open for 3 minutes...', 'blue');
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        lastActivity = Date.now();
        
        if (message.type === 'ping') {
          pingCount++;
          log(`Ping #${pingCount} received from server`, 'blue');
          ws.send(JSON.stringify({ type: 'pong' }));
          log('Pong sent', 'blue');
        } else if (message.type === 'pong') {
          log('Pong received from server', 'blue');
        }
      } catch (e) {
        log(`Error: ${e.message}`, 'red');
      }
    });
    
    ws.on('error', (err) => {
      log(`WebSocket error: ${err.message}`, 'red');
    });
    
    ws.on('close', (code, reason) => {
      const duration = Date.now() - startTime;
      log(`Connection closed after ${Math.floor(duration / 1000)}s: ${code} ${reason}`, 
        code === 1000 ? 'green' : 'yellow');
      
      resolve({
        success: duration > 180000, // Should stay open for 3+ minutes
        duration,
        code,
        pingCount
      });
    });
    
    // Send periodic messages to keep connection alive
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ 
          type: 'keepalive', 
          timestamp: Date.now(),
          elapsed: Date.now() - startTime
        }));
      }
    }, 30000); // Every 30 seconds
    
    // End test after 3 minutes
    setTimeout(() => {
      clearInterval(interval);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Idle test complete');
      }
    }, 180000); // 3 minutes
  });
}

// Run all tests
async function runTests() {
  log('COMPREHENSIVE WEBSOCKET TEST SUITE', 'cyan');
  log(`Target: ${BASE_URL}`, 'blue');
  log(`Started: ${new Date().toISOString()}`, 'blue');
  
  const results = {
    health: await testHealth(),
    diagnostics: await testDiagnostics(),
    websocketEcho: await testWebSocketEcho(),
    invalidSession: await testInvalidSession(),
    // idleTimeout: await testIdleTimeout() // Uncomment for 3-min test
  };
  
  logSection('TEST SUMMARY');
  
  let allPassed = true;
  for (const [test, result] of Object.entries(results)) {
    const status = result.success ? '✓ PASS' : '✗ FAIL';
    const color = result.success ? 'green' : 'red';
    log(`${test}: ${status}`, color);
    if (!result.success) allPassed = false;
  }
  
  logSection('FINAL RESULT');
  if (allPassed) {
    log('✓ ALL TESTS PASSED', 'green');
    log('WebSocket error 1006 appears to be resolved!', 'green');
  } else {
    log('✗ SOME TESTS FAILED', 'red');
    log('Review the logs above for details', 'yellow');
  }
  
  // Check specifically for 1006 errors
  if (results.invalidSession.got1006) {
    log('\n⚠ WARNING: Still receiving 1006 errors!', 'red');
    log('The fix may not be complete or App Runner may have limitations', 'yellow');
  } else {
    log('\n✓ No 1006 errors detected', 'green');
  }
  
  log(`\nCompleted: ${new Date().toISOString()}`, 'blue');
}

// Run tests
runTests().catch(err => {
  log(`Test suite error: ${err.message}`, 'red');
  process.exit(1);
});
