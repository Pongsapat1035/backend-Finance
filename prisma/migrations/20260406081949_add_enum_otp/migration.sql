/*
  Warnings:

  - Added the required column `purpose` to the `Otp` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OtpType" AS ENUM ('verify_email');

-- AlterTable
ALTER TABLE "Otp" ADD COLUMN     "purpose" "OtpType" NOT NULL;
