const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Appointment = require('../models/Appointment');
const Register = require('../models/Register');
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// Registrar Pago (RF-10, RN-15, RN-16, RN-17, RN-18, RN-20, RN-21)
router.post('/', verifyToken, verifyRole(['ADMINISTRADOR', 'RECEPCIONISTA']), async (req, res) => {
  try {
    const { appointmentId, amount, method } = req.body;

    // RN-16: Validar monto positivo
    if (amount <= 0) {
      return res.status(400).json({ message: 'El monto a pagar debe ser mayor a cero (RN-16).' });
    }

    // RN-20 & RN-21: Verificar que el usuario tiene una caja abierta
    const activeRegister = await Register.findOne({ user: req.user.id, status: 'ABIERTA' });
    if (!activeRegister) {
      return res.status(400).json({ message: 'No se pueden registrar pagos sin una caja abierta (RN-20).' });
    }

    // RN-15: Buscar cita
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Cita no encontrada (RN-15).' });
    }

    // RN-17: Validar que no supere el saldo pendiente (con centavos de precisión)
    const newPaidAmount = Math.round((appointment.paidAmount + amount) * 100) / 100;
    if (newPaidAmount > appointment.price) {
      return res.status(400).json({ message: 'El total pagado no puede superar el costo original de la cita (RN-17).' });
    }

    // Generar Número de Comprobante Único
    const voucherNumber = `COMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const payment = new Payment({
      voucherNumber,
      patient: appointment.patient,
      appointment: appointment._id,
      register: activeRegister._id,
      registeredBy: req.user.id,
      amount,
      method
    });

    await payment.save();

    // RN-18: Actualizar saldos y estado financiero de la cita automáticamente
    appointment.paidAmount = newPaidAmount;
    appointment.pendingBalance = Math.round((appointment.price - newPaidAmount) * 100) / 100;

    if (appointment.pendingBalance === 0) {
      appointment.financialStatus = 'PAGADO';
    } else {
      appointment.financialStatus = 'PARCIAL';
    }

    await appointment.save();

    res.status(201).json({ payment, appointment });
  } catch (error) {
    res.status(500).json({ message: 'Error al registrar el pago', error: error.message });
  }
});

// Anular Pago (RF-10, RN-19, RN-27)
router.patch('/:id/cancel', verifyToken, verifyRole(['ADMINISTRADOR', 'RECEPCIONISTA']), async (req, res) => {
  try {
    const { cancellationReason } = req.body;
    const payment = await Payment.findById(req.params.id).populate('register');

    if (!payment) return res.status(404).json({ message: 'Pago no encontrado' });
    if (payment.status === 'ANULADO') return res.status(400).json({ message: 'El pago ya está anulado' });

    // Regla: Solo anular si la caja asociada sigue abierta
    if (payment.register.status === 'CERRADA') {
      return res.status(400).json({ message: 'No se pueden anular pagos pertenecientes a cajas cerradas.' });
    }

    payment.status = 'ANULADO';
    payment.cancellationReason = cancellationReason;
    await payment.save();

    // Recompilar saldo de la cita descontando la anulación
    const appointment = await Appointment.findById(payment.appointment);
    appointment.paidAmount = Math.round((appointment.paidAmount - payment.amount) * 100) / 100;
    appointment.pendingBalance = Math.round((appointment.price - appointment.paidAmount) * 100) / 100;

    if (appointment.paidAmount === 0) {
      appointment.financialStatus = 'PENDIENTE';
    } else {
      appointment.financialStatus = 'PARCIAL';
    }

    await appointment.save();

    res.json({ message: 'Pago anulado exitosamente', payment, appointment });
  } catch (error) {
    res.status(500).json({ message: 'Error al anular pago', error: error.message });
  }
});

module.exports = router;