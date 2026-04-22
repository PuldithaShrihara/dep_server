require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function verifyUsers() {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not defined in .env file');
        }

        console.log('Connecting to MongoDB Atlas...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✓ Connected to MongoDB Atlas successfully\n');

        // Verify users exist and can authenticate
        const users = [
            { username: 'admin', password: 'admin123' },
            { username: 'admin1', password: 'admin1234' }
        ];

        console.log('Verifying users and authentication...\n');
        console.log('═'.repeat(80));

        for (const userCred of users) {
            const user = await User.findOne({ username: userCred.username });
            
            if (user) {
                // Test password verification
                const isPasswordValid = await bcrypt.compare(userCred.password, user.password);
                
                console.log(`\nUser: ${userCred.username}`);
                console.log('─'.repeat(80));
                console.log(`  ✓ User exists in database`);
                console.log(`  ✓ Username: ${user.username}`);
                console.log(`  ✓ Role: ${user.role}`);
                console.log(`  ✓ Password valid: ${isPasswordValid ? 'YES' : 'NO'}`);
                console.log(`  ✓ Created: ${user.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A'}`);
                
                if (!isPasswordValid) {
                    console.log(`  ⚠ WARNING: Password does not match! Updating...`);
                    const hashedPassword = await bcrypt.hash(userCred.password, 10);
                    user.password = hashedPassword;
                    await user.save();
                    console.log(`  ✓ Password updated successfully`);
                }
            } else {
                console.log(`\n✗ User ${userCred.username} NOT FOUND - Creating...`);
                const hashedPassword = await bcrypt.hash(userCred.password, 10);
                await User.create({
                    username: userCred.username,
                    password: hashedPassword,
                    role: 'Admin'
                });
                console.log(`  ✓ User created successfully`);
            }
        }

        console.log('\n' + '═'.repeat(80));
        console.log('\n✓ All users verified and ready for authentication!');
        console.log('\nUsers can now:');
        console.log('  - Login with their credentials');
        console.log('  - Access all departments');
        console.log('  - Create and manage plans');

        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error('✗ Error:', err.message);
        process.exit(1);
    }
}

verifyUsers();
