const mongoose = require('mongoose');

const NewEmployeeEntrySchema = new mongoose.Schema(
    {
        month: { type: Number, required: true, min: 1, max: 12, index: true },
        year: { type: Number, required: true, min: 2000, max: 2100, index: true },
        fullName: { type: String, default: '' },
        nameWithInitial: { type: String, default: '' },
        nic: { type: String, default: '' },
        dob: { type: String, default: '' },
        department: { type: String, default: '' },
        contactNo: { type: String, default: '' },
        remarks: { type: String, default: '' },
        sortOrder: { type: Number, default: 0 }
    },
    { timestamps: true }
);

NewEmployeeEntrySchema.index({ month: 1, year: 1, sortOrder: 1 });

module.exports = mongoose.model('NewEmployeeEntry', NewEmployeeEntrySchema);

