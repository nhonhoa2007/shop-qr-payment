import { after } from 'next/server';
import {
  processTelegramOutbox,
  type ProcessTelegramOutboxOptions,
  type TelegramOutboxProcessResult,
} from '@server/modules/telegram/telegram-outbox.service';

type FastPathProcessor = (
  options: ProcessTelegramOutboxOptions
) => Promise<TelegramOutboxProcessResult>;
type FastPathScheduler = (task: () => Promise<void>) => void;

export function scheduleTelegramOutboxFastPath(options: {
  schedule?: FastPathScheduler;
  processor?: FastPathProcessor;
} = {}): void {
  const schedule = options.schedule ?? ((task) => after(task));
  const processor = options.processor ?? processTelegramOutbox;
  schedule(async () => {
    try {
      await processor({ batchSize: 10 });
    } catch (error) {
      console.error('[Telegram Outbox] Fast path failed:', {
        error: error instanceof Error ? error.message.slice(0, 300) : 'Unknown error',
      });
    }
  });
}
