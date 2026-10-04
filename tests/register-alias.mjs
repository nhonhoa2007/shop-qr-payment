/**
 * Đăng ký resolve hook cho Node.js test runner (--import).
 *
 * Lý do: `node --experimental-strip-types` không hiểu tsconfig `paths`,
 * nên test chỉ import được module nếu mọi file trong chuỗi import dùng
 * relative path. Hook này cho phép test import trực tiếp các module viết
 * bằng alias `@server/*`, `@shared/*`, `@client/*`, `@/*` — đồng bộ hoàn toàn
 * với cách import trong mã nguồn ứng dụng.
 *
 * Được nạp tự động qua script `npm run test` trong package.json.
 */
import { registerHooks } from 'node:module';
import { resolve } from './alias-hooks.mjs';

registerHooks({ resolve });
