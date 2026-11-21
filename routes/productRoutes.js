const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct
} = require('../controllers/productController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');


const uploadProductImages = (req, res, next) => {
  upload.array('images', 5)(req, res, (err) => {
    if (err) {
      // Print the real upload error in Render logs
      console.error('========== IMAGE UPLOAD ERROR ==========');
      console.error('Error name:', err.name);
      console.error('Error message:', err.message);
      console.error('HTTP status:', err.http_code);
      console.error('Cloudinary error:', err.error?.message);
      console.error('=========================================');

      return res.status(400).json({
        success: false,
        message: err.message || 'Image upload failed'
      });
    }

    next();
  });
};


router.get('/', getProducts);
router.get('/slug/:slug', getProductBySlug);
router.get('/:id', getProductById);

router.post('/', protect, uploadProductImages, createProduct);
router.put('/:id', protect, uploadProductImages, updateProduct);
router.delete('/:id', protect, deleteProduct);

module.exports = router;