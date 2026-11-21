
const mongoose = require('mongoose');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

const Product = require('../models/Product');
const { getGridFSBucket } = require('../config/gridfs');

// Upload one image into MongoDB GridFS
const uploadImageToGridFS = async (file) => {
  const bucket = getGridFSBucket();

  const filename = file.originalname || `image-${Date.now()}`;

  const uploadStream = bucket.openUploadStream(filename, {
    contentType: file.mimetype,
    metadata: {
      uploadedAt: new Date(),
      originalName: filename
    }
  });

  try {
    await pipeline(
      Readable.from([file.buffer]),
      uploadStream
    );

    const fileId = uploadStream.id.toString();

    return {
      url: `/api/images/${fileId}`,
      fileId,
      filename,
      contentType: file.mimetype,
      public_id: ''
    };
  } catch (error) {
    // Remove an incomplete upload if one was created
    if (uploadStream.id) {
      try {
        await bucket.delete(uploadStream.id);
      } catch (deleteError) {
        console.error('Failed to clean incomplete image:', deleteError.message);
      }
    }

    throw error;
  }
};

// Upload multiple images
const uploadImages = async (files) => {
  const uploadedImages = [];

  try {
    for (const file of files || []) {
      const image = await uploadImageToGridFS(file);
      uploadedImages.push(image);
    }

    return uploadedImages;
  } catch (error) {
    await deleteGridFSImages(uploadedImages);
    throw error;
  }
};

// Delete only images stored in GridFS
const deleteGridFSImages = async (images) => {
  if (!images || images.length === 0) return;

  const bucket = getGridFSBucket();

  for (const image of images) {
    if (!image.fileId) continue;

    try {
      if (!mongoose.Types.ObjectId.isValid(image.fileId)) {
        continue;
      }

      await bucket.delete(
        new mongoose.Types.ObjectId(image.fileId)
      );

      console.log(`GridFS image deleted: ${image.fileId}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(
          `Failed to delete GridFS image ${image.fileId}:`,
          error.message
        );
      }
    }
  }
};

// Delete newly uploaded images if product creation/update fails
const deleteUploadedFiles = async (images) => {
  await deleteGridFSImages(images);
};

// Parse optional product price
const parseOptionalPrice = (rawPrice) => {
  if (
    rawPrice === undefined ||
    rawPrice === null ||
    String(rawPrice).trim() === ''
  ) {
    return null;
  }

  const num = Number(rawPrice);

  if (!Number.isFinite(num) || num < 0) {
    return NaN;
  }

  return num;
};

// Parse product sizes
const parseSizes = (sizes) => {
  if (typeof sizes === 'string') {
    return sizes
      .split(',')
      .map((size) => size.trim())
      .filter(Boolean);
  }

  if (Array.isArray(sizes)) {
    return sizes
      .map((size) => String(size).trim())
      .filter(Boolean);
  }

  return undefined;
};

// Escape search input
const escapeRegex = (value) => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Generate product slug
const generateSlug = (name) => {
  const baseSlug = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  return `${baseSlug || 'product'}-${suffix}`;
};

// Parse images sent by the frontend during product updates
const parseExistingImages = (existingImages) => {
  if (existingImages === undefined || existingImages === null) {
    return undefined;
  }

  let images = existingImages;

  if (typeof images === 'string') {
    try {
      images = JSON.parse(images);
    } catch (error) {
      // Support a single legacy image URL
      images = {
        url: existingImages,
        public_id: ''
      };
    }
  }

  if (!Array.isArray(images)) {
    images = [images];
  }

  return images.map((image) => {
    if (typeof image === 'string') {
      return {
        url: image,
        public_id: '',
        fileId: ''
      };
    }

    if (!image || typeof image.url !== 'string' || !image.url.trim()) {
      throw new Error('Invalid existing image data');
    }

    return {
      url: image.url,
      public_id: image.public_id || '',
      fileId: image.fileId || '',
      filename: image.filename || '',
      contentType: image.contentType || ''
    };
  });
};

// GET ALL PRODUCTS
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

    const products = await Product.find(query)
      .sort({ createdAt: -1 });

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

// GET PRODUCT BY ID
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

// GET PRODUCT BY SLUG
const getProductBySlug = async (req, res) => {
  try {
    const product = await Product.findOne({
      slug: req.params.slug
    });

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

// CREATE PRODUCT
const createProduct = async (req, res) => {
  let uploadedImages = [];

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
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    const parsedPrice = parseOptionalPrice(price);

    if (Number.isNaN(parsedPrice)) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a valid non-negative number'
      });
    }

    // Save uploaded images into GridFS
    uploadedImages = await uploadImages(req.files);

    const parsedSizes = parseSizes(sizes);

    const product = await Product.create({
      name,
      description,
      price: parsedPrice,
      currency: 'ETB',
      category,
      images: uploadedImages,
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

    await deleteUploadedFiles(uploadedImages);

    res.status(500).json({
      success: false,
      message: error.message || 'Server error creating product'
    });
  }
};

// UPDATE PRODUCT
const updateProduct = async (req, res) => {
  let uploadedImages = [];

  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
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
        return res.status(400).json({
          success: false,
          message: 'Price must be a valid non-negative number'
        });
      }
    }

    // Preserve existing images unless the frontend sends a new list
    let updatedImages = parseExistingImages(existingImages);

    if (updatedImages === undefined) {
      updatedImages = product.images.map((img) => ({
        url: img.url,
        public_id: img.public_id || '',
        fileId: img.fileId || '',
        filename: img.filename || '',
        contentType: img.contentType || ''
      }));
    }

    // Upload any newly selected images
    uploadedImages = await uploadImages(req.files);

    updatedImages.push(...uploadedImages);

    // Identify removed GridFS images
    const keptFileIds = updatedImages.map((img) => img.fileId);

    const imagesToDelete = product.images.filter(
      (oldImg) =>
        oldImg.fileId &&
        !keptFileIds.includes(oldImg.fileId)
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

    // Delete removed GridFS images after successful product update
    await deleteGridFSImages(imagesToDelete);

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product: updatedProduct
    });
  } catch (error) {
    console.error('Update product error:', error);

    await deleteUploadedFiles(uploadedImages);

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

// DELETE PRODUCT
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Delete only images stored in GridFS.
    // Existing Cloudinary images are left untouched.
    await deleteGridFSImages(product.images);

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
