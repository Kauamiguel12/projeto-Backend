const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

const User = require('./user')(sequelize, DataTypes);
const Category = require('./category')(sequelize, DataTypes);
const Product = require('./product')(sequelize, DataTypes);
const ProductImage = require('./productimage')(sequelize, DataTypes);
const ProductOption = require('./productoption')(sequelize, DataTypes);

const ProductCategory = sequelize.define('ProductCategory', {
  product_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  category_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  }
}, {
  tableName: 'product_categories',
  timestamps: false,
  underscored: true
});

Product.hasMany(ProductImage, {
  foreignKey: 'product_id',
  as: 'images'
});

ProductImage.belongsTo(Product, {
  foreignKey: 'product_id'
});

Product.hasMany(ProductOption, {
  foreignKey: 'product_id',
  as: 'options'
});

ProductOption.belongsTo(Product, {
  foreignKey: 'product_id'
});

Product.belongsToMany(Category, {
  through: ProductCategory,
  foreignKey: 'product_id',
  otherKey: 'category_id',
  as: 'categories'
});

Category.belongsToMany(Product, {
  through: ProductCategory,
  foreignKey: 'category_id',
  otherKey: 'product_id',
  as: 'products'
});

module.exports = {
  sequelize,
  User,
  Category,
  Product,
  ProductImage,
  ProductOption,
  ProductCategory
};