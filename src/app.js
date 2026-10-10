/* Application state, controls, safe DOM rendering, local import/export. */
(function(root){
'use strict';
const R=root.RaceFrame,$=id=>document.getElementById(id);
const variants={turf:'芝',inner:'芝・内回り',outer:'芝・外回り',mixed:'芝・外→内',dirt:'ダート'};
const state={races:[],raceIndex:0,courseId:'tokyo-turf-A',distance:2400,route:null,sim:null,time:0,playing:false,follow:false,selected:null,confirmed:true,custom:new Map(),stats:null};
function el(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;}
function fmt(t,dec=false){return `${Math.floor(t/60)}:${(t%60).toFixed(dec?1:0).padStart(dec?4:2,'0')}`;}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,3500);}
function error(text){$('errorBanner').textContent=text;$('errorBanner').hidden=!text;}
function current(){return state.races[state.raceIndex];}
function course(){return state.custom.get(state.courseId)||R.getCourse(state.courseId);}
function seed(){return $('seedInput').value.trim()||'1';}
function download(name,content,type='application/json'){
 const blob=new Blob([content],{type}),u=URL.createObjectURL(blob),a=el('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500);
}
function fillSelect(id,items,value){const s=$(id);s.replaceChildren(...items.map(x=>{const o=el('option','',x.label);o.value=x.value;return o;}));s.value=items.some(x=>x.value===String(value))?String(value):items[0]?.value||'';}
function demoData(){
 const names=['グリーンアトラス','ルミナスリーフ','ミストフォレスト','サンセットレーン','シルバーコメット','オーキッドベル','ノースジャーニー','メロウウィンド','クレストブルー','エバーグローブ','レイニーハーバー','アンバーステップ','ウッドランド','コットンクラウド','スターリーパス','フローレスト'];
 const probs=[.24,.17,.115,.09,.075,.06,.05,.04,.035,.03,.025,.02,.018,.015,.01,.007];
 const styles=['stalk','front','escape','close','front','stalk','close','front','stalk','escape','close','stalk','front','close','stalk','front'];
 const races=[['tokyo','turf','A',2400],['nakayama','inner','A',2000],['kyoto','outer','A',1600],['hanshin','outer','A',1600]].map(([v,variant,rail,d])=>({
  id:'demo-'+v,title:R.VENUES[v].name+' / 架空16頭デモ',course_id:`${v}-${variant}-${rail}`,distance:d,demo:true,source:'架空デモ（実際のAI予測ではありません）',
  horses:names.map((name,i)=>({num:i+1,frame:Math.floor(i/2)+1,name,probability:probs[i],style:styles[i]}))
 }));
 return R.parseImport(JSON.stringify({races}),{probabilityColumn:'probability'});
}
const DATA_BASE = './data/';

async function loadRaceDay(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('開催日の形式が不正です');
  }

  const dateStr = date.replaceAll('-', '');
  const url = `${DATA_BASE}races/raceframe_${dateStr}.json`;

  const response = await fetch(url, { cache: 'no-cache' });

  if (!response.ok) {
    throw new Error(`予想JSONを取得できません: ${date}`);
  }

  const text = await response.text();

  const races = R.parseImport(text, {
    probabilityColumn: 'p_final',
    unit: 'fraction'
  });

  if (!races.length) {
    throw new Error('予想データが空です');
  }

  setRaces(races);
  toast(`${date} の${races.length}レースを読み込みました`);
}

async function loadManifest() {
  const response = await fetch(
    `${DATA_BASE}manifest.json`,
    { cache: 'no-cache' }
  );

  if (!response.ok) {
    throw new Error('開催日一覧を取得できません');
  }

  const manifest = await response.json();
  const dates = manifest.dates;

  if (!Array.isArray(dates) || !dates.length) {
    throw new Error('公開中の開催日がありません');
  }

  const validDates = dates.filter(
    d => typeof d === 'string' &&
         /^\d{4}-\d{2}-\d{2}$/.test(d)
  );

  if (!validDates.length) {
    throw new Error('有効な開催日がありません');
  }

  validDates.sort().reverse();

  fillSelect(
    'dateSelect',
    validDates.map(date => ({
      value: date,
      label: date
    })),
    validDates[0]
  );

  await loadRaceDay(validDates[0]);
}
function formatRaceName(race) {
  const id = String(race.id || race.race_id || "");

  const venues = {
    "05": "東京",
    "06": "中山",
    "08": "京都",
    "09": "阪神"
  };

  if (/^\d{12}$/.test(id)) {
    const venue = venues[id.slice(8, 10)];
    const number = Number(id.slice(10, 12));

    if (venue && number >= 1 && number <= 12) {
      return `${venue} ${number}R`;
    }
  }

  return race.title || id;
}

function setRaces(races) {
  state.races = races;
  state.raceIndex = 0;

  fillSelect(
    'raceSelect',
    races.map((r, i) => ({
      value: String(i),
      label: formatRaceName(r)
    })),
    0
  );

  selectRace(0);
}
function selectRace(index){
 state.raceIndex=index;const r=current();state.selected=null;state.confirmed=!!r.courseId&&Number.isFinite(r.distance)&&!r.unsupported;
 if(r.courseId)state.courseId=r.courseId;
 if(Number.isFinite(r.distance))state.distance=r.distance;
 const c=course();populateCourse(c.venue,c.variant,c.rail,state.distance);
 if(!c.distances.includes(r.distance)&&!r.demo)state.confirmed=false;
 if(r.unsupported)error('このレースは障害競走です。この版では再生できません。');else error('');
 $('dataType').textContent=r.demo?'DEMO':'LOCAL';$('inputSummary').textContent=r.source+(r.generatedAt?' / '+r.generatedAt:'');
 $('probabilityLabel').textContent=r.demo?'架空の勝率 / DEMO':`${r.probabilityColumn} / 入力された勝率`;
 reset();
}
function populateCourse(v,variant,rail,distance){
 fillSelect('venueSelect',Object.entries(R.VENUES).map(([value,x])=>({value,label:x.name})),v);
 const cs=R.COURSES.filter(c=>c.venue===v);
 const vs=[...new Set(cs.map(c=>c.variant))];variant=vs.includes(variant)?variant:vs[0];
 fillSelect('variantSelect',vs.map(value=>({value,label:variants[value]})),variant);
 const rs=cs.filter(c=>c.variant===variant).map(c=>c.rail);rail=rs.includes(rail)?rail:rs[0];
 fillSelect('railSelect',rs.map(value=>({value,label:value==='-'?'固定':value+'コース'})),rail);
 const c=cs.find(c=>c.variant===variant&&c.rail===rail);state.courseId=c.id;
 fillSelect('distanceSelect',c.distances.map(value=>({value:String(value),label:value.toLocaleString()+' m'})),distance);
 state.distance=Number($('distanceSelect').value);
}
function updateCourseSelection(kind){
 const c=course(),v=$('venueSelect').value,variant=$('variantSelect').value,rail=$('railSelect').value,d=Number($('distanceSelect').value);
 populateCourse(v,kind==='venue'?null:variant,rail,d);
 if(!current().unsupported)state.confirmed=true;reset();
}
const renderer=new R.Renderer($('trackCanvas'),$('elevationCanvas'),num=>{state.selected=state.selected===num?null:num;render(true);});
function readySample(){
 const c=course(),n=current().horses.length;
 return {time:0,states:current().horses.map((h,i)=>({num:h.num,horse:{...h,p:h.prob},d:0,speed:0,lane:1+i*(Math.min(c.width-3,28)/Math.max(1,n-1)),z:state.route.elevation(0),position:i+1,finished:false})),
  remaining:state.distance,leader:null,finished:false};
}
function reset(){
 state.playing=false;state.sim=null;state.time=0;state.route=R.buildRoute(course(),state.distance);renderer.setRoute(state.route);
 $('raceTitle').textContent=R.courseName(course())+' '+state.distance.toLocaleString()+'m';
 $('courseEnglish').textContent=course().venue.toUpperCase()+' RACECOURSE';
 $('raceMeta').textContent=`${current().horses.length}頭  /  ${course().direction==='left'?'左回り':'右回り'}  /  ${current().demo?'架空デモ':current().title}`;
 $('lapMetric').textContent=course().lap.toLocaleString()+'m';$('straightMetric').textContent=course().straight+'m';
 $('accuracyBtn').textContent=course().customShape?'ユーザー編集形状 ⓘ':'形状・標高線は近似 ⓘ';
 $('heightMetric').textContent=Math.max(course().elevation,state.route.firstLoop?.course.elevation||0)+'m';
 $('confirmCourseBtn').hidden=state.confirmed||current().unsupported;
 $('startBtn').disabled=!state.confirmed||current().unsupported;
 $('resultBtn').disabled=true;$('horseCount').textContent=current().horses.length;
 const messages=[...current().warnings,...state.route.notes];
 if(current().courseId&&current().courseId!==state.courseId)messages.push('読み込んだ予測と異なるコースを表示中です。AI勝率は元の予測から変更していません。');
 if(Number.isFinite(current().distance)&&current().distance!==state.distance)messages.push('予測データとは異なる距離を表示中です。勝率は再計算していません。');
 if(current().demo)messages.unshift('架空の馬・勝率による動作デモです。実レースの予想ではありません。');
 $('warnings').replaceChildren(...messages.map(x=>el('p','',x)));
 render(true);
}
function makeSim(){if(!state.confirmed||current().unsupported)throw new Error('表示するコースを確認してください。');state.sim=R.createRace(current().horses,state.route,{seed:seed(),pace:$('paceSelect').value,going:$('goingSelect').value});state.time=0;}
function playPause(){
 try{if(!state.sim)makeSim();if(state.time>=state.sim.duration)state.time=0;state.playing=!state.playing;render(true);}
 catch(e){error(e.message);}
}
function newSeed(){const b=new Uint32Array(1);crypto.getRandomValues(b);$('seedInput').value='race-'+b[0].toString(36);reset();}
function renderRoster(sample){
 $('roster').replaceChildren();
 const states=sample.states, r=current();const showRank=!!state.sim&&state.time>0;
 $('rankHeading').textContent=showRank?'現在順 / 勝率':'勝率';
 for(const s of states){
  const h=s.horse,row=el('button','horse-row'+(state.selected===h.num?' selected':''));row.type='button';row.setAttribute('aria-label',`${h.num}番 ${h.name} 勝率${(h.prob*100).toFixed(1)}%`);
  row.title=h.styleSource||'演出用の脚質';row.addEventListener('click',()=>{state.selected=state.selected===h.num?null:h.num;render(true);});
  const ball=el('span','number-ball',h.num),color=R.tokenStyle(h.frame);ball.style.background=color.bg;ball.style.color=color.fg;
  const text=el('span','horse-text');text.append(el('b','horse-name',h.name),el('small','horse-style',`${h.frame?h.frame+'枠':'枠不明'} · ${R.STYLE_LABELS[h.style]||'不明'}`));
  const right=el('span','horse-prob');if(showRank)right.append(el('small','live-position',s.finished?`${s.rank}着`:s.position+'位'));right.append(el('b','',(h.prob*100).toFixed(1)+'%'));
  const bar=el('i','prob-line');bar.style.width=(h.prob*100)+'%';
  row.append(ball,text,right,bar);$('roster').append(row);
 }
}
let lastRoster=0;
function render(force=false){
 const sample=state.sim?state.sim.sample(state.time):readySample();if(!sample.leader)sample.leader=sample.states[0];
 renderer.draw(sample,{follow:state.follow,selected:state.selected});
 $('remainingText').replaceChildren(document.createTextNode(Math.ceil(sample.remaining).toLocaleString()),el('small','','m'));
 $('clockText').textContent=fmt(state.time,true);$('timeLabel').textContent=fmt(state.time);$('durationLabel').textContent=state.sim?fmt(state.sim.duration):'--:--';
 $('scrubber').value=state.sim?String(Math.round(state.time/state.sim.duration*1000)):'0';
 $('scrubber').disabled=!state.sim;
 $('raceStatus').textContent=sample.finished?'FINISH':state.playing?'● RUNNING':state.sim?'PAUSED':'READY';
 $('startBtn').textContent=state.playing?'Ⅱ 一時停止':sample.finished?'↺ 同じレースを再生':state.sim?'▶ 再開':'▶ シミュレーションスタート';
 $('finishCard').hidden=!state.sim||state.time<state.sim.firstTime;
 if(!$('finishCard').hidden){const win=state.sim.plans[0];$('winnerText').textContent=`${win.horse.num}番 ${win.horse.name}`;}
 $('resultBtn').disabled=!sample.finished||!state.sim;
 if(state.sim){
  const pace=state.sim.pace>.35?'ハイペース':state.sim.pace<-.35?'スローペース':'ミドルペース';
  const stage=sample.remaining<=0?'全馬ゴール':sample.remaining<course().straight?'最後の直線':sample.remaining<700?'勝負どころ':'道中';
  $('sceneCaption').textContent=`${pace}の演出 / ${stage} / 先頭 ${sample.leader.num}番`;
 }else $('sceneCaption').textContent='スタートで発走 / 丸をクリックして注目馬を選択';
 const t=performance.now();if(force||t-lastRoster>180){renderRoster(sample);lastRoster=t;}
}
let lastFrame=null;
function tick(t){
 const elapsed=lastFrame===null?0:Math.min((t-lastFrame)/1000,.2);lastFrame=t;
 if(state.playing&&state.sim){state.time=Math.min(state.sim.duration,state.time+elapsed*Number($('speedSelect').value));if(state.time>=state.sim.duration)state.playing=false;render();}
 requestAnimationFrame(tick);
}
function showSources(){
 const c=course();$('courseDetail').replaceChildren(el('h3','',R.courseName(c)),el('p','',`公表値：1周 ${c.lap}m、直線 ${c.straight}m、最大高低差 ${c.elevation}m。外→内の表示での周長は最終内回り1周の値です。`));
 $('sourceLinks').replaceChildren(...Object.values(R.VENUES).map(v=>{const a=el('a','',v.name+'競馬場・JRA公式コース紹介 ↗');a.href=v.source;a.target='_blank';a.rel='noopener noreferrer';return a;}));
 $('sourcesDialog').showModal();
}
function applyImport(text){
 const races=R.parseImport(text,{probabilityColumn:$('probColumn').value,unit:$('probUnit').value});
 setRaces(races);$('importDialog').close();$('importError').textContent='';toast(`${races.length}レースを読み込みました。`);
}
async function loadFile(file){if(!file)return;if(file.size>20*1024*1024)throw new Error('20MB以下のファイルを使用してください。');const text=new TextDecoder($('csvEncoding').value,{fatal:true}).decode(await file.arrayBuffer());$('importText').value=text;applyImport(text);}
function editRow(h={num:1,frame:null,name:'',prob:.05,style:'unknown'}){
 const tr=el('tr');const fields=[['num','number',h.num,1,18],['frame','number',h.frame??'',1,8],['name','text',h.name],['prob','number',+(h.prob*100).toFixed(4),0,100]];
 for(const [key,type,value,min,max] of fields){const td=el('td'),input=el('input');input.type=type;input.value=value;input.dataset.field=key;input.setAttribute('aria-label',key);if(min!==undefined){input.min=min;input.max=max;input.step=key==='prob'?'0.0001':'1';}if(key==='name')input.maxLength=80;td.append(input);tr.append(td);}
 const td=el('td'),select=el('select');select.dataset.field='style';for(const [value,label] of Object.entries(R.STYLE_LABELS)){const o=el('option','',label);o.value=value;select.append(o);}select.value=h.style;td.append(select);tr.append(td);
 const remove=el('button','text-button','×');remove.type='button';remove.title='この馬を除く';remove.onclick=()=>tr.remove();const last=el('td');last.append(remove);tr.append(last);$('editRows').append(tr);
}
function saveEdit(){
 const horses=[...$('editRows').children].map(tr=>{const get=k=>tr.querySelector(`[data-field="${k}"]`).value;return {num:Number(get('num')),frame:get('frame')?Number(get('frame')):null,name:get('name'),probability:Number(get('prob'))/100,style:get('style')};});
 const race=R.parseImport(JSON.stringify({id:current().id,title:current().title,course_id:state.courseId,distance:state.distance,source:'手動編集データ（元のAI出力とは異なります）',horses}),{probabilityColumn:'probability'})[0];
 state.races[state.raceIndex]=race;selectRace(state.raceIndex);$('editDialog').close();toast('手動編集した勝率を適用しました。');
}
function statsCSV(stats){return 'horse_num,horse,ai_probability,sampled_win_rate,top3_assumed_rate,wins,trials\r\n'+stats.map(s=>[s.num,s.name,s.p,s.frequency,s.top3Frequency,s.wins,10000].map(R.csvCell).join(',')).join('\r\n');}
function showStats(){
 $('statsBody').textContent='10,000回の着順を抽選しています…';$('statsDialog').showModal();$('saveStatsBtn').disabled=true;
 // Yield once so the dialog paints before the finite CPU calculation.
 setTimeout(()=>{try{
  state.stats=R.monteCarlo(current().horses,10000,seed()+'-batch');const table=el('table','stats-table'),head=el('thead'),hr=el('tr');
  ['馬番','馬名','入力勝率','抽選勝率','差 (pt)','3着内※'].forEach(s=>hr.append(el('th','',s)));head.append(hr);table.append(head);const body=el('tbody');
  for(const s of [...state.stats].sort((a,b)=>b.p-a.p)){const tr=el('tr');[s.num,s.name,(s.p*100).toFixed(2)+'%',(s.frequency*100).toFixed(2)+'%',((s.frequency-s.p)*100).toFixed(2),(s.top3Frequency*100).toFixed(2)+'%'].forEach(x=>tr.append(el('td','',x)));body.append(tr);}
  table.append(body);$('statsBody').replaceChildren(table,el('p','small-note','有限回の抽選なので誤差があります。※3着内率は勝率から一意には定まらず、今回の着順モデルに依存します。'));
  $('saveStatsBtn').disabled=false;
 }catch(e){$('statsBody').textContent=e.message;}},20);
}
function validateCourseOverride(data){
 const c=course(),sh=data.shape,pr=data.profile;
 if(data.course_id!==c.id)throw new Error('現在選択しているcourse_idと一致するJSONを読み込んでください。');
 const pair=a=>Array.isArray(a)&&a.length===2&&a.every(x=>Number.isFinite(x)&&Math.abs(x)<10000);
 if(!sh||!pair(sh.start)||!Array.isArray(sh.segs)||sh.segs.length<3||sh.segs.length>80)throw new Error('shapeが不正です。');
 for(const s of sh.segs)if(!Array.isArray(s)||!['L','C'].includes(s[0])||s.length!==(s[0]==='L'?3:7)||!s.slice(1).every(x=>Number.isFinite(x)&&Math.abs(x)<10000))throw new Error('ベジェ制御点が不正です。');
 const last=sh.segs.at(-1);if(last[0]!=='L'||Math.hypot(last.at(-2)-sh.start[0],last.at(-1)-sh.start[1])>1e-6)throw new Error('最後のL区間をゴール（start）まで閉じてください。');
 if(!Array.isArray(pr)||pr.length<2||pr.length>300||pr.some(p=>!pair(p)||p[1]<0||p[1]>100))throw new Error('profileが不正です。');
 if(pr[0][0]!==0||Math.abs(pr.at(-1)[0]-c.lap)>.001||pr.some((p,i)=>i&&p[0]<=pr[i-1][0])||Math.abs(pr[0][1]-pr.at(-1)[1])>.001)throw new Error('標高点は0〜周長の昇順で、始終点の標高を一致させてください。');
 const copy={...R.getCourse(c.id),customShape:sh,customProfile:pr,accuracy:'user-supplied'};const lp=R.buildLoop(copy);
 if(lp.pts.some((p,i)=>!Number.isFinite(p.s)||(i>0&&p.s<=lp.pts[i-1].s))||lp.pts.at(-1).raw<100)throw new Error('走行経路を構成できません。');
 return copy;
}
// Wire all controls.
$('importBtn').onclick=()=>{$('importError').textContent='';$('importDialog').showModal();};
$('helpBtn').onclick=()=>$('helpDialog').showModal();$('sourcesBtn').onclick=showSources;$('accuracyBtn').onclick=showSources;
document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const b=d.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)d.close();}}));
$('raceSelect').onchange=()=>selectRace(Number($('raceSelect').value));
$('demoBtn').onclick=()=>{setRaces(demoData());toast('架空デモに切り替えました。');};
$('venueSelect').onchange=()=>updateCourseSelection('venue');
$('variantSelect').onchange=()=>updateCourseSelection('variant');$('railSelect').onchange=()=>updateCourseSelection('rail');$('distanceSelect').onchange=()=>updateCourseSelection('distance');
$('confirmCourseBtn').onclick=()=>{state.confirmed=true;reset();};
$('paceSelect').onchange=reset;$('goingSelect').onchange=reset;$('seedInput').onchange=reset;
$('randomSeedBtn').onclick=newSeed;$('newRaceBtn').onclick=()=>{newSeed();playPause();};
$('startBtn').onclick=playPause;$('restartBtn').onclick=()=>{if(!state.sim){playPause();return;}state.time=0;state.playing=true;render(true);};
$('scrubber').oninput=()=>{if(!state.sim)return;state.playing=false;state.time=Number($('scrubber').value)/1000*state.sim.duration;render(true);};
$('overviewBtn').onclick=()=>{state.follow=false;$('overviewBtn').classList.add('active');$('followBtn').classList.remove('active');renderer.invalid=true;render(true);};
$('followBtn').onclick=()=>{state.follow=true;$('followBtn').classList.add('active');$('overviewBtn').classList.remove('active');render(true);};
$('fullscreenBtn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('trackStage').requestFullscreen)await $('trackStage').requestFullscreen();else toast('このブラウザは全画面に対応していません。');}catch(e){toast('全画面を開始できませんでした。');}};
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT','TEXTAREA','BUTTON'].includes(e.target.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();playPause();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.playing){state.playing=false;render(true);}lastFrame=null;});
$('applyImportBtn').onclick=()=>{try{applyImport($('importText').value);}catch(e){$('importError').textContent=e.message;}};
$('fileInput').onchange=e=>{loadFile(e.target.files[0]).catch(err=>$('importError').textContent=err.message);e.target.value='';};
$('dropZone').ondragover=e=>{e.preventDefault();$('dropZone').classList.add('over');};
$('dropZone').ondragleave=()=>$('dropZone').classList.remove('over');
$('dropZone').ondrop=e=>{e.preventDefault();$('dropZone').classList.remove('over');loadFile(e.dataTransfer.files[0]).catch(err=>$('importError').textContent=err.message);};
$('exampleBtn').onclick=()=>{$('probColumn').value='p_final';$('probUnit').value='fraction';$('importText').value='race_id,horse_num,waku_num,horse,p_final,p36,place,dist,track_code,CourseKubunCD,running_style_last1\nsample-tokyo,1,1,デモ馬A,0.45,0.40,05,2400,11,A,2\nsample-tokyo,2,2,デモ馬B,0.35,0.35,05,2400,11,A,3\nsample-tokyo,3,3,デモ馬C,0.20,0.25,05,2400,11,A,1';};
$('editBtn').onclick=()=>{$('editError').textContent='';$('editRows').replaceChildren();current().horses.forEach(editRow);$('editDialog').showModal();};
$('addHorseBtn').onclick=()=>{const ns=[...$('editRows').querySelectorAll('[data-field="num"]')].map(x=>Number(x.value)),hn=Array.from({length:18},(_,i)=>i+1).find(x=>!ns.includes(x));if(!hn){$('editError').textContent='18頭までです。';return;}editRow({num:hn,frame:null,name:hn+'番',prob:.05,style:'unknown'});};
$('saveEditBtn').onclick=()=>{try{saveEdit();}catch(e){$('editError').textContent=e.message;}};
$('statsBtn').onclick=showStats;
$('saveStatsBtn').onclick=()=>{if(state.stats)download('raceframe_statistics.csv','\uFEFF'+statsCSV(state.stats),'text/csv;charset=utf-8');};
$('exportBtn').onclick=()=>download('raceframe_race.json',JSON.stringify(R.toPortable(current(),state.courseId,state.distance),null,2));
$('resultBtn').onclick=()=>{if(!state.sim||state.time<state.sim.duration)return;const rows=state.sim.plans.map(p=>[p.rank,p.horse.num,p.horse.name,p.horse.prob,p.finishTime.toFixed(3),state.sim.seed]);download('raceframe_result.csv','\uFEFF'+'rank,horse_num,horse,input_probability,fictional_finish_seconds,seed\r\n'+rows.map(row=>row.map(R.csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');};
$('downloadCourseBtn').onclick=()=>{const c=course();download(c.id+'_geometry.json',JSON.stringify({schema_version:1,course_id:c.id,source:c.source,accuracy:'approximate',lap:c.lap,straight:c.straight,elevation:c.elevation,shape:c.customShape||R.shapeFor(c),profile:c.customProfile||R.profile(c)},null,2));};
$('courseFileInput').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>1e6)throw new Error('コースJSONは1MB以下にしてください。');const c=validateCourseOverride(JSON.parse(await file.text()));state.custom.set(c.id,c);$('courseError').textContent='';reset();toast('ユーザー指定の形状を適用しました。');}catch(err){$('courseError').textContent=err.message;}finally{e.target.value='';}};
$('dateSelect').addEventListener('change', async function () {
  try {
    await loadRaceDay(this.value);
    error('');
  } catch (e) {
    error(e.message);
  }
});

setRaces(demoData());
requestAnimationFrame(tick);

loadManifest().catch(e => {
  console.error('公開データの読み込みに失敗:', e);
  error(e.message + '。デモデータを表示しています。');
});

root.RaceFrameApp = {
  state,
  reset,
  selectRace,
  setRaces,
  playPause,
  render
};

})(globalThis);
