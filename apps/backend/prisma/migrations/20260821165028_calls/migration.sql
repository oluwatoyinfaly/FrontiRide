-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'ACCEPTED', 'DECLINED', 'ENDED', 'MISSED');

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "callerId" TEXT NOT NULL,
    "calleeId" TEXT NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'RINGING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Call_calleeId_status_idx" ON "Call"("calleeId", "status");

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
