#!/usr/bin/env python3
"""Generate editable stack-diagram drafts from the current shop architecture."""

from __future__ import annotations

from html import escape
from pathlib import Path
import os
import re


ROOT = Path(__file__).resolve().parent
SKILL = Path(os.environ.get("CODEX_HOME", str(Path.home() / ".codex"))) / "skills/stack-diagram"
TEMPLATE = (SKILL / "assets/template.html").read_text(encoding="utf-8")


def group(kind: str, x: int, y: int, w: int, h: int, label: str, icon: str = "") -> str:
    image = f'<img src="%%ICON_{icon}%%" alt="">' if icon else ""
    return (f'<div class="group {kind}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">'
            f'<div class="g-label">{image}{escape(label)}</div></div>')


def node(x: int, y: int, name: str, role: str, icon: str, tile: str = "") -> str:
    return (f'<div class="node" style="left:{x-66}px;top:{y}px">'
            f'<div class="tile {tile}"><img src="%%ICON_{icon}%%" alt=""></div>'
            f'<div class="name"><span>{escape(name)}</span></div>'
            f'<div class="role"><span>{escape(role)}</span></div></div>')


def edge(path: str, label: str = "", tx: int = 0, ty: int = 0,
         primary: bool = False, dashed: bool = False) -> str:
    cls = "e" if primary else "n"
    if dashed:
        cls += " dash"
    result = f'<path class="{cls}" d="{path}" marker-end="url(#ar)"/>'
    if label:
        label_cls = "el a" if primary else "el"
        result += f'<text class="{label_cls}" x="{tx}" y="{ty}" text-anchor="middle">{escape(label)}</text>'
    return result


MARKER = '''<defs>
      <marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill="context-stroke"/>
      </marker>
    </defs>'''


def make(filename: str, title: str, kicker: str, lede: str, width: int, height: int,
         groups: list[str], edges: list[str], nodes: list[str], foot: str) -> None:
    html = TEMPLATE
    html = html.replace('<html lang="en">', '<html lang="vi">')
    html = html.replace('<!-- TITLE -->', escape(title))
    html = re.sub(r'<div class="kicker">.*?</div>', f'<div class="kicker">{escape(kicker)}</div>', html, count=1)
    html = re.sub(r'<p class="lede">.*?</p>', f'<p class="lede">{escape(lede)}</p>', html, count=1)
    html = re.sub(r'\.canvas \{ position: relative; width: 1000px; height: 540px;',
                  f'.canvas {{ position: relative; width: {width}px; height: {height}px;', html, count=1)
    html = re.sub(r'svg\.edges \{ position:absolute; inset:0; width:1000px; height:540px;',
                  f'svg.edges {{ position:absolute; inset:0; width:{width}px; height:{height}px;', html, count=1)
    start = html.index('    <!-- GROUPS ')
    end = html.index('  </div>\n  </div>\n\n  <div class="legend">', start)
    body = ('    <!-- GROUPS -->\n    ' + '\n    '.join(groups) + '\n'
            '    <!-- EDGES -->\n'
            f'    <svg class="edges" viewBox="0 0 {width} {height}" aria-hidden="true">\n'
            f'      {MARKER}\n      ' + '\n      '.join(edges) + '\n    </svg>\n'
            '    <!-- NODES -->\n    ' + '\n    '.join(nodes) + '\n')
    html = html[:start] + body + html[end:]
    html = html.replace('request path', 'luồng chính').replace('internal', 'kết nối phụ').replace('dev / deploy', 'tác vụ nền')
    html = html.replace('<!-- FOOT-LEFT: author / one-liner -->', escape(foot))
    html = html.replace('<!-- FOOT-RIGHT: icon sources actually used, from manifest.json, e.g. "icons: svgl / devicon / Lucide" -->',
                        'icons: svgl / gilbarbara / SePay / GHN / Lucide')
    (ROOT / filename).write_text(html, encoding="utf-8")


make(
    "system-architecture.draft.html",
    "Kiến trúc hệ thống Shop QR Payment",
    "SHOP QR PAYMENT / KIẾN TRÚC HIỆN TẠI",
    "Next.js xử lý giao diện và API; Prisma lưu dữ liệu, Redis hỗ trợ cache và giới hạn truy cập. Các dịch vụ ngoài được gọi theo từng luồng nghiệp vụ.",
    1400, 720,
    [
        group("gb", 220, 65, 575, 455, "Ứng dụng Next.js", "nextjs"),
        group("ga", 830, 65, 530, 205, "Dữ liệu", "postgresql"),
        group("ga", 830, 300, 530, 395, "Dịch vụ bên ngoài"),
    ],
    [
        edge("M126 180 H284", "HTTPS", 205, 171, True),
        edge("M356 180 H464", "REST", 410, 171, True),
        edge("M536 180 H644", "gọi dịch vụ", 590, 171, True),
        edge("M716 180 H914", "Prisma", 815, 171, True),
        edge("M126 380 H284", "HTTPS", 205, 371),
        edge("M356 380 H415 V280 H500 V256", "admin API", 456, 272),
        edge("M680 144 V115 H1220 V144", "cache / rate limit", 952, 107),
        edge("M910 359 V295 H500 V344", "", 0, 0, True),
        edge("M536 380 H610 V315 H680 V256", "áp dụng tiền", 653, 307, True),
        edge("M716 180 H805 V285 H1090 V359", "GHN API", 984, 277),
        edge("M716 380 H805 V510 H1270 V534", "cron / outbox", 922, 504, False, True),
    ],
    [
        node(90, 150, "Khách hàng", "mua sắm", "customer"),
        node(90, 350, "Nhân viên / Admin", "vận hành", "admin"),
        node(320, 150, "Storefront", "React 19", "react"),
        node(500, 150, "API Routes", "Next.js 16", "api"),
        node(680, 150, "Nghiệp vụ", "đơn · ví · kho", "service"),
        node(320, 350, "Trang quản trị", "RBAC", "admin"),
        node(500, 350, "Webhooks", "SePay · GHN", "webhook"),
        node(680, 350, "Cron jobs", "hết hạn · outbox", "cron"),
        node(950, 150, "PostgreSQL", "dữ liệu chính", "postgresql"),
        node(1220, 150, "Upstash Redis", "cache · rate limit", "upstash"),
        node(910, 365, "SePay", "báo giao dịch", "sepay"),
        node(1090, 365, "GHN", "giao hàng", "ghn", "wide"),
        node(1270, 365, "Pusher", "chat · realtime", "pusher"),
        node(910, 545, "Resend", "OTP · email", "resend"),
        node(1090, 545, "Cloudflare R2", "ảnh sản phẩm", "cloudflare"),
        node(1270, 545, "Telegram", "duyệt đơn · báo tin", "telegram"),
    ],
    "Nguồn: src/app/api, src/server/modules, vercel.json, .env.example · 04/11/2026",
)


make(
    "system-activity.draft.html",
    "Luồng hoạt động đặt hàng và giao hàng",
    "SHOP QR PAYMENT / LUỒNG NGHIỆP VỤ CHÍNH",
    "Đường màu xanh là luồng đơn thanh toán bằng VietQR. Webhook hợp lệ nhưng giao dịch không khớp đi tới đối soát; đơn chưa trả tiền hết hạn sau 15 phút.",
    1400, 810,
    [
        group("gb", 30, 65, 1340, 210, "1 · Đặt hàng và tạo QR"),
        group("ga", 30, 305, 1340, 210, "2 · Xác nhận tiền và tạo vận đơn"),
        group("gb", 30, 545, 625, 210, "3 · Vận chuyển và hoàn tất"),
        group("ga", 700, 545, 440, 210, "Ngoại lệ / đối soát"),
    ],
    [
        edge("M136 175 H294", "chọn hàng", 215, 166, True),
        edge("M366 175 H524", "gửi đơn", 445, 166, True),
        edge("M596 175 H754", "transaction", 675, 166, True),
        edge("M826 175 H984", "15 phút", 905, 166, True),
        edge("M1056 175 H1214", "chuyển khoản", 1135, 166, True),
        edge("M1250 245 V359", "giao dịch", 1294, 306, True),
        edge("M1214 395 H1056", "HMAC", 1135, 386, True),
        edge("M984 395 H826", "khớp tiền", 905, 386, True),
        edge("M754 395 H596", "PAID", 675, 386, True),
        edge("M524 395 H366", "duyệt", 445, 386, True),
        edge("M294 395 H136", "GHN API", 215, 386, True),
        edge("M100 465 V599", "trạng thái", 141, 538, True),
        edge("M136 635 H294", "đã giao", 215, 626, True),
        edge("M366 635 H524", "Pusher", 445, 626),
        edge("M1020 465 V599", "mã / tiền sai", 1085, 538),
        edge("M1020 245 V285 H1140 V530 H690 V635 H754", "cron 15 phút", 875, 523, False, True),
    ],
    [
        node(100, 145, "Khách hàng", "giỏ hàng", "customer"),
        node(330, 145, "Checkout", "địa chỉ · coupon", "order"),
        node(560, 145, "Kiểm giá và phí", "server xác thực", "review"),
        node(790, 145, "Giữ kho", "Prisma transaction", "inventory"),
        node(1020, 145, "Mã VietQR", "PaymentRequest", "payment"),
        node(1250, 145, "Ngân hàng", "chuyển khoản", "bank"),
        node(1250, 365, "SePay", "gửi webhook", "sepay"),
        node(1020, 365, "Xác thực", "chữ ký · mã · tiền", "webhook"),
        node(790, 365, "Ghi nhận", "ledger · CONFIRMED", "done"),
        node(560, 365, "Admin duyệt", "kiểm serial / IMEI", "admin"),
        node(330, 365, "Tạo vận đơn", "GHN OpenAPI", "ship"),
        node(100, 365, "GHN webhook", "cập nhật giao hàng", "webhook"),
        node(100, 605, "Đang giao", "SHIPPING", "ship"),
        node(330, 605, "Hoàn tất", "COMPLETED", "done"),
        node(560, 605, "Thông báo", "Pusher · in-app", "notify"),
        node(790, 605, "Hủy quá hạn", "nhả tồn kho", "expire"),
        node(1020, 605, "Đối soát", "PENDING_REVIEW", "review"),
    ],
    "Nguồn: orders.controller, sepay-webhook.controller, order-fulfillment.service, ghn-webhook.controller · 04/11/2026",
)
