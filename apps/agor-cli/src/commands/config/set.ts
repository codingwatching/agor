/**
 * `agor config set <key> <value>` - Set configuration value
 */

import { setConfigValue } from '@agor/core/config';
import { Args, Command } from '@oclif/core';
import chalk from 'chalk';

export default class ConfigSet extends Command {
  static description = 'Set a configuration value';

  static examples = [
    '<%= config.bin %> <%= command.id %> board experiments',
    '<%= config.bin %> <%= command.id %> session 01933e4a',
    '<%= config.bin %> <%= command.id %> repo anthropics/agor:main',
    '<%= config.bin %> <%= command.id %> agent claude-code',
    '<%= config.bin %> <%= command.id %> credentials.ANTHROPIC_API_KEY sk-ant-...',
    '<%= config.bin %> <%= command.id %> defaults.agent cursor',
  ];

  static args = {
    key: Args.string({
      description: 'Configuration key (supports dot notation: credentials.ANTHROPIC_API_KEY)',
      required: true,
    }),
    value: Args.string({
      description: 'Value to set',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(ConfigSet);
    const key = args.key as string;
    const value = args.value as string;

    try {
      await setConfigValue(key, value);

      // Mask API keys in output
      const displayValue =
        key.includes('API_KEY') || key.includes('TOKEN') ? `${value.substring(0, 10)}...` : value;

      this.log(`${chalk.green('✓')} Set ${chalk.cyan(key)} = ${chalk.yellow(displayValue)}`);
    } catch (error) {
      this.error(`Failed to set config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
