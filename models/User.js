const mongoose = require('mongoose');

const ROLE_VALUES = ['Admin', 'DepartmentHead', 'User', 'Manager', 'DeptHead'];

const userSchema = new mongoose.Schema(
    {
        fullName: { type: String, default: '', trim: true },
        username: { type: String, required: true, unique: true, trim: true },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            sparse: true,
            unique: true,
            default: undefined
        },
        password: { type: String, required: true },
        role: { type: String, enum: ROLE_VALUES, required: true },
        department: { type: String, trim: true, default: null },
        status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
    },
    { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
