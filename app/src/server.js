'use strict';
const express=require('express');
const session=require('express-session');
const PgStore=require('connect-pg-simple')(session);
const {rateLimit}=require('express-rate-limit');
const crypto=require('node:crypto');
const path=require('node:path');
const {pool,secret}=require('./db');
const {verifyPassword,hashPassword,csrf}=require('./security');
const d=require('./domain');
const metrics=require('./metrics');
const log=require('./logger');
const app=express();
app.disable('x-powered-by');
app.set('trust proxy',1);
app.set('view engine','ejs');
app.set('views',path.join(__dirname,'../views'));
app.use((req,res,next)=>{
  req.id=crypto.randomUUID();res.setHeader('X-Request-ID',req.id);
  const begin=performance.now();
  res.on('finish',()=>{log('http_request',{request_id:req.id,method:req.method,path:req.path,status:res.statusCode,duration_ms:Math.round(performance.now()-begin)});});
  next();
});
app.use(metrics.observe);
app.get('/metrics',async(req,res)=>{res.set('Content-Type',metrics.registry.contentType);res.end(await metrics.registry.metrics());});
app.get('/healthz',(req,res)=>res.json({status:'ok'}));
app.get('/readyz',async(req,res)=>{try{await pool.query('SELECT 1');res.json({status:'ready'});}catch{res.status(503).json({status:'unavailable'});}});
app.use(express.static(path.join(__dirname,'../public'),{maxAge:'1h',index:false}));
app.use(express.urlencoded({extended:false,limit:'24kb',parameterLimit:30}));
app.use(session({store:new PgStore({pool,tableName:'sessions',createTableIfMissing:false}),
  name:'hai.assets.sid',secret:secret('SESSION_SECRET_FILE'),resave:false,saveUninitialized:false,
  cookie:{httpOnly:true,sameSite:'lax',secure:process.env.COOKIE_SECURE==='true',maxAge:8*60*60*1000}}));
app.use((req,res,next)=>{
  res.locals.user=req.session.user||null;res.locals.path=req.path;
  res.locals.assetStates=d.assetStates;res.locals.maintenanceStates=d.maintenanceStates;
  res.locals.money=v=>Number(v||0).toLocaleString('vi-VN')+' ₫';
  res.locals.date=v=>v?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(v)):'—';
  res.locals.isoDate=v=>v?new Date(v).toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}):'';
  res.locals.flash=req.session.flash||null;delete req.session.flash;
  next();
});
app.use(csrf);
const loginLimiter=rateLimit({windowMs:15*60*1000,limit:15,standardHeaders:'draft-8',legacyHeaders:false,
  handler:(req,res)=>res.status(429).render('error',{title:'Tạm giới hạn đăng nhập',message:'Bạn đã thử đăng nhập nhiều lần. Vui lòng thử lại sau 15 phút.'})});
app.get('/auth/login',(req,res)=>req.session.user?res.redirect('/'):res.render('login',{title:'Đăng nhập',error:null}));
app.post('/auth/login',loginLimiter,async(req,res)=>{
  const username=String(req.body.username||'').slice(0,40),password=String(req.body.password||'').slice(0,256);
  const admin=(await pool.query('SELECT * FROM admins WHERE username=$1',[username])).rows[0];
  if(!admin||!await verifyPassword(password,admin.password_hash)) {
    log('login_failed',{request_id:req.id});
    return res.status(401).render('login',{title:'Đăng nhập',error:'Tên đăng nhập hoặc mật khẩu chưa đúng.'});
  }
  await new Promise((resolve,reject)=>req.session.regenerate(err=>err?reject(err):resolve()));
  req.session.user={id:admin.id,username:admin.username,version:admin.auth_version};
  log('login_success',{admin_id:admin.id,request_id:req.id});
  req.session.save(err=>{if(err)res.status(500).end('Không thể lưu phiên.');else res.redirect(303,'/');});
});
app.use(async(req,res,next)=>{
  if(!req.session.user)return res.redirect('/auth/login');
  const row=(await pool.query('SELECT auth_version FROM admins WHERE id=$1',[req.session.user.id])).rows[0];
  if(!row||row.auth_version!==req.session.user.version)return req.session.destroy(()=>res.redirect('/auth/login'));
  next();
});
app.post('/auth/logout',(req,res)=>req.session.destroy(()=>{res.clearCookie('hai.assets.sid');res.redirect(303,'/auth/login');}));
app.get('/auth/password',(req,res)=>res.render('password',{title:'Đổi mật khẩu'}));
app.post('/auth/password',loginLimiter,async(req,res)=>{
  const current=String(req.body.current||''),password=String(req.body.password||'');
  if(password.length<12||password.length>128||!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password))throw new d.UserError('Mật khẩu mới cần 12–128 ký tự, có chữ hoa, chữ thường và chữ số.');
  if(password!==req.body.confirm)throw new d.UserError('Xác nhận mật khẩu chưa khớp.');
  const row=(await pool.query('SELECT password_hash FROM admins WHERE id=$1',[req.session.user.id])).rows[0];
  if(!await verifyPassword(current,row.password_hash))throw new d.UserError('Mật khẩu hiện tại chưa đúng.');
  await pool.query('UPDATE admins SET password_hash=$1,auth_version=auth_version+1 WHERE id=$2',[await hashPassword(password),req.session.user.id]);
  log('password_changed',{admin_id:req.session.user.id});
  req.session.destroy(()=>{res.clearCookie('hai.assets.sid');res.redirect(303,'/auth/login');});
});
async function dictionaries(){return {categories:(await pool.query('SELECT * FROM categories ORDER BY name')).rows,locations:(await pool.query('SELECT * FROM locations ORDER BY name')).rows};}
function flash(req,text){req.session.flash=text;}
app.get('/',async(req,res)=>{
  const stats=(await pool.query(`SELECT count(*)::int total,count(*) FILTER(WHERE status='available')::int available,count(*) FILTER(WHERE status='in_use')::int in_use,count(*) FILTER(WHERE status='maintenance')::int maintenance,count(*) FILTER(WHERE status='retired')::int retired FROM assets`)).rows[0];
  const due=(await pool.query(`SELECT m.*,a.code,a.name, m.scheduled_on<CURRENT_DATE overdue FROM maintenance m JOIN assets a ON a.id=m.asset_id WHERE m.status='scheduled' ORDER BY m.scheduled_on,m.id LIMIT 6`)).rows;
  const recent=(await pool.query('SELECT m.*,a.code FROM maintenance m JOIN assets a ON a.id=m.asset_id ORDER BY m.id DESC LIMIT 5')).rows;
  res.render('dashboard',{title:'Tổng quan',stats,due,recent});
});
app.get('/assets',async(req,res)=>{
  const filters={q:String(req.query.q||'').slice(0,120),status:String(req.query.status||''),category:String(req.query.category||''),location:String(req.query.location||'')};
  let page=Number(req.query.page||1);if(!Number.isInteger(page)||page<1||page>100000)throw new d.UserError('Số trang không hợp lệ.');
  const args=[],clauses=[];
  if(filters.q){args.push('%'+filters.q+'%');clauses.push(`(a.code ILIKE $${args.length} OR a.name ILIKE $${args.length} OR a.serial ILIKE $${args.length})`);}
  if(filters.status){if(!Object.hasOwn(d.assetStates,filters.status))throw new d.UserError('Bộ lọc trạng thái không hợp lệ.');args.push(filters.status);clauses.push(`a.status=$${args.length}`);}
  for(const [field,column] of [['category','category_id'],['location','location_id']])if(filters[field]){args.push(d.integerId(filters[field]));clauses.push(`a.${column}=$${args.length}`);}
  const where=clauses.length?'WHERE '+clauses.join(' AND '):'';
  const count=Number((await pool.query(`SELECT count(*) FROM assets a ${where}`,args)).rows[0].count);
  const pages=Math.max(1,Math.ceil(count/10));page=Math.min(page,pages);
  const rows=(await pool.query(`SELECT a.*,c.name category,l.name location FROM assets a JOIN categories c ON c.id=a.category_id JOIN locations l ON l.id=a.location_id ${where} ORDER BY a.code LIMIT 10 OFFSET $${args.length+1}`,[...args,(page-1)*10])).rows;
  res.render('assets',{title:'Thiết bị',rows,filters,page,pages,count,...await dictionaries()});
});
app.get('/assets/new',async(req,res)=>res.render('asset-form',{title:'Thêm thiết bị',asset:{status:'available',value_vnd:0},...await dictionaries()}));
app.post('/assets',async(req,res)=>{const id=await d.saveAsset(req.body);log('asset_created',{asset_id:id,request_id:req.id});flash(req,'Đã thêm thiết bị.');res.redirect(303,`/assets/${id}`);});
app.get('/assets/:id/edit',async(req,res)=>{
  const asset=(await pool.query('SELECT * FROM assets WHERE id=$1',[d.integerId(req.params.id)])).rows[0];
  if(!asset)throw new d.UserError('Không tìm thấy thiết bị.',404);
  res.render('asset-form',{title:'Cập nhật thiết bị',asset,...await dictionaries()});
});
app.post('/assets/:id',async(req,res)=>{const id=await d.saveAsset(req.body,req.params.id);log('asset_updated',{asset_id:id,request_id:req.id});flash(req,'Đã lưu thay đổi.');res.redirect(303,`/assets/${id}`);});
app.get('/assets/:id',async(req,res)=>{
  const asset=(await pool.query('SELECT a.*,c.name category,l.name location FROM assets a JOIN categories c ON c.id=a.category_id JOIN locations l ON l.id=a.location_id WHERE a.id=$1',[d.integerId(req.params.id)])).rows[0];
  if(!asset)throw new d.UserError('Không tìm thấy thiết bị.',404);
  const history=(await pool.query('SELECT * FROM maintenance WHERE asset_id=$1 ORDER BY scheduled_on DESC,id DESC',[asset.id])).rows;
  res.render('asset-detail',{title:asset.name,asset,history});
});
for(const table of ['categories','locations']) {
  const label=table==='categories'?'Danh mục':'Phòng ban và vị trí';
  app.get('/'+table,async(req,res)=>{
    const column=table==='categories'?'category_id':'location_id';
    const rows=(await pool.query(`SELECT d.*,count(a.id)::int asset_count FROM ${table} d LEFT JOIN assets a ON a.${column}=d.id GROUP BY d.id ORDER BY d.name`)).rows;
    res.render('dictionary',{title:label,table,rows});
  });
  app.post('/'+table,async(req,res)=>{
    await pool.query(`INSERT INTO ${table}(name) VALUES($1)`,[d.text(req.body.name,'Tên',100)]);
    flash(req,'Đã thêm dữ liệu.');res.redirect(303,'/'+table);
  });
  app.post('/'+table+'/:id',async(req,res)=>{
    const result=await pool.query(`UPDATE ${table} SET name=$1 WHERE id=$2`,[d.text(req.body.name,'Tên',100),d.integerId(req.params.id)]);
    if(!result.rowCount)throw new d.UserError('Không tìm thấy bản ghi.',404);
    flash(req,'Đã cập nhật tên.');res.redirect(303,'/'+table);
  });
}
app.get('/maintenance',async(req,res)=>{
  const status=String(req.query.status||''),q=String(req.query.q||'').slice(0,120);
  if(status&&!Object.hasOwn(d.maintenanceStates,status))throw new d.UserError('Bộ lọc không hợp lệ.');
  let page=Number(req.query.page||1);if(!Number.isInteger(page)||page<1||page>100000)throw new d.UserError('Số trang không hợp lệ.');
  const args=[status,q?'%'+q+'%':''];
  const where="WHERE ($1='' OR m.status=$1) AND ($2='' OR a.code ILIKE $2 OR a.name ILIKE $2 OR m.title ILIKE $2)";
  const count=Number((await pool.query(`SELECT count(*) FROM maintenance m JOIN assets a ON a.id=m.asset_id ${where}`,args)).rows[0].count);
  const pages=Math.max(1,Math.ceil(count/10));page=Math.min(page,pages);
  const rows=(await pool.query(`SELECT m.*,a.code,a.name,m.status='scheduled' AND m.scheduled_on<CURRENT_DATE overdue FROM maintenance m JOIN assets a ON a.id=m.asset_id ${where} ORDER BY m.scheduled_on DESC,m.id DESC LIMIT 10 OFFSET $3`,[...args,(page-1)*10])).rows;
  const assets=(await pool.query("SELECT id,code,name FROM assets WHERE status<>'retired' ORDER BY code")).rows;
  res.render('maintenance',{title:'Lịch và lịch sử bảo trì',rows,assets,status,q,page,pages,count,selected:req.query.asset||''});
});
app.post('/maintenance',async(req,res)=>{const id=await d.schedule(req.body);log('maintenance_scheduled',{maintenance_id:id,request_id:req.id});flash(req,'Đã tạo lịch bảo trì.');res.redirect(303,'/maintenance');});
app.post('/maintenance/:id/:action',async(req,res)=>{
  const result=await d.transition(req.params.id,req.params.action,req.body);
  metrics.maintenanceActions.inc({action:result.action});
  const event={start:'maintenance_started',complete:'maintenance_completed',cancel:'maintenance_cancelled'}[req.params.action];
  log(event,{maintenance_id:Number(req.params.id),asset_id:result.assetId,request_id:req.id});
  flash(req,'Đã cập nhật phiếu bảo trì.');res.redirect(303,'/maintenance');
});
app.use((req,res)=>res.status(404).render('error',{title:'Không tìm thấy trang',message:'Đường dẫn bạn truy cập không tồn tại.'}));
app.use((err,req,res,next)=>{
  res.locals.user=req.session?.user||null;res.locals.path=req.path;res.locals.csrf=req.session?.csrf||'';
  let status=err.status||500,message=err.message;
  if(err.code==='23505'){status=409;message='Mã, serial hoặc tên đã tồn tại. Vui lòng kiểm tra lại.';}
  if(err.code==='23503'){status=400;message='Danh mục hoặc vị trí không tồn tại. Vui lòng tải lại trang.';}
  if(err.code==='23514'){status=400;message='Dữ liệu chưa phù hợp với quy tắc hệ thống.';}
  log(status>=500?'application_error':'request_rejected',{level:status>=500?'error':'warn',status,request_id:req.id,...(status>=500?{code:err.code||'internal'}:{})});
  if(status>=500)message='Không thể xử lý yêu cầu. Vui lòng thử lại hoặc tra log bằng mã '+req.id;
  if(res.headersSent)return next(err);
  res.status(status).render('error',{title:status>=500?'Hệ thống đang gặp lỗi':'Chưa thể thực hiện',message});
});
const server=app.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>log('application_started'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>pool.end().then(()=>process.exit(0))));
