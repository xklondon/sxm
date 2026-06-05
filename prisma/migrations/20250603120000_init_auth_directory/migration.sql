-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "canLogin" BOOLEAN NOT NULL,
    "canOwnTables" BOOLEAN NOT NULL,
    "canPlay" BOOLEAN NOT NULL,
    "canInvite" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "invitedAt" TIMESTAMPTZ(3),
    "invitedBy" TEXT,
    "lastLoginAt" TIMESTAMPTZ(3),
    "userId" UUID,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MagicLink" (
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),

    CONSTRAINT "MagicLink_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "MagicLinkCooldown" (
    "email" TEXT NOT NULL,
    "lastAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MagicLinkCooldown_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "TableInvite" (
    "id" UUID NOT NULL,
    "tableId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "invitedName" TEXT NOT NULL,
    "inviterUserId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TableInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetPersonId" TEXT NOT NULL,
    "detail" TEXT NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Person_email_key" ON "Person"("email");

-- CreateIndex
CREATE INDEX "MagicLink_email_idx" ON "MagicLink"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TableInvite_token_key" ON "TableInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "TableInvite_tableId_id_key" ON "TableInvite"("tableId", "id");

-- CreateIndex
CREATE INDEX "TableInvite_tableId_idx" ON "TableInvite"("tableId");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at" DESC);

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
