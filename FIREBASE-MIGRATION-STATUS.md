# CREOVATE Firebase status

Updated 2026-11-16.

The browser-facing authentication and Firestore adapter now use the Firebase project `creovate-designhub`.

## Completed in this build

- Firebase web configuration added in `firebase-config.js`.
- Supabase browser SDK references replaced with Firebase Auth and Firestore CDN scripts.
- Email/password sign-up, sign-in, sign-out and session checks moved to Firebase Auth.
- Customer profiles, service settings, website settings, orders and validator history use Firestore through the compatibility adapter in `auth.js`.
- Firebase security rules are supplied in `firebase.rules`.
- The admin login uses the owner password plus two security questions. TOTP/authenticator enrollment is no longer part of the current flow; `/mfa` and `/mfa.html` redirect to `/admin-login`.

## Still required before the live site is switched

1. In Firebase Console, enable Authentication → Sign-in method → Email/Password.
2. Create the Firestore database and publish `firebase.rules`.
3. Add the live site domain to Authentication → Settings → Authorized domains: `creovate-designhub.pages.dev`.
4. Decide whether paid workflows will use Firebase end-to-end or whether Supabase will remain the server datastore. The current Cloudflare Functions still use Supabase REST/Auth and are not yet consistent with the Firebase browser data.
5. Do not enable real payments or AI generation until that backend decision, provider secrets, ownership checks, and recovery tests are complete.

The old Supabase copy is preserved in the separate `work/creovate-designhub-final-review` and `work/remote-check-20261009` folders. This migration does not automatically copy old Supabase users, passwords, orders or validator history. Existing customers will need new Firebase accounts unless a separate server-side migration is completed.

The live validator remains Coming Soon. Flutterwave and server-side password-reset functions still use the legacy Supabase adapter and cannot be considered complete for the Firebase-backed site until that boundary is migrated or explicitly configured.


