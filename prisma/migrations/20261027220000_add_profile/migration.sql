ALTER TABLE "User" ADD COLUMN "bio" TEXT, ADD COLUMN "passwordChangedAt" TIMESTAMP(3), ADD COLUMN "avatarFileId" INTEGER;
CREATE UNIQUE INDEX "User_avatarFileId_key" ON "User"("avatarFileId");
ALTER TABLE "User" ADD CONSTRAINT "User_avatarFileId_fkey" FOREIGN KEY ("avatarFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
