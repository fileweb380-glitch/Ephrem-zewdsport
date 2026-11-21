
const mongoose = require('mongoose');

let bucket;

const initializeGridFS = () => {
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error('MongoDB must be connected before initializing GridFS');
  }

  bucket = new mongoose.mongo.GridFSBucket(db, {
    bucketName: 'productImages'
  });

  console.log('MongoDB GridFS initialized successfully.');
};

const getGridFSBucket = () => {
  if (!bucket) {
    throw new Error('GridFS has not been initialized yet.');
  }

  return bucket;
};

module.exports = {
  initializeGridFS,
  getGridFSBucket
};
