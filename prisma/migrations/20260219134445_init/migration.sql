-- CreateIndex
CREATE INDEX "CaptureItem_status_idx" ON "CaptureItem"("status");

-- CreateIndex
CREATE INDEX "CaptureItem_type_idx" ON "CaptureItem"("type");

-- CreateIndex
CREATE INDEX "CaptureItem_createdAt_idx" ON "CaptureItem"("createdAt");

-- CreateIndex
CREATE INDEX "CaptureItem_projectId_idx" ON "CaptureItem"("projectId");

-- CreateIndex
CREATE INDEX "CaptureItem_pinned_idx" ON "CaptureItem"("pinned");

-- CreateIndex
CREATE INDEX "CaptureItem_priority_idx" ON "CaptureItem"("priority");

-- CreateIndex
CREATE INDEX "CaptureItem_assignedTo_idx" ON "CaptureItem"("assignedTo");

-- CreateIndex
CREATE INDEX "CaptureItem_processedAt_idx" ON "CaptureItem"("processedAt");

-- CreateIndex
CREATE INDEX "CaptureItem_updatedAt_idx" ON "CaptureItem"("updatedAt");

-- CreateIndex
CREATE INDEX "CaptureItem_status_pinned_createdAt_idx" ON "CaptureItem"("status", "pinned", "createdAt");

-- CreateIndex
CREATE INDEX "CaptureItem_status_createdAt_idx" ON "CaptureItem"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CaptureItem_status_type_idx" ON "CaptureItem"("status", "type");

-- CreateIndex
CREATE INDEX "CaptureItem_status_priority_idx" ON "CaptureItem"("status", "priority");

-- CreateIndex
CREATE INDEX "CaptureItem_status_assignedTo_idx" ON "CaptureItem"("status", "assignedTo");

-- CreateIndex
CREATE INDEX "CaptureItem_createdAt_status_idx" ON "CaptureItem"("createdAt", "status");

-- CreateIndex
CREATE INDEX "ConnectedDevice_socketId_idx" ON "ConnectedDevice"("socketId");

-- CreateIndex
CREATE INDEX "ConnectedDevice_lastSeen_idx" ON "ConnectedDevice"("lastSeen");

-- CreateIndex
CREATE INDEX "ItemLink_sourceId_idx" ON "ItemLink"("sourceId");

-- CreateIndex
CREATE INDEX "ItemLink_targetId_idx" ON "ItemLink"("targetId");

-- CreateIndex
CREATE INDEX "ItemLink_relationType_idx" ON "ItemLink"("relationType");
