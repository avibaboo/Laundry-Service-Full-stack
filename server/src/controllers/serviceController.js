const { PrismaClient } = require('@prisma/client');
const { getIO } = require('../sockets/socketManager');

const prisma = new PrismaClient();

// Get all services
const getServices = async (req, res) => {
  try {
    const services = await prisma.service.findMany();
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch services' });
  }
};

// Update price (Admin)
const updateServicePrice = async (req, res) => {
  const { id } = req.params;
  const { pricePerUnit } = req.body;

  try {
    const service = await prisma.service.update({
      where: { id },
      data: { pricePerUnit }
    });

    // Fetch updated list of services
    const services = await prisma.service.findMany();

    // Emit event to all connected clients
    getIO().emit('servicePricesUpdated', { services });

    res.json(service);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update service price' });
  }
};

// Toggle service visibility
const toggleService = async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;
  try {
    const service = await prisma.service.update({
      where: { id },
      data: { isActive }
    });
    const services = await prisma.service.findMany();
    getIO().emit('servicePricesUpdated', { services });
    res.json(service);
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle service' });
  }
};

// Add new service
const addService = async (req, res) => {
  try {
    const { name, description, unitType, pricePerUnit, estimatedMinutes } = req.body;
    const service = await prisma.service.create({
      data: {
        name,
        description,
        unitType,
        pricePerUnit: parseFloat(pricePerUnit),
        estimatedMinutes: parseInt(estimatedMinutes, 10),
      }
    });
    const services = await prisma.service.findMany();
    getIO().emit('servicePricesUpdated', { services });
    res.status(201).json(service);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add service' });
  }
};

// Delete service
const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.service.delete({
      where: { id }
    });
    const services = await prisma.service.findMany();
    getIO().emit('servicePricesUpdated', { services });
    res.json({ message: 'Service deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete service. It may be linked to existing orders. Try toggling visibility instead.' });
  }
};

module.exports = {
  getServices,
  updateServicePrice,
  toggleService,
  addService,
  deleteService
};
