# Biniyam Travel & Commerce

An English-language, responsive starter website with a luxury black-and-gold theme. It includes a product catalogue, cart and order requests, travel package requests, hotel booking requests, contact form, and an owner-only admin dashboard.

## 1. Run it locally for free

Requirements: a computer and Node.js 18 or newer.

1. Download and extract this ZIP.
2. Install the current Node.js LTS release from https://nodejs.org/.
3. Open the extracted `abyssinia_travel_commerce` folder.
4. Open a terminal/Command Prompt in that folder.
5. Run `npm start`.
6. Open http://localhost:3000 in your browser.

Local demo login: username `admin`, password `ChangeThisAdminPassword123!`. Change it before publishing. This default is for local testing only.

## 2. Publish a free test version using GitHub + Render

1. Create an account at https://github.com/ and create a repository named `biniyam-travel-commerce`.
2. Upload the contents of this extracted project folder into the repository. `package.json` must be at the repository root (not inside an extra nested folder).
3. Create an account at https://render.com/.
4. Choose **New → Web Service**, connect your GitHub repository, and use:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: `Free` (if available for your account/region)
5. Before deploying, open the service's **Environment** settings and add:
   - `NODE_ENV` = `production`
   - `ADMIN_USER` = your private admin username
   - `ADMIN_PASSWORD` = a strong, unique password (do not reuse the demo password)
   - `SESSION_SECRET` = a long random secret (at least 32 random characters)
6. Deploy. Render will provide a public `onrender.com` URL. Open it and test the site and owner login.

Free hosting may sleep when idle. The starter stores records in a local JSON file, which is not reliable persistent storage on many free hosting setups; do not use it for real customer orders until a persistent database and backups are configured.

## 3. Admin dashboard

Use the **Admin** link on the website and sign in with the environment credentials. The server protects admin APIs with a signed, HTTP-only session cookie. Do not publish credentials or commit secrets into GitHub. Before accepting real orders, add rate limiting, CSRF protection, database persistence, backups, audit logging, and privacy/terms pages.

## 4. Telebirr and CBE payment integration

The checkout currently lets customers select Telebirr, CBE Birr, or CBE bank transfer and records an order request. It does **not** automatically collect or verify money. To enable real payment processing:

1. Contact Telebirr and Commercial Bank of Ethiopia through their official business/merchant channels and request merchant onboarding and the current approved payment/API documentation.
2. Obtain merchant credentials only through the official provider.
3. Implement server-side payment initiation and callback/webhook verification. Keep all secrets in hosting environment variables; never put them in browser JavaScript or public GitHub files.
4. Mark an order as paid only after verifying the provider's server-side confirmation. Test in any provider-provided sandbox first.

Hotel inventory/availability is not connected to hotel systems; hotel and travel forms submit booking requests that the owner must confirm manually.

## Current demo limitations

- Sample products and travel packages are illustrative. Replace prices, stock, descriptions, and contact details before launch.
- Product pictures are simple emoji/illustrations; add licensed product images for a real shop.
- JSON storage is suitable only for local testing, not production customer data.
- No automatic payment gateway or automatic hotel availability integration is included.
