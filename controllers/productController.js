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

const deleteUploadedFiles = async (files) => {
  if (!files || files.length === 0) return;

  for (const file of files) {
    await deleteCloudinaryFile(file.filename);
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

const parseSizes = (sizes) => {
  if (typeof sizes === 'string') {
    return sizes
      .split(',')
      .map((size) => size.trim())
      .filter(Boolean);
  }

  if (Array.isArray(sizes)) {
    return sizes.map((size) => String(size).trim()).filter(Boolean);
  }

  return undefined;
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const generateSlug = (name) => {
  const baseSlug = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  return `${baseSlug || 'product'}-${suffix}`;
};

const getProducts = async (req, res) => {
  try {
    const { search, category, stockStatus, featured } = req.query;
    const query = {};

    if (search) {
      const safeSearch = escapeRegex(search);

      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } }
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
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products'
    });
  }
};

const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Get product by ID error:', error);

    if (error.kind === 'ObjectId' || error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

const getProductBySlug = async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Get product by slug error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      sizes,
      stockStatus,
      featured
    } = req.body;

    if (!name || !description || !category) {
      await deleteUploadedFiles(req.files);

      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    const parsedPrice = parseOptionalPrice(price);

    if (Number.isNaN(parsedPrice)) {
      await deleteUploadedFiles(req.files);

      return res.status(400).json({
        success: false,
        message: 'Price must be a valid non-negative number'
      });
    }

    const images = req.files && req.files.length > 0
      ? req.files.map((file) => ({
          url: file.path,
          public_id: file.filename
        }))
      : [];

    const parsedSizes = parseSizes(sizes);

    const product = await Product.create({
      name,
      description,
      price: parsedPrice,
      currency: 'ETB',
      category,
      images,
      sizes: parsedSizes && parsedSizes.length > 0
        ? parsedSizes
        : ['S', 'M', 'L', 'XL'],
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
    await deleteUploadedFiles(req.files);

    res.status(500).json({
      success: false,
      message: error.message || 'Server error creating product'
    });
  }
};

const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      await deleteUploadedFiles(req.files);

      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const {
      name,
      description,
      price,
      category,
      sizes,
      stockStatus,
      featured,
      existingImages
    } = req.body;

    let parsedPrice;

    if (price !== undefined) {
      parsedPrice = parseOptionalPrice(price);

      if (Number.isNaN(parsedPrice)) {
        await deleteUploadedFiles(req.files);

        return res.status(400).json({
          success: false,
          message: 'Price must be a valid non-negative number'
        });
      }
    }

    let updatedImages = [];

    if (existingImages) {
      if (typeof existingImages === 'string') {
        try {
          const parsed = JSON.parse(existingImages);
          updatedImages = Array.isArray(parsed) ? parsed : [parsed];
        } catch (error) {
          updatedImages = [{
            url: existingImages,
            public_id: ''
          }];
        }
      } else if (Array.isArray(existingImages)) {
        updatedImages = existingImages;
      }
    } else {
      updatedImages = product.images.map((img) => ({
        url: img.url,
        public_id: img.public_id
      }));
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
    const imagesToDelete = product.images.filter(
      (oldImg) => oldImg.public_id && !keptPublicIds.includes(oldImg.public_id)
    );

    const parsedSizes = parseSizes(sizes);

    const updateData = {
      name: name || product.name,
      description: description || product.description,
      category: category || product.category,
      currency: 'ETB',
      images: updatedImages,
      sizes: parsedSizes && parsedSizes.length > 0
        ? parsedSizes
        : product.sizes,
      stockStatus: stockStatus || product.stockStatus,
      featured: featured !== undefined
        ? featured === 'true' || featured === true
        : product.featured
    };

    if (price !== undefined) {
      updateData.price = parsedPrice;
    }

    if (name && name !== product.name) {
      updateData.slug = generateSlug(name);
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    );

    for (const oldImg of imagesToDelete) {
      await deleteCloudinaryFile(oldImg.public_id);
    }

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product: updatedProduct
    });
  } catch (error) {
    console.error('Update product error:', error);
    await deleteUploadedFiles(req.files);

    if (error.kind === 'ObjectId' || error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Server error updating product'
    });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (product.images && product.images.length > 0) {
      for (const img of product.images) {
        if (img.public_id) {
          await deleteCloudinaryFile(img.public_id);
        }
      }
    }

    await product.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);

    if (error.kind === 'ObjectId' || error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error deleting product'
    });
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
