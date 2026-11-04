"""Generate reproducible, anonymous preview data; never accesses the database."""
import datetime as dt
import json
from pathlib import Path
import random

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[2]
catalog = json.loads((PROJECT / 'prisma/data/electronics-catalog.json').read_text())
rng = random.Random(20261103)
products = catalog['products']
chosen = [products[i] for i in (0, 5, 12, 19, 25, 32, 39, 46)]
inventory = []
for i, product in enumerate(chosen):
    variant = product['variants'][0]
    inventory.append(dict(productId=product['id'], product=product['name'],
                          sku=variant['sku'], price=variant['price'],
                          stock=[3, 18, 2, 25, 34, 4, 16, 22][i],
                          reorderAt=5, category=product['kind']))
orders = []
start = dt.date(2026, 9, 5)
end = dt.date(2026, 11, 3)
for offset in range(60):
    day = start + dt.timedelta(days=offset)
    count = rng.randint(8, 17) + (4 if offset >= 30 else 0)
    for index in range(count):
        product = rng.choices(inventory, weights=[8, 6, 5, 4, 3, 2, 2, 1])[0]
        method = rng.choices(['VietQR', 'Ví Shop', 'COD'], weights=[72, 19, 9])[0]
        age = (end-day).days
        status = rng.choices(['COMPLETED', 'CANCELLED'], weights=[95, 5])[0]
        if age < 4:
            status = rng.choices(['PENDING', 'PROCESSING', 'SHIPPING', 'COMPLETED', 'CANCELLED'], weights=[12, 27, 30, 28, 3])[0]
        paid = status not in ['PENDING', 'CANCELLED'] and (method != 'COD' or status == 'COMPLETED')
        hour = 8 + index % 13
        code = f'DEMO-{day:%m%d}-{index+1:03}'
        orders.append(dict(orderCode=code, day=day.isoformat(), hour=hour,
                           createdAt=f'{day.isoformat()}T{hour:02}:{rng.randrange(60):02}:00+07:00',
                           customer=f'Khách mẫu {rng.randint(1, 180):03}',
                           productId=product['productId'], product=product['product'],
                           quantity=1, amount=product['price'], method=method,
                           payment='Đã thanh toán' if paid else 'Đã hủy' if status == 'CANCELLED' else 'Chờ thanh toán',
                           status=status, statusLabel={'PENDING':'Chờ xác nhận','PROCESSING':'Đang xử lý','SHIPPING':'Đang giao','COMPLETED':'Hoàn thành','CANCELLED':'Đã hủy'}[status],
                           matched=paid and (method != 'VietQR' or rng.random() > .025),
                           carrier='GHN', shipmentIssue=status == 'SHIPPING' and rng.random() < .07))
for name, data in [('sample-orders.json', orders), ('sample-inventory.json', inventory)]:
    (ROOT/name).write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
