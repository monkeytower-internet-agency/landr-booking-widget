=== LANDR Booking ===
Contributors: monkeytower
Tags: booking, iframe, shortcode
Requires at least: 6.0
Tested up to: 6.6
Stable tag: 0.1.0
License: MIT

Embed the LANDR booking widget via a shortcode.

== Description ==

Drops the LANDR booking widget (hosted at bw.landr.de) into any page or post using a shortcode.

== Installation ==

1. Upload the `landr-booking` folder to `/wp-content/plugins/`.
2. Activate the plugin in **Plugins → Installed Plugins**.
3. Add the shortcode to a page:

   `[landr_booking operator="para42"]`

   Optional attributes:
   - `product="slug"` to pre-select a product.
   - `height="900"` to override the iframe height (default 800px).
   - `src="https://bw.landr.de/"` to override the widget origin (rarely needed).

== Changelog ==

= 0.1.0 =
* Initial release: shortcode + iframe embed.
