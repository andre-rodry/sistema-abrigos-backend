const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const abrigosRoutes = require('./routes/abrigos');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api', abrigosRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'API funcionando!' });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});