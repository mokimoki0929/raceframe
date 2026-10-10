
/* Strict local CSV/JSON import. No upload, credentials, model execution, or network. */
(function(root){
'use strict';
const R=root.RaceFrame=root.RaceFrame||{};
const LABELS={escape:'逃げ',front:'先行',stalk:'差し',close:'追込',unknown:'不明'};
function pick(row,keys,def=''){for(const k of keys)if(row[k]!==undefined&&row[k]!==null&&String(row[k]).trim()!=='')return row[k];return def;}
function num(x){if(x===null||x===undefined||String(x).trim()==='')return NaN;return Number(String(x).trim());}
function clean(x){return String(x??'').trim();}
function parseCSV(text){
 text=text.replace(/^\uFEFF/,'');
 const header=text.split(/\r?\n/,1)[0]||'', delim=header.includes('\t')&&!header.includes(',')?'\t':',';
 const rows=[];let row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
   const c=text[i];
   if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
   if(c==='"'){if(cell!=='')throw new Error('CSVの引用符の位置が不正です。');quoted=true;closed=false;}
   else if(c===delim){row.push(cell);cell='';closed=false;}
   else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x!==''))rows.push(row);row=[];cell='';closed=false;}
   else{if(closed&&c.trim())throw new Error('CSVの引用符の後に不正な文字があります。');if(!closed)cell+=c;}
 }
 if(quoted)throw new Error('CSVの引用符が閉じていません。');
 row.push(cell);if(row.some(x=>x!==''))rows.push(row);
 if(rows.length<2)throw new Error('CSVにヘッダーと2頭以上のデータを入れてください。');
 const keys=rows.shift().map(clean);if(new Set(keys).size!==keys.length)throw new Error('CSVに重複する列名があります。');
 if(rows.length>50000)throw new Error('一度に読み込めるのは50,000行までです。');
 return rows.map((r,i)=>{if(r.length!==keys.length)throw new Error(`CSV ${i+2}行目の列数がヘッダーと一致しません。`);return Object.fromEntries(keys.map((k,j)=>[k,r[j]]));});
}
function styleFromValue(x){return ({escape:'escape',front:'front',stalk:'stalk',close:'close',unknown:'unknown','逃':'escape','逃げ':'escape','先':'front','先行':'front','差':'stalk','差し':'stalk','追':'close','追込':'close','追込み':'close','1':'escape','2':'front','3':'stalk','4':'close'})[clean(x).replace(/\.0$/,'')]||'unknown';}
function deriveStyle(row){
 const supplied=styleFromValue(row.style);
 if(supplied!=='unknown')return {style:supplied,early:R.styleEarly(supplied),late:1-R.styleEarly(supplied),styleSource:'入力された脚質'};
 const votes={escape:0,front:0,stalk:0,close:0};
 let earlySum=0,total=0;
 for(let k=1;k<=5;k++){
  const s=styleFromValue(row[`running_style_last${k}`]),w=Math.exp(-.32*(k-1));
  if(s!=='unknown'){votes[s]+=w;earlySum+=R.styleEarly(s)*w;total+=w;}
 }
 const history=Array.isArray(row.history)?row.history.slice(0,5):[];
 history.forEach((h,k)=>{
  const w=Math.exp(-.32*k),n=num(h.field_size);
  const ranks=[h.corner1,h.corner2,h.corner3].map(num).filter(x=>x>0);
  const final=num(h.corner4),s=styleFromValue(h.style);
  let e=NaN;
  if(ranks.length&&n>=2)e=1-(ranks[0]-1)/(n-1);
  else if(s!=='unknown')e=R.styleEarly(s);
  else if(final>0&&n>=2)e=1-(final-1)/(n-1);
  if(Number.isFinite(e)){e=R.clamp(e,0,1);const st=s!=='unknown'?s:e>.85?'escape':e>.60?'front':e>.28?'stalk':'close';votes[st]+=w;earlySum+=e*w;total+=w;}
 });
 if(!total)return {style:'unknown',early:.5,late:.5,styleSource:'履歴不足・中立の演出'};
 const e=earlySum/total,st=Object.keys(votes).sort((a,b)=>votes[b]-votes[a])[0];
 return {style:st,early:e,late:1-e,styleSource:'過去走の脚質・通過順位から推定（演出用）'};
}
function detectCourse(row,meta={}){
 const rid=clean(pick(row,['race_id','raceId'],meta.id||''));
 const place=clean(pick(row,['venue','place','idJyoCD'],meta.venue||(rid.length===12?rid.slice(8,10):'')));
 const venue=Object.keys(R.VENUES).find(k=>k===place||R.VENUES[k].name===place||Number(R.VENUES[k].code)===Number(place));
 const distance=num(pick(row,['distance','dist','Kyori'],meta.distance));
 const given=clean(pick(row,['course_id'],meta.course_id));
 if(given){const c=R.COURSES.find(c=>c.id===given);if(!c)throw new Error(`未対応のcourse_id: ${given}`);return {courseId:given,distance,warning:''};}
 if(!venue)return {courseId:null,distance,warning:'競馬場を自動判別できません。左側でコースを選び、確認ボタンを押してください。'};
 const track=num(pick(row,['track_code','TrackCD'],meta.track_code));
 if(track>=50)return {courseId:null,distance,unsupported:true,warning:'障害コースはこの版では未対応です。平地として再生しません。'};
 let variant;
 const s=clean(pick(row,['surface'],meta.surface)),v=clean(pick(row,['variant'],meta.variant));
 if(['23','24'].includes(String(track))||s==='dirt'||s==='ダート')variant='dirt';
 else if(v)variant=v;
 else if(venue==='tokyo'&&[11,15].includes(track))variant='turf';
 else if([17,21].includes(track))variant='inner';
 else if([18,22].includes(track))variant='outer';
 else if(track===20)variant='mixed';
 else if(venue==='tokyo'&&s==='turf')variant='turf';
 if(!variant)return {courseId:null,distance,warning:'内外回りを自動判別できません。表示するコースを選択してください。'};
 let rail=clean(pick(row,['rail','CourseKubunCD'],meta.rail||'A')).toUpperCase();
 if(variant==='dirt')rail='-';
 const c=R.COURSES.find(c=>c.venue===venue&&c.variant===variant&&c.rail===rail);
 if(!c)return {courseId:null,distance,warning:`コース設定 ${venue}/${variant}/${rail} は未対応です。手動で確認してください。`};
 return {courseId:c.id,distance,warning:(!row.CourseKubunCD&&!row.rail&&!meta.rail&&variant!=='dirt')?'内柵設定がないためAコースを仮選択しています。実際の使用コースを確認してください。':''};
}
function groupRows(rows,options={}){
 const groups=new Map();
 for(const row of rows){const id=clean(pick(row,['race_id','raceId'],'imported-race'));if(!groups.has(id))groups.set(id,[]);groups.get(id).push(row);}
 return [...groups].map(([id,rs])=>makeRace(rs,{id},options));
}
function makeRace(rows,meta={},options={}){
 if(!Array.isArray(rows))throw new Error('horsesは配列で指定してください。');
 const probabilityColumn=options.probabilityColumn||meta.probability_column||'p_final';
 const warnings=[];const nums=new Set();let percentSeen=false,plainSeen=false;
 const horses=rows.map((row,i)=>{
   if(Object.prototype.hasOwnProperty.call(row,'scratched')&&[true,1,'1','true'].includes(row.scratched))throw new Error('取消馬を含んでいます。取消後にモデルで再予測したデータを使用してください。');
   const hn=num(pick(row,['num','horse_num','Umaban','馬番']));
   if(!Number.isInteger(hn)||hn<1||hn>18||nums.has(hn))throw new Error(`馬番が不正または重複しています: ${pick(row,['num','horse_num','Umaban','馬番'])}`);
   nums.add(hn);
   const chosen=pick(row,[probabilityColumn,'probability','prob','勝率']);
   if(chosen==='')throw new Error(`${hn}番に${probabilityColumn}がありません。勝率列の選択を確認してください。`);
   let text=clean(chosen).replace(/％/g,'%'),p;
   if(text.endsWith('%')){p=num(text.slice(0,-1))/100;percentSeen=true;}else{p=num(text);plainSeen=true;if(options.unit==='percent')p/=100;}
   if(!Number.isFinite(p)||p<0||p>1)throw new Error(`${hn}番の勝率が不正です。「0〜1」か「0〜100%」の単位を確認してください。`);
   const frame=num(pick(row,['frame','waku_num','Wakuban','枠']));
   if(Number.isFinite(frame)&&(!Number.isInteger(frame)||frame<1||frame>8))throw new Error(`${hn}番の枠番が不正です。`);
   const traits=deriveStyle(row),early=num(row.early),late=num(row.late);
   return {num:hn,frame:Number.isFinite(frame)?frame:null,name:clean(pick(row,['name','horse','Bamei','馬名'],`${hn}番`)).slice(0,80),prob:p,...traits,
    early:Number.isFinite(early)?R.clamp(early,0,1):traits.early,late:Number.isFinite(late)?R.clamp(late,0,1):traits.late};
 });
 if(percentSeen&&plainSeen&&options.unit!=='percent')warnings.push('%付きと小数の勝率が混在しています。表示値を確認してください。');
 if(horses.length<2||horses.length>18)throw new Error(`${meta.id||'レース'}: 2〜18頭が必要です。`);
 const expected=num(pick(rows[0]||{},['field_size'],meta.field_size));
 if(Number.isInteger(expected)&&expected>0&&expected!==horses.length)throw new Error(`出走頭数が一致しません。入力${horses.length}頭 / field_size=${expected}。全出走馬の予測を読み込んでください。`);
 const sum=horses.reduce((s,h)=>s+h.prob,0);
 if(!(sum>0))throw new Error('全頭の勝率が0です。');
 if(Math.abs(sum-1)>.015)warnings.push(`入力勝率の合計は${(sum*100).toFixed(2)}%。全頭合計100%に正規化しました。`);
 if(horses.some(h=>h.frame===null))warnings.push('枠番未入力の馬は灰色表示です。馬番から枠番を推測しません。');
 const traitsMissing=horses.filter(h=>h.style==='unknown').length;
 if(traitsMissing)warnings.push(`脚質の履歴がない${traitsMissing}頭は、中立の動きで演出します。`);
 const info=detectCourse(rows[0]||{},meta);
 if(info.warning)warnings.push(info.warning);
 return {id:meta.id||'imported-race',title:clean(meta.title||meta.id||'読み込みレース'),...info,horses:horses.sort((a,b)=>a.num-b.num).map(h=>({...h,prob:h.prob/sum})),warnings,source:meta.source||'読み込みデータ',probabilityColumn:rows.some(r=>r[probabilityColumn]!==undefined)?probabilityColumn:(meta.probability_column||'probability'),generatedAt:meta.generated_at||'',demo:!!meta.demo};
}
function parseImport(text,options={}){
 if(text.length>20*1024*1024)throw new Error('ファイルは20MB以下にしてください。');
 const trimmed=text.trim().replace(/^\uFEFF/,'');
 let races;
 if(trimmed.startsWith('{')||trimmed.startsWith('[')){
   const data=JSON.parse(trimmed);
   if(Array.isArray(data)&&data.length&&data[0].horses)races=data.map(r=>makeRace(r.horses,r,{...options,unit:'fraction'}));
   else if(Array.isArray(data))races=groupRows(data,options);
   else if(Array.isArray(data.races))races=data.races.map(r=>makeRace(r.horses,{...r,generated_at:r.generated_at||data.generated_at},{...options,unit:'fraction'}));
   else if(Array.isArray(data.horses))races=[makeRace(data.horses,data,{...options,unit:'fraction'})];
   else throw new Error('JSONにracesまたはhorses配列がありません。');
 }else races=groupRows(parseCSV(text),options);
 if(!races.length)throw new Error('レースがありません。');
 if(new Set(races.map(r=>r.id)).size!==races.length)throw new Error('JSONに同じrace_idのレースが複数あります。');
 return races;
}
function toPortable(race,courseId,distance){
 return {schema_version:1,races:[{id:race.id,title:race.title,course_id:courseId,distance,source:race.source,generated_at:race.generatedAt,
  probability_column:'probability',horses:race.horses.map(h=>({num:h.num,frame:h.frame,name:h.name,probability:h.prob,style:h.style,early:h.early,late:h.late}))}]};
}
function csvCell(v){const s=String(v??'');const safe=/^[=+\-@]/.test(s)?"'"+s:s;return '"'+safe.replace(/"/g,'""')+'"';}
Object.assign(R,{STYLE_LABELS:LABELS,parseCSV,parseImport,deriveStyle,detectCourse,toPortable,csvCell});
if(typeof module!=='undefined')module.exports=R;
})(globalThis);
