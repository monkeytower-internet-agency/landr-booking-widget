=== LANDR Booking ===
Contributors: monkeytower
Tags: booking, iframe, shortcode
Requires at least: 6.0
Tested up to: 6.6
Stable tag: 0.4.0
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
   - `height="900"` to override the iframe height (default 800px).
   - `src="https://..."` to override the configured widget origin for this one page.

== Changelog ==

= 0.4.0 =
* Add `group=` attribute — scope the embed to one product category and its nested sub-categories (resolved server-side).

= 0.3.0 =
* Replace `operator=` slug with an opaque, rotatable `token=` attribute, emitted as `?w=<token>`. The widget resolves the operator server-side, so the slug no longer appears in the page source. Tokens are issued from Dashboard → Embed generator.

= 0.2.0 =
* Add Settings → LANDR Booking with a configurable widget origin URL (defaults to `https://bw.landr.de/`).
* Shortcode `src=` attribute still overrides on a per-page basis.

= 0.1.0 =
* Initial release: shortcode + iframe embed.
