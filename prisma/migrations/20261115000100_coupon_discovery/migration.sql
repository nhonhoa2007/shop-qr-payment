ALTER TABLE "User" ADD COLUMN "savedCouponIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Coupon" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Coupon_isPublic_isActive_endDate_idx" ON "Coupon"("isPublic", "isActive", "endDate");
