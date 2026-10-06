# Media Space

Responsive Media Space website using native HTML, CSS and JavaScript, served by a dependency-free Node.js server. The server delivers booking and contact enquiries to Discord through a private webhook.

## Discord setup

1. In Discord, create or choose the server and channel for website enquiries.
2. Open the channel settings and choose **Integrations → Webhooks**.
3. Create a webhook and copy its URL.
4. Configure the URL only in a private local `.env` file or the deployment host’s secret environment settings as `DISCORD_WEBHOOK_URL`.

If a real webhook was ever placed in `.env.example`, source control, or chat, regenerate it in Discord before using it again. The exposed webhook should be treated as compromised.

## Local setup and testing

Install Node.js 18 or newer. From the project root:

```powershell
Copy-Item .env.example .env
notepad .env
npm install
npm start
```

Set `DISCORD_WEBHOOK_URL` in `.env`; open `http://localhost:3000`. `PORT` is optional and defaults to `3000`. `ALLOWED_ORIGIN` is optional; set it to the exact website origin to restrict submissions (for example, `https://your-domain.example`). The default API accepts same-origin requests only.

The expandable message form is in the Enquiry area under **Have a general question? Send us a message**. It posts to `POST /api/contact` with name, email, optional phone and subject, message, and a hidden honeypot field. The booking form remains at `POST /api/booking`. Both routes share the private webhook variable.

To check server-side validation while the server runs, use a second PowerShell window:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/contact -ContentType 'application/json' -Body '{"name":"Test","email":"invalid","message":"Hello"}'
```

This invalid email should be rejected. To verify delivery, submit a valid message through the website and confirm its embed appears in the configured Discord channel. If Discord delivery fails, the form shows a safe retry message; it does not report success.

## Deployment

This project has a Node backend, so static-only GitHub Pages cannot securely send webhook messages. Deploy the whole project, including the existing media folders, to a Node.js host that runs `npm start` and supports private runtime environment variables. Configure `DISCORD_WEBHOOK_URL` in the host’s secret settings. Set `PORT` only if required by that host. Set `ALLOWED_ORIGIN` only when you want to restrict requests to a specific origin. Use HTTPS. Do not place the webhook URL in frontend code or public variables such as `VITE_*` or `NEXT_PUBLIC_*`.

The server uses same-origin checks (no wildcard CORS), request size limits, validation, sanitization, a honeypot and basic per-IP rate limiting. Contact embeds omit phone and subject when not supplied and disable Discord mentions. Rate limiting is in memory and should be moved to shared storage for multi-instance deployments.

## Project security

- `.env` is ignored by Git; `.env.example` contains empty secret placeholders.
- `DISCORD_WEBHOOK_URL` is read only by `server.js` and is never sent to the frontend.
- The project directory contains no deployment-provider configuration, so select a Node-capable host rather than static-only hosting.
