import{j as t}from"./xyflow-BjyyB-fm.js";import{j as n}from"./recharts-BAioKACW.js";import{c as S}from"./index-DbRRJYVo.js";const N=`{
  "type": "email.send",
  "args": ["user@example.com", "welcome"],
  "queue": "default",
  "retry": {
    "max_attempts": 3,
    "backoff": "exponential"
  }
}`,J={"Simple Job":`{
  "type": "email.send",
  "args": ["user@example.com", "welcome"],
  "queue": "default"
}`,"With Retry":`{
  "type": "payment.charge",
  "args": [{"amount": 9999, "currency": "usd"}],
  "queue": "payments",
  "retry": {
    "max_attempts": 5,
    "backoff": "exponential"
  }
}`,"Scheduled Job":`{
  "type": "report.generate",
  "args": ["monthly", "2025-01"],
  "queue": "reports",
  "scheduled_at": "__SCHEDULED_AT__"
}`,"Workflow (Chain)":`{
  "workflow": "chain",
  "jobs": [
    {"type": "data.extract", "args": ["source-api"]},
    {"type": "data.transform", "args": ["normalize"]},
    {"type": "data.load", "args": ["warehouse"]}
  ]
}`,"Batch Enqueue":`{
  "batch": true,
  "jobs": [
    {"type": "email.send", "args": ["alice@example.com", "welcome"]},
    {"type": "email.send", "args": ["bob@example.com", "welcome"]},
    {"type": "email.send", "args": ["charlie@example.com", "welcome"]}
  ]
}`},R={scheduled:"bg-violet-400 text-violet-950",available:"bg-blue-400 text-blue-950",pending:"bg-amber-400 text-amber-950",active:"bg-orange-400 text-orange-950",completed:"bg-emerald-400 text-emerald-950",retryable:"bg-red-400 text-red-950",cancelled:"bg-gray-400 text-gray-950",discarded:"bg-red-600 text-white"},L={info:"text-blue-400",success:"text-emerald-400",error:"text-red-400",warn:"text-amber-400"};function A(){const[x,j]=n.useState(N),[f,b]=n.useState([]),[w,T]=n.useState([]),[g,h]=n.useState(!1),[y,k]=n.useState("http://localhost:8080"),[C,D]=n.useState("Simple Job"),E=n.useRef(null),a=n.useRef(!0),p=n.useRef(new Set),i=n.useRef(null);n.useEffect(()=>(a.current=!0,()=>{var e;a.current=!1,(e=i.current)==null||e.abort();for(const r of p.current)clearTimeout(r);p.current.clear()}),[]);const o=n.useCallback((e,r)=>{a.current&&T(c=>[...c,{timestamp:new Date().toISOString().slice(11,23),level:e,message:r}])},[]);n.useEffect(()=>{var e;(e=E.current)==null||e.scrollIntoView({behavior:"smooth"})},[w]);const v=n.useCallback(e=>{const r=["available","pending","active","completed"],c=[0,500,1e3,2500];r.forEach((s,u)=>{const l=setTimeout(()=>{p.current.delete(l),a.current&&(b(d=>d.map(m=>m.id===e?{...m,state:s,timestamp:new Date().toISOString()}:m)),o(s==="completed"?"success":"info",`Job ${e.slice(0,12)}... → ${s}`))},c[u]);p.current.add(l)})},[o]),O=n.useCallback(async()=>{var c;(c=i.current)==null||c.abort();const e=new AbortController;i.current=e,h(!0),o("info","Enqueuing job...");let r;try{r=JSON.parse(x)}catch{o("error","Invalid JSON — check your job definition"),i.current===e&&(i.current=null),a.current&&h(!1);return}try{const s=await fetch(`${y}/v1/jobs`,{method:"POST",headers:{"Content-Type":"application/json"},body:x,signal:e.signal});if(e.signal.aborted||!a.current)return;if(s.ok){const u=await s.json();if(e.signal.aborted||!a.current)return;const l=u.id||`sim-${Date.now().toString(36)}`,d=r.type||"unknown";o("success",`Job enqueued: ${l}`);const m={id:l,type:d,state:"available",timestamp:new Date().toISOString()};b(q=>[m,...q].slice(0,50)),v(l)}else throw new Error(`Server returned ${String(s.status)}`)}catch{if(e.signal.aborted||!a.current)return;const s=`sim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,u=r.type||r.workflow||"batch";o("warn","Server unavailable — simulating locally"),o("success",`Job enqueued (simulated): ${s}`);const l={id:s,type:u,state:"available",timestamp:new Date().toISOString()};b(d=>[l,...d].slice(0,50)),v(s)}finally{i.current===e&&(i.current=null),a.current&&h(!1)}},[x,y,o,v]),_=e=>{D(e);let r=J[e]||N;r=r.replace("__SCHEDULED_AT__",new Date(Date.now()+6e4).toISOString()),j(r)};return t.jsxs("div",{className:"flex h-full flex-col font-mono text-xs",children:[t.jsxs("div",{className:"grid flex-1 grid-cols-2 gap-px bg-border min-h-0",children:[t.jsxs("div",{className:"flex flex-col bg-background p-3 min-h-0",children:[t.jsxs("div",{className:"mb-2 flex items-center justify-between",children:[t.jsx("span",{className:"text-xs font-semibold text-foreground",children:"Job Definition"}),t.jsx("select",{"aria-label":"Job template",value:C,onChange:e=>_(e.target.value),className:"rounded border bg-muted px-2 py-1 text-[11px] text-foreground",children:Object.keys(J).map(e=>t.jsx("option",{value:e,children:e},e))})]}),t.jsx("textarea",{"aria-label":"Job definition",name:"job-definition",value:x,onChange:e=>j(e.target.value),className:"flex-1 resize-none rounded border bg-muted/50 p-3 font-mono text-xs leading-relaxed text-foreground focus:outline-none focus:ring-1 focus:ring-primary",spellCheck:!1}),t.jsxs("div",{className:"mt-2 flex items-center gap-2",children:[t.jsx("button",{onClick:()=>void O(),disabled:g,className:S("rounded-md px-4 py-1.5 text-xs font-bold transition-colors",g?"cursor-wait bg-primary/50 text-primary-foreground":"bg-primary text-primary-foreground hover:bg-primary/90"),children:g?"Enqueuing…":"Enqueue"}),t.jsx("input",{"aria-label":"OJS server URL",name:"server-url",type:"url",autoComplete:"off",value:y,onChange:e=>k(e.target.value),placeholder:"Server URL…",className:"flex-1 rounded border bg-muted px-2 py-1.5 font-mono text-[11px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"})]})]}),t.jsxs("div",{className:"flex flex-col bg-background p-3 min-h-0",children:[t.jsxs("span",{className:"mb-2 text-xs font-semibold text-foreground",children:["Job State Transitions (",f.length,")"]}),t.jsx("div",{className:"flex-1 overflow-y-auto",children:f.length===0?t.jsx("div",{className:"mt-10 text-center text-xs text-muted-foreground",children:"Enqueue a job to see state transitions"}):f.map((e,r)=>t.jsxs("div",{className:"flex items-center gap-2 border-b py-1.5 text-[11px]",children:[t.jsx("span",{className:S("min-w-[70px] rounded px-2 py-0.5 text-center text-[10px] font-semibold",R[e.state]||"bg-muted text-muted-foreground"),children:e.state}),t.jsx("span",{className:"text-muted-foreground",children:e.type}),t.jsxs("span",{className:"ml-auto text-[10px] text-muted-foreground/60",children:[e.id.slice(0,12),"..."]})]},`${e.id}-${String(r)}`))})]})]}),t.jsxs("div",{className:"h-[180px] shrink-0 overflow-y-auto border-t bg-muted/30 px-3 py-2",children:[t.jsx("span",{className:"mb-1 block text-[11px] font-semibold text-foreground",children:"Execution Log"}),w.map((e,r)=>t.jsxs("div",{className:S("leading-relaxed",L[e.level]),children:[t.jsxs("span",{className:"text-muted-foreground/50",children:["[",e.timestamp,"]"]})," ",e.message]},r)),t.jsx("div",{ref:E})]})]})}export{A as JobIDE};
