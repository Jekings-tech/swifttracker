const emailService = require('../utils/email');
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

// ===== NEW: Image validation function =====
const validateImageSize = (imageBase64, maxSizeMB = 1) => {
    if (!imageBase64) return { valid: true };
    
    try {
        // Check if it's a valid base64 image
        const base64Data = imageBase64.split(',')[1];
        if (!base64Data) {
            return { valid: false, error: 'Invalid image format' };
        }
        
        // Calculate size in bytes
        const sizeInBytes = Buffer.from(base64Data, 'base64').length;
        const sizeInMB = sizeInBytes / (1024 * 1024);
        
        console.log(`📸 Image size: ${(sizeInBytes / 1024).toFixed(2)} KB (${sizeInMB.toFixed(2)} MB)`);
        
        if (sizeInMB > maxSizeMB) {
            return { 
                valid: false, 
                error: `Image too large (${sizeInMB.toFixed(2)} MB). Maximum allowed: ${maxSizeMB} MB. Please compress your image.` 
            };
        }
        
        return { valid: true, sizeInMB };
    } catch (error) {
        return { valid: false, error: 'Error processing image: ' + error.message };
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

// ✅ UPDATED: Create new shipment with ALL new fields + image validation + EMAIL
exports.createShipment = async (req, res) => {
    try {
        const shipmentData = req.body;

        // ===== VALIDATE IMAGE SIZE =====
        if (shipmentData.itemImage) {
            const validation = validateImageSize(shipmentData.itemImage, 1); // 1MB max
            if (!validation.valid) {
                return res.status(400).json({ error: validation.error });
            }
        }

        console.log('📍 Creating shipment with:');
        console.log('Origin:', shipmentData.route?.origin);
        console.log('Current:', shipmentData.route?.currentLocation);
        console.log('Destination:', shipmentData.route?.destination);
        console.log('📸 Item Image:', shipmentData.itemImage ? 'Yes (uploaded)' : 'No');
        console.log('📝 Payment Notes:', shipmentData.payment?.adminNotes || 'None');

        // Geocode locations
        const [originCoords, currentCoords, destinationCoords] = await Promise.all([
            geocodeLocation(shipmentData.route?.origin),
            geocodeLocation(shipmentData.route?.currentLocation),
            geocodeLocation(shipmentData.route?.destination)
        ]);

        console.log('📍 Geocoded results:');
        console.log('Origin:', originCoords);
        console.log('Current:', currentCoords);
        console.log('Destination:', destinationCoords);

        // ===== BUILD SHIPMENT WITH ALL NEW FIELDS =====
        const shipment = new Shipment({
            // Basic shipment info
            shipmentInfo: shipmentData.shipmentInfo || {},
            shipper: shipmentData.shipper || {},
            recipient: shipmentData.recipient || {},
            route: shipmentData.route || {},
            package: shipmentData.package || {},
            
            // ===== UPDATED PAYMENT (removed paymentMode, added adminNotes) =====
            payment: {
                adminNotes: shipmentData.payment?.adminNotes || '',
                freightCost: shipmentData.payment?.freightCost || 0,
                paymentStatus: shipmentData.payment?.paymentStatus || 'Pending'
            },
            
            // ===== NEW: Item Image (Optional) =====
            itemImage: shipmentData.itemImage || null,
            
            // ===== NEW: Shipment Progress (4 Steps) =====
            shipmentProgress: {
                orderConfirmed: {
                    selected: true,
                    date: new Date()
                },
                pickedByCourier: {
                    selected: shipmentData.shipmentProgress?.pickedByCourier?.selected || false,
                    date: shipmentData.shipmentProgress?.pickedByCourier?.date || null
                },
                customHold: {
                    selected: shipmentData.shipmentProgress?.customHold?.selected || false,
                    date: shipmentData.shipmentProgress?.customHold?.date || null,
                    reason: shipmentData.shipmentProgress?.customHold?.reason || '',
                    amount: shipmentData.shipmentProgress?.customHold?.amount || 0
                },
                delivered: {
                    selected: shipmentData.shipmentProgress?.delivered?.selected || false,
                    date: shipmentData.shipmentProgress?.delivered?.date || null
                }
            },
            
            // Map coordinates
            map: {
                originCoordinates: originCoords || { lat: 4.0511, lng: 9.7679 },
                currentCoordinates: currentCoords || { lat: 6.5244, lng: 3.3792 },
                destinationCoordinates: destinationCoords || { lat: 5.6037, lng: -0.1870 }
            }
        });

        await shipment.save();
        console.log('✅ Shipment saved with all fields');
        console.log('✅ Shipment Progress:', shipment.shipmentProgress);
        console.log('✅ Payment Notes:', shipment.payment.adminNotes);
        console.log('✅ Item Image:', shipment.itemImage ? 'Uploaded' : 'None');

        // ===== SEND CONFIRMATION EMAIL TO BOTH RECIPIENT AND SHIPPER =====
        try {
            await emailService.sendShipmentCreated(shipment);
            console.log('📧 Confirmation email sent to recipient and shipper');
        } catch (emailError) {
            console.error('❌ Email failed (non-critical):', emailError.message);
            // Don't fail the shipment creation if email fails
        }
        
        res.status(201).json(shipment);
    } catch (error) {
        console.error('❌ Create shipment error:', error);
        res.status(400).json({ error: error.message });
    }
};

// ✅ UPDATED: Update shipment with ALL new fields + image validation
exports.updateShipment = async (req, res) => {
    try {
        const shipmentData = req.body;
        const shipment = await Shipment.findById(req.params.id);
        
        if (!shipment) {
            return res.status(404).json({ error: 'Shipment not found' });
        }

        // ===== VALIDATE IMAGE SIZE =====
        if (shipmentData.itemImage) {
            const validation = validateImageSize(shipmentData.itemImage, 1); // 1MB max
            if (!validation.valid) {
                return res.status(400).json({ error: validation.error });
            }
        }

        console.log('📝 Updating shipment:', shipment.trackingId);
        console.log('📸 Item Image:', shipmentData.itemImage ? 'Yes (uploaded)' : 'No');
        console.log('📝 Payment Notes:', shipmentData.payment?.adminNotes || 'None');

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

        // ===== UPDATE SHIPMENT WITH ALL FIELDS =====
        // Update basic info
        if (shipmentData.shipmentInfo) {
            shipment.shipmentInfo = {
                ...shipment.shipmentInfo,
                ...shipmentData.shipmentInfo
            };
        }
        
        if (shipmentData.shipper) {
            shipment.shipper = { ...shipment.shipper, ...shipmentData.shipper };
        }
        
        if (shipmentData.recipient) {
            shipment.recipient = { ...shipment.recipient, ...shipmentData.recipient };
        }
        
        if (shipmentData.route) {
            shipment.route = { ...shipment.route, ...shipmentData.route };
        }
        
        if (shipmentData.package) {
            shipment.package = { ...shipment.package, ...shipmentData.package };
        }

        // ===== UPDATE PAYMENT (removed paymentMode, added adminNotes) =====
        if (shipmentData.payment) {
            shipment.payment = {
                adminNotes: shipmentData.payment.adminNotes !== undefined ? shipmentData.payment.adminNotes : shipment.payment.adminNotes,
                freightCost: shipmentData.payment.freightCost !== undefined ? shipmentData.payment.freightCost : shipment.payment.freightCost,
                paymentStatus: shipmentData.payment.paymentStatus || shipment.payment.paymentStatus
            };
        }

        // ===== UPDATE ITEM IMAGE =====
        if (shipmentData.itemImage !== undefined) {
            shipment.itemImage = shipmentData.itemImage;
        }

        // ===== UPDATE SHIPMENT PROGRESS (4 Steps) =====
        if (shipmentData.shipmentProgress) {
            shipment.shipmentProgress = {
                orderConfirmed: {
                    selected: shipmentData.shipmentProgress.orderConfirmed?.selected !== undefined ? 
                        shipmentData.shipmentProgress.orderConfirmed.selected : 
                        shipment.shipmentProgress.orderConfirmed.selected,
                    date: shipmentData.shipmentProgress.orderConfirmed?.date || 
                        shipment.shipmentProgress.orderConfirmed.date || new Date()
                },
                pickedByCourier: {
                    selected: shipmentData.shipmentProgress.pickedByCourier?.selected !== undefined ? 
                        shipmentData.shipmentProgress.pickedByCourier.selected : 
                        shipment.shipmentProgress.pickedByCourier.selected,
                    date: shipmentData.shipmentProgress.pickedByCourier?.date || 
                        shipment.shipmentProgress.pickedByCourier.date
                },
                customHold: {
                    selected: shipmentData.shipmentProgress.customHold?.selected !== undefined ? 
                        shipmentData.shipmentProgress.customHold.selected : 
                        shipment.shipmentProgress.customHold.selected,
                    date: shipmentData.shipmentProgress.customHold?.date || 
                        shipment.shipmentProgress.customHold.date,
                    reason: shipmentData.shipmentProgress.customHold?.reason || 
                        shipment.shipmentProgress.customHold.reason || '',
                    amount: shipmentData.shipmentProgress.customHold?.amount !== undefined ? 
                        shipmentData.shipmentProgress.customHold.amount : 
                        shipment.shipmentProgress.customHold.amount || 0
                },
                delivered: {
                    selected: shipmentData.shipmentProgress.delivered?.selected !== undefined ? 
                        shipmentData.shipmentProgress.delivered.selected : 
                        shipment.shipmentProgress.delivered.selected,
                    date: shipmentData.shipmentProgress.delivered?.date || 
                        shipment.shipmentProgress.delivered.date
                }
            };
        }

        // Update map
        if (shipmentData.map) {
            shipment.map = {
                ...shipment.map,
                ...shipmentData.map
            };
        }

        await shipment.save();
        console.log('✅ Shipment updated successfully');
        console.log('✅ Shipment Progress:', shipment.shipmentProgress);
        
        res.json(shipment);
    } catch (error) {
        console.error('❌ Error updating shipment:', error);
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

// ✅ UPDATED: Add tracking update with progress sync
exports.addTrackingUpdate = async (req, res) => {
    try {
        const { trackingId } = req.params;
        const updateData = req.body;

        const shipment = await Shipment.findOne({ trackingId });
        if (!shipment) {
            return res.status(404).json({ error: 'Shipment not found' });
        }

        // Store old status before updating
        const oldStatus = shipment.shipmentInfo.status;

        // Add tracking history entry
        shipment.trackingHistory.push({
            status: updateData.status,
            location: updateData.location,
            comment: updateData.comment,
            date: updateData.date || new Date(),
            time: updateData.time || new Date().toLocaleTimeString('en-US', { hour12: false })
        });

        // Update main status
        shipment.shipmentInfo.status = updateData.status;
        shipment.shipmentInfo.lastUpdated = new Date();

        // Update location if provided
        if (updateData.location) {
            shipment.route.currentLocation = updateData.location;
            const coords = await geocodeLocation(updateData.location);
            if (coords) {
                shipment.map.currentCoordinates = coords;
            }
        }

        // ===== SYNC SHIPMENT PROGRESS BASED ON STATUS =====
        const status = updateData.status.toLowerCase();
        
        // Order Confirmed is always true (already set)
        
        // Picked by Courier
        if (status === 'picked up' || status === 'in transit' || status === 'out for delivery' || status === 'delivered') {
            shipment.shipmentProgress.pickedByCourier.selected = true;
            if (!shipment.shipmentProgress.pickedByCourier.date) {
                shipment.shipmentProgress.pickedByCourier.date = new Date();
            }
        }
        
        // Custom Hold
        if (status === 'on hold' || status === 'customs clearance') {
            shipment.shipmentProgress.customHold.selected = true;
            if (!shipment.shipmentProgress.customHold.date) {
                shipment.shipmentProgress.customHold.date = new Date();
            }
            // If updateData has reason, use it
            if (updateData.comment) {
                shipment.shipmentProgress.customHold.reason = updateData.comment;
            }
        }
        
        // Delivered
        if (status === 'delivered') {
            shipment.shipmentProgress.delivered.selected = true;
            if (!shipment.shipmentProgress.delivered.date) {
                shipment.shipmentProgress.delivered.date = new Date();
            }
        }

        await shipment.save();
        console.log('✅ Tracking update added');
        console.log('✅ Updated Progress:', shipment.shipmentProgress);

        // ===== SEND STATUS UPDATE EMAIL IF STATUS CHANGED =====
        if (oldStatus !== updateData.status) {
            try {
                await emailService.sendShipmentStatusUpdate(shipment, oldStatus, updateData.status);
                console.log('📧 Status update email sent to recipient and shipper');
            } catch (emailError) {
                console.error('❌ Status email failed (non-critical):', emailError.message);
            }
        }
        
        res.json(shipment);
    } catch (error) {
        console.error('❌ Error adding tracking update:', error);
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