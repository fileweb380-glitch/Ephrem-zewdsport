
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

const syncAdminKey = async () => {
  const envKey = process.env.ADMIN_KEY;

  if (!envKey) {
    console.warn('Warning: ADMIN_KEY is not set in .env');
    return;
  }

  let admin = await Admin.findOne({ role: 'admin' }).select('+password');

  if (!admin) {
    await Admin.create({
      role: 'admin',
      password: envKey
    });

    console.log('Admin key initialized and hashed in MongoDB.');
  } else {
    const isSame = await admin.matchPassword(envKey);

    if (!isSame) {
      admin.password = envKey;
      await admin.save();

      console.log('Admin key updated and hashed in MongoDB.');
    }
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    await syncAdminKey();

    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
