# Media Space

Media Space is a static website built with plain HTML, CSS and browser JavaScript. It does not need Node.js, npm, a build step, or a backend.

## Run locally

Open `index.html` in a browser. The site pages and local photos, videos, and images work directly from disk. Enquiry forms open WhatsApp with the submitted details so the visitor can send the message to Media Space.

## Static hosting

Upload the site files and the `image`, `video`, and `PhotoShoots` folders to any static web host, keeping their folder structure intact. Set `index.html` as the home page. `photoshoots.html` is the photo gallery page, and `404.html` is an optional not-found page. No environment variables or server configuration are needed.

Booking and contact forms hand off to WhatsApp (`+91 99443 67651`). Static sites cannot safely keep a private Discord webhook secret; use a server-side form service if direct automated delivery to Discord is required.

## Website files

- `index.html` — home page, services, video gallery, packages, and enquiry forms.
- `photoshoots.html` — browsable photo gallery and photo viewer.
- `styles.css` — responsive styles and themes.
- `app.js` — menus, media playback, gallery filters, packages, and WhatsApp enquiry handoff.
- `image/`, `video/`, `PhotoShoots/` — website media assets.
