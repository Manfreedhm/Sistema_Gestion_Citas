const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// Login de Usuarios (RN-08)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (!user.active) return res.status(403).json({ message: 'El usuario se encuentra inactivo' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Credenciales inválidas' });

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
});

// Registrar nuevo usuario (Exclusivo Administrador)
router.post('/users', verifyToken, verifyRole(['ADMINISTRADOR']), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ name, email, password: hashedPassword, role });
    await newUser.save();

    res.status(201).json({ message: 'Usuario creado exitosamente' });
  } catch (error) {
    res.status(400).json({ message: 'Error al crear usuario', error: error.message });
  }
});

// Listar usuarios sin exponer contraseñas (RF-13)
router.get('/users', verifyToken, verifyRole(['ADMINISTRADOR']), async (req, res) => {
  try {
    const users = await User.find({}, '-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error al consultar usuarios' });
  }
});

module.exports = router;