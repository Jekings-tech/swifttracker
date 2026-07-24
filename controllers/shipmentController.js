const Shipment = require('../models/Shipment');
const axios = require('axios');

// ✅ FIXED: Geocode function with better error handling and logging
const geocodeLocation = async (location) => {
    try {
        if (!location) {
            console.log('⚠️ No location provided');
            return null;
        }

        console.log(`📍 Geocoding: "${location}"`);

        const response = await axios.get(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json`,
            {
                params: {
                    access_token: process.env.MAPBOX_TOKEN,
                    limit: 5
                }
            }
        );

        if (response.data.features && response.data.features.length > 0) {
            const [lng, lat] = response.data.features[0].center;
            console.log(`✅ Geocoded "${location}" → ${lat}, ${lng}`);
            return { lat, lng };
        }

        console.log(`❌ No results for "${location}"`);
        return null;
    } catch (error) {
        console.error('❌ Geocoding error:', error.message);
        return null;
    }
};

// Get all shipments with filtering, sorting, pagination
exports.getAllShipments = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

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

// ✅ FIXED: Create new shipment with geocoding - NOW WITH ERROR HANDLING
exports.createShipment = async (req, res) => {
    try {
        const shipmentData = req.body;

        console.log('📍 Creating shipment with:');
        console.log('Origin:', shipmentData.route.origin);
        console.log('Current:', shipmentData.route.currentLocation);
        console.log('Destination:', shipmentData.route.destination);

        // Geocode locations
        const [originCoords, currentCoords, destinationCoords] = await Promise.all([
            geocodeLocation(shipmentData.route.origin),
            geocodeLocation(shipmentData.route.currentLocation),
            geocodeLocation(shipmentData.route.destination)
        ]);

        console.log('📍 Geocoded results:');
        console.log('Origin:', originCoords);
        console.log('Current:', currentCoords);
        console.log('Destination:', destinationCoords);

        // ✅ FIX: Create shipment with map coordinates - NO NULL VALUES
        const shipment = new Shipment({
            ...shipmentData,
            map: {
                originCoordinates: originCoords || { lat: 4.0511, lng: 9.7679 }, // Default Douala
                currentCoordinates: currentCoords || { lat: 6.5244, lng: 3.3792 }, // Default Lagos
                destinationCoordinates: destinationCoords || { lat: 5.6037, lng: -0.1870 } // Default Accra
            }
        });

        await shipment.save();
        console.log('✅ Shipment saved with map:', shipment.map);
        
        res.status(201).json(shipment);
    } catch (error) {
        console.error('❌ Create shipment error:', error);
        res.status(400).json({ error: error.message });
    }
};

// ✅ FIXED: Update shipment - preserves map data when not provided
exports.updateShipment = async (req, res) => {
    try {
        const shipmentData = req.body;
        const shipment = await Shipment.findById(req.params.id);
        
        if (!shipment) {
            return res.status(404).json({ error: 'Shipment not found' });
        }

        // ✅ CRITICAL FIX: Keep existing map data if frontend doesn't send it
        if (!shipmentData.map) {
            shipmentData.map = shipment.map || {
                originCoordinates: { lat: 4.0511, lng: 9.7679 },
                currentCoordinates: { lat: 6.5244, lng: 3.3792 },
                destinationCoordinates: { lat: 5.6037, lng: -0.1870 }
            };
        }

        // Update geocoding if location changed
        if (shipmentData.route) {
            // Only geocode if location actually changed
            if (shipmentData.route.origin && shipmentData.route.origin !== shipment.route.origin) {
                const coords = await geocodeLocation(shipmentData.route.origin);
                if (coords) {
                    shipmentData.map.originCoordinates = coords;
                }
            }
            
            if (shipmentData.route.currentLocation && shipmentData.route.currentLocation !== shipment.route.currentLocation) {
                const coords = await geocodeLocation(shipmentData.route.currentLocation);
                if (coords) {
                    shipmentData.map.currentCoordinates = coords;
                }
            }
            
            if (shipmentData.route.destination && shipmentData.route.destination !== shipment.route.destination) {
                const coords = await geocodeLocation(shipmentData.route.destination);
                if (coords) {
                    shipmentData.map.destinationCoordinates = coords;
                }
            }
        }

        // Update shipment with all data
        Object.assign(shipment, shipmentData);
        await shipment.save();
        
        res.json(shipment);
    } catch (error) {
        console.error('Error updating shipment:', error);
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

        shipment.trackingHistory.push({
            status: updateData.status,
            location: updateData.location,
            comment: updateData.comment,
            date: updateData.date || new Date(),
            time: updateData.time || new Date().toLocaleTimeString('en-US', { hour12: false })
        });

        shipment.shipmentInfo.status = updateData.status;
        shipment.shipmentInfo.lastUpdated = new Date();

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