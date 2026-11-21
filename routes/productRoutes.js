
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

// Public routes
router.get('/', getProducts);
router.get('/slug/:slug', getProductBySlug);
router.get('/:id', getProductById);

// Admin: Create product
router.post(
  '/',
  protect,
  upload.array('images', 5),
  createProduct
);

// Admin: Update product
router.put(
  '/:id',
  protect,
  upload.array('images', 5),
  updateProduct
);

// Admin: Delete product
router.delete(
  '/:id',
  protect,
  deleteProduct
);

module.exports = router;
