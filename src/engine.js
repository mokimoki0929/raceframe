/* Deterministic probability-preserving visual race generator.
 * P(winner=i)=p_i/sum(p). Trajectories are conditional animation, NOT forecasting.
 */
(function(root){
 'use strict';const R=root.RaceFrame=root.RaceFrame||{};
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function hash(text){let h=2166136261;for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
 function rng(seed){let a=hash(seed);return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
 function normal(random){return Math.sqrt(-2*Math.log(Math.max(1e-12,random())))*Math.cos(2*Math.PI*random());}
 function normalize(horses){
   if(!Array.isArray(horses)||horses.length<2||horses.length>18)throw new Error('A race must contain 2-18 horses.');
   const nums=new Set();let sum=0;
   for(const h of horses){if(!Number.isInteger(h.num)||h.num<1||h.num>18||nums.has(h.num))throw new Error('Invalid/duplicate horse number.');nums.add(h.num);if(!Number.isFinite(h.prob)||h.prob<0)throw new Error('Invalid probability.');sum+=h.prob;}
   if(!(sum>0))throw new Error('Probability sum must be positive.');
   return horses.map(h=>({...h,p:h.prob/sum}));
 }
 function order(horses,random){
   // Exponential race / Plackett-Luce. Zero weights never beat positive weights.
   return horses.map(h=>({horse:h,key:h.p>0?-Math.log(Math.max(1e-12,1-random()))/h.p:Infinity,tie:random()}))
      .sort((a,b)=>a.key-b.key||a.tie-b.tie).map(x=>x.horse);
 }
 function styleEarly(style){return {escape:.93,front:.70,stalk:.35,close:.12,unknown:.5}[style]??.5;}
 function createRace(horses,route,options={}){
   const field=normalize(horses), seed=String(options.seed??'1'),random=rng(seed), finishing=order(field,random),D=route.distance;
   // Scene parameters affect timings/positions only; the sampled winner is fixed.
   const leaders=field.filter(h=>styleEarly(h.style)>.68).length;
   const pace=options.pace==='slow'?-1:options.pace==='fast'?1:options.pace==='normal'?0:clamp((leaders-2)*.28+normal(random)*.38,-1,1);
   const goingPenalty={good:0,yielding:.02,soft:.04,heavy:.065}[options.going]||0;
   const baseSpeed=route.course.surface==='dirt'?15.4:16.25;
   let firstTime=D/baseSpeed*(1+goingPenalty+.022*normal(random)) + .45*route.course.elevation;
   firstTime=Math.max(40,firstTime);
   let T=firstTime;
   const plans=[];
   finishing.forEach((h,rank)=>{
     if(rank)T+=.025+Math.min(1.1,-Math.log(Math.max(.00001,1-random()))*(.16+.024*rank));
     const finishTime=T,early=h.early??styleEarly(h.style),late=h.late??(1-early),phase=random()*6.28318,breakDelay=.05+random()*.35+(random()<.06?random()*.75:0);
     const n=Math.ceil(D/4),ds=D/n, times=[breakDelay];let accum=breakDelay;
     for(let j=1;j<=n;j++){
       const d=(j-.5)*ds,u=d/D;
       const earlyFade=Math.exp(-u*4.5),lateRise=Math.pow(u,3.4);
       let factor=1+(early-.5)*.16*earlyFade+(late-.5)*.17*lateRise;
       factor+=pace*.025*(1-2*u);
       factor-=pace*Math.max(0,early-.5)*.05*lateRise;
       factor-=route.grade(d)*2.1;
       factor+=.011*Math.sin(u*15+phase)+.006*Math.sin(u*37+phase);
       factor-=.09*Math.exp(-d/28); // Smooth acceleration off the gate.
       accum+=ds/(baseSpeed*clamp(factor,.60,1.35));times.push(accum);
     }
     // Continuous time scaling, not a last-second positional correction.
     const scale=finishTime/accum;for(let j=0;j<times.length;j++)times[j]*=scale;
     const row=horses.findIndex(x=>x.num===h.num),laneStart=1+row*(Math.min(route.course.width-3,28)/(Math.max(1,field.length-1)));
     const laneMid=2+(row%5)*3.1+random()*1.7;
     const laneEnd=2+(rank%7)*3.5;
     plans.push({horse:h,rank:rank+1,finishTime,times,ds,laneStart,laneMid,laneEnd,phase});
   });
   const duration=Math.max(...plans.map(p=>p.finishTime));
   function sample(time){
     time=clamp(time,0,duration);const states=plans.map(p=>{
       let lo=0,hi=p.times.length-1;
       while(lo<hi){let mid=(lo+hi)>>1;if(p.times[mid]<time)lo=mid+1;else hi=mid;}
       let d=0,v=0;
       if(time>=p.finishTime)d=D;
       else if(lo>0){const ta=p.times[lo-1],tb=p.times[lo],f=(time-ta)/(tb-ta);d=(lo-1+f)*p.ds;v=p.ds/(tb-ta);}
       const u=clamp(d/D,0,1),a=clamp(d/230,0,1),b=clamp((u-.65)/.3,0,1),sm=x=>x*x*(3-2*x);
       const lane=(p.laneStart+(p.laneMid-p.laneStart)*sm(a))*(1-sm(b))+p.laneEnd*sm(b);
       return {num:p.horse.num,horse:p.horse,d:clamp(d,0,D),speed:v,finished:time>=p.finishTime,finishTime:p.finishTime,rank:p.rank,lane,z:route.elevation(d)};
     }).sort((a,b)=>b.d-a.d||a.finishTime-b.finishTime);
     states.forEach((s,i)=>s.position=i+1);
     return {time,states,leader:states[0],finished:time>=duration,remaining:Math.max(0,D-states[0].d),pace};
   }
   return {seed,route,field,plans,order:finishing.map(h=>h.num),duration,pace,firstTime,sample};
 }
 function monteCarlo(horses,n,seed='batch'){
   if(!Number.isInteger(n)||n<1||n>1000000)throw new Error('Invalid simulation count.');
   const field=normalize(horses),random=rng(seed),stats=new Map(field.map(h=>[h.num,{num:h.num,name:h.name,p:h.p,wins:0,top3:0}]));
   for(let k=0;k<n;k++){const finish=order(field,random);stats.get(finish[0].num).wins++;finish.slice(0,3).forEach(h=>stats.get(h.num).top3++);}
   return [...stats.values()].map(s=>({...s,frequency:s.wins/n,top3Frequency:s.top3/n,se:Math.sqrt(s.p*(1-s.p)/n)}));
 }
 Object.assign(R,{rng,normalize,drawOrder:order,createRace,monteCarlo,styleEarly});if(typeof module!=='undefined')module.exports=R;
})(globalThis);
