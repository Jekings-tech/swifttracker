const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Get the URI directly from environment
        const mongoURI = process.env.MONGODB_URI;
        if (!mongoURI) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }
        
        console.log('Attempting to connect to MongoDB...');
        await mongoose.connect(mongoURI);
        console.log('✅ MongoDB Atlas Connected Successfully');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        // Exit the process immediately so Render knows it failed
        process.exit(1);
    }
};

module.exports = connectDB;