-- Add positionLog column for worker breadcrumb trail
ALTER TABLE "Session" ADD COLUMN "positionLog" TEXT;

-- Administrator role for session management dashboard
CREATE TABLE "Administrator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
