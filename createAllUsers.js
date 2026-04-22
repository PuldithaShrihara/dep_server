require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function createAllUsers() {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not defined in .env file');
        }

        console.log('Connecting to MongoDB Atlas...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✓ Connected to MongoDB Atlas successfully\n');

        // Define all users
        const users = [
            {
                username: 'admin',
                password: 'admin123',
                role: 'Admin',
                department: null,
                description: 'Full access to all departments'
            },
            {
                username: 'markadmin',
                password: 'mark123',
                role: 'Manager',
                department: 'Marketing',
                description: 'View only access for Marketing department'
            },
            {
                username: 'finadmin',
                password: 'fin123',
                role: 'Manager',
                department: 'Finance',
                description: 'View only access for Finance department'
            },
            {
                username: 'radadmin',
                password: 'rad123',
                role: 'Manager',
                department: 'R&D',
                description: 'View only access for R&D department'
            },
            {
                username: 'admadmin',
                password: 'adm123',
                role: 'Manager',
                department: 'Admin',
                description: 'View only access for Admin department'
            },
            {
                username: 'proadmin',
                password: 'pro123',
                role: 'Manager',
                department: 'Production',
                description: 'View only access for Production department'
            }
        ];

        console.log('Creating/Updating users...\n');
        console.log('═'.repeat(90));

        let createdCount = 0;
        let updatedCount = 0;

        for (const userData of users) {
            try {
                const existingUser = await User.findOne({ username: userData.username });

                const hashedPassword = await bcrypt.hash(userData.password, 10);

                if (existingUser) {
                    // Update existing user
                    existingUser.password = hashedPassword;
                    existingUser.role = userData.role;
                    existingUser.department = userData.department || undefined;
                    await existingUser.save();
                    updatedCount++;
                    console.log(`✓ Updated: ${userData.username.padEnd(15)} | ${userData.role.padEnd(10)} | ${(userData.department || 'All').padEnd(15)} | ${userData.description}`);
                } else {
                    // Create new user
                    await User.create({
                        username: userData.username,
                        password: hashedPassword,
                        role: userData.role,
                        department: userData.department
                    });
                    createdCount++;
                    console.log(`✓ Created: ${userData.username.padEnd(15)} | ${userData.role.padEnd(10)} | ${(userData.department || 'All').padEnd(15)} | ${userData.description}`);
                }
            } catch (err) {
                if (err.code === 11000) {
                    console.log(`⚠ Skipped: ${userData.username} (duplicate username)`);
                } else {
                    console.log(`✗ Error creating ${userData.username}: ${err.message}`);
                }
            }
        }

        console.log('═'.repeat(90));
        console.log(`\nSummary:`);
        console.log(`  Created: ${createdCount} user(s)`);
        console.log(`  Updated: ${updatedCount} user(s)`);
        console.log(`  Total: ${createdCount + updatedCount} user(s)`);

        // Display all users
        console.log('\n' + '═'.repeat(90));
        console.log('All Users in System:');
        console.log('═'.repeat(90));
        const allUsers = await User.find().select('-password').sort({ username: 1 });
        console.log(`${'Username'.padEnd(15)} | ${'Role'.padEnd(10)} | ${'Department'.padEnd(15)} | Created At`);
        console.log('─'.repeat(90));
        allUsers.forEach((user, index) => {
            const username = (user.username || 'N/A').padEnd(15);
            const role = (user.role || 'N/A').padEnd(10);
            const department = (user.department || 'All').padEnd(15);
            const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A';
            console.log(`${username} | ${role} | ${department} | ${createdAt}`);
        });
        console.log('═'.repeat(90));

        console.log('\n✓ All users created successfully!');
        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error('✗ Error:', err.message);
        process.exit(1);
    }
}

createAllUsers();
