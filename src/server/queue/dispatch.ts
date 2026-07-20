import { getBoss } from "./boss";
import { QUEUE, type PropertyBaseJob, type StatusCheckJob, type SyncSourceJob } from "./jobs";

// Idempotentlik: singletonKey bir xil kalitli ikkinchi jobни navbatga qo'ymaydi.

export async function enqueueSyncSources(jobs: SyncSourceJob[]): Promise<void> {
  const boss = await getBoss();
  await boss.insert(
    jobs.map((data) => ({
      name: QUEUE.SYNC_SOURCE,
      data,
      singletonKey: `ss:${data.syncRunId}:${data.sourceId}`,
    })),
  );
}

// Fan-out: property-base joblarини bulk insert (80k uchun tez).
export async function insertPropertyBaseBulk(jobs: PropertyBaseJob[]): Promise<void> {
  const boss = await getBoss();
  await boss.insert(
    jobs.map((data) => ({
      name: QUEUE.PROPERTY_BASE,
      data,
      singletonKey: `pb:${data.cadNumber}`,
    })),
  );
}

export async function enqueuePropertyBase(job: PropertyBaseJob): Promise<void> {
  const boss = await getBoss();
  await boss.send(QUEUE.PROPERTY_BASE, job, { singletonKey: `pb:${job.cadNumber}` });
}

export async function enqueueStatusCheck(job: StatusCheckJob): Promise<void> {
  const boss = await getBoss();
  await boss.send(QUEUE.STATUS_CHECK, job, { singletonKey: `sc:${job.cadNumber}` });
}
