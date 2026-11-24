const express = require('express');
const router = express.Router();

const productController = require('../controllers/productController');
const auth = require('../middleware/auth');

router.get('/search', productController.search);
router.get('/:id', productController.findById);

router.post('/', auth, productController.create);
router.put('/:id', auth, productController.update);
router.delete('/:id', auth, productController.delete);

module.exports = router;