const express = require('express');
const cors = require('cors');
const session = require('express-session');
require('dotenv').config();

const connectDB = require('./config/db');
const shipmentRoutes = require('./routes/shipmentRoutes');
const { validateLogin, generateToken } = require('./middleware/auth');

// ===== IMPORT EMAIL SERVICE =====
const emailService = require('./utils/email');

const app = express();
const PORT = process.env.PORT || 10000;

// Connect to MongoDB
connectDB();

// ===== CORS - ALLOW ALL ORIGINS =====
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200
}));

// ===== INCREASED PAYLOAD LIMIT FOR IMAGES =====
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(session({
    secret: process.env.JWT_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    }
}));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// ===== TEST EMAIL ROUTE =====
app.get('/api/test-email', async (req, res) => {
    try {
        const result = await emailService.sendTestEmail('menangjekings@gmail.com');
        if (result.success) {
            res.json({ 
                success: true, 
                message: '✅ Test email sent successfully! Check your inbox.' 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: result.error || 'Email sending failed' 
            });
        }
    } catch (error) {
        console.error('❌ Test email route error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Login route
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (validateLogin(username, password)) {
        const token = generateToken(username);
        req.session.user = { username, role: 'admin' };
        res.json({ 
            success: true, 
            token,
            user: { username, role: 'admin' }
        });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Logout route
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Check auth status
app.get('/api/auth/check', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true, user: req.session.user });
    } else {
        res.json({ authenticated: false });
    }
});

// Use shipment routes
app.use('/api/shipments', shipmentRoutes);

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📦 MongoDB: ${process.env.MONGODB_URI ? '✅ Connected' : '❌ Not configured'}`);
    console.log(`🔑 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔓 CORS: Allow ALL origins (any website can access this API)`);
    console.log(`📧 Email: ${process.env.BREVO_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
});