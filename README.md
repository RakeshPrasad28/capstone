# Flow: Distributed Workflow Automation Engine
**Airtribe Backend Engineering Launchpad — Capstone Project**  
**Author:** Rakesh Prasad  
**Repository:** [github.com/rakeshprasad/flow-workflow-engine](https://github.com/rakeshprasad/flow-workflow-engine)  

---

## Project Summary
This project is my capstone submission for the Airtribe Backend Engineering Launchpad. The goal was to build a distributed workflow orchestration backend (similar to Make or n8n) in Node.js that enables users to design, execute, monitor, and recover multi-step workflows connecting external services and APIs.


## Architecture Overview (HLD)

The system is decoupled into modular layers:
1. **API Gateway & Routing Layer**: Express.js server handling routing, JWT authentication, rate limiting, and request validation.
2. **Workflow Management**: Controls workflow lifecycle transitions (`DRAFT` <-> `PUBLISHED` <-> `PAUSED`) and immutability rules.
3. **Trigger Ingestion**:
   - **Webhook Trigger**: Generates public ingest URLs with secret-key header verification.
   - **Schedule Manager**: In-memory cron manager using `node-cron` with lifecycle hooks to register, pause, resume, and reschedule jobs.
4. **Execution Engine**:
   - Manages step traversals, variable interpolation, context accumulation, and branch evaluation (`trueBranch` vs `falseBranch`).
   - Executes automatic retries with exponential backoff on transient step failures.
5. **Node Registry (Pluggable Connectors)**: Modular registry allowing custom node executors to be added without modifying core engine logic.
6. **Persistence Layer**: Prisma ORM with SQLite (relational models with JSON storage for configs and runtime contexts)

```
                      +---------------------------------------+
                      |               Client                  |
                      +---------------------------------------+
                                          |
                   +----------------------+----------------------+
                   |                                             |
                   v (REST APIs)                                 v (Webhook / Schedule)
       +-----------------------+                     +-----------------------+
       |   Auth & Workflows    |                     |    Trigger Manager    |
       |  (Draft / Published)  |                     |  (Webhook / Cron)     |
       +-----------------------+                     +-----------------------+
                   |                                             |
                   +----------------------+----------------------+
                                          |
                                          v
                              +-----------------------+
                              |   Execution Engine    |
                              +-----------------------+
                                          |
                +-------------------------+-------------------------+
                |                         |                         |
                v                         v                         v
       +-----------------+       +-----------------+       +-----------------+
       |  Node Registry  |       | Context Storage |       |  Retry Handler  |
       |  - HTTP Request |       | (Interpolation) |       | (Exp. Backoff)  |
       |  - Condition    |       +-----------------+       +-----------------+
       |  - Delay        |
       |  - Notify       |
       +-----------------+
                |
                v
       +---------------------------------------------+
       |             Prisma / SQLite Database        |
       |  (Users, Workflows, Runs, StepLogs)         |
       +---------------------------------------------+
```

---

## Low-Level Design (LLD)

### 1. Workflow Lifecycle & State Machine
Workflows enforce strict execution and mutation rules:
- **DRAFT**:
  - The workflow is under construction and editable.
  - Cannot be triggered via webhooks, cron, or manual start.
- **PUBLISHED**:
  - The workflow definition (nodes, configs, branches) is frozen to guarantee idempotent, deterministic executions.
  - Ready for execution via manual trigger, webhook, or cron schedule.
  - Direct updates are blocked. To edit, the workflow must be reverted to `DRAFT` or cloned.
- **PAUSED**:
  - Temporarily suspends active schedules and rejects webhook requests with a `400` status.
  - Can be resumed back to `PUBLISHED` at any time.

```
       [ Create ]
           |
           v
       +-------+     Publish     +-----------+     Pause     +--------+
       | DRAFT | --------------> | PUBLISHED | ------------> | PAUSED |
       +-------+                 +-----------+               +--------+
           ^                           |                          |
           |          Revert           |          Resume          |
           +---------------------------+ <------------------------+
```

### 2. Node Connector Model
All nodes inherit from `BaseNode`:
- `type`: Node identifier string.
- `execute(config, context)`: Async execution method returning output objects.

#### Built-in Node Types:
- **HTTP_REQUEST**:
  - Executes GET, POST, PUT, PATCH, DELETE requests via Axios.
  - Supports deep interpolation of headers, URL parameters, and body payloads (e.g. `{{trigger.body.id}}` or `{{steps.step_1.data.url}}`).
- **CONDITION**:
  - Evaluates boolean expressions on JSON values extracted from previous steps or trigger payloads.
  - Supports operators: `==`, `===`, `!=`, `!==`, `>`, `>=`, `<`, `<=`, `contains`, `not_contains`, `exists`.
  - Determines subsequent branch routing: `trueBranch` vs `falseBranch`.
- **DELAY**:
  - Suspends execution for $N$ seconds non-blockingly using `setTimeout` promises.
- **NOTIFY**:
  - Formats and dispatches notifications to Slack incoming webhooks or alerts recipients with interpolated templates.

### 3. Context & Dynamic Interpolation
The `ExecutionContext` stores runtime state throughout a run:
- `trigger`: Data provided during trigger invocation (headers, query, body).
- `steps`: Hash map of outputs indexed by `nodeId`.
- `variables`: Workflow-level variables.

Syntax: `{{steps.<nodeId>.<path>}}` or `{{trigger.body.<path>}}`.

### 4. Failure Recovery & Retry Mechanism
- Transient node errors trigger up to $N$ automatic retries (default: 3).
- Exponential backoff algorithm:
  $$\text{Delay} = \text{RETRY\_DELAY\_MS} \times 2^{(\text{attempt} - 1)}$$
- Individual step attempts, errors, and durations are persisted into `StepLog`.
- If retries are exhausted, the workflow run is marked as `FAILED` and halts further step execution.

---

## Database Schema (Prisma)

The system uses SQLite (with seamless PostgreSQL compatibility):

```prisma
model User {
  id        String     @id @default(uuid())
  email     String     @unique
  password  String
  name      String?
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  workflows Workflow[]
}

model Workflow {
  id            String        @id @default(uuid())
  userId        String
  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  name          String
  description   String?
  status        String        @default("DRAFT")
  triggerType   String        @default("MANUAL")
  triggerConfig String        @default("{}")
  nodes         String        @default("[]")
  version       Int           @default(1)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  runs          WorkflowRun[]
}

model WorkflowRun {
  id             String    @id @default(uuid())
  workflowId     String
  workflow       Workflow  @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  status         String    @default("PENDING")
  triggerSource  String    @default("MANUAL")
  triggerPayload String?   @default("{}")
  startedAt      DateTime  @default(now())
  completedAt    DateTime?
  durationMs     Int?
  error          String?
  stepLogs       StepLog[]
}

model StepLog {
  id           String      @id @default(uuid())
  runId        String
  run          WorkflowRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  nodeId       String
  nodeType     String
  nodeName     String
  status       String
  inputData    String?
  outputData   String?
  errorMessage String?
  retryCount   Int         @default(0)
  startedAt    DateTime    @default(now())
  durationMs   Int?
}
```

---

## Project Structure

```
capstone/
├── .env
├── package.json
├── prisma/
│   ├── dev.db
│   └── schema.prisma
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   │   ├── database.js
│   │   └── env.js
│   ├── constants/
│   │   └── status.js
│   ├── engine/
│   │   ├── context.js
│   │   ├── executionEngine.js
│   │   ├── nodeRegistry.js
│   │   └── nodes/
│   │       ├── baseNode.js
│   │       ├── conditionNode.js
│   │       ├── delayNode.js
│   │       ├── httpRequestNode.js
│   │       └── notifyNode.js
│   ├── middlewares/
│   │   ├── auth.middleware.js
│   │   ├── errorHandler.middleware.js
│   │   ├── rateLimiter.middleware.js
│   │   └── validator.middleware.js
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.js
│   │   │   ├── auth.routes.js
│   │   │   ├── auth.service.js
│   │   │   └── auth.validation.js
│   │   ├── health/
│   │   │   ├── health.controller.js
│   │   │   └── health.routes.js
│   │   ├── runs/
│   │   │   ├── run.controller.js
│   │   │   ├── run.routes.js
│   │   │   └── run.service.js
│   │   ├── triggers/
│   │   │   ├── schedule.manager.js
│   │   │   ├── webhook.controller.js
│   │   │   └── webhook.routes.js
│   │   └── workflows/
│   │       ├── workflow.controller.js
│   │       ├── workflow.routes.js
│   │       ├── workflow.service.js
│   │       └── workflow.validation.js
│   └── utils/
│       └── expressionEvaluator.js
└── tests/
    └── test-flow.js
```

---

## API Reference

### 1. Health & System Metrics
- **GET** `/api/v1/health`
  - Returns server status, database latency, active cron schedules, supported node types, and memory usage.

### 2. Authentication
- **POST** `/api/v1/auth/register`
  - Body: `{ "email": "user@example.com", "password": "securepassword", "name": "User Name" }`
  - Response: `{ "success": true, "data": { "user": { ... }, "token": "<JWT>" } }`
- **POST** `/api/v1/auth/login`
  - Body: `{ "email": "user@example.com", "password": "securepassword" }`
  - Response: `{ "success": true, "data": { "token": "<JWT>" } }`
- **GET** `/api/v1/auth/me`
  - Headers: `Authorization: Bearer <JWT>`

### 3. Workflow Management
All routes require `Authorization: Bearer <JWT>`.

- **POST** `/api/v1/workflows`
  - Creates a workflow in `DRAFT` status.
  - Body:
    ```json
    {
      "name": "Order Ingestion Flow",
      "description": "Processes order notifications",
      "triggerType": "WEBHOOK",
      "triggerConfig": {
        "secretKey": "super_secret_webhook_key"
      },
      "nodes": [
        {
          "id": "step_1",
          "type": "HTTP_REQUEST",
          "name": "Fetch Customer",
          "config": {
            "url": "https://jsonplaceholder.typicode.com/users/1",
            "method": "GET"
          },
          "nextId": "step_2"
        },
        {
          "id": "step_2",
          "type": "CONDITION",
          "name": "Check User ID",
          "config": {
            "field": "steps.step_1.data.id",
            "operator": "==",
            "value": 1,
            "trueBranch": "step_3",
            "falseBranch": "step_4"
          }
        },
        {
          "id": "step_3",
          "type": "DELAY",
          "name": "Wait Before Notify",
          "config": { "seconds": 2 },
          "nextId": "step_4"
        },
        {
          "id": "step_4",
          "type": "NOTIFY",
          "name": "Slack Alert",
          "config": {
            "channel": "slack",
            "subject": "Processed",
            "message": "User {{steps.step_1.data.name}} verified"
          }
        }
      ]
    }
    ```
- **GET** `/api/v1/workflows`
  - Lists all workflows owned by the authenticated user.
- **GET** `/api/v1/workflows/:id`
  - Gets workflow definition and recent runs.
- **PUT** `/api/v1/workflows/:id`
  - Updates workflow definition (blocked if in `PUBLISHED` state).
- **DELETE** `/api/v1/workflows/:id`
  - Deletes workflow, unregisters cron jobs, and cascades runs.
- **POST** `/api/v1/workflows/:id/publish`
  - Transitions status from `DRAFT` to `PUBLISHED`.
  - Increments version number.
  - Registers schedule trigger with cron engine if triggerType is `SCHEDULE`.
- **POST** `/api/v1/workflows/:id/draft`
  - Reverts status back to `DRAFT` for editing.
- **POST** `/api/v1/workflows/:id/pause`
  - Suspends execution and cron jobs.
- **POST** `/api/v1/workflows/:id/resume`
  - Restores `PUBLISHED` status and re-engages scheduler.
- **POST** `/api/v1/workflows/:id/reschedule`
  - Body: `{ "cron": "*/10 * * * *" }`
  - Updates cron string and restarts scheduled runner.
- **POST** `/api/v1/workflows/:id/start`
  - Manually executes the published workflow immediately.

### 4. Trigger Ingestion
- **POST** `/api/v1/triggers/webhook/:workflowId`
  - Headers:
    - `x-webhook-secret: <secretKey>` (required if configured)
    - `x-wait-execution: true` (optional; if true, awaits execution and returns run output synchronously; defaults to async `202 Accepted`)
  - Body: Any custom JSON payload. Accessible in workflow nodes via `{{trigger.body.<key>}}`.

### 5. Execution Runs & Logs
- **GET** `/api/v1/runs/workflows/:workflowId`
  - Paginated list of historical execution runs for a workflow.
- **GET** `/api/v1/runs/:runId`
  - Full execution breakdown including:
    - Overall status (`COMPLETED`, `FAILED`, `RUNNING`)
    - Duration in milliseconds
    - Individual step logs: inputs snapshot, outputs snapshot, errors, retry count, and duration per node.

---

## Getting Started

### 1. Prerequisites
- Node.js (v18+)
- npm (v9+)

### 2. Installation
```bash
npm install
```

### 3. Initialize Database
```bash
npx prisma generate
npx prisma db push
```

### 4. Run Development Server
```bash
npm run dev
```
The server will start on `http://localhost:3000`.

### 5. Run Automated Verification Tests
```bash
npm test
```
The test suite executes the full end-to-end lifecycle:
- Registers a test user
- Authenticates and receives JWT
- Creates a `DRAFT` workflow with all 4 node types
- Verifies state guardrails (draft cannot run, published cannot mutate)
- Publishes the workflow
- Runs manual execution
- Triggers webhook with secret validation
- Verifies run history and step logs
- Pauses, guards, resumes, and reschedules the workflow

---

## Engineering Design Decisions & Trade-offs

1. **Why SQLite via Prisma instead of MongoDB or direct Postgres?**
   - Workflows have strict relational hierarchies (Users -> Workflows -> Runs -> StepLogs), but the individual node configs and step outputs vary dynamically.
   - Prisma ORM allowed strong typing and foreign-key referential integrity while letting us store arbitrary node configurations as serialized JSON.
   - Using SQLite means any reviewer or peer can clone the repository, run `npm install && npm test`, and have it pass immediately without having to configure local Docker containers or Postgres credentials. If we need to deploy to production, changing `provider = "sqlite"` to `"postgresql"` in `prisma/schema.prisma` takes 1 minute.

2. **Why Freeze `PUBLISHED` Workflows?**
   - A common pitfall in orchestrators is mutating node definitions while an asynchronous run or webhook is mid-flight. Freezing published workflows prevents race conditions and ensures execution idempotency. To make edits, the workflow must be transitioned back to `DRAFT`.

3. **Pluggable Node Registry Pattern:**
   - Rather than using an anti-pattern like a monolithic `switch (type)` statement inside the execution loop, each node type (`HTTP_REQUEST`, `CONDITION`, `DELAY`, `NOTIFY`) is encapsulated in its own class extending `BaseNode` and registered in `NodeRegistry`. Adding a new connector (e.g., SendGrid, MySQL, or OpenAI) only requires creating one file and registering it.

4. **Retry Strategy & Backoff:**
   - Transient network issues or rate limits are common with external HTTP nodes. The exponential backoff formula (`1s -> 2s -> 4s`) gives external services recovery time without overloading them.

5. **Future Roadmap:**
   - Moving from in-process asynchronous execution (`setImmediate`) to a dedicated persistent worker queue (like BullMQ / Redis) for distributed multi-server scale.
   - Visual drag-and-drop React flow builder frontend.

