const express = require('express');
const { getServices, updateServicePrice, toggleService, addService, deleteService } = require('../controllers/serviceController');

const router = express.Router();

router.get('/', getServices);
router.post('/', addService);
router.put('/:id/price', updateServicePrice);
router.put('/:id/toggle', toggleService);
router.delete('/:id', deleteService);

module.exports = router;
