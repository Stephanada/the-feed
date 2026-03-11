<?php
/**
 * The Feed — NLP Quick Parse Admin Tool
 * Paste raw event text and extract structured event data
 * using the NLP Worker endpoint.
 */
if ( ! defined( 'ABSPATH' ) ) exit;
if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Unauthorized' );

$api_key_saved = ! empty( TheFeed_Plugin::get_option( 'openai_api_key' ) );
$nlp_url = TheFeed_Plugin::get_option( 'nlp_worker_url', THE_FEED_NLP_DEFAULT );
?>
<div class="wrap">
  <h1>🤖 <?php esc_html_e( 'The Feed — Quick Parse (NLP)', 'the-feed' ); ?></h1>
  <p style="color:#666; max-width:660px;">
    <?php esc_html_e( 'Paste raw event text — a venue email, social media post, press release, or any unstructured event listing — and extract structured event data instantly using the NLP Parser.', 'the-feed' ); ?>
  </p>

  <?php if ( ! $api_key_saved ) : ?>
    <div class="notice notice-warning">
      <p>
        <?php
        printf(
          wp_kses(
            __( 'No OpenAI API key is configured. <a href="%s">Add your key in Settings</a> or enter it below.', 'the-feed' ),
            array( 'a' => array( 'href' => array() ) )
          ),
          esc_url( admin_url( 'admin.php?page=the-feed' ) )
        );
        ?>
      </p>
    </div>
  <?php endif; ?>

  <div style="display:grid; grid-template-columns:1fr 1fr; gap:2rem; max-width:1100px;">

    <!-- Input -->
    <div>
      <h2 style="margin-top:0;"><?php esc_html_e( 'Input', 'the-feed' ); ?></h2>

      <?php if ( ! $api_key_saved ) : ?>
        <div style="margin-bottom:1rem;">
          <label for="tf_nlp_key"><strong><?php esc_html_e( 'OpenAI API Key', 'the-feed' ); ?></strong></label><br>
          <input type="password" id="tf_nlp_key" class="regular-text" placeholder="sk-..." style="margin-top:4px;">
          <p class="description"><?php esc_html_e( 'Used only for this request. Save it in Settings for persistence.', 'the-feed' ); ?></p>
        </div>
      <?php endif; ?>

      <label for="tf_nlp_text"><strong><?php esc_html_e( 'Event Text', 'the-feed' ); ?></strong></label>
      <textarea id="tf_nlp_text" rows="14"
        style="width:100%; margin-top:6px; font-family:monospace; font-size:0.875rem; padding:0.75rem; border-radius:6px; border:1px solid #ccc;"
        placeholder="Paste a venue email, Facebook event description, press release, or any event listing here..."
      ></textarea>

      <div style="margin-top:0.75rem; display:flex; gap:0.75rem; align-items:center;">
        <button type="button" id="tf_nlp_parse_btn" class="button button-primary">
          🤖 <?php esc_html_e( 'Parse Events', 'the-feed' ); ?>
        </button>
        <span id="tf_nlp_spinner" style="display:none;">
          <span class="spinner is-active" style="float:none; margin:0;"></span>
          <?php esc_html_e( 'Parsing…', 'the-feed' ); ?>
        </span>
      </div>

      <div id="tf_nlp_error" style="display:none; margin-top:1rem;" class="notice notice-error"><p></p></div>
    </div>

    <!-- Output -->
    <div>
      <h2 style="margin-top:0;"><?php esc_html_e( 'Extracted Events', 'the-feed' ); ?></h2>
      <div id="tf_nlp_rejected" style="display:none;" class="notice notice-error">
        <p><strong><?php esc_html_e( '🚫 Brand Safety Rejected', 'the-feed' ); ?></strong><br>
        <span id="tf_nlp_rejected_reason"></span></p>
      </div>
      <div id="tf_nlp_results" style="display:none;">
        <p id="tf_nlp_count" style="color:#444; font-weight:600;"></p>
        <textarea id="tf_nlp_json" readonly rows="20"
          style="width:100%; font-family:monospace; font-size:0.75rem; padding:0.75rem; border-radius:6px; border:1px solid #ccc; background:#f9f9f9;"></textarea>
        <button type="button" id="tf_nlp_copy" class="button" style="margin-top:0.5rem;">
          📋 <?php esc_html_e( 'Copy JSON', 'the-feed' ); ?>
        </button>
        <span id="tf_nlp_copy_confirm" style="display:none; color:green; margin-left:0.75rem;">✅ Copied!</span>
      </div>
      <div id="tf_nlp_placeholder" style="color:#aaa; padding:3rem 0; text-align:center;">
        <?php esc_html_e( 'Parsed event data will appear here.', 'the-feed' ); ?>
      </div>
    </div>
  </div>
</div>

<script>
(function($) {
  const nonce = '<?php echo esc_js( wp_create_nonce( 'the_feed_nlp_parse' ) ); ?>';

  document.getElementById('tf_nlp_parse_btn').addEventListener('click', function() {
    const text = document.getElementById('tf_nlp_text').value.trim();
    const keyInput = document.getElementById('tf_nlp_key');
    const apiKey = keyInput ? keyInput.value.trim() : '';

    if (!text) {
      alert('<?php echo esc_js( __( 'Please enter some event text to parse.', 'the-feed' ) ); ?>');
      return;
    }

    // Reset UI
    document.getElementById('tf_nlp_error').style.display = 'none';
    document.getElementById('tf_nlp_rejected').style.display = 'none';
    document.getElementById('tf_nlp_results').style.display = 'none';
    document.getElementById('tf_nlp_placeholder').style.display = 'none';
    document.getElementById('tf_nlp_spinner').style.display = 'inline-flex';
    document.getElementById('tf_nlp_parse_btn').disabled = true;

    const body = new FormData();
    body.append('action', 'the_feed_nlp_parse');
    body.append('nonce', nonce);
    body.append('text', text);
    if (apiKey) body.append('api_key', apiKey);

    fetch(ajaxurl, { method: 'POST', body })
      .then(r => r.json())
      .then(res => {
        document.getElementById('tf_nlp_spinner').style.display = 'none';
        document.getElementById('tf_nlp_parse_btn').disabled = false;

        if (!res.success) {
          document.getElementById('tf_nlp_error').style.display = 'block';
          document.getElementById('tf_nlp_error').querySelector('p').textContent = res.data?.message || 'Unknown error.';
          return;
        }

        const data = res.data;

        if (data.rejected) {
          document.getElementById('tf_nlp_rejected').style.display = 'block';
          document.getElementById('tf_nlp_rejected_reason').textContent = data.reason || '';
          return;
        }

        const events = data.events || [];
        document.getElementById('tf_nlp_count').textContent =
          `Found ${events.length} event${events.length !== 1 ? 's' : ''}.`;
        document.getElementById('tf_nlp_json').value = JSON.stringify(events, null, 2);
        document.getElementById('tf_nlp_results').style.display = 'block';
      })
      .catch(err => {
        document.getElementById('tf_nlp_spinner').style.display = 'none';
        document.getElementById('tf_nlp_parse_btn').disabled = false;
        document.getElementById('tf_nlp_error').style.display = 'block';
        document.getElementById('tf_nlp_error').querySelector('p').textContent = err.message;
      });
  });

  document.getElementById('tf_nlp_copy').addEventListener('click', function() {
    const json = document.getElementById('tf_nlp_json').value;
    navigator.clipboard.writeText(json).then(() => {
      const c = document.getElementById('tf_nlp_copy_confirm');
      c.style.display = 'inline';
      setTimeout(() => c.style.display = 'none', 2000);
    });
  });
})(jQuery);
</script>
