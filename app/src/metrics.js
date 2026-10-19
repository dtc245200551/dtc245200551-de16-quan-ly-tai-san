'use strict';
const client=require('prom-client');
const {pool}=require('./db');
const registry=new client.Registry();
client.collectDefaultMetrics({register:registry,prefix:'hai_'});
const requests=new client.Counter({name:'hai_http_requests_total',help:'HTTP responses by normalized route',labelNames:['method','route','status_code'],registers:[registry]});
const duration=new client.Histogram({name:'hai_http_request_duration_seconds',help:'HTTP response latency',labelNames:['method','route'],buckets:[0.005,0.01,0.025,0.05,0.1,0.25,0.5,1,2,5],registers:[registry]});
const maintenanceActions=new client.Counter({name:'hai_maintenance_actions_total',help:'Successful maintenance workflow transitions',labelNames:['action'],registers:[registry]});
const assetsByStatus=new client.Gauge({name:'hai_assets_by_status',help:'Persisted asset count by current status',labelNames:['status'],registers:[registry],async collect(){
  const result=await pool.query('SELECT status,count(*)::int count FROM assets GROUP BY status');
  this.reset();for(const status of ['available','in_use','maintenance','retired'])this.set({status},result.rows.find(r=>r.status===status)?.count||0);
}});
function observe(req,res,next){
  const start=performance.now();
  res.on('finish',()=>{if(req.path==='/metrics')return;const route=String(req.route?.path||'unmatched');requests.inc({method:req.method,route,status_code:String(res.statusCode)});duration.observe({method:req.method,route},(performance.now()-start)/1000);});
  next();
}
module.exports={registry,observe,maintenanceActions,assetsByStatus};
