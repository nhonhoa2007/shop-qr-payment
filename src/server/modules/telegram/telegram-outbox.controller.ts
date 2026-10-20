import { NextResponse } from 'next/server';
import { verifyCronAuth } from '@server/infrastructure/cron-auth';
import {
  processTelegramOutbox,
  type TelegramOutboxProcessResult,
} from '@server/modules/telegram/telegram-outbox.service';

type TelegramOutboxProcessor = () => Promise<TelegramOutboxProcessResult>;

export function createTelegramOutboxHandler(
  processor: TelegramOutboxProcessor = processTelegramOutbox
) {
  return async function telegramOutboxHandler(req: Request) {
    if (!verifyCronAuth(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const counts = await processor();
      return NextResponse.json({ success: true, ...counts });
    } catch (error) {
      console.error('[Telegram Outbox] Cron processing failed:', {
        error: error instanceof Error ? error.message.slice(0, 300) : 'Unknown error',
      });
      return NextResponse.json(
        { error: 'Telegram outbox processing failed' },
        { status: 500 }
      );
    }
  };
}

export const GET = createTelegramOutboxHandler();
export const POST = GET;
