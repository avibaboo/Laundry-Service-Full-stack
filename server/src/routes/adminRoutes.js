const express = require('express');
const { getUsers, toggleBlockUser, getOrders, updateOrderStatus } = require('../controllers/adminController');

const router = express.Router();

// Users Management
router.get('/users', getUsers);
router.put('/users/:id/block', toggleBlockUser);

// Orders Management
router.get('/orders', getOrders);
router.put('/orders/:id/status', updateOrderStatus);

module.exports = router;
