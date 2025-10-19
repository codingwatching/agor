// src/types/agent.ts

import type { AgenticToolName } from './agentic-tool';
import type { AgentID } from './id';

/**
 * Agent represents a UI configuration for an agentic tool
 */
export interface Agent {
  /** Unique agent configuration identifier (UUIDv7) */
  id: AgentID;

  /** Agentic tool name (claude-code, cursor, codex, gemini) */
  name: AgenticToolName;
  icon: string;
  installed: boolean;
  version?: string;
  description?: string;
  installable: boolean;
}
