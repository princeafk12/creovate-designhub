# Firebase migration status

The browser-facing authentication and Firestore adapter now use the Firebase project `creovate-designhub`.

## Completed in this build

- Firebase web configuration added in `firebase-config.js`.
- Supabase browser SDK references replaced with Firebase Auth and Firestore CDN scripts.
- Email/password sign-up, sign-in, sign-out and session checks moved to Firebase Auth.
- Customer profiles, service settings, website settings, orders and validator history use Firestore through the compatibility adapter in `auth.js`.
- Firebase security rules are supplied in `firebase.rules`.
- Admin TOTP enrollment and sign-in code are supplied in `mfa.js` and `admin-mfa.js`.

## Still required before the live site is switched

1. In Firebase Console, enable Authentication → Sign-in method → Email/Password.
2. Create the Firestore database and publish `firebase.rules`.
3. Add the live site domain to Authentication → Settings → Authorized domains: `creovate-designhub.pages.dev`.
4. Enable the Firebase TOTP provider using the authenticated Cloud Shell command in `FIREBASE-TOTP-ENABLE.md`.
5. Verify the owner email, enroll Google Authenticator at `/mfa.html`, then test the required six-digit code at `/admin-login.html`.
6. Deploy this updated build to the GitHub repository connected to Cloudflare Pages.
7. Test a new customer account, an existing account, the owner account, customer isolation and logout.

The old Supabase copy is preserved in the separate `work/creovate-designhub-final-review` and `work/remote-check-20261009` folders. This migration does not automatically copy old Supabase users, passwords, orders or validator history. Existing customers will need new Firebase accounts unless a separate server-side migration is completed.

The live validator remains Coming Soon, and Flutterwave/server-side password-reset functions still require their own Firebase server migration before they can be considered complete.


