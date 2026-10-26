const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { MongoClient, ObjectId } = require('mongodb');
const { Resend } = require('resend');
const PDFDocument = require('pdfkit');
const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/invoicing';
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

let db;
let client;

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid auth token' });
  }
}

function getFirebaseAdminApp() {
  const appName = 'render-firebase-admin';
  const existingApp = getApps().find((firebaseApp) => firebaseApp.name === appName);
  if (existingApp) return existingApp;

  const projectId = process.env.MOBILE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.MOBILE_FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.MOBILE_FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    const error = new Error('MOBILE_FIREBASE_PROJECT_ID, MOBILE_FIREBASE_CLIENT_EMAIL, and MOBILE_FIREBASE_PRIVATE_KEY are required');
    error.code = 'FIREBASE_ADMIN_CONFIG_ERROR';
    throw error;
  }

  try {
    return initializeApp(
      {
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
        projectId,
      },
      appName
    );
  } catch (cause) {
    const error = new Error('The mobile Firebase Admin credentials are invalid');
    error.code = 'FIREBASE_ADMIN_CONFIG_ERROR';
    error.cause = cause;
    throw error;
  }
}

async function requireFirebaseAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing Firebase auth token' });

  try {
    const firebaseApp = getFirebaseAdminApp();
    req.firebaseUser = await getAuth(firebaseApp).verifyIdToken(token);
    return next();
  } catch (error) {
    if (error.code === 'FIREBASE_ADMIN_CONFIG_ERROR') {
      console.error('Firebase Admin configuration error:', error.cause || error.message);
      return res.status(503).json({ error: 'Firebase authentication is not configured on the server' });
    }
    return res.status(401).json({ error: 'Invalid or expired Firebase auth token' });
  }
}

async function connectMongo() {
  try {
    client = await MongoClient.connect(MONGODB_URI);
    db = client.db();

    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('companies').createIndex({ userId: 1 });
    await db.collection('clients').createIndex({ userId: 1, companyId: 1 });
    await db.collection('products').createIndex({ userId: 1, companyId: 1 });
    await db.collection('expenses').createIndex({ userId: 1, companyId: 1 });
    await db.collection('documents').createIndex({ userId: 1, companyId: 1 });
    await db.collection('recurring').createIndex({ userId: 1, companyId: 1 });

    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

function parseId(value) {
  if (!value) return null;
  try {
    return new ObjectId(value);
  } catch {
    return value;
  }
}

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'invoicing-backend', database: 'mongodb' });
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password, companyName } = req.body || {};

  if (!email || !password || !companyName) {
    return res.status(400).json({ error: 'Email, password and company name are required' });
  }

  const normalizedEmail = normalizeEmail(email);
  const existing = await db.collection('users').findOne({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json({ error: 'User already exists' });
  }

  const userId = generateId();
  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = {
    id: userId,
    email: normalizedEmail,
    passwordHash,
    companyName: String(companyName).trim(),
    createdAt: new Date().toISOString(),
  };

  await db.collection('users').insertOne(user);

  const company = {
    id: generateId(),
    userId,
    name: String(companyName).trim(),
    createdAt: new Date().toISOString(),
  };

  await db.collection('companies').insertOne(company);

  const publicUser = {
    id: user.id,
    email: user.email,
    companyName: user.companyName,
    createdAt: user.createdAt,
  };

  return res.status(201).json({ token: signToken(publicUser), user: publicUser, company });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await db.collection('users').findOne({ email: normalizedEmail });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(String(password), user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const publicUser = {
    id: user.id,
    email: user.email,
    companyName: user.companyName,
    createdAt: user.createdAt,
  };

  const company = await db.collection('companies').findOne({ userId: user.id }, { sort: { createdAt: -1 } });
  return res.json({ token: signToken(publicUser), user: publicUser, company });
});

app.get('/api/companies', requireAuth, async (req, res) => {
  const rows = await db.collection('companies').find({ userId: req.user.id }).sort({ createdAt: -1 }).toArray();
  res.json(rows);
});

app.post('/api/companies', requireAuth, async (req, res) => {
  const { name, tagline, brandColor, email, phone, address, gstin } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Company name is required' });

  const company = {
    id: generateId(),
    userId: req.user.id,
    name: String(name),
    tagline: tagline || null,
    brandColor: brandColor || null,
    email: email || null,
    phone: phone || null,
    address: address || null,
    gstin: gstin || null,
    createdAt: new Date().toISOString(),
  };

  await db.collection('companies').insertOne(company);
  res.status(201).json(company);
});

app.put('/api/companies/:id', requireAuth, async (req, res) => {
  const companyId = parseId(req.params.id) || req.params.id;
  const result = await db.collection('companies').findOneAndUpdate(
    { id: req.params.id, userId: req.user.id },
    { $set: req.body },
    { returnDocument: 'after' }
  );
  res.json(result.value);
});

app.delete('/api/companies/:id', requireAuth, async (req, res) => {
  await db.collection('companies').deleteOne({ id: req.params.id, userId: req.user.id });
  res.json({ success: true });
});

app.get('/api/clients', requireAuth, async (req, res) => {
  const rows = await db.collection('clients').find({ userId: req.user.id }).sort({ name: 1 }).toArray();
  res.json(rows);
});

app.post('/api/clients', requireAuth, async (req, res) => {
  const { companyId, name, email, phone, group, address } = req.body || {};
  if (!companyId || !name) return res.status(400).json({ error: 'Company and name are required' });

  const client = {
    id: generateId(),
    userId: req.user.id,
    companyId,
    name: String(name),
    email: email || null,
    phone: phone || null,
    group: group || null,
    address: address || null,
    createdAt: new Date().toISOString(),
  };

  await db.collection('clients').insertOne(client);
  res.status(201).json(client);
});

app.put('/api/clients/:id', requireAuth, async (req, res) => {
  const result = await db.collection('clients').findOneAndUpdate(
    { id: req.params.id, userId: req.user.id },
    { $set: req.body },
    { returnDocument: 'after' }
  );
  res.json(result.value);
});

app.delete('/api/clients/:id', requireAuth, async (req, res) => {
  await db.collection('clients').deleteOne({ id: req.params.id, userId: req.user.id });
  res.json({ success: true });
});

app.get('/api/products', requireAuth, async (req, res) => {
  const rows = await db.collection('products').find({ userId: req.user.id }).sort({ name: 1 }).toArray();
  res.json(rows);
});

app.post('/api/products', requireAuth, async (req, res) => {
  const { companyId, name, price, stock, leadTime, sku } = req.body || {};
  if (!companyId || !name) return res.status(400).json({ error: 'Company and name are required' });

  const product = {
    id: generateId(),
    userId: req.user.id,
    companyId,
    name: String(name),
    price: Number(price || 0),
    stock: Number(stock || 0),
    leadTime: leadTime || null,
    sku: sku || null,
    createdAt: new Date().toISOString(),
  };

  await db.collection('products').insertOne(product);
  res.status(201).json(product);
});

app.put('/api/products/:id', requireAuth, async (req, res) => {
  const result = await db.collection('products').findOneAndUpdate(
    { id: req.params.id, userId: req.user.id },
    { $set: req.body },
    { returnDocument: 'after' }
  );
  res.json(result.value);
});

app.delete('/api/products/:id', requireAuth, async (req, res) => {
  await db.collection('products').deleteOne({ id: req.params.id, userId: req.user.id });
  res.json({ success: true });
});

app.get('/api/expenses', requireAuth, async (req, res) => {
  const rows = await db.collection('expenses').find({ userId: req.user.id }).sort({ date: -1 }).toArray();
  res.json(rows);
});

app.post('/api/expenses', requireAuth, async (req, res) => {
  const { companyId, description, amount, date, vendor, category } = req.body || {};
  if (!companyId || !description) return res.status(400).json({ error: 'Company and description are required' });

  const item = {
    id: generateId(),
    userId: req.user.id,
    companyId,
    description: String(description),
    amount: Number(amount || 0),
    date: date || new Date().toISOString(),
    vendor: vendor || null,
    category: category || null,
    createdAt: new Date().toISOString(),
  };

  await db.collection('expenses').insertOne(item);
  res.status(201).json(item);
});

app.delete('/api/expenses/:id', requireAuth, async (req, res) => {
  await db.collection('expenses').deleteOne({ id: req.params.id, userId: req.user.id });
  res.json({ success: true });
});

app.get('/api/documents', requireAuth, async (req, res) => {
  const rows = await db.collection('documents').find({ userId: req.user.id }).sort({ createdAt: -1 }).toArray();
  const withItems = rows.map((doc) => ({ ...doc, items: doc.items || [] }));
  res.json(withItems);
});

app.post('/api/documents', requireAuth, async (req, res) => {
  const { companyId, clientId, type, subtotal, taxRate, taxAmount, total, status, notes, dueDate, items = [] } = req.body || {};
  if (!companyId || !clientId) return res.status(400).json({ error: 'Company and client are required' });

  const doc = {
    id: generateId(),
    userId: req.user.id,
    companyId,
    clientId,
    clientName: req.body.clientName || null,
    type: type || 'invoice',
    number: `DOC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    subtotal: Number(subtotal || 0),
    taxRate: Number(taxRate || 0),
    taxAmount: Number(taxAmount || 0),
    total: Number(total || 0),
    status: status || 'draft',
    notes: notes || null,
    dueDate: dueDate || null,
    items: (items || []).map((item, idx) => ({
      id: generateId(),
      name: item.name,
      qty: Number(item.qty || 0),
      price: Number(item.price || 0),
      documentId: null,
      index: idx,
    })),
    createdAt: new Date().toISOString(),
  };

  await db.collection('documents').insertOne(doc);
  res.status(201).json(doc);
});

app.put('/api/documents/:id/status', requireAuth, async (req, res) => {
  const result = await db.collection('documents').findOneAndUpdate(
    { id: req.params.id, userId: req.user.id },
    { $set: { status: req.body.status || 'draft' } },
    { returnDocument: 'after' }
  );
  res.json(result.value);
});

app.delete('/api/documents/:id', requireAuth, async (req, res) => {
  await db.collection('documents').deleteOne({ id: req.params.id, userId: req.user.id });
  res.json({ success: true });
});

app.get('/api/recurring', requireAuth, async (req, res) => {
  const rows = await db.collection('recurring').find({ userId: req.user.id }).sort({ nextDate: 1 }).toArray();
  res.json(rows);
});

app.post('/api/recurring', requireAuth, async (req, res) => {
  const { companyId, clientId, amount, frequency, nextDate, description, clientName } = req.body || {};
  if (!companyId || !clientId) return res.status(400).json({ error: 'Company and client are required' });

  const item = {
    id: generateId(),
    userId: req.user.id,
    companyId,
    clientId,
    clientName: clientName || null,
    amount: Number(amount || 0),
    frequency: frequency || 'monthly',
    nextDate: nextDate || new Date().toISOString(),
    description: description || null,
    createdAt: new Date().toISOString(),
  };

  await db.collection('recurring').insertOne(item);
  res.status(201).json(item);
});

app.delete('/api/recurring/:id', requireAuth, async (req, res) => {
  await db.collection('recurring').deleteOne({ id: req.params.id, userId: req.user.id });
  res.json({ success: true });
});

const DOCUMENT_EMAIL_LABELS = {
  invoice: 'Invoice',
  proforma: 'Proforma Invoice',
  credit_note: 'Credit Note',
  debit_note: 'Debit Note',
  rfq: 'Request for Quotation',
  purchase_order: 'Purchase Order',
  quote: 'Quote',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatEmailAmount(value) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

function generateDocumentEmailHTML(document, client, company) {
  const rows = (document.items || [])
    .map((item) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee">${escapeHtml(item.name)}</td>
        <td style="padding:10px;text-align:center;border-bottom:1px solid #eee">${Number(item.qty) || 0}</td>
        <td style="padding:10px;text-align:right;border-bottom:1px solid #eee">${formatEmailAmount(item.price)}</td>
        <td style="padding:10px;text-align:right;border-bottom:1px solid #eee">${formatEmailAmount((Number(item.qty) || 0) * (Number(item.price) || 0))}</td>
      </tr>`)
    .join('');

  return `<!doctype html>
    <html><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5">
      <main style="max-width:680px;margin:0 auto;padding:24px">
        <h1>${escapeHtml(company.name)}</h1>
        <p>${escapeHtml(DOCUMENT_EMAIL_LABELS[document.type])} ${escapeHtml(document.number)}</p>
        <p>To: ${escapeHtml(client.name)}</p>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="text-align:left;padding:10px">Item</th>
            <th style="text-align:center;padding:10px">Qty</th>
            <th style="text-align:right;padding:10px">Rate</th>
            <th style="text-align:right;padding:10px">Total</th>
          </tr></thead>
          <tbody>${rows || '<tr><td colspan="4" style="padding:10px">No items</td></tr>'}</tbody>
        </table>
        <p style="text-align:right">Subtotal: ${formatEmailAmount(document.subtotal)}</p>
        <p style="text-align:right">Tax (${Number(document.taxRate) || 0}%): ${formatEmailAmount(document.taxAmount)}</p>
        <h2 style="text-align:right">Total: ${formatEmailAmount(document.total)}</h2>
        ${document.notes ? `<p><strong>Notes:</strong><br>${escapeHtml(document.notes).replace(/\n/g, '<br>')}</p>` : ''}
        <p>The PDF copy of this document is attached.</p>
      </main>
    </body></html>`;
}

function generateDocumentPdf(document, client, company) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ margin: 48 });
    const chunks = [];
    pdf.on('data', (chunk) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    pdf.fontSize(20).text(company.name || 'Company');
    pdf.moveDown(0.4);
    pdf.fontSize(16).text(`${DOCUMENT_EMAIL_LABELS[document.type]} ${document.number || ''}`);
    pdf.fontSize(11).text(`To: ${client.name || ''}`);
    pdf.text(`Date: ${new Date(document.createdAt).toLocaleDateString('en-IN')}`);
    pdf.moveDown();

    for (const item of document.items || []) {
      const quantity = Number(item.qty) || 0;
      const price = Number(item.price) || 0;
      pdf.fontSize(11).text(
        `${item.name || 'Item'}  |  ${quantity} x ${formatEmailAmount(price)}  |  ${formatEmailAmount(quantity * price)}`
      );
    }

    pdf.moveDown();
    pdf.text(`Subtotal: ${formatEmailAmount(document.subtotal)}`, { align: 'right' });
    pdf.text(`Tax (${Number(document.taxRate) || 0}%): ${formatEmailAmount(document.taxAmount)}`, { align: 'right' });
    pdf.fontSize(14).text(`Total: ${formatEmailAmount(document.total)}`, { align: 'right' });
    if (document.notes) pdf.moveDown().fontSize(11).text(`Notes: ${document.notes}`);
    pdf.end();
  });
}

app.post('/api/firebase/documents/:id/send-email', requireFirebaseAuth, async (req, res) => {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return res.status(503).json({ error: 'Email delivery is not configured on the server' });
  }

  const documentId = req.params.id;
  if (!documentId || documentId.includes('/')) {
    return res.status(400).json({ error: 'Invalid document ID' });
  }

  try {
    const userId = req.firebaseUser.uid;
    const firestore = getFirestore(getFirebaseAdminApp());
    const documentRef = firestore.doc(`users/${userId}/documents/${documentId}`);
    const documentSnapshot = await documentRef.get();
    if (!documentSnapshot.exists) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = { id: documentSnapshot.id, ...documentSnapshot.data() };
    if (!DOCUMENT_EMAIL_LABELS[document.type]) {
      return res.status(400).json({ error: 'This document type cannot be emailed' });
    }
    if (typeof document.clientId !== 'string' || typeof document.companyId !== 'string') {
      return res.status(400).json({ error: 'The document is missing its buyer or supplier or company' });
    }

    const [clientSnapshot, companySnapshot] = await Promise.all([
      firestore.doc(`users/${userId}/clients/${document.clientId}`).get(),
      firestore.doc(`users/${userId}/companies/${document.companyId}`).get(),
    ]);
    if (!clientSnapshot.exists || !companySnapshot.exists) {
      return res.status(400).json({ error: 'The buyer or supplier and company must exist' });
    }

    const contact = clientSnapshot.data();
    const company = companySnapshot.data();
    if (contact.companyId && contact.companyId !== document.companyId) {
      return res.status(400).json({ error: 'The buyer or supplier does not belong to this company' });
    }

    const recipientEmail = String(contact.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return res.status(400).json({ error: 'Add a valid email address to this buyer or supplier first' });
    }

    const label = DOCUMENT_EMAIL_LABELS[document.type];
    const pdf = await generateDocumentPdf(document, contact, company);
    const resendClient = new Resend(process.env.RESEND_API_KEY);
    const companyEmail = String(company.email || '').trim();
    const result = await resendClient.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: [recipientEmail],
      subject: `${label} ${document.number} from ${company.name}`,
      html: generateDocumentEmailHTML(document, contact, company),
      attachments: [{
        filename: `${String(document.number || 'document').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
        content: pdf.toString('base64'),
      }],
      ...(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail) ? { replyTo: companyEmail } : {}),
    });

    if (result.error) {
      console.error('Resend email error:', result.error);
      return res.status(502).json({ error: 'Resend could not deliver this email. Please try again.' });
    }

    const nextStatus = document.status === 'draft'
      ? (document.type === 'rfq' ? 'waiting_for_approval' : 'sent')
      : document.status;
    await documentRef.update({
      status: nextStatus,
      sentAt: new Date().toISOString(),
      sentTo: recipientEmail,
    });

    return res.json({
      success: true,
      recipientEmail,
      documentNumber: document.number,
      status: nextStatus,
    });
  } catch (error) {
    console.error('Firebase document email error:', error);
    return res.status(500).json({ error: 'Failed to send document email' });
  }
});

// ==================== EMAIL ENDPOINT ====================
app.post('/api/documents/:id/send-email', requireAuth, async (req, res) => {
  const { recipientEmail, companyName } = req.body || {};
  
  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return res.status(400).json({ error: 'Valid recipient email is required' });
  }

  try {
    // Fetch the document
    const doc = await db.collection('documents').findOne({
      id: req.params.id,
      userId: req.user.id,
    });

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Fetch client details
    const client = await db.collection('clients').findOne({
      id: doc.clientId,
      userId: req.user.id,
    });

    const clientName = client?.name || doc.clientName || 'Valued Client';
    
    const emailFrom = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'onboarding@resend.dev';
    const emailContent = {
      to: [recipientEmail],
      from: emailFrom,
      subject: `${doc.type.charAt(0).toUpperCase() + doc.type.slice(1)} ${doc.number} from ${companyName}`,
      html: generateInvoiceHTML(doc, clientName, companyName),
    };

    if (!resend || !process.env.RESEND_API_KEY) {
      console.error('Resend is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL in backend/.env');
      return res.status(500).json({ error: 'Email service is not configured' });
    }

    const response = await resend.emails.send({
      from: emailContent.from,
      to: emailContent.to,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    if (response.error) {
      console.error('Resend email error:', response.error);
      throw new Error(response.error.message || 'Resend rejected the email');
    }

    console.log('📧 Email sent via Resend:', {
      id: response.data?.id || null,
      to: recipientEmail,
      subject: emailContent.subject,
      docId: doc.id,
      docNumber: doc.number,
    });

    const nextStatus = doc.type === 'rfq' ? 'waiting_for_approval' : 'sent';

    await db.collection('documents').updateOne(
      { id: req.params.id, userId: req.user.id },
      { $set: { status: nextStatus, sentAt: new Date().toISOString(), sentTo: recipientEmail } }
    );

    res.json({
      success: true,
      message: `Document sent to ${recipientEmail}`,
      documentId: doc.id,
      documentNumber: doc.number,
    });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

function generateInvoiceHTML(doc, clientName, companyName) {
  const itemsHTML = (doc.items || [])
    .map(
      (item) =>
        `<tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 12px; text-align: left;">${item.name}</td>
          <td style="padding: 12px; text-align: center;">${item.qty}</td>
          <td style="padding: 12px; text-align: right;">₹${Number(item.price).toFixed(2)}</td>
          <td style="padding: 12px; text-align: right;">₹${Number(item.qty * item.price).toFixed(2)}</td>
        </tr>`
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .company-name { font-size: 24px; font-weight: bold; color: #1f2937; }
        .doc-type { font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th { background-color: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; }
        .totals { text-align: right; margin-top: 20px; }
        .total-row { display: flex; justify-content: flex-end; margin: 8px 0; font-weight: 500; }
        .grand-total { font-size: 18px; font-weight: bold; color: #059669; margin-top: 15px; }
        .footer { margin-top: 40px; text-align: center; color: #9ca3af; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="company-name">${companyName}</div>
          <div class="doc-type">${doc.type === 'invoice' ? 'Invoice' : doc.type === 'proforma' ? 'Proforma Invoice' : doc.type === 'rfq' ? 'Request for Quotation' : doc.type.toUpperCase()}</div>
        </div>

        <div style="margin-bottom: 20px;">
          <p><strong>Bill To:</strong> ${clientName}</p>
          <p><strong>Document #:</strong> ${doc.number}</p>
          <p><strong>Date:</strong> ${new Date(doc.createdAt).toLocaleDateString()}</p>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Rate</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>₹${Number(doc.subtotal).toFixed(2)}</span>
          </div>
          ${
            doc.taxAmount > 0
              ? `<div class="total-row">
              <span>Tax (${doc.taxRate}%):</span>
              <span>₹${Number(doc.taxAmount).toFixed(2)}</span>
            </div>`
              : ''
          }
          <div class="grand-total">
            <span>Total:</span>
            <span>₹${Number(doc.total).toFixed(2)}</span>
          </div>
        </div>

        ${doc.notes ? `<div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border-radius: 8px;"><strong>Notes:</strong><br>${doc.notes}</div>` : ''}

        <div class="footer">
          <p>This is an automated document from ${companyName}.</p>
          <p>Thank you for your business!</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function start() {
  await connectMongo();
  app.listen(PORT, () => {
    console.log(`MongoDB backend running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = { app, connectMongo };
