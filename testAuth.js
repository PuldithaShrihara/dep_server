require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testAuthentication() {
    console.log('Testing User Authentication System\n');
    console.log('═'.repeat(80));

    // Test users
    const testUsers = [
        { username: 'admin', password: 'admin123' },
        { username: 'admin1', password: 'admin1234' }
    ];

    for (const testUser of testUsers) {
        console.log(`\nTesting login for: ${testUser.username}`);
        console.log('─'.repeat(80));

        try {
            // Test Login
            const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
                username: testUser.username,
                password: testUser.password
            });

            if (loginRes.data.token && loginRes.data.user) {
                console.log(`✓ Login successful`);
                console.log(`  Token: ${loginRes.data.token.substring(0, 20)}...`);
                console.log(`  User: ${loginRes.data.user.username}`);
                console.log(`  Role: ${loginRes.data.user.role}`);

                // Test Access to Departments
                const token = loginRes.data.token;
                try {
                    const deptRes = await axios.get(`${BASE_URL}/departments`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    console.log(`✓ Department access successful`);
                    console.log(`  Found ${deptRes.data.length} departments`);
                    deptRes.data.forEach(dept => {
                        console.log(`    - ${dept.name}`);
                    });
                } catch (deptErr) {
                    console.log(`✗ Department access failed: ${deptErr.response?.data?.message || deptErr.message}`);
                }

            } else {
                console.log(`✗ Login failed: Invalid response`);
            }
        } catch (err) {
            console.log(`✗ Login failed: ${err.response?.data?.message || err.message}`);
        }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('Authentication test completed');
}

// Check if server is running
axios.get(`${BASE_URL.replace('/api', '')}`)
    .then(() => {
        console.log('Server is running, starting tests...\n');
        testAuthentication();
    })
    .catch(() => {
        console.log('⚠ Server is not running. Please start the server first with: npm start');
        console.log('Then run this test again.\n');
        process.exit(1);
    });
