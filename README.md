# CREOVATE - DesignHub

This is the CREOVATE Digital Space site foundation. It contains the login-first customer experience, design services, WhatsApp brief handoff, portfolio links, saved account views, an owner-only admin area, and the first Business Tools interface milestone: Promo Studio.

## Before publishing

The current public address is `https://creovate-designhub.pages.dev/`. This free Cloudflare Pages address works without a custom domain. If you later add a custom domain, update the canonical URL, `robots.txt`, and `sitemap.xml` together.

## Remaining setup

The browser-facing build uses Firebase Authentication and Firestore. Enable Email/Password in Firebase Authentication, create Firestore, publish `firebase.rules`, and keep `olanitealabij2023@gmail.com` as the only owner account. The admin area uses two security questions; the old authenticator routes redirect to `/admin-login`. The checkout and Flutterwave webhook functions now use Firebase; the legacy Supabase-only password-reset function remains a separate migration item.

The default site route, service catalogue, Business Tools section, brief form, account, and admin area require an authenticated customer session. Promo Studio now creates a paid tool order and has a fail-closed OpenAI generation path with saved results, download support, one controlled free regeneration, daily limits and owner usage monitoring. It remains disabled until the owner completes `PROMO-STUDIO-SETUP.md`, configures the provider secrets, and finishes payment testing. It does not charge while disabled. The live business validator is marked Coming Soon. Never place server secrets in frontend files. The login recovery link opens a WhatsApp request to `08084002972`.

## Publish with Cloudflare Pages

1. Create or sign in to a Cloudflare account.
2. Open Workers & Pages and create a Pages project from the GitHub repository.
3. Choose the no-framework/static option. Leave the build command empty or use `exit 0`; use the repository root as the output directory.
4. Deploy and use the assigned `*.pages.dev` address while you do not have a custom domain.
5. Submit `https://creovate-designhub.pages.dev/sitemap.xml` in Google Search Console and Bing Webmaster Tools. Search engines may take time to list a new site; publication is live immediately, but indexing is not guaranteed or instant.

Cloudflare Pages Functions are discovered from the `functions/` folder. The checkout expects the Flutterwave variables listed in `.dev.vars.example`; keep `PAYMENTS_READY=false` until the test checkout, webhook, transaction-verification, duplicate-event, and account/admin acceptance tests pass. Keep all payment activity in test mode until those tests pass.
