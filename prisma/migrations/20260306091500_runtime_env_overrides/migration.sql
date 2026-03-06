CREATE TABLE "RuntimeEnvOverride" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "valueText" TEXT,
    "valueEncrypted" TEXT,
    "valueHint" TEXT,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "RuntimeEnvOverride_isSecret_idx" ON "RuntimeEnvOverride"("isSecret");
CREATE INDEX "RuntimeEnvOverride_updatedAt_idx" ON "RuntimeEnvOverride"("updatedAt");
