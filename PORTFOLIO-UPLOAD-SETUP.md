# Admin portfolio upload setup

The admin dashboard uploads one portfolio image at a time. The browser resizes and compresses the image to WebP, then saves the image in `portfolio_images/{id}` and its listing in `portfolio_items/{id}`. Firebase Storage is not required. The public `portfolio.html` page reads published listings and loads each image as it scrolls into view, so no redeploy is needed for individual portfolio pieces.

## One-time owner setup

1. In Firebase Console, open project `creovate-designhub` → **Firestore Database** → **Rules**.
2. Replace the rules with the contents of `firebase.rules` and publish them. The rules let the owner upload portfolio images and let visitors read image data only when its matching portfolio listing is published.
3. Deploy the latest `main` branch to Cloudflare Pages.

## Uploading a piece

1. Sign in with the owner account.
2. Open `/admin.html`.
3. Scroll to **Portfolio manager**.
4. Enter a title, choose a category, select a JPG, PNG or WebP image under 10 MB, and click **Upload and publish**.
5. Refresh `/portfolio.html`. The new piece will appear at the top of the gallery.

Only the owner email in the rules can upload or delete portfolio data. Public visitors can read published portfolio images and metadata. Images are compressed to a maximum of 600 KiB before saving, keeping the image document below Firestore's 1 MiB document limit.
