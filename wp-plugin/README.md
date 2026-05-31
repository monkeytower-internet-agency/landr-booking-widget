# LANDR Booking — WordPress plugin

A minimal WordPress plugin that exposes the `[landr_booking]` shortcode. The shortcode renders an iframe pointing at the LANDR booking widget. The widget URL is configurable from WP Admin so the same plugin file ships to dev and prod without changes.

## Install on Para42's WordPress site

1. Zip the `landr-booking/` folder:
   ```bash
   cd wp-plugin
   zip -r landr-booking.zip landr-booking
   ```
2. In WordPress: **Plugins → Add New → Upload Plugin → landr-booking.zip → Install Now → Activate**.
3. (Optional) **Settings → LANDR Booking** — point the widget URL at a preview deploy. Leave blank for the bundled default (`https://bw.landr.de/`).
4. Edit the booking page and add the shortcode. The `token` is the opaque, per-operator widget token — copy it from **Dashboard → Embed generator** (the operator slug is never exposed in the URL):
   ```
   [landr_booking token="<widget_token>"]
   ```

## Settings

**Settings → LANDR Booking → Widget URL**

| When                | Set to                                              |
| :------------------ | :-------------------------------------------------- |
| Production (default)| _blank_ (uses `https://bw.landr.de/`)               |
| Dev preview         | `https://dev.landr-booking-widget.pages.dev/`       |
| Local widget        | `https://bw.dev.landr.de/` *(Tailscale-only)*       |

The setting accepts any full `https://` URL. A trailing slash is added automatically.

## Shortcode reference

```
[landr_booking
  token="<widget_token>"      (* required — opaque widget token from Dashboard → Embed generator *)
  group="courses"             ( optional — scope to one product category + all its sub-categories )
  product="open-water"        ( optional — deep-link to a single product slug )
  height="900"                ( optional — iframe height in px, default 800 )
  src="https://bw.landr.de/"  ( optional — per-page override of the Settings URL )
]
```

The `token=` value maps to `?w=<token>` in the iframe `src`; the API resolves the operator server-side, so the operator slug never appears in the page source. Pass at most one of `group=`/`product=` — when both are given, `product=` wins and the widget lands directly on that product (the `group=` filter is still forwarded).

The `src=` attribute always wins, which is handy when one specific page should iframe a different preview while the rest of the site uses the configured default.

## Why so small?

By design. All booking logic, validation, and rendering happens in the React widget. WordPress is only the host page. The plugin is a thin shortcode → iframe shim that hands the opaque widget token to the widget and lets the admin swap the widget URL from a settings field.
