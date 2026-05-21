const mongoose = require('mongoose');

const uri = 'mongodb+srv://fadna_admin_new:adminnew123@cluster0.ykd60i8.mongodb.net/department_monitoring?retryWrites=true&w=majority';

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to DB');
    const db = mongoose.connection.db;
    const plans = await db.collection('plans').find().toArray();
    
    for (const plan of plans) {
        if (plan.tasks) {
            for (const task of plan.tasks) {
                if (task.product === 'ghgghghghgh' || task.assets === 'SATINY') {
                    console.log('Task found:', JSON.stringify(task, null, 2));
                }
            }
        }
    }
    
    mongoose.disconnect();
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
