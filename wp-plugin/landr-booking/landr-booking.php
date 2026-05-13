<?php
/**
 * Plugin Name: LANDR Booking
 * Plugin URI:  https://github.com/monkeytower-internet-agency/landr-booking-widget
 * Description: Embeds the LANDR booking widget via the [landr_booking operator="..."] shortcode. The widget itself lives at book.landr.app.
 * Version:     0.1.0
 * Author:      Monkeytower Internet Agency
 * License:     MIT
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'LANDR_BOOKING_DEFAULT_SRC', 'https://book.landr.app/' );

/**
 * [landr_booking operator="para42" product="optional-slug" height="800"]
 */
function landr_booking_shortcode( $atts ) {
    $atts = shortcode_atts(
        array(
            'operator' => '',
            'product'  => '',
            'height'   => '800',
            'src'      => LANDR_BOOKING_DEFAULT_SRC,
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

    $base = rtrim( $atts['src'], '/' ) . '/';
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
