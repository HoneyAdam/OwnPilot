import { useState } from 'react';
import {
  Bot,
  Wrench,
  Check,
  XCircle,
  Shield,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from './icons';
import { CodeBlock } from './CodeBlock';
import { formatToolName } from '../utils/formatters';
import type { ProgressEvent } from '../hooks/useChatStore';

interface ChatTimelineProps {
  events: ProgressEvent[];
  isLoading: boolean;
  streamingContent: string;
  isThinking: boolean;
  thinkingContent: string;
}

export function ChatTimeline({
  events,
  isLoading,
  streamingContent,
  isThinking,
  thinkingContent,
}: ChatTimelineProps) {
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());

  const toggleEvent = (idx: number) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="space-y-0">
      {/* Timeline entries */}
      {events.map((event, idx) => (
        <TimelineEntry
          key={`${event.type}-${idx}`}
          event={event}
          idx={idx}
          isExpanded={expandedEvents.has(idx)}
          onToggle={() => toggleEvent(idx)}
        />
      ))}

      {/* Currently streaming — live indicator */}
      {isLoading && (
        <div className="flex items-start gap-3 pl-4">
          <div className="relative flex flex-col items-center">
            <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
            <div className="w-px h-6 bg-border dark:bg-dark-border mt-1" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm text-text-muted dark:text-dark-text-muted">
              <Bot className="w-4 h-4" />
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        </div>
      )}

      {/* Streaming content preview */}
      {isLoading && streamingContent && (
        <div className="flex items-start gap-3 pl-4">
          <div className="relative flex flex-col items-center">
            <div className="w-3 h-3 bg-primary/40 rounded-full" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-text-secondary dark:text-dark-text-secondary leading-relaxed">
              {streamingContent.length > 300
                ? streamingContent.slice(0, 300) + '...'
                : streamingContent}
              <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
            </div>
          </div>
        </div>
      )}

      {/* Thinking block */}
      {isThinking && thinkingContent && (
        <div className="flex items-start gap-3 pl-4">
          <div className="relative flex flex-col items-center">
            <div className="w-3 h-3 bg-purple-500/40 rounded-full animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-purple-400 dark:text-purple-300 font-medium mb-1">
              Thinking
            </div>
            <div className="text-xs text-text-muted dark:text-dark-text-muted leading-relaxed whitespace-pre-wrap bg-purple-500/5 border border-purple-500/20 rounded-lg px-3 py-2 max-h-48 overflow-y-auto">
              {thinkingContent}
            </div>
          </div>
        </div>
      )}

      {/* End marker */}
      {!isLoading && events.length > 0 && (
        <div className="flex items-center gap-3 pl-4 py-2">
          <div className="w-3 h-3 bg-success/30 rounded-full" />
          <span className="text-xs text-text-muted dark:text-dark-text-muted">
            Response complete
          </span>
        </div>
      )}
    </div>
  );
}

interface TimelineEntryProps {
  event: ProgressEvent;
  idx: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function getToolStatus(event: ProgressEvent): 'pending' | 'running' | 'success' | 'error' {
  if (event.type === 'tool_start') return 'running';
  if (event.type === 'tool_blocked') return 'error';
  if (event.type === 'tool_end') {
    return event.result?.success === false ? 'error' : 'success';
  }
  return 'pending';
}

function TimelineEntry({ event, idx, isExpanded, onToggle }: TimelineEntryProps) {
  const status = getToolStatus(event);
  const isLocalExec = event.type === 'tool_end' && event.result?.sandboxed === false;
  const isBlocked =
    event.type === 'tool_end' && event.result?.preview?.includes('blocked in Execution Security');
  const isSecurityBlocked = event.type === 'tool_blocked';

  return (
    <div className="flex items-start gap-3 pl-4">
      {/* Timeline connector */}
      <div className="relative flex flex-col items-center">
        <div
          className={`w-3 h-3 rounded-full flex items-center justify-center flex-shrink-0 ${
            status === 'running'
              ? 'bg-warning animate-pulse'
              : status === 'success'
                ? 'bg-success'
                : status === 'error'
                  ? 'bg-error'
                  : 'bg-text-muted/30'
          }`}
        >
          {status === 'success' && <Check className="w-2 h-2 text-white" />}
          {status === 'error' && <XCircle className="w-2 h-2 text-white" />}
          {status === 'running' && <Wrench className="w-2 h-2 text-white" />}
        </div>
        {idx < 100 && (
          <div className="w-px flex-1 bg-border dark:bg-dark-border mt-1 min-h-[24px]" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-2">
        {/* Header row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status text */}
          {event.type === 'status' && (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <span className="text-text-secondary dark:text-dark-text-secondary">
                {event.message}
              </span>
            </div>
          )}

          {event.type === 'tool_start' && (
            <div className="flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-warning" />
              <span className="text-sm text-text-primary dark:text-dark-text-primary font-medium">
                Calling {formatToolName(event.tool?.name ?? 'tool')}
              </span>
              {event.tool?.reason && (
                <span className="text-xs text-text-muted dark:text-dark-text-muted">
                  — {event.tool.reason}
                </span>
              )}
            </div>
          )}

          {event.type === 'tool_end' && (
            <div className="flex items-center gap-1.5">
              {event.result?.success ? (
                <Check className="w-3.5 h-3.5 text-success" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-error" />
              )}
              <span className="text-sm text-text-primary dark:text-dark-text-primary font-medium">
                {formatToolName(event.tool?.name ?? 'tool')}
              </span>
              <span className="text-xs text-text-muted dark:text-dark-text-muted">
                {event.result?.durationMs}ms
              </span>
              {event.tool?.reason && (
                <span className="text-xs text-text-muted dark:text-dark-text-muted">
                  — {event.tool.reason}
                </span>
              )}
            </div>
          )}

          {event.type === 'tool_blocked' && (
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-red-500" />
              <span className="text-sm text-error font-medium">
                Blocked {formatToolName(event.toolCall?.name ?? 'tool')}
              </span>
              {event.reason && (
                <span className="text-xs text-text-muted dark:text-dark-text-muted">
                  — {event.reason}
                </span>
              )}
            </div>
          )}

          {/* Badges */}
          {isLocalExec && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0 text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded font-semibold leading-4">
              <AlertTriangle className="w-3 h-3" />
              LOCAL
            </span>
          )}
          {isBlocked && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0 text-[10px] bg-red-500/15 text-red-600 dark:text-red-400 rounded font-semibold leading-4">
              <Shield className="w-3 h-3" />
              BLOCKED
            </span>
          )}
          {isSecurityBlocked && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0 text-[10px] bg-red-500/15 text-red-600 dark:text-red-400 rounded font-semibold leading-4">
              <Shield className="w-3 h-3" />
              BLOCKED
            </span>
          )}
        </div>

        {/* Expandable detail */}
        {event.type === 'tool_end' && event.result?.preview && (
          <button
            onClick={onToggle}
            className="flex items-center gap-1 mt-1 text-xs text-text-muted dark:text-dark-text-muted hover:text-primary transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            {isExpanded ? 'Hide' : 'Show'} result
          </button>
        )}

        {event.type === 'tool_end' && isExpanded && (
          <div className="mt-2 rounded-lg border border-border dark:border-dark-border bg-bg-secondary/50 dark:bg-dark-bg-secondary/50 overflow-hidden">
            {/* Args */}
            {event.tool?.arguments && Object.keys(event.tool.arguments).length > 0 && (
              <div className="border-b border-border dark:border-dark-border">
                <button
                  onClick={() => {}}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary dark:text-dark-text-secondary hover:bg-bg-tertiary dark:hover:bg-dark-bg-tertiary transition-colors"
                >
                  <ChevronRight className="w-3 h-3" />
                  Arguments
                </button>
                <div className="px-3 pb-2">
                  <CodeBlock
                    code={JSON.stringify(event.tool.arguments, null, 2)}
                    language="json"
                    showLineNumbers={false}
                    maxHeight="150px"
                  />
                </div>
              </div>
            )}

            {/* Result preview */}
            <div className="px-3 py-2">
              <span className="text-xs text-text-muted dark:text-dark-text-muted font-medium mb-1 block">
                Result
              </span>
              <div className="text-xs text-text-secondary dark:text-dark-text-secondary leading-relaxed">
                {event.result?.preview && event.result.preview.length > 500
                  ? event.result?.preview.slice(0, 500) + '...'
                  : event.result?.preview}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
