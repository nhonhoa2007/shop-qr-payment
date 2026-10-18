'use client';

import React, { useState } from 'react';

interface AuditLogItem {
  id: string;
  operationKey: string;
  actorId: string;
  actorEmail?: string | null;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  reason?: string | null;
  createdAt: string | Date;
}

interface AdminAuditLogsViewProps {
  initialLogs: AuditLogItem[];
  total: number;
}

export function AdminAuditLogsView({ initialLogs, total }: AdminAuditLogsViewProps) {
  const [logs] = useState<AuditLogItem[]>(initialLogs);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Nhật ký kiểm toán hệ thống (Audit Logs)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ghi vết bất biến mọi hành vi can thiệp vận hành, kho, giá và phân quyền ({total} bản ghi)
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4">Hành động</th>
                <th className="py-3 px-4">Thực thể</th>
                <th className="py-3 px-4">Người thực hiện</th>
                <th className="py-3 px-4">Lý do</th>
                <th className="py-3 px-4">Chi tiết thay đổi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-slate-700 dark:text-slate-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Chưa có bản ghi kiểm toán nào
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                    <td className="py-3 px-4 text-xs font-mono text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono">
                      {log.entityType} ({log.entityId})
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className="font-medium">{log.actorEmail || log.actorId}</span>
                      <span className="ml-1 text-slate-400">({log.actorRole})</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {log.reason || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs max-w-xs truncate">
                      {log.afterState ? (
                        <pre className="text-[10px] bg-slate-50 dark:bg-slate-900 p-1.5 rounded overflow-x-auto max-h-20">
                          {JSON.stringify(log.afterState, null, 2)}
                        </pre>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
