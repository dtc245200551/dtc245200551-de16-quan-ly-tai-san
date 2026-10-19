'use strict';
const { pool, tx } = require('./db');
class UserError extends Error { constructor(message, status=400) { super(message); this.status=status; } }
const assetStates={available:'Sẵn sàng',in_use:'Đang sử dụng',maintenance:'Đang bảo trì',retired:'Ngừng sử dụng'};
const maintenanceStates={scheduled:'Đã lên lịch',in_progress:'Đang thực hiện',completed:'Hoàn tất',cancelled:'Đã hủy'};
function integerId(value) {
  if(!/^[1-9]\d{0,8}$/.test(String(value))) throw new UserError('Mã bản ghi không hợp lệ.');
  return Number(value);
}
function text(value, label, max, required=true) {
  const out=String(value??'').trim();
  if((required&&!out)||out.length>max) throw new UserError(`${label}: vui lòng nhập ${required?'từ 1 đến':'tối đa'} ${max} ký tự.`);
  return out;
}
function money(value) {
  const v=String(value??'0');
  if(!/^\d{1,14}$/.test(v)) throw new UserError('Số tiền phải là số nguyên không âm, tối đa 14 chữ số.');
  return v;
}
function date(value,required=false) {
  if(!value&&!required)return null;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value))||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value) throw new UserError('Ngày không hợp lệ.');
  return value;
}
async function saveAsset(data,id=null) {
  const code=text(data.code,'Mã thiết bị',40).toUpperCase();
  if(!/^[A-Z0-9][A-Z0-9_-]*$/.test(code))throw new UserError('Mã thiết bị chỉ gồm chữ không dấu, số, dấu gạch ngang hoặc gạch dưới.');
  const name=text(data.name,'Tên thiết bị',160),serial=text(data.serial,'Serial',100,false).toUpperCase()||null;
  const category=integerId(data.category_id), location=integerId(data.location_id);
  const purchased=date(data.purchased_on),value=money(data.value_vnd),notes=text(data.notes,'Ghi chú',2000,false);
  const status=String(data.status);
  if(!Object.hasOwn(assetStates,status))throw new UserError('Trạng thái thiết bị không hợp lệ.');
  return tx(async c=>{
    if(id) {
      const a=(await c.query('SELECT * FROM assets WHERE id=$1 FOR UPDATE',[integerId(id)])).rows[0];
      if(!a)throw new UserError('Không tìm thấy thiết bị.',404);
      if(Number(data.version)!==a.version)throw new UserError('Thiết bị đã được cập nhật ở phiên khác. Vui lòng tải lại trang.',409);
      if(a.status==='maintenance'&&status!=='maintenance')throw new UserError('Hãy kết thúc hoặc hủy bảo trì trước khi đổi trạng thái.');
      if(a.status!=='maintenance'&&status==='maintenance')throw new UserError('Trạng thái bảo trì được thay đổi qua phiếu bảo trì.');
      if(status==='retired'&&(await c.query("SELECT 1 FROM maintenance WHERE asset_id=$1 AND status IN ('scheduled','in_progress')",[id])).rowCount)throw new UserError('Thiết bị còn lịch bảo trì mở. Hãy xử lý trước khi ngừng sử dụng.');
      await c.query(`UPDATE assets SET code=$1,name=$2,serial=$3,category_id=$4,location_id=$5,purchased_on=$6,value_vnd=$7,status=$8,notes=$9,version=version+1 WHERE id=$10`,[code,name,serial,category,location,purchased,value,status,notes,id]);
      return Number(id);
    }
    if(status==='maintenance')throw new UserError('Thiết bị mới chỉ được đưa vào bảo trì sau khi lập lịch.');
    return (await c.query(`INSERT INTO assets(code,name,serial,category_id,location_id,purchased_on,value_vnd,status,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,[code,name,serial,category,location,purchased,value,status,notes])).rows[0].id;
  });
}
async function schedule(data) {
  const assetId=integerId(data.asset_id),title=text(data.title,'Nội dung bảo trì',160),scheduled=date(data.scheduled_on,true),provider=text(data.provider,'Đơn vị thực hiện',160,false);
  return tx(async c=>{
    const a=(await c.query('SELECT status FROM assets WHERE id=$1 FOR UPDATE',[assetId])).rows[0];
    if(!a)throw new UserError('Không tìm thấy thiết bị.',404);
    if(a.status==='retired')throw new UserError('Không thể lập lịch cho thiết bị ngừng sử dụng.');
    return (await c.query('INSERT INTO maintenance(asset_id,title,scheduled_on,provider) VALUES($1,$2,$3,$4) RETURNING id',[assetId,title,scheduled,provider])).rows[0].id;
  });
}
async function transition(id,action,data={}) {
  integerId(id);
  return tx(async c=>{
    // All workflows lock the asset first, then its maintenance row to prevent deadlocks.
    const found=(await c.query('SELECT asset_id FROM maintenance WHERE id=$1',[id])).rows[0];
    if(!found)throw new UserError('Không tìm thấy phiếu bảo trì.',404);
    const a=(await c.query('SELECT * FROM assets WHERE id=$1 FOR UPDATE',[found.asset_id])).rows[0];
    const m=(await c.query('SELECT * FROM maintenance WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(action==='start') {
      if(m.status!=='scheduled')throw new UserError('Chỉ có thể bắt đầu phiếu đã lên lịch.',409);
      if(!['available','in_use'].includes(a.status))throw new UserError('Thiết bị đang bảo trì hoặc đã ngừng sử dụng.',409);
      await c.query("UPDATE maintenance SET status='in_progress',previous_status=$1,started_at=now() WHERE id=$2",[a.status,id]);
      await c.query("UPDATE assets SET status='maintenance',version=version+1 WHERE id=$1",[a.id]);
    } else if(action==='complete') {
      if(m.status!=='in_progress')throw new UserError('Phiếu chưa bắt đầu hoặc đã kết thúc.',409);
      const result=text(data.result,'Kết quả bảo trì',2000),cost=money(data.cost_vnd);
      await c.query("UPDATE maintenance SET status='completed',result=$1,cost_vnd=$2,finished_at=now() WHERE id=$3",[result,cost,id]);
      await c.query('UPDATE assets SET status=$1,version=version+1 WHERE id=$2',[m.previous_status,a.id]);
    } else if(action==='cancel') {
      if(!['scheduled','in_progress'].includes(m.status))throw new UserError('Phiếu đã kết thúc, không thể hủy.',409);
      const result=text(data.result,'Lý do hủy',2000);
      await c.query("UPDATE maintenance SET status='cancelled',result=$1,finished_at=now() WHERE id=$2",[result,id]);
      if(m.status==='in_progress')await c.query('UPDATE assets SET status=$1,version=version+1 WHERE id=$2',[m.previous_status,a.id]);
    } else throw new UserError('Thao tác không hợp lệ.');
    return { assetId:a.id, action };
  });
}
module.exports={UserError,assetStates,maintenanceStates,integerId,text,money,date,saveAsset,schedule,transition};
