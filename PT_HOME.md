# Application homepage

`PT_home/index.html` is the unlisted homepage intended for the desktop app's
embedded webview. Its published address is `https://dftg.site/PT_home/`.

The page starts empty and uses the app's dark background. Add homepage content
inside `<main id="homepage">` and style it in `PT_home/style.css`. Desktop window
controls, the sidebar, and the tesseract remain in the Rust app.

No link is added to the public website's navigation. The `noindex, nofollow`
metadata asks search engines not to list the page; it is still publicly
accessible, not password-protected. Do not put secrets or admin actions here.

Commit and push changes through the existing Render deployment workflow.
The desktop app has not yet been connected to this page.
