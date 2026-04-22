require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function createAdmin() {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not defined in .env file');
        }

        console.log('Connecting to MongoDB Atlas...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✓ Connected to MongoDB Atlas successfully\n');

        const username = 'admin';
        const password = 'admin123';
        const role = 'Admin';

        // Check if user exists
        let user = await User.findOne({ username });

        if (user) {
            // Update existing user's password
            const hashedPassword = await bcrypt.hash(password, 10);
            user.password = hashedPassword;
            user.role = role;
            await user.save();
            console.log(`✓ Updated existing user: ${username}`);
            console.log(`  Username: ${username}`);
            console.log(`  Password: ${password}`);
            console.log(`  Role: ${role}`);
        } else {
            // Create new user
            const hashedPassword = await bcrypt.hash(password, 10);
            user = await User.create({
                username,
                password: hashedPassword,
                role
            });
            console.log(`✓ Created new user: ${username}`);
            console.log(`  Username: ${username}`);
            console.log(`  Password: ${password}`);
            console.log(`  Role: ${role}`);
        }

        console.log('\n✓ Admin user is ready to use!');
        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error('✗ Error:', err.message);
        process.exit(1);
    }
}

createAdmin();
