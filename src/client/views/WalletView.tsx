'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { formatVND, formatDate } from '@shared/utils';
import { pusherClient } from '@/lib/pusher-client';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Zap,
  ShoppingBag,
  History,
  RotateCcw,
  Sparkles,
  Search,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import type { WalletTransaction, UserWallet } from '@shared/types';

interface WalletViewProps {
  initialWallet: UserWallet & {
    transactions: WalletTransaction[];
  };
  userName: string;
  userId: string;
}

export function WalletView({ initialWallet, userName, userId }: WalletViewProps) {
  const [balance, setBalance] = useState(initialWallet.balance);
  const [transactions, setTransactions] = useState<WalletTransaction[]>(initialWallet.transactions || []);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Lắng nghe sự kiện Pusher realtime khi có hoàn tiền hoặc thanh toán bằng ví
  useEffect(() => {
    if (!userId) return;

    const channel = pusherClient.subscribe(`private-user-${userId}`);

    channel.bind('wallet-updated', (data: { balance: number }) => {
      if (typeof data.balance === 'number') {
        setBalance(data.balance);
      }
      // Re-fetch transactions
      fetch('/api/wallet')
        .then((res) => res.json())
        .then((resData) => {
          if (resData.success && resData.data) {
            setTransactions(resData.data.transactions || []);
            setBalance(resData.data.balance);
          }
        })
        .catch(console.error);
    });

    return () => {
      pusherClient.unsubscribe(`private-user-${userId}`);
    };
  }, [userId]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchType = filterType === 'ALL' || tx.type === filterType;
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        tx.description.toLowerCase().includes(q) ||
        (tx.orderId && tx.orderId.toLowerCase().includes(q));
      return matchType && matchSearch;
    });
  }, [transactions, filterType, search]);

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Hero Wallet Balance Card */}
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#5433eb] via-[#3b1cb8] to-[#120630] text-white p-8 sm:p-10 shadow-2xl">
        {/* Background decorative circles */}
        <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="absolute right-32 -bottom-20 w-80 h-80 rounded-full bg-[#ff6b00]/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-white text-xs font-medium border border-white/10">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              <span>Ví Điện Tử Shop QR • Khách hàng thân thiết</span>
            </div>

            <div>
              <p className="text-xs text-white/70 tracking-wider uppercase font-medium">
                Số dư khả dụng của {userName}
              </p>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mt-1 text-white">
                {formatVND(balance)}
              </h1>
            </div>

            <p className="text-xs text-white/80 leading-relaxed">
              Số dư ví được tự động cộng khi đơn hàng được hoàn tiền và có thể sử dụng thanh toán 1-chạm
              nhanh chóng cho mọi đơn hàng tiếp theo.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-white text-[#120630] font-semibold text-xs hover:bg-white/90 transition shadow-lg"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Mua sắm ngay</span>
            </Link>
            <Link
              href="/orders"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium text-xs backdrop-blur-md transition border border-white/20"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Lịch sử đơn hàng</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 3 Value Proposition Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-[24px] p-6 shadow-card-custom border border-gray-100 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-gray-900">Hoàn tiền 100% tự động</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Khi đơn hàng bị hủy do sự cố hoặc hết hàng, tiền thanh toán được tự động cộng lại vào ví
              ngay lập tức.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-[24px] p-6 shadow-card-custom border border-gray-100 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-[#5433eb] flex items-center justify-center shrink-0">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-gray-900">Thanh toán 1-chạm</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Cấn trừ trực tiếp tiền trong ví khi đặt hàng tại bước Checkout mà không cần mở app ngân
              hàng quét mã QR.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-[24px] p-6 shadow-card-custom border border-gray-100 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-gray-900">Minh bạch & Bảo mật</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Mọi biến động số dư đều được ghi nhật ký nguyên tử và thông báo tức thì qua email và hệ
              thống.
            </p>
          </div>
        </div>
      </div>

      {/* Transaction History Section */}
      <div className="bg-white rounded-[28px] p-6 sm:p-8 shadow-card-custom border border-gray-100 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#5433eb]" />
            <h2 className="font-bold text-base text-gray-900 tracking-tight">Lịch sử biến động số dư</h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm nội dung, mã đơn..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-full border border-gray-200 focus:outline-none focus:border-[#5433eb] transition w-48 sm:w-60"
              />
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition ${
              filterType === 'ALL'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Tất cả ({transactions.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('REFUND')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1.5 ${
              filterType === 'REFUND'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Hoàn tiền ({transactions.filter((t) => t.type === 'REFUND').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('PURCHASE_PAYMENT')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1.5 ${
              filterType === 'PURCHASE_PAYMENT'
                ? 'bg-[#5433eb] text-white shadow-sm'
                : 'bg-purple-50 text-[#5433eb] hover:bg-purple-100'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Thanh toán đơn ({transactions.filter((t) => t.type === 'PURCHASE_PAYMENT').length})</span>
          </button>
        </div>

        {/* Transactions List */}
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3 text-gray-300">
              <Wallet className="w-8 h-8" />
            </div>
            <p className="text-sm font-medium text-gray-600">Chưa có giao dịch nào được ghi nhận</p>
            <p className="text-xs text-gray-400 mt-1">
              Các giao dịch hoàn tiền hoặc thanh toán bằng ví sẽ xuất hiện chi tiết tại đây
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredTransactions.map((tx) => {
              const isPositive = tx.amount > 0;
              const isRefund = tx.type === 'REFUND';
              return (
                <div key={tx.id} className="py-4 flex items-center justify-between gap-4 hover:bg-gray-50/50 rounded-xl px-2 transition">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-purple-50 text-[#5433eb]'
                      }`}
                    >
                      {isPositive ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-gray-900">{tx.description}</span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            isRefund
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-purple-50 text-[#5433eb]'
                          }`}
                        >
                          {isRefund ? 'Hoàn tiền' : 'Thanh toán'}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {formatDate(tx.createdAt)}
                        {tx.orderId && ` • Mã đơn: ${tx.orderId}`}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className={`font-bold text-sm ${
                        isPositive ? 'text-emerald-600' : 'text-gray-900'
                      }`}
                    >
                      {isPositive ? `+${formatVND(tx.amount)}` : formatVND(tx.amount)}
                    </p>
                    <span className="text-[10px] text-gray-400 flex items-center justify-end gap-1 mt-0.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      Hoàn tất
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default WalletView;
