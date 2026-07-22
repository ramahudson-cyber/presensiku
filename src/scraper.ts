import puppeteer from 'puppeteer';
import * as dotenv from 'dotenv';

dotenv.config();

async function loginAsAdmin() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  // Mengatur tampilan ke mode Mobile
  await page.setViewport({ width: 375, height: 812, isMobile: true });
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1');
  
  try {
    console.log('Membuka halaman dalam mode Mobile...');
    await page.goto('https://presensiku.vercel.app', { waitUntil: 'networkidle2' });
    
    // Fungsi untuk memantau URL setiap 2 detik
    setInterval(async () => {
        console.log('URL saat ini:', page.url());
    }, 2000);
    
    // Tunggu input muncul terlebih dahulu
    await page.waitForSelector('input[placeholder="Username atau Email"]');
    
    // Gunakan click agar fokus ke elemen sebelum mengetik
    await page.click('input[placeholder="Username atau Email"]');
    await page.keyboard.type(process.env.TEST_ADMIN_USERNAME || '');
    
    await page.click('input[placeholder="Password"]');
    await page.keyboard.type(process.env.TEST_ADMIN_PASSWORD || '');
    
    await page.click('button[type="submit"]');
    
    // Tunggu selama 5 detik agar sistem memproses login
    console.log('Menunggu sistem merespons...');
    await new Promise(r => setTimeout(r, 5000));
    console.log('Proses selesai. Lihat browser untuk memastikan login berhasil.');
    
    // Anda bisa menambahkan logika ekstraksi data di sini
  } catch (error) {
    console.error('Error saat login:', error);
  } finally {
    // browser.close(); // Biarkan terbuka agar Anda bisa melihat hasilnya
  }
}

loginAsAdmin();
