-- AlterTable
ALTER TABLE "Session" ADD COLUMN "summary" TEXT;

-- CreateTable
CREATE TABLE "DeflectionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workerId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "suggestedSessionId" TEXT,
    "outcome" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
