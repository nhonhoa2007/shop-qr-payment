"""Build the Vietnamese architecture atlas using the stack-diagram template.

No application code or live services are changed. Reuse embedded official logos
from the existing diagrams and local Lucide pictograms; outputs work offline.
"""
from pathlib import Path
from html import escape
import os, re, subprocess, base64

ROOT = Path(__file__).resolve().parents[1]
SKILL = Path(os.environ.get('STACK_DIAGRAM_SKILL', str(Path.home()/'.codex/skills/stack-diagram')))
OUT = ROOT/'docs/architecture/diagrams'
TEMPLATE = (SKILL/'assets/template.html').read_text()
XS = [140, 420, 700, 980, 1260]
MARKER = '<defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="context-stroke"/></marker></defs>'
CSS = '''
.node{width:184px}.node .name{font-size:14px;line-height:19px}.node .role{font-family:var(--font-body);font-size:11px;line-height:16px;letter-spacing:0!important}.g-label{font-size:14px}.el{font-family:var(--font-body);font-size:12px;letter-spacing:0!important}.kicker{letter-spacing:.1em}.lede{max-width:450px;font-size:13px}.canvas-title{position:absolute;left:40px;top:18px;font:600 15px var(--font-display);color:var(--color-ink)}.tile img{max-height:36px}.tile.wide img{width:48px}.group.ga>.g-label{color:var(--color-g1-ink)}
'''

# Embed the project's own Inter fonts so Vietnamese accents use one font family.
for file,unicode_range in [('inter-latin.woff2',''),('inter-vietnamese.woff2','unicode-range:U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB;')]:
    data=base64.b64encode((ROOT/'src/app/fonts'/file).read_bytes()).decode()
    CSS += '@font-face{font-family:"Inter Local";font-style:normal;font-weight:100 900;src:url(data:font/woff2;base64,'+data+') format("woff2");'+unicode_range+'}'
CSS += ':root{--font-display:"Inter Local",sans-serif;--font-body:"Inter Local",sans-serif;}'

def node(x,y,icon,name,role):
    wide = ' wide' if icon=='ghn' else ''
    return f'<div class="node" data-key="{escape(name)}" style="left:{x-92}px;top:{y}px"><div class="tile{wide}"><img src="%%ICON_{icon}%%" alt=""></div><div class="name"><span>{escape(name)}</span></div><div class="role"><span>{escape(role)}</span></div></div>'

def group(x,y,w,h,label,kind='gb',icon=''):
    img=f'<img class="plate" src="%%ICON_{icon}%%" alt="">' if icon else ''
    return f'<div class="group {kind}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px"><div class="g-label">{img}{escape(label)}</div></div>'

def edge(path,label='',x=0,y=0,primary=True):
    return f'<path class="{"e" if primary else "n"}" d="{path}" marker-end="url(#ar)"/>'+ (f'<text class="el{" a" if primary else ""}" x="{x}" y="{y}" text-anchor="middle">{escape(label)}</text>' if label else '')

def row(y,label,specs,kind='gb',reverse=False,labels=None):
    points=list(reversed(XS)) if reverse else XS
    ns=[node(x,y,*s) for x,s in zip(points,specs)]
    es=[]
    for i,(x,x2) in enumerate(zip(points,points[1:])):
        direction=1 if x2>x else -1
        if labels and labels[i] is None: continue
        es.append(edge(f'M{x+36*direction} {y+30} H{x2-36*direction}', (labels or ['']*4)[i],(x+x2)//2,y+21))
    return [group(32,y-60,1336,205,label,kind)],es,ns

DIAGRAMS=[]
def make(slug,title,lede,gs,es,ns,height=850):
    html=TEMPLATE.replace('<html lang="en">','<html lang="vi">')
    html=html.replace('<!-- TITLE -->',escape(title))
    html=html.replace('<!-- KICKER: e.g. stack-diagram / author / 2026-08 -->','SHOP QR PAYMENT / BẢN ĐỒ CHỨC NĂNG / 16.11.2026')
    html=html.replace('<!-- LEDE: 1-2 short sentences, or delete this <p> -->',escape(lede))
    html=html.replace('width: 1000px; height: 540px;',f'width: 1400px; height: {height}px;').replace('width:1000px; height:540px;',f'width:1400px; height:{height}px;')
    html=html.replace('</style>',CSS+'\n</style>')
    start=html.index('    <!-- GROUPS ');end=html.index('  </div>\n  </div>\n\n  <div class="legend">',start)
    markup=f'<div class="canvas-title">{escape(title)}</div>'+''.join(gs)+f'<svg class="edges" viewBox="0 0 1400 {height}" aria-hidden="true">'+MARKER+''.join(es)+'</svg>'+''.join(ns)
    html=html[:start]+markup+'\n'+html[end:]
    html=html.replace('request path','luồng chính').replace('internal','kết nối phụ').replace('dev / deploy','tác vụ nền')
    html=html.replace('<!-- FOOT-LEFT: author / one-liner -->','Đối chiếu mã nguồn trong repo · không suy diễn trạng thái triển khai thực tế')
    html=html.replace('<!-- FOOT-RIGHT: icon sources actually used, from manifest.json, e.g. "icons: svgl / devicon / Lucide" -->','icons: Lucide / svgl / gilbarbara / SePay / GHN (tái sử dụng từ diagram của repo)')
    draft=OUT/'drafts'/f'{slug}.html'; built=OUT/f'{slug}.html'
    draft.write_text(html)
    subprocess.run(['python3',str(SKILL/'scripts/build.py'),str(draft),str(OUT/'icons'),str(built),'--fonts',str(SKILL/'assets/fonts')],check=True)
    DIAGRAMS.append(dict(slug=slug,title=title,lede=lede,markup=markup,height=height))

def rows(slug,title,lede,rowspec,links=None):
    gs=[];es=[];ns=[]
    for spec in rowspec:
        g,e,n=row(*spec);gs+=g;es+=e;ns+=n
    make(slug,title,lede,gs,es+(links or []),ns)

make('01-system-map','01 · Kiến trúc tổng thể',
     'Next.js chứa cả giao diện và API. Các service nghiệp vụ làm việc với Prisma/PostgreSQL, Redis và các dịch vụ ngoài. Đây là cấu trúc mã nguồn, không phải sơ đồ hạ tầng production đã được xác minh.',
     [group(240,65,590,430,'Ứng dụng Next.js','gb','nextjs'),group(875,65,485,430,'Dữ liệu và cache','ga','postgresql'),group(30,540,1330,230,'Các tích hợp ngoài','ga')],
     [edge('M176 160 H294','HTTPS',235,151),edge('M366 160 H504','HTTP / server render',435,151),edge('M576 160 H714','gọi nghiệp vụ',645,151),edge('M786 160 H924','Prisma',855,151),edge('M996 160 H1184','SQL',1090,151),edge('M176 380 H294','HTTPS',235,371,False),edge('M366 380 H440 V275 H540 V266','session + quyền',475,296,False),edge('M750 266 V290 H1210 V344','cache · quota · lock',1010,281,False),edge('M750 344 V266','cron gọi nghiệp vụ',830,320,False),edge('M750 266 H850 V510 H140 V594','API / callback',580,501,False),edge('M140 510 H330 V594','GHN',365,565,False),edge('M330 510 H520 V594','realtime',555,565,False),edge('M520 510 H710 V594','bot',740,565,False),edge('M710 510 H900 V594','email',935,565,False),edge('M900 510 H1090 V594','ảnh',1120,565,False),edge('M1090 510 H1280 V594','tư vấn',1315,565,False)],
     [node(140,130,'customer','Khách hàng','catalog · giỏ · đơn · ví'),node(330,130,'react','Storefront','React 19 · Zustand'),node(540,130,'nextjs','App Router / API','src/app → controllers'),node(750,130,'service','Service nghiệp vụ','src/server/modules'),node(960,130,'database','Prisma Client','transaction · model'),node(1220,130,'postgresql','PostgreSQL','dữ liệu bền vững'),node(140,350,'admin','Admin / nhân viên','vận hành có phân quyền'),node(330,350,'shield','Admin + RBAC','ADMIN / STAFF'),node(750,350,'cron','Tác vụ nền','hết hạn đơn · outbox'),node(1210,350,'upstash','Upstash Redis','fallback bộ nhớ cục bộ'),node(140,600,'sepay','SePay / Casso cũ','VietQR · giao dịch'),node(330,600,'ghn','GHN','phí ship · vận đơn'),node(520,600,'pusher','Pusher','chat · realtime'),node(710,600,'telegram','Telegram','thông báo · duyệt đơn'),node(900,600,'resend','Resend','OTP · reset mật khẩu'),node(1090,600,'cloudflare','R2 / storage','ảnh sản phẩm'),node(1280,600,'cpu','AI provider','HTTP adapter / fake')],800)

rows('02-identity-access','02 · Tài khoản, OTP và phân quyền',
     'Đăng ký tạo User chưa xác minh. OTP gửi qua Resend. Đăng nhập dùng Credentials và JWT của NextAuth; API và trang admin kiểm tra vai trò/quyền theo từng chức năng.',
     [(120,'A · Đăng ký và xác minh email', [('customer','Khách đăng ký','tên · email · mật khẩu'),('shield','Kiểm tra đầu vào','rate limit theo IP'),('database','User + OtpCode','Argon2id · chưa xác minh'),('resend','Email OTP','Resend → hộp thư khách'),('check','Xác minh OTP','User.isVerified = true')],'gb',False,['POST register','hash mật khẩu','gửi mã','POST verify-otp']),
      (380,'B · Đăng nhập và sử dụng chức năng được cấp', [('customer','Khách đăng nhập','email · mật khẩu'),('lock','Kiểm tra tài khoản','mật khẩu · xác minh · khóa'),('nextjs','NextAuth JWT','id · role · permissions'),('shield','Guard + ownership','CUSTOMER / STAFF / ADMIN'),('admin','Chức năng phù hợp','trang + API + Pusher auth')],'ga',False,['Credentials','đăng nhập hợp lệ','mỗi yêu cầu','cho phép / từ chối']),
      (640,'C · Quên mật khẩu và quản trị tài khoản', [('mail','Quên mật khẩu','POST forgot-password'),('resend','Gửi OTP đặt lại','type PASSWORD_RESET'),('lock','Xác minh và đổi','POST reset-password'),('admin','Admin quản lý','vai trò · khóa · quyền STAFF'),('clipboard','User / StaffPermission','quyền dùng trong guard')],'gb',False,['OTP theo loại','mã còn hiệu lực',None,'cấp / thu hồi'])])

rows('03-order-lifecycle','03 · Mua hàng, tạo đơn và xác nhận tiền',
     'Giá, tồn kho, tương thích, coupon và phí giao đều được server xác thực lại. Luồng minh họa đơn cần trả tiền; đơn có tổng bằng 0 được tạo ở trạng thái PAID/CONFIRMED.',
     [(120,'1 · Trước khi đặt hàng', [('customer','Khám phá sản phẩm','tìm kiếm · lọc · sắp xếp'),('catalog','Chi tiết / biến thể','thông số · review · so sánh'),('cart','Giỏ / yêu thích','Zustand / Wishlist'),('coupon','Checkout','địa chỉ · coupon · phí ship'),('shield','Server xác thực','giá · tương thích · packing')],'gb',False,['chọn sản phẩm','thêm hàng','điền thông tin','POST /api/orders']),
      (380,'2 · Một transaction tạo dữ liệu đơn và giữ kho', [('inventory','Giữ tồn kho','atomic CAS / ledger'),('order','Tạo Order + items','giá / bảo hành snapshot'),('coupon','Ghi nhận coupon','giới hạn tổng / theo user'),('payment','PaymentRequest','ORDER · mã DH · hết hạn'),('telegram','Enqueue Telegram','AdminAuditLog cùng tx')],'ga',True,['đủ hàng','snapshot','cần thanh toán','ORDER_CREATED']),
      (640,'3 · Khách chuyển tiền và hệ thống nhận callback', [('qr','Khách quét VietQR','QR chứa mã thanh toán'),('sepay','SePay webhook','Casso cho legacy'),('webhook','Xác thực / chống trùng','chữ ký · mã · tiền · thời hạn'),('database','Ghi nhận thanh toán','BankTransfer + Order PAID'),('notify','Thông báo kết quả','Pusher · in-app · Telegram')],'gb',False,['chuyển khoản','POST webhook','khớp hợp lệ','PAYMENT_RECEIVED'])],
     [edge('M1260 246 V374','transaction',1310,310),edge('M140 506 V550 H20 V620 H140 V634','hiển thị QR',192,570)])

rows('04-wallet-shipping','04 · Ví, giao hàng và các nhánh ngoại lệ',
     'Ba luồng song song: nạp/chi ví, fulfillment GHN và xử lý ngoại lệ. Mỗi hàng được đọc từ trái sang phải; các hàng không phải là các bước nối tiếp bắt buộc.',
     [(120,'A · Nạp ví và thanh toán bằng ví nội bộ', [('wallet','Yêu cầu nạp ví','POST /wallet/topup'),('qr','QR mã NAP','PaymentRequest bền vững'),('sepay','Nhận giao dịch nạp','webhook khớp + chống trùng'),('wallet','Cộng ví + sổ ví','UserWallet / WalletTransaction'),('check','Thanh toán đơn bằng ví','CAS trừ số dư → PAID')],'gb',False,['tạo yêu cầu','khách chuyển tiền','transaction','POST /wallet/pay']),
      (380,'B · Đơn PAID được admin duyệt để giao hàng', [('admin','Admin web / Telegram','yêu cầu duyệt đơn'),('shield','Kiểm tra fulfillment','địa bàn · serial · giá trị'),('ghn','GHN tạo vận đơn','lưu Shipment · PROCESSING'),('webhook','GHN báo trạng thái','SHIPPING → COMPLETED'),('notify','Khách theo dõi đơn','mã vận đơn · thông báo')],'ga',False,['approveAndFulfill','đủ điều kiện','POST /webhooks/ghn','đồng bộ realtime']),
      (640,'C · Các nhánh cần xử lý riêng', [('expire','Đơn quá hạn / hủy','CANCELLED · EXPIRED'),('inventory','Nhả giữ kho / coupon','khôi phục quyền sử dụng'),('bank','Chuyển tiền không khớp','PENDING_REVIEW'),('admin','Admin đối soát','giao dịch / tiền dư'),('wallet','RefundCase / hoàn ví','theo nghiệp vụ và quyền')],'gb',False,['transaction',None,'xem xét thủ công','ghi nhận xử lý'])])

rows('05-inventory-aftersales','05 · Nhập kho, serial và hậu mãi',
     'Nhập hàng, đổi trả và bảo hành dùng state machine, operationKey và audit để kiểm soát thao tác. Hoàn tiền là luồng riêng; đóng yêu cầu không tự động đồng nghĩa tiền đã được hoàn.',
     [(120,'A · Nhập hàng và quản lý tồn', [('admin','Nhà cung cấp / PO','Supplier · PurchaseOrder'),('clipboard','Duyệt phiếu nhập','DRAFT → ORDERED'),('inventory','Nhận hàng','một phần / đủ hàng'),('database','InventoryMovement','onHand / reserved / quarantine'),('badge','Serial / IMEI','đăng ký · gán vào OrderItem')],'gb',False,['tạo PO','POST receipts','ghi sổ kho','trước khi giao']),
      (380,'B · Khách gửi yêu cầu đổi trả', [('return','Yêu cầu đổi trả','đơn COMPLETED · đúng chủ'),('admin','Duyệt yêu cầu','không vượt lượng đã mua'),('inventory','Nhận vào cách ly','ITEM_RECEIVED'),('search','Kiểm định hàng','INSPECTED'),('settings','Phân loại xử lý','nhập lại / loại / xử lý tiếp')],'ga',False,['REQUESTED','APPROVED','kiểm hàng','disposition']),
      (640,'C · Bảo hành theo snapshot lúc mua', [('badge','Tạo WarrantyClaim','đúng đơn · serial · thời hạn'),('admin','Tiếp nhận','SUBMITTED → RECEIVED'),('search','Kiểm tra / chờ linh kiện','INSPECTING / WAITING_PARTS'),('settings','Phương án xử lý','sửa · đổi · đề nghị hoàn'),('clipboard','Lưu kết quả + audit','RESOLVED / REJECTED')],'gb',False,['POST warranties','kiểm tra','resolution','snapshot + timeline'])])

rows('06-admin-realtime-telegram','06 · Chat, thông báo và bot Telegram',
     'Chat CSKH lưu Message rồi phát realtime. Telegram thông báo đơn dùng hàng đợi bền vững; bot đọc TELEGRAM_BOT_TOKEN và TELEGRAM_CHAT_ID từ môi trường, không dùng token LLM.',
     [(120,'A · Thông báo và chat trong website', [('order','Đơn / thanh toán / chat','sự kiện nghiệp vụ'),('database','Lưu dữ liệu','Notification / Message'),('pusher','Pusher Server','user / chat / admin channels'),('shield','Pusher auth','session + phạm vi truy cập'),('react','UI khách / admin','unread · tin nhắn · dashboard')],'gb',False,['ghi DB','trigger event','quyền subscribe','cập nhật màn hình']),
      (380,'B · Gửi Telegram với cơ chế retry', [('telegram','ORDER_CREATED / PAID','snapshot nội dung tin'),('layers','AdminAuditLog outbox','PENDING → PROCESSING'),('cron','Worker','after() + cron mỗi phút'),('telegram','Telegram Bot API','sendMessage · token từ env'),('check','SENT hoặc retry','message_id · lỗi · tối đa 24h')],'ga',False,['enqueue cùng tx','claim lease','HTTP POST','ghi trạng thái']),
      (640,'C · Admin bấm nút duyệt trên Telegram', [('telegram','approve_order callback','orderId trong nút'),('webhook','Telegram webhook','secret + chat/from ID'),('shield','Kiểm tra đơn PAID','serial · fulfillment guard'),('ghn','Tạo vận đơn GHN','dùng chung fulfillment service'),('telegram','Cập nhật tin cũ','editMessageText + popup')],'gb',False,['POST webhook','được phép','đủ điều kiện','gỡ nút duyệt'])])

rows('07-ai-catalog-intelligence','07 · Catalog intelligence và trợ lý AI',
     'Điểm sản phẩm và tương thích là nghiệp vụ dựa trên dữ liệu/rule. AI chỉ được gọi ở nhánh cần sinh câu trả lời; nhiều câu tìm kiếm/so sánh được xử lý trực tiếp bằng commerce service.',
     [(120,'A · Chuẩn bị dữ liệu cho storefront và tư vấn', [('book','Nguồn dữ liệu','DataSource · benchmark'),('admin','Duyệt nguồn / mapping','ADMIN kích hoạt ACTIVE'),('catalog','Catalog chuẩn hóa','specs · variants · provenance'),('chart','Điểm + tương thích','snapshot · rubric · rules'),('compare','So sánh / phụ kiện','API scores / compare / check')],'gb',False,['review nguồn','kiểm dữ liệu','tính toán / quy tắc','hiển thị cho khách']),
      (380,'B · Mỗi câu hỏi của assistant', [('sparkles','Assistant panel','khách hoặc anonymous cookie'),('lock','Identity + ownership','đúng conversation'),('upstash','Redis AI quota','IP · user/anon · toàn cục'),('search','Commerce resolver','tìm / lọc / so sánh / nối ngữ cảnh'),('check','Kết quả có dữ liệu','cards + comparison + lưu DB')],'ga',False,['tạo / mở phiên','reserve budget','đủ hạn mức','trả trực tiếp nếu xử lý được']),
      (640,'C · Nhánh cần AI hoặc fallback', [('book','Evidence bundle','giá · kho · specs · nguồn'),('cpu','Provider adapter','custom HTTP / FakeAiProvider'),('shield','Kiểm claims / citations','đối chiếu với evidence'),('sparkles','Trả lời / fallback','thiếu bằng chứng → mẫu xác định'),('database','Lưu và tính usage','AssistantMessage · quota settle')],'gb',False,['cần sinh nội dung','JSON response','hợp lệ / không hợp lệ','conversation + usage'])],
     [edge('M980 506 V560 H20 V620 H140 V634','không xử lý trực tiếp → evidence',535,550,False)])

# Produce a unified, offline atlas with one copy of fonts and styles.
base=(OUT/'01-system-map.html').read_text()
style=re.search(r'<style>(.*?)</style>',base,re.S)[1]
more='''
body{padding:0}.atlas{max-width:1480px;margin:auto;padding:32px}.intro{padding:36px 0 24px}.intro p{line-height:1.8;max-width:1000px;color:var(--color-ink-2)}.toolbar{position:sticky;top:0;z-index:9;background:var(--color-paper);border-bottom:1px solid var(--color-rule-2);padding:12px 0;display:flex;gap:12px;align-items:center;flex-wrap:wrap}button,.toolbar a{font:500 13px var(--font-display);padding:8px 12px;border:1px solid var(--color-rule-2);border-radius:6px;color:var(--color-ink);background:var(--color-paper-2);text-decoration:none;cursor:pointer}.toc{display:flex;gap:7px;flex-wrap:wrap;flex:1}.section{padding:44px 0;scroll-margin-top:110px}.section h2{font:700 25px var(--font-display);margin:0 0 12px}.section .summary{line-height:1.8;color:var(--color-ink-2);max-width:1100px;margin:0 0 22px}.section .canvas{width:1400px;height:850px}.section:first-of-type .canvas{height:800px}.details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin-top:20px}.note{border:1px solid var(--color-rule-2);border-radius:10px;background:var(--color-paper-2);padding:22px}.note h3{font:600 17px var(--font-display);margin-bottom:10px}.note p,.note li{font-size:14px;line-height:1.8}.note ul,.note ol{padding-left:22px}.note code,td code{font-size:12px;word-break:break-word}a{color:var(--color-accent)}.files{margin-top:14px;font-size:13px;line-height:1.8}.coverage{border-collapse:collapse;width:100%;font-size:14px}.coverage th,.coverage td{text-align:left;vertical-align:top;border-bottom:1px solid var(--color-rule-2);padding:12px}.coverage th{background:var(--color-paper-2)}.label{font:600 11px var(--font-mono);color:var(--color-accent);letter-spacing:.1em;margin-bottom:12px}.footer{padding:32px 0;font-size:12px;color:var(--color-muted)}@media(max-width:850px){.atlas{padding:16px}.details{grid-template-columns:1fr}.coverage{font-size:12px}.toolbar{position:relative}.section{scroll-margin-top:12px}}@media print{.toolbar{display:none}.section{break-before:page}.scroller{overflow:visible}.canvas{zoom:.7}.atlas{padding:0}.details{grid-template-columns:1fr}}
'''
# Text sections are read from an ordinary source fragment so they remain easy to edit.
notes=(OUT/'atlas-notes.html').read_text()
parts=re.split(r'<!-- SECTION (\d+) -->',notes)
note_by_index={int(parts[i]):parts[i+1] for i in range(1,len(parts),2)}
sections=[]
for i,d in enumerate(DIAGRAMS,1):
    s=(OUT/(d['slug']+'.html')).read_text()
    canvas=re.search(r'<div class="canvas">(.*?)\n  </div>\n  </div>',s,re.S)[1]
    # Marker IDs must be unique when multiple diagrams share one document.
    canvas=canvas.replace('id="ar"',f'id="ar{i}"').replace('url(#ar)',f'url(#ar{i})')
    sections.append(f'<section class="section" id="section-{i}"><h2>{escape(d["title"])}</h2><p class="summary">{escape(d["lede"])}</p><div class="scroller"><div class="canvas" style="height:{d["height"]}px">{canvas}</div></div><div class="legend"><span><span class="sw"></span>luồng chính</span><span><span class="sw n"></span>kết nối phụ / nhánh riêng</span></div>{note_by_index.get(i,"")}</section>')
nav=''.join(f'<a href="#section-{i}">{i}. {t}</a>' for i,t in enumerate(['Tổng thể','Tài khoản','Mua hàng','Ví & giao hàng','Kho & hậu mãi','Chat & Telegram','AI & dữ liệu'],1))
head='''<div class="intro"><div class="label">SHOP QR PAYMENT · ATLAS CHỨC NĂNG · 16/11/2026</div><h1>Toàn bộ project hoạt động như thế nào?</h1><p>Đọc từ tổng quan đến từng luồng nghiệp vụ. Mỗi sơ đồ tập trung vào một nhóm chức năng; phần giải thích bên dưới chỉ rõ dữ liệu, điều kiện và mã nguồn tương ứng. Có thể cuộn ngang sơ đồ và đổi giao diện sáng/tối. Nội dung dựa trên mã nguồn hiện tại; các tích hợp ngoài cần cấu hình để vận hành thực tế.</p></div>'''
footer='''<div class="footer">Nguồn: src/app, src/server/modules, src/server/infrastructure, prisma/schema.prisma, vercel.json. Logo tái sử dụng từ diagram hiện có trong repo; pictogram từ Lucide. Thương hiệu thuộc chủ sở hữu tương ứng. · made with <a href="https://github.com/caru-ini/stack-diagram">stack-diagram</a></div>'''
atlas='<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shop QR Payment — Toàn bộ luồng chức năng</title><style>'+style+more+'</style></head><body><main class="atlas">'+head+'<nav class="toolbar"><div class="toc">'+nav+'</div><button type="button" id="theme">Đổi sáng / tối</button></nav>'+''.join(sections)+note_by_index.get(8,'')+footer+'</main><script>document.getElementById("theme").onclick=()=>{const r=document.documentElement;r.dataset.theme=r.dataset.theme==="dark"?"light":"dark"};</script></body></html>'
(OUT/'project-flows.html').write_text(atlas)
print('Built offline atlas:',OUT/'project-flows.html')

# Markdown companion, including a route inventory derived from the filesystem.
from html import unescape

def markdown(fragment):
    fragment=re.sub(r'<a href="([^"]+)">(.*?)</a>',lambda m:'['+m[2]+']('+m[1].replace('../../../','../../')+')',fragment,flags=re.S)
    fragment=re.sub(r'<h[23]>(.*?)</h[23]>',r'\n\n### \1\n\n',fragment,flags=re.S)
    fragment=fragment.replace('<code>','`').replace('</code>','`').replace('<strong>','**').replace('</strong>','**')
    fragment=re.sub(r'</?(?:p|ol|ul|article|div|section)[^>]*>','\n\n',fragment)
    fragment=fragment.replace('<li>','\n- ').replace('</li>','\n')
    fragment=re.sub(r'<[^>]+>','',fragment)
    return re.sub(r'\n[ \t]*\n(?:[ \t]*\n)+','\n\n',unescape(fragment)).strip()

md=['# Luồng hoạt động toàn bộ Shop QR Payment',
    'Tài liệu đối chiếu mã nguồn ngày 16/11/2026. [Mở atlas có mục lục và nút sáng/tối](diagrams/project-flows.html). Các ảnh bên dưới được vẽ bằng stack-diagram; bản tối và HTML riêng có trong [danh mục sơ đồ](diagrams/README.md).',
    'Ứng dụng gồm storefront, trang khách hàng, admin/STAFF, API nghiệp vụ và tác vụ nền. Các sơ đồ mô tả hành vi trong code; việc một tích hợp hoạt động thực tế còn tùy cấu hình triển khai.']
for i,d in enumerate(DIAGRAMS,1):
    md.extend(['## '+d['title'],d['lede'],f'![{d["title"]}](diagrams/{d["slug"]}.png)',markdown(note_by_index[i])])
md.extend(['## Danh mục chức năng', 'Các nhóm dưới đây liên kết với những luồng đã mô tả; danh sách route đầy đủ ở phần sau.'])
table=re.search(r'<table.*?</table>',note_by_index[8],re.S)[0]
for i,tr in enumerate(re.findall(r'<tr>(.*?)</tr>',table,re.S)):
    cells=[markdown(cell).replace('|','\\|') for cell in re.findall(r'<t[hd]>(.*?)</t[hd]>',tr,re.S)]
    md.append('| '+' | '.join(cells)+' |')
    if i==0: md.append('| --- | --- | --- |')

md.extend(['\n## Các trang giao diện', 'Đường dẫn bỏ route group `(auth)` vì group này không xuất hiện trên URL. Các trang có kiểm session/role/ownership theo từng luồng ở trên.', '| URL | File trang |','| --- | --- |'])
for p in sorted((ROOT/'src/app').rglob('page.tsx')):
    segments=[s for s in p.relative_to(ROOT/'src/app').parent.parts if not s.startswith('(')]
    url='/'+('/'.join(segments))
    md.append(f'| `{url}` | [{p.relative_to(ROOT)}](<../../{p.relative_to(ROOT)}>) |')

md.extend(['\n## API: phương thức và controller', 'Bảng được lấy từ các file route thực tế. Đây là điểm vào HTTP; logic nghiệp vụ và kiểm quyền nằm ở controller/service được liên kết. Có API cho kho, nguồn tri thức và scoring chưa có trang admin riêng.', '| Endpoint | Method | Controller / route |','| --- | --- | --- |'])
route_count=0
for p in sorted((ROOT/'src/app/api').rglob('route.ts')):
    source=p.read_text()
    methods=sorted(set(re.findall(r'\b(?:GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b',source)))
    controllers=list(dict.fromkeys(re.findall(r"from ['\"]@/([^'\"]+)['\"]",source)))
    links=[]
    for controller in controllers:
        target=ROOT/'src'/controller
        target=target.with_suffix(target.suffix+'.ts')
        if target.exists(): links.append(f'[{controller.split("/")[-1]}](../../{target.relative_to(ROOT)})')
    if not links: links=[f'[route.ts](../../{p.relative_to(ROOT)})']
    url='/'+str(p.relative_to(ROOT/'src/app').parent)
    md.append(f'| `{url}` | {", ".join(methods)} | {" · ".join(links)} |')
    route_count+=1
md.extend(['\n## Tác vụ vận hành và công cụ',
    '- `expire-orders`: giải phóng đơn quá hạn, tồn đã giữ và coupon; lịch hiện tại `0 0 * * *` trong vercel.json (07:00 giờ Việt Nam).',
    '- `process-telegram-outbox`: chạy mỗi phút để gửi/retry thông báo Telegram.',
    '- `purge-conversations`: có endpoint dọn hội thoại hết hạn, chưa có lịch trong vercel.json.',
    '- `db:backup` / `db:restore`: sao lưu và phục hồi database; `db:backfill-inventory` cùng script reconcile hỗ trợ kiểm tra/migrate sổ kho và tiền.',
    '- `ghn:import`: nhập danh mục địa bàn GHN. Seed và import catalog/demo tạo dữ liệu mẫu/chuẩn hóa sản phẩm.',
    '- `eval:assistant`, `eval:commerce` và các biến thể online: đánh giá assistant/commerce intelligence. `docs:uml` sinh UML; `schema:budget` kiểm quy mô model.',
    '- `test`, `test:integration`, `lint`, `arch:check`, `build`: kiểm thử, ràng buộc kiến trúc và build; `verify` chạy chuỗi kiểm tra này.',
    'Đối chiếu: [package.json](../../package.json), [vercel.json](../../vercel.json), [scripts](../../scripts).',
    f'\nPhạm vi kiểm kê: **{route_count} file API route**, **{len(list((ROOT/"src/app").rglob("page.tsx")))} trang**, 7 sơ đồ.'])
(OUT.parent/'PROJECT_FLOWS.md').write_text('\n\n'.join(md).replace('|\n\n|','|\n|')+'\n')
print('Built Markdown companion:',OUT.parent/'PROJECT_FLOWS.md')
