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

// 3. Xác định file sao lưu cần khôi phục
const backupsDir = path.resolve(__dirname, '../prisma/backups');
const targetFile = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(backupsDir, 'shop_qr_payment_latest.sql');

if (!fs.existsSync(targetFile)) {
  console.error(`❌ Lỗi: Không tìm thấy file backup tại: ${targetFile}`);
  console.error('💡 Vui lòng chạy lệnh "npm run db:backup" trước để tạo bản sao lưu.');
  process.exit(1);
}

console.log(`🔄 Đang phục hồi cơ sở dữ liệu "${database}" từ file: ${targetFile}...`);

// 4. Chạy lệnh psql an toàn qua PGPASSWORD env
const args = [
  '-h', host,
  '-p', port,
  '-U', user,
  '-d', database,
  '-f', targetFile,
];

const result = spawnSync('psql', args, {
  env: {
    ...process.env,
    PGPASSWORD: password,
  },
  stdio: 'inherit',
});

if (result.error) {
  console.error('❌ Lỗi thực thi lệnh psql:', result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`❌ psql kết thúc với mã lỗi: ${result.status}`);
  process.exit(result.status || 1);
}

console.log('✅ KHÔI PHỤC DỮ LIỆU THÀNH CÔNG!');
console.log(`💡 Toàn bộ cấu trúc bảng và dữ liệu đã được nạp hoàn chỉnh vào database "${database}".`);
