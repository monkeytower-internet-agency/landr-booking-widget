<?php
/**
 * Plugin Name: LANDR Booking
 * Plugin URI:  https://github.com/monkeytower-internet-agency/landr-booking-widget
 * Description: Embeds the LANDR booking widget via the [landr_booking operator="..."] shortcode. Widget origin is configurable under Settings → LANDR Booking.
 * Version:     0.2.0
 * Author:      Monkeytower Internet Agency
 * License:     MIT
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'LANDR_BOOKING_DEFAULT_SRC', 'https://bw.landr.de/' );
define( 'LANDR_BOOKING_OPTION', 'landr_booking_widget_origin' );

/**
 * Return the configured widget origin (with a trailing slash), falling back
 * to the bundled default when the option is unset or blank.
 */
function landr_booking_get_origin() {
    $raw = trim( (string) get_option( LANDR_BOOKING_OPTION, '' ) );
    if ( $raw === '' ) {
        return LANDR_BOOKING_DEFAULT_SRC;
    }
    return rtrim( $raw, '/' ) . '/';
}

/**
 * [landr_booking operator="para42" product="optional-slug" height="800" src="https://..."]
 *
 * The shortcode's `src=` attribute always wins so individual pages can pin a
 * specific origin (handy when testing a preview deploy). When omitted, the
 * value from Settings → LANDR Booking is used.
 */
function landr_booking_shortcode( $atts ) {
    $atts = shortcode_atts(
        array(
            'operator' => '',
            'product'  => '',
            'height'   => '800',
            'src'      => '',
        ),
        $atts,
        'landr_booking'
    );

    if ( empty( $atts['operator'] ) ) {
        return '<p><em>LANDR booking: missing required "operator" attribute.</em></p>';
    }

    $query = array( 'operator' => $atts['operator'] );
    if ( ! empty( $atts['product'] ) ) {
        $query['product'] = $atts['product'];
    }

    $base = $atts['src'] !== '' ? rtrim( $atts['src'], '/' ) . '/' : landr_booking_get_origin();
    $url  = $base . '?' . http_build_query( $query );

    $height_px = (int) $atts['height'];
    if ( $height_px <= 0 ) {
        $height_px = 800;
    }

    return sprintf(
        '<iframe src="%s" style="width:100%%;height:%dpx;border:none;" loading="lazy" allow="payment" title="LANDR booking widget"></iframe>',
        esc_url( $url ),
        $height_px
    );
}
add_shortcode( 'landr_booking', 'landr_booking_shortcode' );

/* -------------------------------------------------------------------------
 * Settings page: Settings → LANDR Booking
 * ---------------------------------------------------------------------- */

function landr_booking_register_settings() {
    register_setting(
        'landr_booking',
        LANDR_BOOKING_OPTION,
        array(
            'type'              => 'string',
            'sanitize_callback' => 'landr_booking_sanitize_origin',
            'default'           => '',
        )
    );

    add_settings_section(
        'landr_booking_main',
        __( 'Widget origin', 'landr-booking' ),
        'landr_booking_section_intro',
        'landr-booking'
    );

    add_settings_field(
        LANDR_BOOKING_OPTION,
        __( 'Widget URL', 'landr-booking' ),
        'landr_booking_origin_field',
        'landr-booking',
        'landr_booking_main'
    );
}
add_action( 'admin_init', 'landr_booking_register_settings' );

function landr_booking_section_intro() {
    echo '<p>';
    esc_html_e(
        'URL of the LANDR booking widget host. Leave blank to use the bundled default (https://bw.landr.de/). Set to a preview deploy (e.g. https://dev.landr-booking-widget.pages.dev/) to test against the dev widget.',
        'landr-booking'
    );
    echo '</p>';
}

function landr_booking_origin_field() {
    $value = (string) get_option( LANDR_BOOKING_OPTION, '' );
    printf(
        '<input type="url" name="%1$s" id="%1$s" value="%2$s" class="regular-text" placeholder="%3$s" />',
        esc_attr( LANDR_BOOKING_OPTION ),
        esc_attr( $value ),
        esc_attr( LANDR_BOOKING_DEFAULT_SRC )
    );
    echo '<p class="description">';
    esc_html_e( 'Must be a full https:// URL. A trailing slash is added automatically.', 'landr-booking' );
    echo '</p>';
}

function landr_booking_sanitize_origin( $value ) {
    $value = trim( (string) $value );
    if ( $value === '' ) {
        return '';
    }
    $url = esc_url_raw( $value, array( 'http', 'https' ) );
    if ( $url === '' ) {
        add_settings_error(
            LANDR_BOOKING_OPTION,
            'landr_booking_invalid_url',
            __( 'Widget URL must be a valid http(s):// URL. Keeping the previous value.', 'landr-booking' ),
            'error'
        );
        return get_option( LANDR_BOOKING_OPTION, '' );
    }
    return $url;
}

function landr_booking_add_settings_page() {
    add_options_page(
        __( 'LANDR Booking', 'landr-booking' ),
        __( 'LANDR Booking', 'landr-booking' ),
        'manage_options',
        'landr-booking',
        'landr_booking_render_settings_page'
    );
}
add_action( 'admin_menu', 'landr_booking_add_settings_page' );

function landr_booking_render_settings_page() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }
    ?>
    <div class="wrap">
        <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
        <form action="options.php" method="post">
            <?php
            settings_fields( 'landr_booking' );
            do_settings_sections( 'landr-booking' );
            submit_button();
            ?>
        </form>
        <h2><?php esc_html_e( 'Shortcode', 'landr-booking' ); ?></h2>
        <p>
            <code>[landr_booking operator="para42"]</code>
            &mdash;
            <?php
            printf(
                /* translators: %s is the current widget origin URL */
                esc_html__( 'currently iframes %s', 'landr-booking' ),
                '<code>' . esc_html( landr_booking_get_origin() ) . '</code>'
            );
            ?>
        </p>
    </div>
    <?php
}
