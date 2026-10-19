'use strict';
const assert=require('node:assert/strict');
async function get(path){const r=await fetch('http://prometheus:9090'+path,{signal:AbortSignal.timeout(10000)});assert.ok(r.ok,'Prometheus '+r.status);return r.json();}
async function query(expr){const r=await get('/api/v1/query?query='+encodeURIComponent(expr));assert.equal(r.status,'success');return r.data.result;}
(async()=>{
  const targets=(await get('/api/v1/targets')).data.activeTargets;
  assert.equal(targets.length,5);for(const t of targets)assert.equal(t.health,'up',t.labels.job+': '+t.lastError);
  for(const metric of ['nginx_up','pg_up']){const rows=await query(metric);assert.ok(rows.some(r=>Number(r.value[1])===1),metric);}
  for(const service of ['app','nginx','postgres']){
    const rows=await query(`container_memory_working_set_bytes{container_label_com_docker_compose_project="de16hai",container_label_com_docker_compose_service="${service}"}`);
    assert.ok(rows.some(r=>Number(r.value[1])>0),'Missing container RAM: '+service);
    const cpu=await query(`rate(container_cpu_usage_seconds_total{container_label_com_docker_compose_project="de16hai",container_label_com_docker_compose_service="${service}"}[2m])`);
    assert.ok(cpu.some(r=>Number.isFinite(Number(r.value[1]))),'Missing container CPU rate: '+service);
  }
  const total=await query('sum(hai_assets_by_status)');assert.ok(Number(total[0]?.value[1])>=12);
  assert.ok((await query('pg_stat_database_numbackends{datname="assets"}')).length);
  const grafana=await fetch('http://grafana:3000/api/health');assert.ok(grafana.ok);
  console.log('PASS: 5 targets UP; Nginx/PostgreSQL connected; real app/nginx/postgres container RAM labels; persisted asset gauge; Grafana healthy.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
