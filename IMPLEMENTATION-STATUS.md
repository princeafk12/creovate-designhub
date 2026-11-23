# CREOVATE DesignHub implementation status

Updated 2026-11-23.

## Prepared in the project

- Login-first gate on the main product route.
- Owner-only admin access for `olanitealabij2023@gmail.com`, with two stored security-question answers. The removed authenticator routes redirect to `/admin-login`.
- Service/pricing updates come through the Firebase/Firestore compatibility adapter and refresh visible price, delivery, and description fields.
- Firebase-backed server-side checkout route for creating an order and a unique Flutterwave hosted checkout link. It remains fail-closed while `PAYMENTS_READY=false`.
- Flutterwave webhook route with legacy `verif-hash` and current signature support, transaction re-verification, amount/currency/reference checks, duplicate-event protection, and paid/failed email hooks.
- Business-plan validator is clearly marked Coming Soon; the live-search route is intentionally disabled until the provider, source verification, safety checks, and spending controls are complete.
- Customer activity is queried with an explicit account filter in the client and enforced by Firestore rules; the owner dashboard can review a selected account read-only.
- Completed validator reports are saved in `validator_checks`; customers can reopen their full report and sources in their account, and the owner can open the saved details from the admin customer view.
- Admin website editor now covers the editable offer message, public copy, and contact/portfolio/social links; changes are stored in `site_settings.content` and applied by the public site without a redeploy.
- Admin now has a visible “View website” link and an owner-only customer password-reset form backed by `functions/api/admin/reset-password.js`.
- The customer forgot-password panel now opens a prefilled WhatsApp request to `08084002972` without asking the customer to send a password.
- The signed-in navigation changes from “Create account” to “My account”; the reset-password link remains available only on the pre-login page.
- Legacy Supabase schema/migrations for transaction references, payment verification, webhook events, validator provider usage, and owner checks are preserved for reference; they are not evidence that the Firebase-backed paid workflow is complete.
- Payment return page and Cloudflare Pages Functions environment template.
- Audit report in `AUDIT-REPORT.md`.
- Business Tools catalogue and Promo Studio input interface. Promo Studio now has a server-side paid-order path, but remains non-generating until the secure AI and payment workflow is configured and tested.
- Promo Studio implementation: server-side Firebase token verification, provider-independent structured output with Gemini as the initial provider and OpenAI as an optional adapter, fail-closed feature flags, verified paid-order entitlement, input limits, per-customer daily allowance, quota/error recovery, Firestore job storage, customer-account result history, download, one controlled free regeneration, and owner usage/revenue monitoring. See `PROMO-STUDIO-SETUP.md`.

## Verified locally

- All JavaScript files pass `node --check`.
- No service-role, Flutterwave secret, Resend key, or Anthropic key is present in the project files.
- The source contains the expected endpoint files and migration markers.

## Still requires the owner

- Firebase, Cloudflare, Flutterwave, Resend, and future AI-provider configuration.
- Migrating the server functions from Supabase to Firebase, or explicitly configuring and retaining Supabase for those workflows.
- Adding production secrets to the Cloudflare secret store.
- Testing and enabling the prepared Gemini-first Promo Studio generation endpoint, saved results, payment entitlements, usage limits, regeneration and capacity pause.
- Owner must create/configure the Gemini key, approved model, Firebase service-account secret and optional cost rates in Cloudflare; no provider key is present in the repository.
- Complete the Flutterwave end-to-end test evidence: server-side ownership, signature verification, independent transaction verification, exact amount/currency/reference checks, duplicate-event protection, entitlement creation, and the account/admin acceptance tests before enabling Promo Studio checkout.
- Testing real sign-in, payments, webhooks, AI provider errors, quota exhaustion, saved results, phone layouts, and the master instruction’s acceptance tests.

No Promo Studio AI generation, live-payment activation, or connected-provider success is claimed until those steps are completed and evidenced.
