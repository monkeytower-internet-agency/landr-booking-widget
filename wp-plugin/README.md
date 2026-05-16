# LANDR Booking — WordPress plugin

A minimal WordPress plugin that exposes the `[landr_booking]` shortcode. The shortcode renders an iframe pointing at the LANDR booking widget hosted at `bw.landr.de`.

## Install on Para42's WordPress site

1. Zip the `landr-booking/` folder:
   ```bash
   cd wp-plugin
   zip -r landr-booking.zip landr-booking
   ```
2. In WordPress: **Plugins → Add New → Upload Plugin → landr-booking.zip → Install Now → Activate**.
3. Edit the booking page and add the shortcode:
   ```
   [landr_booking operator="para42"]
   ```

## Shortcode reference

```
[landr_booking
  operator="para42"      (* required — operator slug *)
  product="tandem-long"  ( optional — pre-select a product slug )
  height="900"           ( optional — iframe height in px, default 800 )
  src="https://bw.landr.de/"  ( optional — widget origin override )
]
```

## Why so small?

By design. All booking logic, validation, and rendering happens in the React widget at `bw.landr.de`. WordPress is only the host page. The plugin is just a thin shortcode → iframe shim that hands the operator slug to the widget.
