'use strict';
const fs = require('node:fs');
const { pool, tx, secret } = require('./db');
const { hashPassword } = require('./security');
async function main() {
  const passwordHash = await hashPassword(secret('ADMIN_PASSWORD_FILE'));
  await tx(async c => {
    await c.query('SELECT pg_advisory_xact_lock(160551)');
    await c.query(fs.readFileSync('/app/db/schema.sql', 'utf8'));
    await c.query('INSERT INTO admins(username,password_hash) VALUES ($1,$2) ON CONFLICT DO NOTHING', ['admin',passwordHash]);
    for (const name of ['Máy tính và phụ kiện','Thiết bị trình chiếu','Thiết bị văn phòng']) {
      await c.query('INSERT INTO categories(name) VALUES($1) ON CONFLICT DO NOTHING',[name]);
    }
    for (const name of ['Phòng thực hành A101','Phòng hành chính','Kho thiết bị']) {
      await c.query('INSERT INTO locations(name) VALUES($1) ON CONFLICT DO NOTHING',[name]);
    }
    const cats = (await c.query('SELECT id FROM categories ORDER BY id')).rows;
    const locs = (await c.query('SELECT id FROM locations ORDER BY id')).rows;
    const names=['Máy tính Dell OptiPlex 01','Laptop Lenovo ThinkPad','Màn hình Dell 24 inch','Bàn phím Logitech','Chuột không dây','Máy chiếu Epson EB','Màn chiếu điện','Loa phòng học','Máy in Canon LBP','Máy quét tài liệu','Bộ lưu điện APC','Máy hủy tài liệu'];
    const prices=[12500000,18000000,3200000,450000,350000,16500000,2500000,1800000,4800000,6200000,2100000,3200000];
    for (let i=0;i<names.length;i++) {
      await c.query(`INSERT INTO assets(code,name,serial,category_id,location_id,purchased_on,value_vnd,status)
        VALUES($1,$2,$3,$4,$5,'2026-08-15',$6,$7) ON CONFLICT DO NOTHING`,
        [`TB-${String(i+1).padStart(3,'0')}`,names[i],`HAI-2026-${i+1}`,cats[Math.floor(i/4)].id,locs[i%3].id,prices[i],i===11?'retired':i%3===0?'available':'in_use']);
    }
    // Seed records are anchored to asset/code and title; running again does not recreate them.
    for (const [code,title,offset] of [['TB-002','Kiểm tra pin và vệ sinh laptop',-2],['TB-006','Vệ sinh bộ lọc máy chiếu',0],['TB-009','Bảo dưỡng máy in định kỳ',7]]) {
      await c.query(`INSERT INTO maintenance(asset_id,title,scheduled_on,provider)
        SELECT a.id,$2::varchar,CURRENT_DATE + $3::integer,'Tổ kỹ thuật ICTU' FROM assets a WHERE a.code=$1
        AND NOT EXISTS(SELECT 1 FROM maintenance m WHERE m.asset_id=a.id AND m.title=$2)`,[code,title,offset]);
    }
    await c.query(`GRANT USAGE ON SCHEMA public TO asset_app;
      GRANT SELECT ON admins,categories,locations,assets,maintenance TO asset_app;
      GRANT UPDATE(password_hash,auth_version) ON admins TO asset_app;
      GRANT INSERT,UPDATE,DELETE ON sessions TO asset_app; GRANT SELECT ON sessions TO asset_app;
      GRANT INSERT,UPDATE ON categories,locations,assets,maintenance TO asset_app;
      GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO asset_app;`);
  });
  console.log('Schema, quyền truy cập và dữ liệu mẫu đã sẵn sàng.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool.end());
