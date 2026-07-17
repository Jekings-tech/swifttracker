const express = require('express');
const router = express.Router();
const shipmentController = require('../controllers/shipmentController');
const { authenticateUser } = require('../middleware/auth');

// Public routes (for customer tracking)
router.get('/tracking/:trackingId', shipmentController.getShipmentByTrackingId);

// Protected routes (all require authentication)
router.use(authenticateUser);

// Dashboard stats
router.get('/stats', shipmentController.getDashboardStats);
router.get('/recent', shipmentController.getRecentShipments);

// CRUD operations
router.get('/', shipmentController.getAllShipments);
router.get('/:id', shipmentController.getShipmentById);
router.post('/', shipmentController.createShipment);
router.put('/:id', shipmentController.updateShipment);
router.delete('/:id', shipmentController.deleteShipment);

// Tracking updates
router.post('/:trackingId/tracking', shipmentController.addTrackingUpdate);

module.exports = router;