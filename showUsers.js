require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function showUsers() {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not defined in .env file');
        }

        console.log('Connecting to MongoDB Atlas...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✓ Connected to MongoDB Atlas successfully\n');

        const users = await User.find().select('-password').sort({ createdAt: -1 });
        
        if (users.length === 0) {
            console.log('No users found in the system.');
        } else {
            console.log(`Found ${users.length} user(s) in the system:\n`);
            console.log('═'.repeat(80));
            console.log(`${'Username'.padEnd(20)} | ${'Role'.padEnd(15)} | ${'Department'.padEnd(20)} | Created At`);
            console.log('═'.repeat(80));
            
            users.forEach((user, index) => {
                const username = (user.username || 'N/A').padEnd(20);
                const role = (user.role || 'N/A').padEnd(15);
                const department = (user.department || 'N/A').padEnd(20);
                const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A';
                
                console.log(`${username} | ${role} | ${department} | ${createdAt}`);
                
                if (index < users.length - 1) {
                    console.log('─'.repeat(80));
                }
            });
            
            console.log('═'.repeat(80));
            console.log(`\nTotal: ${users.length} user(s)`);
        }

        await mongoose.connection.close();
        console.log('\n✓ Connection closed');
        process.exit(0);
    } catch (err) {
        console.error('✗ Error:', err.message);
        process.exit(1);
    }
}

showUsers();
