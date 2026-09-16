const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 1. Tự động đọc biến môi trường từ .env nếu chưa được nạp
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ Lỗi: DATABASE_URL không tồn tại trong biến môi trường hoặc file .env');
  process.exit(1);
}

// 2. Phân tích thông số kết nối PostgreSQL từ URL
let parsedUrl;
try {
  parsedUrl = new URL(dbUrl);
} catch (err) {
  console.error('❌ Lỗi: Không thể phân tích cấu trúc DATABASE_URL:', err.message);
  process.exit(1);
}

const host = parsedUrl.hostname || 'localhost';
const port = parsedUrl.port || '5432';
const user = decodeURIComponent(parsedUrl.username || 'postgres');
const password = decodeURIComponent(parsedUrl.password || '');
const database = parsedUrl.pathname.replace(/^\//, '') || 'shopqr';

const backupsDir = path.resolve(__dirname, '../prisma/backups');
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

// 3. Đặt tên file backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const latestFile = path.join(backupsDir, 'shop_qr_payment_latest.sql');
const timestampFile = path.join(backupsDir, `shop_qr_payment_${timestamp}.sql`);

console.log(`📦 Đang trích xuất dữ liệu cơ sở dữ liệu "${database}" từ ${host}:${port}...`);

// 4. Chạy lệnh pg_dump an toàn qua PGPASSWORD env (không lộ mật khẩu qua CLI args)
const args = [
  '-h', host,
  '-p', port,
  '-U', user,
  '-d', database,
  '--clean',
  '--if-exists',
  '--no-owner',
  '--no-privileges',
  '-f', latestFile,
];

const result = spawnSync('pg_dump', args, {
  env: {
    ...process.env,
    PGPASSWORD: password,
  },
  stdio: 'inherit',
});

if (result.error) {
  console.error('❌ Lỗi thực thi lệnh pg_dump:', result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`❌ pg_dump kết thúc với mã lỗi: ${result.status}`);
  process.exit(result.status || 1);
}

// 5. Tạo bản sao có timestamp để lưu trữ lịch sử
fs.copyFileSync(latestFile, timestampFile);

// 6. Siết chặt phân quyền chmod 600 theo khuyến nghị bảo mật
try {
  fs.chmodSync(latestFile, 0o600);
  fs.chmodSync(timestampFile, 0o600);
} catch (err) {
  console.warn('⚠️ Không thể phân quyền chmod 600 (có thể do hệ điều hành):', err.message);
}

const stats = fs.statSync(latestFile);
const sizeKb = (stats.size / 1024).toFixed(2);

console.log('✅ SAO LƯU DỮ LIỆU THÀNH CÔNG:');
console.log(`   - Bản mới nhất: ${latestFile} (${sizeKb} KB, chmod 600)`);
console.log(`   - Bản lưu trữ:  ${timestampFile}`);
console.log('💡 Dữ liệu đã được đóng băng an toàn. Bạn có thể khôi phục bất kỳ lúc nào bằng: npm run db:restore');
