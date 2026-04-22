require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function showCredentials() {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not defined in .env file');
        }

        console.log('Connecting to MongoDB Atlas...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✓ Connected to MongoDB Atlas successfully\n');

        const users = await User.find().sort({ role: 1, username: 1 });
        
        console.log('═'.repeat(100));
        console.log('USER CREDENTIALS - DEPARTMENT PLAN MONITORING SYSTEM');
        console.log('═'.repeat(100));
        console.log('');

        if (users.length === 0) {
            console.log('No users found in the system.');
        } else {
            // Group by role
            const adminUsers = users.filter(u => u.role === 'Admin');
            const managerUsers = users.filter(u => u.role === 'Manager');

            if (adminUsers.length > 0) {
                console.log('🔐 ADMIN USERS (Full Access - Can Edit All Departments)');
                console.log('─'.repeat(100));
                adminUsers.forEach((user, index) => {
                    console.log(`${index + 1}. Username: ${user.username.padEnd(20)} | Password: ${getPassword(user.username)} | Role: ${user.role}`);
                });
                console.log('');
            }

            if (managerUsers.length > 0) {
                // Separate department managers from view-only users
                const deptManagers = managerUsers.filter(u => u.department);
                const viewOnlyUsers = managerUsers.filter(u => !u.department);
                
                if (deptManagers.length > 0) {
                    console.log('👤 DEPARTMENT MANAGERS (Can Edit Own Department, View All)');
                    console.log('─'.repeat(100));
                    deptManagers.forEach((user, index) => {
                        console.log(`${index + 1}. Username: ${user.username.padEnd(20)} | Password: ${getPassword(user.username)} | Department: ${user.department}`);
                    });
                    console.log('');
                }
                
                if (viewOnlyUsers.length > 0) {
                    console.log('👁️  VIEW-ONLY USERS (View All Departments, Cannot Edit)');
                    console.log('─'.repeat(100));
                    viewOnlyUsers.forEach((user, index) => {
                        console.log(`${index + 1}. Username: ${user.username.padEnd(20)} | Password: ${getPassword(user.username)} | Access: View Only`);
                    });
                    console.log('');
                }
            }

            console.log('═'.repeat(100));
            console.log(`Total Users: ${users.length}`);
            console.log('═'.repeat(100));
        }

        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error('✗ Error:', err.message);
        process.exit(1);
    }
}

function getPassword(username) {
    const passwords = {
        'admin': 'admin123',
        'admin1': 'admin1234',
        'markadmin': 'mark123',
        'finadmin': 'fin123',
        'radadmin': 'rad123',
        'admadmin': 'adm123',
        'proadmin': 'pro123',
        'user': 'user123'
    };
    return passwords[username] || '******';
}

showCredentials();
