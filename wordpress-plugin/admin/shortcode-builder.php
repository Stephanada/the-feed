<?php
/**
 * The Feed — Shortcode Builder Admin Page
 * A visual builder that generates shortcode strings.
 */
if ( ! defined( 'ABSPATH' ) ) exit;
if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Unauthorized' );
?>
<div class="wrap">
  <h1>🎵 <?php esc_html_e( 'The Feed — Shortcode Builder', 'the-feed' ); ?></h1>
  <p style="color:#666; max-width:600px;">
    <?php esc_html_e( 'Configure your event display options below, then copy the generated shortcode into any post, page, or widget.', 'the-feed' ); ?>
  </p>

  <div style="display:grid; grid-template-columns:1fr 1fr; gap:2rem; max-width:960px;">

    <!-- Builder Form -->
    <div>
      <h2 style="margin-top:0;"><?php esc_html_e( 'Options', 'the-feed' ); ?></h2>
      <table class="form-table" style="margin-top:0;">

        <tr>
          <th><label for="tf_mode"><?php esc_html_e( 'Display Mode', 'the-feed' ); ?></label></th>
          <td>
            <select id="tf_mode">
              <option value="list"><?php esc_html_e( 'Event List (Cards)', 'the-feed' ); ?></option>
              <option value="minimal"><?php esc_html_e( 'Minimal (Sidebar)', 'the-feed' ); ?></option>
              <option value="card"><?php esc_html_e( 'Single Event Card', 'the-feed' ); ?></option>
            </select>
          </td>
        </tr>

        <tr id="tf_token_row" style="display:none;">
          <th><label for="tf_token"><?php esc_html_e( 'Event Token (evt_ ID)', 'the-feed' ); ?></label></th>
          <td><input type="text" id="tf_token" class="regular-text" placeholder="evt_abc123..."></td>
        </tr>

        <tr>
          <th><label for="tf_group"><?php esc_html_e( 'Hub Group', 'the-feed' ); ?></label></th>
          <td>
            <input type="text" id="tf_group" class="regular-text"
              value="<?php echo esc_attr( TheFeed_Plugin::get_option( 'default_group', '' ) ); ?>"
              placeholder="e.g. vista-radio-kamloops">
            <p class="description"><?php esc_html_e( 'Filter events to a specific network hub.', 'the-feed' ); ?></p>
          </td>
        </tr>

        <tr>
          <th><label for="tf_city"><?php esc_html_e( 'City', 'the-feed' ); ?></label></th>
          <td><input type="text" id="tf_city" class="regular-text" placeholder="e.g. Kamloops"></td>
        </tr>

        <tr>
          <th><label for="tf_region"><?php esc_html_e( 'Province/Region', 'the-feed' ); ?></label></th>
          <td><input type="text" id="tf_region" class="regular-text" placeholder="e.g. BC"></td>
        </tr>

        <tr>
          <th><label for="tf_genre"><?php esc_html_e( 'Genre', 'the-feed' ); ?></label></th>
          <td><input type="text" id="tf_genre" class="regular-text" placeholder="e.g. country"></td>
        </tr>

        <tr>
          <th><label for="tf_limit"><?php esc_html_e( 'Max Events', 'the-feed' ); ?></label></th>
          <td><input type="number" id="tf_limit" class="small-text" value="10" min="1" max="100"></td>
        </tr>

        <tr>
          <th><label for="tf_theme"><?php esc_html_e( 'Theme', 'the-feed' ); ?></label></th>
          <td>
            <select id="tf_theme">
              <option value="light"><?php esc_html_e( 'Light', 'the-feed' ); ?></option>
              <option value="dark"><?php esc_html_e( 'Dark', 'the-feed' ); ?></option>
            </select>
          </td>
        </tr>

      </table>
    </div>

    <!-- Output -->
    <div>
      <h2 style="margin-top:0;"><?php esc_html_e( 'Generated Shortcode', 'the-feed' ); ?></h2>
      <textarea id="tf_output" readonly
        style="width:100%; height:140px; font-family:monospace; font-size:0.875rem; padding:0.75rem; border-radius:6px; border:1px solid #ccc; background:#f9f9f9; resize:vertical;"
      ></textarea>
      <button type="button" id="tf_copy_btn" class="button button-primary" style="margin-top:0.5rem;">
        📋 <?php esc_html_e( 'Copy to Clipboard', 'the-feed' ); ?>
      </button>
      <span id="tf_copy_confirm" style="display:none; color:green; margin-left:0.75rem;">✅ Copied!</span>

      <hr>
      <h2><?php esc_html_e( 'Theming with CSS', 'the-feed' ); ?></h2>
      <p style="font-size:0.875rem; color:#555;"><?php esc_html_e( 'Add this CSS to your theme to match your brand:', 'the-feed' ); ?></p>
      <pre style="background:#f4f4f4; padding:1rem; border-radius:6px; font-size:0.8rem; overflow:auto;">the-feed-event {
  --primary-color: #c8102e;
  --accent-color: #c8102e;
  --font-family: 'Your Font', sans-serif;
  --card-radius: 8px;
  --card-shadow: 0 4px 20px rgba(0,0,0,0.1);
}</pre>
    </div>
  </div>
</div>

<script>
(function() {
  const fields = ['mode','token','group','city','region','genre','limit','theme'];
  const output = document.getElementById('tf_output');
  const modeEl = document.getElementById('tf_mode');
  const tokenRow = document.getElementById('tf_token_row');

  function build() {
    const mode = modeEl.value;
    tokenRow.style.display = (mode === 'card') ? '' : 'none';

    if (mode === 'card') {
      const token = document.getElementById('tf_token').value.trim();
      const theme = document.getElementById('tf_theme').value;
      let sc = `[the_feed_event token="${token}"`;
      if (theme !== 'light') sc += ` theme="${theme}"`;
      sc += `]`;
      output.value = sc;
      return;
    }

    let sc = '[the_feed';
    const attrs = {
      mode,
      group: document.getElementById('tf_group').value.trim(),
      city: document.getElementById('tf_city').value.trim(),
      region: document.getElementById('tf_region').value.trim(),
      genre: document.getElementById('tf_genre').value.trim(),
      limit: document.getElementById('tf_limit').value,
      theme: document.getElementById('tf_theme').value,
    };
    for (const [k, v] of Object.entries(attrs)) {
      if (v && !(k === 'limit' && v === '10') && !(k === 'theme' && v === 'light') && !(k === 'mode' && v === 'list')) {
        sc += ` ${k}="${v}"`;
      }
    }
    sc += ']';
    output.value = sc;
  }

  fields.forEach(f => {
    const el = document.getElementById('tf_' + f);
    if (el) el.addEventListener('input', build);
    if (el) el.addEventListener('change', build);
  });

  document.getElementById('tf_copy_btn').addEventListener('click', function() {
    navigator.clipboard.writeText(output.value).then(() => {
      const confirm = document.getElementById('tf_copy_confirm');
      confirm.style.display = 'inline';
      setTimeout(() => confirm.style.display = 'none', 2000);
    });
  });

  build();
})();
</script>
