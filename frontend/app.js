/**
 * QuoteMetric Dashboard Application
 * Frontend JavaScript for complete system
 */

const API_URL = 'http://localhost:3000/api';
let authToken = localStorage.getItem('quotemetric_token');
let currentUser = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    if (authToken) {
        showDashboard();
    } else {
        showLogin();
    }
});

// ==================== AUTH ====================

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('quotemetric_token', authToken);
            showDashboard();
        } else {
            alert(data.error || 'Login failed');
        }
    } catch (error) {
        alert('Connection error. Make sure the server is running.');
    }
});

function logout() {
    localStorage.removeItem('quotemetric_token');
    authToken = null;
    currentUser = null;
    showLogin();
}

function showLogin() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('dashboardScreen').classList.add('hidden');
}

async function showDashboard() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboardScreen').classList.remove('hidden');
    
    // Get user info
    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.ok) {
            currentUser = await response.json();
        }
    } catch (e) {
        // Use stored user info
    }
    
    document.getElementById('userName').textContent = currentUser?.name || 'User';
    
    // Load dashboard stats
    loadDashboardStats();
    showSection('dashboard');
}

// ==================== NAVIGATION ====================

function showSection(section) {
    // Hide all sections
    ['dashboard', 'estimates', 'customers', 'photos', 'schedule'].forEach(s => {
        document.getElementById(`${s}Section`).classList.add('hidden');
    });
    
    // Show requested section
    document.getElementById(`${section}Section`).classList.remove('hidden');
    
    // Load data for section
    switch(section) {
        case 'dashboard':
            loadDashboardStats();
            break;
        case 'estimates':
            loadEstimates();
            break;
        case 'customers':
            loadCustomers();
            break;
        case 'photos':
            loadCustomersForDropdown();
            loadPhotos();
            break;
    }
}

// ==================== DASHBOARD ====================

async function loadDashboardStats() {
    try {
        const response = await fetch(`${API_URL}/analytics/dashboard`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const stats = await response.json();
            document.getElementById('statCustomers').textContent = stats.totalCustomers || 0;
            document.getElementById('statEstimates').textContent = stats.totalEstimates || 0;
            document.getElementById('statPending').textContent = stats.pendingEstimates || 0;
            document.getElementById('statRevenue').textContent = '$' + (stats.monthlyRevenue || 0).toFixed(2);
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// ==================== CUSTOMERS ====================

async function loadCustomers() {
    try {
        const response = await fetch(`${API_URL}/customers`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const customers = await response.json();
            const grid = document.getElementById('customersGrid');
            
            if (customers.length === 0) {
                grid.innerHTML = `
                    <div class="col-span-full text-center py-12 text-primary/40">
                        <span class="material-symbols-outlined text-6xl mb-4 block opacity-50">people</span>
                        <p>No customers yet. Click "Add Customer" to get started!</p>
                    </div>
                `;
                return;
            }
            
            grid.innerHTML = customers.map(customer => `
                <div class="glass-panel rounded-2xl p-6 border border-white/5 hover:border-primary/40 transition-all">
                    <div class="flex items-start justify-between mb-4">
                        <div>
                            <h3 class="text-xl font-headline font-bold text-white">${customer.first_name} ${customer.last_name}</h3>
                            <p class="text-primary/60 text-sm">${customer.phone}</p>
                        </div>
                        <button onclick="editCustomer(${customer.id})" class="text-primary/60 hover:text-white transition-colors">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                    </div>
                    ${customer.address ? `<p class="text-primary/40 text-sm mb-2">${customer.address}</p>` : ''}
                    ${customer.email ? `<p class="text-primary/40 text-sm">${customer.email}</p>` : ''}
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading customers:', error);
    }
}

function showAddCustomerModal() {
    document.getElementById('addCustomerModal').classList.remove('hidden');
}

function closeAddCustomerModal() {
    document.getElementById('addCustomerModal').classList.add('hidden');
    document.getElementById('addCustomerForm').reset();
}

document.getElementById('addCustomerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const customerData = {
        first_name: document.getElementById('customerFirstName').value,
        last_name: document.getElementById('customerLastName').value,
        email: document.getElementById('customerEmail').value,
        phone: document.getElementById('customerPhone').value,
        address: document.getElementById('customerAddress').value,
        city: document.getElementById('customerCity').value,
        state: document.getElementById('customerState').value,
        zip: document.getElementById('customerZip').value
    };
    
    try {
        const response = await fetch(`${API_URL}/customers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(customerData)
        });
        
        if (response.ok) {
            closeAddCustomerModal();
            loadCustomers();
            alert('Customer added successfully!');
        } else {
            alert('Error adding customer');
        }
    } catch (error) {
        alert('Connection error');
    }
});

async function loadCustomersForDropdown() {
    try {
        const response = await fetch(`${API_URL}/customers`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const customers = await response.json();
            const select = document.getElementById('photoCustomer');
            select.innerHTML = '<option value="">Select Customer</option>' +
                customers.map(c => `<option value="${c.id}">${c.first_name} ${c.last_name}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading customers:', error);
    }
}

// ==================== PHOTOS & AI ====================

document.getElementById('uploadForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const customerId = document.getElementById('photoCustomer').value;
    const type = document.getElementById('photoType').value;
    const fileInput = document.getElementById('photoFile');
    
    if (!customerId || !fileInput.files[0]) {
        alert('Please select a customer and photo');
        return;
    }
    
    const formData = new FormData();
    formData.append('customer_id', customerId);
    formData.append('type', type);
    formData.append('photo', fileInput.files[0]);
    
    try {
        const response = await fetch(`${API_URL}/photos`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            alert('Photo uploaded! AI is analyzing...');
            loadPhotos();
            
            // Wait a moment then show AI results
            setTimeout(() => showAIUpsellResults(data.id), 1000);
        } else {
            alert('Error uploading photo');
        }
    } catch (error) {
        alert('Connection error');
    }
});

async function showAIUpsellResults(photoId) {
    try {
        const response = await fetch(`${API_URL}/photos/${photoId}/upsell`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const container = document.getElementById('aiUpsellResults');
            
            if (data.upsell_suggestions && data.upsell_suggestions.length > 0) {
                container.innerHTML = `
                    <div class="space-y-3">
                        <div class="flex items-center gap-2 mb-4">
                            <span class="material-symbols-outlined text-secondary glow-pink">check_circle</span>
                            <span class="text-white font-bold">AI Analysis Complete!</span>
                        </div>
                        ${data.upsell_suggestions.map(upsell => `
                            <div class="glass-panel rounded-xl p-4 border border-secondary/20 flex items-center justify-between">
                                <div>
                                    <h4 class="text-white font-bold">${upsell.service}</h4>
                                    <p class="text-primary/60 text-sm">${upsell.description || ''}</p>
                                </div>
                                <div class="text-right">
                                    <p class="text-secondary font-bold text-xl">$${upsell.price}</p>
                                    <p class="text-primary/40 text-xs">${upsell.confidence} confidence</p>
                                </div>
                            </div>
                        `).join('')}
                        <div class="pt-4 border-t border-white/10">
                            <p class="text-primary/60 text-sm mb-3">💡 Crew member: Show these suggestions to the customer for easy upsells!</p>
                            <button class="primary-gradient w-full text-white py-3 rounded-xl font-headline font-bold hover:-translate-y-1 transition-all">
                                Add All to Quote
                            </button>
                        </div>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="text-center py-8 text-primary/40">
                        <span class="material-symbols-outlined text-6xl mb-4 block opacity-50">search</span>
                        <p>No upsell suggestions generated. Try a different photo!</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading AI results:', error);
    }
}

async function loadPhotos() {
    try {
        const response = await fetch(`${API_URL}/photos`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const photos = await response.json();
            const grid = document.getElementById('photosGrid');
            
            if (photos.length === 0) {
                grid.innerHTML = `
                    <div class="col-span-full text-center py-12 text-primary/40">
                        <p>No photos uploaded yet</p>
                    </div>
                `;
                return;
            }
            
            grid.innerHTML = photos.slice(0, 12).map(photo => `
                <div class="glass-panel rounded-xl overflow-hidden border border-white/5 group cursor-pointer" onclick="viewPhoto(${photo.id})">
                    <img src="${photo.filepath}" alt="${photo.filename}" class="w-full h-40 object-cover opacity-80 group-hover:opacity-100 transition-opacity">
                    <div class="p-3">
                        <span class="text-xs text-primary/60 uppercase">${photo.type}</span>
                        ${photo.ai_analyzed ? '<span class="material-symbols-outlined text-secondary text-sm ml-2">auto_awesome</span>' : ''}
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading photos:', error);
    }
}

// ==================== ESTIMATES ====================

async function loadEstimates() {
    try {
        const response = await fetch(`${API_URL}/estimates`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const estimates = await response.json();
            const table = document.getElementById('estimatesTable');
            
            if (estimates.length === 0) {
                table.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-12 text-center text-primary/40">
                            No estimates yet. Click "New Estimate" to create one!
                        </td>
                    </tr>
                `;
                return;
            }
            
            table.innerHTML = estimates.map(estimate => {
                const statusColors = {
                    'draft': 'text-gray-400',
                    'sent': 'text-yellow-400',
                    'approved': 'text-green-400',
                    'rejected': 'text-red-400',
                    'converted': 'text-blue-400'
                };
                
                return `
                    <tr class="hover:bg-surface-container transition-colors">
                        <td class="px-6 py-4 text-white font-bold">${estimate.estimate_number}</td>
                        <td class="px-6 py-4 text-primary">${estimate.first_name} ${estimate.last_name}</td>
                        <td class="px-6 py-4">
                            <span class="${statusColors[estimate.status] || 'text-gray-400'} font-bold uppercase text-xs">
                                ${estimate.status}
                            </span>
                        </td>
                        <td class="px-6 py-4 text-white font-bold">$${estimate.total?.toFixed(2) || '0.00'}</td>
                        <td class="px-6 py-4 text-primary/60 text-sm">${new Date(estimate.created_at).toLocaleDateString()}</td>
                        <td class="px-6 py-4">
                            <button class="text-primary hover:text-white transition-colors mr-2">
                                <span class="material-symbols-outlined text-sm">visibility</span>
                            </button>
                            <button class="text-secondary hover:text-white transition-colors">
                                <span class="material-symbols-outlined text-sm">edit</span>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Error loading estimates:', error);
    }
}

function showCreateEstimate() {
    alert('Estimate creation form coming in next update!');
}

// ==================== UTILITY ====================

function viewPhoto(photoId) {
    alert('Photo viewer coming soon! Photo ID: ' + photoId);
}

function editCustomer(customerId) {
    alert('Customer edit form coming soon! Customer ID: ' + customerId);
}
