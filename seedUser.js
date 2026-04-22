require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        const exists = await User.findOne({ username: 'admin' });
        if (!exists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await User.create({
                username: 'admin',
                password: hashedPassword,
                role: 'Admin'
            });
            console.log('Admin user seeded: admin / admin123');
        } else {
            console.log('Admin user already exists');
        }

        mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
};

seedAdmin();
