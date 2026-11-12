-- CreateTable
CREATE TABLE "UploadedFile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "ext" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "uploaderId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RafflePrize" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "imageFileId" INTEGER,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "stock" INTEGER NOT NULL DEFAULT -1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RaffleRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "prizeId" INTEGER NOT NULL,
    "prizeName" TEXT NOT NULL,
    "fanId" INTEGER,
    "fanNickname" TEXT,
    "operatorId" INTEGER,
    "operatorName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "UploadedFile_storageKey_key" ON "UploadedFile"("storageKey");

-- CreateIndex
CREATE INDEX "UploadedFile_category_idx" ON "UploadedFile"("category");

-- CreateIndex
CREATE UNIQUE INDEX "RafflePrize_name_key" ON "RafflePrize"("name");

-- CreateIndex
CREATE INDEX "RafflePrize_enabled_stock_idx" ON "RafflePrize"("enabled", "stock");

-- CreateIndex
CREATE INDEX "RaffleRecord_prizeId_createdAt_idx" ON "RaffleRecord"("prizeId", "createdAt");

-- CreateIndex
CREATE INDEX "RaffleRecord_fanId_createdAt_idx" ON "RaffleRecord"("fanId", "createdAt");
