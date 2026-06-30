# Firestore Security Specification and Adversarial Testing Spec (TDD)

This document establishes the security invariants for the workspace data model and provides 12 adversarial test payloads designed to probe for logic leaks.

## 1. Data Invariants

1. **Owner Exclusivity (No Co-ownership)**: All tasks, schedule items, preferences, and activity logs belong strictly to a single authenticated user. Any read or write operation must assert that the document's owner UID matches the authenticated caller's UID (`request.auth.uid`).
2. **Schema & State Integrity**:
   - Priority must strictly be one of: `"low"`, `"medium"`, `"high"`, `"urgent"`, `"critical"`.
   - Status must strictly be one of: `"pending"`, `"in-progress"`, `"completed"`.
   - Action must strictly be one of: `"completed"`, `"created"`, `"missed"`.
3. **Temporal Trust**: Timestamps (`createdAt`, `timestamp`) must always be verified against the official server clock (`request.time`) during document creation. Client-side timestamp injection is strictly blocked.
4. **ID Sanitization & Protection**: Document IDs must be within 128 characters and conform to safe alphanumeric patterns to prevent ID Poisoning or Denial of Wallet attacks.

---

## 2. The "Dirty Dozen" Adversarial Payloads

### Payload 1: Task Identity Spoofing
* **Target Path**: `tasks/task_1`
* **Intended Breach**: User `A` tries to create or modify a task designating User `B` as the owner.
* **Payload**:
  ```json
  {
    "userId": "user_B",
    "title": "Malicious Task",
    "description": "Spoofed Owner",
    "deadline": "2026-06-30T23:59:59Z",
    "estimatedEffort": 60,
    "priority": "medium",
    "category": "Work",
    "status": "pending",
    "subtasks": [],
    "createdAt": "request.time"
  }
  ```
* **Expected Result**: `PERMISSION_DENIED` (auth.uid !== data.userId)

### Payload 2: Task Priority Schema Poisoning
* **Target Path**: `tasks/task_2`
* **Intended Breach**: Create a task with an unlisted high priority to bypass dashboard filters.
* **Payload**:
  ```json
  {
    "userId": "user_A",
    "title": "Broken Task",
    "description": "Bypassing enum",
    "deadline": "2026-06-30T23:59:59Z",
    "estimatedEffort": 60,
    "priority": "omega-extreme",
    "category": "Work",
    "status": "pending",
    "subtasks": [],
    "createdAt": "request.time"
  }
  ```
* **Expected Result**: `PERMISSION_DENIED` (invalid enum)

### Payload 3: Denial of Wallet (Size Exhaustion)
* **Target Path**: `tasks/task_3`
* **Intended Breach**: Creating a task with an excessively large title (e.g. 500KB) to exceed storage limits.
* **Payload**:
  ```json
  {
    "userId": "user_A",
    "title": "[REPEATED A x 100000]",
    "description": "Large Payload",
    "deadline": "2026-06-30T23:59:59Z",
    "estimatedEffort": 60,
    "priority": "medium",
    "category": "Work",
    "status": "pending",
    "subtasks": [],
    "createdAt": "request.time"
  }
  ```
* **Expected Result**: `PERMISSION_DENIED` (title size exceeds limit of 256 chars)

### Payload 4: Schedule Ownership Hijacking
* **Target Path**: `schedule/sched_1`
* **Intended Breach**: User `A` writes a schedule item mapping to user `B`.
* **Payload**:
  ```json
  {
    "userId": "user_B",
    "taskId": "task_123",
    "date": "2026-06-23",
    "startTime": "09:00",
    "endTime": "10:30",
    "aiNote": "Optimized slot"
  }
  ```
* **Expected Result**: `PERMISSION_DENIED` (userId mismatch)

### Payload 5: Schedule Path Poisoning (Alphanumeric Check)
* **Target Path**: `schedule/invalid$$#%*`
* **Intended Breach**: Writing to a collection using a corrupted, non-alphanumeric ID.
* **Payload**:
  ```json
  {
    "userId": "user_A",
    "taskId": "task_123",
    "date": "2026-06-23",
    "startTime": "09:00",
    "endTime": "10:30",
    "aiNote": ""
  }
  ```
* **Expected Result**: `PERMISSION_DENIED` (invalid document ID format)

### Payload 6: Schedule Format/Type Invalidation
* **Target Path**: `schedule/sched_3`
* **Intended Breach**: Submitting invalid structures or types for startTime or endTime (e.g., number instead of string).
* **Payload**:
  ```json
  {
    "userId": "user_A",
    "taskId": "task_123",
    "date": "2026-06-23",
    "startTime": 900,
    "endTime": "10:30",
    "aiNote": ""
  }
  ```
* **Expected Result**: `PERMISSION_DENIED` (startTime must be string)

### Payload 7: UserPrefs Privilege Escalation
* **Target Path**: `userPrefs/user_B`
* **Intended Breach**: User `A` attempts to modify or set the preferences of user `B`.
* **Payload**:
  ```json
  {
    "availableHoursPerDay": 8,
    "workingHoursStart": "08:00",
    "workingHoursEnd": "17:00"
  }
  ```
* **Expected Result**: `PERMISSION_DENIED` (matching userId mismatch)

### Payload 8: UserPrefs Invalid Value Boundary
* **Target Path**: `userPrefs/user_A`
* **Intended Breach**: Overwriting pref limits with impossible negative or oversized work hours.
* **Payload**:
  ```json
  {
    "availableHoursPerDay": -25,
    "workingHoursStart": "08:00",
    "workingHoursEnd": "17:00"
  }
  ```
* **Expected Result**: `PERMISSION_DENIED` (availableHoursPerDay must be between 0 and 24)

### Payload 9: ActivityLog Identity Spoofing
* **Target Path**: `activityLog/log_1`
* **Intended Breach**: Writing an activity log attributing logs to User `B`.
* **Payload**:
  ```json
  {
    "userId": "user_B",
    "action": "completed",
    "taskTitle": "Productivity Hack",
    "timestamp": "request.time"
  }
  ```
* **Expected Result**: `PERMISSION_DENIED` (userId mismatch)

### Payload 10: Task State Shortcutting / Ghost Field Injection
* **Target Path**: `tasks/task_1`
* **Intended Breach**: Attempting to update a task and injecting an unauthorized field `isSystemAdmin: true` (Ghost Field).
* **Payload**:
  ```json
  {
    "userId": "user_A",
    "title": "Legit Task",
    "isSystemAdmin": true,
    "status": "in-progress"
  }
  ```
* **Expected Result**: `PERMISSION_DENIED` (affectedKeys().hasOnly() violation)

### Payload 11: Immortal Field Modification
* **Target Path**: `tasks/task_1`
* **Intended Breach**: Attempting to update the `createdAt` or `userId` property of an existing task.
* **Payload**:
  ```json
  {
    "userId": "user_B",
    "title": "Updated Task Title",
    "createdAt": "2020-01-01T00:00:00Z"
  }
  ```
* **Expected Result**: `PERMISSION_DENIED` (userId and createdAt must be immutable)

### Payload 12: Client Timestamp Manipulation
* **Target Path**: `tasks/task_4`
* **Intended Breach**: User specifies a custom `createdAt` timestamp in the past instead of `request.time` during task creation.
* **Payload**:
  ```json
  {
    "userId": "user_A",
    "title": "Yesterday Task",
    "deadline": "2026-06-30T23:59:59Z",
    "estimatedEffort": 60,
    "priority": "medium",
    "category": "Work",
    "status": "pending",
    "subtasks": [],
    "createdAt": "2015-01-01T12:00:00Z"
  }
  ```
* **Expected Result**: `PERMISSION_DENIED` (createdAt must match request.time)

---

## 3. The Test Runner Reference (`firestore.rules.test.ts`)

```typescript
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

describe("Firestore Security Rules unit tests", () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "evident-period-mhh41",
      firestore: {
        rules: `rules_version = '2'; ...`
      }
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  test("Payload 1: Task Identity Spoofing must be blocked", async () => {
    const context = testEnv.authenticatedContext("user_A");
    const db = context.firestore();
    const taskRef = doc(db, "tasks", "task_1");
    
    await expect(setDoc(taskRef, {
      userId: "user_B",
      title: "Malicious Task",
      priority: "medium",
      status: "pending",
      createdAt: new Date()
    })).rejects.toThrow();
  });
});
```
