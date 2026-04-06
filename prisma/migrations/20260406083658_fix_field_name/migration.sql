/*
  Warnings:

  - You are about to drop the column `expireDate` on the `Otp` table. All the data in the column will be lost.
  - You are about to drop the column `emailVerity` on the `User` table. All the data in the column will be lost.
  - Added the required column `expireAt` to the `Otp` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Otp" DROP COLUMN "expireDate",
ADD COLUMN     "expireAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "emailVerity",
ADD COLUMN     "emailVerify" BOOLEAN NOT NULL DEFAULT false;
