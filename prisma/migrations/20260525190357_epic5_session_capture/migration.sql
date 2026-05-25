-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "durationSeconds" INTEGER,
    "resolvedExpert" BOOLEAN,
    "resolvedWorker" BOOLEAN,
    "summary" TEXT,
    "safetyTriggered" BOOLEAN NOT NULL DEFAULT false,
    "markerLog" TEXT,
    "instructionLog" TEXT,
    "transcriptLog" TEXT,
    "locationDept" TEXT,
    "locationLine" TEXT,
    "locationStation" TEXT
);
INSERT INTO "new_Session" ("durationSeconds", "endedAt", "expertId", "id", "machineId", "resolvedExpert", "resolvedWorker", "startedAt", "summary", "ticketId", "workerId") SELECT "durationSeconds", "endedAt", "expertId", "id", "machineId", "resolvedExpert", "resolvedWorker", "startedAt", "summary", "ticketId", "workerId" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE UNIQUE INDEX "Session_ticketId_key" ON "Session"("ticketId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
