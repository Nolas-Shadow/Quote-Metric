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

// Railway/Render compatible paths - use /tmp on Linux, local on Windows
const isWindows = process.platform === 'win32';
const DB_PATH = isWindows 
    ? path.join(__dirname, '..', 'quotemetric.db')
    : '/tmp/quotemetric.db';
const uploadsDir = isWindows
    ? path.join(__dirname, '..', 'uploads')
    : '/tmp/uploads';

console.log('📊 Database path:', DB_PATH);
console.log('📁 Uploads path:', uploadsDir);
console.log('🖥️ Platform:', process.platform);

// Ensure uploads directory exists
try {
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log('✅ Created uploads directory');
    }
} catch (err) {
    console.error('⚠️ Warning: Could not create uploads directory:', err.message);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(uploadsDir));

// Database connection with error handling
console.log('📦 Opening database connection...');
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Database connection error:', err.message);
        console.error('Full error:', JSON.stringify(err, null, 2));
    } else {
        console.log('✅ Connected to SQLite database at:', DB_PATH);
    }
});

db.on('error', (err) => {
    console.error('SQLite error:', err.message);
});

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

// ==================== DATABASE INITIALIZATION ====================

// Initialize database tables and default data on startup
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        console.log('📦 Initializing database...');
        
        // Create tables
        const tables = [
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('owner', 'manager', 'crew_member')),
                phone TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_active INTEGER DEFAULT 1
            )`,
            `CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                email TEXT,
                phone TEXT NOT NULL,
                address TEXT,
                city TEXT,
                state TEXT,
                zip TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_by INTEGER,
                FOREIGN KEY (created_by) REFERENCES users(id)
            )`,
            `CREATE TABLE IF NOT EXISTS services (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                base_price REAL NOT NULL,
                unit TEXT DEFAULT 'job',
                category TEXT,
                is_active INTEGER DEFAULT 1
            )`,
            `CREATE TABLE IF NOT EXISTS estimates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                estimate_number TEXT UNIQUE NOT NULL,
                customer_id INTEGER NOT NULL,
                status TEXT DEFAULT 'draft',
                subtotal REAL DEFAULT 0,
                tax REAL DEFAULT 0,
                total REAL DEFAULT 0,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_by INTEGER,
                FOREIGN KEY (customer_id) REFERENCES customers(id),
                FOREIGN KEY (created_by) REFERENCES users(id)
            )`,
            `CREATE TABLE IF NOT EXISTS estimate_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                estimate_id INTEGER NOT NULL,
                service_id INTEGER,
                description TEXT,
                quantity REAL DEFAULT 1,
                unit_price REAL,
                total REAL,
                FOREIGN KEY (estimate_id) REFERENCES estimates(id),
                FOREIGN KEY (service_id) REFERENCES services(id)
            )`,
            `CREATE TABLE IF NOT EXISTS photos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER,
                job_id INTEGER,
                file_path TEXT NOT NULL,
                file_name TEXT,
                uploaded_by INTEGER,
                ai_analyzed INTEGER DEFAULT 0,
                ai_suggestions TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers(id),
                FOREIGN KEY (uploaded_by) REFERENCES users(id)
            )`,
            `CREATE TABLE IF NOT EXISTS ai_upsell_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                detected_object TEXT NOT NULL,
                suggested_service TEXT NOT NULL,
                avg_price REAL NOT NULL,
                confidence_threshold REAL DEFAULT 0.7
            )`
        ];

        let completed = 0;
        tables.forEach((sql, index) => {
            db.run(sql, (err) => {
                if (err) {
                    console.error('Error creating table:', err);
                    reject(err);
                    return;
                }
                completed++;
                if (completed === tables.length) {
                    // Create default admin user
                    const adminEmail = 'admin@quotemetric.io';
                    db.get('SELECT id FROM users WHERE email = ?', [adminEmail], (err, user) => {
                        if (err || !user) {
                            bcrypt.hash('admin123', 10, (err, hash) => {
                                if (err) {
                                    reject(err);
                                    return;
                                }
                                db.run(
                                    `INSERT INTO users (email, password, first_name, last_name, role, phone) 
                                     VALUES (?, ?, ?, ?, ?, ?)`,
                                    [adminEmail, hash, 'Admin', 'User', 'owner', '(248) 202-7636'],
                                    (err) => {
                                        if (err) {
                                            reject(err);
                                            return;
                                        }
                                        console.log('✅ Default admin user created');
                                        
                                        // Insert default services
                                        insertDefaultServices(() => {
                                            console.log('✅ Database initialization complete');
                                            resolve();
                                        });
                                    }
                                );
                            });
                        } else {
                            console.log('✅ Admin user already exists');
                            resolve();
                        }
                    });
                }
            });
        });
    });
}

function insertDefaultServices(callback) {
    const services = [
        ['Deck Cleaning', 'Professional deck cleaning and preparation', 400, 'job', 'Exterior'],
        ['Deck Sealing', 'High-quality deck sealing and protection', 450, 'job', 'Exterior'],
        ['Window Cleaning', 'Interior and exterior window cleaning', 200, 'job', 'Windows'],
        ['Gutter Cleaning', 'Complete gutter cleaning and debris removal', 150, 'job', 'Exterior'],
        ['Roof Washing', 'Soft wash roof cleaning to remove algae and moss', 450, 'job', 'Roof'],
        ['Driveway Cleaning', 'Concrete driveway pressure washing', 275, 'job', 'Concrete'],
        ['Oil Stain Removal', 'Specialized oil stain treatment for driveways', 150, 'job', 'Concrete'],
        ['Fence Cleaning', 'Vinyl, wood, or aluminum fence cleaning', 200, 'job', 'Exterior'],
        ['Patio Cleaning', 'Patio and walkway pressure washing', 300, 'job', 'Concrete'],
        ['Pool Deck Cleaning', 'Pool area and deck cleaning', 350, 'job', 'Concrete'],
        ['House Washing', 'Complete exterior house soft wash', 350, 'job', 'Exterior'],
        ['Screen Cleaning', 'Window screen cleaning and treatment', 15, 'each', 'Windows'],
        ['Chandelier Cleaning', 'Outdoor chandelier cleaning', 75, 'each', 'Lighting'],
        ['Garage Door Cleaning', 'Front and side garage door cleaning', 50, 'each', 'Exterior'],
        ['AC Unit Cleaning', 'Air conditioner unit exterior cleaning', 50, 'each', 'Exterior'],
        ['Trash Bin Cleaning', 'Garbage bin sanitization and cleaning', 25, 'each', 'Cleaning'],
        ['Solar Panel Cleaning', 'Gentle solar panel cleaning', 20, 'each', 'Solar'],
        ['Holiday Light Installation', 'Holiday light setup and takedown', 200, 'job', 'Seasonal'],
        ['Pressure Washing Gift Card', 'Gift card for pressure washing services', 100, 'job', 'Gift Cards'],
        ['Commercial Pressure Washing', 'Commercial property pressure washing', 500, 'job', 'Commercial']
    ];

    let completed = 0;
    services.forEach(([name, description, base_price, unit, category]) => {
        db.run(
            `INSERT OR IGNORE INTO services (name, description, base_price, unit, category) VALUES (?, ?, ?, ?, ?)`,
            [name, description, base_price, unit, category],
            () => {
                completed++;
                if (completed === services.length) {
                    console.log('✅ Default services inserted');
                    if (callback) callback();
                }
            }
        );
    });
}

// ==================== START SERVER ====================

async function startServer() {
    try {
        await initializeDatabase();
        
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
    } catch (err) {
        console.error('❌ Failed to initialize database:', err);
        console.error('Stack trace:', err.stack);
        process.exit(1);
    }
}

startServer();

// ==================== GLOBAL ERROR HANDLERS ====================

process.on('uncaughtException', (err) => {
    console.error('❌ UNCAUGHT EXCEPTION:', err.message);
    console.error('Stack:', err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ UNHANDLED REJECTION at:', promise);
    console.error('Reason:', reason);
});
