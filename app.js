(function(){
  'use strict';
  var TOL=0.15, MIN_EUR=20, D=null, DAY=1, DAYS=30, ELAPSED=0, CATS=[];
  var S={margin:500,tab:'home',open:null,hide:false,q:'',view:'depenses',per:'mois',theme:'light',stage:'boot',loading:true,error:null,lockOk:false,lockBusy:false,syncing:false,fopen:false,fanim:false,first:true,all:false};
  function fcopy(){ return {graph:'solde',year:'',month:'',poste:'',sous:'',moy:'12',exc:'excl'}; }
  S.f=fcopy();
  try{ var pr=JSON.parse(localStorage.getItem('banque-prefs')||'{}'); if(pr.theme) S.theme=pr.theme; if(pr.hide) S.hide=true; if(pr.view2) S.view=pr.view2; if(pr.per) S.per=pr.per; if(pr.margin!=null) S.margin=+pr.margin; }catch(e){}
  function savePrefs(){ try{ localStorage.setItem('banque-prefs',JSON.stringify({theme:S.theme,hide:S.hide,view2:S.view,per:S.per,margin:S.margin})); }catch(e){} }
  document.documentElement.setAttribute('data-theme',S.theme);
  var app=document.getElementById('app');
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MOIS=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];

  function eur(v,d){ if(S.hide) return '••••'; return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:d?2:0,maximumFractionDigits:d?2:0}).format(v); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]}); }
  function fmtDate(iso){ if(!iso) return ''; var p=iso.split('-'); return +p[2]+' '+MOIS[+p[1]-1]; }
  function daysBetween(a,b){ var x=a.split('-'),y=b.split('-'); return Math.round((Date.UTC(+y[0],+y[1]-1,+y[2])-Date.UTC(+x[0],+x[1]-1,+x[2]))/864e5); }
  function ico(p){ return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>'; }
  var I={home:'<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',more:'<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',eyeoff:'<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6C3.7 8.3 2 12 2 12s3.6 7 10 7a10 10 0 0 0 4.4-1"/>',back:'<path d="M15 18l-6-6 6-6"/>',filter:'<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',close:'<path d="M6 6l12 12M18 6L6 18"/>',bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',repeat:'<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',pie:'<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6.4 6.4"/>',chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'};

  /* ---------- données ---------- */
  function avgOf(h,k){ var a=h.slice(-k); return a.length? a.reduce(function(s,v){return s+v},0)/a.length : 0; }
  var MOIS_INITIALES=['J','F','M','A','M','J','J','A','S','O','N','D'];
  var MOIS_L=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  function kfmt(v){ var s=v<0?'−':'', x=Math.abs(v); return s+(x>=1000? (Math.round(x/100)/10).toString().replace('.',',')+'K' : String(Math.round(x))); }
  function addIso(iso,n){ var p=iso.split('-'); return new Date(Date.UTC(+p[0],+p[1]-1,+p[2]+n)).toISOString().slice(0,10); }
  function spark(arr){ if(!arr||arr.length<3) return ''; var v=arr.slice(-12).map(function(x){return Math.max(x||0,0)}), mx=Math.max.apply(null,v.concat([1])), W=30,H=11, p=v.map(function(y,i){ return (i/(v.length-1)*W).toFixed(1)+','+(H-1-y/mx*(H-2)).toFixed(1); }); var last=p[p.length-1].split(',');
    return '<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" aria-hidden="true" style="flex:none;margin-right:5px"><polyline points="'+p.join(' ')+'" fill="none" stroke="var(--muted)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="'+last[0]+'" cy="'+last[1]+'" r="2" fill="var(--accent)"/></svg>'; }
  var PALETTE=['var(--accent)','var(--c2)','var(--ok)','var(--warn)','var(--bad)','var(--c1)','var(--neu)','var(--muted)'];
  function sum(arr){ return arr.reduce(function(s,v){return s+v},0); }
  /* période choisie dans les filtres : un mois (par défaut le mois en cours) ou une année entière */
  function per(){ var keys=(D&&D.keys)||[], curK=D?D.today.month:'', cy=curK.slice(0,4), cm=curK.slice(5,7), y=S.f.year||cy, mo=S.f.month||cm, isYear=mo==='all', key=y+'-'+mo, idxs=[];
    keys.forEach(function(k,i){ if(isYear? k.slice(0,4)===y : k===key) idxs.push(i); });
    return {y:y,mo:mo,isYear:isYear,key:key,cur:!isYear&&key===curK,curYear:y===cy,idxs:idxs,label:isYear?'Année '+y:MOIS_L[+mo-1].charAt(0).toUpperCase()+MOIS_L[+mo-1].slice(1)+' '+y}; }
  function buildCats(){ var k=+S.f.moy, P_=per(), first=P_.idxs.length?P_.idxs[0]:0;
    ELAPSED=P_.cur? DAY/DAYS : 1;
    var monthsN=P_.isYear? (P_.curYear? Math.max(P_.idxs.length-1,0)+DAY/DAYS : Math.max(P_.idxs.length,1)) : 1;
    function calc(all,hist,spentNow,exc){
      if(!all||!P_.idxs.length) return {spent:spentNow,avg:Math.max(avgOf(hist,k),1),avgm:avgOf(hist,k)};
      var spent=sum(P_.idxs.map(function(i){return all[i]||0})), pos=function(v){return Math.max(v,0)}, lo=Math.max(0,first-k), net=function(v,i){return pos(v-(exc?(exc[i]||0):0))}, prior=all.slice(lo,first).map(function(v,i){return net(v,lo+i)}), am=prior.length? sum(prior)/prior.length : sum(all.map(net))/Math.max(all.length,1);
      return {spent:spent,avg:Math.max(am*monthsN,1),avgm:Math.max(am,0)}; }
    return D.cats.map(function(c){ var r=calc(c.all,c.hist,c.spent,S.f.exc!=='incl'?c.exc:null);
      return {id:c.id,n:c.n,spent:r.spent,avg:r.avg,ops:c.ops,all:c.all,upc:c.upc||0,avgm:r.avgm,
      subs:c.subs.map(function(s,i){ var q=calc(s.all,s.hist,s.spent,S.f.exc!=='incl'?s.exc:null); return {id:c.id+'-'+i,n:s.n,spent:q.spent,avg:q.avg,all:s.all,upc:s.upc||0,avgm:q.avgm}; })}; }); }
  function setData(d){ if(d&&!d.keys&&d.months){ d.keys=d.months.map(function(m){return m.k}); d.seriesAll=d.months.map(function(m){return {k:m.k,bal:m.bal,rev:m.rev,dep:m.dep}}); }
    D=d; DAY=d.today.day; DAYS=d.today.days; ELAPSED=DAY/DAYS; }
  function status(c){ var p=c.spent/c.avg, gap=p-ELAPSED, over=c.spent-c.avg*ELAPSED;
    if(over<MIN_EUR) return {k:'ok',t:p<ELAPSED-0.15?'En retard':'Dans le rythme'};
    if(gap>TOL) return {k:'bad',t:'En avance'}; if(gap>0.05) return {k:'warn',t:'À surveiller'}; return {k:'ok',t:p<ELAPSED-0.15?'En retard':'Dans le rythme'}; }
  function srt(arr,ec){ var s=arr.slice().sort(ec?function(a,b){return (b.spent/b.avg-ELAPSED)-(a.spent/a.avg-ELAPSED)}:function(a,b){return b.spent-a.spent}); return s; }
  function applyF(list){ return list; }
  function fcount(){ var f=S.f,n=0; if(f.graph!=='solde')n++; if(f.year&&D&&f.year!==D.today.month.slice(0,4)||f.month&&D&&f.month!==D.today.month.slice(5,7))n++; if(f.poste)n++; if(f.sous)n++; if(f.moy!=='12')n++; if(f.exc==='incl')n++; return n; }

  /* ---------- en-tête ---------- */
  function exportInfo(){ var fd=D.sync&&D.sync.fileDate, stale=fd&&daysBetween(fd,D.today.iso)>2;
    return {label: fd? 'Export du '+fmtDate(fd) : 'Données au '+fmtDate(D.stats.lastRealDate), stale: !!stale}; }
  function onCurrentMonth(fn){ var sv=S.f, cs=CATS, el=ELAPSED; S.f=Object.assign({},sv,{year:'',month:''}); CATS=buildCats(); var r; try{ r=fn(); } finally{ S.f=sv; CATS=cs; ELAPSED=el; } return r; }
  function alertsList(){ return onCurrentMonth(alertsListRaw); }
  function alertsListRaw(){ var a=[], L=D.proj&&D.proj.landing, ex=exportInfo();
    if(L&&L.days>0){ if(L.value<0) a.push({k:'bad',t:'Solde négatif prévu',m:'Atterrissage à '+eur(L.value)+' au '+fmtDate(L.date)+', juste avant la paie.',tab:'home'}); else if(L.value<300) a.push({k:'warn',t:'Atterrissage serré',m:'Il resterait '+eur(L.value)+' au '+fmtDate(L.date)+', juste avant la paie.',tab:'home'}); }
    CATS.forEach(function(c){ var s=status(c); if(s.k==='bad'||s.k==='warn') a.push({k:s.k,t:c.n+' : '+s.t.toLowerCase(),m:eur(c.spent)+' dépensés, rythme attendu '+eur(c.avg*ELAPSED)+'.',open:c.id}); });
    CATS.forEach(function(c){ if(!(D.budgets&&D.budgets[c.n])) return; var b=budInfo(c); if(b.k!=='ok') a.push({k:b.k,t:'Budget '+c.n+' : '+b.t.toLowerCase(),m:eur(c.spent)+' sur un plafond de '+eur(b.cap)+'.',tab:'bud'}); });
    ((D.subs&&D.subs.list)||[]).forEach(function(x){ if(!x.active) return; if(x.hausse) a.push({k:'warn',t:'Hausse : '+x.n,m:eur(x.hausse.from,true)+' → '+eur(x.hausse.to,true)+' par mois.',tab:'subs'}); else if(x.nouveau) a.push({k:'warn',t:'Nouvel abonnement : '+x.n,m:eur(x.amt,true)+' par mois, repéré récemment.',tab:'subs'}); });
    if(ex.stale) a.push({k:'warn',t:'Export ancien',m:ex.label+'. Déposez un nouvel export pour des chiffres à jour.',tab:'plus'});
    var o={bad:0,warn:1,ok:2}; return a.sort(function(x,y){return o[x.k]-o[y.k]}); }
  function bellBtn(){ if(!D) return ''; var n=alertsList().filter(function(x){return x.k==='bad'||x.k==='warn'}).length;
    return '<button class="iconbtn" data-act="alerts" aria-label="Alertes'+(n?', '+n:'')+'" style="position:relative">'+ico(I.bell)+(n?'<span class="fbadge">'+n+'</span>':'')+'</button>'; }
  function alertsScreen(){ var l=alertsList();
    return '<button class="back" data-act="alertsclose">'+ico(I.back)+'Accueil</button><h1 style="font-size:26px">Alertes</h1>'+
    (l.length?'<div class="card" style="padding:4px 14px">'+l.map(function(x){ return '<button class="opline" '+(x.open?'data-aopen="'+esc(x.open)+'"':'data-atab="'+x.tab+'"')+' style="width:100%;border:0;background:transparent;text-align:left;color:inherit;font-family:inherit;border-bottom:1px solid var(--rim-soft);cursor:pointer"><div class="l"><span style="font-weight:600;font-size:14px;white-space:normal">'+esc(x.t)+'</span><span class="muted" style="font-size:12px;white-space:normal">'+esc(x.m)+'</span></div><span class="badge '+x.k+'">'+(x.k==='bad'?'Urgent':'À surveiller')+'</span></button>'; }).join('')+'</div>':'<div class="card muted" style="text-align:center;padding:26px 16px">Aucune alerte : tout est dans le rythme.</div>')+
    '<p class="note">Alertes : postes au-dessus de leur rythme, budgets dépassés, hausses d\'abonnements, atterrissage bas, export ancien.</p>'; }
  function header(){ var n=fcount(), ex=D?exportInfo():{label:'Chargement…',stale:false};
    return (S.stale&&S.refreshErr?'<div class="badt" style="font-size:11.5px;line-height:1.35">Actualisation impossible : '+esc(S.refreshErr)+'</div>':'')+'<div class="row">'+(S.stale&&D?'<button class="chip" data-act="refresh" style="cursor:pointer"><span class="dot stale"></span>Actualiser · chiffres du '+esc(fmtDate(D.stats.lastRealDate))+'</button>':'<span class="chip"><span class="dot'+(ex.stale?' stale':'')+'"></span>'+esc(ex.label)+(ex.stale?' · ancien':'')+'</span>')+'<div style="display:flex;gap:8px">'+bellBtn()+'<button class="iconbtn" data-act="fopen" aria-label="Filtres'+(n?', '+n+' actif'+(n>1?'s':''):'')+'" style="position:relative">'+ico(I.filter)+(n?'<span class="fbadge">'+n+'</span>':'')+'</button><button class="iconbtn" data-act="hide" aria-label="'+(S.hide?'Afficher':'Masquer')+' les montants" aria-pressed="'+S.hide+'">'+ico(S.hide?I.eyeoff:I.eye)+'</button></div></div>'; }

  /* ---------- postes ---------- */
  function aria(c,extra){ return Math.round(c.spent/c.avg*100)+' % de la moyenne dépensés, '+Math.round(ELAPSED*100)+' % du mois écoulé. '+extra; }
  function bar2(c){ var s=status(c), e=c.avg*ELAPSED, d=c.spent-e, w=Math.min(Math.abs(d)/(c.avg*0.5),1)*50, pos=d>=0;
    return '<div class="bar" role="img" aria-label="'+aria(c,'Écart au rythme attendu : '+Math.round(d)+' euros')+'"><i class="'+s.k+'" style="'+(pos?'left:50%':'left:auto;right:50%')+'" data-w="'+w+'"></i><b style="left:50%"></b></div><div class="gapl muted"><span class="'+s.k+'t">'+(pos?'+':'−')+eur(Math.abs(d))+'</span> par rapport au rythme attendu ('+eur(e)+')</div>'; }
  function compactCard(list,sub){
    var ecarts=S.view==='ecarts', T=sub?'div':'button';
    var cats, extra=0;
    if(sub) cats=srt(list,ecarts);
    else { var pool=applyF(list), keep=pool;
      if(!S.all&&pool.length>8){ keep=pool.slice().sort(function(a,b){return Math.max(b.spent,b.avg)-Math.max(a.spent,a.avg)}).slice(0,8); extra=pool.length-keep.length; }
      cats=srt(keep,ecarts); }
    function info(c){ var s=status(c), pct=c.spent/c.avg*100, gap=(c.spent/c.avg-ELAPSED)*100, d=c.spent-c.avg*ELAPSED; return {c:c,s:s,k:s.k,pct:pct,gap:gap,d:d,pos:gap>=0}; }
    function lab(x){ return esc(x.c.n)+' : '+(ecarts?((x.pos?'+':'−')+Math.round(Math.abs(x.d))+' euros par rapport au rythme attendu'):(Math.round(x.c.spent)+' euros, '+Math.round(x.pct)+' % de la moyenne de '+Math.round(x.c.avg)+' euros'))+', '+x.s.t; }
    function up(x){ return x.c.upc>0&&per().cur? '<small class="muted" style="white-space:nowrap">dont '+eur(x.c.upc)+' à venir</small>' : ''; }
    function val(x){ return ecarts? '<span class="sval"><b class="'+x.k+'t">'+(x.pos?'+':'−')+eur(Math.abs(x.d))+'</b>'+up(x)+'</span>' : '<span class="sval"><b>'+eur(x.c.spent)+'</b><small class="muted">'+Math.round(x.pct)+' %</small>'+up(x)+'</span>'; }
    function track(x){ var w;
      if(ecarts){ w=Math.min(Math.abs(x.gap)/45,1)*50; return '<span class="strack"><span class="axis"></span><i class="'+x.k+'" style="'+(x.pos?'left:50%':'left:auto;right:50%')+'" data-w="'+w+'"></i></span>'; }
      return '<span class="strack"><i class="'+x.k+'" style="left:0" data-w="'+(Math.min(x.pct,130)/130*100)+'"></i><span class="tick" style="left:'+(100/130*100)+'%"></span></span>'; }
    var items=cats.map(info), body;
    if(!items.length) body='<p class="muted" style="padding:16px 4px">'+(sub?'Pas de sous-poste pour ce poste.':'Aucun poste ne correspond à ces filtres.')+'</p>';
    else body=items.map(function(x){ return '<'+T+' class="srow'+(ecarts?'':' tall')+'"'+(sub?' role="group"':' data-open="'+esc(x.c.id)+'"')+' aria-label="'+lab(x)+'"><span class="sname">'+esc(x.c.n)+'<small class="muted" style="display:flex;align-items:center;white-space:nowrap;font-size:10.5px;font-weight:500">'+spark(x.c.all)+'moy. '+eur(x.c.avgm||0)+'</small></span>'+track(x)+val(x)+'</'+T+'>'; }).join('');
    var cap= ecarts ? 'Écart en euros par rapport au rythme attendu au jour '+DAY+'. En rouge : le poste dépasse ce rythme de plus de 15 points (et de plus de 20 €). Les 8 postes les plus importants sont affichés.' : 'Le repère marque 100 % de la moyenne du poste. Triés du plus dépensé au moins dépensé.';
    return '<div class="card syn">'+'<div class="seg" role="group" aria-label="Type de graphique"><button data-view="ecarts" aria-pressed="'+ecarts+'">Écarts</button><button data-view="depenses" aria-pressed="'+!ecarts+'">Dépenses</button></div>'+
      '<p class="gapl muted" style="text-align:center;margin:4px 0">'+(ecarts?'Rythme attendu au centre · à gauche en retard · à droite en avance':'Montant dépensé et % de la moyenne du poste')+'</p>'+body+(!sub&&(extra>0||S.all)&&applyF(list).length>8?'<button class="back" data-act="allpostes" style="min-height:40px;align-self:flex-start;font-size:13px">'+(S.all?'Réduire la liste':'Voir les '+extra+' autres postes')+'</button>':'')+
      '<div class="gapl muted" style="margin-top:6px">'+cap+'</div></div>'; }

  /* ---------- graphique de l'accueil ---------- */
  function niceCeil(v){ var step=v>12000?5000:v>6000?2000:v>2500?1000:v>1000?500:100; return Math.max(step,Math.ceil(v*1.08/step)*step); }
  function maxOf(a){ return a.reduce(function(m,v){return v>m?v:m},0); }
  function chartCard(){
    var PR=per(), P=D.proj, C=D.curve, G=120, B=140, N=30, gr=S.f.graph, svg='', sum_='', leg='', badge='', aria='', title=PR.label;
    var poste=S.f.poste?CATS.filter(function(c){return c.id===S.f.poste})[0]:null, sous=poste&&S.f.sous?poste.subs.filter(function(s){return s.n===S.f.sous})[0]:null;
    var bars=!!poste||PR.isYear||S.per!=='mois', COL={solde:'var(--accent)',dep:'var(--accent)',rev:'var(--c2)'};
    function X(i){ return 10+i/(Math.max(N-1,1))*330; }
    function Y(v,mx){ return (B-Math.max(0,Math.min(v,mx))/mx*G).toFixed(1); }
    function pts(arr,mx){ return arr.map(function(v,i){return X(i).toFixed(1)+','+Y(v,mx)}).join(' '); }
    function pp(list,mx){ return list.map(function(p){return X(p[0]-1).toFixed(1)+','+Y(p[1],mx)}).join(' '); }
    function txt(x,y,t,o){ o=o||{}; return '<text x="'+x+'" y="'+y+'" fill="'+(o.fill||'var(--muted)')+'" font-size="'+(o.size||10)+'"'+(o.w?' font-weight="'+o.w+'"':'')+(o.a?' text-anchor="'+o.a+'"':'')+'>'+t+'</text>'; }
    function grid(mx){ var mid=mx/2; return '<line x1="10" y1="'+B+'" x2="340" y2="'+B+'" stroke="var(--rim-soft)"/><line x1="10" y1="'+Y(mid,mx)+'" x2="340" y2="'+Y(mid,mx)+'" stroke="var(--rim-soft)" stroke-dasharray="2 4"/>'+(S.hide?'':txt(12,(Y(mid,mx)-4),new Intl.NumberFormat('fr-FR').format(mid)+' €')); }
    function days(mark){ return txt(10,156,'1')+txt(X(14).toFixed(0)-6,156,'15')+(mark?txt((X(mark-1)-6).toFixed(0),156,String(mark),{fill:'var(--text)',w:600}):'')+txt(330,156,String(N)); }
    function ln(p,col,w,dash){ return '<polyline points="'+p+'" fill="none" stroke="'+col+'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>'; }
    function lg(col,dash,t){ return '<span style="display:inline-flex;align-items:center;gap:6px"><svg width="18" height="4" aria-hidden="true"><line x1="0" y1="2" x2="18" y2="2" stroke="'+col+'" stroke-width="2.4"'+(dash?' stroke-dasharray="'+dash+'"':'')+' stroke-linecap="round"/></svg>'+t+'</span>'; }
    function sq(col,t){ return '<span style="display:inline-flex;align-items:center;gap:6px"><i style="width:10px;height:10px;border-radius:3px;background:'+col+';display:inline-block"></i>'+t+'</span>'; }
    function cum(arr,upto){ var c=0,o=[]; for(var i=0;i<Math.min(arr.length,upto);i++){ c+=arr[i]||0; o.push(c); } return o; }
    function fill(arr){ var last=null,o=[]; arr.forEach(function(v){ if(v!=null) last=v; o.push(last==null?0:last); }); return o; }
    var dot=function(x,y,col,hollow){ return '<circle cx="'+x+'" cy="'+y+'" r="'+(hollow?3.5:4.5)+'" fill="'+(hollow?'var(--bg)':col)+'" stroke="'+(hollow?col:'var(--bg)')+'" stroke-width="2"/>'; };

    if(bars){
      /* barres mensuelles : janvier à décembre de l'année choisie */
      var all=D.keys||[], slots=[], yy=PR.y;
      for(var mi=1;mi<=12;mi++){ var kk=yy+'-'+(mi<10?'0':'')+mi; slots.push({key:kk,i:all.indexOf(kk)}); }
      var vals, name, curSlot=-1; slots.forEach(function(s,n){ if(s.key===D.today.month) curSlot=n; });
      if(poste){ var src=(sous||poste).all||[]; vals=slots.map(function(s){return s.i<0?null:(src[s.i]||0)}); name='Dépenses'; title=poste.n+(sous?' › '+sous.n:'')+' · '+yy; }
      else { var ser=D.seriesAll||[]; vals=slots.map(function(s){ var o=s.i<0?null:ser[s.i]; return o? (gr==='dep'?o.dep:gr==='rev'?o.rev:o.bal) : null; }); name=gr==='dep'?'Dépenses':gr==='rev'?'Revenus':'Solde de fin de mois'; title='Année '+yy; }
      var projV=null; if(!poste&&curSlot>=0) projV=gr==='dep'?P.depEnd:gr==='rev'?P.revEnd:P.value;
      var known=vals.filter(function(v){return v!=null});
      var mx=niceCeil(Math.max(maxOf(known.length?known:[0]),projV||0,1)), bw=330/12, g=grid(mx), hi=PR.isYear? -1 : slots.map(function(s){return s.key}).indexOf(PR.key);
      function kv(v){ var s=v<0?'−':'', x=Math.abs(v); return s+(x>=1000? (Math.round(x/100)/10).toString().replace('.',',')+'K' : String(Math.round(x))); }
      N=12; var col=poste?'var(--accent)':COL[gr];
      slots.forEach(function(sl,n){ var cx=10+bw*(n+.5), v=vals[n], key=sl.key, lab=MOIS_INITIALES[n]||'', sel=n===hi, last=n===curSlot, has=v!=null;
        g+='<g data-bar="'+key+'" role="button" aria-label="'+esc(MOIS_L[n]+' '+key.slice(0,4))+'" style="cursor:pointer"><rect x="'+(cx-bw/2).toFixed(1)+'" y="0" width="'+bw.toFixed(1)+'" height="160" fill="transparent"/>';
        if(has) g+='<rect x="'+(cx-8).toFixed(1)+'" y="'+Y(v,mx)+'" width="16" height="'+(Math.min(Math.max(v,0),mx)/mx*G).toFixed(1)+'" rx="4" fill="'+(sel||hi<0?col:'var(--neu)')+'"/>';
        if(last&&projV!=null) g+='<rect x="'+(cx-8).toFixed(1)+'" y="'+Y(projV,mx)+'" width="16" height="'+(Math.min(Math.max(projV,0),mx)/mx*G).toFixed(1)+'" rx="4" fill="none" stroke="'+col+'" stroke-dasharray="2 2"/>';
        if(!S.hide&&has) g+=txt(cx.toFixed(1),(Y(last&&projV!=null?projV:v,mx)-4),kv(last&&projV!=null?projV:v),{a:'middle',size:8.5,fill:sel?'var(--text)':'var(--muted)',w:sel?700:500});
        g+=txt(cx.toFixed(1),156,lab,{a:'middle',fill:sel?'var(--text)':'var(--muted)',w:sel?600:0})+'</g>'; });
      vals=known;
      var nz=vals.filter(function(v){return v>0}), mean=nz.length? sum(nz)/nz.length : 0;
      sum_= poste? ('Dépenses mensuelles du poste. Moyenne sur la période : '+eur(mean)+' par mois, total '+eur(sum(vals))+'.')
        : gr==='solde'? 'Solde en fin de chaque mois.'+(projV!=null?' Fin de ce mois : '+eur(P.value)+(P.salary.expected>0?', paie attendue vers le '+P.salary.day+' comprise':'')+'.'+(P.landing&&P.landing.days>0&&P.landing.date.slice(0,7)===D.today.month?' Le point le plus bas, juste avant la paie, est de '+eur(P.landing.value)+' au '+fmtDate(P.landing.date)+'.':''):'')
        : (gr==='dep'?'Dépenses':'Revenus')+' de chaque mois, '+eur(sum(vals))+' au total sur la période.'+(projV!=null?' Le contour en pointillés montre la projection de fin de mois.':'');
      aria='Barres mensuelles : '+name; svg=g; leg=sq('var(--neu)','Autres mois')+sq(col,PR.isYear?name:'Mois choisi')+(projV!=null?'<span>Pointillés : projection</span>':'');
    } else {
      var dm=D.daily&&D.daily[PR.key], dn=dm?dm.d.length:30; N=PR.cur?DAYS:dn; var nowD=PR.cur?DAY:N;
      if(!dm&&!PR.cur){ sum_='Pas de détail jour par jour pour ce mois. Choisissez « Année » ou un mois plus récent.'; svg=grid(1); aria='Aucune donnée'; }
      else if(gr==='solde'){
        var bal=PR.cur?C.bal:fill(dm.b), prj=PR.cur?C.proj:[], vv=bal.concat(prj.map(function(p){return p[1]})), mx2=niceCeil(Math.max(maxOf(vv),1));
        if(PR.cur){ var LD=P.landing, inMonth=LD&&LD.date.slice(0,7)===D.today.month&&LD.days>0, endP=prj[prj.length-1], sd=P.salary.day, sal=P.salary.expected;
          if(inMonth){ sum_='Solde actuel '+eur(D.solde)+'. Atterrissage au '+fmtDate(LD.date)+', juste avant la paie : '+eur(LD.value)+'.'; aria='Solde du mois, atterrissage '+Math.round(LD.value)+' euros'; }
          else { sum_='Solde actuel '+eur(D.solde)+'. Projeté en fin de mois : '+eur(P.value)+(sal>0?', salaire attendu vers le '+sd:'')+'.'+(LD&&LD.days>0?' Atterrissage avant la prochaine paie, au '+fmtDate(LD.date)+' : '+eur(LD.value)+'.':''); aria='Solde du mois, projeté '+Math.round(P.value)+' euros'; }
          var lx=Math.min(endP[0],N), lt=(lx>=N-3||lx>DAY+(N-DAY)*.6);
          svg=grid(mx2)+ln(pp(prj,mx2),'var(--accent)',1.8,'2 4')+ln(pts(bal,mx2),'var(--accent)',2.8)+dot(X(DAY-1).toFixed(1),Y(D.solde,mx2),'var(--accent)')+(inMonth?dot(X(lx-1).toFixed(1),Y(LD.value,mx2),'var(--accent)',true):'')+(S.hide?'':txt(inMonth?(lt?X(lx-1).toFixed(1):(X(lx-1)+8).toFixed(1)):340,(Y(inMonth?LD.value:P.value,mx2)-7),eur(inMonth?LD.value:P.value),{a:inMonth&&!lt?'start':'end',fill:'var(--text)',w:600}))+days(DAY);
          leg=lg('var(--accent)','','Solde')+'<span>Pointillés : projection'+(inMonth?' jusqu’à la veille de la paie':'')+'</span>';
        } else { var mn=Math.min.apply(null,bal), mxv=Math.max.apply(null,bal);
          sum_='Solde de fin de mois : '+eur(bal[bal.length-1])+'. Plus bas : '+eur(mn)+', plus haut : '+eur(mxv)+'.'; aria='Solde du mois, '+Math.round(bal[bal.length-1])+' euros en fin de mois';
          svg=grid(mx2)+ln(pts(bal,mx2),'var(--accent)',2.8)+dot(X(bal.length-1).toFixed(1),Y(bal[bal.length-1],mx2),'var(--accent)')+days(0); leg=lg('var(--accent)','','Solde'); }
      } else {
        var isD=gr==='dep', arr=PR.cur?(isD?C.depCum:C.revCum):cum(isD?dm.d:dm.r,N), endV=PR.cur?(isD?P.depEnd:P.revEnd):arr[arr.length-1]||0, nowV=arr[nowD-1]||0, hab=[];
        if(isD){ if(PR.cur) hab=C.habit; else { var pk=(D.keys||[]).slice(Math.max(0,PR.idxs[0]-12),PR.idxs[0]).filter(function(k){return D.daily&&D.daily[k]}); for(var d0=0;d0<N;d0++){ var t=0; pk.forEach(function(k){ t+=cum(D.daily[k].d,d0+1).pop()||0; }); hab.push(pk.length? t/pk.length : 0); } } }
        var prevL=[], pk0=prevKey(PR.key,-1); if(isD&&D.daily&&D.daily[pk0]) prevL=cum(D.daily[pk0].d,N);
        var mx3=niceCeil(Math.max(endV,nowV,maxOf(hab),maxOf(prevL),1)), hN=hab[nowD-1]||0;
        if(isD&&hN>0&&PR.cur){ var pc=Math.round((nowV/hN-1)*100); badge='<span class="badge '+(pc>15?'bad':pc>5?'warn':'ok')+'">'+(pc>0?'+':'')+pc+' % vs rythme habituel</span>'; }
        sum_=(isD?'Dépenses cumulées : ':'Revenus cumulés : ')+eur(nowV)+(PR.cur?' au jour '+DAY:' sur le mois')+(isD&&hN>0?', contre '+eur(hN)+' en moyenne à cette date':'')+'.'+(PR.cur&&!isD&&P.salary.expected>0?' Salaire attendu vers le '+P.salary.day+' : +'+eur(P.salary.expected)+'.':'');
        aria=(isD?'Dépenses':'Revenus')+' cumulés du mois : '+Math.round(nowV)+' euros';
        var rp=PR.cur?(isD?[[DAY,nowV],[N,endV]]:(P.salary.expected>0?[[DAY,nowV],[Math.max(DAY,P.salary.day-1),nowV],[P.salary.day,endV],[N,endV]]:[[DAY,nowV],[N,endV]])):[];
        svg=grid(mx3)+(isD&&hab.length?ln(pts(hab,mx3),'var(--muted)',1.6,'4 4'):'')+(prevL.length?ln(pts(prevL,mx3),'var(--warn)',1.6,'1 3'):'')+(PR.cur?ln(pp(rp,mx3),COL[gr],1.8,'2 4'):'')+ln(pts(arr,mx3),COL[gr],2.8)+dot(X(nowD-1).toFixed(1),Y(nowV,mx3),COL[gr])+days(PR.cur?DAY:0);
        leg=lg(COL[gr],'',isD?'Dépenses':'Revenus')+(isD&&hab.length?lg('var(--muted)','4 4','Rythme habituel'):'')+(prevL.length?lg('var(--warn)','1 3',MOIS_L[+pk0.slice(5,7)-1].charAt(0).toUpperCase()+MOIS_L[+pk0.slice(5,7)-1].slice(1)):'')+(PR.cur?'<span>Pointillés : projection</span>':'');
      }
    }
    sum_=sum_.replace(/\.{2,}/g,'.');
    var showTog=!poste&&!PR.isYear;
    return '<div class="card"><div class="row"><h2 style="font-size:16px">'+esc(title)+'</h2>'+badge+'</div>'+
      (showTog?'<div class="ctrls"><div class="seg sm" role="group" aria-label="Affichage du graphique"><button data-per="mois" aria-pressed="'+(S.per==='mois')+'">Mois</button><button data-per="annee" aria-pressed="'+(S.per!=='mois')+'">Année</button></div></div>':'')+
      '<p class="muted" style="font-size:13px;margin:2px 0 6px;line-height:1.4">'+sum_+'</p>'+
      '<svg viewBox="0 0 350 162" width="100%" role="img" aria-label="'+esc(aria)+'">'+svg+'</svg>'+
      '<div class="muted" style="display:flex;gap:6px 14px;font-size:11px;flex-wrap:wrap;margin-top:4px">'+leg+'</div></div>'; }

  /* ---------- écrans ---------- */
  function syncNote(){ var s=D.sync; if(s&&s.error) return '<div class="card muted" style="font-size:13px;line-height:1.45"><b style="color:var(--text)">Lecture du dernier export impossible</b><br>'+esc(s.error)+'<br>Les chiffres viennent des opérations déjà importées.</div>'; return ''; }
  function landingCard(){
    var L=D.proj.landing, lab, sub;
    if(!L){ lab='Solde projeté au '+fmtDate(D.today.month+'-'+(DAYS<10?'0':'')+DAYS); sub='Paie non repérée dans l’historique.'; return landingHtml(lab,sub,D.proj.value); }
    lab='Atterrissage avant la paie';
    if(L.exportAge>1) sub='Export du '+fmtDate(L.exportDate)+' : les '+L.exportAge+' derniers jours ne sont pas vus. Déposez un nouvel export.';
    else if(L.days<=0) sub='Paie attendue d’un jour à l’autre.';
    else sub='Au '+fmtDate(L.date)+', veille de la paie '+(L.payKnown?'programmée le '+fmtDate(L.payDate):'estimée au '+fmtDate(L.payDate)+(L.payMin!==L.payMax?' (versée entre le '+L.payMin+' et le '+L.payMax+' ces derniers mois)':''))+'.';
    return landingHtml(lab,sub.replace(/\.\.+$/,'.'),L.value);
  }
  function landingHtml(lab,sub,v){ var L=D.proj.landing, open=!!S.landOpen&&!!L;
    return '<div class="card" style="padding:0;overflow:hidden"><button data-act="landtoggle" aria-expanded="'+open+'" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;width:100%;border:0;background:transparent;text-align:left;color:inherit;font-family:inherit;cursor:pointer"><div style="min-width:0"><div class="muted" style="font-size:13px">'+esc(lab)+'</div><div class="muted" style="font-size:11.5px;line-height:1.35;margin-top:2px">'+esc(sub)+'</div></div><span style="font-size:20px;font-weight:600;color:var(--accent);white-space:nowrap">'+eur(v)+'</span></button>'+(open?landDetail(L):'')+'</div>'; }
  function landDetail(L){ function r(l,v,cls){ return '<div class="row" style="font-size:13px;padding:5px 0"><span class="muted">'+l+'</span><b'+(cls?' class="'+cls+'"':'')+'>'+v+'</b></div>'; }
    return '<div style="border-top:1px solid var(--rim-soft);padding:8px 16px 14px">'+
      r('Solde actuel',eur(D.solde))+
      r('Opérations déjà programmées ('+L.fut.length+')',(L.futSum>0?'+':'')+eur(L.futSum),L.futSum<0?'badt':'okt')+
      (L.fut.length?'<div style="padding:0 0 4px 10px">'+L.fut.map(function(f){ return '<div class="row muted" style="font-size:12px;padding:2px 0"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(fmtDate(f[0]))+' · '+esc(f[1])+'</span><span>'+(f[2]>0?'+':'')+eur(f[2])+'</span></div>'; }).join('')+'</div>':'')+
      r('Dépenses courantes estimées ('+L.days+' j × '+eur(L.perDay)+')','−'+eur(L.spend),'badt')+
      '<div class="row" style="font-size:14px;padding:8px 0 0;border-top:1px solid var(--rim-soft);margin-top:4px"><b>Atterrissage</b><b style="color:var(--accent)">'+eur(L.value)+'</b></div>'+
      '<p class="muted" style="font-size:11.5px;line-height:1.4;margin-top:8px">Les dépenses courantes sont la moyenne de vos paiements par carte sur 90 jours. Si l\'export est ancien, les opérations faites depuis ne sont pas comptées.</p></div>'; }
  function homeScreen(){
    return header()+syncNote()+'<div><div class="muted" style="font-size:14px">'+(D.soldeEstime?'Solde estimé (export du '+esc(fmtDate(D.proj.landing?D.proj.landing.exportDate:D.stats.lastRealDate))+')':'Solde BoursoBank')+'</div><div class="balance" id="bal" data-v="'+D.solde+'">'+eur(D.solde)+'</div></div>'+
    landingCard()+chartCard()+
    '<div class="row"><h2 style="font-size:18px">'+postesTitle()+'</h2><span class="muted" style="font-size:12px">'+(per().cur?'Jour '+DAY+' sur '+DAYS:esc(per().label))+'</span></div>'+avgLine()+postesList();
  }
  function avgLine(){ var t=CATS.reduce(function(s,c){return s+(c.avgm||0)},0); return '<p class="muted" style="font-size:13px;margin:-6px 0 0">Dépenses moyennes : <b style="color:var(--text)">'+eur(t)+'</b> par mois, sur '+S.f.moy+' mois.</p>'; }
  function postesTitle(){ var c=S.f.poste?CATS.filter(function(x){return x.id===S.f.poste})[0]:null; return c?(S.f.sous?'Sous-poste':'Sous-postes'):'Postes'; }
  function postesList(){ var c=S.f.poste?CATS.filter(function(x){return x.id===S.f.poste})[0]:null;
    if(!c) return compactCard(CATS);
    var list=S.f.sous? c.subs.filter(function(s){return s.n===S.f.sous}) : c.subs;
    return '<button class="back" data-act="clearposte" style="min-height:36px">'+ico(I.back)+esc(c.n)+' · retirer le filtre</button>'+compactCard(list,true);
  }
  function opsList(arr){ return arr.map(function(o){ return '<div class="opline"><div class="l"><span style="font-weight:600;font-size:14px">'+esc(o[1])+'</span><span class="muted" style="font-size:12px">'+esc(fmtDate(o[0]))+(o[4]?' · à venir':'')+' · '+esc(o[2])+'</span></div><span class="amt '+(o[3]>0?'pos':'')+'" style="font-weight:600">'+(S.hide?'••••':(o[3]>0?'+':'')+eur(o[3],true))+'</span></div>'; }).join(''); }
  function detailScreen(){ var c=CATS.filter(function(x){return x.id===S.open})[0]; if(!c){ S.open=null; return homeScreen(); } var s=status(c);
    return '<button class="back" data-act="close">'+ico(I.back)+'Accueil</button><div class="row"><h2 style="font-size:22px">'+esc(c.n)+'</h2><span class="badge '+s.k+'">'+s.t+'</span></div>'+
    '<div class="card"><div style="font-size:30px;font-weight:600">'+eur(c.spent)+'</div><div class="muted" style="font-size:13px;margin:2px 0 12px">sur une moyenne de '+eur(c.avg)+' ('+S.f.moy+' mois)</div>'+bar2(c)+'</div>'+
    '<h3 style="font-size:16px">Sous-postes</h3>'+compactCard(c.subs,true)+
    '<h3 style="font-size:16px">Opérations</h3><div class="card" style="padding:4px 14px">'+opsList(c.ops.slice(0,20).map(function(o){return [o[0],o[1],c.n,o[2],o[3]]}))+(c.ops.length?'':'<p class="muted" style="padding:14px 0">Aucune opération.</p>')+'</div>'; }
  function opsScreen(){ var q=S.q.toLowerCase(), r=D.ops.filter(function(o){return !q||(o[1]+' '+o[2]).toLowerCase().indexOf(q)>-1}), shown=r.slice(0,150);
    return header()+'<h1 style="font-size:26px">Opérations</h1><input type="search" id="q" placeholder="Rechercher un libellé ou une catégorie" aria-label="Rechercher une opération" value="'+esc(S.q)+'"><div class="card" style="padding:4px 14px" id="oplist">'+opsHtml(r,shown)+'</div>'; }
  function opsHtml(r,shown){ return r.length? opsList(shown)+(r.length>shown.length?'<p class="muted" style="font-size:12px;padding:10px 0">'+shown.length+' sur '+r.length+' opérations. Affinez la recherche pour voir les autres.</p>':'') : '<p class="muted" style="padding:16px 0">Aucune opération ne correspond à cette recherche.</p>'; }
  function plusScreen(){ var dark=S.theme==='dark', s=D.sync||{}, st=D.stats;
    return '<h1 style="font-size:26px">Plus</h1>'+analyseTeaser()+'<div class="card" style="padding:4px 16px"><button class="switch" data-sub="rules" style="width:100%;border:0;background:transparent;text-align:left;min-height:44px;font-size:inherit"><span style="display:flex;align-items:center;gap:10px">'+ico(I.list)+'Règles de catégorisation</span><span class="muted">›</span></button><button class="switch" data-sub="bilan" style="width:100%;border:0;background:transparent;text-align:left;min-height:44px;font-size:inherit"><span style="display:flex;align-items:center;gap:10px">'+ico(I.chart)+'Bilan annuel</span><span class="muted">›</span></button></div><div class="card" style="padding:4px 16px"><div class="switch"><span>Masquer les montants</span><button class="tog" data-act="hide" aria-pressed="'+S.hide+'" aria-label="Masquer les montants"></button></div><div class="switch"><span>Thème sombre</span><button class="tog" data-act="theme" aria-pressed="'+dark+'" aria-label="Thème sombre"></button></div>'+(S.lockAvail?'<div class="switch"><span>Verrouiller avec l\'empreinte</span><button class="tog" data-act="lock" aria-pressed="'+Lock.enabled()+'" aria-label="Verrouiller avec l\'empreinte"></button></div>':'')+'</div>'+
    '<div class="card" style="display:flex;flex-direction:column;gap:8px"><h3 style="font-size:15px">Vos données</h3>'+
      '<div class="muted" style="font-size:13px;line-height:1.5">Dernier export lu : <b style="color:var(--text)">'+esc(s.fileName||'inconnu')+'</b>'+(s.fileDate?' ('+esc(fmtDate(s.fileDate))+')':'')+'<br>'+st.rows+' opérations en mémoire, du '+esc(fmtDate(st.from))+' au '+esc(fmtDate(st.to))+'.'+(s.lastSync?'<br>Dernière synchronisation : '+esc(String(s.lastSync).replace('T',' à ')):'')+'<br>Les mouvements entre vos propres comptes ('+st.internal+') ne sont pas comptés dans les dépenses.</div>'+
      '<button class="fbtn" data-act="sync"'+(S.syncing?' disabled':'')+'>'+(S.syncing?'Lecture du dossier…':'Relire le dossier maintenant')+'</button>'+
      '<div class="muted" style="font-size:12px;line-height:1.4">Déposez un nouvel export dans le dossier « Export banque » : il est lu automatiquement à l\'ouverture de cette page.</div></div><div class="card" style="display:flex;flex-direction:column;gap:8px"><div class="muted" style="font-size:13px">Version de l\'application : <b style="color:var(--text)">'+esc((window.BANQUE_CONFIG&&BANQUE_CONFIG.BUILD)||'?')+'</b></div><button class="fbtn ghost" data-act="forceupdate" style="width:100%">Forcer la mise à jour</button></div><button class="fbtn ghost" data-act="signout">Se déconnecter et effacer les données de cet appareil</button><p class="note">Prévus ensuite : règles de catégorisation, objectifs d\'épargne.</p>'; }




  /* ---------- analyse du mois ---------- */
  function prevKey(k,n){ var y=+k.slice(0,4), m=+k.slice(5,7)-1+n; y+=Math.floor(m/12); m=((m%12)+12)%12; return y+'-'+(m<9?'0':'')+(m+1); }
  function analysisData(){ return onCurrentMonth(analysisRaw); }
  function analysisRaw(){
    var C=D.curve,P=D.proj,L=P.landing,cur=D.today.month,out={}, MONTH=MOIS_L[+cur.slice(5,7)-1];
    out.month=MONTH.charAt(0).toUpperCase()+MONTH.slice(1)+' '+cur.slice(0,4);
    out.depNow=C.depCum[DAY-1]||0; out.revNow=C.revCum[DAY-1]||0;
    out.upc=CATS.reduce(function(s,c){return s+(c.upc||0)},0);
    var pk=prevKey(cur,-1), dm=D.daily&&D.daily[pk]; out.prevName=MOIS_L[+pk.slice(5,7)-1];
    if(dm){ var s=0; for(var i=0;i<Math.min(DAY,dm.d.length);i++) s+=dm.d[i]; out.prevSame=s; }
    var ser=(D.seriesAll||[]).filter(function(x){return x.k<cur}).slice(-12); out.avgDep=ser.length? sum(ser.map(function(x){return x.dep}))/ser.length : 0;
    out.proj=P.depEnd;
    var over=CATS.map(function(c){ return {c:c,over:c.spent-c.avg*ELAPSED,s:status(c)}; });
    out.watch=over.filter(function(x){return x.s.k!=='ok'&&x.over>MIN_EUR}).sort(function(a,b){return b.over-a.over}).slice(0,4);
    out.calm=over.filter(function(x){return x.c.avg>60&&x.over<-MIN_EUR}).sort(function(a,b){return a.over-b.over}).slice(0,3);
    var monthOps=(D.ops||[]).filter(function(o){ return o[0].slice(0,7)===cur&&o[3]<0&&!/internes?/i.test(o[2]||'')&&o[2]!=='Famille et proches'; }).sort(function(a,b){return a[3]-b[3]});
    out.big=monthOps.slice(0,5);
    var subs=(D.subs&&D.subs.list||[]).filter(function(x){return x.active});
    out.subsNew=subs.filter(function(x){return x.nouveau&&!x.hausse}); out.subsUp=subs.filter(function(x){return x.hausse});
    out.subsLeft=subs.filter(function(x){return x.next.slice(0,7)===cur&&x.next>D.today.iso});
    out.subsTotal=D.subs?D.subs.total:0;
    var nc=CATS.filter(function(c){return /non\s*cat/i.test(c.n)})[0]; out.nc=nc&&nc.spent>0?nc.spent:0;
    out.land=L; out.sal=P.salary;
    out.cats=CATS.map(function(c){ return {n:c.n,real:c.spent-(c.upc||0)}; });
    var sa0=D.seriesAll||[], pS=sa0.filter(function(x){return x.k===pk})[0], cS=sa0.filter(function(x){return x.k===cur})[0]; out.startBal=pS?pS.bal:null; out.savOut=cS?cS.sav||0:0;
    return out; }
  function cur_(){ return D.today.month; }
  function sect(t,body,k){ return '<div class="card" style="display:flex;flex-direction:column;gap:6px"><div class="row"><h3 style="font-size:15px">'+t+'</h3>'+(k?'<span class="badge '+k[0]+'">'+k[1]+'</span>':'')+'</div>'+body+'</div>'; }
  function aline(l,r,cls,attr){ return '<div class="row" style="font-size:13px;padding:5px 0;gap:10px'+(attr?';cursor:pointer':'')+'"'+(attr||'')+'><span style="min-width:0">'+l+'</span><b'+(cls?' class="'+cls+'"':'')+' style="white-space:nowrap">'+r+'</b></div>'; }
  function analyseScreen(){ var A=analysisData(), h=[];
    var pct=A.prevSame>0? Math.round((A.depNow/A.prevSame-1)*100) : null;
    h.push('<button class="back" data-act="subclose">'+ico(I.back)+'Plus</button><h1 style="font-size:26px">Analyse du mois</h1><p class="muted" style="font-size:13px;margin:-8px 0 0">'+esc(A.month)+' · jour '+DAY+' sur '+DAYS+'</p>');
    // reste à dépenser (après le bilan)
    if(!D.kpi||!D.forecast||!D.daily) h.push(sect('Analyses incomplètes','<div class="muted" style="font-size:13px;line-height:1.45">L\'appli affiche encore d\'anciens chiffres gardés en mémoire : plusieurs analyses (indicateurs, prévision, calendrier, carte de chaleur…) ne peuvent pas s\'afficher. Appuyez sur Actualiser pour les recalculer depuis votre Drive.</div><button class="fbtn" data-act="refresh" style="width:100%">Actualiser maintenant</button>',['warn','Données anciennes']));
    // 1. bilan
    h.push(sect('Où vous en êtes',
      aline('Dépensé à ce jour',eur(A.depNow))+
      (A.upc>0?aline('Déjà programmé ce mois-ci','+'+eur(A.upc)):'')+
      aline('Reçu à ce jour',eur(A.revNow),'okt')+
      (pct!=null?aline('Par rapport à '+A.prevName+', à la même date',(pct>0?'+':'')+pct+' %',pct>15?'badt':pct<-5?'okt':''):'')+
      aline('Projection de dépenses en fin de mois',eur(A.proj))+
      (A.avgDep>0?'<div class="muted" style="font-size:12px;line-height:1.4">Vos 12 derniers mois : '+eur(A.avgDep)+' de dépenses en moyenne par mois.</div>':''),
      A.avgDep>0&&A.proj>A.avgDep*1.15?['bad','Au-dessus de la moyenne']:A.avgDep>0&&A.proj<A.avgDep*0.9?['ok','En dessous de la moyenne']:['ok','Dans la moyenne']));
    // reste à dépenser par jour
    if(A.land&&A.land.payDate){ var Lq=A.land, pd=daysBetween(D.today.iso,Lq.payDate), dN=Math.max(pd,1), solE=D.solde-(Lq.perDay||0)*(Lq.exportAge||0), av=solE+Lq.futSum-S.margin, pdj=av/dN, usual=D.kpi?D.kpi.daily:0;
      h.push(sect('Reste à dépenser par jour',
        '<div style="font-size:30px;font-weight:600;letter-spacing:-.02em;color:'+(pdj<0?'var(--bad)':'var(--accent)')+'">'+eur(Math.max(pdj,0))+' <span class="muted" style="font-size:14px;font-weight:500">par jour</span></div>'+
        '<div class="muted" style="font-size:12.5px;line-height:1.45">Jusqu\'à la paie estimée du '+esc(fmtDate(Lq.payDate))+' ('+dN+' jour'+(dN>1?'s':'')+'), en tenant compte de '+eur(-Lq.futSum)+' de dépenses déjà programmées et en gardant '+eur(S.margin)+' de marge.'+(usual>0?' Votre rythme habituel est de '+eur(usual)+' par jour.':'')+'</div>'+
        '<div class="row" style="margin-top:6px"><span class="muted" style="font-size:12.5px">Marge de sécurité</span><span style="display:flex;align-items:center;gap:8px"><button class="chip" data-act="margindn" style="cursor:pointer;padding:5px 12px;white-space:nowrap" aria-label="Diminuer la marge">−100</button><b style="min-width:62px;text-align:center">'+eur(S.margin)+'</b><button class="chip" data-act="marginup" style="cursor:pointer;padding:5px 12px;white-space:nowrap" aria-label="Augmenter la marge">+100</button></span></div>',
        usual>0?(pdj<usual*0.6?['warn','Plus serré que d\'habitude']:['ok','Dans vos moyens']):null));
    }
    // indicateurs
    if(D.kpi){ var K=D.kpi, t=K.t12||{}, cour=(t.rev||0)-(t.revExc||0), depC=(t.dep||0)-(t.exc||0), rate=t.rev>0? Math.round((t.rev-t.dep)/t.rev*100) : null, rateC=cour>0? Math.round((cour-depC)/cour*100) : null;
      h.push(sect('Vos indicateurs',
        aline('Reste à vivre<div class="muted" style="font-size:11.5px">Salaire '+eur(K.salary)+' − charges récurrentes '+eur(K.fixed)+'</div>',eur(K.rest)+' / mois')+
        (K.effort!=null?aline('Poids du crédit sur le salaire<div class="muted" style="font-size:11.5px">'+eur(K.credit)+' par mois · repère des banques : 35 %</div>',Math.round(K.effort*100)+' %',K.effort>0.35?'badt':K.effort>0.3?'warnt':'okt'):'')+
        (K.treso!=null?aline('Trésorerie<div class="muted" style="font-size:11.5px">Solde de l\'export ÷ '+eur(K.daily)+' de dépenses par jour</div>',K.treso+' jours'):'')+
        (rate!=null?aline('Taux d\'épargne sur 12 mois<div class="muted" style="font-size:11.5px">'+eur(t.rev)+' reçus − '+eur(t.dep)+' dépensés</div>',rate+' %',rate<0?'badt':''):'')+
        (rateC!=null?aline('…hors primes et dépenses exceptionnelles<div class="muted" style="font-size:11.5px">'+eur(t.revExc||0)+' de revenus et '+eur(t.exc||0)+' de dépenses ponctuelles retirés</div>',rateC+' %',rateC<0?'badt':''):'')+
        (t.sav>0?aline('Viré vers vos autres comptes<div class="muted" style="font-size:11.5px">Livret A et autres : l\'export correspondant manque pour suivre l\'épargne</div>',eur(t.sav)):'')));
    }
    // 2. atterrissage
    if(A.land&&A.land.days>=0) h.push(sect('Atterrissage avant la paie',
      aline('Solde prévu le '+esc(fmtDate(A.land.date)),eur(A.land.value),A.land.value<0?'badt':A.land.value<300?'warnt':'')+
      '<div class="muted" style="font-size:12px;line-height:1.4">'+(A.sal&&A.sal.expected>0?'Paie estimée vers le '+A.sal.day+' (+'+eur(A.sal.expected)+').':'Paie du mois déjà reçue ou non repérée.')+(A.land.exportAge>1?' L\'export date de '+A.land.exportAge+' jours : déposez-en un récent.':'')+'</div>',
      A.land.value<0?['bad','Solde négatif prévu']:A.land.value<300?['warn','Serré']:null));
    // prévision à 30 jours
    if(D.forecast&&D.forecast.pts){ var F=D.forecast, pts_=F.pts, mn=Math.min.apply(null,pts_.concat([0])), mxv=Math.max.apply(null,pts_), rng=(mxv-mn)||1, W=330, H=80;
      function fx(i){ return 10+i/(pts_.length-1)*W; } function fy(v){ return 6+(H-(v-mn)/rng*H); }
      var line=pts_.map(function(v,i){return fx(i).toFixed(1)+','+fy(v).toFixed(1)}).join(' '), li=pts_.indexOf(F.low.v), pay=F.events.filter(function(e){return e.k==='pay'})[0];
      var svg='<svg viewBox="0 0 350 100" width="100%" role="img" aria-label="Solde prévu sur 30 jours"><line x1="10" x2="340" y1="'+fy(0).toFixed(1)+'" y2="'+fy(0).toFixed(1)+'" stroke="var(--rim-soft)" stroke-dasharray="2 4"/><polyline points="'+line+'" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'+(li>=0?'<circle cx="'+fx(li).toFixed(1)+'" cy="'+fy(F.low.v).toFixed(1)+'" r="4" fill="var(--bad)" stroke="var(--bg)" stroke-width="2"/>':'')+'<text x="10" y="98" fill="var(--muted)" font-size="10">aujourd\'hui</text><text x="340" y="98" fill="var(--muted)" font-size="10" text-anchor="end">+30 j</text></svg>';
      h.push(sect('Prévision à 30 jours',
        aline('Point le plus bas',eur(F.low.v)+' · '+esc(fmtDate(F.low.d)),F.low.v<0?'badt':F.low.v<300?'warnt':'')+svg+
        F.events.slice(0,7).map(function(e){ return '<div class="row muted" style="font-size:12px;padding:2px 0"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(fmtDate(e.d))+' · '+esc(e.l.replace(/^(Carte|Prlv Sepa|Vir Sepa|Vir Inst)\s*(\d{2}\/\d{2}\/\d{2}\s*)?/i,''))+'</span><span class="'+(e.a<0?'':'okt')+'">'+(e.a>0?'+':'')+eur(e.a)+'</span></div>'; }).join('')+
        '<div class="muted" style="font-size:11.5px;line-height:1.4;margin-top:4px">Sur la base de vos opérations programmées, de vos prélèvements récurrents, de la paie estimée'+(pay?' (vers le '+esc(fmtDate(pay.d))+')':'')+' et de '+eur(F.daily)+' de dépenses par jour.</div>'));
    }
    // calendrier des échéances
    if(D.forecast&&D.forecast.events){ var FE=D.forecast.events, t0=D.today.iso, dow=(new Date(t0+'T00:00:00Z').getUTCDay()+6)%7, g0=addIso(t0,-dow), endC=addIso(t0,30), cells='', lab_=['L','M','M','J','V','S','D'].map(function(x){return '<div class="muted" style="font-size:10px;text-align:center">'+x+'</div>'}).join('');
      for(var ci=0;ci<35;ci++){ var iso=addIso(g0,ci), evs=FE.filter(function(e){return e.d===iso}), outS=sum(evs.filter(function(e){return e.a<0}).map(function(e){return e.a})), inS=sum(evs.filter(function(e){return e.a>0}).map(function(e){return e.a})), inWin=iso>=t0&&iso<=endC, isT=iso===t0, sel=S.calDay===iso;
        cells+='<'+(evs.length?'button data-cal="'+iso+'"':'div')+' style="min-height:46px;border-radius:12px;border:1px solid '+(sel?'var(--accent)':'var(--rim-soft)')+';background:'+(isT?'var(--glass2)':'var(--glass)')+';color:inherit;font-family:inherit;padding:3px 2px;display:flex;flex-direction:column;align-items:center;gap:1px;opacity:'+(inWin?1:.38)+'"><span style="font-size:11px;font-weight:'+(isT?700:500)+'">'+(+iso.slice(8,10))+'</span>'+(outS<0?'<span class="badt" style="font-size:9.5px">'+(S.hide?'•':kfmt(outS))+'</span>':'')+(inS>0?'<span class="okt" style="font-size:9.5px">'+(S.hide?'•':'+'+kfmt(inS))+'</span>':'')+'</'+(evs.length?'button':'div')+'>'; }
      var shown=S.calDay?FE.filter(function(e){return e.d===S.calDay}):FE.slice(0,6);
      h.push(sect('Calendrier des échéances','<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">'+lab_+cells+'</div>'+
        '<div class="muted" style="font-size:12px;margin-top:4px">'+(S.calDay?esc(fmtDate(S.calDay))+' :':'Prochaines échéances :')+'</div>'+
        (shown.length?shown.map(function(e){ return aline(esc(fmtDate(e.d))+' · '+esc(e.l.replace(/^(Carte|Prlv Sepa|Vir Sepa|Vir Inst)\s*(\d{2}\/\d{2}\/\d{2}\s*)?/i,'')),(e.a>0?'+':'')+eur(e.a),e.a<0?'':'okt'); }).join(''):'<div class="muted" style="font-size:12.5px">Aucune échéance connue ce jour-là.</div>')+
        '<div class="muted" style="font-size:11.5px;line-height:1.4">Sur 30 jours : opérations programmées, prélèvements récurrents détectés et paie estimée. Appuyez sur un jour pour le détail.</div>'));
    }
    // 3. à surveiller
    h.push(sect('À surveiller',
      A.watch.length? A.watch.map(function(x){ return aline(esc(x.c.n)+'<div class="muted" style="font-size:11.5px">'+eur(x.c.spent)+' dépensés · rythme attendu '+eur(x.c.avg*ELAPSED)+(x.c.upc>0?' · dont '+eur(x.c.upc)+' à venir':'')+'</div>','+'+eur(x.over),x.s.k==='bad'?'badt':'warnt',' data-aopen="'+esc(x.c.id)+'"'); }).join('')
        : '<div class="muted" style="font-size:13px">Aucun poste n\'est au-dessus de son rythme habituel.</div>',
      A.watch.length?[A.watch[0].s.k,A.watch.length+' poste'+(A.watch.length>1?'s':'')]:['ok','Rien à signaler']));
    // 4. bien tenus
    if(A.calm.length) h.push(sect('Plus bas que d\'habitude',A.calm.map(function(x){ return aline(esc(x.c.n)+'<div class="muted" style="font-size:11.5px">'+eur(x.c.spent)+' dépensés · rythme attendu '+eur(x.c.avg*ELAPSED)+'</div>','−'+eur(-x.over),'okt',' data-aopen="'+esc(x.c.id)+'"'); }).join(''),['ok','En avance sur le budget']));
    // 5. plus grosses dépenses
    if(A.big.length) h.push(sect('Plus grosses dépenses du mois',A.big.map(function(o){ return aline(esc(o[1])+'<div class="muted" style="font-size:11.5px">'+esc(fmtDate(o[0]))+(o[4]?' · à venir':'')+' · '+esc(o[2])+'</div>','−'+eur(-o[3],true)); }).join('')));
    // à vérifier : doublons et dépenses exceptionnelles
    var chk=[];
    (D.dups||[]).forEach(function(d){ chk.push(aline('Paiement identique ×'+d.n+' le '+esc(fmtDate(d.d))+'<div class="muted" style="font-size:11.5px">'+esc(d.l)+' · doublon possible ?</div>','−'+eur(-d.a*d.n,true),'warnt')); });
    if((D.excOps||[]).length){ chk.push('<div class="muted" style="font-size:12px;margin-top:6px">Dépenses ponctuelles de 12 mois :</div>'); D.excOps.slice(0,5).forEach(function(o){ chk.push(aline(esc(o[1])+'<div class="muted" style="font-size:11.5px">'+esc(fmtDate(o[0]))+' · '+esc(o[2])+'</div>','−'+eur(-o[3],true))); }); }
    if(chk.length) h.push(sect('À vérifier',chk.join(''),(D.dups||[]).length?['warn',(D.dups.length)+' doublon'+(D.dups.length>1?'s':'')+' possible'+(D.dups.length>1?'s':'')]:null));
    // provision pour dépenses ponctuelles
    if(D.kpi&&D.kpi.t12&&D.kpi.t12.exc>0){ var tE=D.kpi.t12.exc, nk=(D.keys||[]).length, byP=CATS.map(function(c){ var e=(c.exc||[]).slice(Math.max(0,nk-12)); return {n:c.n,v:sum(e)}; }).filter(function(x){return x.v>0}).sort(function(p,q){return q.v-p.v}).slice(0,4);
      h.push(sect('Dépenses ponctuelles à provisionner',
        aline('Dépenses ponctuelles sur 12 mois<div class="muted" style="font-size:11.5px">Paiements de 500 € ou plus, hors abonnements</div>',eur(tE))+
        aline('Soit, étalé sur l\'année','≈ '+eur(tE/12)+' / mois','warnt')+
        byP.map(function(x){ return '<div class="row muted" style="font-size:12px;padding:2px 0"><span>'+esc(x.n)+'</span><span>'+eur(x.v)+'</span></div>'; }).join('')+
        '<div class="muted" style="font-size:11.5px;line-height:1.4;margin-top:4px">C\'est une mesure de ce qui est arrivé, pas une consigne : ces dépenses ne reviennent pas forcément chaque année.</div>'));
    }
    // reste à charge santé
    var HS=CATS.filter(function(c){return /sant/i.test(c.n)})[0];
    if(HS&&HS.all){ var nk2=(D.keys||[]).length, from=Math.max(0,nk2-12), net=sum(HS.all.slice(from)), refSub=(HS.subs||[]).filter(function(s){return /remboursements? mutuelle/i.test(s.n)})[0], refund=refSub&&refSub.all?-sum(refSub.all.slice(from)):0, gross=net+refund;
      if(gross>0) h.push(sect('Reste à charge santé (12 mois)',
        aline('Dépenses de santé',eur(gross))+
        aline('Remboursements de la mutuelle','−'+eur(refund),'okt')+
        aline('<b>Reste à charge</b>',eur(net))+
        (gross>0&&refund>0?'<div class="muted" style="font-size:12px">La mutuelle a remboursé '+Math.round(refund/gross*100)+' % de vos dépenses de santé.</div>':'<div class="muted" style="font-size:12px">Aucun remboursement de mutuelle repéré : une règle de catégorisation peut les classer en Santé › Remboursements mutuelle.</div>'),
        refund>0?null:['warn','Remboursements non repérés']));
    }
    // 6. abonnements
    var sb=[]; A.subsNew.forEach(function(x){ sb.push(aline('Nouveau : '+esc(x.n),eur(x.amt,true)+' / mois','warnt')); }); A.subsUp.forEach(function(x){ sb.push(aline('Hausse : '+esc(x.n),eur(x.hausse.from,true)+' → '+eur(x.hausse.to,true),'warnt')); });
    if(A.subsLeft.length) sb.push(aline(A.subsLeft.length+' prélèvement'+(A.subsLeft.length>1?'s':'')+' récurrent'+(A.subsLeft.length>1?'s':'')+' encore attendu'+(A.subsLeft.length>1?'s':'')+' ce mois-ci',eur(sum(A.subsLeft.map(function(x){return x.amt})),true)));
    sb.push('<div class="muted" style="font-size:12px">Total des abonnements actifs : '+eur(A.subsTotal)+' par mois.</div>');
    h.push(sect('Abonnements',sb.join(''),A.subsNew.length||A.subsUp.length?['warn',(A.subsNew.length+A.subsUp.length)+' à vérifier']:null));
    // fixes, variables, ponctuelles
    if(D.kpi&&D.kpi.t12&&D.kpi.t12.n>0){ var T=D.kpi.t12, nM=T.n, totM=T.dep/nM, ponc=T.exc/nM, fix=Math.min(D.kpi.fixed,Math.max(totM-ponc,0)), vari=Math.max(totM-ponc-fix,0), seg=[['Fixes',fix,'var(--accent)'],['Variables',vari,'var(--c2)'],['Ponctuelles',ponc,'var(--warn)']];
      if(totM>0) h.push(sect('Fixes, variables, ponctuelles',
        '<div style="display:flex;height:16px;border-radius:8px;overflow:hidden;background:var(--track)" role="img" aria-label="Répartition des dépenses mensuelles moyennes">'+seg.map(function(s){return '<span style="width:'+(s[1]/totM*100).toFixed(1)+'%;background:'+s[2]+'"></span>'}).join('')+'</div>'+
        seg.map(function(s){ return '<div class="row" style="font-size:13px;padding:3px 0"><span style="display:inline-flex;align-items:center;gap:8px"><i style="width:10px;height:10px;border-radius:3px;background:'+s[2]+';display:inline-block"></i>'+s[0]+'</span><span><b>'+eur(s[1])+'</b> <span class="muted">· '+Math.round(s[1]/totM*100)+' %</span></span></div>'; }).join('')+
        '<div class="muted" style="font-size:11.5px;line-height:1.4">Moyennes mensuelles sur '+nM+' mois : '+eur(totM)+' de dépenses au total. Fixes = prélèvements récurrents détectés ; ponctuelles = paiements de 500 € ou plus.</div>'));
    }
    // cascade du mois
    if(A.startBal!=null&&A.cats){ var steps=[], run=A.startBal, real=A.cats.filter(function(c){return Math.abs(c.real)>=1}).sort(function(p,q){return q.real-p.real}), topC=real.slice(0,5), restC=real.slice(5), restV=sum(restC.map(function(c){return c.real})), totSp=sum(real.map(function(c){return c.real}));
      var diff=D.solde-(A.startBal+A.revNow-totSp-A.savOut);
      steps.push({l:'Solde au 1er',v:A.startBal,t:1}); steps.push({l:'Revenus reçus',v:A.revNow});
      topC.forEach(function(c){ steps.push({l:c.n,v:-c.real}); }); if(restC.length) steps.push({l:'Autres postes ('+restC.length+')',v:-restV});
      if(A.savOut>=1) steps.push({l:'Virements vers vos comptes',v:-A.savOut}); if(Math.abs(diff)>=1) steps.push({l:'Autres mouvements',v:diff});
      steps.push({l:D.soldeEstime?'Solde estimé':'Solde actuel',v:D.solde,t:1});
      var cum=[],lo=0,hi=A.startBal; steps.forEach(function(s){ if(s.t){ cum.push([0,s.v]); lo=Math.min(lo,s.v); hi=Math.max(hi,s.v); } else { var a0=run, b0=run+s.v; cum.push([a0,b0]); run=b0; lo=Math.min(lo,a0,b0); hi=Math.max(hi,a0,b0); } });
      var X0=120,X1=272,sc=function(v){return X0+(v-lo)/((hi-lo)||1)*(X1-X0)}, rowH=22, svg2='<svg viewBox="0 0 350 '+(steps.length*rowH+6)+'" width="100%" role="img" aria-label="Cascade du mois : du solde de début au solde actuel"><line x1="'+sc(0).toFixed(1)+'" x2="'+sc(0).toFixed(1)+'" y1="0" y2="'+(steps.length*rowH)+'" stroke="var(--rim-soft)"/>';
      steps.forEach(function(s,i){ var r=cum[i], x=sc(Math.min(r[0],r[1])), w=Math.max(Math.abs(sc(r[1])-sc(r[0])),2), col=s.t?'var(--accent)':s.v>=0?'var(--ok)':'var(--neu)', y=i*rowH+3;
        svg2+='<text x="0" y="'+(y+12)+'" fill="var(--text)" font-size="10.5">'+esc(s.l.length>19?s.l.slice(0,18)+'…':s.l)+'</text><rect x="'+x.toFixed(1)+'" y="'+y+'" width="'+w.toFixed(1)+'" height="15" rx="4" fill="'+col+'"/>'+(S.hide?'':'<text x="346" y="'+(y+12)+'" text-anchor="end" fill="'+(s.t?'var(--text)':s.v>=0?'var(--ok)':'var(--muted)')+'" font-size="10.5" font-weight="'+(s.t?700:500)+'">'+(s.t?'':(s.v>=0?'+':'−'))+kfmt(Math.abs(s.v)).replace('−','')+'</text>'); });
      svg2+='</svg>';
      h.push(sect('Cascade du mois','<div class="muted" style="font-size:12.5px;line-height:1.4">De votre solde du 1er au solde actuel : revenus reçus puis dépenses par poste.</div>'+svg2+'<div class="muted" style="font-size:11.5px;line-height:1.4">Les dépenses déjà programmées mais pas encore passées ne sont pas comptées ici.</div>'));
    }
    // carte de chaleur des jours de dépense
    if(D.daily&&Object.keys(D.daily).length){ var dkeys=Object.keys(D.daily).sort(), off=Math.max(Math.min(S.heat||0,0),-(dkeys.length-1)), hk=dkeys[dkeys.length-1+off], hd=D.daily[hk].d, allV=[]; dkeys.forEach(function(k){ D.daily[k].d.forEach(function(v){ if(v>0) allV.push(v); }); });
      allV.sort(function(p,q){return p-q}); var cap=allV.length? allV[Math.floor(allV.length*0.9)] : 1, firstDow=(new Date(hk+'-01T00:00:00Z').getUTCDay()+6)%7, hc='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">'+['L','M','M','J','V','S','D'].map(function(x){return '<div class="muted" style="font-size:10px;text-align:center">'+x+'</div>'}).join('');
      for(var q0=0;q0<firstDow;q0++) hc+='<div></div>';
      var todayK=D.today.iso;
      for(var dj=1;dj<=hd.length;dj++){ var v=hd[dj-1]||0, iso2=hk+'-'+(dj<10?'0':'')+dj, fut=iso2>todayK, al=v>0?(0.14+0.72*Math.min(v/cap,1)):0;
        hc+='<div style="min-height:40px;border-radius:10px;border:1px solid var(--rim-soft);background:'+(v>0?'color-mix(in srgb,var(--accent) '+Math.round(al*100)+'%,transparent)':'var(--glass)')+';opacity:'+(fut?.35:1)+';display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px"><span style="font-size:10.5px;font-weight:500">'+dj+'</span>'+(v>0&&!S.hide?'<span style="font-size:9.5px;font-weight:600">'+kfmt(v)+'</span>':'')+'</div>'; }
      hc+='</div>';
      h.push(sect('Carte de chaleur des dépenses',
        '<div class="row"><button class="chip" data-act="heatprev" style="cursor:pointer;padding:5px 12px" aria-label="Mois précédent">‹</button><b style="font-size:14px">'+esc(MOIS_L[+hk.slice(5,7)-1].charAt(0).toUpperCase()+MOIS_L[+hk.slice(5,7)-1].slice(1))+' '+hk.slice(0,4)+'</b><button class="chip" data-act="heatnext" style="cursor:pointer;padding:5px 12px;'+(off>=0?'opacity:.4':'')+'" aria-label="Mois suivant"'+(off>=0?' disabled':'')+'>›</button></div>'+hc+
        '<div class="muted" style="font-size:11.5px;line-height:1.4">Plus la case est foncée, plus il est sorti d\'argent ce jour-là. La banque date les opérations aux jours ouvrés : les week-ends restent vides.</div>'));
    }
    // dépenses par poste sur l'année (barres empilées)
    if(D.keys&&CATS.length){ var PRy=per().y, ix=[]; for(var mm=1;mm<=12;mm++) ix.push(D.keys.indexOf(PRy+'-'+(mm<10?'0':'')+mm));
      var tot_=CATS.map(function(c){ return {c:c,t:sum(ix.map(function(i){return i<0?0:Math.max((c.all||[])[i]||0,0)}))}; }).filter(function(x){return x.t>0}).sort(function(p,q){return q.t-p.t}), top5=tot_.slice(0,5), rest5=tot_.slice(5);
      if(top5.length){ var cols=ix.map(function(i){ if(i<0) return null; var parts=top5.map(function(x){return Math.max((x.c.all||[])[i]||0,0)}); parts.push(sum(rest5.map(function(x){return Math.max((x.c.all||[])[i]||0,0)}))); return parts; }), mxS=niceCeil(Math.max.apply(null,cols.map(function(p){return p?sum(p):0}).concat([1]))), HH=110, bw2=330/12, sv='<svg viewBox="0 0 350 130" width="100%" role="img" aria-label="Dépenses par poste, mois par mois, sur l\'année '+PRy+'"><line x1="10" x2="340" y1="120" y2="120" stroke="var(--rim-soft)"/>';
        cols.forEach(function(p,n){ var cx=10+bw2*(n+.5), yb=120; if(p){ p.forEach(function(v,k){ var hh=Math.min(v/mxS*HH,HH); if(hh<=0) return; yb-=hh; sv+='<rect x="'+(cx-9).toFixed(1)+'" y="'+yb.toFixed(1)+'" width="18" height="'+Math.max(hh-0.8,0.5).toFixed(1)+'" rx="2" fill="'+PALETTE[k<5?k:7]+'"/>'; }); }
          sv+='<text x="'+cx.toFixed(1)+'" y="130" text-anchor="middle" fill="var(--muted)" font-size="9">'+MOIS_INITIALES[n]+'</text>'; });
        sv+='</svg>';
        h.push(sect('Dépenses par poste · '+PRy,sv+'<div style="display:flex;flex-wrap:wrap;gap:4px 12px;font-size:11.5px" class="muted">'+top5.map(function(x,k){return '<span style="display:inline-flex;align-items:center;gap:5px"><i style="width:9px;height:9px;border-radius:3px;background:'+PALETTE[k]+';display:inline-block"></i>'+esc(x.c.n)+'</span>'}).join('')+(rest5.length?'<span style="display:inline-flex;align-items:center;gap:5px"><i style="width:9px;height:9px;border-radius:3px;background:'+PALETTE[7]+';display:inline-block"></i>Autres</span>':'')+'</div><div class="muted" style="font-size:11.5px">Année choisie dans les filtres (par défaut l\'année en cours). Échelle : '+kfmt(mxS)+' € maximum par mois.</div>'));
      }
    }
    // commerçants et comparaison
    if((D.merchants||[]).length) h.push(sect('Où part votre argent (12 mois)',D.merchants.map(function(m){ return aline(esc(m.n)+'<div class="muted" style="font-size:11.5px">'+m.c+' achat'+(m.c>1?'s':'')+'</div>',eur(m.s)); }).join('')));
    var sa=D.seriesAll||[], ly=prevKey(cur_(),-12), lyS=sa.filter(function(x){return x.k===ly})[0], done=sa.filter(function(x){return x.k<cur_()}).slice(-12), top3=done.slice().sort(function(a,b){return b.dep-a.dep}).slice(0,3);
    if(lyS||top3.length) h.push(sect('Repères dans l\'année',
      (lyS?aline('Dépenses de '+esc(MOIS_L[+ly.slice(5,7)-1])+' '+ly.slice(0,4),eur(lyS.dep))+aline('Projection de ce mois','≈ '+eur(A.proj),A.proj>lyS.dep*1.15?'badt':'')+'':'')+
      (top3.length?'<div class="muted" style="font-size:12px;margin-top:6px">Mois les plus chers sur 12 mois :</div>'+top3.map(function(x){ return aline(esc(MOIS_L[+x.k.slice(5,7)-1])+' '+x.k.slice(0,4),eur(x.dep)); }).join(''):'')));
    // 7. à classer
    if(A.nc>0) h.push(sect('À classer',aline('Opérations non catégorisées ce mois-ci',eur(A.nc))+'<button class="fbtn ghost" data-sub="rules" style="width:100%">Ouvrir les règles</button>',['warn','À classer']));
    h.push('<p class="note">Analyse factuelle de vos propres chiffres, sans conseil financier.</p>');
    return h.join(''); }
  function analyseTeaser(){ var A=analysisData(), n=A.watch.length+A.subsNew.length+A.subsUp.length+(A.land&&A.land.value<300?1:0);
    return '<button class="card" data-sub="analyse" style="width:100%;text-align:left;color:inherit;font-family:inherit;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer"><div style="min-width:0"><div style="font-size:16px;font-weight:600">Analyse du mois</div><div class="muted" style="font-size:12.5px;line-height:1.4;margin-top:2px">'+(n?n+' point'+(n>1?'s':'')+' à regarder · ':'Rien d\'alarmant · ')+eur(A.depNow)+' dépensés à ce jour</div></div><span class="muted" style="font-size:20px">›</span></button>'; }

  /* ---------- règles de catégorisation ---------- */
  function cleanLabel(l){ return String(l||'').replace(/^(CARTE|PRLV|VIR|SEPA|PAIEMENT)\s+/gi,'').replace(/\s+/g,' ').trim(); }
  function uncategorised(){ var seen={}, out=[]; (D.ops||[]).forEach(function(o){ if(o[4]) return; if(!/non\s*cat/i.test(o[2]||'Non catégorisé')&&o[2]) return; var k=o[1]; if(seen[k]) { seen[k].n++; seen[k].sum+=o[3]; return; } seen[k]={l:o[1],n:1,sum:o[3],d:o[0]}; out.push(seen[k]); });
    return out.sort(function(a,b){return Math.abs(b.sum)-Math.abs(a.sum)}).slice(0,15); }
  function rulesScreen(){ var R=S.rule||(S.rule={motif:'',poste:'',nouveau:''}), rules=D.rules||[], names=D.cats.map(function(c){return c.n}), unc=uncategorised(), isNew=R.poste==='__new';
    return '<button class="back" data-act="subclose">'+ico(I.back)+'Plus</button><h1 style="font-size:26px">Règles de catégorisation</h1>'+
    '<div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="muted" style="font-size:13px;line-height:1.45">Quand un libellé contient ce texte, l\'opération est classée dans le poste choisi, pour le passé comme pour le futur.</div>'+
      '<label class="muted" style="font-size:12px" for="rmotif">Texte du libellé</label><input type="text" id="rmotif" value="'+esc(R.motif)+'" placeholder="ex. VIR SEPA NOM PRÉNOM" autocomplete="off" style="'+inputStyle()+'">'+
      '<label class="muted" style="font-size:12px" for="rposte">Poste</label><select id="rposte" style="'+inputStyle()+'"><option value="">Choisir…</option>'+names.map(function(n){return '<option value="'+esc(n)+'"'+(R.poste===n?' selected':'')+'>'+esc(n)+'</option>'}).join('')+'<option value="__new"'+(isNew?' selected':'')+'>Nouveau poste…</option></select>'+
      (isNew?'<input type="text" id="rnew" value="'+esc(R.nouveau)+'" placeholder="Nom du nouveau poste" autocomplete="off" style="'+inputStyle()+'">':'')+
      '<label class="muted" style="font-size:12px" for="rsous">Sous-poste (facultatif)</label><input type="text" id="rsous" value="'+esc(R.sous||'')+'" placeholder="ex. Coiffeur" autocomplete="off" style="'+inputStyle()+'">'+
      '<label class="muted" style="font-size:12px" for="rmont">Montant exact en € (facultatif)</label><input type="text" id="rmont" inputmode="decimal" value="'+esc(R.montant||'')+'" placeholder="ex. 900" autocomplete="off" style="'+inputStyle()+'">'+
      '<button class="fbtn" data-act="rulesave"'+(S.ruleBusy?' disabled':'')+'>'+(S.ruleBusy?'Enregistrement…':'Ajouter la règle')+'</button>'+(S.ruleErr?'<div class="badt" style="font-size:12px">'+esc(S.ruleErr)+'</div>':'')+'</div>'+
    '<div class="card" style="display:flex;flex-direction:column;gap:8px"><button class="fbtn ghost" data-act="rimptoggle">'+(S.rimp?'Fermer l\'import':'Importer une liste de règles')+'</button>'+(S.rimp?'<div class="muted" style="font-size:12px;line-height:1.45">Une règle par ligne : <b>texte ; poste ; sous-poste ; montant</b> (sous-poste et montant facultatifs).</div><textarea id="rimp" rows="8" placeholder="NOM DU COMMERCE ; Vie quotidienne ; Alimentation" style="'+inputStyle()+';padding:10px;min-height:120px">'+esc(S.rimpText||'')+'</textarea><button class="fbtn" data-act="rimport"'+(S.ruleBusy?' disabled':'')+'>Importer</button>':'')+'</div>'+
    '<div class="card" style="padding:12px 16px"><div style="font-weight:600;font-size:14px">'+((D.fileRules||[]).length?D.fileRules.length+' règles lues dans le fichier Banque-regles.txt de votre Drive':(D.fileRulesInfo==='absent'?'Fichier Banque-regles.txt introuvable dans votre Drive':D.fileRulesInfo&&D.fileRulesInfo!=='ok'?'Lecture du fichier de règles impossible':(D.fileRulesInfo==='ok'?'Fichier de règles vide':'Fichier de règles : actualisez l\'appli pour le lire')))+'</div><div class="muted" style="font-size:12px;line-height:1.4;margin-top:4px">'+(D.fileRulesInfo&&D.fileRulesInfo!=='ok'&&D.fileRulesInfo!=='absent'?esc(D.fileRulesInfo)+'. ':'')+'Les règles du fichier s\'appliquent automatiquement. Les règles ci-dessous (créées dans l\'appli) priment sur celles du fichier.</div></div>'+
    (rules.length?'<h3 style="font-size:16px">Vos règles</h3><div class="card" style="padding:4px 14px">'+rules.map(function(r,i){ return '<div class="opline"><div class="l"><span style="font-weight:600;font-size:14px">'+esc(r.motif)+(r.montant?' · '+esc(r.montant)+' €':'')+'</span><span class="muted" style="font-size:12px">→ '+esc(r.poste)+(r.sous?' › '+esc(r.sous):'')+'</span></div><button class="iconbtn" data-rdel="'+i+'" aria-label="Supprimer la règle" style="width:36px;height:36px">'+ico(I.close)+'</button></div>'; }).join('')+'</div>':'')+
    (unc.length?'<h3 style="font-size:16px">À classer</h3><div class="card" style="padding:4px 14px">'+unc.map(function(u,i){ return '<button class="opline" data-rpick="'+i+'" style="width:100%;border:0;background:transparent;text-align:left;color:inherit;font-family:inherit;border-bottom:1px solid var(--rim-soft);cursor:pointer"><div class="l"><span style="font-weight:600;font-size:14px">'+esc(u.l)+'</span><span class="muted" style="font-size:12px">'+u.n+' opération'+(u.n>1?'s':'')+' · dernière le '+esc(fmtDate(u.d))+'</span></div><span style="font-weight:600">'+eur(u.sum)+'</span></button>'; }).join('')+'</div><p class="note">Appuyez sur une opération pour préparer la règle.</p>':'');
  }
  function inputStyle(){ return 'min-height:44px;border-radius:14px;border:1px solid var(--rim-soft);background:var(--glass);color:var(--text);font-size:16px;padding:0 12px;font-family:inherit;width:100%;box-sizing:border-box'; }
  function authed(fn,args){ return API.signIn(true).then(function(){ return run(fn,args); }); }

  /* ---------- abonnements ---------- */
  function subLine(x){ return '<div class="opline"><div class="l"><span style="font-weight:600;font-size:14px">'+esc(x.n)+'</span><span class="muted" style="font-size:12px">'+(x.active?'Prochain vers le '+esc(fmtDate(x.next)):'Dernier le '+esc(fmtDate(x.last)))+' · '+esc(x.par)+'</span>'+
      (x.hausse?'<span class="badge warn" style="align-self:flex-start;margin-top:4px">Hausse : '+eur(x.hausse.from,true)+' → '+eur(x.hausse.to,true)+'</span>':'')+(x.par==='Non catégorisé'?'<button class="badge warn" data-rpickn="'+esc(x.n)+'" style="align-self:flex-start;margin-top:4px;border:0;cursor:pointer">À classer</button>':'')+(x.nouveau&&!x.hausse?'<span class="badge ok" style="align-self:flex-start;margin-top:4px">Nouveau</span>':'')+'</div><span style="font-weight:600">'+eur(x.amt,true)+'</span></div>'; }
  function subsScreen(){ var B=D.subs||{list:[],total:0,count:0}, act=B.list.filter(function(x){return x.active}), off=B.list.filter(function(x){return !x.active}), watch=act.filter(function(x){return x.hausse||x.nouveau});
    return header()+'<h1 style="font-size:26px">Abonnements</h1>'+
    '<div class="card"><div class="muted" style="font-size:13px">Prélèvements récurrents actifs</div><div style="font-size:32px;font-weight:600;letter-spacing:-.02em">'+eur(B.total)+' <span class="muted" style="font-size:14px;font-weight:500">par mois</span></div><div class="muted" style="font-size:13px;margin-top:2px">'+B.count+' abonnement'+(B.count>1?'s':'')+' · environ '+eur(B.total*12)+' par an</div></div>'+
    (watch.length?'<h3 style="font-size:16px">À surveiller</h3><div class="card" style="padding:4px 14px">'+watch.map(subLine).join('')+'</div>':'')+
    '<h3 style="font-size:16px">'+(watch.length?'Autres abonnements actifs':'Actifs')+'</h3><div class="card" style="padding:4px 14px">'+(act.length-watch.length?act.filter(function(x){return !(x.hausse||x.nouveau)}).map(subLine).join(''):'<p class="muted" style="padding:16px 0">Aucun prélèvement récurrent repéré.</p>')+'</div>'+
    (off.length?'<h3 style="font-size:16px">Arrêtés ou à vérifier</h3><div class="card" style="padding:4px 14px">'+off.map(subLine).join('')+'</div>':'')+
    '<p class="note">Repérés automatiquement : au moins 3 prélèvements d\'un montant stable, environ un par mois. Un loyer ou un crédit peut y figurer.</p>'; }

  /* ---------- budgets ---------- */
  function budInfo(c){ var set=D.budgets&&D.budgets[c.n], cap=set||Math.max(Math.round(c.avg),1), p=c.spent/cap, proj=DAY>=5?c.spent/ELAPSED:c.spent, k, t;
    if(c.spent>cap){ k='bad'; t='Dépassé'; } else if(proj>cap*1.1&&c.spent-cap*ELAPSED>MIN_EUR){ k='warn'; t='Rythme élevé'; } else { k='ok'; t='Dans le budget'; }
    return {c:c,cap:cap,set:!!set,p:p,k:k,t:t,left:cap-c.spent}; }
  function budScreen(){ return onCurrentMonth(budScreenRaw); }
  function budScreenRaw(){ var items=CATS.filter(function(c){return c.spent>0||c.avg>10}).map(budInfo).sort(function(a,b){return b.c.spent-a.c.spent});
    var tc=items.reduce(function(a,x){return a+x.cap},0), ts=items.reduce(function(a,x){return a+x.c.spent},0);
    return header()+'<h1 style="font-size:26px">Budgets</h1>'+
    '<div class="card"><div class="muted" style="font-size:13px">Dépensé ce mois-ci</div><div style="font-size:32px;font-weight:600;letter-spacing:-.02em">'+eur(ts)+' <span class="muted" style="font-size:14px;font-weight:500">sur '+eur(tc)+'</span></div><div class="muted" style="font-size:13px;margin-top:2px">Jour '+DAY+' sur '+DAYS+'</div></div>'+
    items.map(function(x){ var ed=S.bud===x.c.id;
      return '<div class="card" style="display:flex;flex-direction:column;gap:10px;padding:14px 16px"><button class="budhead" data-bud="'+esc(x.c.id)+'" aria-expanded="'+ed+'" style="display:flex;justify-content:space-between;align-items:center;gap:10px;border:0;background:transparent;text-align:left;padding:0;min-height:36px"><span style="font-weight:600;font-size:15px">'+esc(x.c.n)+'</span><span class="badge '+x.k+'">'+x.t+'</span></button>'+
      '<div class="bar" role="img" aria-label="'+Math.round(x.p*100)+' % du plafond dépensés"><i class="'+x.k+'" data-w="'+Math.min(x.p,1)*100+'"></i><b style="left:'+Math.min(ELAPSED,1)*100+'%"></b></div>'+
      '<div class="row" style="font-size:13px"><span><b>'+eur(x.c.spent)+'</b> <span class="muted">sur '+eur(x.cap)+(x.set?'':' (moyenne)')+'</span></span><span class="'+(x.left<0?'badt':'muted')+'">'+(x.left<0?'+'+eur(-x.left)+' au-dessus':eur(x.left)+' restants')+'</span></div>'+
      (ed?'<div style="display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--rim-soft);padding-top:10px"><label class="muted" style="font-size:12px" for="budin">Plafond mensuel (€)</label><input type="number" id="budin" inputmode="numeric" min="0" step="10" value="'+x.cap+'" style="min-height:44px;border-radius:14px;border:1px solid var(--rim-soft);background:var(--glass);color:var(--text);font-size:16px;padding:0 12px;font-family:inherit"><div style="display:flex;gap:8px"><button class="fbtn" style="flex:1;min-width:0" data-act="budsave" data-p="'+esc(x.c.n)+'">'+(S.budBusy?'Enregistrement…':'Enregistrer')+'</button><button class="fbtn ghost" style="flex:1;min-width:0" data-act="budreset" data-p="'+esc(x.c.n)+'">Moyenne</button></div></div>':'')+'</div>'; }).join('')+
    '<p class="note">Sans plafond, le budget d\'un poste est sa moyenne sur '+S.f.moy+' mois. Appuyez sur un poste pour fixer votre plafond. Il est enregistré dans votre Sheet.</p>'; }

  /* ---------- bilan annuel ---------- */
  function bilanScreen(){ var B=D.bilan||{}, c=B.cur, p=B.prev;
    function delta(a,b,goodUp){ if(!b) return '<span class="muted">—</span>'; var d=(a-b)/b*100, up=d>=0, good=goodUp?up:!up; return '<span class="'+(Math.abs(d)<2?'muted':good?'okt':'badt')+'">'+(up?'+':'−')+Math.abs(Math.round(d))+' %</span>'; }
    function row(l,a,b,goodUp){ return '<div class="pair" style="grid-template-columns:1fr 78px 78px 52px;padding:9px 0;border-bottom:1px solid var(--rim-soft);font-size:13px"><span>'+l+'</span><span style="text-align:right;font-weight:600">'+eur(a)+'</span><span class="muted" style="text-align:right">'+eur(b)+'</span><span style="text-align:right">'+delta(a,b,goodUp)+'</span></div>'; }
    var cs=c?c.yRev-c.yDep:0, ps=p?p.yRev-p.yDep:0, top=c&&c.top.length?c.top:[];
    return '<button class="back" data-act="subclose">'+ico(I.back)+'Plus</button><h1 style="font-size:26px">Bilan '+(c?c.y:'')+'</h1>'+
    (c?'<div class="card"><div class="muted" style="font-size:12px;margin-bottom:6px">Du 1er janvier au '+esc(fmtDate(D.today.iso))+', '+(p?'comparé à la même période en '+p.y:'')+'</div><div class="pair muted" style="grid-template-columns:1fr 78px 78px 52px;font-size:11px"><span></span><span style="text-align:right">'+c.y+'</span><span style="text-align:right">'+(p?p.y:'')+'</span><span style="text-align:right">Écart</span></div>'+
      row('Revenus',c.yRev,p?p.yRev:0,true)+row('Dépenses',c.yDep,p?p.yDep:0,false)+row('Épargne (revenus − dépenses)',cs,ps,true)+row('Impôts payés',c.yTax,p?p.yTax:0,false)+'</div>'+
      (p?'<div class="card"><div class="muted" style="font-size:13px">Année '+p.y+' complète</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px"><div><div class="muted" style="font-size:12px">Revenus</div><b>'+eur(p.rev)+'</b></div><div><div class="muted" style="font-size:12px">Dépenses</div><b>'+eur(p.dep)+'</b></div><div><div class="muted" style="font-size:12px">Épargne</div><b>'+eur(p.rev-p.dep)+'</b></div><div><div class="muted" style="font-size:12px">Impôts payés</div><b>'+eur(p.tax)+'</b></div></div></div>':'')+
      (top.length?'<h3 style="font-size:16px">Plus gros postes de '+c.y+'</h3><div class="card" style="padding:4px 16px">'+top.map(function(t){ return '<div class="switch"><span>'+esc(t[0])+'</span><b>'+eur(t[1])+'</b></div>'; }).join('')+'</div>':'')
      :'<div class="card muted">Pas encore d\'opérations pour cette année.</div>')+
    '<p class="note">Les mouvements entre vos comptes sont exclus. L\'épargne est la différence entre revenus et dépenses de la période.</p>'; }

  var TABS=[['home','Accueil',I.home],['subs','Abonnements',I.repeat],['bud','Budgets',I.pie],['ops','Opérations',I.list],['plus','Plus',I.more]];
  function gateCard(title,msg,btn,act,extra){ return '<div class="card" style="margin-top:60px;text-align:center;padding:30px 18px;display:flex;flex-direction:column;gap:12px;align-items:center"><div style="font-size:20px;font-weight:600">'+title+'</div><div class="muted" style="font-size:13px;line-height:1.5">'+msg+'</div>'+(btn?'<button class="fbtn" data-act="'+act+'" style="width:100%">'+btn+'</button>':'')+(extra||'')+'</div>'; }
  function screen(){
    if(S.stage==='lock') return gateCard('Banque verrouillée','Utilisez votre empreinte (ou le code du téléphone) pour ouvrir l\'application.','Déverrouiller','unlock');
    if(S.stage==='signin') return gateCard('Connexion à Google','Connectez-vous avec le compte Google qui possède votre dossier d\'export. L\'application lit votre Drive en lecture seule et écrit uniquement dans votre Sheet.','Se connecter avec Google','signin',S.error?'<div class="badt" style="font-size:12px">'+esc(S.error)+'</div>':'');
    if(S.loading) return '<div class="card" style="margin-top:40px;text-align:center;padding:28px 16px"><div style="font-size:16px;font-weight:600">Lecture de votre export…</div><div class="muted" style="font-size:13px;margin-top:6px">Le premier chargement peut prendre quelques secondes.</div></div>';
    if(S.error) return '<div class="card" style="margin-top:30px"><h2 style="font-size:18px">Impossible d\'afficher vos données</h2><p class="muted" style="font-size:13px;line-height:1.45;margin:8px 0 14px">'+esc(S.error)+'</p><button class="fbtn" data-act="retry">Réessayer</button></div>';
    if(S.tab==='alerts') return alertsScreen();
    if(S.tab==='ops') return opsScreen();
    if(S.tab==='subs') return subsScreen();
    if(S.tab==='bud') return budScreen();
    if(S.tab==='plus') return S.sub==='bilan'?bilanScreen():S.sub==='rules'?rulesScreen():S.sub==='analyse'?analyseScreen():plusScreen();
    return S.open? detailScreen() : homeScreen();
  }
  function render(){
    if(D) CATS=buildCats();
    app.innerHTML='<div class="orbs" aria-hidden="true"><i class="o1"></i><i class="o2"></i><i class="o3"></i></div><div class="screen fade" id="screen">'+screen()+'</div>'+(S.stage==='ready'?'<nav class="nav" aria-label="Navigation principale">'+TABS.map(function(x){return '<button data-tab="'+x[0]+'"'+(x[0]===S.tab?' aria-current="page"':'')+'>'+ico(x[2])+x[1]+'</button>'}).join('')+'</nav>':'');
    requestAnimationFrame(function(){requestAnimationFrame(function(){ app.querySelectorAll('.bar i,.strack i').forEach(function(el){el.style.width=el.dataset.w+'%'}); }); });
    var b=document.getElementById('bal'); if(b&&D&&!reduce&&!S.hide&&S.first){ var t0=performance.now(); (function tick(n){var k=Math.min((n-t0)/900,1),e=1-Math.pow(1-k,3);b.textContent=eur(D.solde*e);if(k<1)requestAnimationFrame(tick)})(t0); }
    if(D) S.first=false;
    paintPanel();
  }

  /* ---------- panneau de filtres (latéral) ---------- */
  function paintPanel(){ var el=document.getElementById('fpanel'); if(!S.fopen||!D){ el.innerHTML=''; return; }
    var f=S.f, old=el.querySelector('.fbody'), top=old?old.scrollTop:0, anim=S.fanim; S.fanim=false;
    var P_=per(), curK=D.today.month, years=[], seen={};
    (D.keys||[]).forEach(function(k){ var y=k.slice(0,4); if(!seen[y]){ seen[y]=1; years.push(y); } }); years.sort().reverse();
    function opt(v,l,sel){ return '<option value="'+esc(v)+'"'+(sel?' selected':'')+'>'+esc(l)+'</option>'; }
    function seg(k,list){ return '<div class="fseg" role="group">'+list.map(function(p){ return '<button data-f="'+k+'" data-v="'+esc(p[0])+'" aria-pressed="'+(f[k]===p[0])+'">'+esc(p[1])+'</button>'; }).join('')+'</div>'; }
    function sec(t,b){ return '<div class="fsec"><h3>'+t+'</h3>'+b+'</div>'; }
    var cats=D.cats.slice().sort(function(a,b){return a.n.localeCompare(b.n,'fr')}), pc=f.poste?cats.filter(function(c){return c.id===f.poste})[0]:null;
    var months=[opt('all','Toute l\'année',P_.isYear)].concat(MOIS_L.map(function(n,i){ var v=(i<9?'0':'')+(i+1); return opt(v,n.charAt(0).toUpperCase()+n.slice(1),!P_.isYear&&P_.mo===v); }));
    var body=sec('Période','<div class="frow2"><label class="fsel"><span>Année</span><select data-fsel="year" aria-label="Année">'+years.map(function(y){return opt(y,y,P_.y===y)}).join('')+'</select></label><label class="fsel"><span>Mois</span><select data-fsel="month" aria-label="Mois">'+months.join('')+'</select></label></div>')+
      sec('Graphique',seg('graph',[['solde','Solde'],['dep','Dépenses'],['rev','Revenus']]))+
      sec('Poste et sous-poste','<label class="fsel"><span>Poste</span><select data-fsel="poste" aria-label="Poste">'+opt('','Tous les postes',!f.poste)+cats.map(function(c){return opt(c.id,c.n,f.poste===c.id)}).join('')+'</select></label>'+
        '<label class="fsel" style="margin-top:8px"><span>Sous-poste</span><select data-fsel="sous" aria-label="Sous-poste"'+(pc?'':' disabled')+'>'+opt('',pc?'Tous les sous-postes':'Choisir d\'abord un poste',!f.sous)+(pc?pc.subs.map(function(s){return opt(s.n,s.n,f.sous===s.n)}).join(''):'')+'</select></label>')+
      sec('Moyenne calculée sur',seg('moy',[['3','3 mois'],['6','6 mois'],['12','12 mois']]))+
      sec('Dépenses exceptionnelles dans la moyenne',seg('exc',[['excl','Exclues'],['incl','Incluses']])+'<p class="muted" style="font-size:11.5px;line-height:1.4;margin-top:8px">Une dépense exceptionnelle est un paiement ponctuel de 500 € ou plus (hors abonnements et prélèvements récurrents).</p>');
    el.innerHTML='<div class="fwrap"><div class="scrim" data-fc="close"></div><div class="fin"><section class="fpanel fpB'+(anim?' anim':'')+'" role="dialog" aria-modal="true" aria-label="Filtres">'+
      '<div class="fhead"><h2>Filtres'+(fcount()?' <span class="muted" style="font-weight:500;font-size:14px">· '+fcount()+' actif'+(fcount()>1?'s':'')+'</span>':'')+'</h2><button class="iconbtn" data-fc="close" aria-label="Fermer les filtres">'+ico(I.close)+'</button></div><div class="fbody">'+body+'</div>'+
      '<div class="ffoot"><button class="fbtn ghost" data-fc="reset">Réinitialiser</button><button class="fbtn" data-fc="close">Afficher</button></div></section></div></div>';
    var nb=el.querySelector('.fbody'); if(nb) nb.scrollTop=top; if(anim){ var c=el.querySelector('[data-fc="close"].iconbtn'); if(c) c.focus(); } }
  var fp=document.getElementById('fpanel');
  fp.addEventListener('click',function(e){ var b=e.target.closest('[data-fc],[data-f]'); if(!b) return;
    if(b.dataset.fc==='close'){ S.fopen=false; paintPanel(); return; }
    if(b.dataset.fc==='reset'){ S.f=fcopy(); render(); return; }
    S.f[b.dataset.f]=b.dataset.v; render(); });
  fp.addEventListener('change',function(e){ var k=e.target.dataset&&e.target.dataset.fsel; if(!k) return;
    var v=e.target.value, curY=D.today.month.slice(0,4), curM=D.today.month.slice(5,7);
    if(k==='year'){ S.f.year=v===curY?'':v; }
    else if(k==='month'){ S.f.month=v===curM?'':v; }
    else if(k==='poste'){ S.f.poste=v; S.f.sous=''; }
    else if(k==='sous'){ S.f.sous=v; }
    render(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&S.fopen){ S.fopen=false; paintPanel(); } });

  /* ---------- interactions ---------- */
  app.addEventListener('click',function(e){
    var el=e.target.closest('[data-per],[data-tab],[data-open],[data-act],[data-view],[data-sub],[data-bud],[data-aopen],[data-atab],[data-rdel],[data-rpick],[data-rpickn],[data-bar],[data-pv],[data-cal]'); if(!el||el.disabled) return;
    if(el.dataset.per){S.per=el.dataset.per;savePrefs();render()}
    else if(el.dataset.view){S.view=el.dataset.view;savePrefs();render()}
    else if(el.dataset.tab){S.tab=el.dataset.tab;S.open=null;S.sub=null;S.bud=null;render();window.scrollTo(0,0)}
    else if(el.dataset.rpick!==undefined){ var u=uncategorised()[+el.dataset.rpick]; S.rule={motif:cleanLabel(u.l),poste:'',nouveau:''}; S.ruleErr=null; render(); window.scrollTo(0,0) }
    else if(el.dataset.rpickn!==undefined){ S.tab='plus'; S.sub='rules'; S.rule={motif:cleanLabel(el.dataset.rpickn),poste:'',nouveau:''}; S.ruleErr=null; render(); window.scrollTo(0,0) }
    else if(el.dataset.rdel!==undefined){ var nl=(D.rules||[]).filter(function(_,i){return i!==+el.dataset.rdel}); S.ruleBusy=true; render(); authed('saveRules',[nl]).then(function(){ S.ruleBusy=false; return load(true); }).catch(function(err){ S.ruleBusy=false; S.ruleErr=errMsg(err); render(); }) }
    else if(el.dataset.act==='rimptoggle'){ S.rimp=!S.rimp; render() }
    else if(el.dataset.act==='rimport'){ var ta=document.getElementById('rimp'), txt=ta?ta.value:''; S.rimpText=txt; var add=[];
      txt.split(/\r?\n/).forEach(function(line){ line=line.trim(); if(!line||line[0]==='#') return; var p=line.split(/\s*[;|\t]\s*/); if(p.length<2||!p[0]||!p[1]) return; add.push({motif:p[0],poste:p[1],sous:p[2]||'',montant:p[3]?String(p[3]).replace(',','.').replace(/[^0-9.]/g,''):''}); });
      if(!add.length){ S.ruleErr='Aucune ligne valide (texte ; poste).'; render(); return; }
      var cur=(D.rules||[]).filter(function(r){ return !add.some(function(n){ return n.motif.toLowerCase()===r.motif.toLowerCase()&&String(n.montant)===String(r.montant||''); }); });
      S.ruleBusy=true; S.ruleErr=null; render(); authed('saveRules',[cur.concat(add)]).then(function(){ S.ruleBusy=false; S.rimp=false; S.rimpText=''; return load(true); }).catch(function(err){ S.ruleBusy=false; S.ruleErr=errMsg(err); render(); }) }
    else if(el.dataset.act==='rulesave'){ var R=S.rule||{}, poste=R.poste==='__new'?String(R.nouveau||'').trim():R.poste, motif=String(R.motif||'').trim();
      if(!motif||!poste){ S.ruleErr='Indiquez le texte du libellé et le poste.'; render(); return; }
      S.ruleBusy=true; S.ruleErr=null; render(); authed('saveRules',[(D.rules||[]).concat([{motif:motif,poste:poste,sous:String(R.sous||'').trim(),montant:String(R.montant||'').replace(',','.').replace(/[^0-9.]/g,'')}])]).then(function(){ S.ruleBusy=false; S.rule={motif:'',poste:'',nouveau:'',sous:'',montant:''}; return load(true); }).catch(function(err){ S.ruleBusy=false; S.ruleErr=errMsg(err); render(); }) }
    else if(el.dataset.cal){S.calDay=S.calDay===el.dataset.cal?'':el.dataset.cal;render()}
    else if(el.dataset.bar){ var bk=el.dataset.bar, ck=D.today.month; S.f.year=bk.slice(0,4)===ck.slice(0,4)?'':bk.slice(0,4); S.f.month=bk===ck?'':bk.slice(5,7); render(); }
    else if(el.dataset.aopen){S.tab='home';S.open=el.dataset.aopen;render();window.scrollTo(0,0)}
    else if(el.dataset.atab){S.tab=el.dataset.atab;S.open=null;render();window.scrollTo(0,0)}
    else if(el.dataset.act==='forceupdate'){ var jobs=[]; if(navigator.serviceWorker) jobs.push(navigator.serviceWorker.getRegistrations().then(function(rs){ return Promise.all(rs.map(function(r){return r.unregister()})); })); if(window.caches) jobs.push(caches.keys().then(function(ks){ return Promise.all(ks.map(function(k){return caches.delete(k)})); })); Promise.all(jobs).then(function(){ location.reload(); }); }
    else if(el.dataset.act==='marginup'){S.margin=Math.min((S.margin||0)+100,5000);savePrefs();render()}
    else if(el.dataset.act==='margindn'){S.margin=Math.max((S.margin||0)-100,0);savePrefs();render()}
    else if(el.dataset.act==='heatprev'){S.heat=(S.heat||0)-1;render()}
    else if(el.dataset.act==='heatnext'){S.heat=Math.min((S.heat||0)+1,0);render()}
    else if(el.dataset.act==='clearposte'){S.f.poste='';S.f.sous='';render()}
    else if(el.dataset.act==='alerts'){S.tab='alerts';S.open=null;render();window.scrollTo(0,0)}
    else if(el.dataset.act==='alertsclose'){S.tab='home';render();window.scrollTo(0,0)}
    else if(el.dataset.act==='landtoggle'){S.landOpen=!S.landOpen;render()}
    else if(el.dataset.sub){S.sub=el.dataset.sub;render();window.scrollTo(0,0)}
    else if(el.dataset.bud){S.bud=S.bud===el.dataset.bud?null:el.dataset.bud;render()}
    else if(el.dataset.act==='subclose'){S.sub=null;render();window.scrollTo(0,0)}
    else if(el.dataset.act==='budsave'||el.dataset.act==='budreset'){ var inp=document.getElementById('budin'), v=el.dataset.act==='budreset'?0:Math.round(+(inp&&inp.value)); if(!(v>=0)) return; S.budBusy=true; render();
      authed('saveBudget',[el.dataset.p,v]).then(function(b){ D.budgets=b; S.budBusy=false; S.bud=null; render(); }).catch(function(err){ S.budBusy=false; S.error=errMsg(err); render(); }); }
    else if(el.dataset.open){S.open=el.dataset.open;render();window.scrollTo(0,0)}
    else if(el.dataset.act==='fopen'){S.fopen=true;S.fanim=true;paintPanel()}
    else if(el.dataset.act==='hide'){S.hide=!S.hide;savePrefs();render()}
    else if(el.dataset.act==='allpostes'){S.all=!S.all;render()}
    else if(el.dataset.act==='close'){S.open=null;render();window.scrollTo(0,0)}
    else if(el.dataset.act==='theme'){S.theme=S.theme==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',S.theme);savePrefs();render()}
    else if(el.dataset.act==='retry'){S.error=null;API.signIn(true).then(function(){S.stage='ready';load()}).catch(function(err){S.error=errMsg(err);render()})}
    else if(el.dataset.act==='unlock'){doUnlock()}
    else if(el.dataset.act==='refresh'){refresh(true)}
    else if(el.dataset.act==='signin'){S.error=null;API.signIn(true).then(function(){S.stage='ready';load()}).catch(function(err){S.error=errMsg(err);render()})}
    else if(el.dataset.act==='lock'){ if(Lock.enabled()){Lock.disable();render()} else Lock.enable().then(render).catch(function(err){S.error=errMsg(err);render()}) }
    else if(el.dataset.act==='signout'){API.signOut();Lock.disable();D=null;S.stage='signin';S.error=null;render();window.scrollTo(0,0)}
    else if(el.dataset.act==='sync'){S.syncing=true;render();run('forceSync').then(function(){S.syncing=false;return load(true)}).catch(function(err){S.syncing=false;S.error=errMsg(err);render()})}
  });
  app.addEventListener('change',function(e){ if(e.target.id==='rposte'){ (S.rule=S.rule||{}).poste=e.target.value; render(); } });
  app.addEventListener('input',function(e){ if(e.target.id==='rmotif'){ (S.rule=S.rule||{}).motif=e.target.value; return; } if(e.target.id==='rnew'){ (S.rule=S.rule||{}).nouveau=e.target.value; return; } if(e.target.id==='rsous'){ (S.rule=S.rule||{}).sous=e.target.value; return; } if(e.target.id==='rmont'){ (S.rule=S.rule||{}).montant=e.target.value; return; } if(e.target.id==='q'){S.q=e.target.value;var q=S.q.toLowerCase(),r=D.ops.filter(function(o){return !q||(o[1]+' '+o[2]).toLowerCase().indexOf(q)>-1});document.getElementById('oplist').innerHTML=opsHtml(r,r.slice(0,150))} });

  /* ---------- chargement ---------- */
  function errMsg(e){ return (e&&e.message)?e.message:String(e); }
  function run(fn,args){ return API[fn].apply(null,args||[]); }
  function load(keep){ if(!keep){ S.loading=true; S.error=null; render(); }
    return run('getDashboard').then(function(d){ setData(d); S.loading=false; S.error=null; S.stale=false; render(); }).catch(function(err){ S.loading=false; if(D){ S.stale=true; S.refreshErr=errMsg(err); } else if(err&&err.status===401){ S.stage='signin'; S.error=null; } else S.error=errMsg(err); render(); }); }
  function withTimeout(p,ms){ return new Promise(function(res,rej){ var t=setTimeout(function(){rej(new Error('délai dépassé'))},ms); p.then(function(v){clearTimeout(t);res(v)},function(e){clearTimeout(t);rej(e)}); }); }
  function refresh(interactive){ return withTimeout(API.signIn(interactive),interactive?120000:8000).then(function(){ S.refreshErr=null; return load(true); }).catch(function(e){ S.stale=true; S.refreshErr=interactive?errMsg(e):null; render(); }); }
  function openApp(){ var c=API.cached();
    if(c){ setData(c); S.stage='ready'; S.loading=false; S.error=null; S.stale=true; render(); return refresh(false); }
    return enter(); }
  function enter(){ S.stage='ready'; S.loading=true; render();
    return API.signIn(false).then(function(){ return load(true); }).catch(function(){ S.loading=false; S.stage='signin'; render(); }); }
  function doUnlock(){ if(S.lockBusy) return; S.lockBusy=true;
    Lock.unlock().then(function(){ S.lockBusy=false; S.lockOk=true; openApp(); }).catch(function(){ S.lockBusy=false; S.stage='lock'; render(); }); }
  function boot(){
    S.error=null; S.lockOk=false;
    Lock.supported().then(function(ok){ S.lockAvail=ok; });
    if(Lock.enabled()){ S.stage='lock'; render(); doUnlock(); }
    else if(API.wasSigned()){ openApp(); }
    else { S.stage='signin'; S.loading=false; render(); }
  }
  /* reverrouillage après 60 s en arrière-plan */
  var hiddenAt=0;
  document.addEventListener('visibilitychange',function(){
    if(document.hidden){ hiddenAt=Date.now(); }
    else if(hiddenAt&&Lock.enabled()&&Date.now()-hiddenAt>60000&&S.stage==='ready'){ S.stage='lock'; S.fopen=false; render(); doUnlock(); }
  });
  if('serviceWorker' in navigator){ var hadCtl=!!navigator.serviceWorker.controller, reloaded=false;
    navigator.serviceWorker.addEventListener('controllerchange',function(){ if(!hadCtl||reloaded) return; reloaded=true; location.reload(); });
    navigator.serviceWorker.register('sw.js').then(function(r){ if(r&&r.update) r.update(); }).catch(function(){}); }
  boot();
})();
