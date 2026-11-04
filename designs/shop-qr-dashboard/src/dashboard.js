const scope = document.querySelector('.sq');
const number = new Intl.NumberFormat('vi-VN');
const compact = new Intl.NumberFormat('vi-VN', {notation:'compact', maximumFractionDigits:1});
const money = new Intl.NumberFormat('vi-VN', {style:'currency',currency:'VND', maximumFractionDigits:0});
const percent = new Intl.NumberFormat('vi-VN', {style:'percent', maximumFractionDigits:1});
const date = new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Ho_Chi_Minh'});
const selectedRange = () => dash.params().range || '7days';
const colors = {VietQR:'#475569','Ví Shop':'#94a3b8',COD:'#d6dce1'};

dash.calc('period_orders', {
 inputs:['orders'], title:'Đơn hàng theo kỳ',
 description:'Lấy ngày cuối dữ liệu làm ngày chốt; tách kỳ hiện tại và kỳ trước liền kề cho hôm nay, 7 ngày, 30 ngày. Không dùng đồng hồ máy.',
 fn:(orders) => {
  const end = orders.reduce((max,row) => row.day>max ? row.day : max,'');
  if(!end) return [];
  const last = Date.parse(end+'T00:00:00Z');
  return [{range:'today',days:1},{range:'7days',days:7},{range:'month',days:30}].flatMap(({range,days}) => orders.filter(row => {
   const age = Math.round((last-Date.parse(row.day+'T00:00:00Z'))/86400000);
   return age>=0 && age<days*2;
  }).map(row => {
   const age = Math.round((last-Date.parse(row.day+'T00:00:00Z'))/86400000);
   return {...row, range, phase:age<days?'current':'previous', bucket:days===1?Number(row.hour):days-1-(age%days),end,days};
  }));
 }
});
dash.calc('summary', {
 inputs:['period_orders'],title:'Chỉ số theo kỳ',
 description:'Doanh thu = tổng tiền đơn đã thanh toán. Tăng trưởng = (kỳ này / kỳ trước − 1) × 100. Khớp QR = giao dịch VietQR khớp / giao dịch VietQR đã thanh toán.',
 fn:(period_orders) => ['today','7days','month'].map(range => {
  const current=period_orders.filter(row=>row.range===range && row.phase==='current');
  const previous=period_orders.filter(row=>row.range===range && row.phase==='previous');
  const revenue=current.filter(row=>row.payment==='Đã thanh toán').reduce((sum,row)=>sum+Number(row.amount),0);
  const prevRevenue=previous.filter(row=>row.payment==='Đã thanh toán').reduce((sum,row)=>sum+Number(row.amount),0);
  const qr=current.filter(row=>row.method==='VietQR' && row.payment==='Đã thanh toán');
  const matched=qr.filter(row=>String(row.matched)==='true').length;
  const end=current[0]?.end || '';
  const days=current[0]?.days || 1;
  const start=end?new Date(Date.parse(end+'T00:00:00Z')-(days-1)*86400000).toISOString().slice(0,10):'';
  return {range,end,start,period:start&&end?start.slice(8)+'/'+start.slice(5,7)+' – '+end.slice(8)+'/'+end.slice(5,7):'',revenue,orders:current.length,revenueGrowth:prevRevenue?Math.round((revenue/prevRevenue-1)*1000)/10:null,ordersGrowth:previous.length?Math.round((current.length/previous.length-1)*1000)/10:null,qrPaid:qr.length,matched,matchRate:qr.length?matched/qr.length:null,shipping:current.filter(row=>row.status==='SHIPPING').length};
 })
});
dash.calc('trend', {
 inputs:['period_orders'],title:'Nhịp doanh thu & đơn',
 description:'Tổng doanh thu đã thu và số đơn mỗi ngày, hoặc mỗi giờ cho hôm nay; đối chiếu vị trí tương ứng trong kỳ trước. Ngày không có đơn có giá trị 0.',
 fn:(period_orders) => ['today','7days','month'].flatMap(range => {
  const rows=period_orders.filter(row=>row.range===range);
  const days=range==='today'?1:range==='7days'?7:30;
  const end=rows[0]?.end;
  return Array.from({length:days===1?13:days},(_,i)=>{
   const bucket=days===1?i+8:i;
   const current=rows.filter(row=>row.phase==='current' && Number(row.bucket)===bucket);
   const previous=rows.filter(row=>row.phase==='previous' && Number(row.bucket)===bucket);
   const qr=current.filter(row=>row.method==='VietQR' && row.payment==='Đã thanh toán');
   const day=end?new Date(Date.parse(end+'T00:00:00Z')-(days-1-i)*86400000).toISOString().slice(0,10):'';
   return {range,bucket,label:days===1?String(bucket).padStart(2,'0')+':00':day.slice(8)+'/'+day.slice(5,7),revenue:current.filter(row=>row.payment==='Đã thanh toán').reduce((sum,row)=>sum+Number(row.amount),0),previous:previous.filter(row=>row.payment==='Đã thanh toán').reduce((sum,row)=>sum+Number(row.amount),0),orders:current.length,shipping:current.filter(row=>row.status==='SHIPPING').length,matchRate:qr.length?qr.filter(row=>String(row.matched)==='true').length/qr.length:null};
  });
 })
});
dash.calc('payments', {
 inputs:['period_orders'],title:'Tỷ trọng thanh toán',
 description:'Số đơn đã thanh toán theo phương thức / tổng số đơn đã thanh toán của kỳ. COD chỉ tính đơn đã thu tiền.',
 fn:(period_orders) => ['today','7days','month'].flatMap(range=>{
  const rows=period_orders.filter(row=>row.range===range && row.phase==='current' && row.payment==='Đã thanh toán');
  return ['VietQR','Ví Shop','COD'].map(method=>({range,method,count:rows.filter(row=>row.method===method).length,share:rows.length?rows.filter(row=>row.method===method).length/rows.length:0}));
 })
});
dash.calc('operations', {
 inputs:['orders','inventory'],title:'Việc cần xử lý',
 description:'Ảnh chụp toàn cửa hàng: đơn PENDING; giao dịch VietQR đã thanh toán chưa khớp; số SKU có stock nhỏ hơn reorderAt. Không phụ thuộc bộ lọc thời gian.',
 fn:(orders,inventory) => [{pending:orders.filter(row=>row.status==='PENDING').length,unmatched:orders.filter(row=>row.method==='VietQR' && row.payment==='Đã thanh toán' && String(row.matched)==='false').length,lowStock:inventory.filter(row=>Number(row.stock)<Number(row.reorderAt)).length}]
});
dash.calc('top_products', {
 inputs:['period_orders'],title:'Sản phẩm theo doanh thu',
 description:'Nhóm đơn đã thanh toán theo sản phẩm và kỳ, đếm số đơn và cộng tiền; sắp giảm dần theo doanh thu khi hiển thị.',
 fn:(period_orders) => {
  const groups=new Map();
  period_orders.filter(row=>row.phase==='current' && row.payment==='Đã thanh toán').forEach(row=>{
   const key=row.range+'|'+row.productId;
   if(!groups.has(key)) groups.set(key,{range:row.range,productId:row.productId,product:row.product,revenue:0,orders:0});
   const entry=groups.get(key);entry.revenue+=Number(row.amount);entry.orders++;
  });
  return ['today','7days','month'].flatMap(range=>[...groups.values()].filter(row=>row.range===range).sort((a,b)=>b.revenue-a.revenue).map((row,index)=>({...row,rank:index+1})));
 }
});

const state = (el, source, chart=false) => {
 const result=dash.data(source);
 el.classList.toggle('dash-skeleton',result.status==='loading');
 if(result.status!=='ok'){
  el.replaceChildren();
  if(result.status==='error') el.textContent='Không tải được dữ liệu';
  else if(!chart) el.textContent='—';
  return null;
 }
 return result.data;
};
const summaryRow = el => {
 const rows=state(el,'summary');
 if(!rows) return null;
 el.setAttribute('data-where','range='+selectedRange());
 return rows.find(row=>row.range===selectedRange());
};
const fmt=(value,format)=>value===null||value===undefined?'—':format==='percent'?percent.format(value):format==='money'?compact.format(value)+' ₫':format==='vnd'?money.format(value):number.format(value);

dash.draw('metric', el=>{const row=summaryRow(el);if(row)el.textContent=fmt(row[el.dataset.key],el.dataset.format);});
dash.draw('growth', el=>{const row=summaryRow(el);if(!row)return;const value=row[el.dataset.key];el.textContent=value===null?'—':(value>0?'+':'')+number.format(value)+'%';el.classList.toggle('down',value<0);});
dash.draw('date', el=>{const rows=state(el,'summary');const end=rows?.[0]?.end;if(end)el.textContent=date.format(new Date(end+'T12:00:00+07:00'));});
dash.draw('period',el=>{const row=summaryRow(el);if(row)el.textContent=row.period;});
dash.draw('operation',el=>{const rows=state(el,'operations');if(rows?.[0])el.textContent=number.format(rows[0][el.dataset.key]);});
dash.draw('share',el=>{
 const rows=state(el,'payments');if(!rows)return;
 el.setAttribute('data-where','range='+selectedRange()+'&method='+encodeURIComponent(el.dataset.method));
 const row=rows.find(row=>row.range===selectedRange() && row.method===el.dataset.method);
 el.textContent=row?percent.format(Number(row.share)):'—';
});

const tooltip = el => {
 const tip=document.createElement('div');tip.className='sq-tooltip';tip.hidden=true;el.append(tip);
 return {show(event,text){tip.textContent=text;tip.hidden=false;const rect=el.getBoundingClientRect();const left=event.clientX-rect.left+12;const top=event.clientY-rect.top-30;tip.style.left=Math.max(5,Math.min(left,el.clientWidth-tip.offsetWidth-5))+'px';tip.style.top=Math.max(5,Math.min(top,el.clientHeight-tip.offsetHeight-5))+'px';},hide(){tip.hidden=true;}};
};
dash.draw('spark',el=>{
 const data=state(el,'trend',true);if(!data)return;
 el.replaceChildren();el.style.position='relative';
 const rows=data.filter(row=>row.range===selectedRange());const key=el.dataset.key;
 const width=Math.max(60,el.clientWidth),height=26;
 const svg=d3.select(el).append('svg').attr('width','100%').attr('viewBox',`0 0 ${width} ${height}`).attr('aria-hidden','true');
 const values=rows.map(row=>row[key]).filter(value=>value!==null);
 if(!values.length)return;
 const domain=d3.extent(values);if(domain[0]===domain[1]){domain[0]-=1;domain[1]+=1;}
 const x=d3.scaleLinear([0,Math.max(1,rows.length-1)],[0,width]);const y=d3.scaleLinear(domain,[height-3,3]);
 svg.append('path').datum(rows).attr('d',d3.line().defined(row=>row[key]!==null).x((row,i)=>x(i)).y(row=>y(row[key]))).attr('fill','none').attr('stroke','#7b8c99').attr('stroke-width',1.5);
 const tip=tooltip(el);
 svg.append('rect').attr('width',width).attr('height',height).attr('fill','transparent').on('pointermove',event=>{const i=Math.max(0,Math.min(rows.length-1,Math.round(d3.pointer(event)[0]/width*(rows.length-1))));const row=rows[i];tip.show(event,row.label+' · '+fmt(row[key],key==='matchRate'?'percent':key==='revenue'?'money':undefined));}).on('pointerleave',tip.hide);
});

dash.draw('revenue',el=>{
 const data=state(el,'trend',true);if(!data)return;el.replaceChildren();
 const rows=data.filter(row=>row.range===selectedRange());if(!rows.length)return;
 const width=Math.max(230,el.clientWidth),height=213;
 const svg=d3.select(el).append('svg').attr('width','100%').attr('viewBox',`0 0 ${width} ${height}`).attr('role','img').attr('aria-label','Doanh thu kỳ này và kỳ trước bằng đồng Việt Nam');
 const maximum=d3.max(rows,row=>Math.max(Number(row.revenue),Number(row.previous)))||1;
 const y=d3.scaleLinear([0,maximum],[height-27,12]).nice(4);
 const ticks=y.ticks(4);
 const measure=svg.append('g').attr('visibility','hidden');
 const labels=measure.selectAll('text').data(ticks).join('text').attr('font-size',9).text(value=>compact.format(value));
 const left=Math.max(32,...labels.nodes().map(node=>node.getComputedTextLength()+10));measure.remove();
 const right=8;
 const x=d3.scaleBand(rows.map(row=>row.bucket),[left,width-right]).padding(rows.length>20?.28:.35);
 const groupWidth=x.bandwidth();const barWidth=Math.min(22,groupWidth/2);
 const grid=svg.append('g');
 ticks.forEach(tick=>{grid.append('line').attr('x1',left).attr('x2',width-right).attr('y1',y(tick)).attr('y2',y(tick)).attr('stroke','#edf0f2').attr('stroke-dasharray','3,4');grid.append('text').attr('x',left-8).attr('y',y(tick)+3).attr('text-anchor','end').attr('fill','#7b8791').attr('font-size',9).text(compact.format(tick));});
 const tip=tooltip(el);
 rows.forEach((row,index)=>{
  const center=x(row.bucket)+groupWidth/2;
  svg.append('rect').attr('x',center-barWidth-1).attr('y',y(row.previous)).attr('width',barWidth).attr('height',Math.max(0,y(0)-y(row.previous))).attr('rx',2).attr('fill','#d7dde2');
  svg.append('rect').attr('x',center+1).attr('y',y(row.revenue)).attr('width',barWidth).attr('height',Math.max(0,y(0)-y(row.revenue))).attr('rx',2).attr('fill','#475569');
  const stride=Math.ceil(rows.length/Math.max(2,Math.floor((width-left-right)/54)));
  if(index%stride===0)svg.append('text').attr('x',center).attr('y',height-6).attr('text-anchor','middle').attr('fill','#7b8791').attr('font-size',9).text(row.label);
  svg.append('rect').attr('x',x(row.bucket)-2).attr('y',8).attr('width',groupWidth+4).attr('height',height-30).attr('fill','transparent').attr('tabindex',0).attr('aria-label',row.label+': '+money.format(row.revenue)+', kỳ trước '+money.format(row.previous)).on('pointermove',event=>tip.show(event,row.label+'\nKỳ này: '+money.format(row.revenue)+'\nKỳ trước: '+money.format(row.previous))).on('pointerleave',tip.hide).on('focus',event=>{const rect=event.target.getBoundingClientRect();tip.show({clientX:rect.left,clientY:rect.top+30},row.label+'\nKỳ này: '+money.format(row.revenue)+'\nKỳ trước: '+money.format(row.previous));}).on('blur',tip.hide);
 });
});

dash.draw('donut',el=>{
 const data=state(el,'payments',true);if(!data)return;el.replaceChildren();
 const rows=data.filter(row=>row.range===selectedRange());const total=d3.sum(rows,row=>Number(row.count));
 const width=230,height=194,cx=115,cy=96;
 const svg=d3.select(el).append('svg').attr('width','100%').attr('viewBox',`0 0 ${width} ${height}`).attr('role','img').attr('aria-label','Tỷ trọng thanh toán theo phương thức');
 const g=svg.append('g').attr('transform',`translate(${cx},${cy})`);
 g.append('circle').attr('r',72).attr('fill','none').attr('stroke','#ecf0f2').attr('stroke-width',20);
 const arc=d3.arc().innerRadius(62).outerRadius(82).cornerRadius(3);
 const pie=d3.pie().sort(null).value(row=>Number(row.count)).padAngle(.045);
 const tip=tooltip(el);
 g.selectAll('path').data(pie(rows)).join('path').attr('d',arc).attr('fill',part=>colors[part.data.method]).attr('tabindex',0).attr('aria-label',part=>part.data.method+': '+percent.format(part.data.share)).on('pointermove',(event,part)=>tip.show(event,part.data.method+'\n'+number.format(part.data.count)+' đơn · '+percent.format(part.data.share))).on('pointerleave',tip.hide).on('focus',(event,part)=>{const rect=event.target.getBoundingClientRect();tip.show({clientX:rect.left,clientY:rect.top+20},part.data.method+'\n'+number.format(part.data.count)+' đơn · '+percent.format(part.data.share));}).on('blur',tip.hide);
 g.append('text').attr('text-anchor','middle').attr('y',2).attr('font-family','Georgia,serif').attr('font-size',33).attr('fill','#26323d').text(number.format(total));
 g.append('text').attr('text-anchor','middle').attr('y',22).attr('font-size',10).attr('fill','#7b8791').text('đơn đã thanh toán');
});

const filteredOrders=()=>{
 const source=dash.data('orders');if(source.status!=='ok')return [];
 const rows=dash.data('summary');if(rows.status!=='ok')return [];
 const period=rows.data.find(row=>row.range===selectedRange());if(!period)return [];
 const query=String(dash.params().search||'').toLocaleLowerCase('vi');
 const status=dash.params().status||'';const sort=dash.params().sort||'recent';
 return source.data.filter(row=>row.day>=period.start && row.day<=period.end && (!status || row.status===status) && (!query || [row.orderCode,row.customer,row.product].join(' ').toLocaleLowerCase('vi').includes(query))).sort((a,b)=>sort==='amount-desc'?Number(b.amount)-Number(a.amount):sort==='amount-asc'?Number(a.amount)-Number(b.amount):b.createdAt.localeCompare(a.createdAt));
};
dash.draw('orders-body',el=>{
 el.replaceChildren();const orders=dash.data('orders');if(orders.status!=='ok')return;
 const rows=filteredOrders();
 scope?.querySelectorAll('#orders-empty').forEach(node=>node.hidden=rows.length>0);
 rows.forEach(row=>{
  const tr=document.createElement('tr');tr.setAttribute('data-key',row.orderCode);
  for(const field of ['orderCode','customer','amount','method','statusLabel']){
   const td=document.createElement('td');
   if(field==='statusLabel'){const badge=document.createElement('span');badge.className='sq-badge '+row.status;badge.textContent=row[field];td.append(badge);}
   else td.textContent=field==='amount'?money.format(Number(row[field])):row[field];
   if(field==='amount')td.className='amount';
   tr.append(td);
  }
  el.append(tr);
 });
});

dash.draw('products',el=>{
 const data=state(el,'top_products',true);const stock=dash.data('inventory');el.replaceChildren();if(!data || stock.status!=='ok')return;
 const rows=data.filter(row=>row.range===selectedRange()).sort((a,b)=>Number(b.revenue)-Number(a.revenue)).slice(0,5);
 // The template is a sibling of the page, so locate it only within this dashboard root.
 const templates=document.querySelectorAll('#dash-root #sq-product-template');
 const sourceTemplate=templates[0];if(!sourceTemplate)return;
 const max=d3.max(rows,row=>Number(row.revenue))||1;
 rows.forEach(row=>{
  const fragment=sourceTemplate.content.cloneNode(true);const item=fragment.querySelector('.sq-product');
  const inventory=stock.data.find(product=>product.productId===row.productId);
  item.querySelector('.sq-product-mark').textContent=String(row.rank).padStart(2,'0');
  item.querySelector('.sq-product-name').textContent=row.product;
  item.querySelector('.sq-product-name').title=row.product;
  item.querySelector('.sq-product-orders').textContent=number.format(row.orders);
  item.querySelector('.sq-product-stock').textContent=inventory?number.format(Number(inventory.stock)):'—';
  item.querySelector('.sq-product-total').textContent=compact.format(Number(row.revenue))+' ₫';
  for(const [selector,field] of [['.sq-product-mark','rank'],['.sq-product-name','product'],['.sq-product-orders','orders'],['.sq-product-total','revenue']]){
   const mark=item.querySelector(selector);mark.setAttribute('data-source','top_products');mark.setAttribute('data-field',field);mark.setAttribute('data-where','range='+selectedRange()+'&productId='+encodeURIComponent(row.productId));
  }
  if(inventory){const mark=item.querySelector('.sq-product-stock');mark.setAttribute('data-source','inventory');mark.setAttribute('data-field','stock');mark.setAttribute('data-where','productId='+encodeURIComponent(row.productId));}
  item.querySelector('.sq-stock-track i').style.width=(Number(row.revenue)/max*100)+'%';
  el.append(fragment);
 });
});

scope?.querySelectorAll('#order-search').forEach(input=>input.addEventListener('input',()=>dash.setParams({search:input.value})));
scope?.querySelectorAll('#order-status').forEach(input=>input.addEventListener('change',()=>dash.setParams({status:input.value})));
scope?.querySelectorAll('[data-pending]').forEach(link=>link.addEventListener('click',()=>dash.setParams({range:'month',status:'PENDING',search:''})));
scope?.querySelectorAll('#sort-amount').forEach(button=>button.addEventListener('click',()=>dash.setParams({sort:dash.params().sort==='amount-desc'?'amount-asc':'amount-desc'})));
scope?.querySelectorAll('.sq-nav a').forEach(link=>link.addEventListener('click',()=>scope.querySelectorAll('.sq-nav a').forEach(item=>item.classList.toggle('active',item===link))));
const exportOrders = format => {
 const rows=filteredOrders();const fields=['orderCode','day','customer','product','amount','method','payment','statusLabel'];
 const cell=value=>'"'+String(value??'').replaceAll('"','""')+'"';
 const csv='\uFEFF'+[fields,...rows.map(row=>fields.map(field=>row[field]))].map(row=>row.map(cell).join(',')).join('\r\n');
 const content=format==='json'?JSON.stringify(rows,null,2):csv;
 const url=URL.createObjectURL(new Blob([content],{type:format==='json'?'application/json;charset=utf-8;':'text/csv;charset=utf-8;'}));
 const link=document.createElement('a');link.href=url;link.download='shop-qr-don-hang-mau-'+selectedRange()+'.'+format;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};

// Actual Animate UI components, compiled locally into classic scripts. Each React root
// lives in one dash.draw region; the dashboard lifecycle owns mounting and cleanup.
const previewRuntime=window.ShopQrPreviewRuntime;
const previewUI=window.ShopQrPreviewUI;
const pageRoot=scope?.closest('#dash-root') || scope?.parentElement;
const controlCopy=previewUI.copyFrom(pageRoot);
const mobileLinks=Array.from(scope?.querySelectorAll('.sq-nav a') || [],link=>({href:link.getAttribute('href'),label:link.textContent.trim()}));
const animateControl = kind => ({
  mount(el){return previewRuntime.Client.createRoot(el,{identifierPrefix:'shop-preview-'+kind+'-'});},
  update(el,root){
   const props={
    kind,copy:controlCopy,range:selectedRange(),
    disabled:dash.data('orders').status!=='ok' || dash.data('summary').status!=='ok',
    onRange:value=>dash.setParams({range:value}),onExport:exportOrders,
    content:previewUI.contentFrom(pageRoot,'sq-help-content'),links:mobileLinks,
    onNavigate:href=>{
     pageRoot?.querySelectorAll(href).forEach(target=>target.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'}));
     scope?.querySelectorAll('.sq-nav a').forEach(link=>link.classList.toggle('active',link.getAttribute('href')===href));
     dash.setLink(href.slice(1));
    },
   };
   root.render(previewRuntime.React.createElement(previewUI.PreviewControl,props));
  },
  unmount(el,root){root.unmount();},
});
dash.draw('animate-range',animateControl('range'));
dash.draw('animate-export',animateControl('export'));
dash.draw('animate-help',animateControl('help'));
dash.draw('animate-mobile',animateControl('mobile'));
dash.onData(()=>{
 scope?.querySelectorAll('#order-search').forEach(input=>{if(input!==document.activeElement)input.value=dash.params().search||'';});
 scope?.querySelectorAll('#order-status').forEach(input=>input.value=dash.params().status||'');
 scope?.querySelectorAll('th[data-field="amount"]').forEach(th=>th.setAttribute('aria-sort',dash.params().sort==='amount-desc'?'descending':dash.params().sort==='amount-asc'?'ascending':'none'));
});
