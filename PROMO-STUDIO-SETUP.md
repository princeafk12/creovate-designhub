# Promo Studio setup and owner actions

Promo Studio is prepared but remains disabled by default. It cannot charge a customer or call OpenAI until the provider, verified Flutterwave order entitlement, and safety switches are configured in Cloudflare.

## What is already handled in code

- Firebase ID tokens are checked server-side before a request is accepted.
- The OpenAI key is read only from a Cloudflare secret; it is never placed in browser code.
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

1. Create an OpenAI API key in the OpenAI API dashboard. Do not paste it into chat or frontend files. Set a low project spending limit before testing.
2. Choose the exact OpenAI model approved for the account and enter it as `OPENAI_MODEL` in Cloudflare.
3. In Firebase/Google Cloud, create a service account with only the permissions needed to write Firestore documents for this project, create a JSON key once, and keep the downloaded file private. This is needed because the browser must not be allowed to create trusted generation results.
4. In Cloudflare Pages → CREOVATE DesignHub → Settings → Environment variables, add the variables below as Production secrets/configuration values. Use the same project `creovate-designhub`.

Required secret/configuration names:

```text
FIREBASE_PROJECT_ID=creovate-designhub
FIREBASE_WEB_API_KEY=your Firebase web API key
FIREBASE_SERVICE_ACCOUNT_JSON=the complete service-account JSON on one line
AI_PROVIDER=openai
OPENAI_API_KEY=your OpenAI API key
OPENAI_MODEL=the approved OpenAI model name
OPENAI_INPUT_USD_PER_MILLION=optional input price for admin cost estimates
OPENAI_OUTPUT_USD_PER_MILLION=optional output price for admin cost estimates
AI_DAILY_LIMIT=5
PROMO_STUDIO_ENABLED=false
GENERATION_PAUSED=true
PAYMENTS_READY=false
```

Keep the final three values exactly as shown while testing. Do not switch them on until a test generation has been approved and the payment workflow is connected and verified. Adding an OpenAI key alone does not enable generation.

## Important cost boundary

The code does not activate billing, upgrade a plan, or make a payment. OpenAI API usage may incur charges; set a low project spending limit and check the current model pricing before launch. The application records returned token usage and optional estimated costs in Firestore for owner monitoring.

## Final enablement

After the backend and payment tests pass, and only after you explicitly approve activation, change only these two switches first:

```text
PROMO_STUDIO_ENABLED=true
GENERATION_PAUSED=false
```

Keep `PAYMENTS_READY=false` until Flutterwave verification is connected. The endpoint will continue refusing requests while that flag is false, so no customer can accidentally generate through an unpaid path.

If you do not want to create a service-account key or add an OpenAI key, leave the switches disabled. The website and existing design-service workflow remain usable.
