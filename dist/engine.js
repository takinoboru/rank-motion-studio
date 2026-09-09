/* Rank Motion: deterministic p5.js / Canvas2D renderer. Coordinates use a 1920×1080 design space. */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const mix=(a,b,t)=>a+(b-a)*t;
const easePresets={ease:[.42,0,.58,1],linear:[0,0,1,1],in:[.42,0,1,1],out:[0,0,.58,1],back:[.34,1.56,.64,1]};
function bezier(x,c=[.42,0,.58,1]){
  if(x<=0)return 0;if(x>=1)return 1;
  const f=(t,a,b)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;
  let lo=0,hi=1,t=x;
  for(let i=0;i<22;i++){t=(lo+hi)/2;if(f(t,c[0],c[2])<x)lo=t;else hi=t;}
  return f(t,c[1],c[3]);
}
function interpolate(a,b,t){
  if(typeof a==='number'&&typeof b==='number')return mix(a,b,t);
  if(typeof a==='string'&&/^#[0-9a-f]{6}$/i.test(a)&&/^#[0-9a-f]{6}$/i.test(b)){
    const parts=[1,3,5].map(i=>clamp(Math.round(mix(parseInt(a.slice(i,i+2),16),parseInt(b.slice(i,i+2),16),t)),0,255).toString(16).padStart(2,'0'));
    return '#'+parts.join('');
  }
  return t>=1?b:a;
}
const DEFAULTS={
  x:960,y:590,scale:1,rotation:-4,skew:-9,rowRotation:0,stepX:31,gap:124,width:980,height:102,radius:51,stroke:4,inset:10,innerStroke:2,shadow:13,shadowX:0,
  fill:'#fafaf7',strokeColor:'#171918',textColor:'#171918',nameColor:'#171918',ptColor:'#171918',badgeColor:'#171918',badgeText:'#ffffff',bg:'#edeee8',accent:'#d3f66b',font:'Noto Sans JP',nameSize:28,ptSize:59,rankSize:62,
  startRank:7,title:'リスナー甲子園',subtitle:'RADIO NAME RANKING / 2026',titleSize:43,showTitle:true,showGrid:true,texture:0,opacity:1,
  namePrefix:'ラジオネーム',unit:'pt',rankSuffix:'位',swapDuration:.72,swapArc:42,swapEase:'ease',entrance:'slide',entranceDuration:.75,stagger:.12,roll:true
};
const ROW_DEFAULTS={name:'新しいラジオネーム',points:0,x:0,y:0,rotation:0,scale:1,opacity:1,delay:0,reveal:1,highlight:false,visible:true};
function makeProject(){
  return {version:1,name:'リスナー甲子園',duration:12,fps:60,width:1920,height:1080,scene:{...DEFAULTS},rankers:[
    {id:'r1',...ROW_DEFAULTS,name:'ミッドナイト',points:24},
    {id:'r2',...ROW_DEFAULTS,name:'雨の日のラジオ',points:22},
    {id:'r3',...ROW_DEFAULTS,name:'月とコーヒー',points:18},
    {id:'r4',...ROW_DEFAULTS,name:'夜ふかしレコード',points:15},
    {id:'r5',...ROW_DEFAULTS,name:'うなぎポテト',points:13,highlight:true}
  ],tracks:{'r5.points':[{id:'k1',time:2,value:13,ease:'ease',curve:[.42,0,.58,1]},{id:'k2',time:6,value:26,ease:'ease',curve:[.42,0,.58,1]}]},preview:1280};
}
function valueAt(project,scope,prop,t){
  const obj=scope==='scene'?project.scene:project.rankers.find(r=>r.id===scope);
  const inherited=scope!=='scene'&&obj?.[prop]===undefined;
  const base=inherited?valueAt(project,'scene',prop,t):obj?.[prop];
  const keys=project.tracks[scope+'.'+prop];
  if(!keys?.length)return base;
  if(t<keys[0].time)return base;
  let prev=keys[0];
  for(let i=1;i<keys.length;i++){
    const next=keys[i];
    if(t<next.time){if(prev.ease==='hold')return prev.value;
      const q=(t-prev.time)/(next.time-prev.time);
      return interpolate(prev.value,next.value,bezier(q,prev.curve||easePresets[prev.ease]||easePresets.ease));}
    prev=next;
  }
  return prev.value;
}
function resolved(project,scope,t){
  const obj=scope==='scene'?project.scene:project.rankers.find(r=>r.id===scope);
  const keys=new Set([...Object.keys(DEFAULTS),...Object.keys(obj||{})]);
  const result=Object.fromEntries([...keys].map(k=>[k,valueAt(project,scope,k,t)]));
  for(const prop of ['width','height','scale','nameSize','ptSize','rankSize','gap'])result[prop]=Math.max(.01,result[prop]);
  for(const prop of ['stroke','innerStroke','radius','inset','shadow'])result[prop]=Math.max(0,result[prop]);
  return result;
}
function point(project,id,t){return clamp(Number(valueAt(project,id,'points',t))||0,0,9999999);}
function sortedAt(project,t){return project.rankers.map((r,i)=>({id:r.id,points:point(project,r.id,t),i})).sort((a,b)=>b.points-a.points||a.i-b.i).map(r=>r.id);}
function compileRanking(project){
  // Find rank crossings at 240 Hz, then build explicit, seekable swap segments.
  let order=sortedAt(project,0),positions=Object.fromEntries(order.map((id,i)=>[id,i]));
  const events=[{time:0,from:{...positions},to:{...positions},order:[...order],duration:0,ease:'ease'}];
  const count=Math.ceil(project.duration*240);
  for(let i=1;i<=count;i++){
    const time=Math.min(i/240,project.duration),next=sortedAt(project,time);
    if(next.some((id,k)=>id!==order[k])){
      const old=events[events.length-1],u=old.duration?clamp((time-old.time)/old.duration,0,1):1;
      const q=bezier(u,easePresets[old.ease]||easePresets.ease);
      const from=Object.fromEntries(next.map(id=>[id,mix(old.from[id],old.to[id],q)]));
      positions=Object.fromEntries(next.map((id,k)=>[id,k]));
      events.push({time,from,to:positions,order:next,duration:clamp(valueAt(project,'scene','swapDuration',time),.01,5),ease:valueAt(project,'scene','swapEase',time)});order=next;
    }
  }
  return events;
}
function rankingAt(events,t){
  let low=0,high=events.length-1;
  while(low<high){const mid=Math.ceil((low+high)/2);if(events[mid].time<=t)low=mid;else high=mid-1;}
  const e=events[low],u=e.duration?clamp((t-e.time)/e.duration,0,1):1,q=bezier(u,easePresets[e.ease]||easePresets.ease);
  return {event:e,progress:u,positions:Object.fromEntries(e.order.map(id=>[id,mix(e.from[id],e.to[id],q)])),order:e.order};
}
function path(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,clamp(r,0,Math.min(w,h)/2));}
function text(ctx,s,x,y,size,color,font,weight=700,align='left'){
  ctx.font=`${weight} ${Math.max(1,size)}px "${String(font).replaceAll('"','')}","Noto Sans JP","Hiragino Kaku Gothic ProN",sans-serif`;
  ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(String(s),x,y);
}
function fitText(ctx,s,maxWidth,size,font,weight){
  ctx.font=`${weight} ${size}px "${String(font).replaceAll('"','')}","Noto Sans JP",sans-serif`;
  return Math.min(size,size*maxWidth/Math.max(1,ctx.measureText(String(s)).width));
}
function rollingNumber(ctx,n,x,y,size,color,font,roll){
  n=clamp(n,0,9999999);const nearest=Math.round(n);
  const digits=Math.max(2,String(roll?Math.floor(n):nearest).length);const dw=size*.63;
  ctx.save();ctx.beginPath();ctx.rect(x-digits*dw-5,y-size*.58,digits*dw+10,size*1.2);ctx.clip();
  for(let i=0;i<digits;i++){
    const quotient=n/10**i,whole=Math.floor(quotient),frac=quotient-whole;
    // Higher wheels engage only during the last unit before a carry.
    const slide=roll?(i===0?frac:clamp(n%10**i-(10**i-1),0,1)):0;
    const digit=roll?whole%10:Math.floor(nearest/10**i)%10;
    const dx=x-i*dw-dw*.5;
    text(ctx,digit,dx,y-slide*size*1.15,size,color,font,900,'center');
    if(slide>0)text(ctx,(digit+1)%10,dx,y+(1-slide)*size*1.15,size,color,font,900,'center');
  }
  ctx.restore();
}
function render(ctx,project,t,w,h,events,options={}){
  const g=resolved(project,'scene',t);ctx.save();ctx.clearRect(0,0,w,h);
  if(!options.transparent){ctx.fillStyle=g.bg;ctx.fillRect(0,0,w,h);}
  const unit=Math.min(w/1920,h/1080);ctx.translate((w-1920*unit)/2,(h-1080*unit)/2);ctx.scale(unit,unit);
  if(g.showGrid&&!options.transparent){ctx.fillStyle=g.textColor;ctx.globalAlpha=.07;for(let y=22;y<1080;y+=26)for(let x=22;x<1920;x+=26){ctx.fillRect(x,y,1.5,1.5);}ctx.globalAlpha=1;}
  if(g.showTitle){
    text(ctx,g.subtitle,138,104,17,g.textColor,g.font,500);text(ctx,g.title,138,165,g.titleSize,g.textColor,g.font,900);
    ctx.strokeStyle=g.textColor;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(138,214);ctx.lineTo(1782,214);ctx.stroke();
    text(ctx,'RANK / PT',1782,165,19,g.textColor,g.font,700,'right');
  }
  const ranking=rankingAt(events,t),n=project.rankers.length;
  ctx.translate(g.x,g.y);ctx.rotate(g.rotation*Math.PI/180);ctx.transform(1,0,Math.tan(g.skew*Math.PI/180),1,0,0);ctx.scale(g.scale,g.scale);
  const rows=[...project.rankers].sort((a,b)=>Number(a.highlight)-Number(b.highlight));
  for(const row of rows){
    const r=resolved(project,row.id,t);if(!r.visible)continue;
    const index=project.rankers.indexOf(row),pos=ranking.positions[row.id],rank=ranking.order.indexOf(row.id)+Math.round(g.startRank);
    let enter=clamp((t-r.delay-index*g.stagger)/Math.max(.01,r.entranceDuration),0,1),e=bezier(enter,easePresets.out);
    if(r.entrance==='none')e=1;
    const delta=ranking.event.to[row.id]-ranking.event.from[row.id];
    const arc=Math.sin(ranking.progress*Math.PI)*g.swapArc*Math.sign(delta);
    const dx=(pos-(n-1)/2)*g.stepX+r.x+arc+(r.entrance==='slide'?(1-e)*-130:0);
    const dy=(pos-(n-1)/2)*g.gap+r.y;
    ctx.save();ctx.translate(dx,dy);ctx.rotate((g.rowRotation+r.rotation)*Math.PI/180);const rs=r.scale*(r.entrance==='scale'?.65+.35*e:1);ctx.scale(rs,rs);ctx.globalAlpha=clamp(g.opacity*r.opacity*(r.entrance==='none'?1:e),0,1);
    const width=r.width,height=r.height,left=-width/2,top=-height/2;
    ctx.fillStyle=r.strokeColor;path(ctx,left+g.shadowX,top+r.shadow,width,height,r.radius);ctx.fill();
    ctx.fillStyle=r.highlight?g.accent:r.fill;ctx.strokeStyle=r.strokeColor;ctx.lineWidth=r.stroke;
    path(ctx,left,top,width,height,r.radius);ctx.fill();if(r.stroke>0)ctx.stroke();
    const inset=clamp(r.inset,0,height/3);ctx.lineWidth=r.innerStroke;path(ctx,left+inset,top+inset,width-inset*2,height-inset*2,Math.max(0,r.radius-inset));if(r.innerStroke>0)ctx.stroke();
    if(r.texture>0||r.highlight){ctx.save();path(ctx,left+inset,top+inset,width-inset*2,height-inset*2,Math.max(0,r.radius-inset));ctx.clip();ctx.fillStyle=r.textColor;ctx.globalAlpha*=r.highlight?.13:r.texture;for(let yy=top+5;yy<height/2;yy+=8)for(let xx=left+5;xx<width/2;xx+=8){ctx.beginPath();ctx.arc(xx+(Math.round(yy/8)%2)*4,yy,1,0,7);ctx.fill();}ctx.restore();}
    const badgeX=left+height*.83,br=height*.405;ctx.fillStyle=r.badgeColor;ctx.beginPath();ctx.arc(badgeX,0,br,0,7);ctx.fill();
    text(ctx,rank,badgeX,0,Math.min(r.rankSize,br*1.6/(String(rank).length>1?1.2:1)),r.badgeText,r.font,900,'center');
    text(ctx,g.rankSuffix,badgeX+br+10,height*.17,Math.min(36,height*.34),r.textColor,r.font,700);
    const nameLeft=left+height*2.25,nameRight=width/2-inset-31,nameWidth=Math.max(20,nameRight-nameLeft);
    const label=g.namePrefix+' '+r.name;const ns=fitText(ctx,label,nameWidth,r.nameSize,r.font,700);
    ctx.save();ctx.beginPath();ctx.rect(nameLeft,top+inset,nameWidth*clamp(r.reveal*(r.entrance==='type'?enter:1),0,1),height*.44);ctx.clip();text(ctx,label,(nameLeft+nameRight)/2,-height*.235,ns,r.nameColor,r.font,700,'center');ctx.restore();
    ctx.lineWidth=1.8;ctx.strokeStyle=r.textColor;ctx.beginPath();ctx.moveTo(nameLeft,-height*.03);ctx.lineTo(nameRight,-height*.03);ctx.stroke();
    const score=point(project,row.id,t),digits=Math.max(2,String(r.roll?Math.floor(score):Math.round(score)).length);const ps=Math.max(1,Math.min(r.ptSize,height*.58,Math.max(10,nameWidth-60)/(digits*.63)));
    const cx=(nameLeft+nameRight)/2,end=cx+digits*ps*.63/2-10;
    rollingNumber(ctx,score,end,height*.26,ps,r.ptColor,r.font,r.roll);
    text(ctx,g.unit,end+8,height*.35,Math.min(25,height*.23),r.ptColor,r.font,700);
    ctx.restore();
  }
  ctx.restore();
}
const api={clamp,mix,bezier,easePresets,interpolate,DEFAULTS,ROW_DEFAULTS,makeProject,valueAt,resolved,point,sortedAt,compileRanking,rankingAt,render};
root.RankEngine=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
