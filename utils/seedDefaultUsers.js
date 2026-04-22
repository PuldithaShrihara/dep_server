const bcrypt = require('bcryptjs');
const User = require('../models/User');

/** Same accounts as createAllUsers.js plus a read-only User demo — weak passwords; dev / internal use only. */
const DEFAULT_ACCOUNTS = [
    { 
        username: 'sadmin', 
        password: 'admin123456', 
        role: 'Admin', 
        department: null, 
        fullName: 'Super Administrator' 
    },
    { 
        username: 'sysadmin', 
        password: 'sysadmin123', 
        role: 'Admin', 
        department: null, 
        fullName: 'System Administrator' 
    }
];

async function seedDefaultUsers() {
    const summary = { createdOrUpdated: 0, errors: [] };

    for (const u of DEFAULT_ACCOUNTS) {
        try {
            const hashedPassword = await bcrypt.hash(u.password, 10);
            await User.findOneAndUpdate(
                { username: u.username },
                { 
                    $set: {
                        password: hashedPassword,
                        role: u.role,
                        department: u.department,
                        fullName: u.fullName || u.username,
                        status: 'Active'
                    }
                },
                { upsert: true, returnDocument: 'after' }
            );
            summary.createdOrUpdated += 1;
        } catch (err) {
            summary.errors.push({ username: u.username, message: err.message });
        }
    }

    return summary;
}


module.exports = { seedDefaultUsers, DEFAULT_ACCOUNTS };
