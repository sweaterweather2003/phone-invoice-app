# Invoicing Mobile Backend

This Express backend serves the web app and mobile app. The mobile app stores its documents in Firebase Firestore; the Firebase email endpoint verifies Firebase ID tokens and only reads the signed-in user's Firestore data.

## Start

```bash
cd backend
npm install
npm start
```

## Environment

Configure the existing Render service with:

- `MOBILE_FIREBASE_PROJECT_ID`, `MOBILE_FIREBASE_CLIENT_EMAIL`, and `MOBILE_FIREBASE_PRIVATE_KEY`: credentials for a Firebase service account in the mobile app's Firebase project. These are separate Render variables so the existing website Firebase variables are not changed.
- `RESEND_API_KEY`: a newly generated Resend API key.
- `RESEND_FROM_EMAIL`: an address on a domain verified in Resend.
- Existing backend variables such as `PORT`, `JWT_SECRET`, and `MONGODB_URI` remain as configured for the website.

For local development, copy `.env.example` to `.env` and fill in these values. Never commit `.env` or a service-account private key.

## API base

```text
http://localhost:4000/api
```

## Auth endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`

## Protected endpoints

- `GET /api/companies`
- `POST /api/companies`
- `GET /api/clients`
- `POST /api/clients`
- `PUT /api/clients/:id`
- `DELETE /api/clients/:id`
- `GET /api/products`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`
- `GET /api/expenses`
- `POST /api/expenses`
- `DELETE /api/expenses/:id`
- `GET /api/documents`
- `POST /api/documents`
- `PUT /api/documents/:id/status`
- `DELETE /api/documents/:id`
- `GET /api/recurring`
- `POST /api/recurring`
- `DELETE /api/recurring/:id`

All protected routes require a bearer token from the register/login response.

The mobile email route is `POST /api/firebase/documents/:id/send-email`. It requires a Firebase ID token in the bearer authorization header; the recipient and document data are loaded from Firestore, not trusted from the request body.
