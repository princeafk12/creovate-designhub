# Promo Studio setup and owner actions

Promo Studio is prepared but remains disabled by default. Gemini is the initial provider for cost control, while the server-side adapter can switch to OpenAI or another provider later. It cannot charge a customer or call an AI provider until the provider, verified Flutterwave order entitlement, and safety switches are configured in Cloudflare.

## What is already handled in code

- Firebase ID tokens are checked server-side before a request is accepted.
- The selected provider key is read only from a Cloudflare secret; it is never placed in browser code.
- Customer fields are validated and length-limited.
- A per-customer daily generation limit is enforced. The default is 5.
- Processing, completed, and failed jobs are stored in Firestore.
- A failed provider request restores the reserved daily allowance.
- A verified Promo Studio order is required before generation starts.
- Completed campaigns are shown in the customer account with download and one controlled free regeneration.
- Firestore client writes to generation jobs and usage records are blocked by `firebase.rules`.
- The endpoint remains fail-closed while `PROMO_STUDIO_ENABLED=false`, `GENERATION_PAUSED=true`, or `PAYMENTS_READY=false`.

## Where your attention is needed

Do not paste keys or private service-account text into this chat.

1. Create a Gemini API key in Google AI Studio. Do not paste it into chat or frontend files. Confirm the project’s active rate limits before testing.
2. Choose an eligible Gemini model shown for the project and enter it as `GEMINI_MODEL` in Cloudflare. The free tier is limited by model and project RPM, TPM and RPD quotas; it is not unlimited.
3. In Firebase/Google Cloud, create a service account with only the permissions needed to write Firestore documents for this project, create a JSON key once, and keep the downloaded file private. This is needed because the browser must not be allowed to create trusted generation results.
4. In Cloudflare Pages → CREOVATE DesignHub → Settings → Environment variables, add the variables below as Production secrets/configuration values. Use the same project `creovate-designhub`.

Required secret/configuration names:

```text
FIREBASE_PROJECT_ID=creovate-designhub
FIREBASE_WEB_API_KEY=your Firebase web API key
FIREBASE_SERVICE_ACCOUNT_JSON=the complete service-account JSON on one line
AI_PROVIDER=gemini
GEMINI_API_KEY=your Gemini API key
GEMINI_MODEL=the approved Gemini model name
GEMINI_INPUT_USD_PER_MILLION=optional paid-tier input price for admin estimates
GEMINI_OUTPUT_USD_PER_MILLION=optional paid-tier output price for admin estimates
AI_DAILY_LIMIT=5
PROMO_STUDIO_ENABLED=false
GENERATION_PAUSED=true
PAYMENTS_READY=false
```

Keep the final three values exactly as shown while testing. Do not switch them on until a test generation has been approved and the payment workflow is connected and verified. Adding a Gemini key alone does not enable generation.

## Gemini free-tier limits and data boundary

Google documents a free tier for eligible Gemini models, but limits vary by project and model and are measured by requests per minute, tokens per minute and requests per day. Active limits should be checked in Google AI Studio; quotas can change and are not guaranteed. Unpaid Gemini API usage may be used by Google to improve products and may be reviewed by humans, so do not send passwords, payment information, private customer records or other sensitive data to the free tier. Review Google’s current API terms and region restrictions before public customer use.

## Important cost boundary

The code does not activate billing, upgrade a plan, or make a payment. Gemini free-tier usage is quota-limited; paid-tier usage may incur charges. The application records returned token usage, provider name and optional estimated costs in Firestore for owner monitoring.

## Final enablement

After the backend and payment tests pass, and only after you explicitly approve activation, change only these two switches first:

```text
PROMO_STUDIO_ENABLED=true
GENERATION_PAUSED=false
```

Keep `PAYMENTS_READY=false` until Flutterwave verification is connected. The endpoint will continue refusing requests while that flag is false, so no customer can accidentally generate through an unpaid path.

If you do not want to create a service-account key or add a Gemini key, leave the switches disabled. The website and existing design-service workflow remain usable.
