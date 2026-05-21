const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function testPost() {
    try {
        const form = new FormData();
        form.append('name', 'Test Product ' + Date.now());
        form.append('description', 'A test product');
        form.append('category', 'Fadna');
        
        // Use the plan and department we found earlier
        form.append('planId', '6a0eb8a25ad655c28cfb7111'); 
        form.append('departmentId', '69e8730b23665ef8fa2e47c7');
        
        // Write a dummy image
        fs.writeFileSync('dummy.png', 'dummy image data');
        form.append('image', fs.createReadStream('dummy.png'));

        // Assume there is an admin token we can use, or just bypass auth locally if we have to?
        // Wait, the route has authMiddleware. Let's just create a token.
        const jwt = require('jsonwebtoken');
        require('dotenv').config();
        const token = jwt.sign({ userId: '69e8730b23665ef8fa2e47c7', role: 'admin' }, process.env.JWT_SECRET || 'fallback');

        console.log("Sending request...");
        const response = await axios.post('http://localhost:5000/api/products', form, {
            headers: {
                ...form.getHeaders(),
                Authorization: `Bearer ${token}`
            }
        });
        
        console.log("Response:", response.data);
    } catch (err) {
        console.error("Error:", err.response ? err.response.data : err.message);
    }
}
testPost();
