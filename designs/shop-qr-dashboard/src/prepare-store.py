"""Register the source files and page through baoyu-dashboard's official script."""
from pathlib import Path
import datetime as dt
import json
import subprocess

ROOT = Path(__file__).resolve().parent.parent
ARTIFACT = Path('/home/nhonhoa/.codex/plugins/cache/baoyu-design/baoyu-dashboard/2.8.2/skills/claude-dashboard/scripts/artifact.mjs')

def artifact(*args):
    result = subprocess.run(['node', str(ARTIFACT), *map(str,args)], check=True, capture_output=True, text=True)
    return json.loads(result.stdout)

updated = {'at': dt.datetime.now(dt.timezone.utc).isoformat(), 'by': 'Agent'}
writes = [
    {'op':'set', 'path':'dash/meta', 'data':{'title':'shop. — Trung tâm điều hành'}},
    {'op':'set', 'path':'dash/params', 'data':{'range':'7days', 'search':'', 'status':'', 'sort':'recent'}},
]
descriptions = {
    'orders': 'Dữ liệu mẫu được sinh có thể lặp lại bằng Random(20261103), bao phủ 05/09–03/11/2026. Mã đơn và khách hàng là giả lập. Giá và tên sản phẩm lấy từ 8 sản phẩm trong prisma/data/electronics-catalog.json; đơn hàng, ngày, trạng thái, phương thức, khớp giao dịch được mô phỏng bởi src/prepare-data.py. Doanh thu là tổng amount của đơn có payment = Đã thanh toán; chưa trừ hoàn tiền. Không đọc cơ sở dữ liệu hay ngân hàng.',
    'inventory': 'Dữ liệu mẫu gồm 8 sản phẩm được chọn theo vị trí 0, 5, 12, 19, 25, 32, 39, 46 trong prisma/data/electronics-catalog.json. productId, tên, SKU, loại và giá từ biến thể đầu tiên của catalog. stock và reorderAt do src/prepare-data.py đặt để minh họa tồn kho, không phải tồn kho thực tế.',
}
for id, name in [('orders','sample-orders.json'), ('inventory','sample-inventory.json')]:
    uploaded = artifact('upload', ROOT, ROOT/'src'/name)
    writes.append({'op':'set','path':'datasets/'+id,'data':{
        'title':'Sample · '+('Đơn hàng' if id=='orders' else 'Tồn kho'),
        'description':descriptions[id], 'fixed':True, 'updated':updated,
        'source':{'kind':'file','url':uploaded['url'],'name':name,'format':'json'},
    }})
for filename in ['index.html','animate-preview.css','minimal.css','react-runtime.js','motion-runtime.js',
                 'radix-runtime.js','animate-components.js','dashboard.js']:
    writes.append({'op':'set','path':'files/'+filename,'data':{'text':{'$file':str(ROOT/'src'/filename)}}})
batch = ROOT/'src'/'batch.json'
batch.write_text(json.dumps(writes,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(artifact('write-db',ROOT,batch),ensure_ascii=False))
