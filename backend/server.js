/**
 * QuoteMetric System - Main Server
 * Complete business management backend
 */

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Database connection
const DB_PATH = process.env.DATABASE_PATH || './database/quotemetric.db';
const db = new sqlite3.Database(DB_PATH);

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'quotemetric-secret-key-2026';

// Auth middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// ==================== AUTH ROUTES ====================

// Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', [email], (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        bcrypt.compare(password, user.password, (err, match) => {
            if (err || !match) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            
            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role, name: user.first_name },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            
            res.json({
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role
                }
            });
        });
    });
});

// Register new user
app.post('/api/auth/register', authenticateToken, (req, res) => {
    const { email, password, firstName, lastName, role, phone } = req.body;
    
    // Only owners can create new users
    if (req.user.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can create users' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    db.run(
        'INSERT INTO users (email, password, first_name, last_name, role, phone) VALUES (?, ?, ?, ?, ?, ?)',
        [email, hashedPassword, firstName, lastName, role, phone],
        function(err) {
            if (err) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            res.json({ id: this.lastID, message: 'User created successfully' });
        }
    );
});

// Get all users
app.get('/api/users', authenticateToken, (req, res) => {
    db.all('SELECT id, email, first_name, last_name, role, phone, created_at, is_active FROM users', [], (err, users) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(users);
    });
});

// ==================== CUSTOMER ROUTES ====================

// Get all customers
app.get('/api/customers', authenticateToken, (req, res) => {
    db.all('SELECT * FROM customers ORDER BY created_at DESC', [], (err, customers) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(customers);
    });
});

// Get single customer
app.get('/api/customers/:id', authenticateToken, (req, res) => {
    db.get('SELECT * FROM customers WHERE id = ?', [req.params.id], (err, customer) => {
        if (err || !customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        res.json(customer);
    });
});

// Create customer
app.post('/api/customers', authenticateToken, (req, res) => {
    const { first_name, last_name, email, phone, address, city, state, zip, notes } = req.body;
    
    db.run(
        'INSERT INTO customers (first_name, last_name, email, phone, address, city, state, zip, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [first_name, last_name, email, phone, address, city, state, zip, notes, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ id: this.lastID, message: 'Customer created' });
        }
    );
});

// Update customer
app.put('/api/customers/:id', authenticateToken, (req, res) => {
    const { first_name, last_name, email, phone, address, city, state, zip, notes } = req.body;
    
    db.run(
        'UPDATE customers SET first_name=?, last_name=?, email=?, phone=?, address=?, city=?, state=?, zip=?, notes=? WHERE id=?',
        [first_name, last_name, email, phone, address, city, state, zip, notes, req.params.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'Customer updated' });
        }
    );
});

// Delete customer
app.delete('/api/customers/:id', authenticateToken, (req, res) => {
    db.run('DELETE FROM customers WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Customer deleted' });
    });
});

// ==================== SERVICES ROUTES ====================

// Get all services
app.get('/api/services', authenticateToken, (req, res) => {
    db.all('SELECT * FROM services WHERE is_active = 1 ORDER BY category, name', [], (err, services) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(services);
    });
});

// Create service
app.post('/api/services', authenticateToken, (req, res) => {
    const { name, description, base_price, unit, category } = req.body;
    
    db.run(
        'INSERT INTO services (name, description, base_price, unit, category) VALUES (?, ?, ?, ?, ?)',
        [name, description, base_price, unit, category],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ id: this.lastID, message: 'Service created' });
        }
    );
});

// ==================== ESTIMATE ROUTES ====================

// Get all estimates
app.get('/api/estimates', authenticateToken, (req, res) => {
    db.all(`
        SELECT e.*, c.first_name, c.last_name, c.phone, c.email
        FROM estimates e
        JOIN customers c ON e.customer_id = c.id
        ORDER BY e.created_at DESC
    `, [], (err, estimates) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(estimates);
    });
});

// Get single estimate with items
app.get('/api/estimates/:id', authenticateToken, (req, res) => {
    db.get(`
        SELECT e.*, c.first_name, c.last_name, c.email, c.phone, c.address
        FROM estimates e
        JOIN customers c ON e.customer_id = c.id
        WHERE e.id = ?
    `, [req.params.id], (err, estimate) => {
        if (err || !estimate) {
            return res.status(404).json({ error: 'Estimate not found' });
        }
        
        db.all('SELECT * FROM estimate_items WHERE estimate_id = ?', [req.params.id], (err, items) => {
            estimate.items = items || [];
            res.json(estimate);
        });
    });
});

// Create estimate
app.post('/api/estimates', authenticateToken, (req, res) => {
    const { customer_id, items, notes, valid_until } = req.body;
    
    const estimateNumber = 'EST-' + Date.now();
    
    db.run(
        'INSERT INTO estimates (estimate_number, customer_id, notes, valid_until, created_by) VALUES (?, ?, ?, ?, ?)',
        [estimateNumber, customer_id, notes, valid_until, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            const estimateId = this.lastID;
            
            // Insert items
            if (items && items.length > 0) {
                const stmt = db.prepare('INSERT INTO estimate_items (estimate_id, service_id, description, quantity, unit_price, total, is_upsell) VALUES (?, ?, ?, ?, ?, ?, ?)');
                items.forEach(item => {
                    stmt.run(estimateId, item.service_id || null, item.description, item.quantity, item.unit_price, item.total, item.is_upsell || 0);
                });
                stmt.finalize();
            }
            
            // Update totals
            const total = items.reduce((sum, item) => sum + item.total, 0);
            db.run('UPDATE estimates SET total = ?, subtotal = ? WHERE id = ?', [total, total, estimateId]);
            
            res.json({ id: estimateId, estimate_number: estimateNumber, message: 'Estimate created' });
        }
    );
});

// Update estimate status
app.put('/api/estimates/:id/status', authenticateToken, (req, res) => {
    const { status } = req.body;
    
    db.run('UPDATE estimates SET status = ? WHERE id = ?', [status, req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Status updated' });
    });
});

// Delete estimate
app.delete('/api/estimates/:id', authenticateToken, (req, res) => {
    db.run('DELETE FROM estimates WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Estimate deleted' });
    });
});

// ==================== PHOTO/AI ROUTES ====================

// Upload photo
app.post('/api/photos', authenticateToken, upload.single('photo'), (req, res) => {
    const { job_id, customer_id, type } = req.body;
    
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filepath = '/uploads/' + req.file.filename;
    
    db.run(
        'INSERT INTO photos (job_id, customer_id, type, filename, filepath, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
        [job_id || null, customer_id || null, type || 'before', req.file.originalname, filepath, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            const photoId = this.lastID;
            
            // Trigger AI analysis
            analyzePhotoForUpsell(photoId, filepath, customer_id);
            
            res.json({
                id: photoId,
                filename: req.file.originalname,
                filepath: filepath,
                message: 'Photo uploaded'
            });
        }
    );
});

// Get photos
app.get('/api/photos', authenticateToken, (req, res) => {
    const { job_id, customer_id } = req.query;
    
    let query = 'SELECT * FROM photos WHERE 1=1';
    const params = [];
    
    if (job_id) {
        query += ' AND job_id = ?';
        params.push(job_id);
    }
    if (customer_id) {
        query += ' AND customer_id = ?';
        params.push(customer_id);
    }
    
    query += ' ORDER BY uploaded_at DESC';
    
    db.all(query, params, (err, photos) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(photos);
    });
});

// AI Upsell Analysis (Rule-based for now)
function analyzePhotoForUpsell(photoId, filepath, customerId) {
    // This is a simplified rule-based AI
    // In production, you'd use Google Vision API or similar
    
    const filename = filepath.toLowerCase();
    const detectedObjects = [];
    
    // Simple keyword detection from filename or path
    if (filename.includes('deck') || filename.includes('porch')) detectedObjects.push('deck');
    if (filename.includes('window') || filename.includes('glass')) detectedObjects.push('window');
    if (filename.includes('gutter') || filename.includes('eave')) detectedObjects.push('gutter');
    if (filename.includes('roof') || filename.includes('shingle')) detectedObjects.push('roof');
    if (filename.includes('driveway') || filename.includes('concrete')) detectedObjects.push('driveway');
    if (filename.includes('fence')) detectedObjects.push('fence');
    if (filename.includes('patio') || filename.includes('paver')) detectedObjects.push('patio');
    if (filename.includes('pool')) detectedObjects.push('pool');
    if (filename.includes('sidewalk') || filename.includes('walk')) detectedObjects.push('sidewalk');
    if (filename.includes('siding') || filename.includes('house') || filename.includes('exterior')) detectedObjects.push('siding');
    
    if (detectedObjects.length > 0) {
        // Get upsell suggestions from database
        const placeholders = detectedObjects.map(() => '?').join(',');
        
        db.all(`
            SELECT t.*, s.base_price, s.description
            FROM ai_upsell_templates t
            LEFT JOIN services s ON t.service_id = s.id
            WHERE t.detected_object IN (${placeholders})
        `, detectedObjects, (err, upsells) => {
            if (err) return;
            
            const aiData = {
                detected_objects: detectedObjects,
                upsell_suggestions: upsells.map(u => ({
                    service: u.suggested_service,
                    price: u.base_price || 0,
                    description: u.description || '',
                    confidence: 'high'
                }))
            };
            
            db.run(
                'UPDATE photos SET ai_analyzed = 1, ai_upsell_data = ? WHERE id = ?',
                [JSON.stringify(aiData), photoId]
            );
        });
    } else {
        db.run('UPDATE photos SET ai_analyzed = 1 WHERE id = ?', [photoId]);
    }
}

// Get AI upsell suggestions for a photo
app.get('/api/photos/:id/upsell', authenticateToken, (req, res) => {
    db.get('SELECT ai_upsell_data FROM photos WHERE id = ?', [req.params.id], (err, photo) => {
        if (err || !photo) {
            return res.status(404).json({ error: 'Photo not found' });
        }
        
        try {
            const upsellData = photo.ai_upsell_data ? JSON.parse(photo.ai_upsell_data) : { upsell_suggestions: [] };
            res.json(upsellData);
        } catch (e) {
            res.json({ upsell_suggestions: [] });
        }
    });
});

// ==================== ANALYTICS ROUTES ====================

// Get dashboard analytics
app.get('/api/analytics/dashboard', authenticateToken, (req, res) => {
    const stats = {};
    
    // Total customers
    db.get('SELECT COUNT(*) as count FROM customers', (err, row) => {
        stats.totalCustomers = row ? row.count : 0;
        
        // Total estimates
        db.get('SELECT COUNT(*) as count FROM estimates', (err, row) => {
            stats.totalEstimates = row ? row.count : 0;
            
            // Pending estimates
            db.get("SELECT COUNT(*) as count FROM estimates WHERE status = 'sent'", (err, row) => {
                stats.pendingEstimates = row ? row.count : 0;
                
                // Revenue this month
                db.get(`
                    SELECT SUM(total) as total FROM invoices 
                    WHERE status = 'paid' 
                    AND strftime('%m', created_at) = strftime('%m', 'now')
                    AND strftime('%Y', created_at) = strftime('%Y', 'now')
                `, (err, row) => {
                    stats.monthlyRevenue = row ? (row.total || 0) : 0;
                    
                    res.json(stats);
                });
            });
        });
    });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                                                          ║');
    console.log('║           QuoteMetric System Server Started              ║');
    console.log('║                                                          ║');
    console.log(`║   🌐 Server running at: http://localhost:${PORT}              ║`);
    console.log('║   📊 Database: ' + DB_PATH);
    console.log('║                                                          ║');
    console.log('║   👤 Default Login:                                      ║');
    console.log('║      Email: admin@quotemetric.io                         ║');
    console.log('║      Password: admin123                                  ║');
    console.log('║                                                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
});
