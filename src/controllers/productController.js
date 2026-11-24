const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');

const {
  Product,
  Category,
  ProductImage,
  ProductOption,
  sequelize
} = require('../models');

const mediaFolder = path.join(__dirname, '../../public/media');

// Salvar imagens
function saveImage(image) {
  if (!image || !image.content) {
    throw new Error('Imagem sem conteúdo.');
  }

  if (
    image.content.startsWith('http://') ||
    image.content.startsWith('https://')
  ) {
    return image.content;
  }

  const matches = image.content.match(
    /^data:(image\/\w+);base64,(.+)$/
  );

  const mime = matches ? matches[1] : image.type;
  const base64 = matches ? matches[2] : image.content;

  const extensions = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp'
  };

  const extension = extensions[mime];

  if (!extension) {
    throw new Error('Formato de imagem inválido.');
  }

  fs.mkdirSync(mediaFolder, { recursive: true });

  const filename =
    `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

  fs.writeFileSync(
    path.join(mediaFolder, filename),
    Buffer.from(base64, 'base64')
  );

  return `/media/${filename}`;
}

// Criar produto
async function create(req, res) {
  const transaction = await sequelize.transaction();

  try {
    const {
      enabled,
      name,
      slug,
      stock,
      description,
      price,
      price_with_discount,
      category_ids = [],
      images = [],
      options = []
    } = req.body;

    if (
      !name ||
      !slug ||
      price === undefined ||
      price_with_discount === undefined
    ) {
      await transaction.rollback();

      return res.status(400).json({
        message: 'Preencha os campos obrigatórios.'
      });
    }

    const existing = await Product.findOne({
      where: { slug },
      transaction
    });

    if (existing) {
      await transaction.rollback();

      return res.status(400).json({
        message: 'Esse slug já está cadastrado.'
      });
    }

    const product = await Product.create({
      enabled: enabled ?? false,
      name,
      slug,
      stock: stock ?? 0,
      description,
      price,
      price_with_discount
    }, { transaction });

    // Associar categorias
    if (category_ids.length) {
      const categories = await Category.findAll({
        where: {
          id: { [Op.in]: category_ids }
        },
        transaction
      });

      if (categories.length !== category_ids.length) {
        throw new Error('Uma ou mais categorias não existem.');
      }

      await product.setCategories(categories, { transaction });
    }

    // Cadastrar imagens
    for (const image of images) {
      await ProductImage.create({
        product_id: product.id,
        enabled: true,
        path: saveImage(image)
      }, { transaction });
    }

    // Cadastrar opções
    for (const option of options) {
      await ProductOption.create({
        product_id: product.id,
        title: option.title,
        shape: option.shape || 'square',
        radius: parseInt(option.radius, 10) || 0,
        type: option.type || 'text',
        values: Array.isArray(option.values)
          ? option.values.join(',')
          : option.values
      }, { transaction });
    }

    await transaction.commit();

    return res.status(201).json({
      message: 'Produto cadastrado com sucesso.',
      id: product.id
    });

  } catch (error) {
    await transaction.rollback();

    console.error(error);

    return res.status(400).json({
      message: error.message || 'Erro ao cadastrar produto.'
    });
  }
}

// Pesquisar produtos e aplicar filtros
async function search(req, res) {
  try {
    const {
      limit = 12,
      page = 1,
      match,
      category_ids,
      'price-range': priceRange,
      fields
    } = req.query;

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      !Number.isInteger(limitNumber) ||
      (limitNumber !== -1 && limitNumber < 1)
    ) {
      return res.status(400).json({
        message: 'Parâmetros de paginação inválidos.'
      });
    }

    const where = {};

    // Filtro por nome ou descrição
    if (match) {
      where[Op.or] = [
        { name: { [Op.like]: `%${match}%` } },
        { description: { [Op.like]: `%${match}%` } }
      ];
    }

    // Filtro por preço
    if (priceRange) {
      const prices = priceRange.split('-').map(Number);

      if (
        prices.length !== 2 ||
        prices.some(price => !Number.isFinite(price)) ||
        prices[0] > prices[1]
      ) {
        return res.status(400).json({
          message: 'Faixa de preço inválida.'
        });
      }

      where.price = {
        [Op.between]: prices
      };
    }

    // Relacionamentos
    const includes = [
      {
        model: Category,
        as: 'categories',
        through: { attributes: [] },
        attributes: ['id', 'name', 'slug']
      },
      {
        model: ProductImage,
        as: 'images',
        attributes: ['id', 'path', 'enabled']
      },
      {
        model: ProductOption,
        as: 'options'
      }
    ];

    // Filtro por categoria
    if (category_ids) {
      const ids = category_ids.split(',').map(Number);

      if (ids.some(id => !Number.isInteger(id) || id <= 0)) {
        return res.status(400).json({
          message: 'IDs de categorias inválidos.'
        });
      }

      includes[0].where = {
        id: { [Op.in]: ids }
      };

      includes[0].required = true;
    }

    // Filtro por opções
    const optionFilters = req.query.option;

    if (optionFilters && typeof optionFilters === 'object') {
      const optionConditions = [];

      for (const [optionId, rawValues] of Object.entries(optionFilters)) {
        const values = String(rawValues)
          .split(',')
          .map(value => value.trim())
          .filter(Boolean);

        if (
          !Number.isInteger(Number(optionId)) ||
          Number(optionId) <= 0 ||
          values.length === 0
        ) {
          return res.status(400).json({
            message: 'Filtro de opções inválido.'
          });
        }

        optionConditions.push({
          id: Number(optionId),
          [Op.or]: values.map(value => ({
            values: {
              [Op.like]: `%${value}%`
            }
          }))
        });
      }

      if (optionConditions.length) {
        includes[2].where = {
          [Op.or]: optionConditions
        };

        includes[2].required = true;
      }
    }

    // Selecionar campos
    const allowedFields = [
      'id',
      'enabled',
      'name',
      'slug',
      'stock',
      'description',
      'price',
      'price_with_discount',
      'created_at',
      'updated_at'
    ];

    let attributes = allowedFields;

    if (fields) {
      attributes = fields
        .split(',')
        .filter(field => allowedFields.includes(field));

      if (!attributes.includes('id')) {
        attributes.unshift('id');
      }

      if (attributes.length === 1 && fields !== 'id') {
        return res.status(400).json({
          message: 'Nenhum campo válido informado.'
        });
      }
    }

    const result = await Product.findAndCountAll({
      where,
      attributes,
      include: includes,
      distinct: true,
      limit: limitNumber === -1 ? undefined : limitNumber,
      offset: limitNumber === -1
        ? undefined
        : (pageNumber - 1) * limitNumber
    });

    const data = result.rows.map(product => {
      const item = product.toJSON();

      item.category_ids = item.categories.map(category => category.id);

      item.images = item.images.map(image => ({
        id: image.id,
        content: image.path
      }));

      delete item.categories;

      return item;
    });

    return res.status(200).json({
      data,
      total: result.count,
      limit: limitNumber,
      page: pageNumber
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao pesquisar produtos.'
    });
  }
}

// Buscar produto pelo ID
async function findById(req, res) {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [
        {
          model: Category,
          as: 'categories',
          through: { attributes: [] }
        },
        {
          model: ProductImage,
          as: 'images'
        },
        {
          model: ProductOption,
          as: 'options'
        }
      ]
    });

    if (!product) {
      return res.status(404).json({
        message: 'Produto não encontrado.'
      });
    }

    const item = product.toJSON();

    item.category_ids = item.categories.map(category => category.id);

    item.images = item.images.map(image => ({
      id: image.id,
      content: image.path
    }));

    delete item.categories;

    return res.status(200).json(item);

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao buscar produto.'
    });
  }
}

// Atualizar produto
async function update(req, res) {
  const transaction = await sequelize.transaction();

  try {
    const product = await Product.findByPk(req.params.id, {
      transaction
    });

    if (!product) {
      await transaction.rollback();

      return res.status(404).json({
        message: 'Produto não encontrado.'
      });
    }

    const {
      enabled,
      name,
      slug,
      stock,
      description,
      price,
      price_with_discount,
      category_ids,
      images,
      options
    } = req.body;

    if (slug && slug !== product.slug) {
      const existing = await Product.findOne({
        where: { slug },
        transaction
      });

      if (existing) {
        throw new Error('Esse slug já está cadastrado.');
      }
    }

    await product.update({
      enabled: enabled ?? product.enabled,
      name: name ?? product.name,
      slug: slug ?? product.slug,
      stock: stock ?? product.stock,
      description: description ?? product.description,
      price: price ?? product.price,
      price_with_discount:
        price_with_discount ?? product.price_with_discount
    }, { transaction });

    // Atualizar categorias
    if (category_ids !== undefined) {
      const categories = await Category.findAll({
        where: {
          id: { [Op.in]: category_ids }
        },
        transaction
      });

      if (categories.length !== category_ids.length) {
        throw new Error('Uma ou mais categorias não existem.');
      }

      await product.setCategories(categories, { transaction });
    }

    // Atualizar imagens
    if (images !== undefined) {
      await ProductImage.destroy({
        where: { product_id: product.id },
        transaction
      });

      for (const image of images) {
        await ProductImage.create({
          product_id: product.id,
          enabled: true,
          path: saveImage(image)
        }, { transaction });
      }
    }

    // Atualizar opções
    if (options !== undefined) {
      await ProductOption.destroy({
        where: { product_id: product.id },
        transaction
      });

      for (const option of options) {
        await ProductOption.create({
          product_id: product.id,
          title: option.title,
          shape: option.shape || 'square',
          radius: parseInt(option.radius, 10) || 0,
          type: option.type || 'text',
          values: Array.isArray(option.values)
            ? option.values.join(',')
            : option.values
        }, { transaction });
      }
    }

    await transaction.commit();

    return res.status(204).send();

  } catch (error) {
    await transaction.rollback();

    console.error(error);

    return res.status(400).json({
      message: error.message || 'Erro ao atualizar produto.'
    });
  }
}

// Excluir produto
async function deleteProduct(req, res) {
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: 'Produto não encontrado.'
      });
    }

    await product.destroy();

    return res.status(204).send();

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao excluir produto.'
    });
  }
}

module.exports = {
  create,
  search,
  findById,
  update,
  delete: deleteProduct
};