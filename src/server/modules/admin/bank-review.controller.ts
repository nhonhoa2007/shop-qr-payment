import { prisma } from "@server/database/prisma";
import { authOptions } from "@server/modules/auth/auth-options";
import { reserveOrderStock } from "@server/modules/inventory/inventory.service";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

async function adminId() {
  const session = await getServerSession(authOptions);
  return session?.user?.role === "ADMIN" ? session.user.id : null;
}

export async function GET() {
  if (!(await adminId()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const [bankTransfers, refundCases] = await Promise.all([
    prisma.bankTransfer.findMany({
      where: { status: "PENDING_REVIEW" },
      include: {
        order: { select: { orderCode: true, totalAmount: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.refundCase.findMany({
      where: { status: "OPEN" },
      include: { order: { select: { orderCode: true, paymentStatus: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return NextResponse.json({ bankTransfers, refundCases });
}

export async function POST(req: Request) {
  const reviewerId = await adminId();
  if (!reviewerId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = (await req.json()) as {
      action?: string;
      bankTransferIds?: string[];
      refundCaseId?: string;
      orderCode?: string;
      note?: string;
    };
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (!note)
      return NextResponse.json(
        { error: "Cần ghi chú hoặc mã tham chiếu hoàn tiền" },
        { status: 400 },
      );
    if (body.action === "RESOLVE_REFUND" && body.refundCaseId) {
      await prisma.$transaction(async (tx) => {
        const item = await tx.refundCase.findUniqueOrThrow({
          where: { id: body.refundCaseId },
        });
        const updated = await tx.refundCase.updateMany({
          where: { id: item.id, status: "OPEN" },
          data: {
            status: "COMPLETED",
            resolvedById: reviewerId,
            resolutionNote: note,
            resolvedAt: new Date(),
          },
        });
        if (updated.count !== 1)
          throw new Error("Yêu cầu hoàn tiền đã được xử lý");
        if (item.orderId)
          await tx.order.updateMany({
            where: {
              id: item.orderId,
              status: "CANCELLED",
              paymentStatus: "PAID",
            },
            data: { paymentStatus: "REFUNDED" },
          });
        if (item.bankTransferId)
          await tx.bankTransfer.update({
            where: { id: item.bankTransferId },
            data: {
              status: "REFUNDED",
              reviewedById: reviewerId,
              reviewedAt: new Date(),
              resolutionNote: note,
            },
          });
      });
      return NextResponse.json({ success: true });
    }
    const ids = [...new Set(body.bankTransferIds || [])];
    if (!ids.length || ids.length > 20)
      return NextResponse.json(
        { error: "Chọn 1–20 giao dịch" },
        { status: 400 },
      );
    if (body.action === "MARK_REFUNDED") {
      await prisma.$transaction(async (tx) => {
        const changed = await tx.bankTransfer.updateMany({
          where: { id: { in: ids }, status: "PENDING_REVIEW" },
          data: {
            status: "REFUNDED",
            reviewedById: reviewerId,
            reviewedAt: new Date(),
            resolutionNote: note,
          },
        });
        if (changed.count !== ids.length)
          throw new Error("Có giao dịch đã được xử lý; tải lại danh sách");
      });
      return NextResponse.json({ success: true });
    }
    if (body.action !== "APPLY_ORDER" || !body.orderCode?.trim())
      return NextResponse.json(
        { error: "Thiếu mã đơn hàng hoặc thao tác" },
        { status: 400 },
      );
    const orderCode = body.orderCode.trim().toUpperCase();
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { orderCode },
        include: { items: true },
      });
      if (
        !order ||
        order.paymentStatus === "PAID" ||
        order.paymentStatus === "REFUNDED"
      )
        throw new Error("Đơn không tồn tại hoặc đã thanh toán");
      const transfers = await tx.bankTransfer.findMany({
        where: { id: { in: ids }, status: "PENDING_REVIEW" },
      });
      if (
        transfers.length !== ids.length ||
        transfers.some((item) => item.amount <= 0)
      )
        throw new Error("Giao dịch không còn chờ đối soát");
      const total = transfers.reduce((sum, item) => sum + item.amount, 0);
      if (total < order.totalAmount)
        throw new Error("Tổng giao dịch chưa đủ giá trị đơn");
      const claimed = await tx.bankTransfer.updateMany({
        where: { id: { in: ids }, status: "PENDING_REVIEW" },
        data: {
          status: "APPLIED_ORDER",
          orderId: order.id,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          resolutionNote: note,
          reviewReason: null,
        },
      });
      if (claimed.count !== ids.length)
        throw new Error("Giao dịch đã được xử lý đồng thời");
      if (order.status === "CANCELLED") {
        const insufficient = await reserveOrderStock(tx, order.items);
        if (insufficient)
          throw new Error(`Không đủ tồn kho để phục hồi đơn (${insufficient})`);
        if (order.couponId) {
          const coupon = await tx.coupon.findUniqueOrThrow({
            where: { id: order.couponId },
          });
          const claimedCoupon = await tx.coupon.updateMany({
            where: {
              id: coupon.id,
              ...(coupon.usageLimit === null
                ? {}
                : { usedCount: { lt: coupon.usageLimit } }),
            },
            data: { usedCount: { increment: 1 } },
          });
          if (claimedCoupon.count !== 1)
            throw new Error("Coupon đã hết lượt dùng; không thể phục hồi đơn");
          if (order.userId)
            await tx.couponUsage.create({
              data: {
                couponId: order.couponId,
                userId: order.userId,
                orderId: order.id,
              },
            });
        }
      }
      const changed = await tx.order.updateMany({
        where: {
          id: order.id,
          paymentStatus: { in: ["UNPAID", "EXPIRED"] },
          status: { in: ["PENDING", "CANCELLED"] },
        },
        data: { paymentStatus: "PAID", status: "CONFIRMED" },
      });
      if (changed.count !== 1) throw new Error("Trạng thái đơn đã thay đổi");
      await tx.transaction.create({
        data: {
          orderId: order.id,
          bankTransId: `REVIEW-${order.id}`,
          amount: order.totalAmount,
          description: `Đối soát ${ids.join(", ")}`,
          verified: true,
          receivedAt: new Date(),
          rawWebhookData: {
            bankTransferIds: ids,
            reviewedById: reviewerId,
            note,
          },
        },
      });
      if (total > order.totalAmount)
        await tx.refundCase.create({
          data: {
            sourceKey: `excess:${order.id}:${ids.sort().join(":")}`,
            orderId: order.id,
            amount: total - order.totalAmount,
            reason: "Tiền chuyển dư; cần hoàn phần chênh lệch",
          },
        });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lỗi đối soát" },
      { status: 400 },
    );
  }
}
