-- CreateTable
CREATE TABLE "BenefitType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Fan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nickname" TEXT NOT NULL,
    "userId" INTEGER,
    "systemAccount" TEXT,
    "douyinAccount" TEXT,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FanBenefit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fanId" INTEGER NOT NULL,
    "typeId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BenefitLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fanId" INTEGER NOT NULL,
    "typeId" INTEGER NOT NULL,
    "fanNickname" TEXT NOT NULL,
    "typeName" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "operatorId" INTEGER,
    "operatorName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "BenefitType_name_key" ON "BenefitType"("name");

-- CreateIndex
CREATE INDEX "Fan_userId_idx" ON "Fan"("userId");

-- CreateIndex
CREATE INDEX "FanBenefit_typeId_idx" ON "FanBenefit"("typeId");

-- CreateIndex
CREATE UNIQUE INDEX "FanBenefit_fanId_typeId_key" ON "FanBenefit"("fanId", "typeId");

-- CreateIndex
CREATE INDEX "BenefitLog_fanId_createdAt_idx" ON "BenefitLog"("fanId", "createdAt");

-- CreateIndex
CREATE INDEX "BenefitLog_typeId_idx" ON "BenefitLog"("typeId");
