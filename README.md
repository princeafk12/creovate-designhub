# CREOVATE - DesignHub

This is the free, deployable site. It contains the marketing page, service details, a client-side design-brief form that opens a completed WhatsApp message, portfolio links, policies, responsive styling, search-engine files, Supabase customer login, saved briefs, and an admin area for offer and service settings.

## Before publishing

The current public address is `https://princeafk12.github.io/creovate-designhub/`. If the site later moves to Cloudflare Pages or a custom domain, update the canonical URL, `robots.txt`, and `sitemap.xml` together.

## Remaining setup

Run `schema.sql` once in the Supabase SQL Editor. If the database already exists, run the MFA migration in `mfa-migration.sql` too. Then create the owner account through `login.html`, promote it with the commented SQL statement at the bottom of `schema.sql`, and enrol an authenticator app from `admin-login.html`. The site keeps WhatsApp as the order handoff; saved orders are available to signed-in customers and the admin.

The public Flutterwave payment link is included for payments after the agreed price is confirmed on WhatsApp. Admin authenticator-app TOTP setup is included, and the business validator is a free rule-based estimate that runs in the browser. Exact-price automatic checkout, payment webhooks, and paid-order email automation remain optional additions and require server-side provider secrets; never place those secrets in frontend files.

## Publish with Cloudflare Pages

1. Create or sign in to a Cloudflare account.
2. Open Workers & Pages and create a Pages project from the GitHub repository.
3. Choose the no-framework/static option. Leave the build command empty or use `exit 0`; use the repository root as the output directory.
4. Deploy and note the assigned `*.pages.dev` address.
5. Replace the placeholder URL in the three files above, commit, and redeploy.
6. Submit `/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
