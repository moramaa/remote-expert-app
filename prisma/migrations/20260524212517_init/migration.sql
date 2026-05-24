-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "vendor" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Expert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "yearsExperience" INTEGER NOT NULL,
    "languages" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ExpertCertification" (
    "expertId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,

    PRIMARY KEY ("expertId", "machineId"),
    CONSTRAINT "ExpertCertification_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "Expert" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExpertCertification_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "factory" TEXT NOT NULL,
    "roleLevel" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
