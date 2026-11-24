const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const auth = require('../middleware/auth');

router.post('/token', userController.login);
router.post('/', userController.create);
router.get('/:id', userController.findById);
router.put('/:id', auth, userController.update);
router.delete('/:id', auth, userController.delete);

module.exports = router;