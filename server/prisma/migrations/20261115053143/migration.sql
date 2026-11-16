-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BenefitType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDrawCount" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BenefitType" ("createdAt", "description", "id", "name", "updatedAt") SELECT "createdAt", "description", "id", "name", "updatedAt" FROM "BenefitType";
DROP TABLE "BenefitType";
ALTER TABLE "new_BenefitType" RENAME TO "BenefitType";
CREATE UNIQUE INDEX "BenefitType_name_key" ON "BenefitType"("name");
CREATE TABLE "new_RaffleRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "prizeId" INTEGER NOT NULL,
    "prizeName" TEXT NOT NULL,
    "fanId" INTEGER,
    "fanNickname" TEXT,
    "operatorId" INTEGER,
    "operatorName" TEXT,
    "drawnBy" TEXT NOT NULL DEFAULT 'host',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_RaffleRecord" ("createdAt", "fanId", "fanNickname", "id", "operatorId", "operatorName", "prizeId", "prizeName") SELECT "createdAt", "fanId", "fanNickname", "id", "operatorId", "operatorName", "prizeId", "prizeName" FROM "RaffleRecord";
DROP TABLE "RaffleRecord";
ALTER TABLE "new_RaffleRecord" RENAME TO "RaffleRecord";
CREATE INDEX "RaffleRecord_prizeId_createdAt_idx" ON "RaffleRecord"("prizeId", "createdAt");
CREATE INDEX "RaffleRecord_fanId_createdAt_idx" ON "RaffleRecord"("fanId", "createdAt");
CREATE INDEX "RaffleRecord_drawnBy_createdAt_idx" ON "RaffleRecord"("drawnBy", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
