# Private Probably Turtle news editor

A separate, password-protected Render web service for editing the launcher's
existing news cards. The public `dftg.site` static site stays where it is.
There is no database to lose on restart: publishing commits `PT_home/news.json`
to GitHub main, triggering the existing website deployment. The desktop app
does not need an update.

## One-time activation

1. Create a [fine-grained GitHub token](https://github.com/settings/personal-access-tokens/new).
   Select **Only select repositories → dftg-site**. Under repository permissions,
   give **Contents: Read and write**. No other write permissions are needed.
   Choose an expiry and renew the token in Render before it expires.
2. Open [Deploy to Render](https://render.com/deploy?repo=https://github.com/turtleheadYT/dftg-site).
   This adds the separate service defined by the root `render.yaml`; do not
   replace, delete, or migrate your existing static-site service.
3. In Render's secret environment fields, set `ADMIN_PASSWORD` to a unique
   password of at least 16 characters and `GITHUB_TOKEN` to the token from step 1.
   Render generates `SESSION_SECRET` automatically. Never commit these values
   or paste them into chat. The service uses Render's `RENDER_EXTERNAL_URL` for
   same-origin protection. If you later add a custom domain, set `ADMIN_ORIGIN`
   to its exact HTTPS origin, without a trailing slash.
4. Open the new service's HTTPS address; it redirects to `/PT_home/admin/`.
   Bookmark that address and sign in with your admin password.

Free Render web services can sleep while idle, so the first visit may take a
moment. Use the service URL Render actually assigns; it may include a suffix.
This setup does not create an admin URL on `dftg.site` itself.

## Editing

Select a card to edit its title, category, short description, article, artwork,
image URL, and link. Use **Add card**, **Move up/down**, and **Delete** to manage
the list. **Publish changes** saves the whole list; unpublished edits stay only
in this browser tab. Up to 24 cards are supported. Images use an existing asset
path or HTTPS URL; this editor does not upload images.

After the existing static-site deployment finishes, reload Home in the launcher.
If another editor saved first, publishing reports a conflict; copy any unsaved
text you want to keep, then reload saved news. GitHub commit history retains
previous published versions.

## Security and operation

The editor HTML and all news APIs require a server-side session. Sign-in uses
constant-time password-hash comparison; sessions last eight hours and use
Secure, HttpOnly, SameSite=Strict host cookies in production. Writes require
both the configured Origin and a session CSRF token. The service accepts ten
login attempts total per ten minutes per process. This intentionally simple
single-admin service should run as one instance. Restarting it or changing
secrets signs everyone out. No credentials are sent to the editor JavaScript.
News becomes public when published, including full article text.

The API can modify only the hardcoded `PT_home/news.json` path in
`turtleheadYT/dftg-site` on `main`. Its GitHub token has repository-level Contents
permission; keep it only in Render, revoke it if exposed, and protect your
Render account. Protect the GitHub branch appropriately if you change this
workflow; branch rules that block direct commits also block this publisher.

## Checks

Node 22 or later; no third-party packages are required. Run `npm test` in this
directory. Tests use an in-memory GitHub stub and temporary HTTP servers; they
never publish changes or require real secrets.

References: [Render Blueprint configuration](https://render.com/docs/blueprint-spec),
[Render environment variables](https://render.com/docs/environment-variables),
[GitHub file publishing API](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents).
