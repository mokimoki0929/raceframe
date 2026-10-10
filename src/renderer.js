/* Original Canvas artwork. Geometry in metres; tokens deliberately enlarged.
 * Rendering offsets avoid visual overlaps but never change race state.
 */
(function(root){
'use strict';const R=root.RaceFrame=root.RaceFrame||{};
const COLORS={1:'#fbfaf4',2:'#29312f',3:'#cf5349',4:'#416aa2',5:'#eccb4b',6:'#3b8969',7:'#e49244',8:'#d995b5'};
function tokenStyle(frame){return {bg:COLORS[frame]||'#919c97',fg:[1,5,7,8].includes(frame)?'#263a31':'#ffffff'};}
class Renderer {
 constructor(canvas,elevation,onSelect){
  this.canvas=canvas;this.elevation=elevation;this.onSelect=onSelect;this.route=null;this.hits=[];
  this.lastSample=null;this.options={};this.background=document.createElement('canvas');
  this.resizeObserver=new ResizeObserver(()=>{this.invalid=true;if(this.route)this.draw(this.lastSample,this.options);});
  this.resizeObserver.observe(canvas.parentElement);this.resizeObserver.observe(elevation);
  canvas.addEventListener('click',e=>{const b=canvas.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top;
    const hit=[...this.hits].reverse().find(h=>Math.hypot(x-h.x,y-h.y)<h.r+5);if(hit)this.onSelect(hit.num);});
 }
 setRoute(route){this.route=route;this.invalid=true;}
 size(canvas){const b=canvas.getBoundingClientRect(),w=Math.max(1,b.width),h=Math.max(1,b.height),dpr=Math.min(devicePixelRatio||1,2);
   if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);this.invalid=true;}
   const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return {ctx,w,h,dpr};}
 transform(w,h,sample,options){
   const route=this.route,all=[...route.loop.pts,...route.points];if(route.firstLoop)all.push(...route.firstLoop.pts);
   let minX=Math.min(...all.map(p=>p.x))-75,maxX=Math.max(...all.map(p=>p.x))+75;
   let minY=Math.min(...all.map(p=>p.y))-60,maxY=Math.max(...all.map(p=>p.y))+110;
   let scale=Math.min(w/(maxX-minX),h/(maxY-minY)),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
   if(options.follow&&sample){const state=sample.states.find(s=>s.num===options.selected)||sample.leader;const p=route.at(state.d,state.lane);cx=p.x;cy=p.y;scale*=2.8;}
   return {scale, cx,cy, map:p=>({x:w/2+(p.x-cx)*scale,y:h/2+(p.y-cy)*scale})};
 }
 path(ctx,points,map,close=false){ctx.beginPath();points.forEach((p,i)=>{const q=map(p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});if(close)ctx.closePath();}
 loopPoints(loop,lane){return loop.pts.map(p=>loop.at(p.s===loop.course.lap?0:p.s,lane));}
 paintBackground(ctx,w,h,tr){
   const {map,scale}=tr,route=this.route,c=route.course;
   ctx.fillStyle='#edf2e6';ctx.fillRect(0,0,w,h);
   // Soft paper-grass texture is deterministic and purely decorative.
   const rand=R.rng('grass-'+c.venue);
   for(let i=0;i<460;i++){const p={x:rand()*w,y:rand()*h};ctx.fillStyle=i%3?'rgba(114,147,108,.075)':'rgba(255,255,255,.3)';ctx.fillRect(p.x,p.y,1,1);}
   const venueCourses=R.COURSES.filter(x=>x.venue===c.venue&&(x.rail==='A'||x.rail==='-')&&x.variant!=='mixed').sort((a,b)=>b.lap-a.lap);
   // A reference silhouette of neighbouring permanent loops.
   for(const other of venueCourses){
     const lp=R.buildLoop(other),middle=this.loopPoints(lp,other.width/2);
     this.path(ctx,middle,map,true);ctx.strokeStyle=other.surface==='dirt'?'#e0d3b8':'#d3e1c7';ctx.lineWidth=Math.max(6,other.width*lp.planPerMeter*scale);ctx.stroke();
   }
   const inside=this.loopPoints(route.loop,-24);
   this.path(ctx,inside,map,true);ctx.fillStyle='#e5eddc';ctx.fill();
   // Infield, pond and grandstands: schematic scenery, never surveyed structures.
   const center=map({x:540,y:330});
   if(c.venue==='kyoto'){
     ctx.beginPath();ctx.ellipse(center.x+26*scale,center.y+16*scale,89*scale,35*scale,-.14,0,Math.PI*2);ctx.fillStyle='#c1d9cc';ctx.fill();
     ctx.strokeStyle='#b5cfc0';ctx.lineWidth=3*scale;ctx.stroke();
   }else{
     ctx.strokeStyle='#d5dfce';ctx.lineWidth=1;ctx.setLineDash([5,8]);
     for(let i=0;i<3;i++){const a=map({x:390,y:290+i*24}),b=map({x:670,y:290+i*24});ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}ctx.setLineDash([]);
   }
   const treeRand=R.rng('trees-'+c.venue);
   for(let i=0;i<25;i++){
    const p=map({x:330+treeRand()*350,y:256+treeRand()*135});if(c.venue==='kyoto'&&i>7)continue;
    ctx.beginPath();ctx.arc(p.x,p.y,(4+treeRand()*3)*scale,0,Math.PI*2);ctx.fillStyle=i%2?'#c6d9b9':'#cedfc1';ctx.fill();
   }
   const stands=map({x:360,y:552});ctx.fillStyle='#d5ddd1';ctx.fillRect(stands.x,stands.y,310*scale,21*scale);
   ctx.fillStyle='#f6f8f2';ctx.fillRect(stands.x+4*scale,stands.y+4*scale,302*scale,4*scale);
   for(let i=0;i<17;i++){ctx.fillStyle='#bdcbb9';ctx.fillRect(stands.x+8*scale+i*17*scale,stands.y+12*scale,10*scale,3*scale);}
   // Selected course: dual rails with a broad, distinct racing surface.
   const lanes=[route.loop];if(route.firstLoop)lanes.unshift(route.firstLoop);
   for(const lp of lanes){
    const width=c.width*lp.planPerMeter*scale;
    this.path(ctx,this.loopPoints(lp,c.width/2),map,true);ctx.strokeStyle='#8caf7b';ctx.lineWidth=width+4;ctx.stroke();
    ctx.strokeStyle=c.surface==='dirt'?'#d9c194':'#a9c88d';ctx.lineWidth=width;ctx.stroke();
    this.path(ctx,this.loopPoints(lp,0),map,true);ctx.strokeStyle='#f9fff2';ctx.lineWidth=Math.max(1.2,1.9*scale);ctx.stroke();
    this.path(ctx,this.loopPoints(lp,c.width),map,true);ctx.strokeStyle='#e6eddd';ctx.lineWidth=Math.max(1,1.4*scale);ctx.stroke();
   }
   if(route.chute){
     const points=[];for(let d=0;d<=route.prefix;d+=3)points.push(route.at(d,c.width/2));points.push(route.at(route.prefix,c.width/2));
     this.path(ctx,points,map);ctx.strokeStyle='#e8efde';ctx.lineWidth=c.width*route.loop.planPerMeter*scale+3;ctx.stroke();
     ctx.strokeStyle=route.turfStart?'#b1cb99':c.surface==='dirt'?'#d9c194':'#a9c88d';ctx.lineWidth=c.width*route.loop.planPerMeter*scale;ctx.stroke();
   }
   // Direction chevrons.
   for(let j=1;j<=8;j++){const p=route.loop.at(c.lap*j/9,c.width/2),q=map(p);ctx.save();ctx.translate(q.x,q.y);ctx.rotate(Math.atan2(p.ty,p.tx));ctx.strokeStyle='rgba(255,255,255,.42)';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(-4,-4);ctx.lineTo(1,0);ctx.lineTo(-4,4);ctx.stroke();ctx.restore();}
   // Last 200 / 400 / 600 metre markers, only on final circuit.
   for(const remaining of [200,400,600,800]){
     if(remaining>=route.distance)continue;const p=route.at(route.distance-remaining,-17),q=map(p);
     ctx.fillStyle='#f6f9ed';ctx.strokeStyle='#b4c4a5';ctx.lineWidth=.8;ctx.beginPath();ctx.roundRect(q.x-12,q.y-8,24,15,3);ctx.fill();ctx.stroke();
     ctx.fillStyle='#63745e';ctx.textAlign='center';ctx.font='9px system-ui';ctx.fillText(String(remaining),q.x,q.y+3);
   }
   this.gate(ctx,map,scale,route.at(0,0),c.width,route.loop.planPerMeter,false);
   this.gate(ctx,map,scale,route.at(route.distance,0),c.width,route.loop.planPerMeter,true);
   if(!this.options.follow){
     ctx.textAlign='center';ctx.fillStyle='#648260';ctx.font='600 13px system-ui';ctx.fillText(R.VENUES[c.venue].name.toUpperCase()+' RACECOURSE',center.x,center.y-13*scale);
     ctx.font='10px system-ui';ctx.fillStyle='#84957b';ctx.fillText(c.direction==='left'?'左回り  /  COUNTERCLOCKWISE':'右回り  /  CLOCKWISE',center.x,center.y+7*scale);
   }
 }
 gate(ctx,map,scale,p,width,unit,finish){
   const a=map(p),b=map({x:p.x+p.nx*width*unit,y:p.y+p.ny*width*unit});ctx.save();
   ctx.strokeStyle=finish?'#304938':'#f0f7e9';ctx.lineWidth=finish?4:5;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
   ctx.strokeStyle=finish?'#f7faef':'#426747';ctx.lineWidth=finish?2:1.5;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);
   const l={x:b.x+p.nx*16,y:b.y+p.ny*16};
   ctx.textAlign='center';ctx.fillStyle=finish?'#314e3c':'#57704d';ctx.font='700 9px system-ui';ctx.fillText(finish?'FINISH':'START',l.x,l.y);ctx.restore();
 }
 draw(sample,options={}){
   if(!this.route)return;this.lastSample=sample;this.options=options;
   const {ctx,w,h,dpr}=this.size(this.canvas),tr=this.transform(w,h,sample,options);
   if(!options.follow){
    if(this.invalid||this.background.width!==this.canvas.width||this.background.height!==this.canvas.height){
     this.background.width=this.canvas.width;this.background.height=this.canvas.height;
     const bc=this.background.getContext('2d');bc.setTransform(dpr,0,0,dpr,0,0);this.paintBackground(bc,w,h,tr);this.invalid=false;
    }
    ctx.drawImage(this.background,0,0,w,h);
   }else this.paintBackground(ctx,w,h,tr);
   this.hits=[];
   if(sample){
     const states=[...sample.states].reverse(),drawn=[],radius=options.follow?12:9.5;
     for(const s of states){
       const p=this.route.at(s.d,s.lane),q=tr.map(p),original={...q},selected=s.num===options.selected;
       // Schematic markers may be moved a few pixels apart for readability.
       for(let k=0;k<400;k++){
        if(!drawn.some(a=>Math.hypot(a.x-q.x,a.y-q.y)<radius*2.03))break;
        const angle=k*2.3999632297,offset=radius*.72*Math.sqrt(k+1);
        q.x=original.x+Math.cos(angle)*offset;q.y=original.y+Math.sin(angle)*offset;
       }
       drawn.push(q);
       if(Math.hypot(q.x-original.x,q.y-original.y)>6){ctx.strokeStyle='#7a9170';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(original.x,original.y);ctx.lineTo(q.x,q.y);ctx.stroke();}
       const style=tokenStyle(s.horse.frame);ctx.save();
       if(selected){ctx.beginPath();ctx.arc(q.x,q.y,radius+5,0,Math.PI*2);ctx.fillStyle='rgba(48,81,46,.13)';ctx.fill();ctx.strokeStyle='#355e40';ctx.lineWidth=1.2;ctx.stroke();}
       ctx.shadowColor='rgba(40,61,35,.23)';ctx.shadowBlur=3;ctx.shadowOffsetY=2;
       ctx.beginPath();ctx.arc(q.x,q.y,radius,0,Math.PI*2);ctx.fillStyle=style.bg;ctx.fill();ctx.shadowColor='transparent';ctx.strokeStyle=s.horse.frame===1?'#b3bba9':'rgba(255,255,255,.88)';ctx.lineWidth=1.25;ctx.stroke();
       ctx.fillStyle=style.fg;ctx.font=`700 ${radius<10?10:12}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(s.num),q.x,q.y+.3);ctx.restore();
       this.hits.push({num:s.num,x:q.x,y:q.y,r:radius});
     }
   }
   this.drawElevation(sample,options);
 }
 drawElevation(sample,options){
   const {ctx,w,h}=this.size(this.elevation),route=this.route,l=35,r=22,t=10,b=21,iw=w-l-r,ih=h-t-b;
   ctx.clearRect(0,0,w,h);
   const maxH=Math.max(route.course.elevation,...route.points.map(p=>p.z),1)*1.10;
   const mp=d=>({x:l+d/route.distance*iw,y:h-b-route.elevation(d)/maxH*ih});
   ctx.font='9px system-ui';ctx.textAlign='right';ctx.fillStyle='#839181';ctx.strokeStyle='#edf0e9';ctx.lineWidth=1;
   for(let j=0;j<3;j++){const z=maxH*j/2,y=h-b-z/maxH*ih;ctx.fillText(z.toFixed(1)+'m',l-7,y+3);ctx.beginPath();ctx.moveTo(l,y);ctx.lineTo(w-r,y);ctx.stroke();}
   ctx.beginPath();ctx.moveTo(l,h-b);for(let d=0;d<=route.distance;d+=6){const p=mp(d);ctx.lineTo(p.x,p.y);}const end=mp(route.distance);ctx.lineTo(end.x,end.y);ctx.lineTo(w-r,h-b);ctx.closePath();ctx.fillStyle='#e5eddc';ctx.fill();
   ctx.beginPath();for(let d=0;d<=route.distance;d+=6){const p=mp(d);d?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}ctx.lineTo(end.x,end.y);ctx.strokeStyle='#8ea17e';ctx.lineWidth=1.5;ctx.stroke();
   ctx.textAlign='center';ctx.fillStyle='#839181';for(let j=0;j<=4;j++){const d=route.distance*j/4;ctx.fillText(j===0?'START':j===4?'FINISH':Math.round(d)+'m',l+iw*j/4,h-5);}
   if(sample){
    const state=sample.states.find(s=>s.num===options.selected)||sample.leader,p=mp(state.d);
    ctx.strokeStyle='#315c40';ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(p.x,t);ctx.lineTo(p.x,h-b);ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(p.x,p.y,3.5,0,Math.PI*2);ctx.fillStyle='#315c40';ctx.fill();
   }
 }
}
Object.assign(R,{Renderer,tokenStyle});
})(globalThis);
