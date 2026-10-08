# CREOVATE - DesignHub static site

This is the free, deployable public-site phase. It contains the marketing page, service details, WhatsApp order links, portfolio links, policies, responsive styling, and search-engine files.

## Before publishing

Replace every `https://YOUR-SITE.pages.dev/` value in `index.html`, `robots.txt`, and `sitemap.xml` with the final public address chosen in Cloudflare Pages. The address must be the exact URL, including `https://` and the trailing slash where shown.

## What is intentionally not included yet

Customer accounts, Supabase data, online payments, paid-order email automation, admin tools, and the AI business validator require external accounts and/or usage-based services. They can be added in later phases without putting secret keys in the browser.

## Publish with Cloudflare Pages

1. Create or sign in to a Cloudflare account.
2. Open Workers & Pages and create a Pages project from the GitHub repository.
3. Choose the no-framework/static option. Leave the build command empty or use `exit 0`; use the repository root as the output directory.
4. Deploy and note the assigned `*.pages.dev` address.
5. Replace the placeholder URL in the three files above, commit, and redeploy.
6. Submit `/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
