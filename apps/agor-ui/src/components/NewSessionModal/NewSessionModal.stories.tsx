import type { Meta, StoryObj } from '@storybook/react';
import { Button, ConfigProvider, theme } from 'antd';
import { useState } from 'react';
import { mockAgents } from '../../mocks';
import type { RepoReferenceOption } from './NewSessionModal';
import { NewSessionModal } from './NewSessionModal';

// Mock worktree options
const mockWorktreeOptions: RepoReferenceOption[] = [
  {
    label: 'anthropics/agor:main',
    value: 'anthropics/agor:main',
    type: 'managed-worktree',
    description: 'agor @ main',
  },
  {
    label: 'anthropics/agor:feat-auth',
    value: 'anthropics/agor:feat-auth',
    type: 'managed-worktree',
    description: 'agor @ feature/auth',
  },
  {
    label: 'apache/superset:main',
    value: 'apache/superset:main',
    type: 'managed-worktree',
    description: 'superset @ main',
  },
];

// Mock repo options (for creating new worktrees)
const mockRepoOptions: RepoReferenceOption[] = [
  {
    label: 'anthropics/agor',
    value: 'anthropics/agor',
    type: 'managed',
    description: 'agor (bare repo)',
  },
  {
    label: 'apache/superset',
    value: 'apache/superset',
    type: 'managed',
    description: 'superset (bare repo)',
  },
];

const meta = {
  title: 'Components/NewSessionModal',
  component: NewSessionModal,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    Story => (
      <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
        <Story />
      </ConfigProvider>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof NewSessionModal>;

export default meta;
type Story = StoryObj<typeof meta>;

// biome-ignore lint/suspicious/noExplicitAny: Storybook args type is dynamic
const ModalWrapper = ({ args }: { args: any }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="primary" onClick={() => setOpen(true)}>
        Open Modal
      </Button>
      <NewSessionModal
        {...args}
        open={open}
        onClose={() => setOpen(false)}
        onCreate={config => {
          console.log('Created session with config:', config);
          alert(`Created session with agent: ${config.agent}`);
          setOpen(false);
        }}
      />
    </>
  );
};

export const Default: Story = {
  render: args => <ModalWrapper args={args} />,
  args: {
    availableAgents: mockAgents,
    worktreeOptions: mockWorktreeOptions,
    repoOptions: mockRepoOptions,
  },
};

export const AllAgentsInstalled: Story = {
  render: args => <ModalWrapper args={args} />,
  args: {
    availableAgents: mockAgents.map(agent => ({ ...agent, installed: true })),
    worktreeOptions: mockWorktreeOptions,
    repoOptions: mockRepoOptions,
  },
};

export const NoAgentsInstalled: Story = {
  render: args => <ModalWrapper args={args} />,
  args: {
    availableAgents: mockAgents.map(agent => ({ ...agent, installed: false })),
    worktreeOptions: mockWorktreeOptions,
    repoOptions: mockRepoOptions,
  },
};

export const OpenByDefault: Story = {
  args: {
    open: true,
    onClose: () => console.log('Close modal'),
    onCreate: config => console.log('Created session:', config),
    availableAgents: mockAgents,
    worktreeOptions: mockWorktreeOptions,
    repoOptions: mockRepoOptions,
  },
};

export const WithInitialPrompt: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <NewSessionModal
        open={open}
        onClose={() => setOpen(false)}
        onCreate={config => {
          console.log('Created session:', config);
          setOpen(false);
        }}
        availableAgents={mockAgents}
        worktreeOptions={mockWorktreeOptions}
        repoOptions={mockRepoOptions}
      />
    );
  },
};
