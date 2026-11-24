# Admin portfolio upload setup

The admin dashboard now supports uploading one portfolio image at a time. Each upload creates a public image in Firebase Storage and a `portfolio_items` document in Firestore. The public `portfolio.html` page reads published items automatically, so no redeploy is required for each new piece.

## One-time owner setup

1. In Firebase Console, open project `creovate-designhub` and open **Storage**.
2. If Storage has not been initialized, choose **Get started** and complete only the requested setup. Stop if the console shows a paid-plan upgrade that you do not approve.
3. Publish the contents of `storage.rules` as the Storage rules.
4. Publish the `firebase.rules` file as the Cloud Firestore rules.
5. Deploy the latest `main` branch to Cloudflare Pages.

## Uploading a piece

1. Sign in with the owner account.
2. Open `/admin.html`.
3. Scroll to **Portfolio manager**.
4. Enter a title, choose a category, select a JPG, PNG or WebP image under 10 MB, and click **Upload and publish**.
5. Refresh `/portfolio.html`. The new piece will appear at the top of the gallery.

Only the owner email in the rules can upload or delete portfolio files. Public visitors can read published portfolio images and metadata.
