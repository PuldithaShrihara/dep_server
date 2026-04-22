require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function createViewOnlyUser() {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not defined in .env file');
        }

        console.log('Connecting to MongoDB Atlas...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✓ Connected to MongoDB Atlas successfully\n');

        const username = 'user';
        const password = 'user123';
        const role = 'Manager'; // Manager role but no department = view-only

        // Check if user exists
        let user = await User.findOne({ username });

        if (user) {
            // Update existing user
            const hashedPassword = await bcrypt.hash(password, 10);
            user.password = hashedPassword;
            user.role = role;
            user.department = null; // No department = view-only access
            await user.save();
            console.log(`✓ Updated existing user: ${username}`);
        } else {
            // Create new user
            const hashedPassword = await bcrypt.hash(password, 10);
            user = await User.create({
                username,
                password: hashedPassword,
                role,
                department: null // No department = view-only access
            });
            console.log(`✓ Created new user: ${username}`);
        }

        console.log(`\nUser Details:`);
        console.log(`  Username: ${username}`);
        console.log(`  Password: ${password}`);
        console.log(`  Role: ${role}`);
        console.log(`  Department: None (View-only access)`);
        console.log(`\n✓ View-only user is ready!`);
        console.log(`  This user can view all departments but cannot create, edit, or delete plans.`);

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

createViewOnlyUser();
