import { describe, it, expect, vi, beforeEach } from 'vitest';

// Record the order in which grammy handlers are registered so we can assert
// commands are wired before the catch-all message:text handler. grammy runs
// middleware in registration order and these single-arg handlers don't call
// next(), so a message:text handler registered first would swallow "/start"
// etc. (commands are text messages) and the command handlers would never fire.

const { registrationOrder, mockBot } = vi.hoisted(() => {
  const registrationOrder: string[] = [];
  const mockBot: Record<string, unknown> = {
    command: (name: string) => {
      registrationOrder.push(`command:${name}`);
      return mockBot;
    },
    on: (event: string) => {
      registrationOrder.push(`on:${event}`);
      return mockBot;
    },
    catch: () => {
      registrationOrder.push('catch');
      return mockBot;
    },
  };
  return { registrationOrder, mockBot };
});

vi.mock('grammy', () => ({
  // `new Bot(token)` must return our recorder. A constructor returning an
  // object makes `new` yield that object.
  Bot: class {
    constructor() {
      return mockBot as never;
    }
  },
  webhookCallback: vi.fn(),
}));

vi.mock('@ownpilot/core', () => ({
  getLog: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

const { TelegramBot } = await import('./bot.js');

describe('TelegramBot handler registration order', () => {
  beforeEach(() => {
    registrationOrder.length = 0;
  });

  it('registers /start, /help, /reset before the catch-all message:text handler', () => {
    new TelegramBot({ botToken: 'test-token', enabled: true });

    const msgIdx = registrationOrder.indexOf('on:message:text');
    expect(msgIdx).toBeGreaterThanOrEqual(0);

    for (const cmd of ['command:start', 'command:help', 'command:reset']) {
      const idx = registrationOrder.indexOf(cmd);
      expect(idx).toBeGreaterThanOrEqual(0);
      // Each command must be registered BEFORE the message:text catch-all,
      // otherwise grammy never dispatches it.
      expect(idx).toBeLessThan(msgIdx);
    }
  });
});
