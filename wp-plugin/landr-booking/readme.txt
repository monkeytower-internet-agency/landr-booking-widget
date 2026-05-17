=== LANDR Booking ===
Contributors: monkeytower
Tags: booking, iframe, shortcode
Requires at least: 6.0
Tested up to: 6.6
Stable tag: 0.2.0
License: MIT

Embed the LANDR booking widget via a shortcode.

== Description ==

Drops the LANDR booking widget into any page or post using a shortcode. The widget origin is configurable under **Settings → LANDR Booking**, so the same plugin can target the production widget at `bw.landr.de` or a preview deploy without code changes.

== Installation ==

1. Upload the `landr-booking` folder to `/wp-content/plugins/`.
2. Activate the plugin in **Plugins → Installed Plugins**.
3. (Optional) Under **Settings → LANDR Booking**, set the widget URL to a preview deploy (e.g. `https://dev.landr-booking-widget.pages.dev/`). Leave blank to use the bundled default `https://bw.landr.de/`.
4. Add the shortcode to a page:

   `[landr_booking operator="para42"]`

   Optional attributes:
   - `product="slug"` to pre-select a product.
   - `height="900"` to override the iframe height (default 800px).
   - `src="https://..."` to override the configured widget origin for this one page.

== Changelog ==

= 0.2.0 =
* Add Settings → LANDR Booking with a configurable widget origin URL (defaults to `https://bw.landr.de/`).
* Shortcode `src=` attribute still overrides on a per-page basis.

= 0.1.0 =
* Initial release: shortcode + iframe embed.
