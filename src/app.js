const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.use('/media', express.static('public/media'));

app.get('/', (req, res) => {
  res.json({ message: 'API Projeto Backend funcionando!' });
});

app.use('/v1/user', require('./routes/userRoutes'));
app.use('/v1/category', require('./routes/categoryRoutes'));
app.use('/v1/product', require('./routes/productRoutes'));

module.exports = app;