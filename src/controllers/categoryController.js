const { Category } = require('../models');

const categoryController = {
  async create(req, res) {
    try {
      const { name, slug, use_in_menu } = req.body;

      if (!name || !slug) {
        return res.status(400).json({
          message: 'Nome e slug são obrigatórios.'
        });
      }

      const existing = await Category.findOne({ where: { slug } });

      if (existing) {
        return res.status(400).json({
          message: 'Esse slug já está cadastrado.'
        });
      }

      const category = await Category.create({
        name,
        slug,
        use_in_menu: use_in_menu ?? false
      });

      return res.status(201).json(category);
    } catch (error) {
      return res.status(500).json({
        message: 'Erro ao cadastrar categoria.'
      });
    }
  },

  async search(req, res) {
    try {
      const categories = await Category.findAll();

      return res.status(200).json(categories);
    } catch (error) {
      return res.status(500).json({
        message: 'Erro ao listar categorias.'
      });
    }
  },

  async findById(req, res) {
    try {
      const category = await Category.findByPk(req.params.id);

      if (!category) {
        return res.status(404).json({
          message: 'Categoria não encontrada.'
        });
      }

      return res.status(200).json(category);
    } catch (error) {
      return res.status(500).json({
        message: 'Erro ao buscar categoria.'
      });
    }
  },

  async update(req, res) {
    try {
      const category = await Category.findByPk(req.params.id);

      if (!category) {
        return res.status(404).json({
          message: 'Categoria não encontrada.'
        });
      }

      const { name, slug, use_in_menu } = req.body;

      if (slug && slug !== category.slug) {
        const existing = await Category.findOne({ where: { slug } });

        if (existing) {
          return res.status(400).json({
            message: 'Esse slug já está cadastrado.'
          });
        }
      }

      await category.update({
        name: name ?? category.name,
        slug: slug ?? category.slug,
        use_in_menu: use_in_menu ?? category.use_in_menu
      });

      return res.status(200).json(category);
    } catch (error) {
      return res.status(500).json({
        message: 'Erro ao atualizar categoria.'
      });
    }
  },

  async delete(req, res) {
    try {
      const category = await Category.findByPk(req.params.id);

      if (!category) {
        return res.status(404).json({
          message: 'Categoria não encontrada.'
        });
      }

      await category.destroy();

      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({
        message: 'Erro ao excluir categoria.'
      });
    }
  }
};

module.exports = categoryController;