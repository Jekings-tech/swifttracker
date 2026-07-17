const Shipment = require('../models/Shipment');
const axios = require('axios');

// Geocode function using Mapbox
const geocodeLocation = async (location) => {
    try {
        const response = await axios.get(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json`,
            {
                params: {
                    access_token: process.env.MAPBOX_TOKEN,
                    limit: 1
                }
            }
        );
        
        if (response.data.features && response.data.features.length > 0) {
            const [lng, lat] = response.data.features[0].center;
            return { lat, lng };
        }
        return null;
    } catch (error) {
        console.error('Geocoding error:', error.message);
        return null;
    }
};

// Get all shipments with filtering, sorting, pagination
exports.getAllShipments = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Build filter object
        const filter = {};
        if (req.query.status) filter['shipmentInfo.status'] = req.query.status;
        if (req.query.shipmentType) filter['shipmentInfo.shipmentType'] = req.query.shipmentType;
        if (req.query.carrier) filter['shipmentInfo.carrier'] = req.query.carrier;
        if (req.query.search) {
            filter.$or = [
                { trackingId: { $regex: req.query.search, $options: 'i' } },
                { 'shipper.name': { $regex: req.query.search, $options: 'i' } },
                { 'recipient.name': { $regex: req.query.search, $options: 'i' } }
            ];
        }

        // Sorting
        const sort = {};
        if (req.query.sortBy) {
            sort[req.query.sortBy] = req.query.order === 'desc' ? -1 : 1;
        } else {
            sort.createdAt = -1;
        }

        const shipments = await Shipment.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit);

        const total = await Shipment.countDocuments(filter);

        res.json({
            shipments,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            itemsPerPage: limit
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get single shipment by tracking ID
exports.getShipmentByTrackingId = async (req, res) => {
    try {
        const shipment = await Shipment.findOne({ trackingId: req.params.trackingId });
        if (!shipment) {
            return res.status(404).json({ error: 'Shipment not found' });
        }
        res.json(shipment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get single shipment by ID
exports.getShipmentById = async (req, res) => {
    try {
        const shipment = await Shipment.findById(req.params.id);
        if (!shipment) {
            return res.status(404).json({ error: 'Shipment not found' });
        }
        res.json(shipment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create new shipment with geocoding
exports.createShipment = async (req, res) => {
    try {
        const shipmentData = req.body;

        // Geocode locations
        const [originCoords, currentCoords, destinationCoords] = await Promise.all([
            geocodeLocation(shipmentData.route.origin),
            geocodeLocation(shipmentData.route.currentLocation),
            geocodeLocation(shipmentData.route.destination)
        ]);

        // Create shipment with map coordinates
        const shipment = new Shipment({
            ...shipmentData,
            map: {
                originCoordinates: originCoords,
                currentCoordinates: currentCoords,
                destinationCoordinates: destinationCoords
            }
        });

        await shipment.save();
        res.status(201).json(shipment);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Update shipment
exports.updateShipment = async (req, res) => {
    try {
        const shipmentData = req.body;
        const shipment = await Shipment.findById(req.params.id);
        
        if (!shipment) {
            return res.status(404).json({ error: 'Shipment not found' });
        }

        // Update geocoding if location changed
        if (shipmentData.route) {
            const originCoords = shipmentData.route.origin !== shipment.route.origin ? 
                await geocodeLocation(shipmentData.route.origin) : shipment.map.originCoordinates;
            const currentCoords = shipmentData.route.currentLocation !== shipment.route.currentLocation ?
                await geocodeLocation(shipmentData.route.currentLocation) : shipment.map.currentCoordinates;
            const destinationCoords = shipmentData.route.destination !== shipment.route.destination ?
                await geocodeLocation(shipmentData.route.destination) : shipment.map.destinationCoordinates;

            shipmentData.map = {
                originCoordinates: originCoords,
                currentCoordinates: currentCoords,
                destinationCoordinates: destinationCoords
            };
        }

        // Update shipment
        Object.assign(shipment, shipmentData);
        await shipment.save();
        
        res.json(shipment);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete shipment
exports.deleteShipment = async (req, res) => {
    try {
        const shipment = await Shipment.findById(req.params.id);
        if (!shipment) {
            return res.status(404).json({ error: 'Shipment not found' });
        }
        await shipment.deleteOne();
        res.json({ message: 'Shipment deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Add tracking update
exports.addTrackingUpdate = async (req, res) => {
    try {
        const { trackingId } = req.params;
        const updateData = req.body;

        const shipment = await Shipment.findOne({ trackingId });
        if (!shipment) {
            return res.status(404).json({ error: 'Shipment not found' });
        }

        // Add tracking update
        shipment.trackingHistory.push({
            status: updateData.status,
            location: updateData.location,
            comment: updateData.comment,
            date: updateData.date || new Date(),
            time: updateData.time || new Date().toLocaleTimeString('en-US', { hour12: false })
        });

        // Update shipment status
        shipment.shipmentInfo.status = updateData.status;
        shipment.shipmentInfo.lastUpdated = new Date();

        // Update current location if provided
        if (updateData.location) {
            shipment.route.currentLocation = updateData.location;
            const coords = await geocodeLocation(updateData.location);
            if (coords) {
                shipment.map.currentCoordinates = coords;
            }
        }

        await shipment.save();
        res.json(shipment);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
    try {
        const stats = await Shipment.aggregate([
            {
                $facet: {
                    total: [{ $count: 'count' }],
                    byStatus: [
                        { $group: { _id: '$shipmentInfo.status', count: { $sum: 1 } } }
                    ],
                    byType: [
                        { $group: { _id: '$shipmentInfo.shipmentType', count: { $sum: 1 } } }
                    ],
                    monthlyStats: [
                        {
                            $group: {
                                _id: {
                                    year: { $year: '$createdAt' },
                                    month: { $month: '$createdAt' }
                                },
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { '_id.year': 1, '_id.month': 1 } },
                        { $limit: 12 }
                    ]
                }
            }
        ]);

        const result = stats[0];
        const statusCounts = {};
        result.byStatus.forEach(item => {
            statusCounts[item._id] = item.count;
        });

        res.json({
            totalShipments: result.total[0]?.count || 0,
            statusCounts,
            byType: result.byType,
            monthlyStats: result.monthlyStats
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get recent shipments
exports.getRecentShipments = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const shipments = await Shipment.find()
            .sort({ createdAt: -1 })
            .limit(limit);
        res.json(shipments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};