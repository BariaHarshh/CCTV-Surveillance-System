/** Async queue abstraction — swap for Redis/BullMQ without redesign */
export interface QueueJob<T> {
  id: string;
  type: string;
  payload: T;
  createdAt: Date;
}

type JobHandler<T> = (job: QueueJob<T>) => Promise<void>;

class InMemoryQueue<T> {
  private handlers = new Map<string, JobHandler<T>>();
  private processing = false;

  register(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler);
  }

  async enqueue(type: string, payload: T): Promise<string> {
    const job: QueueJob<T> = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      payload,
      createdAt: new Date(),
    };
    setImmediate(() => this.process(job));
    return job.id;
  }

  private async process(job: QueueJob<T>): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) return;
    try {
      await handler(job);
    } catch (e) {
      console.error(`[Queue] ${job.type} failed:`, e);
    }
  }
}

export const detectionQueue = new InMemoryQueue<Record<string, unknown>>();
export const eventQueue = new InMemoryQueue<Record<string, unknown>>();
export const riskQueue = new InMemoryQueue<Record<string, unknown>>();

export const queueMetrics = {
  detectionJobs: 0,
  eventJobs: 0,
  failedJobs: 0,
  lastProcessedAt: null as Date | null,
};
