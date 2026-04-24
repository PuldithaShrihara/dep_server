require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const departmentRoutes = require('./routes/departments');
const planRoutes = require('./routes/plans');
const userRoutes = require('./routes/users');
const hrRoutes = require('./routes/hr');
const insuranceRoutes = require('./routes/insurance');
const resignedEmployeeRoutes = require('./routes/resignedEmployees');
const newEmployeesRoutes = require('./routes/newEmployees');
const { DEPARTMENT_NAMES } = require('./constants/departments');
const { seedHrEntities } = require('./utils/seedHrEntities');
const { seedDefaultUsers } = require('./utils/seedDefaultUsers');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/users', userRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/resigned-employees', resignedEmployeeRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/new-employees', newEmployeesRoutes);
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Serve static files from the React app
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// Handle React routing, return all requests to React app
app.use((req, res) => {
    // If it's an API request that wasn't caught by the routes above, return 404
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ message: 'API route not found' });
    }
    // Otherwise serve index.html
    res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Initial seeding of departments
async function seedDepartments() {
    try {
        const Department = require('./models/Department');

        for (const name of DEPARTMENT_NAMES) {
            const exists = await Department.findOne({ name });
            if (!exists) {
                await Department.create({ name, description: `${name} Department` });
                console.log(`Seeded department: ${name}`);
            }
        }
    } catch (err) {
        console.error('Error seeding departments:', err);
    }
}

// Handle MongoDB connection events
mongoose.connection.on('connected', () => {
    console.log('✓ MongoDB connection established');
});

mongoose.connection.on('error', (err) => {
    console.error('✗ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠ MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
    console.log('✓ MongoDB reconnected');
});

// Database Connection and Server Startup
async function startServer() {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not defined in .env file');
        }
        if (!process.env.JWT_SECRET || String(process.env.JWT_SECRET).trim() === '') {
            throw new Error(
                'JWT_SECRET must be set in your .env file. Without it, login tokens cannot be verified. ' +
                'If you change JWT_SECRET later, everyone must log in again.'
            );
        }

        const buildNonSrvMongoUri = (uri) => {
            if (!uri || typeof uri !== 'string') return uri;
            if (!uri.startsWith('mongodb+srv://')) return uri;

            const nonSrv = uri.replace(/^mongodb\+srv:\/\//, 'mongodb://');
            const afterProtocol = nonSrv.replace(/^mongodb:\/\//, '');
            const slashIdx = afterProtocol.indexOf('/');

            const authority = slashIdx === -1 ? afterProtocol : afterProtocol.slice(0, slashIdx);
            const rest = slashIdx === -1 ? '' : afterProtocol.slice(slashIdx);

            const atIdx = authority.lastIndexOf('@');
            if (atIdx !== -1) {
                const creds = authority.slice(0, atIdx);
                const host = authority.slice(atIdx + 1);
                const hostWithPort = host.includes(':') ? host : `${host}:27017`;
                return `mongodb://${creds}@${hostWithPort}${rest}`;
            }

            const hostWithPort = authority.includes(':') ? authority : `${authority}:27017`;
            return `mongodb://${hostWithPort}${rest}`;
        };

        const connectOpts = {
            serverSelectionTimeoutMS: 10000, // Increased for stability
            socketTimeoutMS: 45000,         // Robust socket timeout
            connectTimeoutMS: 10000,
            heartbeatFrequencyMS: 10000      // Keep connection alive
        };

        const primaryUri = process.env.MONGO_URI;
        const nonSrvUri = buildNonSrvMongoUri(primaryUri);
        const localFallbackUri = process.env.MONGO_URI_LOCAL || process.env.MONGO_FALLBACK_URI;

        const candidates = [
            { uri: primaryUri, label: 'MongoDB Atlas (SRV)' },
            ...(nonSrvUri && nonSrvUri !== primaryUri
                ? [{ uri: nonSrvUri, label: 'MongoDB Atlas (non-SRV fallback)' }]
                : []),
            ...(localFallbackUri && localFallbackUri !== primaryUri && localFallbackUri !== nonSrvUri
                ? [{ uri: localFallbackUri, label: 'Local Mongo fallback' }]
                : [])
        ];

        let connectedLabel = '';
        let lastErr = null;
        for (const candidate of candidates) {
            try {
                console.log(`Connecting to ${candidate.label}...`);
                await mongoose.connect(candidate.uri, connectOpts);
                connectedLabel = candidate.label;
                break;
            } catch (err) {
                lastErr = err;
                const msg = String(err?.message || err);
                console.warn(`Connection failed for ${candidate.label}: ${msg}`);
            }
        }

        if (!connectedLabel) {
            throw lastErr || new Error('Could not connect to any configured MongoDB URI');
        }

        console.log(`✓ Connected to ${connectedLabel} successfully`);

        // Seed departments after connection
        await seedDepartments();
        await seedDefaultUsers();
        await seedHrEntities();

        // Start server only after database connection
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => {
            console.log(`✓ Server running on port ${PORT}`);
        });
    } catch (err) {
        console.error('✗ Failed to start server:', err.message);
        console.error('Error details:', err);
        process.exit(1);
    }
}

// Start the server
startServer();
