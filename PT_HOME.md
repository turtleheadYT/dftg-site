# Application homepage

`PT_home/index.html` is the unlisted homepage intended for the desktop app's
embedded webview. Its published address is `https://dftg.site/PT_home/`.

The page uses the monochrome Bulletin design for Probably Turtle studio news.
The launcher already adds its overlay sidebar, title bar, and tesseract; this
page deliberately does not duplicate those controls.

## Edit the news cards

Use the password-protected editor in `admin-service` after its one-time Render
activation. See [the setup guide](admin-service/README.md). It provides forms to
add, edit, delete, reorder, and publish cards without touching JSON. The admin
runs on its own Render service; the public homepage remains on `dftg.site`.

Alternatively, edit `PT_home/news.json` and push through the existing Render workflow. Cards
appear in their array order. Each card supports `id`, `title`, `category`,
`summary`, `body` (plain text, with paragraph newlines), `art`, optional `image`,
and optional `link`. The built-in artwork styles are `tesseract`, `studio`,
`community`, and `minimal`. An image can be a relative path or HTTPS URL and is
displayed in grayscale. Links accept HTTPS and mailto URLs. Keep the studio
contact and copyright footer in `PT_home/index.html` up to date.

Clicking a card opens its full article. The published homepage has no public
editing or publishing controls; the concept editor is not an admin backend.

No link is added to the public website's navigation. The `noindex, nofollow`
metadata asks search engines not to list the page; it is still publicly
accessible, not password-protected. Do not put secrets or admin actions here.

Commit and push changes through the existing Render deployment workflow.
The desktop app is connected to this URL. Relaunch it or click Home to reload
published changes. News JSON is revalidated whenever the page loads.
