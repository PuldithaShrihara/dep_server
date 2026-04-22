const mongoose = require('mongoose');
require('dotenv').config();
const HrArea = require('./models/HrArea');
const HrTask = require('./models/HrTask');
const { seedHrEntities } = require('./utils/seedHrEntities');

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        const areaCount = await HrArea.countDocuments();
        const taskCount = await HrTask.countDocuments();
        console.log(`Areas: ${areaCount}, Tasks: ${taskCount}`);
        
        if (areaCount === 0) {
            console.log('Forcing seed...');
            await seedHrEntities();
            const newAreaCount = await HrArea.countDocuments();
            const newTaskCount = await HrTask.countDocuments();
            console.log(`New Counts - Areas: ${newAreaCount}, Tasks: ${newTaskCount}`);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.connection.close();
    }
}

check();
