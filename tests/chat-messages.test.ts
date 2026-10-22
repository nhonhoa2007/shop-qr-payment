import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Message } from '@shared/types';

describe('Chat Message Key & ID Resolution', () => {
  test('optimistic message replacement handles server returning raw message or wrapped message', () => {
    const currentUserId = 'user-1';
    const roomId = 'room-1';
    const tempId = `temp-${Date.now()}`;

    const tempMessage: Message = {
      id: tempId,
      roomId,
      content: 'Xin chào shop',
      senderId: currentUserId,
      sender: { id: currentUserId, name: 'Bạn' },
      type: 'TEXT',
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    let messages: Message[] = [tempMessage];

    // Scenario A: Server returns raw message object: { id: 'msg-real-1', content: '...', ... }
    const rawServerResponse = {
      id: 'msg-real-1',
      roomId,
      content: 'Xin chào shop',
      senderId: currentUserId,
      sender: { id: currentUserId, name: 'Bạn' },
      type: 'TEXT' as const,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    // Broken logic was: prev.map(msg => msg.id === tempId ? { ...data.message } : msg)
    // which caused msg to become {} and msg.id to become undefined!
    const brokenResult = messages.map((msg) =>
      msg.id === tempId ? ({ ...(rawServerResponse as Record<string, unknown>).message } as Message) : msg
    );
    assert.equal(brokenResult[0].id, undefined, 'Demonstrates the original bug: id became undefined');

    // Fixed resolution helper
    function resolveServerMessage(data: Record<string, unknown>): Message {
      return (data?.message ?? data) as Message;
    }

    const resolved = resolveServerMessage(rawServerResponse);
    assert.equal(resolved.id, 'msg-real-1');
    assert.equal(resolved.content, 'Xin chào shop');

    // Replace in list
    messages = messages.map((msg) => (msg.id === tempId ? resolved : msg));
    assert.equal(messages[0].id, 'msg-real-1');
    assert.ok(messages.every((m) => typeof m.id === 'string' && m.id.length > 0));

    // Scenario B: Server returns wrapped object: { message: { id: 'msg-real-2', ... } }
    const wrappedServerResponse = {
      message: {
        id: 'msg-real-2',
        roomId,
        content: 'Tôi muốn mua hàng',
        senderId: currentUserId,
        sender: { id: currentUserId, name: 'Bạn' },
        type: 'TEXT' as const,
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    };
    const resolvedWrapped = resolveServerMessage(wrappedServerResponse);
    assert.equal(resolvedWrapped.id, 'msg-real-2');
  });

  test('prevents duplicate keys when Pusher new-message event arrives before fetch completes', () => {
    const currentUserId = 'user-1';
    const roomId = 'room-1';
    const tempId = `temp-${Date.now()}`;

    const tempMessage: Message = {
      id: tempId,
      roomId,
      content: 'Sản phẩm còn hàng không?',
      senderId: currentUserId,
      sender: { id: currentUserId, name: 'Bạn' },
      type: 'TEXT',
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    let messages: Message[] = [tempMessage];

    // Pusher event arrives FIRST with the real message
    const pusherMessage: Message = {
      id: 'msg-server-123',
      roomId,
      content: 'Sản phẩm còn hàng không?',
      senderId: currentUserId,
      sender: { id: currentUserId, name: 'Bạn' },
      type: 'TEXT',
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    // Pusher handler with optimistic deduplication
    function handlePusherNewMessage(prev: Message[], data: Message): Message[] {
      if (prev.some((m) => m.id === data.id)) return prev;

      const pendingTempIndex = prev.findIndex(
        (m) =>
          m.id.startsWith('temp-') &&
          m.senderId === data.senderId &&
          m.content === data.content
      );
      if (pendingTempIndex !== -1) {
        const updated = [...prev];
        updated[pendingTempIndex] = data;
        return updated;
      }
      return [...prev, data];
    }

    messages = handlePusherNewMessage(messages, pusherMessage);

    // Verify temp message was replaced by pusher data without duplicating
    assert.equal(messages.length, 1);
    assert.equal(messages[0].id, 'msg-server-123');

    // Now fetch finishes afterwards
    function handleFetchComplete(prev: Message[], serverMsg: Message, tId: string): Message[] {
      if (prev.some((m) => m.id === serverMsg.id)) {
        return prev.filter((m) => m.id !== tId);
      }
      return prev.map((msg) => (msg.id === tId ? serverMsg : msg));
    }

    messages = handleFetchComplete(messages, pusherMessage, tempId);

    // Still exactly 1 message, no duplicate IDs
    assert.equal(messages.length, 1);
    assert.equal(messages[0].id, 'msg-server-123');

    // Ensure all keys are unique
    const keySet = new Set(messages.map((m) => m.id));
    assert.equal(keySet.size, messages.length);
  });

  test('prevents duplicate keys when fetch completes before Pusher event arrives', () => {
    const currentUserId = 'user-1';
    const roomId = 'room-1';
    const tempId = `temp-${Date.now()}`;

    const tempMessage: Message = {
      id: tempId,
      roomId,
      content: 'Cảm ơn shop',
      senderId: currentUserId,
      sender: { id: currentUserId, name: 'Bạn' },
      type: 'TEXT',
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    let messages: Message[] = [tempMessage];

    const serverMessage: Message = {
      id: 'msg-server-456',
      roomId,
      content: 'Cảm ơn shop',
      senderId: currentUserId,
      sender: { id: currentUserId, name: 'Bạn' },
      type: 'TEXT',
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    // 1. Fetch completes first
    function handleFetchComplete(prev: Message[], serverMsg: Message, tId: string): Message[] {
      if (prev.some((m) => m.id === serverMsg.id)) {
        return prev.filter((m) => m.id !== tId);
      }
      return prev.map((msg) => (msg.id === tId ? serverMsg : msg));
    }

    messages = handleFetchComplete(messages, serverMessage, tempId);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].id, 'msg-server-456');

    // 2. Pusher event arrives second
    function handlePusherNewMessage(prev: Message[], data: Message): Message[] {
      if (prev.some((m) => m.id === data.id)) return prev;
      return [...prev, data];
    }

    messages = handlePusherNewMessage(messages, serverMessage);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].id, 'msg-server-456');

    // Ensure keys are unique
    const keySet = new Set(messages.map((m) => m.id));
    assert.equal(keySet.size, messages.length);
  });

  test('safe key fallback ensures non-empty unique key in list rendering', () => {
    function getMessageKey(msg: { id?: string }, index: number): string {
      return msg.id && msg.id.length > 0 ? msg.id : `msg-${index}`;
    }

    assert.equal(getMessageKey({ id: 'msg-1' }, 0), 'msg-1');
    assert.equal(getMessageKey({ id: undefined }, 0), 'msg-0');
    assert.equal(getMessageKey({ id: '' }, 2), 'msg-2');
  });

  test('formatTime and formatDate handle undefined/null/invalid dates gracefully', async () => {
    const { formatTime, formatDate, formatDateTime } = await import('@shared/utils');

    assert.equal(formatTime(''), '');
    assert.equal(formatTime(undefined as unknown as string), '');
    assert.equal(formatTime('invalid-date'), '');

    assert.equal(formatDate(''), '');
    assert.equal(formatDate(undefined as unknown as string), '');
    assert.equal(formatDate('invalid-date'), '');

    assert.equal(formatDateTime(''), '');
    assert.equal(formatDateTime(undefined as unknown as string), '');

    const validIso = '2026-10-20T10:30:00.000Z';
    assert.ok(formatTime(validIso).length > 0);
    assert.ok(formatDate(validIso).length > 0);
    assert.ok(formatDateTime(validIso).length > 0);
  });
});
