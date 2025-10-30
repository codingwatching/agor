import type { AgorClient } from '@agor/core/api';
import type { AgorConfig } from '@agor/core/config';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Alert, Button, Input, Space, Spin, Tag, Typography, theme } from 'antd';
import { useEffect, useState } from 'react';

const { Text, Link } = Typography;

export interface AgenticToolsTabProps {
  client: AgorClient | null;
}

interface KeyStatus {
  ANTHROPIC_API_KEY: boolean;
  OPENAI_API_KEY: boolean;
  GEMINI_API_KEY: boolean;
}

export const AgenticToolsTab: React.FC<AgenticToolsTabProps> = ({ client }) => {
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [keyStatus, setKeyStatus] = useState<KeyStatus>({
    ANTHROPIC_API_KEY: false,
    OPENAI_API_KEY: false,
    GEMINI_API_KEY: false,
  });
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  // Load current config on mount
  useEffect(() => {
    if (!client) return;

    const loadConfig = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get credentials section from config service
        const config = (await client.service('config').get('credentials')) as
          | AgorConfig['credentials']
          | undefined;

        // Check which keys are set (truthy values mean key exists)
        setKeyStatus({
          ANTHROPIC_API_KEY: !!config?.ANTHROPIC_API_KEY,
          OPENAI_API_KEY: !!config?.OPENAI_API_KEY,
          GEMINI_API_KEY: !!config?.GEMINI_API_KEY,
        });
      } catch (err) {
        console.error('Failed to load config:', err);
        setError(err instanceof Error ? err.message : 'Failed to load configuration');
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [client]);

  // Save handler - add new key
  const handleSave = async (field: keyof KeyStatus) => {
    if (!client) return;

    const value = inputValues[field]?.trim();
    if (!value) return;

    try {
      setSaving(prev => ({ ...prev, [field]: true }));
      setError(null);

      // Update config via PATCH
      await client.service('config').patch(null, {
        credentials: {
          [field]: value,
        },
      });

      // Update status to reflect key is now set
      setKeyStatus(prev => ({ ...prev, [field]: true }));
      setInputValues(prev => ({ ...prev, [field]: '' }));
    } catch (err) {
      console.error(`Failed to save ${field}:`, err);
      setError(err instanceof Error ? err.message : `Failed to save ${field}`);
    } finally {
      setSaving(prev => ({ ...prev, [field]: false }));
    }
  };

  // Clear handler - remove key
  const handleClear = async (field: keyof KeyStatus) => {
    if (!client) return;

    try {
      setSaving(prev => ({ ...prev, [field]: true }));
      setError(null);

      // Clear the key by sending null (undefined gets stripped by JSON serialization)
      await client.service('config').patch(null, {
        credentials: {
          [field]: null,
        },
      });

      // Update status to reflect key is now cleared
      setKeyStatus(prev => ({ ...prev, [field]: false }));
    } catch (err) {
      console.error(`Failed to clear ${field}:`, err);
      setError(err instanceof Error ? err.message : `Failed to clear ${field}`);
    } finally {
      setSaving(prev => ({ ...prev, [field]: false }));
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: token.paddingLG }}>
        <Spin size="large" />
      </div>
    );
  }

  const renderKeyField = (
    field: keyof KeyStatus,
    label: string,
    description: string,
    placeholder: string,
    docUrl: string
  ) => {
    const isSet = keyStatus[field];

    return (
      <div key={field} style={{ marginBottom: token.marginLG }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Space>
            <Text strong>{label}</Text>
            <Text type="secondary">{description}</Text>
            {isSet ? (
              <Tag icon={<CheckCircleOutlined />} color="success">
                Set
              </Tag>
            ) : (
              <Tag icon={<CloseCircleOutlined />} color="default">
                Not Set
              </Tag>
            )}
          </Space>

          {isSet ? (
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleClear(field)}
              loading={saving[field]}
            >
              Clear Key
            </Button>
          ) : (
            <Space.Compact style={{ width: '100%' }}>
              <Input.Password
                placeholder={placeholder}
                value={inputValues[field] || ''}
                onChange={e => setInputValues(prev => ({ ...prev, [field]: e.target.value }))}
                onPressEnter={() => handleSave(field)}
                style={{ flex: 1 }}
              />
              <Button
                type="primary"
                onClick={() => handleSave(field)}
                loading={saving[field]}
                disabled={!inputValues[field]?.trim()}
              >
                Save
              </Button>
            </Space.Compact>
          )}

          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            Get your key at:{' '}
            <Link href={docUrl} target="_blank">
              {docUrl}
            </Link>
          </Text>
        </Space>
      </div>
    );
  };

  return (
    <div style={{ padding: token.paddingMD }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Alert
          message="Authentication Methods"
          description={
            <div>
              <p style={{ marginBottom: token.marginXS }}>
                There are three ways to authenticate with AI providers,{' '}
                <strong>in order of precedence</strong>:
              </p>
              <ol style={{ paddingLeft: token.paddingMD, marginBottom: 0 }}>
                <li style={{ marginBottom: token.marginXXS }}>
                  <strong>This UI or CLI</strong> (<code>agor config set</code>) - Keys stored in{' '}
                  <code>~/.agor/config.yaml</code> <strong>override all other methods</strong> and
                  take effect immediately
                </li>
                <li style={{ marginBottom: token.marginXXS }}>
                  <strong>Environment variables</strong> - Set <code>ANTHROPIC_API_KEY</code>,{' '}
                  <code>OPENAI_API_KEY</code>, etc. wherever you start the Agor daemon
                </li>
                <li>
                  <strong>Individual CLI flows</strong> (e.g., <code>claude login</code>) - Each
                  tool retains authentication in its own config
                </li>
              </ol>
            </div>
          }
          type="info"
          icon={<InfoCircleOutlined />}
          showIcon
        />

        {error && (
          <Alert
            message={error}
            type="error"
            icon={<WarningOutlined />}
            showIcon
            closable
            onClose={() => setError(null)}
          />
        )}

        {renderKeyField(
          'ANTHROPIC_API_KEY',
          'Anthropic API Key',
          '(Claude Code / Agent SDK)',
          'sk-ant-api03-...',
          'https://console.anthropic.com'
        )}

        {renderKeyField(
          'OPENAI_API_KEY',
          'OpenAI API Key',
          '(Codex)',
          'sk-proj-...',
          'https://platform.openai.com/api-keys'
        )}

        {renderKeyField(
          'GEMINI_API_KEY',
          'Gemini API Key',
          '',
          'AIza...',
          'https://aistudio.google.com/app/apikey'
        )}
      </Space>
    </div>
  );
};
