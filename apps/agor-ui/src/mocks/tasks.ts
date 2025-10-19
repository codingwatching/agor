// src/mocks/tasks.ts
import type { SessionID, Task, TaskID } from '../types';

export const mockTask001: Task = {
  task_id: 'task-001' as TaskID,
  session_id: 'abc123' as SessionID,
  full_prompt: 'Design JWT authentication flow',
  status: 'completed',
  message_range: {
    start_index: 0,
    end_index: 12,
    start_timestamp: '2025-10-01T10:00:00Z',
    end_timestamp: '2025-10-01T10:10:00Z',
  },
  tool_use_count: 12,
  git_state: {
    sha_at_start: 'a4f2e91',
    sha_at_end: 'a4f2e91',
  },
  created_by: 'user-123',
  model: 'claude-sonnet-4',
  report: {
    template: 'design.md',
    path: '.agor/sessions/abc123/reports/task-001-report.md',
    generated_at: '2025-10-01T10:10:30Z',
  },
  created_at: '2025-10-01T10:00:00Z',
  completed_at: '2025-10-01T10:10:00Z',
};

export const mockTask002: Task = {
  task_id: 'task-002' as TaskID,
  session_id: 'abc123' as SessionID,
  full_prompt: 'Implement JWT auth endpoints',
  status: 'running',
  message_range: {
    start_index: 13,
    end_index: 20,
    start_timestamp: '2025-10-01T10:15:00Z',
  },
  tool_use_count: 12,
  git_state: {
    sha_at_start: 'a4f2e91',
    sha_at_end: 'b3e4d12-dirty',
  },
  created_by: 'user-123',
  model: 'claude-sonnet-4',
  created_at: '2025-10-01T10:15:00Z',
};

export const mockTask003: Task = {
  task_id: 'task-003' as TaskID,
  session_id: 'def456' as SessionID,
  full_prompt: 'Implement OAuth 2.0 flow',
  status: 'completed',
  message_range: {
    start_index: 0,
    end_index: 15,
    start_timestamp: '2025-10-01T10:20:00Z',
    end_timestamp: '2025-10-01T10:35:00Z',
  },
  tool_use_count: 12,
  git_state: {
    sha_at_start: 'a4f2e91',
    sha_at_end: 'c5f6e23',
    commit_message: 'feat: implement OAuth 2.0 authentication',
  },
  created_by: 'user-123',
  model: 'claude-sonnet-4',
  report: {
    template: 'feature.md',
    path: '.agor/sessions/def456/reports/task-003-report.md',
    generated_at: '2025-10-01T10:35:30Z',
  },
  created_at: '2025-10-01T10:20:00Z',
  completed_at: '2025-10-01T10:35:00Z',
};

export const mockTask004: Task = {
  task_id: 'task-004' as TaskID,
  session_id: 'ghi789' as SessionID,
  full_prompt: 'Design user database schema',
  status: 'completed',
  message_range: {
    start_index: 0,
    end_index: 10,
    start_timestamp: '2025-10-01T10:18:00Z',
    end_timestamp: '2025-10-01T10:28:00Z',
  },
  tool_use_count: 12,
  git_state: {
    sha_at_start: 'b3e4d12',
    sha_at_end: 'd7g8h34',
    commit_message: 'feat: add user schema with secure password storage',
  },
  created_by: 'user-123',
  model: 'gemini-2.0',
  report: {
    template: 'design.md',
    path: '.agor/sessions/ghi789/reports/task-004-report.md',
    generated_at: '2025-10-01T10:28:30Z',
  },
  created_at: '2025-10-01T10:18:00Z',
  completed_at: '2025-10-01T10:28:00Z',
};

export const mockTask005: Task = {
  task_id: 'task-005' as TaskID,
  session_id: 'abc123' as SessionID,
  full_prompt: 'Write integration tests for auth',
  status: 'created',
  message_range: {
    start_index: 21,
    end_index: 21,
    start_timestamp: '2025-10-01T10:30:00Z',
  },
  tool_use_count: 12,
  git_state: {
    sha_at_start: 'b3e4d12',
  },
  created_by: 'user-123',
  model: 'claude-sonnet-4',
  created_at: '2025-10-01T10:30:00Z',
};

// Task with long prompt (simulating real user input)
export const mockTaskLongPrompt: Task = {
  task_id: 'task-006' as TaskID,
  session_id: 'abc123' as SessionID,
  full_prompt: `wow, very cool. Now what I call Task is really "user prompt", I know in claude code, at times after a user prompt the agent will label what it's doing based on that prompt, though I doubt the SDK would expose that for us to use, so most likely we'd need to either have a way to summarize the user prompt (through an LLM), or simply show a part of the use prompt. Or maybe there are 2-3 views: collapsed, with just the session title, expanded with a wide view of only the user prompts, this may take say 1/6 of the screen, idk, and the full session, the more traditional session with full details, this one would be in a drawer on the right that has the full session in x.antd. Realizing this is going to be pretty on design. Look at this prompt for instance, it's like 10 lines long.`,
  status: 'running',
  message_range: {
    start_index: 22,
    end_index: 28,
    start_timestamp: '2025-10-01T10:35:00Z',
  },
  tool_use_count: 12,
  git_state: {
    sha_at_start: 'b3e4d12',
    sha_at_end: 'b3e4d12-dirty',
  },
  created_by: 'user-123',
  model: 'claude-sonnet-4',
  created_at: '2025-10-01T10:35:00Z',
};

// Additional realistic tasks for Session A (to test scrolling)
export const mockTask007: Task = {
  task_id: 'task-007' as TaskID,
  session_id: 'abc123' as SessionID,
  full_prompt: `Hey, can you help me implement a password reset flow? I'm thinking we need:
1. A "forgot password" endpoint that sends an email with a reset token
2. The token should be time-limited (maybe 1 hour?)
3. A reset password endpoint that validates the token
4. Some basic rate limiting to prevent abuse

Also, I'm not sure if we should store the reset tokens in the database or use JWT for this. What do you think would be more secure? And should we invalidate all existing sessions when a password is reset?`,
  status: 'completed',
  message_range: {
    start_index: 29,
    end_index: 42,
    start_timestamp: '2025-10-01T10:40:00Z',
    end_timestamp: '2025-10-01T11:10:00Z',
  },
  tool_use_count: 12,
  git_state: {
    sha_at_start: 'b3e4d12',
    sha_at_end: 'e8h9i45',
    commit_message: 'feat: implement password reset with email tokens',
  },
  created_by: 'user-123',
  model: 'claude-sonnet-4',
  report: {
    template: 'feature.md',
    path: '.agor/sessions/abc123/reports/task-007-report.md',
    generated_at: '2025-10-01T11:10:30Z',
  },
  created_at: '2025-10-01T10:40:00Z',
  completed_at: '2025-10-01T11:10:00Z',
};

export const mockTask008: Task = {
  task_id: 'task-008' as TaskID,
  session_id: 'abc123' as SessionID,
  full_prompt: `We're getting CORS errors in production but everything works fine in dev. The frontend is on app.example.com and the API is on api.example.com. I've already added the CORS middleware but still seeing "No 'Access-Control-Allow-Origin' header" errors. Can you help debug this?`,
  status: 'completed',
  message_range: {
    start_index: 43,
    end_index: 55,
    start_timestamp: '2025-10-01T11:15:00Z',
    end_timestamp: '2025-10-01T11:35:00Z',
  },
  tool_use_count: 12,
  git_state: {
    sha_at_start: 'e8h9i45',
    sha_at_end: 'f9j0k56',
    commit_message: 'fix: configure CORS for production domains',
  },
  created_by: 'user-123',
  model: 'claude-sonnet-4',
  created_at: '2025-10-01T11:15:00Z',
  completed_at: '2025-10-01T11:35:00Z',
};

export const mockTask009: Task = {
  task_id: 'task-009' as TaskID,
  session_id: 'abc123' as SessionID,
  full_prompt: 'Add refresh token rotation',
  status: 'completed',
  message_range: {
    start_index: 56,
    end_index: 68,
    start_timestamp: '2025-10-01T11:40:00Z',
    end_timestamp: '2025-10-01T12:00:00Z',
  },
  tool_use_count: 12,
  git_state: {
    sha_at_start: 'f9j0k56',
    sha_at_end: 'g0k1l67',
  },
  created_by: 'user-123',
  model: 'claude-sonnet-4',
  created_at: '2025-10-01T11:40:00Z',
  completed_at: '2025-10-01T12:00:00Z',
};

export const mockTask010: Task = {
  task_id: 'task-010' as TaskID,
  session_id: 'abc123' as SessionID,
  full_prompt: `I need to add rate limiting to prevent brute force attacks on the login endpoint. Let's use something like 5 attempts per minute per IP address. If someone exceeds that, lock them out for 15 minutes. Should we use Redis for this or can we do it in-memory for now?`,
  status: 'completed',
  message_range: {
    start_index: 69,
    end_index: 82,
    start_timestamp: '2025-10-01T12:05:00Z',
    end_timestamp: '2025-10-01T12:30:00Z',
  },
  tool_use_count: 12,
  git_state: {
    sha_at_start: 'g0k1l67',
    sha_at_end: 'h1l2m78',
  },
  created_by: 'user-123',
  model: 'claude-sonnet-4',
  created_at: '2025-10-01T12:05:00Z',
  completed_at: '2025-10-01T12:30:00Z',
};

export const mockTask011: Task = {
  task_id: 'task-011' as TaskID,
  session_id: 'abc123' as SessionID,
  full_prompt: 'Add session management endpoints',
  status: 'completed',
  message_range: {
    start_index: 83,
    end_index: 95,
    start_timestamp: '2025-10-01T12:35:00Z',
    end_timestamp: '2025-10-01T12:55:00Z',
  },
  tool_use_count: 12,
  git_state: {
    sha_at_start: 'h1l2m78',
    sha_at_end: 'i2m3n89',
  },
  created_by: 'user-123',
  model: 'claude-sonnet-4',
  created_at: '2025-10-01T12:35:00Z',
  completed_at: '2025-10-01T12:55:00Z',
};

export const mockTask012: Task = {
  task_id: 'task-012' as TaskID,
  session_id: 'abc123' as SessionID,
  full_prompt: `We need to integrate an email service for sending password reset emails, welcome emails, etc. I'm thinking of using SendGrid or AWS SES. Which one would you recommend? Also, can you help set up email templates using something like Handlebars or React Email?`,
  status: 'completed',
  message_range: {
    start_index: 96,
    end_index: 110,
    start_timestamp: '2025-10-01T13:00:00Z',
    end_timestamp: '2025-10-01T13:45:00Z',
  },
  tool_use_count: 12,
  git_state: {
    sha_at_start: 'i2m3n89',
    sha_at_end: 'j3n4o90',
  },
  created_by: 'user-123',
  model: 'claude-sonnet-4',
  created_at: '2025-10-01T13:00:00Z',
  completed_at: '2025-10-01T13:45:00Z',
};

export const mockTask013: Task = {
  task_id: 'task-013' as TaskID,
  session_id: 'abc123' as SessionID,
  full_prompt: 'Add two-factor authentication',
  status: 'completed',
  message_range: {
    start_index: 111,
    end_index: 125,
    start_timestamp: '2025-10-01T13:50:00Z',
    end_timestamp: '2025-10-01T14:25:00Z',
  },
  tool_use_count: 12,
  git_state: {
    sha_at_start: 'j3n4o90',
    sha_at_end: 'k4o5p01',
  },
  created_by: 'user-123',
  model: 'claude-sonnet-4',
  created_at: '2025-10-01T13:50:00Z',
  completed_at: '2025-10-01T14:25:00Z',
};

export const mockTask014: Task = {
  task_id: 'task-014' as TaskID,
  session_id: 'abc123' as SessionID,
  full_prompt: `Time to add proper authorization. I want to have different user roles like "admin", "user", "moderator" etc. Each role should have different permissions. Can we create a flexible system where we can define permissions like "users.read", "users.write", "posts.delete" and then assign those to roles? Also need middleware to check permissions on routes.`,
  status: 'completed',
  message_range: {
    start_index: 126,
    end_index: 145,
    start_timestamp: '2025-10-01T14:30:00Z',
    end_timestamp: '2025-10-01T15:20:00Z',
  },
  tool_use_count: 12,
  git_state: {
    sha_at_start: 'k4o5p01',
    sha_at_end: 'l5p6q12',
  },
  created_by: 'user-123',
  model: 'claude-sonnet-4',
  created_at: '2025-10-01T14:30:00Z',
  completed_at: '2025-10-01T15:20:00Z',
};

export const mockTask015: Task = {
  task_id: 'task-015' as TaskID,
  session_id: 'abc123' as SessionID,
  full_prompt: 'Write comprehensive API documentation',
  status: 'completed',
  message_range: {
    start_index: 146,
    end_index: 158,
    start_timestamp: '2025-10-01T15:25:00Z',
    end_timestamp: '2025-10-01T15:50:00Z',
  },
  tool_use_count: 12,
  git_state: {
    sha_at_start: 'l5p6q12',
    sha_at_end: 'l5p6q12',
  },
  created_by: 'user-123',
  model: 'claude-sonnet-4',
  created_at: '2025-10-01T15:25:00Z',
  completed_at: '2025-10-01T15:50:00Z',
};

export const mockTask016: Task = {
  task_id: 'task-016' as TaskID,
  session_id: 'abc123' as SessionID,
  full_prompt: `We need better observability. Can you help set up structured logging (maybe using Winston or Pino?) and add some basic monitoring? I want to track things like: response times, error rates, active sessions, failed login attempts. Should we use something like Datadog or can we start with a simpler solution?`,
  status: 'completed',
  message_range: {
    start_index: 159,
    end_index: 172,
    start_timestamp: '2025-10-01T15:55:00Z',
    end_timestamp: '2025-10-01T16:30:00Z',
  },
  tool_use_count: 12,
  git_state: {
    sha_at_start: 'l5p6q12',
    sha_at_end: 'm6q7r23',
  },
  created_by: 'user-123',
  model: 'claude-sonnet-4',
  created_at: '2025-10-01T15:55:00Z',
  completed_at: '2025-10-01T16:30:00Z',
};

export const mockTask017: Task = {
  task_id: 'task-017' as TaskID,
  session_id: 'abc123' as SessionID,
  full_prompt: 'Add API versioning',
  status: 'created',
  message_range: {
    start_index: 173,
    end_index: 173,
    start_timestamp: '2025-10-01T16:35:00Z',
  },
  tool_use_count: 12,
  git_state: {
    sha_at_start: 'm6q7r23',
  },
  created_by: 'user-123',
  model: 'claude-sonnet-4',
  created_at: '2025-10-01T16:35:00Z',
};

export const mockTask018: Task = {
  task_id: 'task-018' as TaskID,
  session_id: 'abc123' as SessionID,
  full_prompt: `The app is getting slow with more users. Looking at the logs, I see some N+1 query issues and missing indexes. Can you help me identify and fix the performance bottlenecks? Maybe add some eager loading, create indexes on frequently queried columns, and optimize the most common queries?`,
  status: 'created',
  message_range: {
    start_index: 174,
    end_index: 174,
    start_timestamp: '2025-10-01T16:40:00Z',
  },
  tool_use_count: 12,
  git_state: {
    sha_at_start: 'm6q7r23',
  },
  created_by: 'user-123',
  model: 'claude-sonnet-4',
  created_at: '2025-10-01T16:40:00Z',
};

// More tasks for Session B (OAuth exploration)
export const mockTask019: Task = {
  task_id: 'task-019' as TaskID,
  session_id: 'def456' as SessionID,
  full_prompt: `Let's explore OAuth 2.0 as an alternative to our JWT implementation. I want to support "Sign in with Google", "Sign in with GitHub", and maybe Microsoft. Can you help me understand the flow and what libraries we should use? Also, how do we handle the case where a user signs up with email but later wants to link their Google account?`,
  status: 'completed',
  message_range: {
    start_index: 16,
    end_index: 28,
    start_timestamp: '2025-10-01T10:36:00Z',
    end_timestamp: '2025-10-01T10:55:00Z',
  },
  tool_use_count: 12,
  git_state: {
    sha_at_start: 'c5f6e23',
    sha_at_end: 'c5f6e23',
  },
  created_by: 'user-123',
  model: 'claude-sonnet-4',
  created_at: '2025-10-01T10:36:00Z',
  completed_at: '2025-10-01T10:55:00Z',
};

export const mockTask020: Task = {
  task_id: 'task-020' as TaskID,
  session_id: 'def456' as SessionID,
  full_prompt: 'Implement OAuth callback handlers',
  status: 'running',
  message_range: {
    start_index: 29,
    end_index: 40,
    start_timestamp: '2025-10-01T11:00:00Z',
  },
  tool_use_count: 12,
  git_state: {
    sha_at_start: 'c5f6e23',
  },
  created_by: 'user-123',
  model: 'claude-sonnet-4',
  created_at: '2025-10-01T11:00:00Z',
};

// More tasks for Session C (database design)
export const mockTask021: Task = {
  task_id: 'task-021' as TaskID,
  session_id: 'ghi789' as SessionID,
  full_prompt: 'Add migration for user roles table',
  status: 'completed',
  message_range: {
    start_index: 11,
    end_index: 18,
    start_timestamp: '2025-10-01T10:29:00Z',
    end_timestamp: '2025-10-01T10:38:00Z',
  },
  tool_use_count: 12,
  git_state: {
    sha_at_start: 'd7g8h34',
    sha_at_end: 'e8i9j45',
  },
  created_by: 'user-123',
  model: 'gemini-2.0',
  created_at: '2025-10-01T10:29:00Z',
  completed_at: '2025-10-01T10:38:00Z',
};

export const mockTask022: Task = {
  task_id: 'task-022' as TaskID,
  session_id: 'ghi789' as SessionID,
  full_prompt: `We need to configure database connection pooling for better performance. What's the optimal pool size for a typical web app? Should we use different pool sizes for read vs write operations? Also need to handle connection timeouts and retries gracefully.`,
  status: 'completed',
  message_range: {
    start_index: 19,
    end_index: 28,
    start_timestamp: '2025-10-01T10:40:00Z',
    end_timestamp: '2025-10-01T10:55:00Z',
  },
  tool_use_count: 12,
  git_state: {
    sha_at_start: 'e8i9j45',
    sha_at_end: 'f9j0k56',
  },
  created_by: 'user-123',
  model: 'gemini-2.0',
  created_at: '2025-10-01T10:40:00Z',
  completed_at: '2025-10-01T10:55:00Z',
};

// Tasks with AI-generated summaries (future ideal state)
export const mockTaskWithSummary001: Task = {
  task_id: 'summary-001' as TaskID,
  session_id: 'summary-session' as SessionID,
  full_prompt:
    'Can you help me design a JWT authentication flow? I want to understand the best practices for token expiration, refresh tokens, and how to handle the auth state in the frontend.',
  description: 'Design JWT authentication flow',
  status: 'completed',
  message_range: {
    start_index: 0,
    end_index: 12,
    start_timestamp: '2025-10-01T10:00:00Z',
    end_timestamp: '2025-10-01T10:10:00Z',
  },
  tool_use_count: 12,
  git_state: {
    sha_at_start: 'a4f2e91',
    sha_at_end: 'a4f2e91',
  },
  created_by: 'user-123',
  model: 'claude-sonnet-4',
  created_at: '2025-10-01T10:00:00Z',
  completed_at: '2025-10-01T10:10:00Z',
};

export const mockTaskWithSummary002: Task = {
  task_id: 'summary-002' as TaskID,
  session_id: 'summary-session' as SessionID,
  full_prompt: `Hey, can you help me implement a password reset flow? I'm thinking we need:
1. A "forgot password" endpoint that sends an email with a reset token
2. The token should be time-limited (maybe 1 hour?)
3. A reset password endpoint that validates the token
4. Some basic rate limiting to prevent abuse

Also, I'm not sure if we should store the reset tokens in the database or use JWT for this. What do you think would be more secure? And should we invalidate all existing sessions when a password is reset?`,
  description: 'Implement password reset with email tokens',
  status: 'completed',
  message_range: {
    start_index: 13,
    end_index: 25,
    start_timestamp: '2025-10-01T10:15:00Z',
    end_timestamp: '2025-10-01T10:45:00Z',
  },
  tool_use_count: 12,
  git_state: {
    sha_at_start: 'a4f2e91',
    sha_at_end: 'b5c6d23',
  },
  created_by: 'user-123',
  model: 'claude-sonnet-4',
  created_at: '2025-10-01T10:15:00Z',
  completed_at: '2025-10-01T10:45:00Z',
};

export const mockTasksWithSummaries: Task[] = [mockTaskWithSummary001, mockTaskWithSummary002];

// Grouped by session
export const mockTasksBySession: Record<string, Task[]> = {
  abc123: [
    mockTask001,
    mockTask002,
    mockTask005,
    mockTaskLongPrompt,
    mockTask007,
    mockTask008,
    mockTask009,
    mockTask010,
    mockTask011,
    mockTask012,
    mockTask013,
    mockTask014,
    mockTask015,
    mockTask016,
    mockTask017,
    mockTask018,
  ],
  def456: [mockTask003, mockTask019, mockTask020],
  ghi789: [mockTask004, mockTask021, mockTask022],
};
