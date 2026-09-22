-- CreateTable
CREATE TABLE "GoogleOAuthAuthorization" (
    "id" SERIAL NOT NULL,
    "stateHash" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleOAuthAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleOAuthAuthorization_stateHash_key" ON "GoogleOAuthAuthorization"("stateHash");

-- CreateIndex
CREATE INDEX "GoogleOAuthAuthorization_expiresAt_idx" ON "GoogleOAuthAuthorization"("expiresAt");
