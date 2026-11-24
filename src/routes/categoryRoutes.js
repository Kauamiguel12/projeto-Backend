const express = require('express');
const router = express.Router();

const categoryController = require('../controllers/categoryController');
const auth = require('../middleware/auth');

router.get('/search', categoryController.search);
router.get('/:id', categoryController.findById);

router.post('/', auth, categoryController.create);
router.put('/:id', auth, categoryController.update);
router.delete('/:id', auth, categoryController.delete);

module.exports = router;