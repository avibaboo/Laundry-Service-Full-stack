const { PrismaClient } = require('@prisma/client');
const { getIO } = require('../sockets/socketManager');

const prisma = new PrismaClient();

// POST /api/v1/orders - Customer places a new order
const placeOrder = async (req, res) => {
  const {
    customerId,
    pickupAddress,
    deliveryAddress,
    paymentMethod,
    scheduledPickupTime,
    items // [{ serviceId, quantity }]
  } = req.body;

  try {
    // Fetch service prices at time of order
    const serviceIds = items.map(i => i.serviceId);
    const services = await prisma.service.findMany({ where: { id: { in: serviceIds } } });
    const serviceMap = Object.fromEntries(services.map(s => [s.id, s]));

    // Calculate totals
    let subtotal = 0;
    const orderItems = items.map(item => {
      const service = serviceMap[item.serviceId];
      const totalPrice = parseFloat((service.pricePerUnit * item.quantity).toFixed(2));
      subtotal += totalPrice;
      return {
        serviceId: item.serviceId,
        quantity: item.quantity,
        unitPriceAtTime: service.pricePerUnit,
        totalPrice
      };
    });

    const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);

    // Create order + items in a transaction
    const order = await prisma.order.create({
      data: {
        customerId,
        pickupAddress,
        deliveryAddress,
        paymentMethod,
        scheduledPickupTime: new Date(scheduledPickupTime),
        status: 'PENDING',
        paymentStatus: 'PENDING',
        totalQuantity,
        subtotal,
        finalAmount: subtotal,
        items: {
          create: orderItems
        }
      },
      include: {
        items: true,
        customer: { select: { fullName: true, phone: true } }
      }
    });

    // Notify admin dashboard in real-time
    try {
      getIO().to('admin_dashboard').emit('newOrderAlert', {
        orderSummary: {
          id: order.id,
          customerName: order.customer.fullName,
          finalAmount: order.finalAmount,
          status: order.status,
          createdAt: order.createdAt
        }
      });
    } catch (socketErr) {
      console.warn('Socket not available:', socketErr.message);
    }

    res.status(201).json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to place order' });
  }
};

// PUT /api/v1/orders/:id/pay - Customer pays for an order
const payOrder = async (req, res) => {
  const { id } = req.params;

  try {
    const order = await prisma.order.update({
      where: { id },
      data: { paymentStatus: 'PAID', status: 'CONFIRMED' },
      include: {
        customer: { select: { fullName: true, phone: true } }
      }
    });

    // Notify admin
    try {
      getIO().to('admin_dashboard').emit('newOrderAlert', {
        orderSummary: {
          id: order.id,
          customerName: order.customer.fullName,
          finalAmount: order.finalAmount,
          status: order.status,
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt
        }
      });
    } catch (socketErr) {
      console.warn('Socket not available:', socketErr.message);
    }

    // Update customer totalSpent
    await prisma.user.update({
      where: { id: order.customerId },
      data: { totalSpent: { increment: order.finalAmount } }
    });

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
};

// GET /api/v1/orders?customerId=xxx - Get orders for a specific customer
const getCustomerOrders = async (req, res) => {
  const { customerId } = req.query;
  try {
    const orders = await prisma.order.findMany({
      where: { customerId },
      include: { items: { include: { service: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

module.exports = { placeOrder, payOrder, getCustomerOrders };
