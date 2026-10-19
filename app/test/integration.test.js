'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {pool}=require('../src/db');
const {hashPassword}=require('../src/security');
const prefix='QA-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex').toUpperCase();
const username='qa_'+crypto.randomBytes(8).toString('hex');
let password='HaiQa9A'+crypto.randomBytes(12).toString('hex');
const base=process.env.BASE_URL||'http://nginx:8080';
class Browser {
  cookie='';csrf='';
  async request(path,data,options={}) {
    const r=await fetch(base+path,{method:options.method||(data?'POST':'GET'),headers:{...(this.cookie?{cookie:this.cookie}:{}),...(data?{'content-type':'application/x-www-form-urlencoded'}:{}),...options.headers},body:data?new URLSearchParams(data):undefined,redirect:'manual',signal:AbortSignal.timeout(10000)});
    if(r.headers.getSetCookie().length)this.cookie=r.headers.getSetCookie()[0].split(';')[0];
    const html=await r.text();const match=html.match(/name="_csrf" value="([^"]+)"/);if(match)this.csrf=match[1];
    return {status:r.status,html,location:r.headers.get('location'),headers:r.headers};
  }
  async post(path,data={}) {return this.request(path,{...data,_csrf:this.csrf});}
  async login() {await this.request('/auth/login');const r=await this.post('/auth/login',{username,password});assert.equal(r.status,303,r.html);await this.request('/');}
}
const b=new Browser();let assetId,maintenanceId,secondId,categoryId,locationId;
let asset={code:prefix,name:'Thiết bị kiểm thử tự động',serial:prefix,category_id:1,location_id:1,purchased_on:'2026-10-19',value_vnd:'2500000',status:'in_use',notes:'<script>alert(1)</script>'};
after(async()=>{
  // Only remove records created by this run, never seed or user data.
  const ids=(await pool.query('SELECT id FROM assets WHERE code LIKE $1',[prefix+'%'])).rows.map(r=>r.id);
  if(ids.length){await pool.query('DELETE FROM maintenance WHERE asset_id=ANY($1::int[])',[ids]);await pool.query('DELETE FROM assets WHERE id=ANY($1::int[])',[ids]);}
  if(categoryId)await pool.query('DELETE FROM categories WHERE id=$1',[categoryId]);
  if(locationId)await pool.query('DELETE FROM locations WHERE id=$1',[locationId]);
  await pool.query("DELETE FROM sessions WHERE sess->'user'->>'username'=$1",[username]);
  await pool.query('DELETE FROM admins WHERE username=$1',[username]);
  await pool.end();
});
test('Hải Asset — HTTP và transaction nghiệp vụ',async t=>{
  await pool.query('INSERT INTO admins(username,password_hash) VALUES($1,$2)',[username,await hashPassword(password)]);
  await t.test('Khách chưa đăng nhập bị chuyển về trang đăng nhập',async()=>{assert.equal((await b.request('/assets')).status,302);});
  await t.test('POST rỗng và CSRF giả bị chặn bằng 403',async()=>{
    await b.request('/auth/login');assert.equal((await b.request('/auth/login',undefined,{method:'POST'})).status,403);
    assert.equal((await b.request('/auth/login',{username,password,_csrf:'invalid'})).status,403);
  });
  await t.test('Sai mật khẩu trả 401 và đúng mật khẩu tạo phiên mới',async()=>{
    assert.equal((await b.post('/auth/login',{username,password:'incorrect'})).status,401);await b.login();
    assert.equal((await b.request('/')).status,200);
  });
  await t.test('Các màn hình quản trị trả 200',async()=>{
    for(const p of ['/assets','/assets/new','/categories','/locations','/maintenance','/auth/password'])assert.equal((await b.request(p)).status,200,p);
  });
  await t.test('Thêm và đổi tên danh mục / vị trí',async()=>{
    for(const table of ['categories','locations']){
      assert.equal((await b.post('/'+table,{name:prefix})).status,303);
      const id=(await pool.query(`SELECT id FROM ${table} WHERE name=$1`,[prefix])).rows[0].id;
      if(table==='categories'){categoryId=id;asset.category_id=id;}else{locationId=id;asset.location_id=id;}
      assert.equal((await b.post('/'+table+'/'+id,{name:prefix+' UPDATED'})).status,303);
    }
  });
  await t.test('Tạo hồ sơ thiết bị và kiểm tra escaping HTML',async()=>{
    const r=await b.post('/assets',asset);assert.equal(r.status,303,r.html);assetId=Number(r.location.split('/').pop());
    const detail=await b.request('/assets/'+assetId);assert.ok(detail.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));assert.ok(!detail.html.includes('<script>alert(1)</script>'));
  });
  await t.test('Mã trùng và serial trùng bị từ chối',async()=>{
    assert.equal((await b.post('/assets',asset)).status,409);
    assert.equal((await b.post('/assets',{...asset,code:prefix+'-NEW'})).status,409);
  });
  await t.test('Tiền âm, ngày không hợp lệ và khóa ngoại sai bị từ chối',async()=>{
    for(const extra of [{value_vnd:'-1'},{purchased_on:'2026-02-30'},{category_id:999999999}])assert.equal((await b.post('/assets',{...asset,code:prefix+'-BAD',serial:prefix+'-BAD',...extra})).status,400);
  });
  await t.test('Sửa thiết bị có kiểm tra phiên bản tránh mất cập nhật',async()=>{
    assert.equal((await b.post('/assets/'+assetId,{...asset,version:1,name:'Hồ sơ đã cập nhật'})).status,303);
    assert.equal((await b.post('/assets/'+assetId,{...asset,version:1})).status,409);
  });
  await t.test('Tìm kiếm tham số hóa và kiểm tra bộ lọc / phân trang',async()=>{
    assert.ok((await b.request('/assets?q='+encodeURIComponent(prefix))).html.includes(prefix));
    assert.equal((await b.request('/assets?q='+encodeURIComponent("'; DROP TABLE assets;--"))).status,200);
    assert.equal((await b.request('/assets?status=toString')).status,400);
    assert.equal((await b.request('/assets?page=-1')).status,400);
    assert.equal((await b.request('/assets?category=abc')).status,400);
  });
  await t.test('Lập lịch bảo trì và ngăn ngừng sử dụng khi còn lịch mở',async()=>{
    for(const title of ['Bảo trì A','Bảo trì B'])assert.equal((await b.post('/maintenance',{asset_id:assetId,title,scheduled_on:'2026-10-20',provider:'QA'})).status,303);
    [maintenanceId,secondId]=(await pool.query('SELECT id FROM maintenance WHERE asset_id=$1 ORDER BY id',[assetId])).rows.map(r=>r.id);
    assert.equal((await b.post('/assets/'+assetId,{...asset,version:2,status:'retired'})).status,400);
  });
  await t.test('Hai yêu cầu đồng thời chỉ bắt đầu được một bảo trì',async()=>{
    const results=await Promise.all([b.post('/maintenance/'+maintenanceId+'/start'),b.post('/maintenance/'+secondId+'/start')]);
    assert.deepEqual(results.map(r=>r.status).sort(),[303,409]);
    const rows=(await pool.query("SELECT id FROM maintenance WHERE asset_id=$1 AND status='in_progress'",[assetId])).rows;
    assert.equal(rows.length,1);const running=rows[0].id;secondId=running===maintenanceId?secondId:maintenanceId;maintenanceId=running;
    assert.equal((await pool.query('SELECT status FROM assets WHERE id=$1',[assetId])).rows[0].status,'maintenance');
  });
  await t.test('Bảo trì đang chạy không được đổi trạng thái thiết bị bằng form',async()=>{
    const a=(await pool.query('SELECT version FROM assets WHERE id=$1',[assetId])).rows[0];
    assert.equal((await b.post('/assets/'+assetId,{...asset,version:a.version,status:'available'})).status,400);
  });
  await t.test('Hoàn tất lưu kết quả/chi phí và khôi phục trạng thái',async()=>{
    assert.equal((await b.post('/maintenance/'+maintenanceId+'/complete',{result:'Hoàn tất kiểm thử',cost_vnd:'150000'})).status,303);
    const m=(await pool.query('SELECT * FROM maintenance WHERE id=$1',[maintenanceId])).rows[0];
    assert.equal(m.status,'completed');assert.equal(m.cost_vnd,'150000');assert.ok(m.finished_at);
    assert.equal((await pool.query('SELECT status FROM assets WHERE id=$1',[assetId])).rows[0].status,'in_use');
    assert.equal((await b.post('/maintenance/'+maintenanceId+'/complete',{result:'Ghi đè',cost_vnd:'0'})).status,409);
    assert.ok((await b.request('/assets/'+assetId)).html.includes('Hoàn tất kiểm thử'));
  });
  await t.test('Hủy phiếu đang chạy khôi phục trạng thái và giữ lý do',async()=>{
    assert.equal((await b.post('/maintenance/'+secondId+'/start')).status,303);
    assert.equal((await b.post('/maintenance/'+secondId+'/cancel',{result:'Dừng theo kịch bản kiểm thử'})).status,303);
    assert.equal((await pool.query('SELECT status FROM assets WHERE id=$1',[assetId])).rows[0].status,'in_use');
    assert.equal((await pool.query('SELECT status FROM maintenance WHERE id=$1',[secondId])).rows[0].status,'cancelled');
  });
  await t.test('Thiết bị ngừng sử dụng không nhận lịch mới',async()=>{
    const a=(await pool.query('SELECT version FROM assets WHERE id=$1',[assetId])).rows[0];
    assert.equal((await b.post('/assets/'+assetId,{...asset,version:a.version,status:'retired'})).status,303);
    assert.equal((await b.post('/maintenance',{asset_id:assetId,title:'Không được tạo',scheduled_on:'2026-10-20'})).status,400);
  });
  await t.test('Headers, cookie HttpOnly và metrics nội bộ',async()=>{
    const r=await b.request('/assets');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('x-frame-options'),'DENY');assert.ok(r.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
    const fresh=await new Browser().request('/auth/login');assert.ok(fresh.headers.get('set-cookie').includes('HttpOnly'));assert.ok(fresh.headers.get('set-cookie').includes('SameSite=Lax'));
    assert.equal((await b.request('/metrics')).status,404);assert.equal((await b.request('/readyz')).status,404);
  });
  await t.test('Role app không có quyền superuser, xóa hồ sơ hoặc tạo bảng',async()=>{
    const r=(await pool.query("SELECT has_table_privilege('asset_app','assets','DELETE') d,has_table_privilege('asset_app','maintenance','DELETE') m,has_schema_privilege('asset_app','public','CREATE') c,(SELECT rolsuper FROM pg_roles WHERE rolname='asset_app') s")).rows[0];
    assert.deepEqual(r,{d:false,m:false,c:false,s:false});
  });
  await t.test('Đổi mật khẩu làm mất hiệu lực phiên khác',async()=>{
    const other=new Browser();await other.login();const next=password+'Ab1';
    assert.equal((await b.post('/auth/password',{current:password,password:next,confirm:next})).status,303);password=next;
    assert.equal((await other.request('/assets')).status,302);await b.login();
  });
  await t.test('Đăng xuất ngăn truy cập lại',async()=>{
    assert.equal((await b.post('/auth/logout')).status,303);assert.equal((await b.request('/assets')).status,302);
  });
});
