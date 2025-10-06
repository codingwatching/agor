#!/usr/bin/env tsx

import { execute } from '@oclif/core';

// Disable stack traces for clean CLI output (even in dev mode)
await execute({ development: false, dir: import.meta.url });
