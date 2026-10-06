# Media Space

Media Space is a static website built with plain HTML, CSS and browser JavaScript. The pages need no Node.js, npm, or build step. Enquiry forms post directly to a Discord webhook from the browser.

## Run locally

Open `index.html` in a browser to view the site and its local photos, videos, and images. Form submissions need an internet connection and a browser that allows the direct Discord webhook request.

## Static hosting

Upload the site files and `image`, `video`, and `PhotoShoots` folders to any static host, keeping their folder structure intact. `index.html` is the home page; `photoshoots.html` is the photo gallery page.

Booking and general contact submissions are sent from `app.js` to Discord. The webhook is visible in downloaded website code and browser network tools, so visitors can copy it and post to the channel. Regenerate the webhook in Discord if it is abused, and use a private server-side relay if you later need to keep the URL secret.

## Website files

- `index.html` — home page, services, video gallery, packages, and enquiry forms.
- `photoshoots.html` — browsable photo gallery and photo viewer.
- `styles.css` — responsive styles and themes.
- `app.js` — menus, media playback, gallery filters, packages, and form submissions.
- `image/`, `video/`, `PhotoShoots/` — website media assets.
