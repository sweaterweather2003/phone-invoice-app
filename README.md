# Invoicing Pro — Mobile App

A complete **Expo / React Native** phone app backed by Firebase Authentication and Cloud Firestore.

All data is stored **locally on the device** using SQLite — nothing is lost when you close the app or go offline.

---

## Features

| Feature | Status |
|---------|--------|
| Multi-brand / multi-company workspaces | ✅ |
| Dashboard with live stats (SKUs, stock value, outstanding, expenses) | ✅ |
| Clients CRUD | ✅ |
| Products / Inventory CRUD (price, stock, SKU, lead time) | ✅ |
| Documents: Invoice, Proforma, Credit Note, Debit Note, RFQ, Quote, PO | ✅ |
| Line items + tax + totals | ✅ |
| Document status (Draft → Sent → Paid) | ✅ |
| Share document summary | ✅ |
| Expenses tracking | ✅ |
| Recurring billing cycles | ✅ |
| Basic P&L snapshot | ✅ |
| Beautiful modern UI | ✅ |
| Firebase-backed data | ✅ |

---

## Quick start

### 1. Install dependencies

```bash
cd InvoicingMobile
npm install
```

If you hit peer dependency issues:

```bash
npx expo install --fix
```

### 2. Start Expo

```bash
npx expo start
```

Then:

- Press **`a`** for Android emulator / connected device  
- Press **`i`** for iOS simulator  
- Scan the QR code with **Expo Go** on a physical phone  

---

## Project structure

```
InvoicingMobile/
├── app/                    # Expo Router screens
│   ├── (tabs)/             # Bottom tabs: Dashboard, Documents, Clients, Inventory, More
│   ├── company-select.tsx
│   ├── company-create.tsx
│   ├── client-form.tsx
│   ├── product-form.tsx
│   ├── expense-form.tsx
│   ├── document-form.tsx
│   ├── document-detail.tsx
│   └── recurring-form.tsx
├── functions/              # Firebase callable functions + Resend email delivery
├── src/
│   ├── db/firebaseDb.ts    # Firestore CRUD
│   ├── hooks/useCompany.tsx
│   ├── components/ui.tsx   # Reusable UI kit
│   ├── theme/              # Colors, spacing, typography
│   ├── types/
│   └── utils/format.ts
├── app.json
└── package.json
```

---

## Firebase and email setup

The app uses Firebase Authentication and Firestore, and sends document emails through the existing Render backend. Configure `MOBILE_FIREBASE_PROJECT_ID`, `MOBILE_FIREBASE_CLIENT_EMAIL`, and `MOBILE_FIREBASE_PRIVATE_KEY` on Render for the mobile Firebase Admin connection; these separate variables do not replace the website's Firebase settings. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` on Render; the sender must belong to a domain verified in Resend. Keep all credentials in Render's server-side environment settings, never in the mobile app.

Once the backend is redeployed, the app can email the selected buyer or supplier when creating a document, or send/resend it from the document details screen. Each email includes a PDF attachment. Firebase Cloud Functions deployment is not required.

Existing data previously stored in the old local database is not uploaded automatically; export or migrate it before removing the old app build.

---

## How this maps to the web app

| Web page | Mobile screen |
|----------|---------------|
| index.html (brand select) | Company Select / Create |
| dashboard.html | Dashboard tab |
| clients.html | Clients tab |
| products.html | Inventory tab |
| invoice.html | New Document (modal) |
| expenses.html | More → Expenses |
| recurring.html | More → Recurring |
| reports.html | More → Reports & P&L |

---

## Building a standalone APK / IPA

```bash
# Install EAS CLI
npm i -g eas-cli
eas login

# Configure
eas build:configure

# Build Android
eas build -p android --profile preview

# Build iOS (requires Apple developer account)
eas build -p ios --profile preview
```

---

## Notes

- Currency is formatted in **INR (₹)** to match the original web app.
- PDFs can be shared locally with `expo-print`; emailed PDFs are generated and sent by the Firebase callable function in `functions/index.js`.
- The old `backend/` Express/MongoDB service is no longer used by the mobile app and can be retired after any required data migration.

Enjoy your mobile invoicing suite!
