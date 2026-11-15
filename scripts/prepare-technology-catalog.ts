import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { asRecord } from '../src/shared/utils/product-specs.ts';

interface CurrentProduct { id: string; name: string; kind: string; isActive: boolean }
export function planTechnologyCatalog(raw: unknown, current?: CurrentProduct[]) {
  const manifest=asRecord(raw);
  const products=(Array.isArray(manifest.products)?manifest.products:[]).map(asRecord);
  const sources=(Array.isArray(manifest.sources)?manifest.sources:[]).map(asRecord);
  const existing=new Set((current || []).map(p=>p.id));
  return {
    databaseInspected:current!==undefined,
    destructiveOperations:0,
    productsToAdd:products.filter(p=>!existing.has(String(p.id))).map(p=>String(p.id)),
    productsToUpdate:products.filter(p=>existing.has(String(p.id))).map(p=>String(p.id)),
    legacyToHide:(current || []).filter(p=>p.isActive && p.kind==='LEGACY').map(p=>p.id),
    groups:Object.fromEntries(['LAPTOP','PHONE','ACCESSORY'].map(kind=>[kind,products.filter(p=>p.kind===kind).length])),
    products:products.map(product=>{
      const issues:string[]=[];
      if (!Object.keys(asRecord(asRecord(product.specs).values)).length) issues.push('missing_specs');
      if (!Array.isArray(product.images) || !product.images.length) issues.push('missing_image');
      if (!Array.isArray(product.variants) || !product.variants.length) issues.push('missing_variants');
      if (!product.brandId || !product.categoryId) issues.push('missing_brand_or_category');
      const linked=sources.filter(s=>Array.isArray(product.sourceIds) && product.sourceIds.includes(s.id));
      if (!linked.length || linked.some(s=>s.status!=='ACTIVE')) issues.push('missing_active_source');
      if (linked.some(s=>s.isSynthetic) || /synthetic|demo/i.test(String(product.origin || ''))) issues.push('synthetic_evidence');
      if (linked.some(s=>!/^https:\/\//.test(String(s.url)))) issues.push('missing_source_url');
      if (linked.some(s=>! /^(?:sha256[-:])?[a-f0-9]{64}$/i.test(String(s.checksum)))) issues.push('unverified_source_checksum');
      // A stored link or checksum is a prerequisite, not proof that the facts were verified.
      issues.push('manufacturer_facts_not_verified_in_this_run');
      return {id:String(product.id),name:String(product.name),kind:String(product.kind || 'UNKNOWN'),ready:issues.length===0,issues};
    }),
    warnings:[
      'Đây là báo cáo chỉ đọc; chưa thay đổi sản phẩm, đơn hàng hoặc tồn kho.',
      'Giá và tồn kho trong manifest là dữ liệu seed; khi cập nhật phải bảo toàn số dư và sổ cái kho hiện tại.',
      'Chỉ ẩn sản phẩm legacy sau khi danh mục thay thế đã sẵn sàng; giữ nguyên ID và liên kết đơn hàng lịch sử.',
      ...(current===undefined?['Chưa đối chiếu database; danh sách thêm/cập nhật hiện là dự kiến.']:[]),
    ],
  };
}
export function renderTechnologyReport(report:ReturnType<typeof planTechnologyCatalog>, databaseStatus:string) {
  const safe=(s:string)=>s.replaceAll('|','\\|').replace(/[\r\n]/g,' ');
  return `# Chuẩn bị chuyển danh mục công nghệ\n\n`+
    `Database: ${databaseStatus}. Không có thao tác ghi.\n\n`+
    `Manifest: ${report.products.length} sản phẩm — ${Object.entries(report.groups).map(([k,v])=>`${k}: ${v}`).join(', ')}.\n\n`+
    `Dự kiến thêm: ${report.productsToAdd.length}; cập nhật: ${report.productsToUpdate.length}; legacy đề xuất ẩn: ${report.legacyToHide.length}${report.databaseInspected?'':' (chưa xác định khi database chưa truy cập được)'}.\n\n`+
    report.warnings.map(w=>`- ${w}`).join('\n')+'\n\n'+
    `Các nguồn trong manifest cần kiểm tra lại theo đúng model/cấu hình; tên nguồn và URL chung chưa chứng minh thông số chính xác. Chưa áp dụng manifest vào database.\n\n`+
    '| Sản phẩm | Nhóm | Vấn đề cần xử lý |\n|---|---|---|\n'+report.products.map(p=>`| ${safe(p.name)} | ${p.kind} | ${p.issues.join(', ') || 'Sẵn sàng'} |`).join('\n')+'\n';
}
async function main() {
  const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const manifest=JSON.parse(fs.readFileSync(path.join(project,'prisma/data/electronics-catalog.json'),'utf8'));
  const db=new PrismaClient(); let current:CurrentProduct[]|undefined;
  let databaseStatus='không kết nối được; cần PostgreSQL tại database đã cấu hình';
  try {current=await db.product.findMany({select:{id:true,name:true,kind:true,isActive:true}});databaseStatus='đã kiểm tra dữ liệu hiện tại';}
  catch { /* Do not print a connection string or provider credentials. */ }
  finally {await db.$disconnect();}
  const report=planTechnologyCatalog(manifest,current);
  const outputArg=process.argv.find(arg=>arg.startsWith('--output='));
  const rendered=renderTechnologyReport(report,databaseStatus);
  if (outputArg) fs.writeFileSync(path.resolve(outputArg.slice('--output='.length)),rendered);
  console.log(JSON.stringify({databaseInspected:report.databaseInspected,groups:report.groups,total:report.products.length,ready:report.products.filter(p=>p.ready).length,writes:0},null,2));
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(()=>{console.error('Không thể chuẩn bị báo cáo danh mục.');process.exitCode=1;});
