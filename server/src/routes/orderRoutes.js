const express = require('express');
const { placeOrder, payOrder, getCustomerOrders } = require('../controllers/orderController');

const router = express.Router();

router.get('/', getCustomerOrders);         // GET /api/v1/orders?customerId=xxx
router.post('/', placeOrder);               // POST /api/v1/orders
router.put('/:id/pay', payOrder);           // PUT /api/v1/orders/:id/pay

module.exports = router;
