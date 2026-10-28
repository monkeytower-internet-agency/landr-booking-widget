=== LANDR Booking ===
Contributors: monkeytower
Tags: booking, iframe, shortcode
Requires at least: 6.0
Tested up to: 6.6
Stable tag: 0.6.0
License: MIT

Embed the LANDR booking widget via a shortcode.

== Description ==

Drops the LANDR booking widget into any page or post using a shortcode. The widget origin is configurable under **Settings → LANDR Booking**, so the same plugin can target the production widget at `bw.landr.de` or a preview deploy without code changes.

== Installation ==

1. Upload the `landr-booking` folder to `/wp-content/plugins/`.
2. Activate the plugin in **Plugins → Installed Plugins**.
3. (Optional) Under **Settings → LANDR Booking**, set the widget URL to a preview deploy (e.g. `https://dev.landr-booking-widget.pages.dev/`). Leave blank to use the bundled default `https://bw.landr.de/`.
4. Add the shortcode to a page. The `token` is the opaque widget token from **Dashboard → Embed generator** (the operator slug is never exposed in the URL):

   `[landr_booking token="<widget_token>"]`

   Optional attributes:
   - `group="slug"` to scope the embed to one product category and all of its sub-categories.
   - `product="slug"` to deep-link to a single product (wins over `group=` when both are given).
   - `start="dates"` to open directly on the date picker instead of the product detail step (only meaningful together with `product=`).
   - `lang="auto"` (default) shows the widget in the page's language, as set by TranslatePress, WPML or Polylang (sent as `?lang=de-DE`). `lang="off"` lets the widget follow the visitor's browser instead; `lang="de"` pins one language. The widget only ever shows languages the operator offers.
   - `height="900"` to override the iframe height (default 800px).
   - `src="https://..."` to override the configured widget origin for this one page.

The iframe now auto-resizes to fit its content: the widget posts its content
height to the parent page, and the plugin listens for that message and grows
or shrinks the iframe accordingly. The `height=` attribute is only the
initial height before the first resize message arrives.

== Changelog ==

= 0.6.0 =
* Add `lang=` attribute, default `auto`: the iframe passes the page's language (`determine_locale()`, which TranslatePress, WPML and Polylang set per language) to the widget as `?lang=`, so a visitor on the German page gets the German widget regardless of their browser language. `lang="off"` restores the old browser-language behaviour; an explicit code such as `lang="de"` pins one language.

= 0.5.1 =
* Print the auto-resize listener inline, right after the first booking iframe, instead of only in the page footer. Page builders such as Thrive Architect can render the shortcode after (or without) `wp_footer`, which left the iframe at its initial height. The footer copy stays as a fallback; a window-level guard makes sure only one listener is ever registered.

= 0.5.0 =
* Add `start="dates"` attribute — with `product=`, opens the widget on the date picker and skips the product-detail step.
* Auto-resize the iframe to fit its content via `postMessage` (`landr:resize`), instead of scrolling inside a fixed-height box. Origin- and source-checked; falls back to the configured `height=` for older widget deploys that never post.

= 0.4.0 =
* Add `group=` attribute — scope the embed to one product category and its nested sub-categories (resolved server-side).

= 0.3.0 =
* Replace `operator=` slug with an opaque, rotatable `token=` attribute, emitted as `?w=<token>`. The widget resolves the operator server-side, so the slug no longer appears in the page source. Tokens are issued from Dashboard → Embed generator.

= 0.2.0 =
* Add Settings → LANDR Booking with a configurable widget origin URL (defaults to `https://bw.landr.de/`).
* Shortcode `src=` attribute still overrides on a per-page basis.

= 0.1.0 =
* Initial release: shortcode + iframe embed.
