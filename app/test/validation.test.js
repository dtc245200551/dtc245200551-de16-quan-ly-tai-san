'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {date,money,integerId,text}=require('../src/domain');
test('Ngày nhuận và ngày không tồn tại',()=>{assert.equal(date('2024-02-29'),'2024-02-29');assert.throws(()=>date('2026-02-29'));assert.throws(()=>date('2026-13-01'));assert.equal(date(''),null);});
test('Giới hạn tiền VND nguyên',()=>{assert.equal(money('99999999999999'),'99999999999999');for(const x of ['-1','1.5','1e6','100000000000000','NaN'])assert.throws(()=>money(x));});
test('ID chỉ chấp nhận số nguyên dương trong miền giới hạn',()=>{assert.equal(integerId('12'),12);for(const x of ['0','-1','1 OR 1=1','1.5','1000000000'])assert.throws(()=>integerId(x));});
test('Giới hạn độ dài và trường bắt buộc',()=>{assert.equal(text(' hi ','Tên',5),'hi');assert.throws(()=>text('','Tên',5));assert.throws(()=>text('123456','Tên',5));assert.equal(text('','Ghi chú',5,false),'');});
