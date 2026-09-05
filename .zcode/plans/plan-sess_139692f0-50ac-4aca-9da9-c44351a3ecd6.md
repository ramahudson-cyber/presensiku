## Plan: Feedback Emot Emoji untuk WordPress

### Target
Form feedback pengunjung dengan emoji emot, disimpan di database WordPress.

### Files to Create

#### 1. `feedback-emot/feedback-emot.php` — WordPress Plugin
- Buat tabel custom `wp_feedback_emots` di database
- Register AJAX handler (`wp_ajax_feedback_submit` + `wp_ajax_nopriv_feedback_submit`)
- Handle submit data: emoji, nama (opsional), komentar (opsional), timestamp
- Endpoint AJAX untuk menerima POST dari form frontend

#### 2. `feedback-emot/preview-feedback-emot.html` — Preview HTML
- Form emoji emot interaktif: 😊 Senang, 😐 Biasa, 😢 Kecewa
- Input nama (opsional), textarea komentar (opsional)
- Tombol submit
- CSS styling modern, glassmorphism
- JavaScript: kirim AJAX ke WordPress, show success message

#### 3. CSS untuk Elementor Custom CSS (opsional)
- Jika mau disisipkan ke Custom CSS di Elementor

### Cara Pasang
1. Upload folder `feedback-emot/` ke `wp-content/plugins/`
2. Aktifkan plugin
3. Di Elementor, tambahkan **Custom HTML** widget → paste HTML form dari preview
4. Publish halaman

### Struktur Tabel Database
```sql
CREATE TABLE IF NOT EXISTS wp_feedback_emots (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(100) DEFAULT NULL,
  emoji VARCHAR(10) NOT NULL,
  label VARCHAR(50) NOT NULL,
  komentar TEXT DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Flow Submit
```
User klik emoji → Isi form → Submit
  ↓
JavaScript fetch() → /wp-admin/admin-ajax.php?action=submit_feedback
  ↓
Plugin feedback-emot → insert ke wp_feedback_emots
  ↓
Response JSON { success: true, message: "Terima kasih!" }
  ↓
Show success toast/message
```