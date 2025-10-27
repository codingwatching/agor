# Async Jobs & Long-Running Operations

**Status:** ✅ Resolved - Not Needed
**Created:** 2025-10-06
**Updated:** 2025-10-26
**Archived:** 2025-10-26
**Context:** Session creation, repo cloning, and worktree setup can take 10s+ for large repos

## TL;DR - Not Needed for Agor

**For Agor (local dev tool):**

Background job queues are **not necessary**. Use simple patterns instead:

1. **Background threads** - Node.js async functions for I/O-bound operations
2. **WebSocket events** - Real-time progress updates (already implemented)
3. **Subprocesses** - Only if truly needed for CPU-intensive work or isolation

**Key insight:** Agor is a local dev tool, not a multi-tenant SaaS. No job queue infrastructure needed. Fire-and-forget async functions + WebSocket broadcasting is sufficient.

## Problem Statement

Several Agor operations are long-running and blocking:

### Current Long-Running Operations

1. **Session Creation with New Repo**
   - Clone git repository (can be GBs, take minutes)
   - Create initial worktree
   - Initialize database records
   - **Current UX:** Blocks UI with loading spinner

2. **Session Creation with New Worktree**
   - Create git worktree from existing repo
   - Checkout branch/commit
   - Initialize session database record
   - **Current UX:** ~5-30s spinner

3. **Claude Code Session Import** (`agor session load-claude`)
   - Parse JSONL transcript (can be 100k+ lines)
   - Extract tasks from messages
   - Bulk insert 1000s of messages (batched at 100)
   - Bulk insert 100s of tasks (batched at 100)
   - **Current UX:** CLI progress output, ~10-60s

4. **Future: Report Generation**
   - Analyze session messages and tool uses
   - Generate markdown reports with code snippets
   - Potentially run LLM summarization
   - **Expected:** 30s - 5min depending on session size

5. **Future: Multi-Session Operations**
   - Bulk session imports from Claude Code projects
   - Session tree traversal and analysis
   - Cross-session concept extraction

## Current Approach

**Synchronous HTTP/WebSocket requests with client-side loading states**

### CLI

```typescript
// Current: Synchronous with progress logging
this.log(chalk.dim('Cloning repository...'));
await client.service('repos').create({ remote_url });
this.log(chalk.green('✓ Repository cloned'));
```

### UI

```typescript
// Current: Loading spinner blocks entire modal
const [loading, setLoading] = useState(false);
const handleCreate = async () => {
  setLoading(true);
  await createSession(config); // Can take 30s+
  setLoading(false);
};
```

**Issues:**

- ❌ HTTP request timeout (default 30s in most frameworks)
- ❌ No progress updates during operation
- ❌ Browser tab must stay open
- ❌ No retry/resume on failure
- ❌ Blocks daemon from handling other requests

## Architecture Options

### Option 0: Fire-and-Forget with WebSocket Events (Recommended for Local Dev Tools)

**Pattern:** Async function + WebSocket events for progress (no job queue needed)

```typescript
// Service method - returns immediately
async create(data: CreateRepoData) {
  const repoId = generateId();

  // Create DB record with status='cloning'
  const repo = await reposRepo.create({
    repo_id: repoId,
    remote_url: data.remote_url,
    status: 'cloning',
  });

  // Start async work (don't await! runs in background)
  this.cloneRepoAsync(repoId, data.remote_url).catch(err => {
    console.error('Clone failed:', err);
  });

  // Return 200 immediately
  return repo;
}

// Async work function - emits WebSocket events
private async cloneRepoAsync(repoId: string, url: string) {
  try {
    // Emit progress events (broadcasts to all connected clients)
    this.emit('progress', {
      repo_id: repoId,
      stage: 'cloning',
      percent: 0
    });

    await git.clone(url, `~/.agor/repos/${repoId}`);

    this.emit('progress', {
      repo_id: repoId,
      stage: 'cloning',
      percent: 100
    });

    // Update DB status
    await reposRepo.update(repoId, { status: 'ready' });

    // Emit completion event (FeathersJS broadcasts to all clients)
    this.emit('patched', { repo_id: repoId, status: 'ready' });

  } catch (error) {
    await reposRepo.update(repoId, {
      status: 'failed',
      error: error.message
    });
    this.emit('patched', {
      repo_id: repoId,
      status: 'failed',
      error: error.message
    });
  }
}
```

**Client side (UI):**

```typescript
// Create repo - returns immediately with status='cloning'
const repo = await client.service('repos').create({
  remote_url: 'https://github.com/large/repo',
});

// Listen for progress events
client.service('repos').on('progress', event => {
  if (event.repo_id === repo.repo_id) {
    setProgress(event.percent);
    setStage(event.stage);
  }
});

// Listen for completion via standard FeathersJS 'patched' event
client.service('repos').on('patched', updatedRepo => {
  if (updatedRepo.repo_id === repo.repo_id) {
    if (updatedRepo.status === 'ready') {
      message.success('Repo cloned!');
      onComplete(updatedRepo);
    } else if (updatedRepo.status === 'failed') {
      message.error(`Clone failed: ${updatedRepo.error}`);
    }
  }
});
```

**Alternative: Increased Timeouts (Even Simpler)**

For operations <10 minutes, just increase HTTP timeouts:

```typescript
// apps/agor-daemon/src/index.ts
server.timeout = 10 * 60 * 1000; // 10 minutes

// Keep synchronous approach, no async needed
async create(data: CreateRepoData) {
  const repo = await reposRepo.create(data);

  // This blocks the HTTP request, but that's fine for <10min
  await git.clone(data.remote_url, repo.path);

  await reposRepo.update(repo.repo_id, { status: 'ready' });

  return repo;
}
```

**When to use which:**

- **Increased timeouts**: Operations <10 minutes, single-user dev tool
- **Fire-and-forget + WebSockets**: Operations >10 minutes OR want real-time progress
- **Full job queue (Options 1-3)**: Multi-tenant SaaS, need job history/retry/resume

**Pros:**

- ✅ Simplest async approach (no job queue, no polling)
- ✅ Uses existing FeathersJS WebSocket infrastructure
- ✅ Real-time progress updates
- ✅ Non-blocking HTTP responses
- ✅ Multiple operations can run in parallel
- ✅ Client can disconnect/reconnect (state persisted in DB)
- ✅ No additional dependencies
- ✅ Perfect for local dev tools

**Cons:**

- ❌ No job queue/history (but you have repos/sessions records)
- ❌ No built-in retry (but user can just click "create" again)
- ❌ Operation lost if daemon crashes mid-operation (acceptable for dev tool)
- ❌ Not suitable for multi-tenant production (no resource isolation)

**Key Insight:**

Node.js event loop handles concurrency automatically. Multiple `cloneRepoAsync()` calls run in parallel without blocking each other or the HTTP server. No need for subprocesses unless:

- Operation is CPU-intensive (blocks event loop)
- Need process isolation (crash shouldn't take down daemon)
- Need to kill/cancel mid-operation

For I/O-bound operations (git clone, file parsing, database writes), async functions are sufficient.

### Option 1: Background Jobs with Status Polling

**Pattern:** Job queue + polling for status updates

```typescript
// 1. Client submits job
const job = await client.service('jobs').create({
  type: 'create-session',
  config: {
    /* session config */
  },
});

// 2. Poll for job status
const poller = setInterval(async () => {
  const status = await client.service('jobs').get(job.job_id);

  if (status.status === 'completed') {
    clearInterval(poller);
    onSuccess(status.result);
  } else if (status.status === 'failed') {
    clearInterval(poller);
    onError(status.error);
  } else {
    // Update progress UI
    updateProgress(status.progress);
  }
}, 1000);

// 3. Job runs in background
async function processJob(job) {
  await updateJobStatus(job.job_id, 'running', { progress: 0 });

  // Clone repo
  await cloneRepo(job.config.gitUrl);
  await updateJobStatus(job.job_id, 'running', { progress: 50 });

  // Create worktree
  await createWorktree(job.config.worktreeName);
  await updateJobStatus(job.job_id, 'running', { progress: 75 });

  // Create session
  const session = await createSession(job.config);
  await updateJobStatus(job.job_id, 'completed', { result: session });
}
```

**Implementation:**

- Add `jobs` table with `job_id`, `type`, `status`, `progress`, `result`, `error`
- Add `/jobs` FeathersJS service
- Add background worker (simple Node.js event loop or `node-cron`)
- WebSocket events for job progress: `jobs.patched` → update UI

**Pros:**

- ✅ Simple to implement with existing FeathersJS + Drizzle
- ✅ Works with current tech stack
- ✅ No additional dependencies
- ✅ Progress updates via WebSocket
- ✅ Client can reconnect and resume polling

**Cons:**

- ❌ Polling overhead (can mitigate with exponential backoff)
- ❌ Jobs lost on daemon restart (can persist to DB)
- ❌ No distributed workers (fine for single-user local daemon)

### Option 2: WebSocket Streaming with Server-Sent Progress

**Pattern:** Long-lived WebSocket connection with progress events

```typescript
// Client subscribes to job stream
const jobStream = client.service('sessions').create({
  mode: 'stream',
  config: {
    /* session config */
  },
});

jobStream.on('progress', event => {
  // { stage: 'cloning', percent: 45, message: 'Cloning repository...' }
  updateProgress(event);
});

jobStream.on('completed', session => {
  onSuccess(session);
});

jobStream.on('error', error => {
  onError(error);
});
```

**Implementation:**

- Extend FeathersJS services with streaming support
- Emit progress events during long operations
- Client handles real-time updates

**Pros:**

- ✅ Real-time progress updates
- ✅ No polling overhead
- ✅ Natural fit with FeathersJS WebSocket architecture

**Cons:**

- ❌ Connection must stay alive (client can't disconnect and resume)
- ❌ More complex error handling (connection drops)
- ❌ Doesn't persist job state for restarts

### Option 3: BullMQ / Redis Queue (Production Scale)

**Pattern:** Distributed job queue with Redis backend

```typescript
import { Queue, Worker } from 'bullmq';

// Add job to queue
const sessionQueue = new Queue('sessions', { connection: redisConfig });
const job = await sessionQueue.add('create', sessionConfig);

// Worker processes jobs
const worker = new Worker(
  'sessions',
  async job => {
    await job.updateProgress(0);
    await cloneRepo(job.data.gitUrl);
    await job.updateProgress(50);
    // ...
  },
  { connection: redisConfig }
);

// Listen for progress
job.on('progress', progress => {
  console.log(`Job progress: ${progress}%`);
});
```

**Pros:**

- ✅ Production-grade job queue
- ✅ Distributed workers (horizontal scaling)
- ✅ Retry, rate limiting, job prioritization
- ✅ Persistent jobs (survive restarts)
- ✅ Job history and metrics

**Cons:**

- ❌ Requires Redis dependency
- ❌ Overkill for single-user local daemon
- ❌ More infrastructure complexity

### Option 4: GitHub Actions / External CI (For Specific Jobs)

**Pattern:** Offload heavy jobs to external runners

```typescript
// Trigger GitHub Action to clone large repo
await octokit.actions.createWorkflowDispatch({
  workflow_id: 'clone-repo.yml',
  inputs: { repo_url: 'https://github.com/large/repo' },
});

// Poll GitHub API for completion
// Download artifacts when done
```

**Use Cases:**

- Very large repo clones (>10GB)
- CPU-intensive report generation
- Multi-session batch imports

**Pros:**

- ✅ Offloads heavy work from user's machine
- ✅ Leverages existing CI infrastructure

**Cons:**

- ❌ Requires GitHub account + setup
- ❌ Network dependency
- ❌ Slower for small operations

## Recommendation: Pragmatic Approach for Local Dev Tools

### Phase 1: Increased Timeouts (Current - Simplest)

For **local dev tool** where users are admins and control the machine:

- Increase HTTP timeout to 10 minutes: `server.timeout = 10 * 60 * 1000`
- Keep synchronous operations - blocking is fine for <10min
- Add progress logging in CLI
- Show loading spinners in UI
- **Good enough for:** Worktree creation, small/medium repo clones, session imports
- **Trade-off:** HTTP request blocks, but that's acceptable for single-user dev tool

### Phase 2: Fire-and-Forget with WebSocket Events (Recommended Next Step)

For operations that benefit from real-time progress or >10 minutes:

- Implement **Option 0** pattern (see above)
- Service returns immediately with `status='pending'`
- Async function runs in background, emits progress events
- Client listens to WebSocket events for updates
- **Unlocks:** Real-time progress bars, non-blocking UI, parallel operations
- **Effort:** 2-4 hours (no new tables, no workers, just async functions)

### Phase 3: Full Job Queue (Only If Needed)

**Only implement if:**

- Building multi-tenant SaaS (need resource isolation)
- Operations routinely take hours (need job history/retry)
- Need job scheduling/cron (periodic reports, cleanup tasks)

**Don't implement for:**

- ✅ Local dev tool (you are here!)
- ✅ Single-user daemon
- ✅ Operations <30 minutes

### Phase 4: Distributed Queue (Probably Never)

- Add BullMQ + Redis for horizontal scaling
- **Only if:** Supporting multi-tenant cloud deployment with 1000s of users
- **For Agor:** Likely not needed (local dev tool)

## Implementation Guides

### Quick Start: Fire-and-Forget Pattern (Phase 2)

**Example: Async repo cloning with WebSocket events**

```typescript
// apps/agor-daemon/src/services/repos/repos.class.ts

export class ReposService extends KnexService<Repo> {
  async create(data: CreateRepoData) {
    const repoId = generateId();

    // Create DB record immediately
    const repo = await super.create({
      repo_id: repoId,
      remote_url: data.remote_url,
      status: 'cloning', // Set initial status
    });

    // Start async work (don't await!)
    this.cloneAsync(repoId, data.remote_url).catch(err => {
      console.error('Clone failed:', err);
    });

    // Return immediately
    return repo;
  }

  private async cloneAsync(repoId: string, url: string) {
    try {
      // Emit progress
      this.emit('progress', { repo_id: repoId, stage: 'cloning', percent: 0 });

      // Do the work
      const path = `~/.agor/repos/${repoId}`;
      await git.clone(url, path);

      this.emit('progress', { repo_id: repoId, stage: 'cloning', percent: 100 });

      // Update DB
      await this.patch(repoId, { status: 'ready', path });

      // FeathersJS broadcasts 'patched' event to all clients automatically
    } catch (error) {
      await this.patch(repoId, { status: 'failed', error: error.message });
    }
  }
}
```

**Client (UI):**

```typescript
// Create repo - returns immediately
const repo = await client.service('repos').create({ remote_url });

// Listen for events
client.service('repos').on('progress', e => {
  if (e.repo_id === repo.repo_id) setProgress(e.percent);
});

client.service('repos').on('patched', updated => {
  if (updated.repo_id === repo.repo_id && updated.status === 'ready') {
    message.success('Clone complete!');
  }
});
```

**That's it!** No job table, no workers, no polling.

### Full Job Queue Implementation (Phase 3 - Only If Needed)

### 1. Database Schema

```typescript
// packages/core/src/db/schema/jobs.ts
export const jobs = sqliteTable('jobs', {
  job_id: text('job_id').primaryKey(),
  type: text('type').notNull(), // 'create-session', 'clone-repo', 'import-transcript'
  status: text('status').notNull(), // 'pending', 'running', 'completed', 'failed'
  progress: integer('progress').default(0), // 0-100
  data: text('data', { mode: 'json' }), // Job input config
  result: text('result', { mode: 'json' }), // Job output
  error: text('error'), // Error message if failed
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
  started_at: integer('started_at', { mode: 'timestamp' }),
  completed_at: integer('completed_at', { mode: 'timestamp' }),
});
```

### 2. FeathersJS Service

```typescript
// apps/agor-daemon/src/services/jobs/jobs.service.ts
export class JobsService implements ServiceMethods<Job> {
  async create(data: CreateJobData) {
    const job = await jobsRepo.create({
      type: data.type,
      status: 'pending',
      data: data.config,
    });

    // Enqueue for processing
    jobQueue.push(job);

    return job;
  }

  async get(id: JobID) {
    return await jobsRepo.findById(id);
  }
}
```

### 3. Background Worker

```typescript
// apps/agor-daemon/src/workers/job-processor.ts
const jobQueue: Job[] = [];

async function processQueue() {
  while (true) {
    const job = jobQueue.shift();
    if (!job) {
      await sleep(1000);
      continue;
    }

    try {
      await updateJob(job.job_id, { status: 'running', started_at: new Date() });

      const result = await executeJob(job);

      await updateJob(job.job_id, {
        status: 'completed',
        result,
        completed_at: new Date(),
      });

      // Emit WebSocket event
      app.service('jobs').emit('patched', job);
    } catch (error) {
      await updateJob(job.job_id, {
        status: 'failed',
        error: error.message,
        completed_at: new Date(),
      });
    }
  }
}

processQueue(); // Start worker loop
```

### 4. UI Integration

```typescript
// apps/agor-ui/src/hooks/useJobProgress.ts
export function useJobProgress(jobId: string) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<JobStatus>('pending');

  useEffect(() => {
    const jobsService = client.service('jobs');

    const handleJobUpdate = (job: Job) => {
      if (job.job_id === jobId) {
        setProgress(job.progress || 0);
        setStatus(job.status);
      }
    };

    jobsService.on('patched', handleJobUpdate);

    return () => {
      jobsService.removeListener('patched', handleJobUpdate);
    };
  }, [jobId]);

  return { progress, status };
}
```

## Current Tech Stack Compatibility

**FeathersJS:**

- ✅ Built-in WebSocket support for real-time updates
- ✅ Service events (`created`, `patched`) perfect for job status
- ✅ Easy to add new `/jobs` service

**Drizzle + LibSQL:**

- ✅ Can persist jobs to SQLite
- ✅ Supports JSON columns for job data/result
- ✅ Fast queries for job status lookup

**React + Ant Design:**

- ✅ `<Progress />` component for progress bars
- ✅ `<Spin />` for loading states
- ✅ `message.loading()` for inline notifications

**Node.js:**

- ✅ Simple event loop for background worker
- ✅ No additional runtime needed
- ✅ Can use `setInterval()` or `while(true)` loop

## Next Steps (Pragmatic Path)

1. **Immediate (Phase 1):** Increase HTTP timeout to 10 minutes in daemon

   ```typescript
   // apps/agor-daemon/src/index.ts
   server.timeout = 10 * 60 * 1000;
   ```

2. **Short-term (Phase 2):** Add fire-and-forget pattern for repo cloning
   - Returns immediately with `status='cloning'`
   - Async function emits `progress` events via WebSocket
   - Emits `patched` event on completion
   - Effort: ~2-4 hours

3. **Medium-term:** Add progress logging to CLI operations
   - Session import: show % progress as messages are inserted
   - Repo clone: show git clone output

4. **Long-term (Only if building SaaS):** Full job queue with history/retry
   - Probably not needed for local dev tool!

## References

- BullMQ: https://docs.bullmq.io/
- FeathersJS Real-time: https://feathersjs.com/api/events.html
- Job Queue Patterns: https://www.enterpriseintegrationpatterns.com/patterns/messaging/
