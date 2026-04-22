require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function showUserDetails() {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not defined in .env file');
        }

        console.log('Connecting to MongoDB Atlas...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✓ Connected to MongoDB Atlas successfully\n');

        const users = await User.find().sort({ role: 1, username: 1 });
        
        console.log('═'.repeat(120));
        console.log('COMPLETE USER INFORMATION - DEPARTMENT PLAN MONITORING SYSTEM');
        console.log('═'.repeat(120));
        console.log('');

        if (users.length === 0) {
            console.log('No users found in the system.');
        } else {
            // Group by role
            const adminUsers = users.filter(u => u.role === 'Admin');
            const managerUsers = users.filter(u => u.role === 'Manager');
            const deptManagers = managerUsers.filter(u => u.department);
            const viewOnlyUsers = managerUsers.filter(u => !u.department);

            // Admin Users
            if (adminUsers.length > 0) {
                console.log('🔐 ADMIN USERS');
                console.log('═'.repeat(120));
                adminUsers.forEach((user, index) => {
                    console.log(`\n${index + 1}. USERNAME: ${user.username}`);
                    console.log(`   Password: ${getPassword(user.username)}`);
                    console.log(`   Role: ${user.role}`);
                    console.log(`   Department: All Departments`);
                    console.log(`   Access Level: FULL ACCESS`);
                    console.log(`   Permissions:`);
                    console.log(`     ✓ View all departments`);
                    console.log(`     ✓ Create plans for any department`);
                    console.log(`     ✓ Edit plans for any department`);
                    console.log(`     ✓ Delete plans from any department`);
                    console.log(`   Created: ${user.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A'}`);
                });
                console.log('');
            }

            // Department Managers
            if (deptManagers.length > 0) {
                console.log('👤 DEPARTMENT MANAGERS');
                console.log('═'.repeat(120));
                deptManagers.forEach((user, index) => {
                    console.log(`\n${index + 1}. USERNAME: ${user.username}`);
                    console.log(`   Password: ${getPassword(user.username)}`);
                    console.log(`   Role: ${user.role}`);
                    console.log(`   Assigned Department: ${user.department}`);
                    console.log(`   Access Level: DEPARTMENT-SPECIFIC EDIT ACCESS`);
                    console.log(`   Permissions:`);
                    console.log(`     ✓ View all departments (read-only)`);
                    console.log(`     ✓ Create plans for ${user.department} department`);
                    console.log(`     ✓ Edit plans for ${user.department} department`);
                    console.log(`     ✓ Delete plans from ${user.department} department`);
                    console.log(`     ✗ Cannot edit other departments`);
                    console.log(`   Created: ${user.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A'}`);
                });
                console.log('');
            }

            // View-Only Users
            if (viewOnlyUsers.length > 0) {
                console.log('👁️  VIEW-ONLY USERS');
                console.log('═'.repeat(120));
                viewOnlyUsers.forEach((user, index) => {
                    console.log(`\n${index + 1}. USERNAME: ${user.username}`);
                    console.log(`   Password: ${getPassword(user.username)}`);
                    console.log(`   Role: ${user.role}`);
                    console.log(`   Department: None`);
                    console.log(`   Access Level: VIEW-ONLY (READ-ONLY)`);
                    console.log(`   Permissions:`);
                    console.log(`     ✓ View all departments`);
                    console.log(`     ✓ View all plans`);
                    console.log(`     ✗ Cannot create plans`);
                    console.log(`     ✗ Cannot edit plans`);
                    console.log(`     ✗ Cannot delete plans`);
                    console.log(`   Created: ${user.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A'}`);
                });
                console.log('');
            }

            // Summary
            console.log('═'.repeat(120));
            console.log('SUMMARY');
            console.log('═'.repeat(120));
            console.log(`Total Users: ${users.length}`);
            console.log(`  - Admin Users: ${adminUsers.length}`);
            console.log(`  - Department Managers: ${deptManagers.length}`);
            console.log(`  - View-Only Users: ${viewOnlyUsers.length}`);
            console.log('');
            console.log('Access Levels:');
            console.log('  🔐 Admin: Full access to create, edit, delete plans for all departments');
            console.log('  👤 Department Manager: Can edit own department, view all departments');
            console.log('  👁️  View-Only: Can only view all departments, cannot make any changes');
            console.log('═'.repeat(120));
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

showUserDetails();
