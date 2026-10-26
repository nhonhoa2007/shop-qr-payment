'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface BankTransfer {
  id: string; bankTransId: string | null; amount: number; description: string;
  reviewReason: string | null; order: { orderCode: string; totalAmount: number } | null;
}
interface RefundCase {
  id: string; amount: number; reason: string; order: { orderCode: string } | null;
}

export function BankReviewPanel() {
  const [transfers, setTransfers] = useState<BankTransfer[]>([]);
  const [refunds, setRefunds] = useState<RefundCase[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [orderCode, setOrderCode] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const reload = async () => {
    const res = await fetch('/api/admin/bank-review');
    if (!res.ok) throw new Error('Không tải được hàng chờ đối soát');
    const data = await res.json();
    setTransfers(data.bankTransfers);
    setRefunds(data.refundCases);
    setSelected([]);
  };
  useEffect(() => {
    fetch('/api/admin/bank-review').then(async (res) => {
      if (!res.ok) throw new Error('Không tải được hàng chờ đối soát');
      return res.json();
    }).then((data) => { setTransfers(data.bankTransfers); setRefunds(data.refundCases); })
      .catch((err) => toast.error(err.message));
  }, []);
  const submit = async (action: 'APPLY_ORDER' | 'MARK_REFUNDED' | 'RESOLVE_REFUND', refundCaseId?: string) => {
    if (!note.trim()) { toast.error('Nhập ghi chú hoặc mã tham chiếu hoàn tiền'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/bank-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, bankTransferIds: selected, orderCode, refundCaseId, note }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể đối soát');
      toast.success('Đã lưu kết quả đối soát');
      setNote('');
      await reload();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Lỗi đối soát'); }
    finally { setBusy(false); }
  };
  return <section className="bg-white rounded-2xl border border-amber-200 p-5 mb-6 space-y-4">
    <h2 className="text-lg font-bold">Cần đối soát ngân hàng ({transfers.length}) · Cần hoàn tiền ({refunds.length})</h2>
    <p className="text-sm text-gray-600">Chọn giao dịch để khớp đơn khi tổng tiền đủ; chỉ đánh dấu đã hoàn sau khi tiền thực sự được trả.</p>
    <div className="max-h-72 overflow-y-auto space-y-2">
      {transfers.map((item) => <label key={item.id} className="flex gap-3 items-start border rounded-lg p-3 text-sm">
        <input type="checkbox" checked={selected.includes(item.id)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />
        <span><strong>{item.bankTransId || 'Thiếu mã GD'}</strong> · {item.amount.toLocaleString('vi-VN')}đ · {item.order?.orderCode || 'Chưa khớp đơn'}<br />{item.description}<br /><span className="text-amber-700">{item.reviewReason || 'Cần kiểm tra'}</span></span>
      </label>)}
      {!transfers.length && <p className="text-sm text-gray-500">Không có giao dịch chờ đối soát.</p>}
    </div>
    <div className="grid gap-2 sm:grid-cols-2">
      <input className="border rounded-lg p-2" placeholder="Mã đơn cần khớp, ví dụ DH123456" value={orderCode} onChange={(e) => setOrderCode(e.target.value)} />
      <input className="border rounded-lg p-2" placeholder="Ghi chú / mã tham chiếu hoàn tiền" value={note} onChange={(e) => setNote(e.target.value)} />
    </div>
    <div className="flex gap-2 flex-wrap">
      <button className="bg-blue-600 text-white rounded-lg px-4 py-2 disabled:opacity-50" disabled={busy || !selected.length} onClick={() => void submit('APPLY_ORDER')}>Khớp đơn</button>
      <button className="bg-amber-700 text-white rounded-lg px-4 py-2 disabled:opacity-50" disabled={busy || !selected.length} onClick={() => void submit('MARK_REFUNDED')}>Xác nhận đã hoàn các giao dịch chọn</button>
    </div>
    {refunds.length > 0 && <div className="border-t pt-4 space-y-2"><h3 className="font-semibold">Yêu cầu hoàn tiền</h3>{refunds.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 border rounded-lg p-3 text-sm"><span>{item.order?.orderCode || 'Giao dịch ngân hàng'} · {item.amount.toLocaleString('vi-VN')}đ · {item.reason}</span><button disabled={busy} className="shrink-0 bg-amber-700 text-white rounded-lg px-3 py-2 disabled:opacity-50" onClick={() => void submit('RESOLVE_REFUND', item.id)}>Xác nhận đã hoàn</button></div>)}</div>}
  </section>;
}
