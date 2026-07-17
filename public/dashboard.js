// ===== STATE MANAGEMENT =====
const state = {
    currentPage: 'dashboard',
    shipments: [],
    currentShipment: null,
    isEditing: false,
    currentPageNum: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10,
    filters: {
        search: '',
        status: '',
        type: '',
        date: ''
    },
    sort: {
        field: 'createdAt',
        order: 'desc'
    }
};

// ===== DOM REFS =====
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
    loadDashboard();
});

// ===== AUTH =====
function checkAuth() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Sidebar toggle
    $('sidebarToggle').addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('collapsed');
    });

    // Navigation
    document.querySelectorAll('.sidebar-nav a[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            navigateTo(page);
        });
    });

    // Logout
    $('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });

    // Global search
    $('globalSearch').addEventListener('input', debounce((e) => {
        state.filters.search = e.target.value;
        if (state.currentPage === 'shipments') {
            loadShipments();
        }
    }, 500));

    // Shipment form
    $('shipmentForm').addEventListener('submit', handleFormSubmit);
    $('cancelFormBtn').addEventListener('click', () => navigateTo('shipments'));
    $('cancelFormBtn2').addEventListener('click', () => navigateTo('shipments'));

    // Shipments page filters
    $('shipmentSearch').addEventListener('input', debounce((e) => {
        state.filters.search = e.target.value;
        state.currentPageNum = 1;
        loadShipments();
    }, 500));

    $('filterStatus').addEventListener('change', (e) => {
        state.filters.status = e.target.value;
        state.currentPageNum = 1;
        loadShipments();
    });

    $('filterType').addEventListener('change', (e) => {
        state.filters.type = e.target.value;
        state.currentPageNum = 1;
        loadShipments();
    });

    $('filterDate').addEventListener('change', (e) => {
        state.filters.date = e.target.value;
        state.currentPageNum = 1;
        loadShipments();
    });

    $('resetFilters').addEventListener('click', resetFilters);

    // Sorting
    document.querySelectorAll('#allShipmentsTable th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if (state.sort.field === field) {
                state.sort.order = state.sort.order === 'asc' ? 'desc' : 'asc';
            } else {
                state.sort.field = field;
                state.sort.order = 'asc';
            }
            loadShipments();
        });
    });

    // Pagination
    $('prevPage').addEventListener('click', () => {
        if (state.currentPageNum > 1) {
            state.currentPageNum--;
            loadShipments();
        }
    });

    $('nextPage').addEventListener('click', () => {
        if (state.currentPageNum < state.totalPages) {
            state.currentPageNum++;
            loadShipments();
        }
    });

    // Add shipment button
    $('addShipmentBtn')?.addEventListener('click', () => {
        navigateTo('add-shipment');
        resetForm();
    });

    // Tracking search
    $('trackingSearchBtn').addEventListener('click', handleTrackingSearch);
    $('trackingSearch').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleTrackingSearch();
    });

    // Export report
    $('exportReportBtn')?.addEventListener('click', exportReport);
}

// ===== NAVIGATION =====
function navigateTo(page) {
    state.currentPage = page;
    
    // Update sidebar
    document.querySelectorAll('.sidebar-nav a[data-page]').forEach(link => {
        link.closest('li').classList.toggle('active', link.dataset.page === page);
    });

    // Update pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = $(`page-${page}`);
    if (targetPage) {
        targetPage.classList.add('active');
    }

    // Update header
    const titles = {
        dashboard: ['Dashboard', 'Overview of your logistics operations'],
        shipments: ['All Shipments', 'Manage and track all shipments'],
        'add-shipment': ['Add Shipment', 'Create a new shipment'],
        tracking: ['Tracking History', 'Track any shipment by ID'],
        reports: ['Reports', 'View analytics and reports']
    };
    
    const [title, subtitle] = titles[page] || ['Page', ''];
    $('pageTitle').textContent = title;
    $('pageSubtitle').textContent = subtitle;

    // Load page data
    switch(page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'shipments':
            loadShipments();
            break;
        case 'add-shipment':
            // Form already ready
            break;
        case 'tracking':
            // Clear previous tracking results
            $('trackingResult').innerHTML = `
                <div class="tracking-placeholder">
                    <i class="fas fa-map-marked-alt"></i>
                    <p>Enter a tracking ID to view shipment details and tracking history</p>
                </div>
            `;
            break;
        case 'reports':
            loadReports();
            break;
    }
}

// ===== LOGOUT =====
function logout() {
    fetch('/api/logout', { method: 'POST' })
        .then(() => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            window.location.href = '/login.html';
        })
        .catch(() => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            window.location.href = '/login.html';
        });
}

// ===== API HELPERS =====
function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
    };
}

async function apiFetch(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...getHeaders(),
            ...options.headers
        }
    });
    
    if (response.status === 401) {
        logout();
        throw new Error('Unauthorized');
    }
    
    return response;
}

// ===== DASHBOARD =====
async function loadDashboard() {
    try {
        const statsResponse = await apiFetch('/api/shipments/stats');
        const stats = await statsResponse.json();
        
        updateStats(stats);
        updateCharts(stats);
        
        const recentResponse = await apiFetch('/api/shipments/recent?limit=10');
        const recent = await recentResponse.json();
        renderRecentShipments(recent);
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('Error loading dashboard data', 'error');
    }
}

function updateStats(stats) {
    const statusMap = {
        'total': stats.totalShipments,
        'pending': stats.statusCounts['Pending'] || 0,
        'pickup-scheduled': stats.statusCounts['Pickup Scheduled'] || 0,
        'picked-up': stats.statusCounts['Picked Up'] || 0,
        'in-transit': stats.statusCounts['In Transit'] || 0,
        'at-facility': stats.statusCounts['At Facility'] || 0,
        'out-for-delivery': stats.statusCounts['Out for Delivery'] || 0,
        'delivered': stats.statusCounts['Delivered'] || 0,
        'delayed': stats.statusCounts['Delayed'] || 0,
        'on-hold': stats.statusCounts['On Hold'] || 0,
        'exception': stats.statusCounts['Exception'] || 0,
        'cancelled': stats.statusCounts['Cancelled'] || 0
    };
    
    Object.entries(statusMap).forEach(([key, value]) => {
        const el = document.getElementById(key === 'total' ? 'totalShipments' : key);
        if (el) {
            animateNumber(el, value);
        }
    });
}

function animateNumber(el, target) {
    const duration = 500;
    const start = parseInt(el.textContent) || 0;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const current = Math.round(start + (target - start) * easeOutQuad(progress));
        el.textContent = current.toLocaleString();
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

function easeOutQuad(t) {
    return t * (2 - t);
}

// ===== CHARTS =====
let statusChartInstance, typeChartInstance, monthlyChartInstance;

function updateCharts(stats) {
    // Status Chart
    const statusCtx = document.getElementById('statusChart')?.getContext('2d');
    if (statusCtx) {
        if (statusChartInstance) statusChartInstance.destroy();
        
        const statusData = stats.byStatus || [];
        const colors = [
            '#667eea', '#ed8936', '#48bb78', '#4299e1', '#9f7aea',
            '#fc8181', '#ed64a6', '#f6ad55', '#68d391', '#63b3ed'
        ];
        
        statusChartInstance = new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: statusData.map(s => s._id),
                datasets: [{
                    data: statusData.map(s => s.count),
                    backgroundColor: colors.slice(0, statusData.length),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            padding: 12,
                            usePointStyle: true,
                            font: { size: 12 }
                        }
                    }
                },
                cutout: '70%'
            }
        });
    }

    // Type Chart
    const typeCtx = document.getElementById('typeChart')?.getContext('2d');
    if (typeCtx) {
        if (typeChartInstance) typeChartInstance.destroy();
        
        const typeData = stats.byType || [];
        const typeColors = ['#667eea', '#48bb78', '#ed8936', '#fc8181', '#9f7aea'];
        
        typeChartInstance = new Chart(typeCtx, {
            type: 'bar',
            data: {
                labels: typeData.map(t => t._id),
                datasets: [{
                    label: 'Shipments',
                    data: typeData.map(t => t.count),
                    backgroundColor: typeColors.slice(0, typeData.length),
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    }

    // Monthly Chart
    const monthlyCtx = document.getElementById('monthlyChart')?.getContext('2d');
    if (monthlyCtx) {
        if (monthlyChartInstance) monthlyChartInstance.destroy();
        
        const monthlyData = stats.monthlyStats || [];
        const months = monthlyData.map(m => {
            const date = new Date(m._id.year, m._id.month - 1);
            return date.toLocaleString('default', { month: 'short' });
        });
        
        monthlyChartInstance = new Chart(monthlyCtx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Shipments',
                    data: monthlyData.map(m => m.count),
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#667eea',
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    }
}

// ===== RECENT SHIPMENTS =====
function renderRecentShipments(shipments) {
    const tbody = $('recentShipmentsBody');
    
    if (!shipments || shipments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="loading-text">No shipments found</td></tr>`;
        return;
    }
    
    tbody.innerHTML = shipments.map(s => `
        <tr>
            <td><strong>${s.trackingId}</strong></td>
            <td>${s.shipper.name}</td>
            <td>${s.recipient.name}</td>
            <td><span class="status-badge ${s.shipmentInfo.status.toLowerCase().replace(/\s+/g, '-')}">${s.shipmentInfo.status}</span></td>
            <td>${s.shipmentInfo.shipmentType}</td>
            <td>${formatDate(s.createdAt)}</td>
            <td>
                <div class="table-actions">
                    <button class="view-btn" onclick="viewShipment('${s._id}')" title="View"><i class="fas fa-eye"></i></button>
                    <button class="edit-btn" onclick="editShipment('${s._id}')" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn" onclick="deleteShipment('${s._id}')" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ===== SHIPMENTS =====
async function loadShipments() {
    try {
        const params = new URLSearchParams({
            page: state.currentPageNum,
            limit: state.itemsPerPage,
            search: state.filters.search,
            status: state.filters.status,
            shipmentType: state.filters.type,
            sortBy: state.sort.field,
            order: state.sort.order
        });
        
        if (state.filters.date) {
            params.append('createdAt', state.filters.date);
        }
        
        const response = await apiFetch(`/api/shipments?${params}`);
        const data = await response.json();
        
        state.shipments = data.shipments;
        state.totalPages = data.totalPages;
        state.totalItems = data.totalItems;
        
        renderShipmentsTable(data.shipments);
        updatePagination();
        
    } catch (error) {
        console.error('Error loading shipments:', error);
        showToast('Error loading shipments', 'error');
    }
}

function renderShipmentsTable(shipments) {
    const tbody = $('allShipmentsBody');
    
    if (!shipments || shipments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="loading-text">No shipments found</td></tr>`;
        return;
    }
    
    tbody.innerHTML = shipments.map(s => `
        <tr>
            <td><strong>${s.trackingId}</strong></td>
            <td>${s.shipper.name}</td>
            <td>${s.recipient.name}</td>
            <td><span class="status-badge ${s.shipmentInfo.status.toLowerCase().replace(/\s+/g, '-')}">${s.shipmentInfo.status}</span></td>
            <td>${s.shipmentInfo.shipmentType}</td>
            <td>${formatDate(s.createdAt)}</td>
            <td>
                <div class="table-actions">
                    <button class="view-btn" onclick="viewShipment('${s._id}')" title="View"><i class="fas fa-eye"></i></button>
                    <button class="edit-btn" onclick="editShipment('${s._id}')" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn" onclick="deleteShipment('${s._id}')" title="Delete"><i class="fas fa-trash"></i></button>
                    <button class="track-btn" onclick="trackShipment('${s.trackingId}')" title="Track"><i class="fas fa-map-marker-alt"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function updatePagination() {
    $('pageInfo').textContent = `${(state.currentPageNum - 1) * state.itemsPerPage + 1} - ${Math.min(state.currentPageNum * state.itemsPerPage, state.totalItems)}`;
    $('totalItems').textContent = state.totalItems;
    $('prevPage').disabled = state.currentPageNum <= 1;
    $('nextPage').disabled = state.currentPageNum >= state.totalPages;
    $('pageNumbers').textContent = `${state.currentPageNum} / ${state.totalPages || 1}`;
}

function resetFilters() {
    state.filters = { search: '', status: '', type: '', date: '' };
    state.currentPageNum = 1;
    $('shipmentSearch').value = '';
    $('filterStatus').value = '';
    $('filterType').value = '';
    $('filterDate').value = '';
    loadShipments();
}

// ===== SHIPMENT CRUD =====
async function viewShipment(id) {
    try {
        const response = await apiFetch(`/api/shipments/${id}`);
        const shipment = await response.json();
        showShipmentDetails(shipment);
    } catch (error) {
        console.error('Error viewing shipment:', error);
        showToast('Error loading shipment details', 'error');
    }
}

function showShipmentDetails(shipment) {
    // Create modal with shipment details
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content shipment-details">
            <div class="modal-header">
                <h2>Shipment Details - ${shipment.trackingId}</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="details-grid">
                    <div class="details-section">
                        <h4><i class="fas fa-info-circle"></i> Shipment Information</h4>
                        <p><strong>Status:</strong> <span class="status-badge ${shipment.shipmentInfo.status.toLowerCase().replace(/\s+/g, '-')}">${shipment.shipmentInfo.status}</span></p>
                        <p><strong>Carrier:</strong> ${shipment.shipmentInfo.carrier}</p>
                        <p><strong>Type:</strong> ${shipment.shipmentInfo.shipmentType}</p>
                        <p><strong>Estimated Delivery:</strong> ${formatDate(shipment.shipmentInfo.estimatedDelivery)}</p>
                        <p><strong>Comments:</strong> ${shipment.shipmentInfo.comments || 'N/A'}</p>
                    </div>
                    <div class="details-section">
                        <h4><i class="fas fa-user-tie"></i> Shipper</h4>
                        <p><strong>Name:</strong> ${shipment.shipper.name}</p>
                        <p><strong>Address:</strong> ${shipment.shipper.address}</p>
                        <p><strong>Email:</strong> ${shipment.shipper.email}</p>
                        <p><strong>Phone:</strong> ${shipment.shipper.phone}</p>
                    </div>
                    <div class="details-section">
                        <h4><i class="fas fa-user-check"></i> Recipient</h4>
                        <p><strong>Name:</strong> ${shipment.recipient.name}</p>
                        <p><strong>Address:</strong> ${shipment.recipient.address}</p>
                        <p><strong>Email:</strong> ${shipment.recipient.email}</p>
                        <p><strong>Phone:</strong> ${shipment.recipient.phone}</p>
                    </div>
                    <div class="details-section">
                        <h4><i class="fas fa-route"></i> Route</h4>
                        <p><strong>Origin:</strong> ${shipment.route.origin}</p>
                        <p><strong>Current:</strong> ${shipment.route.currentLocation}</p>
                        <p><strong>Destination:</strong> ${shipment.route.destination}</p>
                        <p><strong>Pickup:</strong> ${formatDate(shipment.route.pickupDate)} ${shipment.route.pickupTime}</p>
                        <p><strong>Departure:</strong> ${formatDate(shipment.route.departureDate)} ${shipment.route.departureTime}</p>
                    </div>
                    <div class="details-section">
                        <h4><i class="fas fa-box"></i> Package</h4>
                        <p><strong>Type:</strong> ${shipment.package.packageType}</p>
                        <p><strong>Pieces:</strong> ${shipment.package.pieces}</p>
                        <p><strong>Quantity:</strong> ${shipment.package.quantity}</p>
                        <p><strong>Weight:</strong> ${shipment.package.weight} kg</p>
                        <p><strong>Dimensions:</strong> ${shipment.package.dimensions}</p>
                        <p><strong>Description:</strong> ${shipment.package.description || 'N/A'}</p>
                    </div>
                    <div class="details-section">
                        <h4><i class="fas fa-credit-card"></i> Payment</h4>
                        <p><strong>Mode:</strong> ${shipment.payment.paymentMode}</p>
                        <p><strong>Cost:</strong> $${shipment.payment.freightCost}</p>
                        <p><strong>Status:</strong> ${shipment.payment.paymentStatus}</p>
                    </div>
                    <div class="details-section full-width">
                        <h4><i class="fas fa-history"></i> Tracking History</h4>
                        <div class="tracking-timeline">
                            ${shipment.trackingHistory.map((update, index) => `
                                <div class="timeline-item">
                                    <div class="timeline-dot"></div>
                                    <div class="timeline-content">
                                        <div class="timeline-header">
                                            <span class="status-badge ${update.status.toLowerCase().replace(/\s+/g, '-')}">${update.status}</span>
                                            <span class="timeline-date">${formatDate(update.date)} ${update.time}</span>
                                        </div>
                                        <p><strong>Location:</strong> ${update.location}</p>
                                        ${update.comment ? `<p><strong>Comment:</strong> ${update.comment}</p>` : ''}
                                    </div>
                                </div>
                            `).reverse().join('')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Add styles for modal
    if (!document.getElementById('modal-styles')) {
        const style = document.createElement('style');
        style.id = 'modal-styles';
        style.textContent = `
            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
                padding: 20px;
                animation: fadeIn 0.3s ease;
            }
            .modal-content {
                background: white;
                border-radius: 12px;
                max-width: 900px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            .modal-header {
                padding: 20px 24px;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                position: sticky;
                top: 0;
                background: white;
                z-index: 10;
                border-radius: 12px 12px 0 0;
            }
            .modal-header h2 {
                font-size: 20px;
                font-weight: 700;
            }
            .modal-close {
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
                color: #a0aec0;
                padding: 4px 8px;
                border-radius: 6px;
                transition: all 0.3s;
            }
            .modal-close:hover {
                background: #f7fafc;
                color: #2d3748;
            }
            .modal-body {
                padding: 24px;
            }
            .details-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
            }
            .details-section {
                background: #f7fafc;
                padding: 16px;
                border-radius: 8px;
            }
            .details-section.full-width {
                grid-column: 1 / -1;
            }
            .details-section h4 {
                font-size: 14px;
                font-weight: 600;
                color: #4a5568;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .details-section h4 i {
                color: #667eea;
            }
            .details-section p {
                font-size: 14px;
                margin: 6px 0;
                color: #2d3748;
            }
            .details-section p strong {
                color: #718096;
                font-weight: 600;
            }
            .tracking-timeline {
                position: relative;
                padding-left: 24px;
            }
            .tracking-timeline::before {
                content: '';
                position: absolute;
                left: 6px;
                top: 0;
                bottom: 0;
                width: 2px;
                background: #e2e8f0;
            }
            .timeline-item {
                position: relative;
                margin-bottom: 20px;
                padding-left: 16px;
            }
            .timeline-item:last-child {
                margin-bottom: 0;
            }
            .timeline-dot {
                position: absolute;
                left: -20px;
                top: 4px;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: #667eea;
                border: 2px solid white;
                box-shadow: 0 0 0 2px #667eea;
            }
            .timeline-header {
                display: flex;
                align-items: center;
                gap: 12px;
                flex-wrap: wrap;
                margin-bottom: 4px;
            }
            .timeline-date {
                font-size: 12px;
                color: #a0aec0;
            }
            .timeline-content p {
                margin: 2px 0;
                font-size: 14px;
                color: #4a5568;
            }
            @media (max-width: 768px) {
                .details-grid {
                    grid-template-columns: 1fr;
                }
                .modal-content {
                    max-width: 100%;
                    margin: 10px;
                }
                .modal-body {
                    padding: 16px;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

async function editShipment(id) {
    try {
        const response = await apiFetch(`/api/shipments/${id}`);
        const shipment = await response.json();
        state.isEditing = true;
        state.currentShipment = shipment;
        populateForm(shipment);
        navigateTo('add-shipment');
        $('formTitle').textContent = 'Edit Shipment';
        $('submitBtnText').textContent = 'Update Shipment';
        $('shipmentId').value = id;
    } catch (error) {
        console.error('Error editing shipment:', error);
        showToast('Error loading shipment for editing', 'error');
    }
}

async function deleteShipment(id) {
    if (!confirm('Are you sure you want to delete this shipment?')) return;
    
    try {
        await apiFetch(`/api/shipments/${id}`, { method: 'DELETE' });
        showToast('Shipment deleted successfully', 'success');
        loadShipments();
        loadDashboard();
    } catch (error) {
        console.error('Error deleting shipment:', error);
        showToast('Error deleting shipment', 'error');
    }
}

function trackShipment(trackingId) {
    navigateTo('tracking');
    $('trackingSearch').value = trackingId;
    handleTrackingSearch();
}

// ===== FORM HANDLING =====
function resetForm() {
    state.isEditing = false;
    state.currentShipment = null;
    $('shipmentId').value = '';
    $('formTitle').textContent = 'Add New Shipment';
    $('submitBtnText').textContent = 'Create Shipment';
    $('shipmentForm').reset();
    $('trackingId').value = 'Auto-generated';
    $('shipmentStatus').value = 'Pending';
}

function populateForm(shipment) {
    // Shipment Info
    $('trackingId').value = shipment.trackingId;
    $('shipmentStatus').value = shipment.shipmentInfo.status;
    $('carrier').value = shipment.shipmentInfo.carrier;
    $('shipmentType').value = shipment.shipmentInfo.shipmentType;
    $('estimatedDelivery').value = shipment.shipmentInfo.estimatedDelivery?.split('T')[0] || '';
    $('comments').value = shipment.shipmentInfo.comments || '';
    
    // Shipper
    $('shipperName').value = shipment.shipper.name;
    $('shipperAddress').value = shipment.shipper.address;
    $('shipperEmail').value = shipment.shipper.email;
    $('shipperPhone').value = shipment.shipper.phone;
    
    // Recipient
    $('recipientName').value = shipment.recipient.name;
    $('recipientAddress').value = shipment.recipient.address;
    $('recipientEmail').value = shipment.recipient.email;
    $('recipientPhone').value = shipment.recipient.phone;
    
    // Route
    $('originLocation').value = shipment.route.origin;
    $('currentLocation').value = shipment.route.currentLocation;
    $('destinationLocation').value = shipment.route.destination;
    $('pickupDate').value = shipment.route.pickupDate?.split('T')[0] || '';
    $('pickupTime').value = shipment.route.pickupTime || '';
    $('departureDate').value = shipment.route.departureDate?.split('T')[0] || '';
    $('departureTime').value = shipment.route.departureTime || '';
    
    // Package
    $('packageType').value = shipment.package.packageType;
    $('pieces').value = shipment.package.pieces;
    $('quantity').value = shipment.package.quantity;
    $('weight').value = shipment.package.weight;
    $('dimensions').value = shipment.package.dimensions;
    $('packageDescription').value = shipment.package.description || '';
    
    // Payment
    $('paymentMode').value = shipment.payment.paymentMode;
    $('freightCost').value = shipment.payment.freightCost;
    $('paymentStatus').value = shipment.payment.paymentStatus;
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = {
        shipmentInfo: {
            status: $('shipmentStatus').value,
            carrier: $('carrier').value,
            shipmentType: $('shipmentType').value,
            estimatedDelivery: new Date($('estimatedDelivery').value),
            comments: $('comments').value
        },
        shipper: {
            name: $('shipperName').value,
            address: $('shipperAddress').value,
            email: $('shipperEmail').value,
            phone: $('shipperPhone').value
        },
        recipient: {
            name: $('recipientName').value,
            address: $('recipientAddress').value,
            email: $('recipientEmail').value,
            phone: $('recipientPhone').value
        },
        route: {
            origin: $('originLocation').value,
            currentLocation: $('currentLocation').value,
            destination: $('destinationLocation').value,
            pickupDate: new Date($('pickupDate').value),
            pickupTime: $('pickupTime').value,
            departureDate: new Date($('departureDate').value),
            departureTime: $('departureTime').value
        },
        package: {
            packageType: $('packageType').value,
            pieces: parseInt($('pieces').value),
            quantity: parseInt($('quantity').value),
            weight: parseFloat($('weight').value),
            dimensions: $('dimensions').value,
            description: $('packageDescription').value
        },
        payment: {
            paymentMode: $('paymentMode').value,
            freightCost: parseFloat($('freightCost').value),
            paymentStatus: $('paymentStatus').value
        }
    };
    
    try {
        const isEdit = state.isEditing;
        const id = $('shipmentId').value;
        const url = isEdit ? `/api/shipments/${id}` : '/api/shipments';
        const method = isEdit ? 'PUT' : 'POST';
        
        const response = await apiFetch(url, {
            method,
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            showToast(isEdit ? 'Shipment updated successfully' : 'Shipment created successfully', 'success');
            navigateTo('shipments');
            loadShipments();
            loadDashboard();
        } else {
            const error = await response.json();
            showToast(error.error || 'Error saving shipment', 'error');
        }
    } catch (error) {
        console.error('Error saving shipment:', error);
        showToast('Error saving shipment', 'error');
    }
}

// ===== TRACKING =====
async function handleTrackingSearch() {
    const trackingId = $('trackingSearch').value.trim();
    if (!trackingId) {
        showToast('Please enter a tracking ID', 'warning');
        return;
    }
    
    try {
        const response = await apiFetch(`/api/shipments/tracking/${trackingId}`);
        const shipment = await response.json();
        renderTrackingResult(shipment);
    } catch (error) {
        console.error('Error tracking shipment:', error);
        $('trackingResult').innerHTML = `
            <div class="tracking-placeholder" style="border-color: #fc8181;">
                <i class="fas fa-exclamation-circle" style="color: #fc8181;"></i>
                <p style="color: #c53030;">Shipment with tracking ID "${trackingId}" not found</p>
            </div>
        `;
    }
}

function renderTrackingResult(shipment) {
    $('trackingResult').innerHTML = `
        <div class="tracking-result-card">
            <div class="tracking-header">
                <div>
                    <h3>${shipment.trackingId}</h3>
                    <p>${shipment.shipper.name} → ${shipment.recipient.name}</p>
                </div>
                <span class="status-badge ${shipment.shipmentInfo.status.toLowerCase().replace(/\s+/g, '-')}">${shipment.shipmentInfo.status}</span>
            </div>
            <div class="tracking-info-grid">
                <div class="tracking-info-item">
                    <label>Current Location</label>
                    <p><i class="fas fa-location-dot" style="color: #667eea;"></i> ${shipment.route.currentLocation}</p>
                </div>
                <div class="tracking-info-item">
                    <label>Estimated Delivery</label>
                    <p><i class="fas fa-calendar" style="color: #48bb78;"></i> ${formatDate(shipment.shipmentInfo.estimatedDelivery)}</p>
                </div>
                <div class="tracking-info-item">
                    <label>Carrier</label>
                    <p><i class="fas fa-truck" style="color: #ed8936;"></i> ${shipment.shipmentInfo.carrier}</p>
                </div>
                <div class="tracking-info-item">
                    <label>Last Updated</label>
                    <p><i class="fas fa-clock" style="color: #a0aec0;"></i> ${formatDate(shipment.updatedAt)}</p>
                </div>
            </div>
            <div class="tracking-timeline-section">
                <h4>Tracking Timeline</h4>
                <div class="tracking-timeline">
                    ${shipment.trackingHistory.map((update, index) => `
                        <div class="timeline-item">
                            <div class="timeline-dot ${index === shipment.trackingHistory.length - 1 ? 'current' : ''}"></div>
                            <div class="timeline-content">
                                <div class="timeline-header">
                                    <span class="status-badge ${update.status.toLowerCase().replace(/\s+/g, '-')}">${update.status}</span>
                                    <span class="timeline-date">${formatDate(update.date)} ${update.time}</span>
                                </div>
                                <p><strong>Location:</strong> ${update.location}</p>
                                ${update.comment ? `<p><strong>Comment:</strong> ${update.comment}</p>` : ''}
                            </div>
                        </div>
                    `).reverse().join('')}
                </div>
            </div>
            <div style="margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="btn-secondary" onclick="navigateTo('shipments')">
                    <i class="fas fa-arrow-left"></i> Back to Shipments
                </button>
                <button class="btn-primary" onclick="editShipment('${shipment._id}')">
                    <i class="fas fa-edit"></i> Edit Shipment
                </button>
                <button class="btn-secondary" onclick="addTrackingUpdate('${shipment.trackingId}')">
                    <i class="fas fa-plus"></i> Add Update
                </button>
            </div>
        </div>
    `;
    
    // Add styles for tracking result
    if (!document.getElementById('tracking-result-styles')) {
        const style = document.createElement('style');
        style.id = 'tracking-result-styles';
        style.textContent = `
            .tracking-result-card {
                background: white;
                border-radius: 12px;
                padding: 24px;
                border: 1px solid #e2e8f0;
                box-shadow: 0 2px 10px rgba(0,0,0,0.08);
            }
            .tracking-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                padding-bottom: 16px;
                border-bottom: 1px solid #e2e8f0;
                margin-bottom: 16px;
                flex-wrap: wrap;
                gap: 12px;
            }
            .tracking-header h3 {
                font-size: 20px;
                font-weight: 700;
            }
            .tracking-header p {
                color: #718096;
                font-size: 14px;
            }
            .tracking-info-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 16px;
                margin-bottom: 20px;
            }
            .tracking-info-item {
                padding: 12px;
                background: #f7fafc;
                border-radius: 8px;
            }
            .tracking-info-item label {
                display: block;
                font-size: 12px;
                font-weight: 600;
                color: #a0aec0;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 4px;
            }
            .tracking-info-item p {
                font-size: 14px;
                font-weight: 500;
                color: #2d3748;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .tracking-timeline-section {
                margin-top: 20px;
                padding-top: 20px;
                border-top: 1px solid #e2e8f0;
            }
            .tracking-timeline-section h4 {
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 16px;
            }
            .timeline-dot.current {
                background: #48bb78;
                box-shadow: 0 0 0 2px #48bb78;
            }
            @media (max-width: 768px) {
                .tracking-result-card {
                    padding: 16px;
                }
                .tracking-header {
                    flex-direction: column;
                }
                .tracking-info-grid {
                    grid-template-columns: 1fr;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

async function addTrackingUpdate(trackingId) {
    const status = prompt('Enter new status:');
    if (!status) return;
    const location = prompt('Enter location:');
    if (!location) return;
    const comment = prompt('Enter comment (optional):') || '';
    
    try {
        const response = await apiFetch(`/api/shipments/${trackingId}/tracking`, {
            method: 'POST',
            body: JSON.stringify({ status, location, comment })
        });
        
        if (response.ok) {
            showToast('Tracking update added successfully', 'success');
            handleTrackingSearch();
        } else {
            const error = await response.json();
            showToast(error.error || 'Error adding tracking update', 'error');
        }
    } catch (error) {
        console.error('Error adding tracking update:', error);
        showToast('Error adding tracking update', 'error');
    }
}

// ===== REPORTS =====
async function loadReports() {
    try {
        const response = await apiFetch('/api/shipments/stats');
        const stats = await response.json();
        
        $('reportTotal').textContent = stats.totalShipments;
        $('reportDelivered').textContent = stats.statusCounts['Delivered'] || 0;
        $('reportInTransit').textContent = stats.statusCounts['In Transit'] || 0;
        $('reportDelayed').textContent = stats.statusCounts['Delayed'] || 0;
    } catch (error) {
        console.error('Error loading reports:', error);
    }
}

function exportReport() {
    showToast('Report exported successfully', 'success');
}

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    
    // Add toast styles
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .toast {
                position: fixed;
                bottom: 24px;
                right: 24px;
                padding: 16px 20px;
                border-radius: 12px;
                color: white;
                display: flex;
                align-items: center;
                gap: 12px;
                font-size: 14px;
                font-weight: 500;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                z-index: 9999;
                animation: slideUp 0.4s ease;
                max-width: 400px;
            }
            .toast-success {
                background: linear-gradient(135deg, #48bb78, #38a169);
            }
            .toast-error {
                background: linear-gradient(135deg, #fc8181, #e53e3e);
            }
            .toast-warning {
                background: linear-gradient(135deg, #f6ad55, #dd6b20);
            }
            .toast i {
                font-size: 20px;
            }
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            @media (max-width: 768px) {
                .toast {
                    left: 16px;
                    right: 16px;
                    bottom: 16px;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// ===== UTILITY FUNCTIONS =====
function formatDate(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Make functions globally accessible for inline onclick handlers
window.viewShipment = viewShipment;
window.editShipment = editShipment;
window.deleteShipment = deleteShipment;
window.trackShipment = trackShipment;
window.navigateTo = navigateTo;
window.addTrackingUpdate = addTrackingUpdate;