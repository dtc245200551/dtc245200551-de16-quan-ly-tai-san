'use strict';
const fs=require('node:fs'),path=require('node:path');
const ds={type:'prometheus',uid:'hai-prometheus'};
const panels=[];
function panel(title,type,x,y,w,h,unit,queries){
  const id=panels.length+1;
  panels.push({id,title,type,gridPos:{x,y,w,h},datasource:ds,
    fieldConfig:{defaults:{unit,color:{mode:'palette-classic'},thresholds:{mode:'absolute',steps:[{color:'green',value:null}]}},overrides:[]},
    options:type==='stat'?{reduceOptions:{calcs:['lastNotNull'],fields:'',values:false},colorMode:'value',graphMode:'area',textMode:'auto'}:{legend:{displayMode:'list',placement:'bottom'},tooltip:{mode:'multi'}},
    targets:queries.map((q,i)=>({refId:String.fromCharCode(65+i),expr:q[0],legendFormat:q[1]||'',datasource:ds,range:true}))});
}
panel('Tổng thiết bị','stat',0,0,6,4,'short',[['sum(hai_assets_by_status)']]);
panel('Thiết bị đang bảo trì','stat',6,0,6,4,'short',[['sum(hai_assets_by_status{status="maintenance"})']]);
panel('Nginx exporter kết nối','stat',12,0,6,4,'short',[['nginx_up']]);
panel('PostgreSQL exporter kết nối','stat',18,0,6,4,'short',[['pg_up']]);
const labels='container_label_com_docker_compose_project="de16hai",image!=""';
const service='container_label_com_docker_compose_service';
panel('CPU từng container (% một lõi)','timeseries',0,4,12,8,'percent',[[`sum by (${service})(rate(container_cpu_usage_seconds_total{${labels}}[2m])) * 100`,`{{${service}}}`]]);
panel('RAM từng container (working set)','timeseries',12,4,12,8,'bytes',[[`sum by (${service})(container_memory_working_set_bytes{${labels}})`,`{{${service}}}`]]);
panel('Lưu lượng mạng container','timeseries',0,12,12,8,'Bps',[[`sum by (${service})(rate(container_network_receive_bytes_total{${labels}}[2m]))`,`Nhận {{${service}}}`],[`sum by (${service})(rate(container_network_transmit_bytes_total{${labels}}[2m]))`,`Gửi {{${service}}}`]]);
panel('Yêu cầu HTTP ứng dụng / giây','timeseries',12,12,12,8,'reqps',[['sum by (route)(rate(hai_http_requests_total{route!="/healthz",route!="/readyz"}[2m]))','{{route}}']]);
panel('Độ trễ HTTP p95','timeseries',0,20,12,8,'s',[['histogram_quantile(0.95,sum by (le)(rate(hai_http_request_duration_seconds_bucket[2m])))','p95']]);
panel('HTTP lỗi 4xx và 5xx / giây','timeseries',12,20,12,8,'reqps',[['sum by (status_code)(rate(hai_http_requests_total{status_code=~"4..|5.."}[2m])) or vector(0)','{{status_code}}']]);
panel('Kết nối Nginx đang hoạt động','timeseries',0,28,8,7,'short',[['nginx_connections_active','Kết nối']]);
panel('Kết nối database assets','timeseries',8,28,8,7,'short',[['pg_stat_database_numbackends{datname="assets"}','Kết nối']]);
panel('Giao dịch PostgreSQL / giây','timeseries',16,28,8,7,'ops',[['rate(pg_stat_database_xact_commit{datname="assets"}[2m])','Commit'],['rate(pg_stat_database_xact_rollback{datname="assets"}[2m])','Rollback']]);
panel('Thiết bị theo trạng thái','timeseries',0,35,12,7,'short',[['hai_assets_by_status','{{status}}']]);
panel('Thao tác bảo trì thành công từ lúc app chạy','timeseries',12,35,12,7,'short',[['sum by (action)(hai_maintenance_actions_total) or vector(0)','{{action}}']]);
const dashboard={uid:'hai-assets',title:'Hải Asset | Thiết bị và vận hành',schemaVersion:41,version:1,editable:false,tags:['de16','hai','wsl2'],timezone:'Asia/Ho_Chi_Minh',refresh:'15s',time:{from:'now-30m',to:'now'},panels,annotations:{list:[]},links:[]};
const dir=path.resolve(__dirname,'../observability/grafana/dashboards');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'hai-assets.json'),JSON.stringify(dashboard,null,2)+'\n');
console.log(`Generated ${panels.length} monitoring panels.`);
