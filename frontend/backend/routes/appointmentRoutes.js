const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const Service = require('../models/Service');
const Patient = require('../models/Patient');
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// Helper para calcular edad del paciente
const calculateAge = (birthDate) => {
  const ageDifMs = Date.now() - new Date(birthDate).getTime();
  const ageDate = new Date(ageDifMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

// Programar Cita (RF-07, RN-01, RN-02, RN-03, RN-04, RN-11, RN-12)
router.post('/', verifyToken, verifyRole(['ADMINISTRADOR', 'RECEPCIONISTA']), async (req, res) => {
  try {
    const { patientId, serviceId, professionalId, date, startTime, notes } = req.body;

    // RN-11: Validar fechas pasadas
    const appointmentDateTime = new Date(`${date}T${startTime}`);
    if (appointmentDateTime < new Date()) {
      return res.status(400).json({ message: 'No se pueden programar citas en fechas u horas pasadas (RN-11).' });
    }

    // RN-03 & RN-14: Validar paciente activo
    const patient = await Patient.findById(patientId).populate('guardians');
    if (!patient || !patient.active) {
      return res.status(400).json({ message: 'El paciente no existe o está inactivo (RN-14).' });
    }

    // RN-04: Menores de edad requieren al menos un responsable
    const age = calculateAge(patient.birthDate);
    if (age < 18 && patient.guardians.length === 0) {
      return res.status(400).json({ message: 'Los pacientes menores de edad deben tener al menos un responsable (RN-04).' });
    }

    // RN-07: Servicio activo y obtención de copia de precio y duración
    const service = await Service.findById(serviceId);
    if (!service || !service.active) {
      return res.status(400).json({ message: 'El servicio seleccionado no está activo (RN-07).' });
    }

    // RN-12: Calcular hora de finalización en base a la duración del servicio
    const [startHour, startMin] = startTime.split(':').map(Number);
    const endMinutesTotal = startHour * 60 + startMin + service.durationMinutes;
    const endHour = String(Math.floor(endMinutesTotal / 60)).padStart(2, '0');
    const endMin = String(endMinutesTotal % 60).padStart(2, '0');
    const endTime = `${endHour}:${endMin}`;

    // RN-01: Validar traslape de citas para el profesional
    const overlap = await Appointment.findOne({
      professional: professionalId,
      date,
      status: { $in: ['PENDIENTE', 'CONFIRMADA'] },$or: [
        { startTime: { $lt: endTime,$gte: startTime } },
        { endTime: { $gt: startTime,$lte: endTime } }
      ]
    });

    if (overlap) {
      return res.status(400).json({ message: 'El profesional ya tiene una cita asignada en ese horario (RN-01).' });
    }

    // Crear cita clonando precio e inicializando saldos
    const appointment = new Appointment({
      patient: patientId,
      service: serviceId,
      professional: professionalId,
      date,
      startTime,
      endTime,
      price: service.priceQuetzales,
      pendingBalance: service.priceQuetzales,
      paidAmount: 0,
      notes
    });

    await appointment.save();
    res.status(201).json(appointment);
  } catch (error) {
    res.status(500).json({ message: 'Error al programar la cita', error: error.message });
  }
});

// Cambiar estado de cita (RN-05, RN-06)
router.patch('/:id/status', verifyToken, verifyRole(['ADMINISTRADOR', 'RECEPCIONISTA', 'PROFESIONAL']), async (req, res) => {
  try {
    const { status } = req.body;
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) return res.status(404).json({ message: 'Cita no encontrada' });

    // RN-05: CANCELADA no puede pasar a COMPLETADA
    if (appointment.status === 'CANCELADA' && status === 'COMPLETADA') {
      return res.status(400).json({ message: 'Una cita cancelada no puede marcarse como completada (RN-05).' });
    }

    // RN-06: COMPLETADA no puede reprogramarse
    if (appointment.status === 'COMPLETADA' && status === 'CONFIRMADA') {
      return res.status(400).json({ message: 'Una cita completada no se puede reprogramar (RN-06).' });
    }

    appointment.status = status;
    await appointment.save();
    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: 'Error al cambiar estado de la cita' });
  }
});

module.exports = router;