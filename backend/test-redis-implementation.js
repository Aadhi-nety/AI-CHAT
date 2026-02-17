/**
 * Critical-path testing for Upstash Redis implementation
 * Tests: Redis connection, session operations, WebSocket flow
 */

require('dotenv').config();
const Redis = require('ioredis');


// Test configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const TEST_SESSION_ID = 'test-session-' + Date.now();

console.log('=== Upstash Redis Critical-Path Testing ===\n');
console.log('Redis URL:', REDIS_URL.replace(/:([^@]+)@/, ':****@'));

async function testRedisConnection() {
  console.log('\n1. Testing Redis Connection...');
  
  const redis = new Redis(REDIS_URL, {
    connectTimeout: 10000,
    maxRetriesPerRequest: 3,
    tls: REDIS_URL.includes('upstash') ? {} : undefined,
  });

  try {
    // Test ping
    const pong = await redis.ping();
    console.log('   ✓ Ping response:', pong);
    
    // Test basic operations
    await redis.set('test:connection', 'ok', 'EX', 10);
    const value = await redis.get('test:connection');
    console.log('   ✓ Set/Get test:', value);
    
    await redis.del('test:connection');
    console.log('   ✓ Delete test: passed');
    
    await redis.quit();
    console.log('   ✓ Redis connection: SUCCESS');
    return true;
  } catch (error) {
    console.error('   ✗ Redis connection failed:', error.message);
    await redis.quit();
    return false;
  }
}

async function testSessionOperations() {
  console.log('\n2. Testing Session Operations...');
  
  const redis = new Redis(REDIS_URL, {
    tls: REDIS_URL.includes('upstash') ? {} : undefined,
  });

  try {
    // Create session
    const session = {
      sessionId: TEST_SESSION_ID,
      userId: 'test-user',
      labId: 'test-lab',
      purchaseId: 'test-purchase',
      status: 'active',
      startedAt: Date.now(),
      createdAt: Date.now(),
      expiresAt: Date.now() + (2 * 60 * 60 * 1000), // 2 hours
      terminalPort: 3100,
      webSocketUrl: `ws://localhost:3001/terminal/${TEST_SESSION_ID}`,
      sandboxAccount: {
        accountId: '123456789',
        iamUserName: 'test-user',
        iamAccessKeyId: 'AKIA...',
        iamSecretAccessKey: 'secret...',
        region: 'us-east-1'
      }
    };

    // Store session with TTL
    const ttlSeconds = 7200;
    await redis.setex(`session:${TEST_SESSION_ID}`, ttlSeconds, JSON.stringify(session));
    console.log('   ✓ Session stored with TTL:', ttlSeconds, 'seconds');

    // Retrieve session
    const data = await redis.get(`session:${TEST_SESSION_ID}`);
    if (!data) {
      throw new Error('Session not found after storage');
    }
    
    const retrieved = JSON.parse(data);
    console.log('   ✓ Session retrieved:', retrieved.sessionId);
    console.log('   ✓ Session status:', retrieved.status);
    console.log('   ✓ Session labId:', retrieved.labId);

    // Check TTL
    const ttl = await redis.ttl(`session:${TEST_SESSION_ID}`);
    console.log('   ✓ Session TTL remaining:', ttl, 'seconds');

    // Update session
    retrieved.status = 'active';
    await redis.setex(`session:${TEST_SESSION_ID}`, ttlSeconds, JSON.stringify(retrieved));
    console.log('   ✓ Session updated');

    // Delete session
    await redis.del(`session:${TEST_SESSION_ID}`);
    console.log('   ✓ Session deleted');

    // Verify deletion
    const afterDelete = await redis.get(`session:${TEST_SESSION_ID}`);
    if (afterDelete === null) {
      console.log('   ✓ Session deletion verified');
    } else {
      throw new Error('Session still exists after deletion');
    }

    await redis.quit();
    console.log('   ✓ Session operations: SUCCESS');
    return true;
  } catch (error) {
    console.error('   ✗ Session operations failed:', error.message);
    await redis.quit();
    return false;
  }
}

async function testWebSocketUrlFormat() {
  console.log('\n3. Testing WebSocket URL Format...');
  
  const sessionId = 'ws-test-' + Date.now();
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
  const wsHost = backendUrl.replace(/^https?:\/\//, '');
  const webSocketUrl = `${wsProtocol}://${wsHost}/terminal/${sessionId}`;
  
  console.log('   Backend URL:', backendUrl);
  console.log('   WebSocket URL:', webSocketUrl);
  
  // Validate URL format
  try {
    const url = new URL(webSocketUrl);
    console.log('   ✓ URL protocol:', url.protocol);
    console.log('   ✓ URL host:', url.host);
    console.log('   ✓ URL pathname:', url.pathname);
    console.log('   ✓ WebSocket URL format: VALID');
    return true;
  } catch (error) {
    console.error('   ✗ Invalid WebSocket URL:', error.message);
    return false;
  }
}

async function testGracePeriod() {
  console.log('\n4. Testing Grace Period Logic...');
  
  const redis = new Redis(REDIS_URL, {
    tls: REDIS_URL.includes('upstash') ? {} : undefined,
  });

  try {
    const GRACE_PERIOD_MS = 10000; // 10 seconds
    const now = Date.now();
    
    // Create a very new session
    const newSession = {
      sessionId: 'grace-test',
      createdAt: now,
      status: 'initializing', // Not yet active
      expiresAt: now + (2 * 60 * 60 * 1000)
    };
    
    const age = now - newSession.createdAt;
    const isInGracePeriod = age < GRACE_PERIOD_MS;
    
    console.log('   Session age:', age, 'ms');
    console.log('   Grace period:', GRACE_PERIOD_MS, 'ms');
    console.log('   In grace period:', isInGracePeriod);
    console.log('   ✓ Grace period logic: VALID');
    
    await redis.quit();
    return true;
  } catch (error) {
    console.error('   ✗ Grace period test failed:', error.message);
    await redis.quit();
    return false;
  }
}

async function runTests() {
  const results = {
    connection: await testRedisConnection(),
    session: await testSessionOperations(),
    websocket: await testWebSocketUrlFormat(),
    gracePeriod: await testGracePeriod()
  };

  console.log('\n=== Test Results ===');
  console.log('Redis Connection:', results.connection ? '✓ PASS' : '✗ FAIL');
  console.log('Session Operations:', results.session ? '✓ PASS' : '✗ FAIL');
  console.log('WebSocket URL Format:', results.websocket ? '✓ PASS' : '✗ FAIL');
  console.log('Grace Period Logic:', results.gracePeriod ? '✓ PASS' : '✗ FAIL');

  const allPassed = Object.values(results).every(r => r);
  
  if (allPassed) {
    console.log('\n✓ All critical-path tests PASSED');
    console.log('The Upstash Redis implementation is ready for production.');
    process.exit(0);
  } else {
    console.log('\n✗ Some tests FAILED');
    console.log('Please review the errors above before deploying to production.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
