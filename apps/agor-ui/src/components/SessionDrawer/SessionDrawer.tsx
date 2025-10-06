import {
  BranchesOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  DownOutlined,
  EditOutlined,
  FileTextOutlined,
  ForkOutlined,
  GithubOutlined,
  MessageOutlined,
  PlusSquareOutlined,
  SendOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import {
  Badge,
  Button,
  Divider,
  Drawer,
  Dropdown,
  Input,
  Space,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import React from 'react';
import type { Session, Task } from '../../types';
import { ToolIcon } from '../ToolIcon';
import './SessionDrawer.css';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface SessionDrawerProps {
  session: Session | null;
  tasks: Task[];
  open: boolean;
  onClose: () => void;
  onSendPrompt?: (prompt: string) => void;
  onFork?: (prompt: string) => void;
  onSubtask?: (prompt: string) => void;
}

const SessionDrawer = ({
  session,
  tasks,
  open,
  onClose,
  onSendPrompt,
  onFork,
  onSubtask,
}: SessionDrawerProps) => {
  const [inputValue, setInputValue] = React.useState('');

  const handleSendPrompt = () => {
    if (inputValue.trim()) {
      onSendPrompt?.(inputValue);
      setInputValue('');
    }
  };

  const handleFork = () => {
    if (inputValue.trim()) {
      onFork?.(inputValue);
      setInputValue('');
    }
  };

  const handleSubtask = () => {
    if (inputValue.trim()) {
      onSubtask?.(inputValue);
      setInputValue('');
    }
  };

  const getStatusColor = () => {
    switch (session.status) {
      case 'running':
        return 'processing';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getTaskStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'running':
        return '⚡';
      case 'failed':
        return '✗';
      default:
        return '○';
    }
  };

  const getTaskStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return 'green';
      case 'running':
        return 'blue';
      case 'failed':
        return 'red';
      default:
        return 'gray';
    }
  };

  // Early return if no session
  if (!session) return null;

  const isForked = !!session.genealogy.forked_from_session_id;
  const isSpawned = !!session.genealogy.parent_session_id;

  // Check if git state is dirty
  const isDirty = session.git_state.current_sha.endsWith('-dirty');
  const cleanSha = session.git_state.current_sha.replace('-dirty', '');

  return (
    <Drawer
      title={
        <Space size={12} align="center">
          <ToolIcon tool={session.agent} size={40} />
          <div>
            <div>
              <Text strong style={{ fontSize: 16 }}>
                {session.agent}
              </Text>
              <Badge
                status={getStatusColor()}
                text={session.status.toUpperCase()}
                style={{ marginLeft: 12 }}
              />
            </div>
            {session.description && (
              <Text type="secondary" style={{ fontSize: 14 }}>
                {session.description}
              </Text>
            )}
          </div>
        </Space>
      }
      placement="right"
      width={720}
      open={open}
      onClose={onClose}
      className="session-drawer"
    >
      {/* Genealogy Tags */}
      {(isForked || isSpawned) && (
        <div className="drawer-section">
          <Space size={8}>
            {isForked && (
              <Tag icon={<ForkOutlined />} color="cyan">
                FORKED from {session.genealogy.forked_from_session_id?.substring(0, 7)}
                {session.genealogy.fork_point_task_id &&
                  ` at task ${session.genealogy.fork_point_task_id.substring(0, 7)}`}
              </Tag>
            )}
            {isSpawned && (
              <Tag icon={<BranchesOutlined />} color="purple">
                SPAWNED from {session.genealogy.parent_session_id?.substring(0, 7)}
                {session.genealogy.spawn_point_task_id &&
                  ` at task ${session.genealogy.spawn_point_task_id.substring(0, 7)}`}
              </Tag>
            )}
          </Space>
        </div>
      )}

      {/* Git State */}
      <div className="drawer-section">
        <Title level={5}>Git State</Title>
        <Space direction="vertical" size={4}>
          <Text>
            <CodeOutlined /> Branch: <Text code>{session.git_state.ref}</Text>
          </Text>
          <Text>
            Base SHA: <Text code>{session.git_state.base_sha}</Text>
          </Text>
          <Text>
            Current SHA: <Text code>{cleanSha}</Text>
            {isDirty && (
              <Tag icon={<EditOutlined />} color="orange" style={{ marginLeft: 8 }}>
                uncommitted changes
              </Tag>
            )}
          </Text>
        </Space>
      </div>

      {/* Repository/Worktree Info */}
      {session.repo && (
        <div className="drawer-section">
          <Title level={5}>Repository</Title>
          <Space direction="vertical" size={4}>
            <Text>
              <GithubOutlined />{' '}
              {session.repo.repo_slug && session.repo.worktree_name ? (
                <>
                  <Text code>
                    {session.repo.repo_slug}:{session.repo.worktree_name}
                  </Text>
                  {session.repo.managed_worktree && (
                    <Tag color="blue" style={{ marginLeft: 8 }}>
                      Managed
                    </Tag>
                  )}
                </>
              ) : session.repo.repo_slug ? (
                <Text code>{session.repo.repo_slug}</Text>
              ) : session.repo.cwd ? (
                <Text code>{session.repo.cwd.split('/').pop() || session.repo.cwd}</Text>
              ) : (
                <Text type="secondary">No repository</Text>
              )}
            </Text>
            {session.repo.cwd && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                <CodeOutlined /> {session.repo.cwd}
              </Text>
            )}
          </Space>
        </div>
      )}

      {/* Concepts */}
      {session.concepts.length > 0 && (
        <div className="drawer-section">
          <Title level={5}>Loaded Concepts</Title>
          <Space size={8} wrap>
            {session.concepts.map(concept => (
              <Tag key={concept} color="geekblue">
                📦 {concept}
              </Tag>
            ))}
          </Space>
        </div>
      )}

      <Divider />

      {/* Task Timeline */}
      <div className="drawer-section">
        <Title level={5}>
          Task History ({tasks.length} {tasks.length === 1 ? 'task' : 'tasks'})
        </Title>

        <Timeline
          mode="left"
          items={tasks.map(task => ({
            color: getTaskStatusColor(task.status),
            dot: task.status === 'running' ? <ClockCircleOutlined /> : undefined,
            children: (
              <div className="task-timeline-item">
                <div className="task-timeline-header">
                  <Space size={8}>
                    <span className="task-status-icon">{getTaskStatusIcon(task.status)}</span>
                    <Text strong>{task.description || 'User Prompt'}</Text>
                  </Space>
                </div>

                <div className="task-full-prompt">
                  <Paragraph
                    ellipsis={{ rows: 3, expandable: true, symbol: 'show more' }}
                    style={{
                      marginTop: 4,
                      padding: 8,
                      background: 'rgba(0, 0, 0, 0.02)',
                      borderRadius: 4,
                      fontSize: 13,
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {task.full_prompt}
                  </Paragraph>
                </div>

                <Space size={16} style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <MessageOutlined />{' '}
                    {task.message_range.end_index - task.message_range.start_index + 1}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <ToolOutlined /> {task.tool_use_count}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    🤖 {task.model}
                  </Text>
                  {task.git_state.sha_at_end && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <GithubOutlined /> {task.git_state.sha_at_end.substring(0, 7)}
                    </Text>
                  )}
                  {task.report && (
                    <Tag icon={<FileTextOutlined />} color="green" style={{ fontSize: 11 }}>
                      Report
                    </Tag>
                  )}
                </Space>

                {task.git_state.commit_message && (
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Commit:{' '}
                      <Text code style={{ fontSize: 11 }}>
                        {task.git_state.commit_message}
                      </Text>
                    </Text>
                  </div>
                )}

                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {new Date(task.created_at).toLocaleString()}
                    {task.completed_at && ` → ${new Date(task.completed_at).toLocaleString()}`}
                  </Text>
                </div>
              </div>
            ),
          }))}
        />
      </div>

      {/* Session Metadata */}
      <Divider />
      <div className="drawer-section">
        <Title level={5}>Session Metadata</Title>
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">Session ID:</Text>
            <Text code>{session.session_id}</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">Total Messages:</Text>
            <Text>{session.message_count}</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">Tool Uses:</Text>
            <Text>{session.tool_use_count}</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">Created:</Text>
            <Text>{new Date(session.created_at).toLocaleString()}</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">Last Updated:</Text>
            <Text>{new Date(session.last_updated).toLocaleString()}</Text>
          </div>
          {session.agent_version && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Agent Version:</Text>
              <Text code>{session.agent_version}</Text>
            </div>
          )}
        </Space>
      </div>

      {/* Input Box Footer */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '16px 24px',
          background: 'var(--ant-color-bg-container)',
          borderTop: '1px solid var(--ant-color-border)',
          marginTop: 24,
          marginLeft: -24,
          marginRight: -24,
          marginBottom: -24,
        }}
      >
        <Space.Compact style={{ width: '100%' }} direction="vertical" size={8}>
          <TextArea
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="Send a prompt, fork, or create a subtask..."
            autoSize={{ minRows: 2, maxRows: 6 }}
            onPressEnter={e => {
              if (e.shiftKey) {
                // Allow Shift+Enter for new line
                return;
              }
              e.preventDefault();
              handleSendPrompt();
            }}
          />
          <Space size={8} style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space size={8}>
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'fork',
                      label: 'Fork Session',
                      icon: <BranchesOutlined />,
                      onClick: handleFork,
                    },
                    {
                      key: 'subtask',
                      label: 'Create Subtask',
                      icon: <PlusSquareOutlined />,
                      onClick: handleSubtask,
                    },
                  ],
                }}
                disabled={!inputValue.trim()}
              >
                <Button icon={<DownOutlined />}>More Actions</Button>
              </Dropdown>
            </Space>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSendPrompt}
              disabled={!inputValue.trim()}
            >
              Send Prompt
            </Button>
          </Space>
        </Space.Compact>
      </div>
    </Drawer>
  );
};

export default SessionDrawer;
