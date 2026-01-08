// src/storage/StorageLock.ts
/**
 * StorageLock - Mutex implementation for concurrent storage operations
 * 
 * Prevents race conditions during parallel saves, imports, and cloud syncs.
 * Uses a simple async lock pattern with queue management.
 */

type LockCallback<T> = () => Promise<T>;

interface QueuedOperation<T> {
    operation: LockCallback<T>;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
    operationName: string;
    timestamp: number;
}

class StorageLock {
    private static instance: StorageLock;
    private isLocked = false;
    private queue: QueuedOperation<any>[] = [];
    private currentOperation: string | null = null;
    private lockAcquiredAt: number | null = null;
    private readonly LOCK_TIMEOUT = 30000; // 30 seconds max lock hold time

    private constructor() { }

    static getInstance(): StorageLock {
        if (!StorageLock.instance) {
            StorageLock.instance = new StorageLock();
        }
        return StorageLock.instance;
    }

    /**
     * Execute operation with exclusive lock
     * Ensures only one write operation happens at a time
     */
    async withLock<T>(operationName: string, operation: LockCallback<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.queue.push({
                operation,
                resolve,
                reject,
                operationName,
                timestamp: Date.now()
            });

            console.log(`[StorageLock] Queued: ${operationName} (queue size: ${this.queue.length})`);
            this.processQueue();
        });
    }

    private async processQueue(): Promise<void> {
        if (this.isLocked || this.queue.length === 0) {
            return;
        }

        // Check for stuck lock
        if (this.lockAcquiredAt && Date.now() - this.lockAcquiredAt > this.LOCK_TIMEOUT) {
            console.error(`[StorageLock] TIMEOUT: Lock held for ${this.currentOperation} exceeded ${this.LOCK_TIMEOUT}ms. Force releasing.`);
            this.forceRelease();
        }

        const item = this.queue.shift();
        if (!item) return;

        this.isLocked = true;
        this.currentOperation = item.operationName;
        this.lockAcquiredAt = Date.now();

        console.log(`[StorageLock] Acquired: ${item.operationName}`);

        try {
            const result = await item.operation();
            const duration = Date.now() - this.lockAcquiredAt;
            console.log(`[StorageLock] Released: ${item.operationName} (${duration}ms)`);
            item.resolve(result);
        } catch (error) {
            console.error(`[StorageLock] Error in ${item.operationName}:`, error);
            item.reject(error instanceof Error ? error : new Error(String(error)));
        } finally {
            this.isLocked = false;
            this.currentOperation = null;
            this.lockAcquiredAt = null;

            // Process next in queue
            if (this.queue.length > 0) {
                // Use setImmediate equivalent to prevent stack overflow
                setTimeout(() => this.processQueue(), 0);
            }
        }
    }

    private forceRelease(): void {
        this.isLocked = false;
        this.currentOperation = null;
        this.lockAcquiredAt = null;
    }

    /**
     * Get current lock status (for debugging/telemetry)
     */
    getStatus(): { locked: boolean; currentOp: string | null; queueSize: number } {
        return {
            locked: this.isLocked,
            currentOp: this.currentOperation,
            queueSize: this.queue.length
        };
    }

    /**
     * Check if operation is safe to proceed (for read operations)
     */
    isWriteInProgress(): boolean {
        return this.isLocked;
    }
}

export const storageLock = StorageLock.getInstance();
export default storageLock;
