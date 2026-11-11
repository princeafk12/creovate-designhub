# Enable the admin authenticator provider

The site now contains the real Firebase TOTP enrollment and sign-in flow. The project is upgraded to Firebase Authentication with Identity Platform on the Spark plan, but Firebase's console does not expose a TOTP toggle. The provider must be enabled once through an authenticated Google Cloud shell or an administrator API call.

In Google Cloud Shell, run:

```bash
PROJECT_ID="creovate-designhub"
ACCESS_TOKEN="$(gcloud auth print-access-token)"
curl -X PATCH "https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config?updateMask=mfa" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "X-Goog-User-Project: ${PROJECT_ID}" \
  -d '{"mfa":{"providerConfigs":[{"state":"ENABLED","totpProviderConfig":{"adjacentIntervals":5}}]}}'
```

This does not add a payment method or choose Blaze. It enables TOTP only. Firebase requires the owner email to be verified before enrollment. After this provider step, open `/admin-login.html`, verify the owner email when prompted, scan the QR code, and confirm the six-digit code.
