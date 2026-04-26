const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Acesso negado' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
};

router.get('/abrigos', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM abrigos ORDER BY nome');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/abrigos/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM abrigos WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Abrigo não encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/abrigos', authenticateToken, async (req, res) => {
  if (req.user.tipo !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const { nome, endereco, latitude, longitude, capacidade_total, ocupados_atual, contato } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO abrigos (nome, endereco, latitude, longitude, capacidade_total, ocupados_atual, contato) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [nome, endereco, latitude, longitude, capacidade_total, ocupados_atual || 0, contato]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Abrigo criado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/abrigos/:id', authenticateToken, async (req, res) => {
  if (req.user.tipo !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const { nome, endereco, latitude, longitude, capacidade_total, ocupados_atual, contato } = req.body;
  try {
    await db.query(
      'UPDATE abrigos SET nome=$1, endereco=$2, latitude=$3, longitude=$4, capacidade_total=$5, ocupados_atual=$6, contato=$7 WHERE id=$8',
      [nome, endereco, latitude, longitude, capacidade_total, ocupados_atual, contato, req.params.id]
    );
    res.json({ message: 'Abrigo atualizado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/abrigos/:id', authenticateToken, async (req, res) => {
  if (req.user.tipo !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  try {
    await db.query('DELETE FROM abrigos WHERE id = $1', [req.params.id]);
    res.json({ message: 'Abrigo excluído com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/abrigos/:id/ocupacao', authenticateToken, async (req, res) => {
  const { ocupados } = req.body;
  try {
    const abrigo = await db.query('SELECT capacidade_total FROM abrigos WHERE id = $1', [req.params.id]);
    if (abrigo.rows.length === 0) return res.status(404).json({ error: 'Abrigo não encontrado' });
    if (ocupados > abrigo.rows[0].capacidade_total) {
      return res.status(400).json({ error: 'Número de ocupados excede a capacidade total' });
    }
    await db.query('UPDATE abrigos SET ocupados_atual = $1 WHERE id = $2', [ocupados, req.params.id]);
    res.json({ message: 'Ocupação atualizada com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/login', async (req, res) => {
  const { email, senha } = req.body;
  try {
    const result = await db.query('SELECT * FROM admin WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Credenciais inválidas' });
    const admin = result.rows[0];
    const validPassword = await bcrypt.compare(senha, admin.senha);
    if (!validPassword) return res.status(401).json({ error: 'Credenciais inválidas' });
    const token = jwt.sign(
      { id: admin.id, email: admin.email, tipo: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    res.json({ token, user: { id: admin.id, email: admin.email, tipo: 'admin' } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/voluntario/login', async (req, res) => {
  const { email, senha } = req.body;
  try {
    const result = await db.query('SELECT * FROM voluntarios WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Credenciais inválidas' });
    const voluntario = result.rows[0];
    const validPassword = await bcrypt.compare(senha, voluntario.senha);
    if (!validPassword) return res.status(401).json({ error: 'Credenciais inválidas' });
    const token = jwt.sign(
      { id: voluntario.id, email: voluntario.email, tipo: 'voluntario' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    res.json({ token, user: { id: voluntario.id, nome: voluntario.nome, email: voluntario.email, tipo: 'voluntario' } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/voluntario/register', async (req, res) => {
  const { nome, email, telefone, cidade, disponibilidade, habilidades, senha } = req.body;
  try {
    const existing = await db.query('SELECT id FROM voluntarios WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Email já cadastrado' });
    const hashedPassword = await bcrypt.hash(senha, 10);
    const result = await db.query(
      'INSERT INTO voluntarios (nome, email, telefone, cidade, disponibilidade, habilidades, senha) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [nome, email, telefone, cidade, disponibilidade, habilidades, hashedPassword]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Voluntário cadastrado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/voluntarios', authenticateToken, async (req, res) => {
  if (req.user.tipo !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  try {
    const result = await db.query('SELECT id, nome, email, telefone, cidade, disponibilidade, habilidades, status, created_at FROM voluntarios ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/voluntarios/:id/status', authenticateToken, async (req, res) => {
  if (req.user.tipo !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const { status } = req.body;
  try {
    await db.query('UPDATE voluntarios SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ message: 'Status atualizado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── ROTAS DE RESGATE ────────────────────────────────────────────────────────

router.post('/resgates', async (req, res) => {
  const {
    nome_solicitante, telefone, latitude, longitude, endereco_descricao,
    num_pessoas, tem_crianca, tem_idoso, tem_deficiente, tem_audio, observacoes,
  } = req.body;

  const temLocalizacao = latitude && longitude;
  const temEndereco = endereco_descricao && endereco_descricao.trim().length > 0;
  const temAudioEnviado = tem_audio === true;

  if (!temLocalizacao && !temEndereco && !temAudioEnviado) {
    return res.status(400).json({ error: 'Informe pelo menos um: localização GPS, endereço ou áudio gravado.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO resgates
        (nome_solicitante, telefone, latitude, longitude, endereco_descricao,
         num_pessoas, tem_crianca, tem_idoso, tem_deficiente, observacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, created_at`,
      [
        nome_solicitante || 'Anônimo', telefone || null,
        latitude || null, longitude || null, endereco_descricao || null,
        num_pessoas || 1, tem_crianca || false, tem_idoso || false,
        tem_deficiente || false, observacoes || null,
      ]
    );
    res.status(201).json({
      id: result.rows[0].id,
      message: 'Solicitação de resgate enviada! Um voluntário irá até você.',
      created_at: result.rows[0].created_at,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/resgates', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM resgates';
    const params = [];
    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }
    query += ' ORDER BY created_at DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ ROTA UNIFICADA DE STATUS — usada pelo frontend
router.put('/resgates/:id/status', authenticateToken, async (req, res) => {
  const { status } = req.body;
  try {
    if (status === 'a_caminho') {
      const check = await db.query('SELECT status FROM resgates WHERE id = $1', [req.params.id]);
      if (check.rows.length === 0) return res.status(404).json({ error: 'Resgate não encontrado' });
      if (check.rows[0].status !== 'aguardando') {
        return res.status(400).json({ error: 'Este resgate já foi aceito ou concluído' });
      }
      const vol = await db.query('SELECT nome FROM voluntarios WHERE id = $1', [req.user.id]);
      const nomeVol = vol.rows[0]?.nome || 'Voluntário';
      await db.query(
        `UPDATE resgates SET status='a_caminho', voluntario_id=$1, voluntario_nome=$2, updated_at=NOW() WHERE id=$3`,
        [req.user.id, nomeVol, req.params.id]
      );
    } else {
      await db.query(
        `UPDATE resgates SET status=$1, updated_at=NOW() WHERE id=$2`,
        [status, req.params.id]
      );
    }
    res.json({ message: 'Status atualizado.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/resgates/:id/audio', async (req, res) => {
  const { audio_url } = req.body;
  try {
    await db.query(`UPDATE resgates SET audio_url=$1 WHERE id=$2`, [audio_url, req.params.id]);
    res.json({ message: 'URL do áudio salva com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/resgates/:id/aceitar', authenticateToken, async (req, res) => {
  if (req.user.tipo !== 'voluntario') return res.status(403).json({ error: 'Apenas voluntários podem aceitar resgates' });
  try {
    const check = await db.query('SELECT status FROM resgates WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Resgate não encontrado' });
    if (check.rows[0].status !== 'aguardando') {
      return res.status(400).json({ error: 'Este resgate já foi aceito ou concluído' });
    }
    const vol = await db.query('SELECT nome FROM voluntarios WHERE id = $1', [req.user.id]);
    const nomeVol = vol.rows[0]?.nome || 'Voluntário';
    await db.query(
      `UPDATE resgates SET status='a_caminho', voluntario_id=$1, voluntario_nome=$2, updated_at=NOW() WHERE id=$3`,
      [req.user.id, nomeVol, req.params.id]
    );
    res.json({ message: 'Resgate aceito! Dirija-se ao local.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/resgates/:id/concluir', authenticateToken, async (req, res) => {
  if (req.user.tipo !== 'voluntario') return res.status(403).json({ error: 'Acesso negado' });
  try {
    await db.query(
      `UPDATE resgates SET status='concluido', updated_at=NOW() WHERE id=$1 AND voluntario_id=$2`,
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Resgate concluído com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/resgates/:id/cancelar', authenticateToken, async (req, res) => {
  if (req.user.tipo !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  try {
    await db.query(
      `UPDATE resgates SET status='cancelado', updated_at=NOW() WHERE id=$1`,
      [req.params.id]
    );
    res.json({ message: 'Resgate cancelado.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;