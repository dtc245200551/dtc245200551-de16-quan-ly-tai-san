'use strict';
const assert=require('node:assert/strict');
const queries=[
  '{job="nginx", project="de16hai"} | json | status >= 400',
  '{job="app", project="de16hai"} | json | event=~"maintenance_(scheduled|started|completed|cancelled)"',
  '{job="app", project="de16hai"} | json | level=~"warn|error"'
];
(async()=>{
  for(let i=0;i<queries.length;i++){
    const params=new URLSearchParams({query:queries[i],since:'1h',limit:'10',direction:'backward'});
    const r=await fetch('http://loki:3100/loki/api/v1/query_range?'+params,{signal:AbortSignal.timeout(15000)});
    assert.ok(r.ok,'LogQL '+(i+1)+' HTTP '+r.status);
    const data=await r.json();assert.equal(data.status,'success');
    const count=data.data.result.reduce((n,s)=>n+s.values.length,0);
    assert.ok(count>0,'LogQL '+(i+1)+' has no events; run demo/test and wait for Promtail.');
    console.log(`PASS LogQL ${i+1}: ${count} recent matching events.`);
  }
  const r=await fetch('http://loki:3100/loki/api/v1/label/job/values');const data=await r.json();
  assert.ok(data.data.includes('postgres'),'PostgreSQL log stream missing');
  console.log('PASS: PostgreSQL JSON log stream is also indexed.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
