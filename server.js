

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const { initializeGridFS } = require('./config/gridfs');

dotenv.config();

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: false
}));

app.use(cors());

app.use(express.json({
  limit: '10mb'
}));

app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});

app.use('/api/', limiter);

// API routes
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/admin/products', require('./routes/productRoutes'));
app.use('/api/products', require('./routes/productRoutes'));

// Home route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Zewd Sportwear API is running successfully.'
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server Error'
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Initialize GridFS
    initializeGridFS();

    // 3. Start Express
    app.listen(PORT, () => {
      console.log(
        `Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`
      );
    });

  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
};

startServer();
