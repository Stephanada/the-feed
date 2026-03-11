<?php
/**
 * Plugin Name:       The Feed — Open Event Protocol
 * Plugin URI:        https://thefeed.dev
 * Description:       Enterprise adapter for The Feed Open Event Protocol. Enables Vista Radio network sites and partner CMS platforms to display syndicated community events via the <the-feed-event> Web Component. Includes network-wide settings management, shortcode generator, and Gutenberg block.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      8.1
 * Author:            The Feed
 * Author URI:        https://thefeed.dev
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       the-feed
 * Network:           true
 *
 * @package TheFeed
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'THE_FEED_VERSION', '1.0.0' );
define( 'THE_FEED_PLUGIN_FILE', __FILE__ );
define( 'THE_FEED_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'THE_FEED_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'THE_FEED_COMPONENT_CDN', 'https://thefeed.pages.dev/ui/the-feed-event.js' );
define( 'THE_FEED_API_DEFAULT', 'https://the-feed-api.workers.dev' );
define( 'THE_FEED_NLP_DEFAULT', 'https://the-feed-nlp.workers.dev' );

// ─────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────

add_action( 'plugins_loaded', array( 'TheFeed_Plugin', 'init' ) );

class TheFeed_Plugin {

    public static function init(): void {
        $instance = new self();
        $instance->hooks();
    }

    private function hooks(): void {
        // Admin menus
        if ( is_multisite() ) {
            add_action( 'network_admin_menu', array( $this, 'register_network_menu' ) );
            add_action( 'network_admin_edit_the_feed_network_save', array( $this, 'save_network_settings' ) );
        }
        add_action( 'admin_menu', array( $this, 'register_site_menu' ) );
        add_action( 'admin_init', array( $this, 'register_settings' ) );

        // Frontend
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_component' ) );

        // Shortcodes
        add_shortcode( 'the_feed', array( $this, 'shortcode_handler' ) );
        add_shortcode( 'the_feed_event', array( $this, 'shortcode_event_handler' ) );
        add_shortcode( 'the_feed_ingest', array( $this, 'shortcode_ingest_handler' ) );

        // Gutenberg block
        add_action( 'init', array( $this, 'register_block' ) );

        // NLP AJAX endpoint (for the admin quick-parse tool)
        add_action( 'wp_ajax_the_feed_nlp_parse', array( $this, 'ajax_nlp_parse' ) );
    }

    // ─────────────────────────────────────────
    // Settings helpers
    // ─────────────────────────────────────────

    /**
     * Get a setting value. Checks network options first (multisite),
     * then falls back to site options, then to the default.
     */
    public static function get_option( string $key, $default = '' ) {
        if ( is_multisite() ) {
            $network_val = get_site_option( 'the_feed_' . $key );
            if ( $network_val !== false && $network_val !== '' ) {
                return $network_val;
            }
        }
        return get_option( 'the_feed_' . $key, $default );
    }

    // ─────────────────────────────────────────
    // Network Admin Menu (Multisite)
    // ─────────────────────────────────────────

    public function register_network_menu(): void {
        add_menu_page(
            __( 'The Feed Network', 'the-feed' ),
            __( 'The Feed', 'the-feed' ),
            'manage_network_options',
            'the-feed-network',
            array( $this, 'render_network_settings_page' ),
            'dashicons-rss',
            30
        );
    }

    public function render_network_settings_page(): void {
        if ( ! current_user_can( 'manage_network_options' ) ) {
            wp_die( esc_html__( 'You do not have permission to access this page.', 'the-feed' ) );
        }
        require THE_FEED_PLUGIN_DIR . 'admin/network-settings.php';
    }

    public function save_network_settings(): void {
        check_admin_referer( 'the_feed_network_settings' );

        if ( ! current_user_can( 'manage_network_options' ) ) {
            wp_die( esc_html__( 'Unauthorized.', 'the-feed' ) );
        }

        $fields = array(
            'api_url', 'nlp_worker_url', 'openai_api_key',
            'default_group', 'default_scope', 'default_radius_km',
            'component_cdn_url', 'default_theme', 'default_locale',
        );

        foreach ( $fields as $field ) {
            if ( isset( $_POST[ 'the_feed_' . $field ] ) ) {
                update_site_option(
                    'the_feed_' . $field,
                    sanitize_text_field( wp_unslash( $_POST[ 'the_feed_' . $field ] ) )
                );
            }
        }

        wp_redirect(
            add_query_arg(
                array( 'page' => 'the-feed-network', 'updated' => 'true' ),
                network_admin_url( 'admin.php' )
            )
        );
        exit;
    }

    // ─────────────────────────────────────────
    // Site Admin Menu
    // ─────────────────────────────────────────

    public function register_site_menu(): void {
        add_menu_page(
            __( 'The Feed', 'the-feed' ),
            __( 'The Feed', 'the-feed' ),
            'manage_options',
            'the-feed',
            array( $this, 'render_site_settings_page' ),
            'dashicons-rss',
            30
        );

        add_submenu_page(
            'the-feed',
            __( 'Settings', 'the-feed' ),
            __( 'Settings', 'the-feed' ),
            'manage_options',
            'the-feed',
            array( $this, 'render_site_settings_page' )
        );

        add_submenu_page(
            'the-feed',
            __( 'Shortcode Builder', 'the-feed' ),
            __( 'Shortcode Builder', 'the-feed' ),
            'manage_options',
            'the-feed-shortcode',
            array( $this, 'render_shortcode_builder' )
        );

        add_submenu_page(
            'the-feed',
            __( 'Quick Parse (NLP)', 'the-feed' ),
            __( 'Quick Parse', 'the-feed' ),
            'manage_options',
            'the-feed-nlp',
            array( $this, 'render_nlp_tool' )
        );
    }

    public function register_settings(): void {
        $fields = array(
            'api_url'            => THE_FEED_API_DEFAULT,
            'nlp_worker_url'     => THE_FEED_NLP_DEFAULT,
            'openai_api_key'     => '',
            'default_group'      => '',
            'default_scope'      => 'local',
            'default_radius_km'  => '150',
            'component_cdn_url'  => THE_FEED_COMPONENT_CDN,
            'default_theme'      => 'light',
            'default_locale'     => 'en-CA',
        );

        foreach ( $fields as $field => $default ) {
            register_setting(
                'the_feed_settings',
                'the_feed_' . $field,
                array(
                    'type'              => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                    'default'           => $default,
                )
            );
        }
    }

    public function render_site_settings_page(): void {
        require THE_FEED_PLUGIN_DIR . 'admin/site-settings.php';
    }

    public function render_shortcode_builder(): void {
        require THE_FEED_PLUGIN_DIR . 'admin/shortcode-builder.php';
    }

    public function render_nlp_tool(): void {
        require THE_FEED_PLUGIN_DIR . 'admin/nlp-tool.php';
    }

    // ─────────────────────────────────────────
    // Frontend Asset Enqueue
    // ─────────────────────────────────────────

    public function enqueue_component(): void {
        $cdn_url = self::get_option( 'component_cdn_url', THE_FEED_COMPONENT_CDN );

        // Only enqueue if a shortcode or block is present on this page
        global $post;
        if (
            is_a( $post, 'WP_Post' ) &&
            (
                has_shortcode( $post->post_content, 'the_feed' ) ||
                has_shortcode( $post->post_content, 'the_feed_event' ) ||
                has_shortcode( $post->post_content, 'the_feed_ingest' ) ||
                has_block( 'the-feed/event', $post )
            )
        ) {
            wp_enqueue_script(
                'the-feed-component',
                esc_url( $cdn_url ),
                array(),
                THE_FEED_VERSION,
                array( 'strategy' => 'defer', 'in_footer' => true )
            );

            // Add module type attribute
            add_filter( 'script_loader_tag', array( $this, 'add_module_type' ), 10, 3 );
        }
    }

    public function add_module_type( string $tag, string $handle, string $src ): string {
        if ( 'the-feed-component' === $handle || 'the-feed-ingest-component' === $handle ) {
            return str_replace( '<script ', '<script type="module" ', $tag );
        }
        return $tag;
    }

    // ─────────────────────────────────────────
    // Shortcodes
    // ─────────────────────────────────────────

    /**
     * [the_feed] — Event list / feed display
     *
     * Attributes (all optional, inherit from plugin settings):
     *   mode      "list" | "minimal" | "card"
     *   group     Hub target group
     *   city      City filter
     *   region    Province filter
     *   genre     Genre filter
     *   limit     Max events (default 10)
     *   api       API base URL override
     *   theme     "light" | "dark"
     *   locale    BCP47 locale
     */
    public function shortcode_handler( array $atts ): string {
        $defaults = array(
            'mode'   => 'list',
            'group'  => self::get_option( 'default_group', '' ),
            'city'   => '',
            'region' => '',
            'genre'  => '',
            'limit'  => '10',
            'api'    => self::get_option( 'api_url', THE_FEED_API_DEFAULT ),
            'theme'  => self::get_option( 'default_theme', 'light' ),
            'locale' => self::get_option( 'default_locale', 'en-CA' ),
        );
        $a = shortcode_atts( $defaults, $atts, 'the_feed' );

        return $this->build_component_tag( $a );
    }

    /**
     * [the_feed_event token="evt_abc123"] — Single event card
     */
    public function shortcode_event_handler( array $atts ): string {
        $defaults = array(
            'token'  => '',
            'mode'   => 'card',
            'api'    => self::get_option( 'api_url', THE_FEED_API_DEFAULT ),
            'theme'  => self::get_option( 'default_theme', 'light' ),
            'locale' => self::get_option( 'default_locale', 'en-CA' ),
        );
        $a = shortcode_atts( $defaults, $atts, 'the_feed_event' );

        if ( empty( $a['token'] ) ) {
            return '<p style="color:red;">The Feed: <code>token</code> attribute is required for single event display.</p>';
        }

        // Enqueue component unconditionally when called from shortcode
        wp_enqueue_script(
            'the-feed-component',
            esc_url( self::get_option( 'component_cdn_url', THE_FEED_COMPONENT_CDN ) ),
            array(), THE_FEED_VERSION,
            array( 'strategy' => 'defer', 'in_footer' => true )
        );
        add_filter( 'script_loader_tag', array( $this, 'add_module_type' ), 10, 3 );

        return $this->build_component_tag( $a );
    }

    private function build_component_tag( array $a ): string {
        $attrs = '';
        $allowed = array( 'token', 'mode', 'group', 'city', 'region', 'genre', 'limit', 'api', 'theme', 'locale' );
        foreach ( $allowed as $key ) {
            if ( ! empty( $a[ $key ] ) ) {
                $attrs .= ' ' . esc_attr( $key ) . '="' . esc_attr( $a[ $key ] ) . '"';
            }
        }
        return '<the-feed-event' . $attrs . '></the-feed-event>';
    }

    /**
     * [the_feed_ingest] — Voice-to-text event submission form
     *
     * Embeds the <the-feed-ingest> Web Component — a single free-text field
     * with browser voice input. Submits to the Ingest Worker via /ingest/raw.
     *
     * Attributes:
     *   api           Ingest Worker URL override
     *   token         Source bearer token (optional — inherits from network settings)
     *   location      Location hint for NLP date resolution (e.g. "Kamloops, BC")
     *   placeholder   Textarea placeholder text override
     *   theme         "light" | "dark"
     */
    public function shortcode_ingest_handler( array $atts ): string {
        $defaults = array(
            'api'         => self::get_option( 'ingest_worker_url', 'https://the-feed-ingest.workers.dev' ),
            'token'       => self::get_option( 'source_token', '' ),
            'location'    => self::get_option( 'default_location', '' ),
            'placeholder' => '',
            'theme'       => self::get_option( 'default_theme', 'light' ),
        );
        $a = shortcode_atts( $defaults, $atts, 'the_feed_ingest' );

        // Enqueue the ingest component from CDN
        $cdn_base = rtrim( self::get_option( 'component_cdn_url', THE_FEED_COMPONENT_CDN ), '/' );
        // Derive the ingest component URL from the same CDN base as the display component
        $ingest_cdn_url = preg_replace( '/the-feed-event\.js$/', 'the-feed-ingest.js', $cdn_base )
            ?: $cdn_base . '/../the-feed-ingest.js';

        wp_enqueue_script(
            'the-feed-ingest-component',
            esc_url( $ingest_cdn_url ),
            array(),
            THE_FEED_VERSION,
            array( 'strategy' => 'defer', 'in_footer' => true )
        );
        add_filter( 'script_loader_tag', array( $this, 'add_module_type' ), 10, 3 );

        // Build <the-feed-ingest> element attributes
        $attrs = '';
        if ( ! empty( $a['api'] ) )         $attrs .= ' api="' . esc_attr( $a['api'] ) . '"';
        if ( ! empty( $a['token'] ) )        $attrs .= ' token="' . esc_attr( $a['token'] ) . '"';
        if ( ! empty( $a['location'] ) )     $attrs .= ' location-hint="' . esc_attr( $a['location'] ) . '"';
        if ( ! empty( $a['placeholder'] ) )  $attrs .= ' placeholder="' . esc_attr( $a['placeholder'] ) . '"';
        if ( ! empty( $a['theme'] ) )        $attrs .= ' theme="' . esc_attr( $a['theme'] ) . '"';

        return '<the-feed-ingest' . $attrs . '></the-feed-ingest>';
    }

    // ─────────────────────────────────────────
    // Gutenberg Block Registration
    // ─────────────────────────────────────────

    public function register_block(): void {
        if ( ! function_exists( 'register_block_type' ) ) {
            return;
        }
        register_block_type( THE_FEED_PLUGIN_DIR . 'blocks/the-feed-event' );
    }

    // ─────────────────────────────────────────
    // AJAX: NLP Quick Parse
    // ─────────────────────────────────────────

    public function ajax_nlp_parse(): void {
        check_ajax_referer( 'the_feed_nlp_parse', 'nonce' );

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( array( 'message' => 'Unauthorized' ), 403 );
        }

        $text    = isset( $_POST['text'] ) ? sanitize_textarea_field( wp_unslash( $_POST['text'] ) ) : '';
        $api_key = isset( $_POST['api_key'] )
            ? sanitize_text_field( wp_unslash( $_POST['api_key'] ) )
            : self::get_option( 'openai_api_key', '' );

        if ( empty( $text ) || empty( $api_key ) ) {
            wp_send_json_error( array( 'message' => 'Text and API key are required.' ), 400 );
        }

        $nlp_url = self::get_option( 'nlp_worker_url', THE_FEED_NLP_DEFAULT );

        $response = wp_remote_post(
            trailingslashit( $nlp_url ) . 'nlp/parse',
            array(
                'timeout' => 30,
                'headers' => array(
                    'Content-Type' => 'application/json',
                    'X-Api-Key'    => $api_key,
                ),
                'body' => wp_json_encode( array( 'text' => $text ) ),
            )
        );

        if ( is_wp_error( $response ) ) {
            wp_send_json_error( array( 'message' => $response->get_error_message() ), 502 );
        }

        $body = json_decode( wp_remote_retrieve_body( $response ), true );
        wp_send_json_success( $body );
    }
}

// ─────────────────────────────────────────────
// Activation / Deactivation
// ─────────────────────────────────────────────

register_activation_hook( __FILE__, function() {
    if ( is_multisite() ) {
        add_site_option( 'the_feed_api_url', THE_FEED_API_DEFAULT );
        add_site_option( 'the_feed_nlp_worker_url', THE_FEED_NLP_DEFAULT );
        add_site_option( 'the_feed_component_cdn_url', THE_FEED_COMPONENT_CDN );
        add_site_option( 'the_feed_default_theme', 'light' );
        add_site_option( 'the_feed_default_locale', 'en-CA' );
    }
} );

register_deactivation_hook( __FILE__, function() {
    // Intentionally left empty — settings are preserved on deactivation
} );
