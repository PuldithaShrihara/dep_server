const mongoose = require('mongoose');

const resignedEmployeeEntrySchema = new mongoose.Schema(
    {
        month: { type: Number, required: true, min: 1, max: 12, index: true },
        year: { type: Number, required: true, min: 2000, max: 2100, index: true },

        fullName: { type: String, required: true, trim: true },
        department: { type: String, default: '', trim: true },

        // Tracking the 6 core clearance functions
        tasks: {
            exitInterview: { type: String, default: 'Pending' },
            resignationLetter: { type: String, default: 'Pending' },
            acceptanceLetter: { type: String, default: 'Pending' },
            serviceLetter: { type: String, default: 'Pending' },
            clearanceForm: { type: String, default: 'Pending' },
            documentHandover: { type: String, default: 'Pending' }
        },

        observedById: { type: mongoose.Schema.Types.ObjectId, ref: 'HrMember', default: null },
        observedByName: { type: String, default: '', trim: true },
        remarks: { type: String, default: '', trim: true },
        completed: { type: Boolean, default: false }
    },
    { timestamps: true }
);

module.exports = mongoose.model('ResignedEmployeeEntry', resignedEmployeeEntrySchema);
