import { describe,it } from 'node:test';
import assert from 'node:assert/strict';
import { planTechnologyCatalog } from '../scripts/prepare-technology-catalog.ts';
describe('Technology catalog transition preparation',()=>{
  it('proposes additions and legacy retirement without deleting or rewriting historical IDs',()=>{
    const source={id:'source',status:'ACTIVE',isSynthetic:false,url:'https://example.com/product/model',checksum:'a'.repeat(64)};
    const product={id:'tech-a',name:'Laptop A',kind:'LAPTOP',brandId:'brand',categoryId:'laptop',sourceIds:['source'],specs:{values:{ram:{state:'KNOWN',value:16}}},images:[{url:'/a.png'}],variants:[{sku:'A',price:10_000_000,stock:5}]};
    const current=[{id:'legacy',name:'Áo thun',kind:'LEGACY',isActive:true},{id:'tech-a',name:'Laptop A',kind:'LAPTOP',isActive:true}];
    const report=planTechnologyCatalog({products:[product],sources:[source]},current);
    assert.deepEqual(report.productsToAdd,[]); assert.deepEqual(report.productsToUpdate,['tech-a']);
    assert.deepEqual(report.legacyToHide,['legacy']);
    assert.equal(current[0].isActive,true);
    assert.equal(report.destructiveOperations,0);
    assert.ok(report.warnings.some(w=>/kho|tồn/i.test(w)));
  });
  it('flags missing specs, image, missing/synthetic sources and unverified checksums before publication',()=>{
    const report=planTechnologyCatalog({products:[{id:'demo',name:'Demo',sourceIds:['s'],variants:[]}],sources:[{id:'s',url:'https://vendor.example/specs',isSynthetic:true,checksum:'sha256-placeholder'}]},[]);
    assert.equal(report.products[0].ready,false);
    assert.ok(report.products[0].issues.includes('missing_specs'));
    assert.ok(report.products[0].issues.includes('missing_image'));
    assert.ok(report.products[0].issues.includes('synthetic_evidence'));
    assert.ok(report.products[0].issues.includes('unverified_source_checksum'));
  });
});
