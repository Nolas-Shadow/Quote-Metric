/**
 * QuoteMetric Database Initialization
 * Creates all tables for the complete system
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

// Use /tmp on Linux (Railway/Render), local on Windows
const isWindows = process.platform === 'win32';
const DB_PATH = isWindows 
    ? path.join(__dirname, '../quotemetric.db')
    : '/tmp/quotemetric.db';

// Ensure directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

console.log('📊 Database path:', DB_PATH);

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err);
        return;
    }
    console.log('✅ Connected to QuoteMetric database');
});

// Create all tables
db.serialize(() => {
    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('owner', 'manager', 'crew_member')),
            phone TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active INTEGER DEFAULT 1
        )
    `);

    // Customers table
    db.run(`
        CREATE TABLE IF NOT EXISTS customers (
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
        )
    `);

    // Services table (price list)
    db.run(`
        CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            base_price REAL NOT NULL,
            unit TEXT DEFAULT 'job',
            category TEXT,
            is_active INTEGER DEFAULT 1
        )
    `);

    // Estimates/Quotes table
    db.run(`
        CREATE TABLE IF NOT EXISTS estimates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            estimate_number TEXT UNIQUE NOT NULL,
            customer_id INTEGER NOT NULL,
            status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'sent', 'approved', 'rejected', 'converted')),
            subtotal REAL DEFAULT 0,
            tax REAL DEFAULT 0,
            total REAL DEFAULT 0,
            notes TEXT,
            valid_until DATE,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    `);

    // Estimate line items
    db.run(`
        CREATE TABLE IF NOT EXISTS estimate_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            estimate_id INTEGER NOT NULL,
            service_id INTEGER,
            description TEXT NOT NULL,
            quantity REAL DEFAULT 1,
            unit_price REAL NOT NULL,
            total REAL NOT NULL,
            is_upsell INTEGER DEFAULT 0,
            FOREIGN KEY (estimate_id) REFERENCES estimates(id),
            FOREIGN KEY (service_id) REFERENCES services(id)
        )
    `);

    // Invoices table
    db.run(`
        CREATE TABLE IF NOT EXISTS invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_number TEXT UNIQUE NOT NULL,
            estimate_id INTEGER,
            customer_id INTEGER NOT NULL,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'partial', 'overdue', 'cancelled')),
            subtotal REAL DEFAULT 0,
            tax REAL DEFAULT 0,
            total REAL DEFAULT 0,
            amount_paid REAL DEFAULT 0,
            due_date DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (estimate_id) REFERENCES estimates(id),
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        )
    `);

    // Jobs table
    db.run(`
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_number TEXT UNIQUE NOT NULL,
            estimate_id INTEGER,
            customer_id INTEGER NOT NULL,
            status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
            scheduled_date DATE,
            scheduled_time TEXT,
            assigned_crew TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (estimate_id) REFERENCES estimates(id),
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        )
    `);

    // Photos table (QuoteMetric Cam)
    db.run(`
        CREATE TABLE IF NOT EXISTS photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER,
            customer_id INTEGER,
            type TEXT CHECK(type IN ('before', 'after', 'inspection')),
            filename TEXT NOT NULL,
            filepath TEXT NOT NULL,
            ai_analyzed INTEGER DEFAULT 0,
            ai_upsell_data TEXT,
            uploaded_by INTEGER,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (job_id) REFERENCES jobs(id),
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            FOREIGN KEY (uploaded_by) REFERENCES users(id)
        )
    `);

    // Measurements table (MapMeasure Pro)
    db.run(`
        CREATE TABLE IF NOT EXISTS measurements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            type TEXT CHECK(type IN ('roof', 'driveway', 'lawn', 'siding', 'deck', 'other')),
            square_footage REAL,
            linear_footage REAL,
            notes TEXT,
            satellite_image TEXT,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    `);

    // Messages table (ClientHub)
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            user_id INTEGER,
            type TEXT CHECK(type IN ('email', 'sms')),
            subject TEXT,
            body TEXT NOT NULL,
            status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'sent', 'delivered', 'failed')),
            sent_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Analytics table (for tracking metrics)
    db.run(`
        CREATE TABLE IF NOT EXISTS analytics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            metric_name TEXT NOT NULL,
            metric_value REAL NOT NULL,
            date DATE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // AI Upsell Templates (pre-defined upsell suggestions)
    db.run(`
        CREATE TABLE IF NOT EXISTS ai_upsell_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            detected_object TEXT NOT NULL,
            suggested_service TEXT NOT NULL,
            service_id INTEGER,
            confidence_threshold REAL DEFAULT 0.7,
            FOREIGN KEY (service_id) REFERENCES services(id)
        )
    `);

    console.log('✅ All tables created successfully');

    // Insert default admin user
    const adminPassword = bcrypt.hashSync('admin123', 10);
    db.run(`
        INSERT OR IGNORE INTO users (email, password, first_name, last_name, role, phone)
        VALUES (?, ?, ?, ?, ?, ?)
    `, ['admin@quotemetric.io', adminPassword, 'Admin', 'User', 'owner', '(248) 202-7636'], function(err) {
        if (err) {
            console.log('⚠️  Admin user may already exist');
        } else {
            console.log('✅ Default admin user created');
            console.log('   Email: admin@quotemetric.io');
            console.log('   Password: admin123');
        }
    });

    // Insert default services
    const defaultServices = [
        ['House Washing', 'Exterior house soft wash', 350, 'job', 'Cleaning'],
        ['Roof Washing', 'Roof cleaning and treatment', 450, 'job', 'Cleaning'],
        ['Gutter Cleaning', 'Remove debris from gutters', 150, 'job', 'Maintenance'],
        ['Window Cleaning', 'Interior and exterior windows', 200, 'job', 'Cleaning'],
        ['Driveway Cleaning', 'Pressure wash driveway', 275, 'job', 'Cleaning'],
        ['Deck Cleaning', 'Clean and seal deck', 400, 'job', 'Cleaning'],
        ['Fence Cleaning', 'Pressure wash fence', 200, 'job', 'Cleaning'],
        ['Patio Cleaning', 'Clean patio/pavers', 300, 'job', 'Cleaning'],
        ['Siding Cleaning', 'Soft wash siding', 350, 'job', 'Cleaning'],
        ['Soffit & Fascia', 'Clean soffit and fascia', 250, 'job', 'Cleaning'],
        ['Pressure Washing', 'General pressure washing', 300, 'job', 'Cleaning'],
        ['Soft Washing', 'Gentle soft wash treatment', 350, 'job', 'Cleaning'],
        ['Gutter Guard Install', 'Install gutter guards', 8, 'linear_foot', 'Installation'],
        ['Holiday Lighting', 'Install holiday lights', 500, 'job', 'Installation'],
        ['Paver Sealing', 'Seal paver surfaces', 450, 'job', 'Sealing'],
        ['Roof Treatment', 'Apply roof treatment', 550, 'job', 'Treatment'],
        ['Mold Treatment', 'Anti-mold treatment', 200, 'job', 'Treatment'],
        ['Graffiti Removal', 'Remove graffiti', 250, 'job', 'Specialty'],
        ['Oil Stain Removal', 'Remove oil stains from concrete', 150, 'job', 'Specialty'],
        ['Pool Deck Cleaning', 'Clean pool deck area', 350, 'job', 'Cleaning']
    ];

    let inserted = 0;
    defaultServices.forEach(service => {
        db.run(`
            INSERT OR IGNORE INTO services (name, description, base_price, unit, category)
            VALUES (?, ?, ?, ?, ?)
        `, service, function(err) {
            inserted++;
            if (inserted === defaultServices.length) {
                console.log(`✅ ${defaultServices.length} default services added`);
                console.log('\n🎉 Database initialization complete!');
                console.log('\n📊 Database created at:', DB_PATH);
                db.close();
            }
        });
    });

    // Insert AI Upsell Templates
    const aiTemplates = [
        ['deck', 'Deck Cleaning', 6],
        ['deck', 'Deck Sealing', 16],
        ['window', 'Window Cleaning', 4],
        ['gutter', 'Gutter Cleaning', 3],
        ['roof', 'Roof Washing', 2],
        ['driveway', 'Driveway Cleaning', 5],
        ['driveway', 'Oil Stain Removal', 18],
        ['fence', 'Fence Cleaning', 7],
        ['patio', 'Patio Cleaning', 8],
        ['pool', 'Pool Deck Cleaning', 15],
        ['sidewalk', 'Pressure Washing', 10],
        ['siding', 'House Washing', 1],
        ['siding', 'Siding Cleaning', 9]
    ];

    aiTemplates.forEach(template => {
        db.run(`
            INSERT OR IGNORE INTO ai_upsell_templates (detected_object, suggested_service, service_id)
            VALUES (?, ?, ?)
        `, template);
    });

    console.log('✅ AI Upsell templates added');
});
