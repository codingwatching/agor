/**
 * EventStreamDrawer - Live WebSocket event stream for debugging
 *
 * Displays real-time socket events with filtering capabilities
 */

import {
  CloseOutlined,
  DeleteOutlined,
  PauseOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { Badge, Button, Checkbox, Drawer, Empty, Space, Tag, Typography, theme } from 'antd';
import { useMemo, useState } from 'react';
import type { SocketEvent } from '../../hooks/useEventStream';
import { EventItem } from './EventItem';

const { Text, Title } = Typography;

export interface EventStreamDrawerProps {
  open: boolean;
  onClose: () => void;
  events: SocketEvent[];
  onClear: () => void;
}

export const EventStreamDrawer: React.FC<EventStreamDrawerProps> = ({
  open,
  onClose,
  events,
  onClear,
}) => {
  const { token } = theme.useToken();
  const [includeCursor, setIncludeCursor] = useState(false);
  const [includeMessages, setIncludeMessages] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // When paused, freeze the displayed events at the moment of pause
  const [frozenEvents, setFrozenEvents] = useState<SocketEvent[]>([]);

  // Update frozen events when pausing
  const handlePauseToggle = () => {
    if (!isPaused) {
      // Pausing - freeze current events
      setFrozenEvents(events);
    }
    setIsPaused(!isPaused);
  };

  // Use frozen events when paused, live events when not paused
  const displayEvents = isPaused ? frozenEvents : events;

  // Filter events based on user preferences
  const filteredEvents = useMemo(() => {
    return displayEvents.filter((event) => {
      // Filter cursor events
      if (!includeCursor && event.type === 'cursor') {
        return false;
      }
      // Filter message events
      if (!includeMessages && event.type === 'message') {
        return false;
      }
      return true;
    });
  }, [displayEvents, includeCursor, includeMessages]);

  const totalCount = displayEvents.length;
  const displayCount = filteredEvents.length;
  const missedCount = isPaused ? events.length - frozenEvents.length : 0;

  return (
    <Drawer
      title={
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Title level={4} style={{ margin: 0 }}>
            Live Event Stream
            <Tag color="blue" style={{ marginLeft: 8, fontSize: 10, verticalAlign: 'middle' }}>
              BETA
            </Tag>
            <Badge
              count={displayCount}
              showZero
              style={{ marginLeft: 12, backgroundColor: token.colorPrimary }}
            />
          </Title>
        </Space>
      }
      placement="right"
      onClose={onClose}
      open={open}
      width={600}
      closeIcon={<CloseOutlined />}
      extra={
        <Space>
          <Button
            icon={isPaused ? <PlayCircleOutlined /> : <PauseOutlined />}
            onClick={handlePauseToggle}
            type={isPaused ? 'primary' : 'default'}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </Button>
          <Button
            icon={<DeleteOutlined />}
            onClick={onClear}
            disabled={totalCount === 0}
            type="text"
            danger
          >
            Clear
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* Filters */}
        <div
          style={{
            padding: 12,
            background: token.colorBgContainer,
            borderRadius: token.borderRadius,
            border: `1px solid ${token.colorBorder}`,
          }}
        >
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            Filters:
          </Text>
          <Space direction="vertical" size="small">
            <Checkbox checked={includeCursor} onChange={(e) => setIncludeCursor(e.target.checked)}>
              Include cursor movement
            </Checkbox>
            <Checkbox
              checked={includeMessages}
              onChange={(e) => setIncludeMessages(e.target.checked)}
            >
              Include message streams
            </Checkbox>
          </Space>
          {totalCount !== displayCount && (
            <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
              Showing {displayCount} of {totalCount} events
            </Text>
          )}
          {isPaused && missedCount > 0 && (
            <Text type="warning" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
              {missedCount} new events captured while paused
            </Text>
          )}
        </div>

        {/* Event list */}
        <div style={{ minHeight: 400 }}>
          {filteredEvents.length === 0 ? (
            <Empty
              description={
                totalCount === 0 ? 'No events captured yet' : 'No events match current filters'
              }
              style={{ marginTop: 60 }}
            />
          ) : (
            <div
              style={{
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: token.borderRadius,
                overflow: 'hidden',
              }}
            >
              {filteredEvents.map((event) => (
                <EventItem key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </Space>
    </Drawer>
  );
};
