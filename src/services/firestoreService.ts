import { database, auth } from "../firebase/config";
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs, 
  query, 
  where, 
  updateDoc, 
  deleteDoc,
  serverTimestamp, 
  Timestamp,
  getDocFromServer,
  onSnapshot,
  arrayUnion
} from "firebase/firestore";

// --- CUSTOM TYPES ---

export interface Subtask {
  title: string;
  estimatedMinutes: number;
  completed: boolean;
}

export interface Task {
  id?: string;
  userId: string;
  title: string;
  description: string;
  deadline: Date | Timestamp;
  estimatedEffort: number; // in minutes
  priority: "low" | "medium" | "high" | "urgent" | "critical";
  category: string;
  status: "pending" | "in-progress" | "completed";
  subtasks: Subtask[];
  parentTaskId?: string;
  lastSuggestedAt?: Date | any;
  createdAt?: Date | Timestamp | any;
  googleEventId?: string;
  googleEventIds?: string[];
}

export interface ScheduleItem {
  id?: string;
  userId: string;
  taskId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  aiNote: string;
}

export interface UserPrefs {
  availableHoursPerDay: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  googleCalendarSync?: boolean;
  aiOptimizationMode?: boolean;
  hasSeenSettingsPrompt?: boolean;
}

export interface ActivityLogItem {
  id?: string;
  userId: string;
  action: "completed" | "created" | "missed";
  taskTitle: string;
  timestamp?: Date | Timestamp | any;
}

export interface ChatSessionMessage {
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id?: string;
  userId: string;
  title: string;
  messages: ChatSessionMessage[];
  createdAt?: Date | Timestamp | any;
  updatedAt?: Date | Timestamp | any;
}

export interface ChatMessage {
  id?: string;
  userId: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  createdAt?: Date | Timestamp | any;
}

// --- ERROR HANDLING SPEC ---

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error Raised: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- INITIALIZATION CONNECTION VALIDATION ---

export async function testConnection() {
  try {
    await getDocFromServer(doc(database, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration; client appears offline.");
    }
  }
}

// Automatically trigger connection test
testConnection();

// --- SERVICE IMPLEMENTATIONS ---

/**
 * Creates a new task in tasks/{taskId}
 * @param userId ID of the authenticated user
 * @param taskData Task properties (excludes userId and system-generated fields)
 * @returns Generated Task ID
 */
export async function createTask(userId: string, taskData: Omit<Task, "userId" | "createdAt" | "id">): Promise<string> {
  const path = "tasks";
  try {
    const taskRef = doc(collection(database, path));
    const payload = {
      ...taskData,
      userId,
      createdAt: serverTimestamp(),
    };
    await setDoc(taskRef, payload);
    return taskRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Gets all tasks belonging to a user
 * @param userId ID of the authenticated user
 * @returns Array of Tasks
 */
export async function getTasksByUser(userId: string): Promise<Task[]> {
  const path = "tasks";
  try {
    const q = query(collection(database, path), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    const tasks: Task[] = [];
    querySnapshot.forEach((docSnap) => {
      tasks.push({ id: docSnap.id, ...docSnap.data() } as Task);
    });
    return tasks;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Updates the status of a specific task
 * @param taskId ID of the task doc to update
 * @param status Status update value
 */
export async function updateTaskStatus(taskId: string, status: "pending" | "in-progress" | "completed"): Promise<void> {
  const path = `tasks/${taskId}`;
  try {
    const taskRef = doc(database, "tasks", taskId);
    await updateDoc(taskRef, { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Updates an entire task's details
 * @param taskId ID of the task doc to update
 * @param taskData Sub-fields to update
 */
export async function updateTask(taskId: string, taskData: Partial<Omit<Task, "id" | "userId" | "createdAt">>): Promise<void> {
  const path = `tasks/${taskId}`;
  try {
    const taskRef = doc(database, "tasks", taskId);
    await updateDoc(taskRef, taskData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Deletes a task by ID
 * @param taskId ID of the task to delete
 */
export async function deleteTask(taskId: string): Promise<void> {
  const path = `tasks/${taskId}`;
  try {
    const taskRef = doc(database, "tasks", taskId);
    await deleteDoc(taskRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Gets schedule entries belonging to a user
 * @param userId ID of the authenticated user
 * @returns Array of ScheduleItems
 */
export async function getScheduleByUser(userId: string): Promise<ScheduleItem[]> {
  const path = "schedule";
  try {
    const q = query(collection(database, path), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    const scheduleItems: ScheduleItem[] = [];
    querySnapshot.forEach((docSnap) => {
      scheduleItems.push({ id: docSnap.id, ...docSnap.data() } as ScheduleItem);
    });
    return scheduleItems;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Deletes all schedule items associated with a task
 * @param taskId ID of the task
 */
export async function deleteScheduleItemsForTask(taskId: string): Promise<void> {
  const path = "schedule";
  try {
    const q = query(collection(database, path), where("taskId", "==", taskId));
    const querySnapshot = await getDocs(q);
    const deletePromises: Promise<void>[] = [];
    querySnapshot.forEach((docSnap) => {
      deletePromises.push(deleteDoc(docSnap.ref));
    });
    await Promise.all(deletePromises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Appends a new activity log entry at activityLog/{logId}
 * @param userId ID of the user triggering the action
 * @param action Type of action recorded
 * @param taskTitle Title of relevant task
 * @returns Generated Log ID
 */
export async function logActivity(userId: string, action: "completed" | "created" | "missed", taskTitle: string): Promise<string> {
  const path = "activityLog";
  try {
    const logRef = doc(collection(database, path));
    const payload = {
      userId,
      action,
      taskTitle,
      timestamp: serverTimestamp(),
    };
    await setDoc(logRef, payload);
    return logRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Gets user preferences from userPrefs/{userId}
 * @param userId ID of the user
 * @returns UserPrefs or null if not configured
 */
export async function getUserPrefs(userId: string): Promise<UserPrefs | null> {
  const path = `userPrefs/${userId}`;
  try {
    const prefRef = doc(database, "userPrefs", userId);
    const docSnap = await getDoc(prefRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserPrefs;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Saves/updates user preferences at userPrefs/{userId}
 * @param userId ID of the user
 * @param prefs Preferences to save
 */
export async function saveUserPrefs(userId: string, prefs: Partial<UserPrefs>): Promise<void> {
  const path = `userPrefs/${userId}`;
  try {
    const prefRef = doc(database, "userPrefs", userId);
    await setDoc(prefRef, prefs, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Subscribes to user preferences changes
 * @param userId ID of the user
 * @param callback Function to call when preferences change
 * @returns Unsubscribe function
 */
export function subscribeToUserPrefs(userId: string, callback: (prefs: UserPrefs | null) => void): () => void {
  const prefRef = doc(database, "userPrefs", userId);
  
  const unsubscribe = onSnapshot(prefRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as UserPrefs);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error("Error subscribing to user prefs:", error);
  });
  
  return unsubscribe;
}

/**
 * Creates a new schedule item under schedule/{scheduleId}
 * @param item The ScheduleItem object (without id)
 * @returns Generated schedule item ID
 */
export async function createScheduleItem(item: Omit<ScheduleItem, "id">): Promise<string> {
  const path = "schedule";
  try {
    const schedRef = doc(collection(database, path));
    await setDoc(schedRef, item);
    return schedRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Gets the activity logs for a user
 * @param userId ID of the authenticated user
 * @returns Array of ActivityLogItems
 */
export async function getActivityLogsByUser(userId: string): Promise<ActivityLogItem[]> {
  const path = "activityLog";
  try {
    const q = query(collection(database, path), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    const logs: ActivityLogItem[] = [];
    querySnapshot.forEach((docSnap) => {
      logs.push({ id: docSnap.id, ...docSnap.data() } as ActivityLogItem);
    });
    return logs;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Subscribes to realtime updates of a user's tasks
 */
export function subscribeToTasksByUser(userId: string, callback: (tasks: Task[]) => void): () => void {
  const q = query(collection(database, "tasks"), where("userId", "==", userId));
  return onSnapshot(q, (snapshot) => {
    const tasks: Task[] = [];
    snapshot.forEach((docSnap) => {
      tasks.push({ id: docSnap.id, ...docSnap.data() } as Task);
    });
    callback(tasks);
  }, (error) => {
    console.error("Error subscribing to tasks:", error);
  });
}

/**
 * Subscribes to realtime updates of a user's schedule
 */
export function subscribeToScheduleByUser(userId: string, callback: (items: ScheduleItem[]) => void): () => void {
  const q = query(collection(database, "schedule"), where("userId", "==", userId));
  return onSnapshot(q, (snapshot) => {
    const items: ScheduleItem[] = [];
    snapshot.forEach((docSnap) => {
      items.push({ id: docSnap.id, ...docSnap.data() } as ScheduleItem);
    });
    callback(items);
  }, (error) => {
    console.error("Error subscribing to schedule:", error);
  });
}

/**
 * Subscribes to realtime updates of a user's activity logs
 */
export function subscribeToActivityLogsByUser(userId: string, callback: (logs: ActivityLogItem[]) => void): () => void {
  const q = query(collection(database, "activityLog"), where("userId", "==", userId));
  return onSnapshot(q, (snapshot) => {
    const logs: ActivityLogItem[] = [];
    snapshot.forEach((docSnap) => {
      logs.push({ id: docSnap.id, ...docSnap.data() } as ActivityLogItem);
    });
    callback(logs);
  }, (error) => {
    console.error("Error subscribing to activity logs:", error);
  });
}

/**
 * Saves a chat message to chatMessages/{messageId}
 */
export async function saveChatMessage(userId: string, messageData: Omit<ChatMessage, "userId" | "createdAt" | "id">): Promise<string> {
  const path = "chatMessages";
  try {
    const chatRef = doc(collection(database, path));
    const payload = {
      ...messageData,
      userId,
      createdAt: serverTimestamp(),
    };
    await setDoc(chatRef, payload);
    return chatRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeToChatMessagesByUser(userId: string, callback: (messages: ChatMessage[]) => void): () => void {
  const q = query(collection(database, "chatMessages"), where("userId", "==", userId));
  return onSnapshot(q, (snapshot) => {
    const messages: ChatMessage[] = [];
    snapshot.forEach((docSnap) => {
      messages.push({ id: docSnap.id, ...docSnap.data() } as ChatMessage);
    });
    // Sort locally by createdAt since we might not have an index on userId + createdAt initially
    messages.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
      return timeA - timeB;
    });
    callback(messages);
  }, (error) => {
    console.error("Error subscribing to chat messages:", error);
  });
}

/**
 * Creates a new chat session
 */
export async function createChatSession(userId: string, title: string, initialMessage?: ChatSessionMessage): Promise<string> {
  const path = "chatSessions";
  try {
    const sessionRef = doc(collection(database, path));
    const payload: ChatSession = {
      userId,
      title,
      messages: initialMessage ? [initialMessage] : [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(sessionRef, payload);
    return sessionRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Updates an existing chat session (e.g. appending a message)
 */
export async function updateChatSession(sessionId: string, messages: ChatSessionMessage[]): Promise<void> {
  const path = `chatSessions/${sessionId}`;
  try {
    const sessionRef = doc(database, "chatSessions", sessionId);
    await updateDoc(sessionRef, {
      messages,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Appends a message to a chat session atomically
 */
export async function appendMessageToSession(sessionId: string, message: ChatSessionMessage): Promise<void> {
  const path = `chatSessions/${sessionId}`;
  try {
    const sessionRef = doc(database, "chatSessions", sessionId);
    await updateDoc(sessionRef, {
      messages: arrayUnion(message),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Updates a chat session's title
 */
export async function updateChatSessionTitle(sessionId: string, title: string): Promise<void> {
  const path = `chatSessions/${sessionId}`;
  try {
    const sessionRef = doc(database, "chatSessions", sessionId);
    await updateDoc(sessionRef, {
      title,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Subscribes to chat sessions for a user
 */
export function subscribeToChatSessionsByUser(userId: string, callback: (sessions: ChatSession[]) => void): () => void {
  const q = query(collection(database, "chatSessions"), where("userId", "==", userId));
  return onSnapshot(q, (snapshot) => {
    const sessions: ChatSession[] = [];
    snapshot.forEach((docSnap) => {
      sessions.push({ id: docSnap.id, ...docSnap.data() } as ChatSession);
    });
    // Sort locally by updatedAt (newest first)
    sessions.sort((a, b) => {
      const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now());
      const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now());
      return timeB - timeA;
    });
    callback(sessions);
  }, (error) => {
    console.error("Error subscribing to chat sessions:", error);
  });
}


