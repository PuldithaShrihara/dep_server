const mongoose = require('mongoose');
require('dotenv').config({path: './.env'});

mongoose.connect(process.env.MONGO_URI).then(async () => {
    try {
        const Plan = require('./models/Plan');
        const plans = await Plan.find({});
        
        let campaignsFound = 0;
        let subtasksFound = 0;
        let durationsToUpdate = 0;
        let skippedMissing = 0;
        let skippedInvalid = 0;
        let duplicateDurationsSkip = 0;

        for (const plan of plans) {
            let planChanged = false;

            for (const task of plan.tasks) {
                if (task._isSubtask) {
                    subtasksFound++;
                } else {
                    campaignsFound++;
                }

                if (!task.startDate || !task.endDate) {
                    skippedMissing++;
                    continue;
                }

                const [sYear, sMonth, sDay] = task.startDate.split('-');
                const [eYear, eMonth, eDay] = task.endDate.split('-');
                
                if (sYear && sMonth && sDay && eYear && eMonth && eDay) {
                    const start = Date.UTC(parseInt(sYear, 10), parseInt(sMonth, 10) - 1, parseInt(sDay, 10));
                    const end = Date.UTC(parseInt(eYear, 10), parseInt(eMonth, 10) - 1, parseInt(eDay, 10));
                    
                    if (end < start) {
                        skippedInvalid++;
                        continue;
                    }
                    
                    const diffTime = Math.abs(end - start);
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    const calculatedDuration = diffDays === 1 ? '1 day' : `${diffDays} days`;
                    
                    if (task.duration !== calculatedDuration) {
                        task.duration = calculatedDuration;
                        planChanged = true;
                        durationsToUpdate++;
                    } else {
                        duplicateDurationsSkip++; // Already has correct duration
                    }
                } else {
                    skippedInvalid++;
                }
            }

            if (planChanged) {
                await plan.save();
            }
        }

        console.log(`Update Report:`);
        console.log(`- Parent campaigns found: ${campaignsFound}`);
        console.log(`- Subtasks found: ${subtasksFound}`);
        console.log(`- Durations updated: ${durationsToUpdate}`);
        console.log(`- Rows skipped (missing dates): ${skippedMissing}`);
        console.log(`- Rows skipped (invalid dates): ${skippedInvalid}`);
        console.log(`- Rows skipped (already correct): ${duplicateDurationsSkip}`);
        
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
});
