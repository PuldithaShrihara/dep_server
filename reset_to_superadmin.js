require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function resetToSuperAdmin() {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not defined in .env file');
        }

        console.log('Connecting to MongoDB Atlas...');
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000,
        });
        console.log('✓ Connected successfully\n');

        // 1. Delete all existing users
        console.log('Cleaning up existing users...');
        const deleteResult = await User.deleteMany({});
        console.log(`✓ Removed ${deleteResult.deletedCount} users.\n`);

        // 2. Create the Super Admin
        const username = 'sadmin';
        const password = 'admin123456';
        const role = 'Admin';
        const fullName = 'Super Administrator';

        console.log(`Creating Super Admin: ${username}...`);
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await User.create({
            username,
            password: hashedPassword,
            role,
            fullName,
            department: null, // Admin has access to all departments
            status: 'Active'
        });

        console.log('═'.repeat(50));
        console.log('SUPER ADMIN CREATED SUCCESSFULLY');
        console.log('═'.repeat(50));
        console.log(`Username: ${username}`);
        console.log(`Password: ${password}`);
        console.log(`Role:     ${role} (Full System Access)`);
        console.log('═'.repeat(50));
        console.log('\nYou can now use these credentials to log in and manage the system.');

        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error('✗ Error:', err.message);
        process.exit(1);
    }
}

resetToSuperAdmin();
