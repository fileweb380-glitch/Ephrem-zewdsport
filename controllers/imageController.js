
const mongoose = require('mongoose');
const { getGridFSBucket } = require('../config/gridfs');

const getImage = (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB image ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image ID'
      });
    }

    const bucket = getGridFSBucket();

    const fileId = new mongoose.Types.ObjectId(id);

    const downloadStream = bucket.openDownloadStream(fileId);

    downloadStream.on('file', (file) => {
      res.set('Content-Type', file.contentType || 'application/octet-stream');
      res.set('Content-Disposition', 'inline');
      res.set('Cache-Control', 'public, max-age=86400');
      res.set('X-Content-Type-Options', 'nosniff');
    });

    downloadStream.on('error', (error) => {
      console.error('Image retrieval error:', error.message);

      if (!res.headersSent) {
        res.status(404).json({
          success: false,
          message: 'Image not found'
        });
      } else {
        res.destroy(error);
      }
    });

    downloadStream.pipe(res);

  } catch (error) {
    console.error('Get image error:', error);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve image'
      });
    }
  }
};

module.exports = {
  getImage
};
