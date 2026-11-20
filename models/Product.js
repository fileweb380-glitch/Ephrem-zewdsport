const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  public_id: { type: String, required: true }
});

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a product name'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Please add a product description']
  },
  price: {
    type: Number,
    default: null,
    min: [0, 'Price must be a positive number']
  },
  currency: {
    type: String,
    default: 'ETB'
  },
  category: {
    type: String,
    required: [true, 'Please select a category'],
    enum: ['Football Jerseys', 'Basketball Jerseys', 'Training Wear', 'Sportswear', 'Accessories']
  },
  images: [imageSchema],
  sizes: {
    type: [String],
    required: [true, 'Please specify available sizes'],
    default: ['S', 'M', 'L', 'XL', 'XXL']
  },
  stockStatus: {
    type: String,
    required: true,
    enum: ['In Stock', 'Out of Stock'],
    default: 'In Stock'
  },
  featured: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Auto-generate unique slug from name if missing or name changed
productSchema.pre('validate', function() {
  if (this.name && (!this.slug || this.isModified('name'))) {
    const baseSlug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    this.slug = `${baseSlug || 'product'}-${suffix}`;
  }
});

module.exports = mongoose.model('Product', productSchema);
