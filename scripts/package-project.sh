#!/usr/bin/env bash
# ==============================================================================
# Script đóng gói dự án Shop QR Payment (DACS2 - VKU)
# Người phụ trách: Sinh viên Tiên (Frontend & Packaging Specialist)
# Chức năng: Đóng gói mã nguồn sạch (loại bỏ node_modules, .next, cache, git)
# ==============================================================================

set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
PROJECT_NAME="shop-qr-payment"
OUTPUT_DIR="dist_packages"
ZIP_FILE="${OUTPUT_DIR}/${PROJECT_NAME}_vku_${TIMESTAMP}.zip"
TAR_FILE="${OUTPUT_DIR}/${PROJECT_NAME}_vku_${TIMESTAMP}.tar.gz"

echo "=========================================================="
echo "📦 BẮT ĐẦU ĐÓNG GÓI DỰ ÁN SHOP QR PAYMENT"
echo "=========================================================="

# 1. Tạo thư mục đích
mkdir -p "${OUTPUT_DIR}"

# 2. Kiểm tra xem zip hoặc tar có sẵn không
if command -v zip >/dev/null 2>&1; then
  echo "👉 Đang tạo tệp nén ZIP: ${ZIP_FILE}..."
  zip -r "${ZIP_FILE}" . \
    -x "node_modules/*" \
    -x ".next/*" \
    -x ".git/*" \
    -x ".hermes/*" \
    -x ".claude/*" \
    -x "${OUTPUT_DIR}/*" \
    -x "*.log" \
    -x ".DS_Store" \
    -x "coverage/*" \
    -x "tmp/*"
  echo "✅ Đã đóng gói thành công tệp ZIP: ${ZIP_FILE}"
else
  echo "⚠️ Lệnh 'zip' không khả dụng, chuyển sang dùng 'tar'..."
  tar --exclude='./node_modules' \
      --exclude='./.next' \
      --exclude='./.git' \
      --exclude='./.hermes' \
      --exclude='./.claude' \
      --exclude="./${OUTPUT_DIR}" \
      --exclude='*.log' \
      --exclude='./coverage' \
      --exclude='./tmp' \
      -czf "${TAR_FILE}" .
  echo "✅ Đã đóng gói thành công tệp TAR.GZ: ${TAR_FILE}"
fi

echo "----------------------------------------------------------"
echo "📋 DANH MỤC THÀNH PHẦN TRONG GÓI BÀN GIAO:"
echo "  1. Mã nguồn Next.js 16 + TypeScript + Tailwind CSS"
echo "  2. Prisma Schema & Seed script dữ liệu mẫu phong phú"
echo "  3. Toàn bộ tài liệu báo cáo học thuật trong thư mục docs/"
echo "  4. Bộ kiểm thử tự động 452 ca test trong thư mục tests/"
echo "----------------------------------------------------------"
echo "🎉 HOÀN THÀNH ĐÓNG GÓI DỰ ÁN!"
echo "=========================================================="
