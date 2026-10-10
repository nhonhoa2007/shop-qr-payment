/**
 * Dependency-Cruiser — kiểm tra ranh giới Layered Clean Architecture của dự án.
 * Chạy: npm run arch:check
 *
 * Quy tắc cốt lõi:
 *  1. @client không được phụ thuộc @server (Zero-Server-Leakage).
 *  2. @client không được phụ thuộc @prisma/client (kể cả type-only).
 *  3. @shared là Shared Kernel thuần: không phụ thuộc @client/@server/node APIs.
 */
module.exports = {
  forbidden: [
    {
      name: 'client-cannot-depend-on-server',
      comment: 'Tầng Presentation (@client) chỉ giao tiếp backend qua HTTP API / Pusher.',
      severity: 'error',
      from: { path: '^src/client' },
      to: { path: '^src/server' },
    },
    {
      name: 'client-cannot-depend-on-prisma',
      comment: 'Client không được import Prisma (kể cả type-only) — dùng DTO ở @shared/types.',
      severity: 'error',
      from: { path: '^src/client' },
      to: { path: '@prisma/client' },
    },
    {
      name: 'shared-kernel-is-pure',
      comment: 'Shared Kernel không được ngược lên client/server (tránh vòng phụ thuộc).',
      severity: 'error',
      from: { path: '^src/shared' },
      to: { path: '^src/(client|server)' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: './tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'],
    },
  },
};
