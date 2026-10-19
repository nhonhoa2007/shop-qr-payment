-- AlterTable
ALTER TABLE "Order" ADD COLUMN "couponUsageClaimedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ChatRoom" ADD COLUMN "customerId" TEXT,
ADD COLUMN "assignedStaffId" TEXT,
ADD COLUMN "customerReadAt" TIMESTAMP(3),
ADD COLUMN "staffReadAt" TIMESTAMP(3);

-- Backfill Order.couponUsageClaimedAt from CouponUsage
UPDATE "Order" o
SET "couponUsageClaimedAt" = cu."createdAt"
FROM "CouponUsage" cu
WHERE cu."orderId" = o."id";

-- Backfill ChatRoom customerId and customerReadAt
UPDATE "ChatRoom" cr
SET "customerId" = cp."userId",
    "customerReadAt" = cp."lastReadAt"
FROM "ChatRoomParticipant" cp
JOIN "User" u ON u."id" = cp."userId"
WHERE cp."roomId" = cr."id"
  AND u."role" = 'CUSTOMER';

-- Backfill ChatRoom assignedStaffId and staffReadAt
UPDATE "ChatRoom" cr
SET "assignedStaffId" = cp."userId",
    "staffReadAt" = cp."lastReadAt"
FROM "ChatRoomParticipant" cp
JOIN "User" u ON u."id" = cp."userId"
WHERE cp."roomId" = cr."id"
  AND u."role" IN ('STAFF', 'ADMIN');

-- CreateIndex
CREATE INDEX "ChatRoom_customerId_idx" ON "ChatRoom"("customerId");

-- CreateIndex
CREATE INDEX "ChatRoom_assignedStaffId_idx" ON "ChatRoom"("assignedStaffId");

-- AddForeignKey
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "CouponUsage" DROP CONSTRAINT IF EXISTS "CouponUsage_couponId_fkey";
ALTER TABLE "CouponUsage" DROP CONSTRAINT IF EXISTS "CouponUsage_userId_fkey";
ALTER TABLE "ChatRoomParticipant" DROP CONSTRAINT IF EXISTS "ChatRoomParticipant_roomId_fkey";
ALTER TABLE "ChatRoomParticipant" DROP CONSTRAINT IF EXISTS "ChatRoomParticipant_userId_fkey";

-- DropTable
DROP TABLE IF EXISTS "CouponUsage";

-- DropTable
DROP TABLE IF EXISTS "ChatRoomParticipant";
