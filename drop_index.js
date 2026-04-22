const mongoose = require('mongoose');
const Plan = require('./models/Plan');

mongoose.connect('mongodb://localhost:27017/department_db', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(async () => {
        console.log('Connected to MongoDB');
        try {
            await mongoose.connection.db.collection('plans').dropIndex('title_1');
            console.log('Dropped title index');
        } catch (err) {
            console.log('Index might not exist or already dropped:', err.message);
        }
        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
