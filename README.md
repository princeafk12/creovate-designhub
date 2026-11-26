# CREOVATE DesignHub

Login-first design and business-tools site hosted on Cloudflare Pages. The client uses Firebase Authentication and Firestore; Cloudflare Pages Functions use Firebase server credentials for orders, payments, AI generation, account history, and administration.

## Current features

- Design services, brief intake, customer accounts, portfolio, and owner-only administration.
- CREOVATE for Business: Promo Studio (₦1,000), Caption Studio (₦1,000), 30-Day Content Planner (₦1,500), and Business Growth Kit (₦3,000).
- Flutterwave hosted checkout, server-verified webhook, saved paid results, retries after failed generation, and one included regeneration.
- Gemini-first AI with an optional server-side OpenAI adapter. The Validator combines Gemini with World Bank country indicators and allows one report per customer per day, subject to site capacity.
- Account history is loaded through an authenticated server endpoint so customer activity does not depend on browser-side Firestore read rules.
- AI use requires an 18+ confirmation. Gemini-backed AI requests are blocked from the UK, Switzerland, and EEA locations while the configured service is used.

## Production configuration

Set Firebase server credentials, AI provider key/model, live Flutterwave secret and matching webhook hash, `PAYMENTS_READY=true`, `PROMO_STUDIO_ENABLED=true`, and `GENERATION_PAUSED=false` in Cloudflare Production. Keep all secrets out of browser files and Git. Tool checkout holds one daily AI-capacity slot for the payment session; abandoned or failed checkout reservations are released when the session expires or a failure event is received.

`firebase.rules` is the browser access policy and must be published in Firebase Console separately from a Cloudflare deployment. The account API uses the Cloudflare Firebase service account and still requires that service account to have Firestore access.

## Privacy and provider limits

Business-tool and Validator briefs are sent to the configured AI provider. Promo Studio's optional public business contact is attached to the result after generation and is excluded from the AI prompt. The Gemini unpaid service may use submitted prompts and outputs to improve Google's products; customers should not submit personal, sensitive, or confidential information. AI tools require users to confirm they are 18 or older.

## Release verification

The source changes in this working tree have not been run through automated tests or deployed. A successful production release still needs checkout, webhook, AI generation, failed-payment/expired-checkout, account-history, and customer acceptance verification. Do not treat the catalog's enabled status alone as proof that a real payment and generation have completed end to end.
