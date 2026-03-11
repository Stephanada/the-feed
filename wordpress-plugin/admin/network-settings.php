<?php
/**
 * The Feed — Network Admin Settings Page
 * Rendered at: Network Admin → The Feed → Settings
 * Controls network-wide defaults for all Vista Radio sites.
 */

if ( ! defined( 'ABSPATH' ) ) exit;
if ( ! current_user_can( 'manage_network_options' ) ) wp_die( 'Unauthorized' );

$updated = isset( $_GET['updated'] ) && $_GET['updated'] === 'true';
?>
<div class="wrap">
  <h1>
    <span style="font-size:1.4em;">🎵</span>
    <?php esc_html_e( 'The Feed — Network Settings', 'the-feed' ); ?>
  </h1>
  <p style="color:#666; max-width:600px;">
    <?php esc_html_e( 'These settings apply network-wide across all Vista Radio sites. Individual sites can override them in their local settings.', 'the-feed' ); ?>
  </p>

  <?php if ( $updated ) : ?>
    <div class="notice notice-success is-dismissible"><p><?php esc_html_e( 'Network settings saved.', 'the-feed' ); ?></p></div>
  <?php endif; ?>

  <form method="post" action="<?php echo esc_url( network_admin_url( 'edit.php?action=the_feed_network_save' ) ); ?>">
    <?php wp_nonce_field( 'the_feed_network_settings' ); ?>

    <table class="form-table" role="presentation">

      <tr>
        <th scope="row"><label for="the_feed_api_url"><?php esc_html_e( 'Edge API URL', 'the-feed' ); ?></label></th>
        <td>
          <input type="url" id="the_feed_api_url" name="the_feed_api_url" class="regular-text"
            value="<?php echo esc_attr( get_site_option( 'the_feed_api_url', THE_FEED_API_DEFAULT ) ); ?>">
          <p class="description"><?php esc_html_e( 'Your Cloudflare Worker API base URL.', 'the-feed' ); ?></p>
        </td>
      </tr>

      <tr>
        <th scope="row"><label for="the_feed_nlp_worker_url"><?php esc_html_e( 'NLP Worker URL', 'the-feed' ); ?></label></th>
        <td>
          <input type="url" id="the_feed_nlp_worker_url" name="the_feed_nlp_worker_url" class="regular-text"
            value="<?php echo esc_attr( get_site_option( 'the_feed_nlp_worker_url', THE_FEED_NLP_DEFAULT ) ); ?>">
          <p class="description"><?php esc_html_e( 'NLP Parser Worker URL for automated event extraction.', 'the-feed' ); ?></p>
        </td>
      </tr>

      <tr>
        <th scope="row"><label for="the_feed_ingest_worker_url"><?php esc_html_e( 'Ingest Worker URL', 'the-feed' ); ?></label></th>
        <td>
          <input type="url" id="the_feed_ingest_worker_url" name="the_feed_ingest_worker_url" class="regular-text"
            value="<?php echo esc_attr( get_site_option( 'the_feed_ingest_worker_url', 'https://the-feed-ingest.workers.dev' ) ); ?>">
          <p class="description">
            <?php esc_html_e( 'Natural Language Ingest Worker URL — used by the [the_feed_ingest] shortcode and the submission form.', 'the-feed' ); ?>
          </p>
        </td>
      </tr>

      <tr>
        <th scope="row"><label for="the_feed_source_token"><?php esc_html_e( 'Source Token', 'the-feed' ); ?></label></th>
        <td>
          <input type="password" id="the_feed_source_token" name="the_feed_source_token" class="regular-text"
            value="<?php echo esc_attr( get_site_option( 'the_feed_source_token', '' ) ); ?>"
            autocomplete="new-password">
          <p class="description">
            <?php esc_html_e( 'Bearer token identifying this network as a trusted source. Passed as Authorization: Bearer {token} to the Ingest Worker. Sets trust level for auto-routing events. Leave blank for anonymous (public) submission mode.', 'the-feed' ); ?>
          </p>
        </td>
      </tr>

      <tr>
        <th scope="row"><label for="the_feed_openai_api_key"><?php esc_html_e( 'OpenAI API Key (BYOK)', 'the-feed' ); ?></label></th>
        <td>
          <input type="password" id="the_feed_openai_api_key" name="the_feed_openai_api_key" class="regular-text"
            value="<?php echo esc_attr( get_site_option( 'the_feed_openai_api_key', '' ) ); ?>"
            autocomplete="new-password">
          <p class="description">
            <?php esc_html_e( 'Your OpenAI API key. Used for NLP event parsing (Bring Your Own Key). Stored encrypted in the database and sent only to the NLP Worker — never logged or exposed to the frontend.', 'the-feed' ); ?>
          </p>
        </td>
      </tr>

      <tr>
        <th scope="row"><label for="the_feed_default_group"><?php esc_html_e( 'Default Hub Group', 'the-feed' ); ?></label></th>
        <td>
          <input type="text" id="the_feed_default_group" name="the_feed_default_group" class="regular-text"
            value="<?php echo esc_attr( get_site_option( 'the_feed_default_group', '' ) ); ?>"
            placeholder="e.g. vista-radio-bc">
          <p class="description"><?php esc_html_e( 'Default targetGroup for filtering events on this network. Matches entries in rules.json.', 'the-feed' ); ?></p>
        </td>
      </tr>

      <tr>
        <th scope="row"><label for="the_feed_default_scope"><?php esc_html_e( 'Default Scope', 'the-feed' ); ?></label></th>
        <td>
          <select id="the_feed_default_scope" name="the_feed_default_scope">
            <?php foreach ( array( 'local', 'regional', 'national' ) as $scope ) : ?>
              <option value="<?php echo esc_attr( $scope ); ?>"
                <?php selected( get_site_option( 'the_feed_default_scope', 'local' ), $scope ); ?>>
                <?php echo esc_html( ucfirst( $scope ) ); ?>
              </option>
            <?php endforeach; ?>
          </select>
        </td>
      </tr>

      <tr>
        <th scope="row"><label for="the_feed_default_radius_km"><?php esc_html_e( 'Geographic Radius (km)', 'the-feed' ); ?></label></th>
        <td>
          <input type="number" id="the_feed_default_radius_km" name="the_feed_default_radius_km" class="small-text"
            value="<?php echo esc_attr( get_site_option( 'the_feed_default_radius_km', '150' ) ); ?>"
            min="1" max="5000">
          <p class="description"><?php esc_html_e( 'Radius in kilometres for geographic event filtering.', 'the-feed' ); ?></p>
        </td>
      </tr>

      <tr>
        <th scope="row"><label for="the_feed_component_cdn_url"><?php esc_html_e( 'Component CDN URL', 'the-feed' ); ?></label></th>
        <td>
          <input type="url" id="the_feed_component_cdn_url" name="the_feed_component_cdn_url" class="regular-text"
            value="<?php echo esc_attr( get_site_option( 'the_feed_component_cdn_url', THE_FEED_COMPONENT_CDN ) ); ?>">
          <p class="description"><?php esc_html_e( 'URL of the the-feed-event.js Web Component on Cloudflare Pages CDN.', 'the-feed' ); ?></p>
        </td>
      </tr>

      <tr>
        <th scope="row"><label for="the_feed_default_theme"><?php esc_html_e( 'Default Theme', 'the-feed' ); ?></label></th>
        <td>
          <select id="the_feed_default_theme" name="the_feed_default_theme">
            <option value="light" <?php selected( get_site_option( 'the_feed_default_theme', 'light' ), 'light' ); ?>><?php esc_html_e( 'Light', 'the-feed' ); ?></option>
            <option value="dark" <?php selected( get_site_option( 'the_feed_default_theme', 'light' ), 'dark' ); ?>><?php esc_html_e( 'Dark', 'the-feed' ); ?></option>
          </select>
        </td>
      </tr>

    </table>

    <?php submit_button( __( 'Save Network Settings', 'the-feed' ) ); ?>
  </form>
</div>
