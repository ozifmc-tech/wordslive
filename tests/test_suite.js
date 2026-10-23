const http = require('http');
const path = require('path');
const ioClient = require('socket.io-client');

// Use a dedicated test database
process.env.DB_PATH = path.join(__dirname, 'test_wisdom.db');
process.env.PORT = '3999';

const { app, server } = require('../server/index');
const { stmts } = require('../server/db');

let baseUrl = 'http://localhost:3999';
let user1Token = '';
let user2Token = '';
let user1Data = null;
let user2Data = null;
let conversationId = '';

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
    throw new Error(`Test failed: ${message}`);
  }
}

async function request(endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 WISDOM DICTIONARY & SECRET CHAT TEST SUITE');
  console.log('======================================================\n');

  // Start test server
  await new Promise((resolve) => server.listen(3999, resolve));
  console.log('📡 Test server started on port 3999\n');

  const runId = Math.floor(Math.random() * 90000 + 10000);
  const email1 = `laylo_${runId}@gmail.com`;
  const username1 = `laylo_${runId}`;
  const email2 = `jasur_${runId}@gmail.com`;
  const username2 = `jasur_${runId}`;

  try {
    // ----------------------------------------------------
    // TEST 1: Dictionary search & retrieval
    // ----------------------------------------------------
    console.log('📚 Test Group 1: Dictionary Functionality');
    {
      const res = await request('/api/dictionary/search?q=achieve');
      assert(res.ok && res.data.success, 'Dictionary search API returns 200 OK');
      assert(res.data.words.length > 0, 'Found word "achieve"');
      assert(res.data.words[0].translation.includes('erishmoq'), 'Translation matches accurately');
    }

    // ----------------------------------------------------
    // TEST 2: Gmail OTP Request & Cooldown
    // ----------------------------------------------------
    console.log('\n📧 Test Group 2: Gmail OTP Verification & Resilience');
    let otpCode1 = '';
    {
      const res = await request('/api/auth/send-otp', {
        method: 'POST',
        body: { email: email1 }
      });
      if (!res.ok) {
        console.error('send-otp failed details:', res.status, res.data);
      }
      assert(res.ok && res.data.success, 'OTP requested successfully');
      assert(res.data.devCode && res.data.devCode.length === 6, '6-digit OTP code generated and received');
      otpCode1 = res.data.devCode;

      // Test cooldown (requesting again immediately should return 429)
      const resCooldown = await request('/api/auth/send-otp', {
        method: 'POST',
        body: { email: email1 }
      });
      assert(resCooldown.status === 429, 'Rate limiting / cooldown prevents spamming OTP');
    }

    // ----------------------------------------------------
    // TEST 3: Invalid & Valid OTP Verification
    // ----------------------------------------------------
    console.log('\n🔑 Test Group 3: OTP Code Validation');
    {
      // Invalid code test
      const resInvalid = await request('/api/auth/verify-otp', {
        method: 'POST',
        body: { email: email1, code: '000000' }
      });
      assert(resInvalid.status === 400, 'Invalid OTP code is rejected with 400');

      // Valid code test
      const resValid = await request('/api/auth/verify-otp', {
        method: 'POST',
        body: { email: email1, code: otpCode1 }
      });
      assert(resValid.ok && resValid.data.success, 'Valid OTP code accepted');
      assert(resValid.data.isNewUser === true, 'Identified as new user requiring profile creation');
    }

    // ----------------------------------------------------
    // TEST 4: Username validation & Registration
    // ----------------------------------------------------
    console.log('\n👤 Test Group 4: Username Uniqueness & Registration');
    {
      // Check username availability
      const checkRes = await request(`/api/auth/check-username?username=${username1}`);
      assert(checkRes.data.available === true, `Username @${username1} is available`);

      // Register profile for user 1 (Laylo)
      const regRes = await request('/api/auth/register-profile', {
        method: 'POST',
        body: {
          email: email1,
          username: username1,
          displayName: 'Laylo Aliyeva',
          bio: 'Ingliz tilini o\'rganuvchi'
        }
      });
      if (!regRes.ok) {
        console.error('Registration failed details:', regRes.status, regRes.data);
      }
      assert(regRes.ok && regRes.data.success, 'Profile registered successfully');
      assert(Boolean(regRes.data.token), 'JWT authentication token received');
      user1Token = regRes.data.token;
      user1Data = regRes.data.user;
      assert(user1Data.username === username1, 'Username stored properly');

      // Attempt duplicate username registration with another email
      // 1. Get OTP for user 2
      const resOtp2 = await request('/api/auth/send-otp', {
        method: 'POST',
        body: { email: email2 }
      });
      assert(resOtp2.ok, 'OTP sent for second user');
      const otpCode2 = resOtp2.data.devCode;

      // 2. Verify OTP for user 2
      const resVerify2 = await request('/api/auth/verify-otp', {
        method: 'POST',
        body: { email: email2, code: otpCode2 }
      });
      assert(resVerify2.ok, 'Second user OTP verified');

      // 3. Try to take already taken username
      const duplicateRes = await request('/api/auth/register-profile', {
        method: 'POST',
        body: {
          email: email2,
          username: username1, // duplicate!
          displayName: 'Ali'
        }
      });
      assert(duplicateRes.status === 409, `Duplicate username @${username1} is rejected with 409 Conflict`);

      // 4. Register with unique username
      const reg2Res = await request('/api/auth/register-profile', {
        method: 'POST',
        body: {
          email: email2,
          username: username2,
          displayName: 'Jasur Bek',
          bio: 'Dasturchi'
        }
      });
      assert(reg2Res.ok && reg2Res.data.success, `Second user registered successfully with @${username2}`);
      user2Token = reg2Res.data.token;
      user2Data = reg2Res.data.user;
    }

    // ----------------------------------------------------
    // TEST 5: User Search & Profile Verification
    // ----------------------------------------------------
    console.log('\n🔍 Test Group 5: User Search by @nik');
    {
      // User 2 searches for User 1
      const searchRes = await request(`/api/chat/search-users?q=${username1}`, {
        headers: { Authorization: `Bearer ${user2Token}` }
      });
      assert(searchRes.ok && searchRes.data.users.length === 1, `Found user by @${username1}`);
      assert(searchRes.data.users[0].username === username1, 'Search result matches user 1');
      assert(searchRes.data.users[0].displayName === 'Laylo Aliyeva', 'Display name matches');
    }

    // ----------------------------------------------------
    // TEST 6: Conversation Creation & HTTP Messaging
    // ----------------------------------------------------
    console.log('\n💬 Test Group 6: Conversation & Message Storage');
    {
      // Create conversation between user 2 and user 1
      const convRes = await request('/api/chat/conversations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${user2Token}` },
        body: { partnerUsername: username1 }
      });
      assert(convRes.ok && convRes.data.success, 'Conversation created/retrieved');
      conversationId = convRes.data.conversation.id;

      // Send message via HTTP REST
      const msgRes = await request(`/api/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user2Token}` },
        body: { text: 'Salom, darslaring qanday ketyapti?' }
      });
      assert(msgRes.ok && msgRes.data.success, 'Message sent successfully');
      assert(msgRes.data.message.text === 'Salom, darslaring qanday ketyapti?', 'Message text matches');

      // User 1 retrieves message history
      const historyRes = await request(`/api/chat/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${user1Token}` }
      });
      assert(historyRes.ok && historyRes.data.messages.length === 1, 'Message received in history');
      assert(historyRes.data.messages[0].senderId === user2Data.id, 'Sender is user 2');
    }

    // ----------------------------------------------------
    // TEST 7: Real-time WebSocket Messaging (Socket.io)
    // ----------------------------------------------------
    console.log('\n⚡ Test Group 7: Real-Time WebSocket Communication');
    {
      const client1 = ioClient(baseUrl, {
        auth: { token: user1Token },
        transports: ['websocket']
      });

      const client2 = ioClient(baseUrl, {
        auth: { token: user2Token },
        transports: ['websocket']
      });

      await new Promise((resolve) => {
        let connectedCount = 0;
        client1.on('connect', () => { if (++connectedCount === 2) resolve(); });
        client2.on('connect', () => { if (++connectedCount === 2) resolve(); });
      });
      assert(true, 'Both WebSocket clients connected with JWT authentication');

      // Join conversation room with ack
      await new Promise((resolve) => client1.emit('join_conversation', { conversationId }, resolve));
      await new Promise((resolve) => client2.emit('join_conversation', { conversationId }, resolve));

      // Test real-time message sending from client 1 to client 2
      const receivedPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('WebSocket message timeout')), 5000);
        client2.on('new_message', (msg) => {
          clearTimeout(timeout);
          resolve(msg);
        });
      });

      // Client 1 sends message
      client1.emit('send_message', {
        conversationId,
        text: 'Hammasi yaxshi, lug\'atdan yangi so\'zlar yodlayapman ❤️'
      });

      const receivedMsg = await receivedPromise;
      assert(receivedMsg.text === 'Hammasi yaxshi, lug\'atdan yangi so\'zlar yodlayapman ❤️', 'Real-time WebSocket message received instantly');
      assert(receivedMsg.senderId === user1Data.id, 'Sender matches User 1');

      // Disconnect socket clients
      client1.disconnect();
      client2.disconnect();
    }

    // ----------------------------------------------------
    // TEST 8: File Download Auth via ?token= Query Param
    // ----------------------------------------------------
    console.log('\n📥 Test Group 8: File Download Auth with ?token=');
    {
      // Create a dummy test file in public/uploads if needed
      const fs = require('fs');
      const testUploadsDir = path.join(__dirname, '../public/uploads');
      if (!fs.existsSync(testUploadsDir)) fs.mkdirSync(testUploadsDir, { recursive: true });
      const testFileName = `test_doc_${Date.now()}.txt`;
      const testFilePath = path.join(testUploadsDir, testFileName);
      fs.writeFileSync(testFilePath, 'WordsLive Secret File Content 123');

      // Request without token -> should fail 401
      const noTokenRes = await fetch(`${baseUrl}/api/chat/download/${testFileName}`);
      assert(noTokenRes.status === 401, 'Download without token is blocked with 401 Unauthorized');

      // Request with ?token= -> should succeed 200
      const tokenRes = await fetch(`${baseUrl}/api/chat/download/${testFileName}?token=${user1Token}`);
      if (tokenRes.status !== 200) {
        const errBody = await tokenRes.text();
        console.error('DOWNLOAD ERROR STATUS:', tokenRes.status, 'BODY:', errBody);
      }
      assert(tokenRes.status === 200, 'Download with ?token= succeeds with 200 OK');
      const downloadedText = await tokenRes.text();
      assert(downloadedText.includes('WordsLive Secret File Content 123'), 'Downloaded file content matches');

      // Clean up test file
      try { fs.unlinkSync(testFilePath); } catch (_) {}
    }

    // ----------------------------------------------------
    // TEST 9: Account Deletion & Username Recycling
    // ----------------------------------------------------
    console.log('\n🗑️ Test Group 9: Complete Account Deletion & Username Recycling');
    {
      // User 2 deletes their account
      const delRes = await fetch(`${baseUrl}/api/auth/delete-account`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user2Token}`,
          'Content-Type': 'application/json'
        }
      });
      const delData = await delRes.json();
      assert(delRes.status === 200 && delData.success, 'User 2 account deleted successfully');

      // User 2's old token is now invalidated
      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${user2Token}` }
      });
      assert(meRes.status === 401, 'Deleted user token is rejected with 401');

      const targetNik = user2Data.username;

      // Check if User 2's old username is now available again!
      const checkRes = await fetch(`${baseUrl}/api/auth/check-username?username=${targetNik}`);
      const checkData = await checkRes.json();
      assert(checkData.available === true, `Username @${targetNik} is completely freed and available again`);

      // A brand new user (User 3) registers with that freed username
      const user3Email = `new_${targetNik}@gmail.com`;
      await fetch(`${baseUrl}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user3Email })
      });
      const stmts = require('../server/db').stmts;
      const user3Otp = stmts.getLatestOtp.get(user3Email);
      await fetch(`${baseUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user3Email, code: user3Otp.code })
      });

      const regUser3Res = await fetch(`${baseUrl}/api/auth/register-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user3Email,
          username: targetNik,
          displayName: 'Yangi Jasur'
        })
      });
      const regUser3Data = await regUser3Res.json();
      assert((regUser3Res.status === 200 || regUser3Res.status === 201) && regUser3Data.success, `New user successfully claimed previously freed username @${targetNik}`);
    }

    console.log('\n======================================================');
    console.log(`🎉 ALL TESTS PASSED! (${passCount} passed, ${failCount} failed)`);
    console.log('======================================================\n');

  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err.message);
  } finally {
    server.close(() => {
      // Clean up test DB file
      try {
        const fs = require('fs');
        const testDbPath = path.join(__dirname, 'test_wisdom.db');
        if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
        if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
        if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
      } catch (_) {}
      process.exit(failCount > 0 ? 1 : 0);
    });
  }
}

runTests();
