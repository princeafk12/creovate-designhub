# Promo Studio setup and owner actions

Promo Studio is prepared but remains disabled by default. It cannot charge a customer or call Gemini until all three safety switches are deliberately changed in Cloudflare.

## What is already handled in code

- Firebase ID tokens are checked server-side before a request is accepted.
- The Gemini key is read only from a Cloudflare secret; it is never placed in browser code.
- Customer fields are validated and length-limited.
- A per-customer daily generation limit is enforced. The default is 5.
- Processing, completed, and failed jobs are stored in Firestore.
- A failed provider request restores the reserved daily allowance.
- Completed campaigns are shown in the customer account.
- Firestore client writes to generation jobs and usage records are blocked by `firebase.rules`.
- The endpoint remains fail-closed while `PROMO_STUDIO_ENABLED=false`, `GENERATION_PAUSED=true`, or `PAYMENTS_READY=false`.

## Where your attention is needed

Do not paste keys or private service-account text into this chat.

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/app/apikey). Choose an eligible free-tier project/model. Do not enable billing for this first test.
2. Choose the exact model name shown as available to your key, for example an eligible Flash model. The model name is entered in Cloudflare as `GEMINI_MODEL`.
3. In Firebase/Google Cloud, create a service account with only the permissions needed to write Firestore documents for this project, create a JSON key once, and keep the downloaded file private. This is needed because the browser must not be allowed to create trusted generation results.
4. In Cloudflare Pages → CREOVATE DesignHub → Settings → Environment variables, add the variables below as Production secrets. Use the same project `creovate-designhub`.

Required secret/configuration names:

```text
FIREBASE_PROJECT_ID=creovate-designhub
FIREBASE_WEB_API_KEY=your Firebase web API key
FIREBASE_SERVICE_ACCOUNT_JSON=the complete service-account JSON on one line
AI_PROVIDER=gemini
GEMINI_API_KEY=your Gemini key
GEMINI_MODEL=the eligible model name from AI Studio
AI_DAILY_LIMIT=5
PROMO_STUDIO_ENABLED=false
GENERATION_PAUSED=true
PAYMENTS_READY=false
```

Keep the final three values exactly as shown while testing. Do not switch them on until a test generation has been approved and the payment workflow is connected and verified. Adding a Gemini key alone does not enable generation.

## Important cost boundary

The code does not activate billing, upgrade a plan, or make a payment. Gemini free-tier limits and terms can change. Google’s current pricing page says free access is limited to eligible models and quotas, and some grounded/search features are not free. Check the current terms before launch.

## Final enablement

After the backend and payment tests pass, change only these two switches first:

```text
PROMO_STUDIO_ENABLED=true
GENERATION_PAUSED=false
```

Keep `PAYMENTS_READY=false` until Flutterwave verification is connected. The endpoint will continue refusing requests while that flag is false, so no customer can accidentally generate through an unpaid path.

If you do not want to create a service-account key or add a Gemini key, leave the switches disabled. The website and existing design-service workflow remain usable.
