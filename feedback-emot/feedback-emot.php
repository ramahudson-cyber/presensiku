<?php
/**
 * Plugin Name: Feedback Emot
 * Description: Form feedback emoji emot untuk pengunjung, disimpan di database WordPress.
 * Version: 1.0.0
 * Author: Puskesmas Ampenan
 */

if (!defined('ABSPATH')) {
    exit;
}

class FeedbackEmot {

    private static $table_name;

    public function __construct() {
        global $wpdb;
        self::$table_name = $wpdb->prefix . 'feedback_emots';

        // Install plugin saat aktivasi
        register_activation_hook(__FILE__, array(__CLASS__, 'activate'));

        // Register AJAX handlers (logged-in + not logged-in)
        add_action('wp_ajax_submit_feedback', array(__CLASS__, 'handle_submit'));
        add_action('wp_ajax_nopriv_submit_feedback', array(__CLASS__, 'handle_submit'));
    }

    /**
     * Install: create table + default options
     */
    public static function activate() {
        global $wpdb;
        $charset = $wpdb->get_charset_collate();
        $table = $wpdb->prefix . 'feedback_emots';

        $sql = "CREATE TABLE IF NOT EXISTS {$table} (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            nama VARCHAR(100) DEFAULT NULL,
            emoji VARCHAR(10) NOT NULL,
            label VARCHAR(50) NOT NULL,
            komentar TEXT DEFAULT NULL,
            ip_address VARCHAR(45) DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) {$charset};";

        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);

        // Delete transient cache
        delete_transient('feedback_emot_stats');
    }

    /**
     * Handle AJAX submit
     */
    public static function handle_submit() {
        // Nonce check (optional but recommended)
        if (!empty($_POST['_wpnonce']) && !wp_verify_nonce($_POST['_wpnonce'], 'submit_feedback')) {
            wp_send_json_error(array('message' => 'Invalid request'));
        }

        $emoji   = sanitize_text_field($_POST['emoji'] ?? '');
        $label   = sanitize_text_field($_POST['label'] ?? '');
        $nama    = sanitize_text_field($_POST['nama'] ?? '');
        $komentar = sanitize_textarea_field($_POST['komentar'] ?? '');
        $ip      = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';

        // Validate emoji
        if (!in_array($emoji, array('😊', '😐', '😢', '🔥', '❤️', '👍'))) {
            wp_send_json_error(array('message' => 'Emoji tidak valid'));
        }

        // Check duplicate: same IP + emoji + last 5 minutes
        global $wpdb;
        $recent = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}feedback_emots 
             WHERE ip_address = %s AND created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)",
            $ip
        ));
        if ($recent > 0) {
            wp_send_json_error(array('message' => 'Anda sudah mengirim feedback dalam 5 menit terakhir'));
        }

        // Insert
        $inserted = $wpdb->insert(
            self::$table_name,
            array(
                'nama'       => $nama ?: 'Anonim',
                'emoji'      => $emoji,
                'label'      => $label,
                'komentar'   => $komentar ?: null,
                'ip_address' => $ip,
            ),
            array('%s', '%s', '%s', '%s', '%s')
        );

        if ($inserted) {
            wp_send_json_success(array('message' => 'Terima kasih atas feedback Anda!'));
        } else {
            wp_send_json_error(array('message' => 'Gagal menyimpan feedback'));
        }
    }

    /**
     * Get stats: count per emoji
     */
    public static function get_stats() {
        $cache = get_transient('feedback_emot_stats');
        if ($cache) return $cache;

        global $wpdb;
        $table = self::$table_name;
        $stats = $wpdb->get_results("
            SELECT emoji, label, COUNT(*) as count 
            FROM {$table} 
            GROUP BY emoji, label 
            ORDER BY count DESC
        ", ARRAY_A);

        set_transient('feedback_emot_stats', $stats, 3600); // Cache 1 hour
        return $stats;
    }

    /**
     * Get recent feedbacks (for admin)
     */
    public static function get_recent($limit = 20) {
        global $wpdb;
        $table = self::$table_name;
        return $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$table} ORDER BY created_at DESC LIMIT %d",
            $limit
        ), ARRAY_A);
    }
}

// Initialize
new FeedbackEmot();
