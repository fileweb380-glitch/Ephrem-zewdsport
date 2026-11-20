const cloudinary = require('../config/cloudinary');
const Product = require('../models/Product');

const deleteCloudinaryFile = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Failed to delete image from Cloudinary:', err.message);
  }
};

const parseOptionalPrice = (rawPrice) => {
  if (rawPrice === undefined || rawPrice === null || String(rawPrice).trim() === '') {
    return null;
  }
  const num = Number(rawPrice);
  if (!Number.isFinite(num) || num < 0) {
    return NaN;
  }
  return num;
};

// @desc    Get all public products
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
  try {
    const { search, category, stockStatus, featured } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (category && category !== 'All') {
      query.category = category;
    }

    if (stockStatus) {
      query.stockStatus = stockStatus;
    }

    if (featured !== undefined) {
      query.featured = featured === 'true';
    }

    const products = await Product.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
};

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.status(200).json({ success: true, product });
  } catch (error) {
    console.error('Get product by ID error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get single product by slug
// @route   GET /api/products/slug/:slug
// @access  Public
const getProductBySlug = async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.status(200).json({ success: true, product });
  } catch (error) {
    console.error('Get product by slug error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create product
// @route   POST /api/admin/products
// @access  Private (Admin)
const createProduct = async (req, res) => {
  try {
    const { name, description, price, category, sizes, stockStatus, featured } = req.body;

    if (!name || !description || !category) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    const parsedPrice = parseOptionalPrice(price);
    if (Number.isNaN(parsedPrice)) {
      return res.status(400).json({ success: false, message: 'Price must be a valid non-negative number' });
    }

    let images = [];
    if (req.files && req.files.length > 0) {
      images = req.files.map((file) => ({
        url: file.path,
        public_id: file.filename
      }));
    }

    let parsedSizes = sizes;
    if (typeof sizes === 'string') {
      parsedSizes = sizes.split(',').map((s) => s.trim()).filter(Boolean);
    }

    const product = await Product.create({
      name,
      description,
      price: parsedPrice,
      currency: 'ETB',
      category,
      images,
      sizes: parsedSizes && parsedSizes.length > 0 ? parsedSizes : ['S', 'M', 'L', 'XL'],
      stockStatus: stockStatus || 'In Stock',
      featured: featured === 'true' || featured === true
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error creating product' });
  }
};

// @desc    Update product
// @route   PUT /api/admin/products/:id
// @access  Private (Admin)
const updateProduct = async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const { name, description, price, category, sizes, stockStatus, featured, existingImages } = req.body;

    let updatedImages = [];
    if (existingImages) {
      if (typeof existingImages === 'string') {
        try {
          updatedImages = JSON.parse(existingImages);
        } catch (e) {
          updatedImages = [{ url: existingImages, public_id: '' }];
        }
      } else if (Array.isArray(existingImages)) {
        updatedImages = existingImages;
      }
    } else {
      updatedImages = product.images;
    }

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        updatedImages.push({
          url: file.path,
          public_id: file.filename
        });
      }
    }

    const keptPublicIds = updatedImages.map((img) => img.public_id);
    for (const oldImg of product.images) {
      if (oldImg.public_id && !keptPublicIds.includes(oldImg.public_id)) {
        await deleteCloudinaryFile(oldImg.public_id);
      }
    }

    let parsedSizes = sizes;
    if (typeof sizes === 'string') {
      parsedSizes = sizes.split(',').map((s) => s.trim()).filter(Boolean);
    }

    const updateData = {
      name: name || product.name,
      description: description || product.description,
      category: category || product.category,
      currency: 'ETB',
      images: updatedImages,
      sizes: parsedSizes && parsedSizes.length > 0 ? parsedSizes : product.sizes,
      stockStatus: stockStatus || product.stockStatus,
      featured: featured !== undefined ? (featured === 'true' || featured === true) : product.featured
    };

    if (price !== undefined) {
      const parsedPrice = parseOptionalPrice(price);
      if (Number.isNaN(parsedPrice)) {
        return res.status(400).json({ success: false, message: 'Price must be a valid non-negative number' });
      }
      updateData.price = parsedPrice;
    }

    if (name && name !== product.name) {
      const baseSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      updateData.slug = `${baseSlug || 'product'}-${suffix}`;
    }

    product = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error updating product' });
  }
};

// @desc    Delete product
// @route   DELETE /api/admin/products/:id
// @access  Private (Admin)
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (product.images && product.images.length > 0) {
      for (const img of product.images) {
        if (img.public_id) {
          await deleteCloudinaryFile(img.public_id);
        }
      }
    }

    await product.deleteOne();

    res.status(200).json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting product' });
  }
};

module.exports = {
  getProducts,
  getProductById,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct
};
