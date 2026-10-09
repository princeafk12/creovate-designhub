# CREOVATE - DesignHub

This is the CREOVATE DesignHub site foundation. It contains the login-first customer experience, service details, WhatsApp brief handoff, server-side checkout/webhook/validator function routes, portfolio links, saved orders and reports, and an owner-only admin area for offer, service, public content, customer review, and customer password support.

## Before publishing

The current public address is `https://creovate-designhub.pages.dev/`. This free Cloudflare Pages address works without a custom domain. If you later add a custom domain, update the canonical URL, `robots.txt`, and `sitemap.xml` together.

## Remaining setup

Run `schema.sql` once in the Supabase SQL Editor. If the database already exists, run `mfa-migration.sql`, `phase-3-4-migration.sql`, and `phase-5-admin-content-password-migration.sql` too. Then create the owner account through `login.html`, promote only `olanitealabij2023@gmail.com` with the SQL comment at the bottom of the schema, and enrol an authenticator app from `admin-login.html`. The server function routes require the environment variables documented in `.dev.vars.example`.

The default site route, service catalog, brief form, validator, account, and admin area require an authenticated customer session. The server checkout endpoint creates the order and Flutterwave payment link. The webhook re-verifies the transaction before marking it paid. The validator uses the server-side live-search provider and saves source-backed reports when its caps are configured. Never place server secrets in frontend files. The login recovery link opens a WhatsApp request to `08084002972`; the owner resets customer passwords from the admin panel through the server-only Supabase service key.

## Publish with Cloudflare Pages

1. Create or sign in to a Cloudflare account.
2. Open Workers & Pages and create a Pages project from the GitHub repository.
3. Choose the no-framework/static option. Leave the build command empty or use `exit 0`; use the repository root as the output directory.
4. Deploy and use the assigned `*.pages.dev` address while you do not have a custom domain.
5. Submit `https://creovate-designhub.pages.dev/sitemap.xml` in Google Search Console and Bing Webmaster Tools. Search engines may take time to list a new site; publication is live immediately, but indexing is not guaranteed or instant.

Cloudflare Pages Functions are discovered from the `functions/` folder. Configure the webhook URL as `/api/flutterwave/webhook`, add `SUPABASE_SERVICE_ROLE_KEY` to the Cloudflare secret store for owner password resets, and keep the account in test mode until all acceptance tests pass.
