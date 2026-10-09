-- SyncRun: fan-out (sync-source) bosqichini kuzatish va osilib qolgan run'ni aniqlash.
ALTER TABLE "SyncRun" ADD COLUMN "sourcesTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "sourcesDone" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "sourcesFailed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "progressAt" TIMESTAMP(3);
