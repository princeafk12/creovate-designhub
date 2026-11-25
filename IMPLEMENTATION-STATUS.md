# CREOVATE DesignHub release status

Updated 2026-11-25.

## Included in this release candidate

- Customer account page with a visible **View website** link, links to the main site and Business Tools, account orders, saved results, and Validator history.
- Three-line dropdown navigation on the home page, portfolio page, and customer account page. It lists the current public sections/pages and closes on selection, outside click, or Escape.
- Server-owned Business Tools catalogue and prices: Promo Studio ₦1,000; Caption Studio ₦1,000; 30-Day Content Planner ₦1,500; Business Growth Kit ₦3,000.
- One shared checkout route with fixed server prices, required-field validation, a live Flutterwave-key check, daily-capacity checks, and no payment request while a required service is unavailable.
- One shared generation route, provider adapter boundary, product-specific output schemas, structured Gemini/OpenAI request formats, server-side output validation, paid-order ownership checks, entitlements, failed-generation restoration, and one controlled free regeneration per purchase.
- Payment return page now generates and displays any of the four paid products; the customer account supports viewing, copying, downloading, retrying failed paid generations, and the one included regeneration.
- Flutterwave webhook still authenticates the signature and re-verifies the transaction; orders must match the saved amount, currency and reference, and tool orders must match the server-configured product slug and exact product price before an entitlement is issued.
- Free-only Validator using the World Bank public Indicators API plus the configured Gemini model. It is independent of paid checkout switches and has its own emergency `VALIDATOR_PAUSED` switch. It shares the AI daily capacity cap with paid tools and is limited to one report per account per day. Reports store dated source links, indicator values and evidence limits. It does not claim competitor search, current local law, or verification of customer claims.
- Admin activity summaries cover all four tools, failed/completed generations, token usage and Validator reports.
- Customer-side direct writes to orders and Validator reports are denied in `firebase.rules`; Pages Functions write these records with the server service account.
- Privacy copy explains that Business Tool and Validator inputs go to the configured AI provider and that free-tier Gemini prompts may be used by Google to improve its products.

## Not claimed as independently tested

- The owner reported that a Flutterwave checkout test succeeded. This code change has not been run through live payment, webhook, Gemini-generation, quota-failure, mobile-browser, or account-acceptance tests.
- A test checkout is not proof of live payments. Flutterwave keys with `_TEST` in the secret are blocked by production checkout. A real launch requires the Production `FLW_SECRET_KEY` and matching live webhook hash.
- Gemini free-tier availability and quotas are controlled by Google's project/account and can change. The Validator avoids paid search tools and has strict application caps, but the owner should confirm their Google AI Studio project remains on the Free tier. Free-tier prompts may be used to improve Google's products; customers are told not to submit confidential information.
- `firebase.rules` must be published to Firestore Rules separately from the Cloudflare Pages deployment unless an authenticated Firebase Rules deployment tool is available.
- Paid Business Tools require the Cloudflare Production values: Firebase server credentials, Gemini key/model, Flutterwave Live credentials, `PAYMENTS_READY=true`, `PROMO_STUDIO_ENABLED=true`, and `GENERATION_PAUSED=false`. The free Validator requires Firebase server credentials and the Gemini key/model; it does not require checkout activation. `VALIDATOR_PAUSED=true` is its independent emergency stop.

## Operational notes

- No API secret is included in this repository. Keep Firebase, Gemini, and Flutterwave keys only in the Cloudflare secret store.
- Prices for Business Tools are defined in `functions/_lib/business-tools.js`; the browser obtains prices and input definitions from `/api/tools/catalog`.
- `AI_GLOBAL_DAILY_LIMIT` defaults to 10; `AI_DAILY_LIMIT` defaults to 5 per customer. Validator defaults to one per customer per day and 10 total per day.
