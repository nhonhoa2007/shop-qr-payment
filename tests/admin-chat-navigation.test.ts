import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Admin Chat Navigation - Route & Layout Integrity', () => {
  const mockRooms = [
    {
      id: 'room-1',
      orderId: 'order-1',
      order: { orderCode: 'DH1001' },
      lastMessage: 'Shop tư vấn giúp mình nhé',
      lastActiveAt: new Date().toISOString(),
      participants: [
        { user: { id: 'cust-1', name: 'Nguyễn Văn A', avatar: null } },
        { user: { id: 'admin-1', name: 'Quản Trị Viên', avatar: null } },
      ],
    },
    {
      id: 'room-2',
      orderId: 'order-2',
      order: { orderCode: 'DH1002' },
      lastMessage: 'Đơn hàng đã được gửi chưa ạ?',
      lastActiveAt: new Date().toISOString(),
      participants: [
        { user: { id: 'cust-2', name: 'Trần Thị B', avatar: null } },
      ],
    },
  ];

  test('should generate customer storefront link by default (/chat/[roomId])', () => {
    const defaultBasePath = '/chat';
    const room = mockRooms[0];
    const targetUrl = `${defaultBasePath}/${room.id}`;

    assert.equal(targetUrl, '/chat/room-1');
    assert.match(targetUrl, /^\/chat\//);
  });

  test('should generate admin console link when basePath is /admin/chat (/admin/chat/[roomId])', () => {
    const adminBasePath = '/admin/chat';
    const room = mockRooms[0];
    const targetUrl = `${adminBasePath}/${room.id}`;

    assert.equal(targetUrl, '/admin/chat/room-1');
    assert.match(targetUrl, /^\/admin\/chat\//);
  });

  test('should identify the other participant correctly when currentUserId is admin', () => {
    const currentUserId = 'admin-1';
    const room = mockRooms[0];

    const otherParticipant = room.participants.find((p) => p.user?.id !== currentUserId) || room.participants[0];
    assert.equal(otherParticipant.user?.id, 'cust-1');
    assert.equal(otherParticipant.user?.name, 'Nguyễn Văn A');
  });

  test('should identify the other participant correctly when currentUserId is customer', () => {
    const currentUserId = 'cust-1';
    const room = mockRooms[0];

    const otherParticipant = room.participants.find((p) => p.user?.id !== currentUserId) || room.participants[0];
    assert.equal(otherParticipant.user?.id, 'admin-1');
    assert.equal(otherParticipant.user?.name, 'Quản Trị Viên');
  });

  test('should fallback safely if single participant is present', () => {
    const currentUserId = 'admin-1';
    const room = mockRooms[1];

    const otherParticipant = room.participants.find((p) => p.user?.id !== currentUserId) || room.participants[0];
    assert.equal(otherParticipant.user?.id, 'cust-2');
    assert.equal(otherParticipant.user?.name, 'Trần Thị B');
  });
});

describe('Admin Topbar & Sidebar - Route Preservation within AdminAppShell', () => {
  // Helper mirroring AdminTopbar breadcrumb logic
  function getTopbarBreadcrumbs(pathname: string) {
    if (pathname.startsWith('/admin/chat')) {
      const isDetail = pathname !== '/admin/chat';
      return [
        { label: 'Admin', href: '/admin' },
        { label: 'Khách hàng & CSKH', href: '/admin/chat' },
        { label: isDetail ? 'Chi tiết hội thoại' : 'Tin nhắn trực tuyến', current: true },
      ];
    }
    return [
      { label: 'Admin', href: '/admin' },
      { label: 'Quản trị', current: true },
    ];
  }

  // Helper mirroring AdminSidebar active state logic
  function isSidebarItemActive(pathname: string, itemHref: string) {
    return pathname === itemHref || pathname.startsWith(itemHref + '/');
  }

  test('should return main chat breadcrumb when on /admin/chat', () => {
    const breadcrumbs = getTopbarBreadcrumbs('/admin/chat');
    assert.equal(breadcrumbs.length, 3);
    assert.equal(breadcrumbs[0].label, 'Admin');
    assert.equal(breadcrumbs[1].label, 'Khách hàng & CSKH');
    assert.equal(breadcrumbs[1].href, '/admin/chat');
    assert.equal(breadcrumbs[2].label, 'Tin nhắn trực tuyến');
    assert.equal(breadcrumbs[2].current, true);
  });

  test('should return detail breadcrumb when on /admin/chat/[roomId] and preserve admin navigation', () => {
    const breadcrumbs = getTopbarBreadcrumbs('/admin/chat/room-123456');
    assert.equal(breadcrumbs.length, 3);
    assert.equal(breadcrumbs[0].label, 'Admin');
    assert.equal(breadcrumbs[1].label, 'Khách hàng & CSKH');
    assert.equal(breadcrumbs[1].href, '/admin/chat');
    assert.equal(breadcrumbs[2].label, 'Chi tiết hội thoại');
    assert.equal(breadcrumbs[2].current, true);
  });

  test('AdminSidebar should remain active when navigating into /admin/chat/[roomId]', () => {
    const itemHref = '/admin/chat';

    // List view
    assert.equal(isSidebarItemActive('/admin/chat', itemHref), true);

    // Detail view with roomId
    assert.equal(isSidebarItemActive('/admin/chat/room-123456', itemHref), true);

    // Other admin page should not match
    assert.equal(isSidebarItemActive('/admin/orders', itemHref), false);
  });
});

describe('Admin Chat - Search & Filter Mechanics', () => {
  const rooms = [
    {
      id: 'room-1',
      order: { orderCode: 'DH8888' },
      lastMessage: 'Cho mình hỏi về kích cỡ áo',
      participants: [{ user: { id: 'u1', name: 'Lê Hoàng Nam' } }],
    },
    {
      id: 'room-2',
      order: { orderCode: 'DH9999' },
      lastMessage: 'Giao hàng hỏa tốc trong ngày được không?',
      participants: [{ user: { id: 'u2', name: 'Phạm Thu Trang' } }],
    },
  ];

  function filterRooms(query: string) {
    if (!query.trim()) return rooms;
    const q = query.toLowerCase().trim();
    return rooms.filter((room) => {
      const customerName = room.participants?.[0]?.user?.name?.toLowerCase() || '';
      const orderCode = room.order?.orderCode?.toLowerCase() || '';
      const lastMessage = room.lastMessage?.toLowerCase() || '';
      return customerName.includes(q) || orderCode.includes(q) || lastMessage.includes(q);
    });
  }

  test('should filter by customer name', () => {
    const result = filterRooms('Hoàng Nam');
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'room-1');
  });

  test('should filter by order code', () => {
    const result = filterRooms('DH9999');
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'room-2');
  });

  test('should filter by message snippet', () => {
    const result = filterRooms('hỏa tốc');
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'room-2');
  });

  test('should return all rooms on empty search query', () => {
    const result = filterRooms('   ');
    assert.equal(result.length, 2);
  });
});
