-- CreateTable
CREATE TABLE "GameSave" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "gameKey" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "score" INTEGER,
    "platform" TEXT NOT NULL DEFAULT 'pc',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GameRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "gameKey" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "detail" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'pc',
    "finishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "GameSave_gameKey_idx" ON "GameSave"("gameKey");

-- CreateIndex
CREATE UNIQUE INDEX "GameSave_userId_gameKey_key" ON "GameSave"("userId", "gameKey");

-- CreateIndex
CREATE INDEX "GameRecord_gameKey_score_idx" ON "GameRecord"("gameKey", "score");

-- CreateIndex
CREATE INDEX "GameRecord_userId_gameKey_idx" ON "GameRecord"("userId", "gameKey");
