/* RACE FRAME - course geometry. Official scalar values; APPROXIMATE plan/profile.
 * References and provenance: docs/COURSES.md and the Sources dialog.
 * No JRA images, logos, geospatial surveys, or licensed data are redistributed.
 */
(function (root) {
  'use strict';
  const RF = root.RaceFrame = root.RaceFrame || {};
  const V = {
    tokyo: {code:'05', name:'\u6771\u4eac', direction:'left', source:'https://www.jra.go.jp/facilities/race/tokyo/course/index.html'},
    nakayama: {code:'06', name:'\u4e2d\u5c71', direction:'right', source:'https://www.jra.go.jp/facilities/race/nakayama/course/index.html'},
    kyoto: {code:'08', name:'\u4eac\u90fd', direction:'right', source:'https://www.jra.go.jp/facilities/race/kyoto/course/'},
    hanshin: {code:'09', name:'\u962a\u795e', direction:'right', source:'https://www.jra.go.jp/facilities/race/hanshin/course/'}
  };
  // Cubic Bezier plan coordinates are an original, schematic reconstruction.
  // Last segment is the home straight up to the finish, measured independently.
  const SHAPES = {
    tokyo: {start:[735,480], segs:[['L',820,480],['C',900,480,954,419,954,324],['C',954,219,910,160,824,160],['L',248,160],['C',132,160,111,251,111,329],['C',111,420,142,480,245,480],['L',735,480]]},
    nakayama_inner: {start:[380,486], segs:[['L',240,486],['C',142,486,116,436,115,353],['C',114,278,162,236,243,234],['L',676,234],['C',770,234,811,269,836,322],['C',885,416,830,486,747,486],['L',380,486]]},
    nakayama_outer: {start:[380,486], segs:[['L',240,486],['C',138,486,110,425,110,351],['C',105,234,187,100,260,105],['C',390,104,612,150,719,215],['C',781,251,822,286,836,322],['C',885,416,830,486,747,486],['L',380,486]]},
    kyoto_inner: {start:[385,490], segs:[['L',268,490],['C',160,490,124,432,124,359],['C',122,271,178,229,282,213],['L',665,166],['C',761,156,820,214,834,298],['C',851,401,812,490,721,490],['L',385,490]]},
    kyoto_outer: {start:[385,490], segs:[['L',268,490],['C',160,490,124,432,124,359],['C',122,271,178,229,282,213],['L',749,155],['C',861,139,934,204,946,286],['C',972,423,878,490,800,490],['L',385,490]]},
    hanshin_inner: {start:[332,490], segs:[['L',250,490],['C',155,489,132,432,137,357],['C',141,280,192,248,275,230],['L',643,155],['C',734,138,780,198,813,283],['C',866,416,816,490,732,490],['L',332,490]]},
    hanshin_outer: {start:[332,490], segs:[['L',250,490],['C',155,489,132,432,137,357],['C',141,280,192,248,275,230],['L',796,123],['C',909,100,968,217,972,293],['C',980,421,906,490,873,490],['L',332,490]]}
  };
  const CATALOG = [];
  function add(venue, variant, surface, rails, elevation, distances, width) {
    for (const [rail, lap, straight] of rails) {
      CATALOG.push({id:`${venue}-${variant}-${rail}`, venue, variant, surface, rail, lap, straight, elevation, distances, width,
        direction:V[venue].direction, source:V[venue].source,
        accuracy:'approximate', verifiedOn:'2026-10-10'});
    }
  }
  add('tokyo','turf','turf',[['A',2083.1,525.9],['B',2101.9,525.9],['C',2120.8,525.9],['D',2139.6,525.9]],2.7,[1400,1600,1800,2000,2300,2400,2500,2600,3400],36);
  add('tokyo','dirt','dirt',[['-',1899,501.6]],2.5,[1200,1300,1400,1600,2100,2400],25);
  add('nakayama','inner','turf',[['A',1667.1,310],['B',1686,310],['C',1704.8,310]],5.3,[1800,2000,2500,3600],26);
  add('nakayama','outer','turf',[['A',1839.7,310],['B',1858.5,310],['C',1877.3,310]],5.3,[1200,1600,2200,2600,4000],28);
  add('nakayama','mixed','turf',[['A',1667.1,310],['B',1686,310],['C',1704.8,310]],5.3,[3200],26);
  add('nakayama','dirt','dirt',[['-',1493,308]],4.5,[1000,1200,1700,1800,2400,2500],23);
  add('kyoto','inner','turf',[['A',1782.8,328.4],['B',1802.2,323.4],['C',1821.1,323.4],['D',1839.9,323.4]],3.1,[1100,1200,1400,1600,2000],32);
  add('kyoto','outer','turf',[['A',1894.3,403.7],['B',1913.6,398.7],['C',1932.4,398.7],['D',1951.3,398.7]],4.3,[1400,1600,1800,2000,2200,2400,3000,3200],30);
  add('kyoto','dirt','dirt',[['-',1607.6,329.1]],3,[1000,1100,1200,1400,1800,1900,2600],25);
  add('hanshin','inner','turf',[['A',1689,356.5],['B',1713.2,359.1]],1.9,[1200,1400,2000,2200,3000],26);
  add('hanshin','outer','turf',[['A',2089,473.6],['B',2113.2,476.3]],2.4,[1400,1600,1800,2400,2600],26);
  add('hanshin','mixed','turf',[['A',1689,356.5],['B',1713.2,359.1]],1.9,[3200],26);
  add('hanshin','dirt','dirt',[['-',1517.6,352.7]],1.6,[1200,1400,1800,2000,2600],24);
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const mod = (x,m) => ((x%m)+m)%m;
  function name(c) {
    const v={turf:'\u829d',inner:'\u829d\u30fb\u5185',outer:'\u829d\u30fb\u5916',mixed:'\u829d\u30fb\u5916\u2192\u5185',dirt:'\u30c0\u30fc\u30c8'};
    return `${V[c.venue].name} ${v[c.variant]}${c.rail==='-'?'':` ${c.rail}`}`;
  }
  function shapeFor(c) {
    const base = c.venue === 'tokyo' ? 'tokyo' : `${c.venue}_${['dirt','mixed'].includes(c.variant)?'inner':c.variant}`;
    const sh=structuredClone(SHAPES[base]);
    // Dirt is nested inside the turf. Coordinate scaling is only schematic.
    const scale=c.surface==='dirt'?.85:1;
    const shift=c.surface==='dirt'?0:('ABCD'.indexOf(c.rail)*3.7);
    const transform=(x,y)=>[540+(x-540)*scale + Math.sign(x-540)*shift,330+(y-330)*scale+Math.sign(y-330)*shift];
    sh.start=transform(...sh.start);
    sh.segs=sh.segs.map(s=>{const a=[s[0]];for(let k=1;k<s.length;k+=2)a.push(...transform(s[k],s[k+1]));return a;});
    return sh;
  }
  function profile(c) {
    const L=c.lap,H=c.elevation;
    if(c.venue==='tokyo') return [[0,H],[L*.06,H],[L*.43,.8],[L*.47,.8],[L*.51,2.3*H/2.7],[L*.55,2.3*H/2.7],[L*.62,0],[L-460,c.surface==='dirt'?.1:.7],[L-300,H],[L,H]];
    if(c.venue==='nakayama') return [[0,2.2],[L*.08,3.2],[L*.20,H],[L*.28,H],[L*.43,3],[L*.62,1],[L-310,.25],[L-180,0],[L-70,2.2],[L,2.2]];
    if(c.venue==='kyoto') return [[0,0],[L-1250,0],[L-1120,.1],[L-900,H],[L-800,H],[L-480,0],[L,0]];
    const finish=c.surface==='dirt'?1.6:1.8;
    return [[0,finish],[L*.26,finish],[L*.36,H],[L-(c.variant==='outer'?600:800),H],[L-200,0],[L-80,finish],[L,finish]];
  }
  function interp(points,x) {
    if(x<=points[0][0]) return points[0][1];
    for(let i=1;i<points.length;i++)if(x<=points[i][0]) {const [a,za]=points[i-1],[b,zb]=points[i];return za+(zb-za)*(x-a)/(b-a);}
    return points[points.length-1][1];
  }
  function buildLoop(c) {
    const sh=c.customShape||shapeFor(c), pts=[{x:sh.start[0],y:sh.start[1],raw:0}], parts=sh.segs;
    let last=sh.start, homeIndex=0;
    parts.forEach((s,idx)=>{
      if(idx===parts.length-1)homeIndex=pts.length-1;
      const [x0,y0]=last, count=s[0]==='L'?20:60;
      for(let i=1;i<=count;i++){
        const t=i/count,u=1-t;let x,y;
        if(s[0]==='L'){x=x0+(s[1]-x0)*t;y=y0+(s[2]-y0)*t;}
        else{x=u*u*u*x0+3*u*u*t*s[1]+3*u*t*t*s[3]+t*t*t*s[5];y=u*u*u*y0+3*u*u*t*s[2]+3*u*t*t*s[4]+t*t*t*s[6];}
        const prev=pts[pts.length-1];pts.push({x,y,raw:prev.raw+Math.hypot(x-prev.x,y-prev.y)});
      }
      last=[s[s.length-2],s[s.length-1]];
    });
    const homeRaw=pts[homeIndex].raw,totalRaw=pts.at(-1).raw;
    for(const p of pts)p.s=p.raw<=homeRaw ? p.raw/homeRaw*(c.lap-c.straight) : c.lap-c.straight+(p.raw-homeRaw)/(totalRaw-homeRaw)*c.straight;
    const knots=(c.customProfile||profile(c)).slice().sort((a,b)=>a[0]-b[0]);
    function at(s,lane=0){
      s=mod(s,c.lap);let lo=1,hi=pts.length-1;
      while(lo<hi){const mid=(lo+hi)>>1;if(pts[mid].s<s)lo=mid+1;else hi=mid;}
      const a=pts[lo-1],b=pts[lo],f=(s-a.s)/(b.s-a.s),len=Math.hypot(b.x-a.x,b.y-a.y)||1,tx=(b.x-a.x)/len,ty=(b.y-a.y)/len;
      const nx=c.direction==='right'?ty:-ty,ny=c.direction==='right'?-tx:tx;
      const mToPlan=totalRaw/c.lap;
      return {x:a.x+(b.x-a.x)*f+nx*lane*mToPlan,y:a.y+(b.y-a.y)*f+ny*lane*mToPlan,tx,ty,nx,ny,z:interp(knots,s),s};
    }
    return {course:c,pts,knots,at,planPerMeter:totalRaw/c.lap};
  }
  function getCourse(id){const c=CATALOG.find(c=>c.id===id);if(!c)throw new Error(`Unknown course: ${id}`);return c;}
  function buildRoute(c,D) {
    if(!Number.isFinite(D)||D<800||D>5000)throw new Error('Distance must be 800-5000 m');
    const loop=buildLoop(c), L=c.lap;
    let firstLoop=null, prefix=0, turfStart=0, chute=false;
    const notes=[];
    // 2500m Nakayama starts on the outer course; 3200m uses outer then inner.
    if((c.venue==='nakayama'&&c.variant==='inner'&&D===2500)||c.variant==='mixed'){
      firstLoop=buildLoop(getCourse(`${c.venue}-outer-${c.rail}`));prefix=D-L;
      notes.push('\u524d\u534a\u306f\u5916\u56de\u308a\u3001\u6700\u7d42\u5468\u306f\u5185\u56de\u308a\uff08\u63a5\u7d9a\u5f62\u72b6\u306f\u8fd1\u4f3c\uff09');
    } else {
      if(c.venue==='tokyo'&&c.surface==='turf'&&D===1800){prefix=200;chute=true;}
      if(c.venue==='tokyo'&&c.surface==='turf'&&D===2000){prefix=120;chute=true;}
      if(c.venue==='nakayama'&&c.variant==='outer'&&D===1600){prefix=140;chute=true;}
      if(c.venue==='kyoto'&&c.variant==='inner'&&D===1600){prefix=235;chute=true;}
      if(c.venue==='kyoto'&&c.variant==='outer'&&D===1600){prefix=100;chute=true;}
      if(c.venue==='kyoto'&&c.variant==='outer'&&D===1800){prefix=300;chute=true;}
      if(c.surface==='dirt'){
        if(c.venue==='tokyo'&&D===1600)turfStart=150;
        if(c.venue==='nakayama'&&D===1200)turfStart=100;
        if(c.venue==='kyoto'&&D===1400)turfStart=100;
        if(c.venue==='hanshin'&&[1400,2000].includes(D))turfStart=80;
        if(turfStart){prefix=turfStart;chute=true;notes.push('\u829d\u30b9\u30bf\u30fc\u30c8\u306e\u533a\u9593\u9577\u30fb\u63a5\u7d9a\u306f\u8fd1\u4f3c');}
      }
      if(chute)notes.push('\u5f15\u304d\u8fbc\u307f\u7dda\u306e\u4f4d\u7f6e\u30fb\u89d2\u5ea6\u30fb\u9577\u3055\u306f\u6a21\u5f0f\u8868\u73fe');
    }
    const join=loop.at(L-(D-prefix));
    function at(d,lane=0){
      if(d<prefix&&firstLoop)return firstLoop.at(firstLoop.course.lap-prefix+Math.max(0,d),lane);
      if(d<prefix&&chute){
        const left=prefix-Math.max(0,d),t=left/prefix,off=loop.planPerMeter;
        return {...join,x:join.x-join.tx*left*off+join.nx*(lane*off+32*t*t),y:join.y-join.ty*left*off+join.ny*(lane*off+32*t*t),surface:turfStart?'turf':c.surface};
      }
      return {...loop.at(L-D+d,lane),surface:c.surface};
    }
    const points=[];for(let d=0;d<=D;d+=5)points.push({...at(d),d});points.push({...at(D),d:D});
    return {course:c,distance:D,loop,firstLoop,prefix,chute,turfStart,at,points,notes,
      elevation(d){return at(clamp(d,0,D)).z;},
      grade(d){return (at(clamp(d+5,0,D)).z-at(clamp(d-5,0,D)).z)/(Math.min(D,d+5)-Math.max(0,d-5)||1);},
      phase(d){return mod(L-D+d,L);}
    };
  }
  Object.assign(RF,{VENUES:V,COURSES:CATALOG,courseName:name,getCourse,buildLoop,buildRoute,shapeFor,profile,clamp,mod});
  if(typeof module!=='undefined')module.exports=RF;
})(globalThis);
