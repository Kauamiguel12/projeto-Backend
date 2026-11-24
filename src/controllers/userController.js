const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const userController = {
  async create(req, res) {
    try {
      const { firstname, surname, email, password, confirmPassword } = req.body;

      if (!firstname || !surname || !email || !password || !confirmPassword) {
        return res.status(400).json({ message: 'Preencha todos os campos.' });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ message: 'As senhas não coincidem.' });
      }

      const existingUser = await User.findOne({ where: { email } });

      if (existingUser) {
        return res.status(400).json({ message: 'Este email já está cadastrado.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await User.create({
        firstname,
        surname,
        email,
        password: hashedPassword
      });

      return res.status(201).json({
        id: user.id,
        firstname: user.firstname,
        surname: user.surname,
        email: user.email
      });
    } catch (error) {
      return res.status(500).json({ message: 'Erro ao cadastrar usuário.' });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Informe email e senha.' });
      }

      const user = await User.findOne({ where: { email } });

      if (!user) {
        return res.status(401).json({ message: 'Email ou senha inválidos.' });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);

      if (!passwordMatch) {
        return res.status(401).json({ message: 'Email ou senha inválidos.' });
      }

      const token = jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      return res.status(200).json({ token });
    } catch (error) {
      return res.status(500).json({ message: 'Erro ao realizar login.' });
    }
  },

  async findById(req, res) {
    try {
      const user = await User.findByPk(req.params.id, {
        attributes: ['id', 'firstname', 'surname', 'email']
      });

      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado.' });
      }

      return res.status(200).json(user);
    } catch (error) {
      return res.status(500).json({ message: 'Erro ao buscar usuário.' });
    }
  },

  async update(req, res) {
    try {
      const { firstname, surname, email } = req.body;

      const user = await User.findByPk(req.params.id);

      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado.' });
      }

      if (!firstname || !surname || !email) {
        return res.status(400).json({ message: 'Informe nome, sobrenome e email.' });
      }

      const emailInUse = await User.findOne({ where: { email } });

      if (emailInUse && emailInUse.id !== user.id) {
        return res.status(400).json({ message: 'Este email já está cadastrado.' });
      }

      await user.update({ firstname, surname, email });

      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ message: 'Erro ao atualizar usuário.' });
    }
  },

  async delete(req, res) {
    try {
      const user = await User.findByPk(req.params.id);

      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado.' });
      }

      await user.destroy();

      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ message: 'Erro ao excluir usuário.' });
    }
  }
};

module.exports = userController;