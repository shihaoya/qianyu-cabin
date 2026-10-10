-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BenefitReason" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'common',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BenefitReason" ("createdAt", "id", "text", "updatedAt") SELECT "createdAt", "id", "text", "updatedAt" FROM "BenefitReason";
DROP TABLE "BenefitReason";
ALTER TABLE "new_BenefitReason" RENAME TO "BenefitReason";
CREATE UNIQUE INDEX "BenefitReason_text_key" ON "BenefitReason"("text");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
