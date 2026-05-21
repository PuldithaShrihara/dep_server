const mongoose = require('mongoose');

// Need to read MONGO_URI from env or hardcode?
// Let's check config.js or something similar in server folder
const fs = require('fs');
console.log(fs.readFileSync('.env', 'utf8'));
