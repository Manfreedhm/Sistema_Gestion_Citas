const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Guardian = require('../models/Guardian');
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// Registrar Paciente (RF-03)
router.post('/', verifyToken, verifyRole(['ADMINISTRADOR', 'RECEPCIONISTA']), async (req, res) => {
  try {
    const patient = new Patient(req.body);
    await patient.save();
    res.status(201).json(patient);
  } catch (error) {
    res.status(400).json({ message: 'Error al registrar paciente', error: error.message });
  }
});

// Consultar todos los pacientes (RF-03)
router.get('/', verifyToken, verifyRole(['ADMINISTRADOR', 'RECEPCIONISTA', 'PROFESIONAL']), async (req, res) => {
  try {
    const patients = await Patient.find().populate('guardians');
    res.json(patients);
  } catch (error) {
    res.status(500).json({ message: 'Error al consultar pacientes' });
  }
});

// Eliminación Lógica de Paciente (RF-03)
router.patch('/:id/deactivate', verifyToken, verifyRole(['ADMINISTRADOR']), async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    res.json({ message: 'Paciente desactivado correctamente', patient });
  } catch (error) {
    res.status(400).json({ message: 'Error al desactivar paciente' });
  }
});

// Registrar Responsable y asociarlo a un Paciente (RF-04)
router.post('/:patientId/guardians', verifyToken, verifyRole(['ADMINISTRADOR', 'RECEPCIONISTA']), async (req, res) => {
  try {
    const guardian = new Guardian(req.body);
    await guardian.save();

    await Patient.findByIdAndUpdate(req.params.patientId, {
      $push: { guardians: guardian._id }
    });

    res.status(201).json(guardian);
  } catch (error) {
    res.status(400).json({ message: 'Error al registrar responsable', error: error.message });
  }
});

module.exports = router;