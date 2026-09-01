const mongoose = require('mongoose');

const trackingUpdateSchema = new mongoose.Schema({
    status: {
        type: String,
        required: true,
        enum: [
            'Pending', 'Pickup Scheduled', 'Picked Up', 'In Transit',
            'At Facility', 'Customs Clearance', 'Out for Delivery',
            'Delivered', 'Delayed', 'On Hold', 'Exception',
            'Returned', 'Cancelled', 'Lost', 'Damaged'
        ]
    },
    location: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    time: {
        type: String,
        default: () => new Date().toLocaleTimeString('en-US', { hour12: false })
    },
    comment: {
        type: String,
        default: ''
    }
}, { _id: true });

// ===== NEW: Shipment Progress Schema (4 Steps) =====
const shipmentProgressSchema = new mongoose.Schema({
    orderConfirmed: {
        selected: {
            type: Boolean,
            default: true
        },
        date: {
            type: Date,
            default: Date.now
        }
    },
    pickedByCourier: {
        selected: {
            type: Boolean,
            default: false
        },
        date: {
            type: Date,
            default: null
        }
    },
    customHold: {
        selected: {
            type: Boolean,
            default: false
        },
        date: {
            type: Date,
            default: null
        },
        reason: {
            type: String,
            default: ''
        },
        amount: {
            type: Number,
            default: 0
        }
    },
    delivered: {
        selected: {
            type: Boolean,
            default: false
        },
        date: {
            type: Date,
            default: null
        }
    }
}, { _id: false });

const shipmentSchema = new mongoose.Schema({
    trackingId: {
        type: String,
        unique: true,
        required: true,
        default: function() {
            const prefix = 'TRK';
            const timestamp = Date.now().toString().slice(-8);
            const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            return `${prefix}${timestamp}${random}`;
        }
    },
    shipmentInfo: {
        status: {
            type: String,
            required: true,
            enum: [
                'Pending', 'Pickup Scheduled', 'Picked Up', 'In Transit',
                'At Facility', 'Customs Clearance', 'Out for Delivery',
                'Delivered', 'Delayed', 'On Hold', 'Exception',
                'Returned', 'Cancelled', 'Lost', 'Damaged'
            ],
            default: 'Pending'
        },
        carrier: {
            type: String,
            required: true
        },
        shipmentType: {
            type: String,
            required: true,
            enum: ['Road Freight', 'Air Freight', 'Ocean Freight', 'Rail Freight', 'Express Delivery']
        },
        estimatedDelivery: {
            type: Date,
            required: true
        },
        lastUpdated: {
            type: Date,
            default: Date.now
        },
        comments: {
            type: String,
            default: ''
        }
    },
    shipper: {
        name: {
            type: String,
            required: true
        },
        address: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        },
        phone: {
            type: String,
            required: true
        }
    },
    recipient: {
        name: {
            type: String,
            required: true
        },
        address: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        },
        phone: {
            type: String,
            required: true
        }
    },
    route: {
        origin: {
            type: String,
            required: true
        },
        currentLocation: {
            type: String,
            required: true
        },
        destination: {
            type: String,
            required: true
        },
        pickupDate: {
            type: Date,
            required: true
        },
        pickupTime: {
            type: String,
            required: true
        },
        departureDate: {
            type: Date,
            required: true
        },
        departureTime: {
            type: String,
            required: true
        }
    },
    package: {
        packageType: {
            type: String,
            required: true
        },
        pieces: {
            type: Number,
            required: true,
            min: 1
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        weight: {
            type: Number,
            required: true,
            min: 0
        },
        dimensions: {
            type: String,
            required: true
        },
        description: {
            type: String,
            default: ''
        }
    },
    // ===== UPDATED: Payment Schema - REMOVED paymentMode, ADDED adminNotes =====
    payment: {
        adminNotes: {
            type: String,
            default: ''
        },
        freightCost: {
            type: Number,
            required: true,
            min: 0
        },
        paymentStatus: {
            type: String,
            required: true,
            enum: ['Pending', 'Paid', 'Partially Paid', 'Overdue']
        }
    },
    // ===== NEW: Item Image (Optional) =====
    itemImage: {
        type: String,
        default: null
    },
    // ===== NEW: Shipment Progress (4 Steps) =====
    shipmentProgress: {
        type: shipmentProgressSchema,
        default: () => ({
            orderConfirmed: { selected: true, date: new Date() },
            pickedByCourier: { selected: false, date: null },
            customHold: { selected: false, date: null, reason: '', amount: 0 },
            delivered: { selected: false, date: null }
        })
    },
    map: {
        originCoordinates: {
            lat: { type: Number, default: null },
            lng: { type: Number, default: null }
        },
        currentCoordinates: {
            lat: { type: Number, default: null },
            lng: { type: Number, default: null }
        },
        destinationCoordinates: {
            lat: { type: Number, default: null },
            lng: { type: Number, default: null }
        }
    },
    trackingHistory: [trackingUpdateSchema],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Generate tracking ID before saving
shipmentSchema.pre('save', function(next) {
    if (!this.trackingId || this.trackingId === '') {
        const prefix = 'TRK';
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        this.trackingId = `${prefix}${timestamp}${random}`;
        console.log('✅ Generated tracking ID:', this.trackingId);
    }
    this.updatedAt = Date.now();
    next();
});

// Add initial tracking update when shipment is created
shipmentSchema.pre('save', function(next) {
    if (this.isNew && this.trackingHistory.length === 0) {
        this.trackingHistory.push({
            status: this.shipmentInfo.status || 'Pending',
            location: this.route.origin || 'Unknown',
            comment: 'Shipment created successfully'
        });
    }
    next();
});

module.exports = mongoose.model('Shipment', shipmentSchema);