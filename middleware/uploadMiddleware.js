const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
    params: async (req, file) => {
        const baseName = file.originalname
              .replace(/\.[^/.]+$/, '')
                    .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                                .replace(/(^-|-$)+/g, '');

                                    return {
                                          folder: 'zewd-sportwear/products',
                                                allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
                                                      public_id: `${baseName || 'jersey'}-${Date.now()}`
                                                          };
                                                            }
                                                            });

                                                            const fileFilter = (req, file, cb) => {
                                                              if (file.mimetype && file.mimetype.startsWith('image/')) {
                                                                  cb(null, true);
                                                                    } else {
                                                                        cb(new Error('Not an image! Please upload only image files.'), false);
                                                                          }
                                                                          };

                                                                          const upload = multer({
                                                                            storage: storage,
                                                                              limits: {
                                                                                  fileSize: 5 * 1024 * 1024
                                                                                    },
                                                                                      fileFilter: fileFilter
                                                                                      });

                                                                                      module.exports = upload;
                                                                                      