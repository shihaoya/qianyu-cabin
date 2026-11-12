-- AlterTable
ALTER TABLE "RafflePrize" ADD COLUMN "benefitTypeId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "RafflePrize_benefitTypeId_key" ON "RafflePrize"("benefitTypeId");

-- CreateIndex
CREATE INDEX "RafflePrize_benefitTypeId_idx" ON "RafflePrize"("benefitTypeId");

-- 回填历史数据：把已有的 BenefitType 补建为系统自带礼品（默认停用，权重 1，无限制库存）
-- 排除 RafflePrize 中已存在同名的记录，避免唯一索引冲突
INSERT INTO "RafflePrize" ("name", "benefitTypeId", "weight", "stock", "enabled", "createdAt", "updatedAt")
SELECT
    t."name",
    t."id",
    1,
    -1,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "BenefitType" t
WHERE t."id" NOT IN (
    SELECT "benefitTypeId" FROM "RafflePrize" WHERE "benefitTypeId" IS NOT NULL
)
AND t."name" NOT IN (
    SELECT "name" FROM "RafflePrize"
);
