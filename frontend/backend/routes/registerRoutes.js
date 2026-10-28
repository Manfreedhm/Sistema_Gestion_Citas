const express = require('express');
const router = express.Router();
const Register = require('../models/Register');
const Payment = require('../models/Payment');
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// Apertura de Caja (RF-11, RN-22)
router.post('/open', verifyToken, verifyRole(['ADMINISTRADOR', 'RECEPCIONISTA']), async (req, res) => {
  try {
    const { initialAmount } = req.body;

    // RN-22: Una sola caja abierta por usuario
    const existingOpen = await Register.findOne({ user: req.user.id, status: 'ABIERTA' });
    if (existingOpen) {
      return res.status(400).json({ message: 'El usuario ya posee una caja abierta (RN-22).' });
    }

    const register = new Register({
      user: req.user.id,
      initialAmount,
      expectedCash: initialAmount
    });

    await register.save();
    res.status(201).json(register);
  } catch (error) {
    res.status(500).json({ message: 'Error al abrir caja' });
  }
});

// Cierre de Caja con cálculo de diferencias (RF-11, RN-23)
router.post('/close', verifyToken, verifyRole(['ADMINISTRADOR', 'RECEPCIONISTA']), async (req, res) => {
  try {
    const { countedCash } = req.body;

    const register = await Register.findOne({ user: req.user.id, status: 'ABIERTA' });
    if (!register) {
      return res.status(400).json({ message: 'No hay ninguna caja abierta para cerrar.' });
    }

    // Consultar todos los pagos válidos de esta caja (RN-19: Pagos no anulados)
    const payments = await Payment.find({ register: register._id, status: 'REGISTRADO' });

    let cashTotal = 0;
    let transferTotal = 0;
    let cardTotal = 0;

    payments.forEach(p => {
      if (p.method === 'EFECTIVO') cashTotal += p.amount;
      if (p.method === 'TRANSFERENCIA') transferTotal += p.amount;
      if (p.method === 'TARJETA') cardTotal += p.amount;
    });

    const totalIncome = cashTotal + transferTotal + cardTotal;
    const expectedCash = register.initialAmount + cashTotal;
    const difference = Math.round((countedCash - expectedCash) * 100) / 100;

    register.cashTotal = cashTotal;
    register.transferTotal = transferTotal;
    register.cardTotal = cardTotal;
    register.totalIncome = totalIncome;
    register.expectedCash = expectedCash;
    register.countedCash = countedCash;
    register.difference = difference;
    register.closedAt = new Date();
    register.status = 'CERRADA';

    await register.save();
    res.json({ message: 'Caja cerrada exitosamente', register });
  } catch (error) {
    res.status(500).json({ message: 'Error al cerrar caja', error: error.message });
  }
});

module.exports = router;