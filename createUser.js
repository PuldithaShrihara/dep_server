require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function createUser() {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not defined in .env file');
        }

        console.log('Connecting to MongoDB Atlas...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✓ Connected to MongoDB Atlas successfully\n');

        const username = 'admin1';
        const password = 'admin1234';
        const role = 'Admin';

        // Check if user already exists
        const existingUser = await User.findOne({ username });

        if (existingUser) {
            // Update existing user's password
            const hashedPassword = await bcrypt.hash(password, 10);
            existingUser.password = hashedPassword;
            existingUser.role = role;
            await existingUser.save();
            console.log(`✓ Updated existing user: ${username}`);
        } else {
            // Create new user
            const hashedPassword = await bcrypt.hash(password, 10);
            await User.create({
                username,
                password: hashedPassword,
                role
            });
            console.log(`✓ Created new user: ${username}`);
        }

        console.log(`\nUser Details:`);
        console.log(`  Username: ${username}`);
        console.log(`  Password: ${password}`);
        console.log(`  Role: ${role}`);
        console.log(`\n✓ User is ready to use!`);

        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error('✗ Error:', err.message);
        if (err.code === 11000) {
            console.error('  User already exists with this username');
        }
        process.exit(1);
    }
}

createUser();
