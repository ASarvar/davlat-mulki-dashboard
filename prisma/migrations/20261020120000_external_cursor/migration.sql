-- Tashqi jadval kursorlari: online-ijara `auction_logs` ni qayerigacha o'qiganimiz.
CREATE TABLE "ExternalCursor" (
    "key" TEXT NOT NULL,
    "lastId" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalCursor_pkey" PRIMARY KEY ("key")
);
