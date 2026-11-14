# Briefcase

Briefcase is a legal practice workspace for Moyo & Partners, Harare. It is built with Next.js App Router, strict TypeScript, Tailwind CSS, Firebase Authentication, Firestore, and Firebase Storage.

## Local setup

1. Create a Firebase project and a Web app. Enable **Google** in Authentication → Sign-in method.
2. Create a Cloud Firestore database and enable Firebase Storage.
3. Copy `.env.example` to `.env.local` and set the Firebase Web app values, the project ID, and a service account email/private key. Generate the session secret with `openssl rand -base64 48`.
4. Add `localhost` and the production hostname to Firebase Authentication → Settings → Authorized domains.
5. Install dependencies and start the app:

   ```sh
   npm install
   npm run dev
   ```

6. Sign in with Google. The first verified account creates the initial Moyo & Partners workspace as its Administrator. Later colleagues must be invited from **Team & Settings** and sign in with the invited email address.

The firm name, address, phone and email can be changed in Team & Settings. Each workspace has its own tenant ID and separate Firestore/Storage records.

## Firebase rules and deployment

Deploy the included multi-tenant rules from the Firebase project root:

```sh
firebase deploy --only firestore:rules,storage
```

Set the same environment variables in the hosting platform. `SESSION_SECRET`, the service account email and the service account private key are server-only; do not prefix them with `NEXT_PUBLIC_`. Keep the service account limited to the Firebase project used by this deployment. Build and serve with:

```sh
npm run build
npm run start
```

The app stores the Firebase web configuration in public environment variables as required by the client SDK. Admin routes validate Firebase ID tokens, provision workspace documents, and issue an HS256 session JWT in an HTTP-only, `SameSite=Strict` cookie. The middleware verifies that JWT on `/dashboard/*`. Firebase custom claims provide `firmId` and `role` to Firestore/Storage rules; client SDK calls are constrained to the matching tenant. Session JWTs last two hours and refresh while an authenticated workspace is active.

## Workspace modules

- **Overview:** live matters, client and billing summaries; upcoming work; task completion.
- **Matters:** create, edit, filter, and delete matters with generated `EST-YYYY-NNN` references.
- **Clients:** client directory with edit/delete and linked matter references.
- **Calendar:** month view with court hearings, consultations, filing deadlines and meetings, displayed in Harare time.
- **Tasks:** assigned checklist items with real-time completion state.
- **Documents:** matter-linked uploads to firm-scoped Firebase Storage, with 25 MB limits and five-minute signed download links.
- **Billing:** USD invoices, status changes, totals, and due dates.
- **Team & Settings:** firm profile and role-based invitations for Administrators and Partners.

Firestore listeners power the shared workspace state. New invited members are provisioned when they first authenticate with Google. The app creates invitation records; it does not send email, so share the invite address through the firm’s usual communication channel.

## Environment variables

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Browser | Firebase Web app API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Browser | Firebase Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Browser | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Browser | Firebase Storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Browser | Firebase Web app sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Browser | Firebase Web app ID |
| `FIREBASE_PROJECT_ID` | Server | Firebase Admin project ID |
| `FIREBASE_CLIENT_EMAIL` | Server | Service account email |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Server | Service account private key; use escaped newlines in hosting settings |
| `SESSION_SECRET` | Server | At least 32 characters for signing workspace JWTs |
