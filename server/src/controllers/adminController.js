const { PrismaClient } = require('@prisma/client');
const { getIO } = require('../sockets/socketManager');

const prisma = new PrismaClient();

// Get all users
const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        isBlocked: true,
        totalSpent: true,
        createdAt: true
      }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Block/Unblock User
const toggleBlockUser = async (req, res) => {
  const { id } = req.params;
  const { isBlocked } = req.body;

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { isBlocked }
    });
    res.json({ id: user.id, isBlocked: user.isBlocked });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user block status' });
  }
};

// Get all orders
const getOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        customer: { select: { fullName: true, phone: true } },
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

// Update Order Status
const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const order = await prisma.order.update({
      where: { id },
      data: { status }
    });

    // Emit event to the specific customer
    getIO().to(`user_${order.customerId}`).emit('orderStatusUpdated', {
      orderId: order.id,
      newStatus: order.status,
      updatedAt: new Date()
    });

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

module.exports = {
  getUsers,
  toggleBlockUser,
  getOrders,
  updateOrderStatus
};
