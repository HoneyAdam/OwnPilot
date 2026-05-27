import { describe, it, expect } from 'vitest';
import { BASE_SYSTEM_PROMPT, CLI_SYSTEM_PROMPT } from './prompt.js';

describe('agent-prompt', () => {
  // ---------------------------------------------------------------------------
  // Exports
  // ---------------------------------------------------------------------------
  describe('exports', () => {
    it('exports BASE_SYSTEM_PROMPT as a string', () => {
      expect(typeof BASE_SYSTEM_PROMPT).toBe('string');
    });

    it('exports CLI_SYSTEM_PROMPT as a string', () => {
      expect(typeof CLI_SYSTEM_PROMPT).toBe('string');
    });

    it('BASE_SYSTEM_PROMPT is not empty', () => {
      expect(BASE_SYSTEM_PROMPT.length).toBeGreaterThan(0);
    });

    it('BASE_SYSTEM_PROMPT is a reasonable length (~85 lines)', () => {
      expect(BASE_SYSTEM_PROMPT.length).toBeGreaterThan(2000);
      expect(BASE_SYSTEM_PROMPT.length).toBeLessThan(6000);
    });
  });

  // ---------------------------------------------------------------------------
  // Identity section
  // ---------------------------------------------------------------------------
  describe('identity section', () => {
    it('contains "OwnPilot" brand name', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('OwnPilot');
    });

    it('contains "privacy-first" value prop', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('privacy-first');
    });

    it('starts with "You are OwnPilot"', () => {
      expect(BASE_SYSTEM_PROMPT.startsWith('You are OwnPilot')).toBe(true);
    });

    it('instructs not to claim to be Claude/ChatGPT/Gemini', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('not Claude, ChatGPT, or Gemini');
    });
  });

  // ---------------------------------------------------------------------------
  // Core Sections
  // ---------------------------------------------------------------------------
  describe('core sections', () => {
    it('contains "## Identity" section', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('## Identity');
    });

    it('contains "## Decision Rules" section', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('## Decision Rules');
    });

    it('contains "## Tool Calling" section', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('## Tool Calling');
    });

    it('contains "## Proactive Rules" section', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('## Proactive Rules');
    });

    it('contains "## Memory Protocol" section', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('## Memory Protocol');
    });

    it('contains "## Output Rules" section', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('## Output Rules');
    });

    it('contains "## End Every Response With" section for suggestions', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('## End Every Response With');
    });
  });

  // ---------------------------------------------------------------------------
  // Tool Calling
  // ---------------------------------------------------------------------------
  describe('tool calling', () => {
    it('documents use_tool with namespace format', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('use_tool("namespace.tool_name"');
    });

    it('documents batch_use_tool', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('batch_use_tool');
    });

    it('documents _reason field requirement', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('_reason');
    });

    it('documents namespace prefixes', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('core.*');
      expect(BASE_SYSTEM_PROMPT).toContain('custom.*');
      expect(BASE_SYSTEM_PROMPT).toContain('plugin.');
      expect(BASE_SYSTEM_PROMPT).toContain('ext.');
      expect(BASE_SYSTEM_PROMPT).toContain('mcp.');
    });
  });

  // ---------------------------------------------------------------------------
  // Proactive Rules
  // ---------------------------------------------------------------------------
  describe('proactive rules', () => {
    it('contains table format for proactive mappings', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('| User says | You do |');
      expect(BASE_SYSTEM_PROMPT).toContain('remind me...');
    });

    it('mentions create_task for reminders', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('Create task');
    });

    it('mentions habits for habit tracking', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('habits');
    });
  });

  // ---------------------------------------------------------------------------
  // Memory Protocol
  // ---------------------------------------------------------------------------
  describe('memory protocol', () => {
    it('contains <memories> tag format', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('<memories>');
      expect(BASE_SYSTEM_PROMPT).toContain('</memories>');
    });

    it('contains memory types', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('fact');
      expect(BASE_SYSTEM_PROMPT).toContain('preference');
      expect(BASE_SYSTEM_PROMPT).toContain('conversation');
    });

    it('instructs to search memories before answering personal questions', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('search_memories');
    });
  });

  // ---------------------------------------------------------------------------
  // Output Rules
  // ---------------------------------------------------------------------------
  describe('output rules', () => {
    it('instructs to be concise', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('Concise');
    });

    it('instructs to use friendly names instead of tool identifiers', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('Friendly names');
      expect(BASE_SYSTEM_PROMPT).toContain('Say "email tool" not "core.send_email"');
    });

    it('instructs to retry on errors', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('On errors');
      expect(BASE_SYSTEM_PROMPT).toContain('retry');
    });
  });

  // ---------------------------------------------------------------------------
  // Chat Widgets
  // ---------------------------------------------------------------------------
  describe('chat widgets', () => {
    it('documents widget tag format', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('<widget');
    });

    it('lists supported widget types', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('metric_grid');
      expect(BASE_SYSTEM_PROMPT).toContain('table');
      expect(BASE_SYSTEM_PROMPT).toContain('key_value');
      expect(BASE_SYSTEM_PROMPT).toContain('cards');
    });
  });

  // ---------------------------------------------------------------------------
  // Suggestions
  // ---------------------------------------------------------------------------
  describe('suggestions', () => {
    it('contains <suggestions> tag format', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('<suggestions>');
      expect(BASE_SYSTEM_PROMPT).toContain('</suggestions>');
    });

    it('specifies max 3 suggestions', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('Max 3');
    });

    it('marks suggestions as required', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('This is required');
    });
  });

  // ---------------------------------------------------------------------------
  // Tool Categories
  // ---------------------------------------------------------------------------
  describe('tool categories', () => {
    it('mentions Personal tools', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('Personal');
    });

    it('mentions Data tools', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('Data');
    });

    it('mentions Files tools', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('Files');
    });

    it('mentions Automation tools', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('Automation');
    });

    it('mentions Memory tools', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('Memory');
    });

    it('mentions Goals tools', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('Goals');
    });

    it('mentions Web tools', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('Web');
    });

    it('mentions Claw tools', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('Claw');
    });

    it('mentions search_tools for discovery', () => {
      expect(BASE_SYSTEM_PROMPT).toContain('search_tools');
    });
  });

  // ---------------------------------------------------------------------------
  // CLI System Prompt
  // ---------------------------------------------------------------------------
  describe('CLI_SYSTEM_PROMPT', () => {
    it('establishes OwnPilot identity', () => {
      expect(CLI_SYSTEM_PROMPT).toContain('OwnPilot');
    });

    it('is different from BASE_SYSTEM_PROMPT', () => {
      expect(CLI_SYSTEM_PROMPT).not.toBe(BASE_SYSTEM_PROMPT);
    });

    it('contains tool calling documentation', () => {
      expect(CLI_SYSTEM_PROMPT).toContain('use_tool');
    });

    it('contains proactive rules', () => {
      expect(CLI_SYSTEM_PROMPT).toContain('Proactive');
    });

    it('contains memory protocol', () => {
      expect(CLI_SYSTEM_PROMPT).toContain('Memory Protocol');
    });

    it('contains suggestions', () => {
      expect(CLI_SYSTEM_PROMPT).toContain('suggestions');
    });
  });

  // ---------------------------------------------------------------------------
  // Structural integrity
  // ---------------------------------------------------------------------------
  describe('structural integrity', () => {
    it('ends with suggestions section', () => {
      const lastLine = BASE_SYSTEM_PROMPT.trim().split('\n').pop()!;
      expect(lastLine).toContain('actionable');
    });

    it('has no unclosed backtick code blocks', () => {
      const tripleBackticks = (BASE_SYSTEM_PROMPT.match(/```/g) || []).length;
      expect(tripleBackticks % 2).toBe(0);
    });

    it('has balanced <memories> tags', () => {
      const opens = (BASE_SYSTEM_PROMPT.match(/<memories>/g) || []).length;
      const closes = (BASE_SYSTEM_PROMPT.match(/<\/memories>/g) || []).length;
      expect(opens).toBe(closes);
    });

    it('has balanced <suggestions> tags', () => {
      const opens = (BASE_SYSTEM_PROMPT.match(/<suggestions>/g) || []).length;
      const closes = (BASE_SYSTEM_PROMPT.match(/<\/suggestions>/g) || []).length;
      expect(opens).toBe(closes);
    });

    it('does not contain tab characters (uses spaces)', () => {
      expect(BASE_SYSTEM_PROMPT).not.toContain('\t');
    });
  });
});
