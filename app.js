(function(){
  'use strict';
  var TOL=0.15, MIN_EUR=20, D=null, DAY=1, DAYS=30, ELAPSED=0, CATS=[];
  var S={lvl:'poste',alertOff:{},margin:500,tab:'home',open:null,hide:false,q:'',view:'depenses',per:'mois',theme:'light',stage:'boot',loading:true,error:null,lockOk:false,lockBusy:false,syncing:false,fopen:false,fanim:false,first:true,all:false};
  function fcopy(){ return {graph:'solde',year:'',month:'',poste:'',sous:'',moy:'12',exc:'excl'}; }
  S.f=fcopy();
  try{ var pr=JSON.parse(localStorage.getItem('banque-prefs')||'{}'); if(pr.theme) S.theme=pr.theme; if(pr.view3) S.view=pr.view3; if(pr.margin!=null) S.margin=+pr.margin; }catch(e){}
  function savePrefs(){ try{ localStorage.setItem('banque-prefs',JSON.stringify({theme:S.theme,hide:S.hide,view3:S.view,margin:S.margin})); }catch(e){} }
  document.documentElement.setAttribute('data-theme',S.theme);
  var app=document.getElementById('app');
  app.addEventListener('scroll',function(e){ var h=e.target; if(h&&h.classList&&h.classList.contains('hscroll')){ S.hsKey=h.dataset.hs; S.hsPos=h.scrollLeft; } },true);
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MOIS=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];

  function eur(v,d){ if(S.hide) return '••••'; return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:d?2:0,maximumFractionDigits:d?2:0}).format(v); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]}); }
  function fmtDate(iso){ if(!iso) return ''; var p=iso.split('-'); return +p[2]+' '+MOIS[+p[1]-1]; }
  function daysBetween(a,b){ var x=a.split('-'),y=b.split('-'); return Math.round((Date.UTC(+y[0],+y[1]-1,+y[2])-Date.UTC(+x[0],+x[1]-1,+x[2]))/864e5); }
  function ico(p){ return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>'; }
  var I={moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',sync:'<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',home:'<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',more:'<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',eyeoff:'<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6C3.7 8.3 2 12 2 12s3.6 7 10 7a10 10 0 0 0 4.4-1"/>',back:'<path d="M15 18l-6-6 6-6"/>',filter:'<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',close:'<path d="M6 6l12 12M18 6L6 18"/>',bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',repeat:'<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',pie:'<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6.4 6.4"/>',chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'};

  /* ---------- données ---------- */
  function avgOf(h,k){ var a=h.slice(-k); return a.length? a.reduce(function(s,v){return s+v},0)/a.length : 0; }
  var MOIS_INITIALES=['J','F','M','A','M','J','J','A','S','O','N','D'];
  var MOIS_C=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
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
    function declared(poste,sous){ if(P_.isYear) return 0; var f=(D.fixes||[]).filter(function(x){return x.poste===poste&&(x.sous||'')===(sous||'')})[0]; return f?f.montant:0; }
    /* poste fixe : (1) même montant (écart <= 8 %) sur les 3 mois précédents, ou (2) au moins 4 des 6 mois précédents au même montant (à 5 % près).
       Renvoie ce montant, 0 sinon. */
    function fixedLevel(all){ if(!all||P_.isYear||!P_.idxs.length) return 0;
      var p3=all.slice(Math.max(0,first-3),first);
      if(p3.length>=3){ var mn=Math.min.apply(null,p3), mx=Math.max.apply(null,p3), mean=sum(p3)/p3.length; if(mn>0&&mean>0&&(mx-mn)/mean<=0.08) return mean; }
      var p6=all.slice(Math.max(0,first-6),first); if(p6.length<6) return 0;
      var best=0, lvl=0; p6.forEach(function(v){ if(v<=0) return; var same=p6.filter(function(x){return Math.abs(x-v)<=v*0.05}); if(same.length>best){ best=same.length; lvl=sum(same)/same.length; } });
      return best>=4? lvl : 0; }
    function calc(all,hist,spentNow,exc){
      if(!all||!P_.idxs.length) return {spent:spentNow,avg:Math.max(avgOf(hist,k),1),avgm:avgOf(hist,k)};
      var spent=sum(P_.idxs.map(function(i){return all[i]||0})), pos=function(v){return Math.max(v,0)}, lo=Math.max(0,first-k), net=function(v,i){return pos(v-(exc?(exc[i]||0):0))}, prior=all.slice(lo,first).map(function(v,i){return net(v,lo+i)}), am=prior.length? sum(prior)/prior.length : sum(all.map(net))/Math.max(all.length,1);
      return {spent:spent,avg:Math.max(am*monthsN,1),avgm:Math.max(am,0)}; }
    return D.cats.map(function(c){ var r=calc(c.all,c.hist,c.spent,S.f.exc!=='incl'?c.exc:null);
      return {id:c.id,n:c.n,spent:r.spent,avg:r.avg,ops:c.ops,all:c.all,td:c.td,upc:c.upc||0,avgm:r.avgm,fixed:declared(c.n,'')||fixedLevel(c.all),
      subs:c.subs.map(function(s,i){ var q=calc(s.all,s.hist,s.spent,S.f.exc!=='incl'?s.exc:null); return {id:c.id+'-'+i,pid:c.id,par:c.n,n:s.n,spent:q.spent,avg:q.avg,all:s.all,upc:s.upc||0,avgm:q.avgm,fixed:declared(c.n,s.n)||fixedLevel(s.all),ops:s.ops||[],td:s.td}; })}; }); }
  function setData(d){ if(d&&!d.keys&&d.months){ d.keys=d.months.map(function(m){return m.k}); d.seriesAll=d.months.map(function(m){return {k:m.k,bal:m.bal,rev:m.rev,dep:m.dep}}); }
    D=d; DAY=d.today.day; DAYS=d.today.days; ELAPSED=DAY/DAYS; }
  function expd(c){ return c.fixed? c.fixed : c.avg*ELAPSED; }
  function status(c){
    if(c.fixed){ var df=c.spent-c.fixed;
      if(Math.abs(df)<=Math.max(5,c.fixed*0.02)) return {k:'ok',t:'Fixe, à jour'};
      if(df<0) return {k:'ok',t:'Pas encore prélevé'};
      return df>Math.max(MIN_EUR,c.fixed*0.15)?{k:'bad',t:'Au-dessus du montant fixe'}:{k:'warn',t:'À surveiller'}; }
    var p=c.spent/c.avg, gap=p-ELAPSED, over=c.spent-c.avg*ELAPSED;
    if(over<MIN_EUR) return {k:'ok',t:p<ELAPSED-0.15?'En retard':'Dans le rythme'};
    if(gap>TOL) return {k:'bad',t:'En avance'}; if(gap>0.05) return {k:'warn',t:'À surveiller'}; return {k:'ok',t:p<ELAPSED-0.15?'En retard':'Dans le rythme'}; }
  function srt(arr,ec){ var s=arr.slice().sort(ec?function(a,b){return (b.spent-expd(b))/b.avg-(a.spent-expd(a))/a.avg}:function(a,b){return b.spent-a.spent}); return s; }
  function applyF(list){ return list; }
  function fcount(){ var f=S.f,n=0; if(f.graph!=='solde')n++; if(f.year&&D&&f.year!==D.today.month.slice(0,4)||f.month&&D&&f.month!==D.today.month.slice(5,7))n++; if(f.poste)n++; if(f.sous)n++; if(f.moy!=='12')n++; if(f.exc==='incl')n++; return n; }

  /* ---------- en-tête ---------- */
  function exportInfo(){ var fd=D.sync&&D.sync.fileDate, stale=fd&&daysBetween(fd,D.today.iso)>2;
    return {label: fd? 'Export du '+fmtDate(fd) : 'Données au '+fmtDate(D.stats.lastRealDate), stale: !!stale}; }
  function onCurrentMonth(fn){ var sv=S.f, cs=CATS, el=ELAPSED; S.f=Object.assign({},sv,{year:'',month:''}); CATS=buildCats(); var r; try{ r=fn(); } finally{ S.f=sv; CATS=cs; ELAPSED=el; } return r; }
  function alertsList(){ return onCurrentMonth(alertsListRaw); }
  function alertsListRaw(){ var a=[], L=D.proj&&D.proj.landing, ex=exportInfo();
    if(L&&L.days>0){ if(L.value<0) a.push({k:'bad',t:'Solde négatif prévu',m:'Atterrissage à '+eur(L.value)+' au '+fmtDate(L.date)+', juste avant la paie.',tab:'home'}); else if(L.value<300) a.push({k:'warn',t:'Atterrissage serré',m:'Il resterait '+eur(L.value)+' au '+fmtDate(L.date)+', juste avant la paie.',tab:'home'}); }
    (D.alerts||[]).filter(function(x){return !S.alertOff[x.n]}).forEach(function(x){ a.push({k:'bad',t:x.n+(x.kind==='double'?' : '+x.count+' prélèvements':' : plus élevé'),m:eur(x.paid,true)+' payés, '+eur(x.usual,true)+' d\'habitude (+'+eur(x.paid-x.usual,true)+').',tab:'subs'}); });
    CATS.forEach(function(c){ var s=status(c); if(s.k==='bad'||s.k==='warn') a.push({k:s.k,t:c.n+' : '+s.t.toLowerCase(),m:eur(c.spent)+' dépensés, rythme attendu '+eur(c.avg*ELAPSED)+'.',open:c.id}); });
    CATS.forEach(function(c){ if(!(D.budgets&&D.budgets[c.n])) return; var b=budInfo(c); if(b.k!=='ok') a.push({k:b.k,t:'Budget '+c.n+' : '+b.t.toLowerCase(),m:eur(c.spent)+' sur un plafond de '+eur(b.cap)+'.',tab:'bud'}); });
    ((D.subs&&D.subs.list)||[]).forEach(function(x){ if(!x.active) return; if(x.hausse) a.push({k:'warn',t:'Hausse : '+x.n,m:eur(x.hausse.from,true)+' → '+eur(x.hausse.to,true)+' par mois.',tab:'subs'}); else if(x.nouveau) a.push({k:'warn',t:'Nouvel abonnement : '+x.n,m:eur(x.amt,true)+' par mois, repéré récemment.',tab:'subs'}); });
    if(ex.stale) a.push({k:'warn',t:'Export ancien',m:ex.label+'. Déposez un nouvel export pour des chiffres à jour.',tab:'plus'});
    var o={bad:0,warn:1,ok:2}; return a.sort(function(x,y){return o[x.k]-o[y.k]}); }
  function bellBtn(){ if(!D) return ''; var n=alertsList().filter(function(x){return x.k==='bad'||x.k==='warn'}).length;
    return '<button class="iconbtn" data-act="alerts" aria-label="Alertes'+(n?', '+n:'')+'" style="position:relative">'+ico(I.bell)+(n?'<span class="fbadge">'+n+'</span>':'')+'</button>'; }
  function alertsScreen(){ var l=alertsList();
    return '<button class="back" data-act="alertsclose">'+ico(I.back)+'Accueil</button><h1>Alertes</h1>'+
    (l.length?'<div class="card" style="padding:4px 14px">'+l.map(function(x){ return '<button class="opline" '+(x.open?'data-aopen="'+esc(x.open)+'"':'data-atab="'+x.tab+'"')+' style="width:100%;border:0;background:transparent;text-align:left;color:inherit;font-family:inherit;border-bottom:1px solid var(--rim-soft);cursor:pointer"><div class="l"><span style="font-weight:600;font-size:14px;white-space:normal">'+esc(x.t)+'</span><span class="muted" style="font-size:12px;white-space:normal">'+esc(x.m)+'</span></div><span class="badge '+x.k+'">'+(x.k==='bad'?'Urgent':'À surveiller')+'</span></button>'; }).join('')+'</div>':'<div class="card muted" style="text-align:center;padding:26px 16px">Aucune alerte : tout est dans le rythme.</div>')+
    '<p class="note">Alertes : postes au-dessus de leur rythme, budgets dépassés, hausses d\'abonnements, atterrissage bas, export ancien.</p>'; }
  function header(){ var spin=S.loading||S.refreshing;
    return (S.stale&&S.refreshErr?'<div class="badt" style="font-size:11.5px;line-height:1.35">Actualisation impossible : '+esc(S.refreshErr)+'</div>':'')+'<div class="row" style="justify-content:flex-end"><div style="display:flex;gap:8px"><button class="iconbtn" data-act="theme" aria-label="'+(S.theme==='dark'?'Passer au thème clair':'Passer au thème sombre')+'">'+ico(S.theme==='dark'?I.sun:I.moon)+'</button>'+(D?'<button class="iconbtn'+(spin?' spin':'')+'" data-act="refresh" aria-label="Actualiser'+(S.stale&&D?', chiffres du '+esc(fmtDate(D.stats.lastRealDate)):'')+'" style="position:relative">'+ico(I.sync)+(S.stale&&!spin?'<span class="dot stale" style="position:absolute;top:9px;right:9px"></span>':'')+'</button>':'')+bellBtn()+'</div></div>'; }

  /* ---------- postes ---------- */
  function aria(c,extra){ return Math.round(c.spent/c.avg*100)+' % de la moyenne dépensés, '+Math.round(ELAPSED*100)+' % du mois écoulé. '+extra; }
  function bar2(c){ var s=status(c), e=expd(c), d=c.spent-e, w=Math.min(Math.abs(d)/((c.fixed||c.avg)*0.5),1)*50, pos=d>=0;
    return '<div class="bar" role="img" aria-label="'+aria(c,'Écart au rythme attendu : '+Math.round(d)+' euros')+'"><i class="'+s.k+'" style="'+(pos?'left:50%':'left:auto;right:50%')+'" data-w="'+w+'"></i><b style="left:50%"></b></div><div class="gapl muted"><span class="'+s.k+'t">'+(pos?'+':'−')+eur(Math.abs(d))+'</span> par rapport au rythme attendu ('+eur(e)+')</div>'; }
  function compactCard(list,sub){
    if(!sub&&S.lvl==='sub') return enseignesList();
    var flat=!sub&&S.lvl==='sub', ecarts=S.view==='ecarts', T='button';
    if(flat) list=list.reduce(function(a,c){ return a.concat(c.subs); },[]);
    var cats, extra=0;
    if(sub) cats=srt(list,ecarts);
    else { var pool=applyF(list), keep=pool;
      if(!S.all&&pool.length>8){ keep=pool.slice().sort(function(a,b){return Math.max(b.spent,b.avg)-Math.max(a.spent,a.avg)}).slice(0,8); extra=pool.length-keep.length; }
      cats=srt(keep,ecarts); }
    function info(c){ var s=status(c), e=expd(c), pct=c.spent/c.avg*100, gap=(c.spent-e)/(c.fixed||c.avg)*100, d=c.spent-e; return {c:c,s:s,k:s.k,pct:pct,gap:gap,d:d,e:e,pos:gap>=0}; }
    function lab(x){ return esc(x.c.n)+' : '+(ecarts?((x.pos?'+':'−')+Math.round(Math.abs(x.d))+(x.c.fixed?' euros par rapport au montant fixe':' euros par rapport au rythme attendu')):(Math.round(x.c.spent)+' euros, '+Math.round(x.pct)+' % de la moyenne de '+Math.round(x.c.avg)+' euros'))+', '+x.s.t; }
    function upn(x){ return x.c.upc>0&&per().cur? '<small class="muted" style="display:block;font-size:10.5px;font-weight:500;line-height:1.2">dont '+eur(x.c.upc)+' à venir</small>' : ''; }
    var items=cats.map(info), body;
    var tot=sum(list.map(function(c){return c.spent>0?c.spent:0})), mx=Math.max.apply(null,items.map(function(x){return x.c.spent}).concat([1]));
    function small(x){ return ecarts? (x.c.fixed?'fixe ':'')+eur(x.e) : (tot>0? Math.round(Math.max(x.c.spent,0)/tot*100)+' %' : ''); }
    function amt(x){ return ecarts? (x.c.fixed&&x.s.t==='Fixe, à jour'? '<b class="okt">À jour</b>' : '<b class="'+x.k+'t">'+(x.pos?'+':'−')+eur(Math.abs(x.d))+'</b>'+(x.e>0?' <small class="'+x.k+'t" style="font-size:11.5px;font-weight:600">('+(x.pos?'+':'−')+Math.round(Math.abs(x.d)/x.e*100)+' %)</small>':'')) : eur(x.c.spent); }
    function vis(x){
      if(ecarts){ var w=Math.max(Math.min(Math.abs(x.gap)/45,1)*50,0.8); return '<span class="pvis ec"><i class="'+x.k+' '+(x.pos?'r':'l')+'" data-w="'+w.toFixed(1)+'"></i></span>'; }
      return '<span class="pvis dep"><i data-w="'+(tot>0?Math.max(x.c.spent,0)/tot*100:0).toFixed(1)+'"></i></span>'; }
    if(!items.length) body='<p class="muted" style="padding:16px 4px">'+(sub?'Pas de sous-poste pour ce poste.':'Aucun poste ne correspond à ces filtres.')+'</p>';
    else body=items.map(function(x){ return '<'+T+' class="prow"'+(sub?' data-ssel="'+esc(x.c.n)+'" aria-pressed="'+(S.subSel===x.c.n)+'"':' data-open="'+esc(flat?x.c.pid:x.c.id)+'"')+' aria-label="'+lab(x)+'"><span class="ptop'+(ecarts?' ec':'')+'"><span class="pnm">'+esc(x.c.n)+(flat?'<small class="muted" style="font-size:11px;font-weight:500"> · '+esc(x.c.par)+'</small>'+(function(){ var t=topOf(x.c.par,x.c.n,1)[0]; return t?'<small class="muted" style="display:block;font-size:11px;font-weight:500;line-height:1.2">'+esc(t[0])+' · '+eur(t[1])+'</small>':''; })():'')+upn(x)+'</span><span class="psm'+(ecarts?'':' pct')+'">'+small(x)+'</span><span class="pamt">'+amt(x)+'</span></span>'+vis(x)+'</'+T+'>'; }).join('');
    return '<div class="card syn"><div class="seg" role="group" aria-label="Affichage des postes"><button data-view="depenses" aria-pressed="'+!ecarts+'">Dépenses</button><button data-view="ecarts" aria-pressed="'+ecarts+'">Écarts</button></div>'+(sub?'':'<div class="switch"><span>Détailler par enseigne</span><button class="tog" data-act="lvl" aria-pressed="'+flat+'" aria-label="Détailler par enseigne"></button></div>')+
      (ecarts?'<p class="gapl muted" style="text-align:center;margin:2px 0 4px">À gauche : sous la moyenne · à droite : au-dessus</p>':'')+body+(!sub&&(extra>0||S.all)&&applyF(list).length>8?'<button class="back" data-act="allpostes" style="min-height:40px;align-self:flex-start;font-size:13px">'+(S.all?'Réduire la liste':'Voir les '+extra+' autres postes')+'</button>':'')+
      '</div>'; }

  /* ---------- graphique de l'accueil ---------- */
  function niceCeil(v){ var step=v>12000?5000:v>6000?2000:v>2500?1000:v>1000?500:100; return Math.max(step,Math.ceil(v*1.08/step)*step); }
  function maxOf(a){ return a.reduce(function(m,v){return v>m?v:m},0); }
  var KCMP='';
  function chartInner(po,so){
    var PR=per(), P=D.proj, C=D.curve, G=150, B=170, N=30, gr=S.f.graph, svg='', sum_='', leg='', badge='', aria='', title=PR.label;
    var poste=po||(S.f.poste?CATS.filter(function(c){return c.id===S.f.poste})[0]:null), sous=so||(!po&&poste&&S.f.sous?poste.subs.filter(function(s){return s.n===S.f.sous})[0]:null);
    var COL={solde:'var(--accent)',dep:'var(--accent)',rev:'var(--c2)',bal:'var(--accent)'};
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

    var SW=46, VW=20+SW*12;   /* 7 mois visibles, 12 en faisant défiler */
    function barGrid(mx){ return '<line x1="10" y1="'+B+'" x2="'+(VW-10)+'" y2="'+B+'" stroke="var(--rim-soft)"/><line x1="10" y1="'+Y(mx/2,mx)+'" x2="'+(VW-10)+'" y2="'+Y(mx/2,mx)+'" stroke="var(--rim-soft)" stroke-dasharray="2 4"/>'; }
    {
      /* barres mensuelles : janvier à décembre de l'année choisie */
      var all=D.keys||[], slots=[], yy=PR.y, roll=[];
      for(var ri=11;ri>=0;ri--) roll.push(shiftMonth_(D.today.month,-ri));
      var rolling=PR.isYear? PR.curYear : roll.indexOf(PR.key)>=0;   /* 12 derniers mois glissants, sinon l'année civile choisie */
      for(var mi=1;mi<=12;mi++){ var kk=rolling? roll[mi-1] : yy+'-'+(mi<10?'0':'')+mi; slots.push({key:kk,i:all.indexOf(kk)}); }
      if(po){ var s0=(so||po).all||[], f0=0; while(f0<s0.length-7&&!s0[f0]) f0++; slots=all.slice(f0).map(function(k,j){ return {key:k,i:f0+j}; }); rolling=true; VW=20+SW*slots.length; }
      var vals, name, curSlot=-1; slots.forEach(function(s,n){ if(s.key===D.today.month) curSlot=n; });
      if(poste){ var src=(sous||poste).all||[]; vals=slots.map(function(s){return s.i<0?null:(src[s.i]||0)}); name='Dépenses'; title=poste.n+(sous?' › '+sous.n:'')+' · '+(po?'tout l’historique':rolling?'12 derniers mois':yy); }
      else { var ser=D.seriesAll||[]; vals=slots.map(function(s){ var o=s.i<0?null:ser[s.i]; return o? (gr==='dep'?o.dep:gr==='rev'?o.rev:gr==='bal'?o.rev-o.dep:o.bal) : null; }); name=gr==='dep'?'Dépenses':gr==='rev'?'Revenus':gr==='bal'?'Balance du mois':'Solde de fin de mois'; title=rolling?'12 derniers mois':'Année '+yy; }
      var projV=null; if(!poste&&curSlot>=0) projV=gr==='dep'?P.depEnd:gr==='rev'?P.revEnd:gr==='bal'?P.revEnd-P.depEnd:P.value;
      var known=vals.filter(function(v){return v!=null});
      var balMode=!poste&&gr==='bal', mx=niceCeil(Math.max(maxOf(known.length?known:[0]),projV||0,1)), bw=SW, g=balMode?'':barGrid(mx), hi=PR.isYear? -1 : slots.map(function(s){return s.key}).indexOf(PR.key);
      function kv(v){ var s=v<0?'−':'', x=Math.abs(v); return s+(x>=1000? (Math.round(x/100)/10).toString().replace('.',',')+'K' : String(Math.round(x))); }
      N=12; var col=poste?'var(--accent)':COL[gr];
      function drawBal(){ var pos=Math.max.apply(null,known.concat([projV||0,0])), neg=-Math.min.apply(null,known.concat([projV||0,0])), mxp=niceCeil(Math.max(pos,1)), tot=mxp+(neg>0?niceCeil(neg):0), u=G/tot, zy=20+mxp*u, o='<line x1="10" x2="'+(VW-10)+'" y1="'+zy.toFixed(1)+'" y2="'+zy.toFixed(1)+'" stroke="var(--rim-soft)"/>';
        slots.forEach(function(sl,n){ var cx=10+bw*(n+.5), v=vals[n], key=sl.key, mn=+key.slice(5,7)-1, sel=n===hi, last=n===curSlot, has=v!=null, bx=(cx-(SW-10)/2).toFixed(1);
          o+='<g data-bar="'+key+'" role="button" aria-label="'+esc(MOIS_L[mn]+' '+key.slice(0,4))+'" style="cursor:pointer"><rect x="'+(cx-bw/2).toFixed(1)+'" y="0" width="'+bw.toFixed(1)+'" height="200" fill="transparent"/>';
          function one(val,dash){ var h=Math.max(Math.abs(val)*u,2), y=val<0?zy:zy-h, c=val<0?'var(--bad)':col; return '<rect x="'+bx+'" y="'+y.toFixed(1)+'" width="'+(SW-10)+'" height="'+h.toFixed(1)+'" rx="6" '+(dash?'fill="none" stroke="'+c+'" stroke-dasharray="2 2"':'fill="'+(sel||hi<0?c:(val<0?'color-mix(in srgb,var(--bad) 45%,transparent)':'var(--neu)'))+'"')+'/>'; }
          var shown=last&&projV!=null?projV:v;
          if(has&&!(last&&projV!=null)) o+=one(v,false); if(last&&projV!=null) o+=one(projV,true);
          if(!S.hide&&shown!=null){ var yy2=shown<0?zy+Math.max(Math.abs(shown)*u,2)+12:zy-Math.max(Math.abs(shown)*u,2)-4; o+=txt(cx.toFixed(1),yy2.toFixed(1),kv(shown),{a:'middle',size:14,fill:sel?'var(--text)':'var(--muted)',w:700}); }
          o+=txt(cx.toFixed(1),186,MOIS_C[mn]||'',{a:'middle',size:11.5,fill:sel?'var(--text)':'var(--muted)',w:sel?700:0})+((n===0||mn===0)?txt(cx.toFixed(1),198,key.slice(0,4),{a:'middle',size:8.5}):'')+'</g>'; });
        var cp=vals.filter(function(v,n){return v!=null&&n!==curSlot}), av=cp.length>=3?sum(cp)/cp.length:null;
        if(av!=null) o+='<line x1="10" x2="'+(VW-10)+'" y1="'+(zy-av*u).toFixed(1)+'" y2="'+(zy-av*u).toFixed(1)+'" stroke="var(--muted)" stroke-opacity=".5" stroke-width="1" stroke-dasharray="3 4" pointer-events="none"/>';
        return o; }
      if(balMode) g=drawBal(); else
      slots.forEach(function(sl,n){ var cx=10+bw*(n+.5), v=vals[n], key=sl.key, mn=+key.slice(5,7)-1, lab=MOIS_C[mn]||'', sel=n===hi, last=n===curSlot, has=v!=null;
        g+='<g data-bar="'+key+'" role="button" aria-label="'+esc(MOIS_L[mn]+' '+key.slice(0,4))+'" style="cursor:pointer"><rect x="'+(cx-bw/2).toFixed(1)+'" y="0" width="'+bw.toFixed(1)+'" height="200" fill="transparent"/>';
        if(has) g+='<rect x="'+(cx-(SW-10)/2).toFixed(1)+'" y="'+Y(v,mx)+'" width="'+(SW-10)+'" height="'+(Math.min(Math.max(v,0),mx)/mx*G).toFixed(1)+'" rx="6" fill="'+(sel||hi<0?col:'var(--neu)')+'"/>';
        if(last&&projV!=null) g+='<rect x="'+(cx-(SW-10)/2).toFixed(1)+'" y="'+Y(projV,mx)+'" width="'+(SW-10)+'" height="'+(Math.min(Math.max(projV,0),mx)/mx*G).toFixed(1)+'" rx="6" fill="none" stroke="'+col+'" stroke-dasharray="2 2"/>';
        if(!S.hide&&has) g+=txt(cx.toFixed(1),(Y(last&&projV!=null?projV:v,mx)-4),kv(last&&projV!=null?projV:v),{a:'middle',size:14,fill:sel?'var(--text)':'var(--muted)',w:700});
        g+=txt(cx.toFixed(1),186,lab,{a:'middle',size:11.5,fill:sel?'var(--text)':'var(--muted)',w:sel?700:0})+((n===0||mn===0)?txt(cx.toFixed(1),198,key.slice(0,4),{a:'middle',size:8.5}):'')+'</g>'; });
      var comp=vals.filter(function(v,n){return v!=null&&n!==curSlot}), avgV=comp.length>=3? sum(comp)/comp.length : null;
      if(avgV!=null&&!balMode) g+='<line x1="10" x2="'+(VW-10)+'" y1="'+Y(avgV,mx)+'" y2="'+Y(avgV,mx)+'" stroke="var(--muted)" stroke-opacity=".5" stroke-width="1" stroke-dasharray="3 4" pointer-events="none"/>';
      vals=known;
      var nz=vals.filter(function(v){return v>0}), mean=nz.length? sum(nz)/nz.length : 0;
      sum_= poste? ('Dépenses mensuelles '+(String(poste.id).slice(0,2)==='m|'?'de ce marchand':'du poste')+'. Moyenne sur la période : '+eur(mean)+' par mois, total '+eur(sum(vals))+'.')
        : gr==='solde'? 'Solde en fin de chaque mois.'+(projV!=null?' Fin de ce mois : '+eur(P.value)+(P.salary.expected>0?', paie attendue vers le '+P.salary.day+' comprise':'')+'.'+(P.landing&&P.landing.days>0&&P.landing.date.slice(0,7)===D.today.month?' Le point le plus bas, juste avant la paie, est de '+eur(P.landing.value)+' au '+fmtDate(P.landing.date)+'.':''):'')
        : gr==='bal'? 'Balance de chaque mois : revenus moins dépenses, '+eur(sum(vals))+' au total sur la période.'+(projV!=null?' Le contour en pointillés montre la projection de fin de mois.':'')
        : (gr==='dep'?'Dépenses':'Revenus')+' de chaque mois, '+eur(sum(vals))+' au total sur la période.'+(projV!=null?' Le contour en pointillés montre la projection de fin de mois.':'');
      aria='Barres mensuelles : '+name; svg=g; leg=sq('var(--neu)','Autres mois')+sq(col,PR.isYear?name:'Mois choisi')+(avgV!=null?'<span><i style="display:inline-block;width:16px;border-top:1px dashed var(--muted);vertical-align:middle;margin-right:5px"></i>Moyenne '+kv(avgV)+'</span>':'')+'';
    }
    sum_=sum_.replace(/\.{2,}/g,'.');
    return '<div class="kchart">'+(poste?'<div class="row"><h3 style="font-size:14px">'+esc(title)+'</h3>'+badge+'</div>':'')+
      (!poste?'<div class="ctrls"><div class="seg sm" role="group" aria-label="Donnée du graphique">'+[['solde','Solde'],['dep','Dépenses'],['rev','Revenus'],['bal','Balance']].map(function(g){ return '<button data-gr="'+g[0]+'" aria-pressed="'+(gr===g[0])+'">'+g[1]+'</button>'; }).join('')+'</div></div>':'')+(poste?'':KCMP)+
      '<div class="kcard"><p class="muted" style="font-size:13px;margin:2px 0 6px;line-height:1.4">'+sum_+'</p>'+
      ('<div class="hscroll" data-hs="'+esc((poste?poste.id:'')+'|'+gr+'|'+(rolling?'r':PR.y))+'"><svg viewBox="0 0 '+VW+' 204" style="width:'+(VW/(7*SW+20)*100).toFixed(1)+'%;max-width:none;display:block" role="img" aria-label="'+esc(aria)+'">'+svg+'</svg></div>')+
      '<div class="muted" style="display:flex;gap:6px 14px;font-size:11px;flex-wrap:wrap;margin-top:4px">'+leg+'</div></div></div>'; }

  /* ---------- écrans ---------- */
  function syncNote(){ var s=D.sync; if(s&&s.error) return '<div class="card muted" style="font-size:13px;line-height:1.45"><b style="color:var(--text)">Lecture du dernier export impossible</b><br>'+esc(s.error)+'<br>Les chiffres viennent des opérations déjà importées.</div>'; return ''; }
  /* garde-fous de fraîcheur : quel export est lu, vérifié quand, et rapprochement du solde avec le dernier export */
  function hm(iso){ try{ return new Date(iso).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}).replace(':',' h '); }catch(e){ return ''; } }
  function dayHm(iso){ try{ var d=new Date(iso); return d.getDate()+' '+MOIS_C[d.getMonth()]+' à '+hm(iso); }catch(e){ return ''; } }
  function freshLine(){ var sy=(D&&D.sync)||{}, out='', ck=sy.check;
    if(ck&&ck.ok===false) out+='<div class="fresh bad" role="alert"><b>Le solde ne correspond pas au dernier export.</b> L’appli affiche '+eur(ck.appBal)+' au '+esc(fmtDate(ck.appDate))+', le dernier export ('+esc(ck.file)+') indique '+eur(ck.fileBal)+' au '+esc(fmtDate(ck.fileDate))+'. Touchez la flèche Actualiser, ou Plus &gt; Relire le dossier.</div>';
    if(S.refreshing) out+='<div class="fresh">Vérification du dossier d’export…</div>';
    else if(!S.stale&&sy.newest&&sy.newest.modified) out+='<div class="fresh">Dernier export lu : déposé le '+esc(dayHm(sy.newest.modified))+(sy.checkedAt?' · dossier vérifié à '+esc(hm(sy.checkedAt)):'')+'.</div>';
    return out; }
  function landDetail(L){ function r(l,v,cls){ return '<div class="row" style="font-size:13px;padding:5px 0"><span class="muted">'+l+'</span><b'+(cls?' class="'+cls+'"':'')+'>'+v+'</b></div>'; }
    return '<div style="border-top:1px solid var(--rim-soft);padding:8px 16px 14px">'+
      r('Solde actuel',eur(D.solde))+
      r('Opérations déjà programmées ('+L.fut.length+')',(L.futSum>0?'+':'')+eur(L.futSum),L.futSum<0?'badt':'okt')+
      (L.fut.length?'<div style="padding:0 0 4px 10px">'+L.fut.map(function(f){ return '<div class="row muted" style="font-size:12px;padding:2px 0"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(fmtDate(f[0]))+' · '+esc(f[1])+'</span><span>'+(f[2]>0?'+':'')+eur(f[2])+'</span></div>'; }).join('')+'</div>':'')+
      r('Dépenses courantes estimées ('+L.days+' j × '+eur(L.perDay)+')','−'+eur(L.spend),'badt')+
      '<div class="row" style="font-size:14px;padding:8px 0 0;border-top:1px solid var(--rim-soft);margin-top:4px"><b>Atterrissage</b><b style="color:var(--accent)">'+eur(L.value)+'</b></div>'+
      '<p class="muted" style="font-size:11.5px;line-height:1.4;margin-top:8px">Les dépenses courantes sont la moyenne de vos paiements par carte sur 90 jours. Si l\'export est ancien, les opérations faites depuis ne sont pas comptées.</p></div>'; }
  /* ---------- carte KPI de l'accueil : solde, atterrissage et dépenses du mois en cours ---------- */
  function kchip(d,p,goodUp){ if(d==null) return ''; var up=d>=0, good=goodUp?up:!up, r=Math.round(Math.abs(p||0)), cls=Math.abs(d)<1?'eq':good?'good':'bad';
    if(Math.abs(d)<1) return '<span class="kchip eq">=</span>';
    var arrow=up?'▲':'▼', sg=up?'+':'−', hasP=p!=null&&r>0&&r<=999;
    /* le pourcentage d'abord, en gras, puis le montant en plus petit et en poids normal */
    return '<span class="kchip '+cls+'">'+arrow+' '+(hasP?'<b>'+sg+r+' %</b><small>'+sg+eur(Math.abs(d))+'</small>':'<b>'+sg+eur(Math.abs(d))+'</b>')+'</span>'; }
  function kpiCard(){
    var L=D.proj&&D.proj.landing, open=!!S.landOpen&&!!L, cc=D.curve||{}, pk=prevKey(D.today.month,-1), pm=D.daily&&D.daily[pk], mp=MOIS_C[+pk.slice(5,7)-1];
    function balOn(day){ if(!pm||!pm.b||day<1) return null; for(var i=Math.min(day,pm.b.length)-1;i>=0;i--) if(pm.b[i]!=null) return pm.b[i]; return null; }
    var payDay=L&&L.payDate?+L.payDate.slice(8,10):(D.proj.salary&&D.proj.salary.day)||0, km={prevSame:balOn(DAY),prevLanding:payDay>1?balOn(payDay-1):null};
    var d0=km.prevSame!=null?D.solde-km.prevSame:null, p0=km.prevSame?d0/Math.abs(km.prevSame)*100:null;
    var SA=D.seriesAll||[], sav=(SA.length?SA[SA.length-1].sav:0)||0;
    /* solde (à gauche) avec le solde projeté dedans */
    var proj='';
    if(L){ var dl=km.prevLanding!=null?L.value-km.prevLanding:null, pl=km.prevLanding?dl/Math.abs(km.prevLanding)*100:null;
      proj='<span class="kproj">→ '+eur(L.value)+' au '+esc(fmtDate(L.date))+'</span>'+(pl!=null?'<span class="note">('+(pl>=0?'+':'−')+Math.abs(Math.round(pl))+' % face à '+mp+')</span>':''); }
    else proj='<span class="note">Fin de mois : '+eur(D.proj.value)+'</span>';
    var left='<'+(L?'button data-act="landtoggle" aria-expanded="'+open+'"':'div')+' class="ktile"><span class="muted" style="font-size:12.5px">Solde '+(D.soldeEstime?'estimé':'aujourd’hui')+'</span><span class="kv" id="bal" data-v="'+D.solde+'">'+eur(D.solde)+'</span>'+(d0!=null?kchip(d0,p0,true):'')+proj+'</'+(L?'button':'div')+'>';
    /* Livret A (à droite) : solde, intérêts touchés et non touchés */
    var Lv=D.livret, E=D.epargne||{accounts:[]}, acc=E.accounts&&E.accounts[0], lv=Lv?{solde:Lv.est,brut:Lv.brut,enc:Lv.interets}:(acc?{solde:acc.solde,brut:acc.interetsYtd||null,enc:null}:null), right;
    /* épargne : total automatique (comptes d'épargne exportés, sinon Livret A déclaré + virements reçus) ; le détail par livret s'affiche quand il est connu */
    var Lp=D.lep, eacc=E.accounts||[], epTot=eacc.length?E.total:(lv?lv.solde+(Lp?Lp.solde:0):0), eln=[];
    function accName(n){ n=String(n||''); return /populaire/i.test(n)?'LEP':/livret\s*a\b/i.test(n)?'Livret A':n.charAt(0).toUpperCase()+n.slice(1).toLowerCase(); }
    if(eacc.length>1) eln=eacc.map(function(x){return [accName(x.n),x.solde]}); else if(lv&&Lp) eln=[['Livret A',lv.solde],['LEP',Lp.solde]];
    if(lv){ right='<div class="ktile"><span class="muted" style="font-size:12.5px">Épargne</span><span class="kv" style="font-weight:500">'+eur(epTot)+'</span>'+eln.map(function(x){return '<span class="kmini"><span class="muted">'+esc(x[0])+'</span><b>'+eur(x[1])+'</b></span>'}).join('')+(sav>0?kchip(sav,epTot>sav?sav/(epTot-sav)*100:null,true):'')+'</div>'; }
    else { var s12=sum(SA.slice(-12).map(function(x){return x.sav||0}));
      right='<div class="ktile"><span class="muted" style="font-size:12.5px">Mis de côté</span><span class="kv">'+eur(s12)+'</span><span class="note">sur 12 mois</span></div>'; }
    /* total liquide : compte courant + Livret A + intérêts non touchés */
    var strip='';
    if(lv){ var tot=D.solde+epTot+(lv.enc||0), ref=km.prevSame!=null?km.prevSame+(epTot-sav):null;
      strip='<div class="kstrip"><span class="kl"><span class="muted">Total liquide</span><b>'+eur(tot,true)+'</b></span>'+(ref!=null?kchip(tot-ref,ref?(tot-ref)/Math.abs(ref)*100:null,true):'')+'</div>'; }
    var sub=L&&L.exportAge>1?'Export du '+fmtDate(L.exportDate)+' : les '+L.exportAge+' derniers jours ne sont pas vus. Déposez un nouvel export.':'';
    KCMP=''; var dep='', P_=per(), sk=P_.key, gm=S.f.graph||'solde', Dd=D.daily||{}, nDay=P_.cur?DAY:99;
    var mname=MOIS_L[+P_.mo-1], when=P_.cur?mname+', au '+DAY:mname+' '+P_.y;
    function cum(k,f){ var x=Dd[k]&&Dd[k][f]; return x?x.slice(0,nDay).reduce(function(a,v){return a+v},0):null; }
    function bal(k){ var x=Dd[k]&&Dd[k].b; if(!x) return null; for(var i=Math.min(nDay,x.length)-1;i>=0;i--) if(x[i]!=null) return x[i]; return null; }
    function balM(k){ var o=SA.filter(function(x){return x.k===k})[0]; return o?o.rev-o.dep:null; }
    var fn=gm==='solde'?bal:gm==='bal'?balM:function(k){return cum(k,gm==='rev'?'r':'d')}, ks=D.keys||[], ix=ks.indexOf(sk), cur0=P_.isYear?null:(P_.cur&&gm==='dep'?(cc.depCum||[])[DAY-1]:(P_.cur&&gm==='rev'?(cc.revCum||[])[DAY-1]:(P_.cur&&gm==='solde'?D.solde:P_.cur&&gm==='bal'?D.proj.revEnd-D.proj.depEnd:fn(sk))));
    var prv=ix>0?fn(ks[ix-1]):null, pr12=ks.slice(Math.max(0,ix-12),ix).map(fn).filter(function(v){return v!=null}), avg=pr12.length>=3?sum(pr12)/pr12.length:null;
    if(P_.cur&&gm==='dep'&&(cc.habit||[])[DAY-1]>0) avg=cc.habit[DAY-1];
    var ttl=(gm==='solde'?'Solde de ':gm==='rev'?'Revenus de ':gm==='bal'?'Balance de ':'Dépenses de ')+when, goodUp=gm!=='dep';
    if(cur0!=null&&(gm==='solde'||gm==='bal'||cur0>0)){ var dp=prv!=null?cur0-prv:null, da=avg!=null?cur0-avg:null;
      dep='<div class="ksec">'+(gm==='solde'||gm==='bal'?'':'<span class="muted" style="font-size:13px">'+esc(ttl)+'</span><span class="kdep">'+eur(cur0)+'</span>')+
        '<div class="kcmp">'+(dp!=null?'<div><span class="muted">Mois dernier</span><b>'+eur(prv)+'</b>'+kchip(dp,prv?dp/Math.abs(prv)*100:null,goodUp)+'</div>':'')+(da!=null?'<div><span class="muted">Moyenne</span><b>'+eur(avg)+'</b>'+kchip(da,avg?da/Math.abs(avg)*100:null,goodUp)+'</div>':'')+'</div>'+
        '<div class="note">'+(gm==='solde'?'Solde du compte courant':gm==='rev'?'Revenus, exceptionnels compris':gm==='bal'?'Revenus moins dépenses du mois':'Exceptionnelles comprises')+', mouvements entre comptes exclus. '+(gm==='bal'?(P_.cur?'Ce mois-ci : projection de fin de mois, comparée aux balances finales des mois précédents.':'Balances finales des mois.'):P_.cur?'Comparé au même jour du mois ; la moyenne porte sur les 12 derniers mois.':'La moyenne porte sur les 12 mois précédents.')+'</div></div>'; }
    KCMP=dep;
    var BR=''; (function(){ var Pm=per(), key=Pm.isYear?D.today.month:Pm.key, cur=key===D.today.month, o=SA.filter(function(x){return x.k===key})[0], v=cur?(D.proj.revEnd-D.proj.depEnd):(o?o.rev-o.dep:null); if(v==null||isNaN(v)) return;
      var m=MOIS_L[+key.slice(5,7)-1]; BR='<div class="hbal"><span class="bl1"><span>Balance '+(/^[aeiouhéàâêîôû]/.test(m)?'d’':'de ')+m+(cur?'':' '+key.slice(0,4))+'</span><span class="sm">'+(cur?'projection de fin de mois':'balance finale')+'</span></span><b class="bv '+(v<0?'neg':'pos')+'">'+(v<0?'−':'+')+eur(Math.abs(v))+'</b></div>'; })();
    return '<div class="hero kwrap">'+header()+syncNote()+'<div class="ktiles">'+left+'<span class="hsep"></span>'+right+strip+'</div>'+(open?'<div class="kdetail">'+landDetail(L)+'</div>':'')+BR+freshLine()+(sub?'<div class="note">'+esc(sub)+'</div>':'')+'</div><div class="kwrap">'+chartInner()+'</div>'; }
  function homeScreen(){
    return kpiCard()+
    (revMode()?revSection():
    '<div class="row"><h2 style="font-size:18px">'+postesTitle()+'</h2><span class="muted" style="font-size:12px">'+(per().cur?'Jour '+DAY+' sur '+DAYS:esc(per().label))+'</span></div>'+postesList()+(S.lvl==='sub'&&!S.f.poste?merchantCard():''));
  }
  /* évolution par poste : du 1er janvier à aujourd'hui, face à la même date l'an dernier */
  function rapportYtd(){
    var k=D.keys||[], ci=k.indexOf(D.today.month), mo=+D.today.month.slice(5,7); if(ci<0||ci-(mo-1)-12<0) return null;
    var i0=ci-(mo-1);
    function ytd(arr,tdArr,off){ if(!arr) return 0; var t=0,i; for(i=i0+off;i<ci+off;i++) t+=arr[i]||0; return t+((tdArr&&tdArr[ci+off])||0); }
    var rows=[];
    D.cats.forEach(function(c){ if(c.n==='Divers'||c.n==='Famille et proches') return;
      var a=ytd(c.all,c.td,0), b=ytd(c.all,c.td,-12), top=null;
      (c.subs||[]).forEach(function(s){ var d=ytd(s.all,s.td,0)-ytd(s.all,s.td,-12); if(!top||d>top.d) top={n:s.n,d:d,a:ytd(s.all,s.td,0),b:ytd(s.all,s.td,-12)}; });
      rows.push({n:c.n,a:a,b:b,d:a-b,top:top}); });
    rows=rows.filter(function(r){return r.a>0||r.b>0}).sort(function(x,y){return y.d-x.d});
    return {rows:rows,y:+D.today.month.slice(0,4),total:rows.reduce(function(s,r){return s+r.d},0)}; }
  function rapportPoints(){
    var P=[], L=[], unc=uncategorised(), subs=(D.subs&&D.subs.list)||[];
    (D.dups||[]).slice(0,3).forEach(function(d){ P.push({p:'Paiement identique',t:esc(d.l)+' : '+d.n+' paiements identiques le '+fmtDate(d.d)+', pas de preuve de doublon. À vérifier dans l’appli bancaire.',a:null,s:'À vérifier',k:'warn'}); });
    if(unc.length){ var sm=unc.reduce(function(s,x){return s+Math.abs(x.sum)},0), n=unc.reduce(function(s,x){return s+x.n},0); P.push({p:'Opérations non identifiées',t:n+' opération'+(n>1?'s':'')+' récente'+(n>1?'s':'')+' sans catégorie : '+unc.slice(0,4).map(function(x){return esc(cleanLabel(x.l))}).join(', ')+(unc.length>4?'…':'')+'.',a:sm,s:'À identifier',k:'warn'}); }
    (D.excOps||[]).slice(0,3).forEach(function(o){ P.push({p:'Dépense ponctuelle',t:esc(cleanLabel(o[1]))+', '+fmtDate(o[0])+' · '+esc(o[2])+'.',a:-o[3],s:'Info',k:'ok'}); });
    subs.filter(function(x){return x.active&&x.hausse}).slice(0,3).forEach(function(x){ P.push({p:'Hausse d’abonnement',t:esc(x.n)+' : '+eur(x.hausse.from,true)+' → '+eur(x.hausse.to,true)+' par mois.',a:null,s:'À vérifier',k:'warn'}); });
    subs.filter(function(x){return x.active&&x.nouveau}).slice(0,3).forEach(function(x){ P.push({p:'Nouvel abonnement',t:esc(x.n)+' : '+eur(x.amt,true)+' par mois, repéré récemment.',a:x.amt,s:'Info',k:'ok'}); });
    var ex=exportInfo(); if(ex.stale) P.push({p:'Export ancien',t:esc(ex.label)+'. Déposez un nouvel export pour des chiffres à jour.',a:null,s:'À mettre à jour',k:'warn'});
    return P; }
  /* ---------- rapport d'analyse ---------- */
  function rapportScreen(){
    var R=D.rapport, dc=R&&R.decouvert, E=R&&R.eq, L=D.proj&&D.proj.landing, K=D.kpi||{};
    var back='<button class="back" data-act="subclose">'+ico(I.back)+'Plus</button>';
    if(!R||!E) return back+'<h1>Rapport</h1><div class="card muted" style="text-align:center;padding:26px 16px">Pas encore assez de données. Relisez le dossier (Plus > « Relire le dossier maintenant »).</div>';
    function mlab(k){ return MOIS_L[+k.slice(5,7)-1]+' '+k.slice(0,4); }
    function sec(n,t,q,body){ return '<div class="rsec"><div class="rhead">'+(n?'<span class="rnum">'+n+'</span>':'')+'<div><div class="rttl">'+t+'</div><div class="rq">'+q+'</div></div></div>'+body+'</div>'; }
    function tile(v,l,c){ return '<div class="rtile'+(c?' '+c:'')+'"><b>'+v+'</b><span>'+l+'</span></div>'; }
    function line(l,v,bold){ return '<div class="rline'+(bold?' bold':'')+'"><span>'+l+'</span><span>'+v+'</span></div>'; }
    function gauge(title,val,lo,hi,max,fmt,note){ var w=Math.max(0,Math.min(val/max,1))*100, a=lo/max*100, b=hi/max*100;
      return '<div class="rg"><div class="rgt">'+title+'</div><div class="rgtrack" role="img" aria-label="'+esc(title)+' : '+fmt(val)+'"><i class="band" style="left:'+a.toFixed(1)+'%;width:'+(b-a).toFixed(1)+'%"></i><i class="val" style="width:'+w.toFixed(1)+'%"></i></div><div class="rgv"><b>'+fmt(val)+'</b><span>'+note+'</span></div></div>'; }
    var daysTxt=dc.lastNeg? (dc.lastNegDays>0? 'Le compte n’est plus à découvert depuis le '+fmtDate(dc.lastNeg)+', soit '+dc.lastNegDays+' jours.' : 'Le compte est à découvert aujourd’hui.') : 'Le compte n’a jamais été à découvert sur la période.';
    var tx=E.taux, effort=K.effort!=null?K.effort*100:null;
    var tiles='<div class="rtiles">'+tile(dc.lastNeg?(dc.lastNegDays>0?dc.lastNegDays+' jours':'à découvert'):'0 jour',dc.lastNeg?(dc.lastNegDays>0?'sans découvert depuis le '+fmtDate(dc.lastNeg):'le solde est négatif aujourd’hui'):'à découvert sur toute la période',dc.lastNeg&&dc.lastNegDays<=0?'bad':'')+
      tile(eur(E.margin/E.n)+'','de marge par mois hors exceptionnelles'+(tx!=null?', soit '+String(tx).replace('.',',')+' % des revenus':''),E.margin<0?'bad':'')+
      tile(effort!=null?Math.round(effort)+' %':'—','des revenus pour le crédit maison (repère HCSF : 35 % maximum)')+
      tile(E.treso!=null?String(E.treso).replace('.',',')+' mois':'—','de dépenses couverts par le solde',E.treso!=null&&E.treso<3?'warn':'')+'</div>';
    var consts='<ol class="rcons"><li><b>'+(dc.lastNeg&&dc.lastNegDays>0?'Le redressement est visible.':'Le découvert est à surveiller.')+'</b> '+daysTxt+(dc.totalDays?' Au total, '+dc.totalDays+' jours à découvert depuis le début des données.':'')+'</li>'+
      '<li><b>L’équilibre courant est '+(E.margin>=0?'positif':'négatif')+'.</b> Hors éléments exceptionnels, vous dégagez '+eur(E.margin/E.n)+' par mois'+(tx!=null?' ('+String(tx).replace('.',',')+' % de vos revenus)':'')+'. Sur '+E.n+' mois, '+(E.deficits.length===0?'aucun n’a été déficitaire':E.deficits.length===1?'un a été déficitaire':E.deficits.length+' ont été déficitaires')+'. Le résultat net, exceptionnels compris, est de '+eur(E.net)+'.</li>'+
      '<li><b>La trésorerie couvre '+(E.treso!=null?String(E.treso).replace('.',','):'—')+' mois de dépenses.</b>'+(L&&L.days>0?' Atterrissage estimé : '+eur(L.value)+' au '+fmtDate(L.date)+', juste avant la paie.':'')+'</li></ol>';
    var years='<div class="rtab"><div class="rtr h"><span>Année</span><span>Jours à découvert</span><span>Solde le plus bas</span><span>Solde moyen</span></div>'+dc.years.map(function(Y){ return '<div class="rtr"><span>'+Y.y+'</span><span class="'+(Y.days>0?'badt':'')+'">'+Y.days+'</span><span>'+eur(Y.min)+'</span><span>'+eur(Y.mean)+'</span></div>'; }).join('')+'</div>';
    var mx=Math.max.apply(null,E.months.map(function(m){return Math.max(m.rev,m.dep)}).concat([1]));
    var bars='<div class="rbars" role="group" aria-label="Revenus et dépenses courants par mois">'+E.months.map(function(m){ var neg=m.net<0;
      return '<div class="rb" aria-label="'+esc(mlab(m.k))+' : revenus '+Math.round(m.rev)+' euros, dépenses '+Math.round(m.dep)+' euros'+(neg?', mois déficitaire':'')+'"><span class="rbd'+(neg?' on':'')+'"></span><span class="rbc"><i class="r" style="height:'+(m.rev/mx*100).toFixed(1)+'%"></i><i class="d" style="height:'+(m.dep/mx*100).toFixed(1)+'%"></i></span><span class="rbl">'+MOIS_C[+m.k.slice(5,7)-1]+'</span></div>'; }).join('')+'</div>'+
      '<div class="rleg"><span><i class="r"></i>Revenus</span><span><i class="d"></i>Dépenses courantes</span><span><i class="dot"></i>Mois déficitaire</span></div>';
    var tab='<div class="rtl">'+line('Revenus (salaire et virements reçus)',eur(E.rev))+line('Dépenses courantes (hors exceptionnelles)',eur(E.dep))+line('Marge hors exceptionnelles'+(tx!=null?' (taux d’épargne '+String(tx).replace('.',',')+' %)':''),eur(E.margin),1)+
      line('Revenus exceptionnels',eur(E.revExc))+line('Dépenses exceptionnelles (au moins 500 €, hors récurrentes)',eur(E.exc))+line('Solde net des '+E.n+' mois'+(E.tauxNet!=null?' (taux '+String(E.tauxNet).replace('.',',')+' %)':''),eur(E.net),1)+'</div>';
    var nuance='<ul class="rul">'+(E.deficits.length?'<li><b>Mois déficitaires hors exceptionnelles :</b> '+E.deficits.map(function(d){ return esc(mlab(d.k).split(' ')[0])+' ('+(d.v<0?'−':'')+eur(Math.abs(d.v))+')'; }).join(', ')+'.</li>':'<li>Aucun mois déficitaire hors exceptionnelles sur la période.</li>')+
      (K.fixed>0?'<li><b>Charges fixes détectées :</b> '+eur(K.fixed)+' par mois'+(K.salary>0?', soit '+Math.round(K.fixed/K.salary*100)+' % de votre salaire net':'')+'. Reste à vivre : '+eur(K.rest)+' par mois.</li>':'')+'</ul>';
    var gauges='<div class="rgs">'+(effort!=null?gauge('Poids du crédit maison (% des revenus)',effort,0,35,60,function(v){return Math.round(v)+' %'},'maximum recommandé : 35 % (HCSF)'):'')+
      (tx!=null?gauge('Taux d’épargne (% des revenus)',tx,10,20,30,function(v){return String(Math.round(v*10)/10).replace('.',',')+' %'},'repère usuel : 10 à 20 %'):'')+
      (E.treso!=null?gauge('Trésorerie du compte courant (mois de dépenses)',E.treso,3,6,9,function(v){return String(Math.round(v*10)/10).replace('.',',')+' mois'},'repère usuel : 3 à 6 mois (le Livret A n’est pas inclus)'):'')+'</div>';
    var tr='';
    if(L&&L.days>0){ var f=D.forecast||{}; tr='<div class="rtl">'+line(D.soldeEstime?'Solde estimé aujourd’hui':'Solde du compte',eur(D.solde))+line('Dépenses par carte estimées par jour',eur(f.daily||0))+line('Paie estimée',D.proj.salary&&D.proj.salary.day?'le '+D.proj.salary.day+' du mois':'—')+line('Atterrissage au '+fmtDate(L.date),eur(L.value),1)+'</div><p class="note">Atterrissage : solde estimé, moins les dépenses moyennes par carte sur 90 jours, jusqu’à la veille de la paie estimée d’après les six derniers mois.</p>'; }
    else tr='<p class="muted" style="font-size:13px">Pas d’atterrissage à afficher : la paie est déjà arrivée ou n’est pas estimable.</p>';
    var Y=rapportYtd(), ytdHtml='';
    if(Y){ var up=Y.rows.filter(function(r){return r.d>0}).slice(0,3), mxd=Math.max.apply(null,Y.rows.map(function(r){return Math.abs(r.d)}).concat([1]));
      ytdHtml='<p class="rp">'+(up.length?'Depuis janvier, '+up.map(function(r){return '<b>'+esc(r.n.toLowerCase())+'</b>'}).join(', ')+' ont le plus augmenté. Au total, les postes ci-dessous coûtent '+(Y.total>=0?eur(Y.total)+' de plus':eur(-Y.total)+' de moins')+' qu’à la même date en '+(Y.y-1)+'.':'Aucun poste n’a augmenté depuis janvier, face à la même date en '+(Y.y-1)+'.')+'</p>'+
        '<div class="rev" role="list">'+Y.rows.slice(0,9).map(function(r){ var pos=r.d>=0; return '<div class="rev-r" role="listitem" aria-label="'+esc(r.n)+' : '+(pos?'+':'−')+Math.round(Math.abs(r.d))+' euros"><span class="rev-n">'+esc(r.n)+'</span><span class="rev-b"><i class="'+(pos?'up':'dn')+'" style="width:'+(Math.abs(r.d)/mxd*100).toFixed(1)+'%"></i></span><b class="'+(pos?'badt':'okt')+'">'+(pos?'+':'−')+eur(Math.abs(r.d))+'</b></div>'; }).join('')+'</div>'+
        '<p class="note">Écart de dépenses du 1er janvier au '+esc(fmtDate(D.today.iso))+', '+Y.y+' contre '+(Y.y-1)+'. « Famille et proches » et « Divers » sont exclus : leurs virements irréguliers faussent la comparaison.</p>'+
        '<ul class="rul">'+up.map(function(r){ return '<li><b>'+esc(r.n)+' (+'+eur(r.d)+')</b>'+(r.top&&r.top.d>0&&r.top.n!==r.n?' : surtout '+esc(r.top.n.toLowerCase())+' (+'+eur(r.top.d)+', '+eur(r.top.b)+' → '+eur(r.top.a)+').':'.')+'</li>'; }).join('')+'</ul>'; }
    else ytdHtml='<p class="muted" style="font-size:13px">Il faut au moins un an d’historique pour comparer avec la même date l’an dernier.</p>';
    var pts=rapportPoints(), ptsHtml=pts.length? '<div class="rpts">'+pts.map(function(x){ return '<div class="rpt"><div class="rpt-h"><b>'+x.p+'</b><span class="badge '+x.k+'">'+x.s+'</span></div><div class="rpt-t">'+x.t+'</div>'+(x.a!=null?'<div class="rpt-a">'+eur(x.a)+'</div>':'')+'</div>'; }).join('')+'</div>' : '<p class="muted" style="font-size:13px">Rien à signaler : aucun doublon, aucune opération non identifiée, aucune hausse d’abonnement.</p>';
    var st=D.stats||{}, sy=D.sync||{};
    var meth='<ul class="rul"><li><b>Données :</b> '+st.rows+' opérations du compte courant, du '+esc(fmtDate(st.from))+' au '+esc(fmtDate(st.to))+(sy.fileName?', dernier export lu : '+esc(sy.fileName):'')+'.</li>'+
      '<li><b>Classement :</b> vos règles par libellé (Sheet et fichier du Drive), puis les catégories de la banque regroupées en grands postes. Les mouvements internes ('+(st.internal||0)+') sont exclus ; les remboursements de mutuelle sont déduits de la santé.</li>'+
      '<li><b>Moyennes :</b> calculées sans les dépenses exceptionnelles (paiement d’au moins 500 € hors prélèvement récurrent).</li>'+
      '<li><b>Atterrissage :</b> solde estimé, moins les dépenses moyennes par carte sur 90 jours, jusqu’à la veille de la paie estimée d’après les six derniers mois.</li></ul>'+
      '<h3 class="ins-h" style="margin-top:4px">Limites</h3><ul class="rul"><li>Un seul compte courant : sans l’export du Livret A, l’épargne réelle est inconnue.</li><li>Les opérations datées après l’export sont présumées exécutées. Les repères externes sont indicatifs, ce ne sont pas des normes.</li></ul>';
    return back+'<div class="rcover"><div class="reye">Rapport d’analyse financière</div><h1>Votre compte courant</h1><p>'+D.stats.rows+' opérations du '+esc(fmtDate(D.stats.from))+' au '+esc(fmtDate(D.stats.to))+'.</p></div>'+
      sec('','Synthèse','Que faut-il retenir ?',tiles+consts)+
      sec('01','Le redressement','D’où vient le compte, et où en est-il ?','<p class="rp">'+daysTxt+(dc.min?' Le point le plus bas atteint '+(dc.min.v<0?'−':'')+eur(Math.abs(dc.min.v))+' ('+esc(fmtDate(dc.min.d))+').':'')+'</p>'+years)+
      sec('02','L’équilibre courant','Vos revenus couvrent-ils vos dépenses ?','<p class="rp">Douze derniers mois complets ('+esc(mlab(E.from))+' à '+esc(mlab(E.to))+').</p>'+bars+tab+nuance+gauges)+
      sec('03','Où part l’argent','Quels postes montent depuis janvier ?',ytdHtml)+
      sec('04','La trésorerie à court terme','Que restera-t-il avant la prochaine paie ?',tr)+
      sec('05','Les points d’attention','Qu’y a-t-il à vérifier ou à trancher ?',ptsHtml)+
      sec('06','Méthode et limites','Sur quoi repose l’analyse ?',meth)+
      '<p class="note">Constats chiffrés et alertes factuelles : ce rapport ne constitue pas un conseil financier. Les repères (HCSF, usage courant) sont indicatifs, ce ne sont pas des normes.</p>'; }
  /* ---------- vacances (zone C) ---------- */
  function vacList(){ return (D&&D.vac)||[]; }
  function vacCur(){ return vacList().filter(function(v){return v.cur})[0]; }
  function vpct(a,b){ if(!(b>0)) return ''; var d=(a-b)/b*100, r=Math.round(Math.abs(d)); return r===0?'<span class="ins-chip eq">0 %</span>':'<span class="ins-chip '+(d>0?'up':'dn')+'">'+(d>0?'▲ +':'▼ −')+r+' %</span>'; }
  var VC=['linear-gradient(90deg,var(--accent),var(--c2))','linear-gradient(90deg,var(--c2),var(--ok))','linear-gradient(90deg,var(--ok),var(--warn))'];
  function vstack(v){ var t=v.total>0?v.total:1, parts=[['Hébergement',v.h],['Train et avion',v.t],['Sur place',v.p]];
    return '<div class="vstack" role="img" aria-label="'+parts.map(function(x){return x[0]+' '+Math.round(x[1]/t*100)+' %'}).join(', ')+'">'+parts.map(function(x,i){return '<i style="width:'+(Math.max(x[1],0)/t*100).toFixed(1)+'%;background:'+VC[i]+'"></i>'}).join('')+'</div>'+
      '<div class="vleg">'+parts.map(function(x,i){return '<span><span class="vdot" style="background:'+VC[i]+'"></span>'+x[0]+' <b>'+eur(x[1])+'</b></span>'}).join('')+'</div>'; }
  function vcmp(v){ return v.cur? (v.prevSame!=null?{ref:v.prevSame,txt:'Même période l’an dernier, au même jour : '+eur(v.prevSame)+'.'}:null) : (v.prev!=null?{ref:v.prev,txt:'Même période l’an dernier : '+eur(v.prev)+'.'}:null); }
  function vacScreen(){
    var L=vacList(), v=L.filter(function(x){return x.id===S.vper})[0];
    if(S.vper&&!v){ S.vper=null; S.vposte=null; }
    if(!S.vper) return vacListScreen(L);
    if(!S.vposte) return vacPeriodScreen(v);
    return vacPosteScreen(v); }
  function vacListScreen(L){
    return '<button class="back" data-act="subclose">'+ico(I.back)+'Plus</button><h1>Vacances</h1><p class="muted" style="font-size:13px;margin:-6px 0 0">Zone C · de la plus récente à la plus ancienne.</p>'+
    (L.length? L.map(function(v){ var c=vcmp(v);
      return '<button class="card vcard" data-vper="'+esc(v.id)+'" aria-label="'+esc(v.n)+', '+Math.round(v.total)+' euros"><div class="row"><h3 style="font-size:16px">'+esc(v.n)+(v.cur?' <span class="badge ok">en cours</span>':'')+'</h3><span class="muted" style="font-size:12px">'+esc(fmtDate(v.a))+' – '+esc(fmtDate(v.b))+'</span></div>'+
        '<div class="row" style="align-items:center"><span style="font-size:24px;font-weight:700">'+eur(v.total)+'</span>'+(c?vpct(v.total,c.ref):'')+'</div>'+vstack(v)+
        (v.early>0?'<div class="muted" style="font-size:12px">dont '+eur(v.early)+' payés avant le départ</div>':'')+'</button>'; }).join('')
      : '<div class="card muted" style="text-align:center;padding:26px 16px">Aucune dépense de vacances trouvée dans les données.</div>')+
    '<p class="note">Les réservations d’hébergement, de train, d’avion et d’agences payées dans les 120 jours avant le début d’une période, hors d’une autre période, lui sont rattachées. « Sur place » regroupe les dépenses variables pendant les dates (alimentation, loisirs, shopping, taxis, divers), hors crédit, impôts et abonnements. Dates : calendrier officiel zone C. Pour forcer des dates, une ligne dans Banque-regles.txt : @sejour ; Été 2026 ; 2026-07-04 ; 2026-09-01 (dernier jour inclus).</p>'; }
  function vacPeriodScreen(v){
    var mx=Math.max.apply(null,v.postes.map(function(x){return x.amt}).concat([1])), big=v.postes[0], rows=[];
    var avgRows=[['Cette période',v.total,0]]; if(v.prev!=null) avgRows.push(['Même période, an dernier',v.prev,1]); if(v.avg!=null) avgRows.push(['Moyenne des '+esc(v.n.slice(0,-5).toLowerCase())+'s',v.avg,1]);
    var m2=Math.max.apply(null,avgRows.map(function(r){return r[1]}).concat([1]));
    var evo='<div class="ins-sec"><h3 class="ins-h">Évolution</h3>'+avgRows.map(function(r,i){ return '<div class="ins-row'+(i===0?' now':'')+'"><div class="ins-top"><span class="ins-nm">'+r[0]+'</span><span class="ins-v">'+eur(r[1])+(r[2]?' '+vpct(v.total,r[1]):'')+'</span></div><span class="ins-bar"><i style="width:'+(r[1]/m2*100).toFixed(1)+'%"></i></span></div>'; }).join('')+'</div>';
    var facts=[]; if(big) facts.push(['Premier poste : '+esc(big.n),Math.round(big.amt/v.total*100)+' % de la période ('+eur(big.amt)+').']);
    if(v.early>0) facts.push([eur(v.early)+' payés avant le départ',Math.round(v.early/v.total*100)+' % du total : réservations rattachées à cette période.']);
    if(v.len>0&&v.total>0) facts.push([eur(v.total/v.day)+' par jour',v.cur?'en moyenne depuis le début, réservations comprises.':'en moyenne sur '+v.len+' jours, réservations comprises.']);
    var fh='<div class="ins-sec"><h3 class="ins-h">À retenir</h3>'+facts.map(function(f){ return '<div class="ins-fact"><i></i><div><b>'+f[0]+'</b><span>'+f[1]+'</span></div></div>'; }).join('')+'</div>';
    return '<button class="back" data-act="vback">'+ico(I.back)+'Vacances</button><div class="row"><h1>'+esc(v.n)+'</h1>'+(v.cur?'<span class="badge ok">en cours</span>':'')+'</div>'+
    '<div class="card"><div class="row" style="align-items:center"><span style="font-size:30px;font-weight:600">'+eur(v.total)+'</span>'+(vcmp(v)?vpct(v.total,vcmp(v).ref):'')+'</div><div class="muted" style="font-size:13px">'+esc(fmtDate(v.a))+' – '+esc(fmtDate(v.b))+' · '+v.len+' jours'+(v.cur?' (jour '+v.day+')':'')+'</div>'+vstack(v)+'</div>'+
    '<h3 style="font-size:16px">Postes</h3><div class="card syn">'+(v.postes.length? v.postes.map(function(x){ return '<button class="prow" data-vposte="'+esc(x.n)+'" aria-label="'+esc(x.n)+' : '+Math.round(x.amt)+' euros"><span class="ptop"><span class="pnm">'+esc(x.n)+'</span><span class="psm pct">'+Math.round(x.amt/v.total*100)+' %</span><span class="pamt">'+eur(x.amt)+'</span></span><span class="pvis dep"><i data-w="'+(x.amt/mx*100).toFixed(1)+'"></i></span>'+(x.early>0?'<span class="muted" style="display:block;font-size:11.5px;margin-top:3px">dont '+eur(x.early)+' réservés avant le départ</span>':'')+'</button>'; }).join('') : '<p class="muted" style="padding:12px 4px">Aucune dépense sur cette période.</p>')+
      '<div class="gapl muted" style="margin-top:4px">Triés du plus dépensé au moins dépensé. Touchez un poste pour voir ses sous-postes et ses opérations.</div></div>'+
    '<h3 style="font-size:16px">Insights</h3><div class="card ins">'+evo+fh+'</div>'; }
  function vacPosteScreen(v){
    var x=v.postes.filter(function(p){return p.n===S.vposte})[0]; if(!x){ S.vposte=null; return vacPeriodScreen(v); }
    var mx=Math.max.apply(null,x.subs.map(function(s){return s.amt}).concat([1]));
    return '<button class="back" data-act="vback">'+ico(I.back)+esc(v.n)+'</button><h1>'+esc(x.n)+'</h1>'+
    '<div class="card"><div class="row" style="align-items:center"><span style="font-size:30px;font-weight:600">'+eur(x.amt)+'</span><span class="badge ok">'+Math.round(x.amt/v.total*100)+' % de la période</span></div><div class="muted" style="font-size:13px">'+esc(v.n)+' · '+esc(fmtDate(v.a))+' – '+esc(fmtDate(v.b))+'</div></div>'+
    '<h3 style="font-size:16px">Sous-postes</h3><div class="card syn">'+x.subs.map(function(s){ return '<div class="prow" style="cursor:default"><span class="ptop"><span class="pnm">'+esc(s.n)+'</span><span class="psm pct">'+Math.round(s.amt/x.amt*100)+' %</span><span class="pamt">'+eur(s.amt)+'</span></span><span class="pvis dep"><i data-w="'+(Math.max(s.amt,0)/mx*100).toFixed(1)+'"></i></span></div>'; }).join('')+'</div>'+
    '<h3 style="font-size:16px">Opérations</h3><div class="card" style="padding:4px 14px">'+opsList(x.ops.map(function(o){ return [o[0],o[1],x.n+(o[3]?' · réservé avant le départ':''),-o[2],0]; }))+'</div>'; }
  /* ---------- sources de revenus (graphique sur « Revenus ») ---------- */
  function revMode(){ return S.f.graph==='rev'&&!S.f.poste; }
  function revGroups(){ var P_=per(), ops=[]; P_.idxs.forEach(function(i){ ops=ops.concat((D.revOps&&D.revOps[D.keys[i]])||[]); });
    var g={}, tot=0; ops.forEach(function(o){ var k=o[2]||o[4]||'Autres revenus'; var x=g[k]||(g[k]={n:k,par:o[4],sum:0,ops:[]}); x.sum+=o[3]; x.ops.push(o); tot+=o[3]; });
    var list=Object.keys(g).map(function(k){ g[k].ops.sort(function(a,b){return a[0]<b[0]?1:-1}); return g[k]; }).sort(function(a,b){return b.sum-a.sum});
    return {list:list,tot:tot,n:ops.length}; }
  function revSection(){ var P_=per(), R=revGroups(), mx=Math.max.apply(null,R.list.map(function(x){return x.sum}).concat([1])), sel=R.list.filter(function(x){return x.n===S.revSel})[0];
    var body=R.list.length? R.list.map(function(x){ return '<button class="prow" data-rsel="'+esc(x.n)+'" aria-pressed="'+(sel===x)+'" aria-label="'+esc(x.n)+' : '+Math.round(x.sum)+' euros"><span class="ptop"><span class="pnm">'+esc(x.n)+'</span><span class="psm pct">'+Math.round(x.sum/R.tot*100)+' %</span><span class="pamt">'+eur(x.sum)+'</span></span><span class="pvis dep"><i data-w="'+(x.sum/mx*100).toFixed(1)+'"></i></span></button>'; }).join('')
      : '<p class="muted" style="padding:16px 4px">Aucun revenu sur cette période.</p>';
    var ops=sel?sel.ops:[];
    return '<div class="row"><h2 style="font-size:18px">Sources de revenus</h2><span class="muted" style="font-size:12px">'+esc(P_.label)+'</span></div>'+
      '<p class="muted" style="font-size:13px;margin:-6px 0 0">Revenus reçus : <b style="color:var(--text)">'+eur(R.tot)+'</b>'+(P_.isYear?' sur l\'année':' sur le mois')+', '+R.n+' opération'+(R.n>1?'s':'')+'.</p>'+
      '<div class="card syn">'+body+'<div class="gapl muted" style="margin-top:4px">Regroupées par catégorie. Le pourcentage est la part dans les revenus de la période. Les mouvements entre vos comptes sont exclus. Touchez une source pour voir ses opérations.</div></div>'+
      (sel?'<div class="row"><h3 style="font-size:16px">Opérations · '+esc(sel.n)+'</h3></div><div class="card" style="padding:4px 14px">'+opsList(ops.slice(0,40).map(function(o){return [o[0],o[1],sel.n,o[3],0]}))+'</div>':''); }
  function avgLine(){ var t=CATS.reduce(function(s,c){return s+(c.avgm||0)},0); return '<p class="muted" style="font-size:13px;margin:-6px 0 0">Dépenses moyennes : <b style="color:var(--text)">'+eur(t)+'</b> par mois, sur '+S.f.moy+' mois.</p>'; }
  function postesTitle(){ var c=S.f.poste?CATS.filter(function(x){return x.id===S.f.poste})[0]:null; return c?(S.f.sous?'Sous-poste':'Sous-postes'):(S.lvl==='sub'?'Enseignes':'Postes'); }
  function postesList(){ var c=S.f.poste?CATS.filter(function(x){return x.id===S.f.poste})[0]:null;
    if(!c) return compactCard(CATS);
    var list=S.f.sous? c.subs.filter(function(s){return s.n===S.f.sous}) : c.subs;
    return '<button class="back" data-act="clearposte" style="min-height:36px">'+ico(I.back)+esc(c.n)+' · retirer le filtre</button>'+compactCard(list,true);
  }
  function opsList(arr,pick){ return arr.map(function(o){ return '<'+(pick?'button data-msel="'+esc(cleanLabel(o[1]))+'" aria-pressed="'+(S.merch===cleanLabel(o[1]))+'"':'div')+' class="opline"'+(pick?' style="width:100%;border:0;background:transparent;text-align:left;color:inherit;font-family:inherit;cursor:pointer"':'')+'><div class="l"><span style="font-weight:600;font-size:14px">'+esc(o[1])+'</span><span class="muted" style="font-size:12px">'+esc(fmtDate(o[0]))+(o[4]?' · à venir':'')+' · '+esc(o[2])+'</span></div><span class="amt '+(o[3]>0?'pos':'')+'" style="font-weight:600">'+(S.hide?'••••':(o[3]>0?'+':'')+eur(o[3],true))+'</span></'+(pick?'button':'div')+'>'; }).join(''); }

  /* ---------- Insights d'un poste ---------- */
  /* repères : HCSF (taux d'effort max d'un crédit immobilier, en % des revenus) et Insee, enquête Budget de famille 2017 (part de chaque poste dans la consommation des ménages) */
  var REPERES={
    'Logement':{kind:'salaire',v:35,src:'HCSF',nom:'taux d’effort maximal d’un crédit immobilier'},
    'Alimentation':{kind:'dep',v:16.1,src:'Insee',nom:'part de l’alimentation dans la consommation des ménages'},
    'Loisirs et sorties':{kind:'dep',v:16.6,src:'Insee',nom:'part des loisirs, de la culture, de la restauration et des hôtels'},
    'Transports et voyages':{kind:'dep',v:16.4,src:'Insee',nom:'part des transports'},
    'Shopping et équipement':{kind:'dep',v:10.7,src:'Insee',nom:'part de l’habillement et de l’équipement du logement'},
    'Abonnements et télécoms':{kind:'dep',v:2.7,src:'Insee',nom:'part des communications'},
    'Santé':{kind:'dep',v:1.8,src:'Insee',nom:'part de la santé, après remboursements'} };
  function insightsCard(c,sb){ var t=sb||c;
    var P_=per(); if(P_.isYear||!P_.idxs.length) return '';
    var hasTd=!!(P_.cur&&t.td), idx=P_.idxs[0], all=t.all||[], td=hasTd?t.td:all, tot=sum(CATS.map(function(x){return x.spent>0?x.spent:0}));
    function pctTxt(a,b){ if(!(b>0)) return null; var d=(a-b)/b*100, r=Math.round(Math.abs(d)); if(r===0) return {t:'0 %',k:'eq'}; return {t:(d>0?'▲ +':'▼ −')+r+' %',k:d>0?'up':'dn'}; }
    var now=td[idx]||0, rows=[], mx=Math.max(now,1);
    var label=MOIS_L[+P_.mo-1], yy=+P_.y;
    function addRow(nm,sub,v){ if(v==null) return; rows.push({nm:nm,sub:sub,v:v,p:pctTxt(now,v)}); mx=Math.max(mx,v); }
    var cmpSub=hasTd?'même période':'mois entier';
    if(idx>=1) addRow('Mois dernier',cmpSub,td[idx-1]||0);
    if(idx>=12) addRow(label.charAt(0).toUpperCase()+label.slice(1)+' '+(yy-1),cmpSub,td[idx-12]||0);
    var prior=all.slice(Math.max(0,idx-12),idx); if(prior.length>=3) addRow('Moyenne '+prior.length+' mois','mois entiers',sum(prior)/prior.length);
    var evo='<div class="ins-sec"><h3 class="ins-h">Évolution</h3><div class="muted" style="font-size:11.5px">Le pourcentage est l’écart de '+(P_.cur?'ce mois-ci':'ce mois')+' par rapport à chaque période.</div>'+
      '<div class="ins-row now"><div class="ins-top"><span class="ins-nm">'+(P_.cur?'Ce mois-ci':'Ce mois')+' <small>'+(hasTd?'du 1er au '+DAY:(P_.cur?'à venir compris':'mois entier'))+'</small></span><span class="ins-v">'+eur(now)+'</span></div><span class="ins-bar"><i style="width:'+(now/mx*100).toFixed(1)+'%"></i></span></div>'+
      rows.map(function(r){ return '<div class="ins-row"><div class="ins-top"><span class="ins-nm">'+esc(r.nm)+' <small>'+r.sub+'</small></span><span class="ins-v">'+eur(r.v)+(r.p?' <span class="ins-chip '+r.p.k+'">'+r.p.t+'</span>':'')+'</span></div><span class="ins-bar"><i style="width:'+(r.v/mx*100).toFixed(1)+'%"></i></span></div>'; }).join('')+'</div>';
    var sal=D.kpi&&D.kpi.salary>0?D.kpi.salary:0, full=t.spent, sh=sal>0?full/sal*100:null, ds=tot>0?full/tot*100:null, rep=sb?null:REPERES[c.n], poids='';
    if(rep&&((rep.kind==='salaire'&&sh!=null)||(rep.kind==='dep'&&ds!=null))){
      var val=rep.kind==='salaire'?sh:ds, over=val>rep.v+(rep.kind==='dep'?1.5:0), near=rep.kind==='dep'&&Math.abs(val-rep.v)<=1.5, sc=Math.max(rep.v*1.5,val*1.15), diff=Math.round(Math.abs(val-rep.v));
      var pill=near?'<span class="ins-pill neu">proche de la moyenne</span>':'<span class="ins-pill '+(over?'bad':'ok')+'">'+diff+' point'+(diff>1?'s':'')+(rep.kind==='salaire'?(over?' au-dessus du repère':' sous le repère'):(over?' au-dessus de la moyenne':' en dessous de la moyenne'))+'</span>';
      poids='<div class="ins-sec"><h3 class="ins-h">Poids dans le budget</h3>'+pill+'<div class="ins-gauge'+(over?' over':'')+'"><i style="width:'+Math.min(val/sc*100,100).toFixed(1)+'%"></i><b style="left:'+(rep.v/sc*100).toFixed(1)+'%"></b><em style="left:'+(rep.v/sc*100).toFixed(1)+'%">'+(rep.kind==='salaire'?'repère':'moyenne')+' '+String(rep.v).replace('.',',')+' %</em></div>'+
        '<div class="muted" style="font-size:12.5px;line-height:1.4">'+(rep.kind==='salaire'?Math.round(val)+' % de votre salaire net ('+eur(sal)+').':Math.round(val)+' % de vos dépenses du mois'+(sh!=null?', soit '+Math.round(sh)+' % de votre salaire net.':'.'))+' Repère : '+rep.nom+' ('+rep.src+') : '+String(rep.v).replace('.',',')+' %'+(rep.kind==='salaire'?' des revenus.':' des dépenses.')+'</div></div>';
    } else if(full>0&&(sh!=null||ds!=null||sb)){ var parts=[]; if(sb&&c.spent>0) parts.push(Math.round(full/c.spent*100)+' % du poste '+esc(c.n)); if(ds!=null) parts.push(Math.round(ds)+' % de vos dépenses du mois'); if(sh!=null) parts.push(Math.round(sh)+' % de votre salaire net ('+eur(sal)+')'); poids='<div class="ins-sec"><h3 class="ins-h">Poids dans le budget</h3><div class="muted" style="font-size:12.5px;line-height:1.4">'+parts.join(' · ')+'.</div></div>'; }
    var facts=[];
    if(t.fixed){ var run=0; for(var i=idx-1;i>=0;i--){ if(Math.abs((all[i]||0)-t.fixed)<=t.fixed*0.08) run++; else break; } facts.push(['Montant fixe : '+eur(t.fixed),run>=2?'Même montant depuis '+run+' mois.':'Même montant ces derniers mois.']); }
    var sameMonth=(t.ops||[]).filter(function(o){return String(o[0]).slice(0,7)===P_.key&&o[2]<0}).sort(function(a,b){return a[2]-b[2]})[0];
    if(sameMonth) facts.push(['Plus grosse opération : '+eur(-sameMonth[2]),(esc(sameMonth[1])+', le '+esc(fmtDate(sameMonth[0]))+'.').replace(/\.\.$/,'.')]);
    if(idx>=12&&now>0){ var dly=now-(td[idx-12]||0); if(Math.abs(dly)>=1) facts.push([(dly>0?'+':'−')+eur(Math.abs(dly))+' sur un an',label.charAt(0).toUpperCase()+label.slice(1)+' '+(yy-1)+' : '+eur(td[idx-12]||0)+(hasTd?' à la même date.':'.')]); }
    var top=sb?null:(c.subs||[]).slice().sort(function(a,b){return b.spent-a.spent})[0];
    if(top&&top.spent>0&&c.spent>0&&c.subs.length>1) facts.push(['Premier sous-poste : '+esc(top.n),Math.round(top.spent/c.spent*100)+' % du poste ('+eur(top.spent)+').']);
    var fh=facts.length?'<div class="ins-sec"><h3 class="ins-h">À retenir</h3>'+facts.slice(0,3).map(function(f){ return '<div class="ins-fact"><i></i><div><b>'+f[0]+'</b><span>'+f[1]+'</span></div></div>'; }).join('')+'</div>':'';
    return '<h3 style="font-size:16px">Insights'+(sb?' · '+esc(sb.n):'')+'</h3><div class="card ins">'+evo+poids+fh+'</div>'; }
  /* insights d'un marchand : dernier niveau après poste et sous-poste */
  function merchantCard(){ var key=S.merch; if(!key) return ''; var P_=per(); if(P_.isYear){ var tk=D.today.month; P_={isYear:false,cur:true,key:tk,y:tk.slice(0,4),mo:tk.slice(5,7)}; }
    var ks=(D.keys||[]), idx=ks.indexOf(P_.key); if(idx<0) return '';
    var lim=P_.cur?DAY:31, by={}, n=0, last=null, big=null, M=D.merch&&D.merch[key];
    if(M){ n=M[0]; last=[M[1],'',0,-M[2]]; big=[M[3],'',0,-M[4]]; Object.keys(M[5]).forEach(function(m){ by[m]={all:M[5][m][0],td:M[5][m][1]}; }); }
    else (D.ops||[]).forEach(function(o){ if(o[3]>=0||o[4]||cleanLabel(o[1])!==key) return; var m=o[0].slice(0,7), d=+o[0].slice(8,10); (by[m]=by[m]||{td:0,all:0}).all+=-o[3]; if(d<=lim) by[m].td+=-o[3]; n++; if(!last||o[0]>last[0]) last=o; if(!big||o[3]<big[3]) big=o; });
    var td=P_.cur, g=function(m){ var x=by[m]; return x?(td?x.td:x.all):0; }, now=g(P_.key), rows=[], mx=Math.max(now,1);
    function pctTxt(a,b){ if(!(b>0)) return null; var d=(a-b)/b*100, r=Math.round(Math.abs(d)); if(r===0) return {t:'0 %',k:'eq'}; return {t:(d>0?'▲ +':'▼ −')+r+' %',k:d>0?'up':'dn'}; }
    function add(nm,sub,v){ rows.push({nm:nm,sub:sub,v:v,p:pctTxt(now,v)}); mx=Math.max(mx,v); }
    var sub=td?'même période':'mois entier', label=MOIS_L[+P_.mo-1];
    if(idx>=1) add('Mois dernier',sub,g(ks[idx-1]));
    if(idx>=12) add(label.charAt(0).toUpperCase()+label.slice(1)+' '+(+P_.y-1),sub,g(ks[idx-12]));
    var pr=ks.slice(Math.max(0,idx-12),idx); if(pr.length>=3) add('Moyenne '+pr.length+' mois','mois entiers',sum(pr.map(function(m){return by[m]?by[m].all:0}))/pr.length);
    var evo='<div class="ins-sec"><h3 class="ins-h">Évolution</h3><div class="ins-row now"><div class="ins-top"><span class="ins-nm">'+(P_.cur?'Ce mois-ci':'Ce mois')+' <small>'+(td?'du 1er au '+DAY:'mois entier')+'</small></span><span class="ins-v">'+eur(now)+'</span></div><span class="ins-bar"><i style="width:'+(now/mx*100).toFixed(1)+'%"></i></span></div>'+
      rows.map(function(r){ return '<div class="ins-row"><div class="ins-top"><span class="ins-nm">'+esc(r.nm)+' <small>'+r.sub+'</small></span><span class="ins-v">'+eur(r.v)+(r.p?' <span class="ins-chip '+r.p.k+'">'+r.p.t+'</span>':'')+'</span></div><span class="ins-bar"><i style="width:'+(r.v/mx*100).toFixed(1)+'%"></i></span></div>'; }).join('')+'</div>';
    var fake={id:'m|'+key,n:key,all:ks.map(function(m){return by[m]?by[m].all:0})};
    var tot=sum(Object.keys(by).map(function(m){return by[m].all})), facts=[];
    if(n) facts.push([n+' opération'+(n>1?'s':'')+' · '+eur(tot/n,true)+' en moyenne','Au total '+eur(tot)+' depuis le début des données.']);
    if(big) facts.push(['Plus grosse : '+eur(-big[3],true),'Le '+fmtDate(big[0])+'.']);
    if(last) facts.push(['Dernière : '+eur(-last[3],true),'Le '+fmtDate(last[0])+'.']);
    var fh='<div class="ins-sec"><h3 class="ins-h">À retenir</h3>'+facts.map(function(f){ return '<div class="ins-fact"><i></i><div><b>'+f[0]+'</b><span>'+f[1]+'</span></div></div>'; }).join('')+'</div>';
    var mops=M&&M[6]?M[6].filter(function(x){return x[0].slice(0,7)===P_.key}).sort(function(a,b){return a[0]<b[0]?1:-1}):null;
    var ol=mops?'<div class="row"><h3 style="font-size:16px">Opérations de '+esc(label)+' '+esc(P_.y)+'</h3></div><div class="card" style="padding:4px 14px">'+(mops.length?opsList(mops.map(function(x){return [x[0],key,x[2]||'—',-x[1],0]})):'<p class="muted" style="padding:14px 0">Aucune opération ce mois-ci pour ce marchand.</p>')+'</div>':'';
    return '<div class="mcard row" style="scroll-margin-top:12px"><h3 style="font-size:16px">Insights · '+esc(key)+'</h3><button class="back" data-msel="'+esc(key)+'" style="min-height:32px;font-size:12.5px">Fermer</button></div><div class="card">'+chartInner(fake)+'</div><div class="card ins">'+evo+(n?fh:'')+'</div>'+ol; }
  /* opérations d'un poste (ou sous-poste) pour le mois ou l'année choisis : historique complet via D.merch ; null si les chiffres en mémoire sont anciens */
  /* enseignes (marchands) par poste et sous-poste sur la période affichée : { 'poste|sous': { enseigne: montant } } ; null si l'historique n'est pas disponible */
  var _tm=null;
  function topMap(){ var M=D&&D.merch; if(!M) return null; var P_=per(), ck=(P_.isYear?P_.y:P_.key)+'|'+(D.stats?D.stats.rows:0); if(_tm&&_tm.ck===ck) return _tm.m;
    var m={};
    Object.keys(M).forEach(function(k){ (M[k][6]||[]).forEach(function(e){ if(e.length<4) return; if(P_.isYear?e[0].slice(0,4)!==P_.y:e[0].slice(0,7)!==P_.key) return; if(!(e[1]>0)) return;
      [e[2]+'|'+e[3],e[2]+'|'].forEach(function(a){ var o=m[a]||(m[a]={}); o[k]=(o[k]||0)+e[1]; }); }); });
    _tm={ck:ck,m:m}; return m; }
  function topOf(poste,sous,n){ var m=topMap(), o=m&&m[poste+'|'+(sous||'')]; if(!o) return []; return Object.keys(o).map(function(k){return [k,o[k]]}).sort(function(a,b){return b[1]-a[1]}).slice(0,n||8); }
  /* classement des enseignes (qui m'a fait payer le plus) sur la période affichée */
  function enseignesList(){ var M=D&&D.merch, P_=per(), rows=[], tot=0;
    if(M) Object.keys(M).forEach(function(k){ var by={}, t=0;
      (M[k][6]||[]).forEach(function(e){ if(e.length<4||!(e[1]>0)) return; if(P_.isYear?e[0].slice(0,4)!==P_.y:e[0].slice(0,7)!==P_.key) return; t+=e[1]; var a=e[2]+'|'+e[3]; by[a]=(by[a]||0)+e[1]; });
      if(t<=0) return; var best=Object.keys(by).sort(function(a,b){return by[b]-by[a]})[0].split('|'); tot+=t; rows.push({k:k,t:t,poste:best[0],sous:best[1]}); });
    rows.sort(function(a,b){return b.t-a.t});
    var shown=S.all?rows:rows.slice(0,10), mx=Math.max(rows.length?rows[0].t:1,1);
    var body=shown.length? shown.map(function(r,i){ var nm=(r.sous&&r.sous!==r.poste)?r.poste+' · '+r.sous:r.poste;
      return '<button class="prow" data-msel="'+esc(r.k)+'" aria-pressed="'+(S.merch===r.k)+'"><span class="ptop"><span class="pnm">'+(i+1)+'. '+esc(r.k)+'<small class="muted" style="display:block;font-size:11px;font-weight:500;line-height:1.2">'+esc(nm)+'</small></span><span class="psm pct">'+(tot>0?Math.round(r.t/tot*100)+' %':'')+'</span><span class="pamt">'+eur(r.t)+'</span></span><span class="pvis dep"><i data-w="'+(tot>0?r.t/tot*100:0).toFixed(1)+'"></i></span></button>'; }).join('')
      : '<p class="muted" style="padding:16px 4px">Historique des enseignes indisponible. Relisez le dossier dans Plus.</p>';
    return '<div class="card syn"><div class="switch"><span>Détailler par enseigne</span><button class="tog" data-act="lvl" aria-pressed="true" aria-label="Détailler par enseigne"></button></div>'+body+
      (rows.length>10?'<button class="back" data-act="allpostes" style="min-height:40px;align-self:flex-start;font-size:13px">'+(S.all?'Réduire la liste':'Voir les '+(rows.length-10)+' autres')+'</button>':'')+'</div>'; }
  function enseignesCard(c,sb){ var list=topOf(c.n,sb?sb.n:'',8); if(!list.length) return '';
    var mx=Math.max.apply(null,list.map(function(x){return x[1]}).concat([1]));
    return '<div class="row"><h3 style="font-size:16px">Enseignes · '+esc(sb?sb.n:c.n)+'</h3></div><div class="card syn">'+list.map(function(x){
      return '<button class="prow" data-msel="'+esc(x[0])+'" aria-pressed="'+(S.merch===x[0])+'"><span class="ptop"><span class="pnm">'+esc(x[0])+'</span><span class="pamt">'+eur(x[1])+'</span></span><span class="pvis dep"><i data-w="'+(x[1]/mx*100).toFixed(1)+'"></i></span></button>'; }).join('')+'</div>'; }
  function monthOps(c,sb){ var M=D.merch; if(!M) return null; var P_=per(), out=[], old=false;
    Object.keys(M).forEach(function(k){ M[k][6].forEach(function(e){ if(e.length<4){ old=true; return; } if(e[2]!==c.n) return; if(sb&&e[3]!==sb.n) return; if(P_.isYear?e[0].slice(0,4)!==P_.y:e[0].slice(0,7)!==P_.key) return; out.push([e[0],k,e[1]]); }); });
    if(old) return null; return out.sort(function(a,b){ return a[0]<b[0]?1:a[0]>b[0]?-1:0; }); }
  function detailScreen(){ var c=CATS.filter(function(x){return x.id===S.open})[0]; if(!c){ S.open=null; return homeScreen(); } var sbSel=S.subSel?c.subs.filter(function(x){return x.n===S.subSel})[0]:null, s=status(c), tot=sum(CATS.map(function(x){return x.spent>0?x.spent:0})), share=tot>0&&c.spent>0? '<div style="text-align:right;line-height:1.15;flex:none"><div style="font-size:22px;font-weight:700;color:var(--accent)">'+Math.round(c.spent/tot*100)+' %</div><div class="muted" style="font-size:11.5px">des dépenses</div></div>' : '';
    return '<button class="back" data-act="close">'+ico(I.back)+'Accueil</button><div class="row"><h1 style="margin:0">'+esc(c.n)+'</h1><span class="badge '+s.k+'">'+s.t+'</span></div>'+
    '<div class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px"><div style="font-size:30px;font-weight:600">'+eur(c.spent)+'</div>'+share+'</div><div class="muted" style="font-size:13px;margin:2px 0 12px">sur une moyenne de '+eur(c.avg)+' ('+S.f.moy+' mois)</div>'+bar2(c)+'</div>'+'<div class="card">'+chartInner(c,sbSel)+'</div>'+(sbSel?'':'<div class="card list"><button class="switch" data-act="insp" aria-expanded="'+!!S.insP+'" style="width:100%;border:0;background:transparent;text-align:left;min-height:44px;font-size:inherit"><span>Insights du poste</span><span class="muted">'+(S.insP?'⌃':'⌄')+'</span></button></div>'+(S.insP?insightsCard(c):''))+
    '<h3 style="font-size:16px">Sous-postes</h3>'+compactCard(c.subs,true)+enseignesCard(c,sbSel)+(sbSel?insightsCard(c,sbSel):'')+merchantCard()+
    (function(){ var sb=S.subSel?c.subs.filter(function(x){return x.n===S.subSel})[0]:null, src=sb?sb.ops:c.ops, lbl=sb?sb.n:c.n;
      var mo=monthOps(c,sb), P_=per();
      if(mo) return '<div class="row"><h3 style="font-size:16px">Opérations'+(sb?' · '+esc(sb.n):'')+' · '+esc(P_.label)+'</h3>'+(sb?'<button class="back" data-ssel="'+esc(sb.n)+'" style="min-height:32px;font-size:12.5px">Voir tout le poste</button>':'')+'</div><div class="card" style="padding:4px 14px">'+opsList(mo.slice(0,80).map(function(o){return [o[0],o[1],lbl,-o[2],0]}),true)+(mo.length?(mo.length>80?'<p class="muted" style="font-size:12px;padding:10px 0">80 opérations affichées sur '+mo.length+'.</p>':''):'<p class="muted" style="padding:14px 0">Aucune opération ce mois-ci pour '+(sb?'ce sous-poste.':'ce poste.')+'</p>')+'</div>';
      var fb=src.filter(function(o){ return P_.isYear?o[0].slice(0,4)===P_.y:o[0].slice(0,7)===P_.key; });
      return '<div class="row"><h3 style="font-size:16px">Opérations'+(sb?' · '+esc(sb.n):'')+' · '+esc(P_.label)+'</h3>'+(sb?'<button class="back" data-ssel="'+esc(sb.n)+'" style="min-height:32px;font-size:12.5px">Voir tout le poste</button>':'')+'</div><div class="card" style="padding:4px 14px">'+opsList(fb.slice(0,20).map(function(o){return [o[0],o[1],lbl,o[2],o[3]]}),true)+(fb.length?'':'<p class="muted" style="padding:14px 0">Aucune opération récente pour ce mois. Appuyez sur la flèche Actualiser en haut pour charger tout l’historique.</p>')+'</div>'; })(); }
  function opsScreen(){ var q=S.q.toLowerCase(), r=D.ops.filter(function(o){return !q||(o[1]+' '+o[2]).toLowerCase().indexOf(q)>-1}), shown=r.slice(0,150);
    return header()+'<h1>Opérations</h1><input type="search" id="q" placeholder="Rechercher un libellé ou une catégorie" aria-label="Rechercher une opération" value="'+esc(S.q)+'">'+merchantCard()+'<div class="card list" id="oplist">'+opsHtml(r,shown)+'</div>'; }
  function opsHtml(r,shown){ return r.length? opsList(shown,true)+(r.length>shown.length?'<p class="muted" style="font-size:12px;padding:10px 0">'+shown.length+' sur '+r.length+' opérations. Affinez la recherche pour voir les autres.</p>':'') : '<p class="muted" style="padding:16px 0">Aucune opération ne correspond à cette recherche.</p>'; }
  function plusScreen(){ var dark=S.theme==='dark', s=D.sync||{}, st=D.stats;
    return '<h1>Plus</h1>'+analyseTeaser()+'<div class="card list"><button class="switch" data-tab="bud" style="width:100%;border:0;background:transparent;text-align:left;min-height:44px;font-size:inherit"><span style="display:flex;align-items:center;gap:10px">Budgets</span><span class="muted">›</span></button><button class="switch" data-sub="rules" style="width:100%;border:0;background:transparent;text-align:left;min-height:44px;font-size:inherit"><span style="display:flex;align-items:center;gap:10px">Règles de catégorisation</span><span class="muted">›</span></button><button class="switch" data-sub="bilan" style="width:100%;border:0;background:transparent;text-align:left;min-height:44px;font-size:inherit"><span style="display:flex;align-items:center;gap:10px">Bilan annuel</span><span class="muted">›</span></button><button class="switch" data-sub="rapport" style="width:100%;border:0;background:transparent;text-align:left;min-height:44px;font-size:inherit"><span>Rapport d’analyse</span><span class="muted">›</span></button><button class="switch" data-sub="vacances" style="width:100%;border:0;background:transparent;text-align:left;min-height:44px;font-size:inherit"><span style="display:flex;align-items:center;gap:10px">Vacances</span><span class="muted">›</span></button><button class="switch" data-sub="epargne" style="width:100%;border:0;background:transparent;text-align:left;min-height:44px;font-size:inherit"><span style="display:flex;align-items:center;gap:10px">Épargne et Livret A</span><span class="muted">›</span></button></div><div class="card" style="padding:4px 16px"><div class="switch"><span>Masquer les montants</span><button class="tog" data-act="hide" aria-pressed="'+S.hide+'" aria-label="Masquer les montants"></button></div><div class="switch"><span>Thème sombre</span><button class="tog" data-act="theme" aria-pressed="'+dark+'" aria-label="Thème sombre"></button></div>'+(S.lockAvail?'<div class="switch"><span>Verrouiller avec l\'empreinte</span><button class="tog" data-act="lock" aria-pressed="'+Lock.enabled()+'" aria-label="Verrouiller avec l\'empreinte"></button></div>':'')+'</div>'+
    '<div class="card" style="display:flex;flex-direction:column;gap:8px"><h3 style="font-size:15px">Vos données</h3>'+
      '<div class="muted" style="font-size:13px;line-height:1.5">Export du '+esc(fmtDate(s.fileDate||st.to))+' · '+st.rows+' opérations'+(s.lastSync?' · synchro '+esc(String(s.lastSync).slice(11,16)):'')+'</div>'+
      '<button class="fbtn" data-act="sync"'+(S.syncing?' disabled':'')+'>'+(S.syncing?'Lecture du dossier…':'Relire le dossier maintenant')+'</button>'+
      '</div><div class="card" style="display:flex;flex-direction:column;gap:8px"><div class="muted" style="font-size:13px">Version de l\'application : <b style="color:var(--text)">'+esc((window.BANQUE_CONFIG&&BANQUE_CONFIG.BUILD)||'?')+'</b></div><button class="fbtn ghost" data-act="forceupdate" style="width:100%">Forcer la mise à jour</button></div><button class="fbtn ghost" data-act="signout">Se déconnecter et effacer les données de cet appareil</button>'; }




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
    h.push('<button class="back" data-act="subclose">'+ico(I.back)+'Plus</button><h1>Analyse du mois</h1><p class="muted" style="font-size:13px;margin:-8px 0 0">'+esc(A.month)+' · jour '+DAY+' sur '+DAYS+'</p>');
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
    return '<div class="card list"><button class="switch" data-sub="analyse" style="width:100%;border:0;background:transparent;text-align:left;color:inherit;font:inherit;min-height:44px"><div style="min-width:0"><div style="font-size:15px;font-weight:600">Analyse du mois</div><div class="muted" style="font-size:12px;line-height:1.4;margin-top:2px">'+(n?n+' point'+(n>1?'s':'')+' à regarder · ':'Rien d\'alarmant · ')+eur(A.depNow)+' dépensés à ce jour</div></div><span class="muted">›</span></button></div>'; }

  /* ---------- règles de catégorisation ---------- */
  function cleanLabel(l){ return String(l||'').replace(/^(CARTE|PRLV|VIR|SEPA|PAIEMENT)\s+/gi,'').replace(/\s+/g,' ').trim(); }
  function uncategorised(){ var seen={}, out=[]; (D.ops||[]).forEach(function(o){ if(o[4]) return; if(!/non\s*cat/i.test(o[2]||'Non catégorisé')&&o[2]) return; var k=o[1]; if(seen[k]) { seen[k].n++; seen[k].sum+=o[3]; return; } seen[k]={l:o[1],n:1,sum:o[3],d:o[0]}; out.push(seen[k]); });
    return out.sort(function(a,b){return Math.abs(b.sum)-Math.abs(a.sum)}).slice(0,15); }
  function rulesScreen(){ var R=S.rule||(S.rule={motif:'',poste:'',nouveau:''}), rules=D.rules||[], names=D.cats.map(function(c){return c.n}), unc=uncategorised(), isNew=R.poste==='__new';
    return '<button class="back" data-act="subclose">'+ico(I.back)+'Plus</button><h1>Règles de catégorisation</h1>'+
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
      (x.hausse?'<span class="badge warn" style="align-self:flex-start;margin-top:4px">Hausse : '+eur(x.hausse.from,true)+' → '+eur(x.hausse.to,true)+'</span>':'')+(x.par==='Non catégorisé'?'<button class="badge warn" data-rpickn="'+esc(x.n)+'" style="align-self:flex-start;margin-top:4px;border:0;cursor:pointer">À classer</button>':'')+(x.nouveau&&!x.hausse?'<span class="badge ok" style="align-self:flex-start;margin-top:4px">Nouveau</span>':'')+'</div><span style="font-weight:600;text-align:right">'+(x.yearly?eur(x.yearly,true)+' <small class="muted" style="font-weight:500">/ an</small>':eur(x.amt,true))+'</span></div>'; }
  function subsScreen(){ var B=D.subs||{list:[],total:0,count:0}, act=B.list.filter(function(x){return x.active}), off=B.list.filter(function(x){return !x.active}), watch=act.filter(function(x){return x.hausse||x.nouveau});
    return header()+'<h1>Abonnements</h1>'+
    '<div class="tiles"><div class="tile"><span class="muted" style="font-size:13px">Par mois</span><span class="kv">'+eur(B.total,true)+'</span><span class="note">'+B.count+' abonnement'+(B.count>1?'s':'')+' actif'+(B.count>1?'s':'')+'</span></div><div class="tile"><span class="muted" style="font-size:13px">Par an</span><span class="kv">'+eur(B.total*12)+'</span>'+(watch.length?'<span class="badge warn"><b>'+watch.length+' à surveiller</b></span>':'<span class="note">aucune hausse</span>')+'</div></div>'+
    (watch.length?'<h3>À surveiller</h3><div class="card list">'+watch.map(subLine).join('')+'</div>':'')+
    '<h3>'+(watch.length?'Autres abonnements actifs':'Actifs')+'</h3><div class="card list">'+(act.length-watch.length?act.filter(function(x){return !(x.hausse||x.nouveau)}).map(subLine).join(''):'<p class="muted" style="padding:16px 0">Aucun prélèvement récurrent repéré.</p>')+'</div>'+
    (off.length?'<h3>Arrêtés ou à vérifier</h3><div class="card list">'+off.map(subLine).join('')+'</div>':'')+
    '<p class="note pad">Repérés automatiquement : au moins 3 prélèvements d\'un montant stable, environ un par mois. Un loyer ou un crédit peut y figurer.</p>'; }

  /* ---------- budgets ---------- */
  function budInfo(c){ var set=D.budgets&&D.budgets[c.n], cap=set||Math.max(Math.round(c.avg),1), p=c.spent/cap, proj=DAY>=5?c.spent/ELAPSED:c.spent, k, t;
    if(c.spent>cap){ k='bad'; t='Dépassé'; } else if(proj>cap*1.1&&c.spent-cap*ELAPSED>MIN_EUR){ k='warn'; t='Rythme élevé'; } else { k='ok'; t='Dans le budget'; }
    return {c:c,cap:cap,set:!!set,p:p,k:k,t:t,left:cap-c.spent}; }
  function budScreen(){ return onCurrentMonth(budScreenRaw); }
  function budScreenRaw(){ var items=CATS.filter(function(c){return c.spent>0||c.avg>10}).map(budInfo).sort(function(a,b){return b.c.spent-a.c.spent});
    var tc=items.reduce(function(a,x){return a+x.cap},0), ts=items.reduce(function(a,x){return a+x.c.spent},0);
    return header()+'<h1>Budgets</h1>'+
    '<div class="card list">'+items.map(function(x){ var ed=S.bud===x.c.id, over=x.p>1;
      return '<div class="prow" style="cursor:default"><button class="budhead" data-bud="'+esc(x.c.id)+'" aria-expanded="'+ed+'" style="display:block;width:100%;border:0;background:transparent;text-align:left;padding:0;color:inherit"><span class="ptop"><span class="pnm">'+esc(x.c.n)+'</span><span class="psm pct" style="color:'+(over?'var(--bad)':'var(--text)')+'">'+Math.round(x.p*100)+' %</span><span class="pamt">'+eur(x.c.spent)+' / '+eur(x.cap)+'</span></span>'+
      '<span class="pbar" role="img" aria-label="'+Math.round(x.p*100)+' % du plafond dépensés"><i data-w="'+Math.min(x.p,1)*100+'" style="'+(x.k==='bad'?'background:linear-gradient(90deg,var(--warn),var(--bad))':x.k==='warn'?'background:var(--warn)':'')+'"></i></span></button>'+
      (ed?'<div style="display:flex;flex-direction:column;gap:8px;padding-top:10px"><label class="muted" style="font-size:12px" for="budin">Plafond mensuel (€)</label><input type="number" id="budin" inputmode="numeric" min="0" step="10" value="'+x.cap+'" style="min-height:44px;border-radius:14px;border:1px solid var(--track);background:var(--glass);color:var(--text);font-size:16px;padding:0 12px;font-family:inherit"><div style="display:flex;gap:8px"><button class="fbtn" style="flex:1;min-width:0" data-act="budsave" data-p="'+esc(x.c.n)+'">'+(S.budBusy?'Enregistrement…':'Enregistrer')+'</button><button class="fbtn ghost" style="flex:1;min-width:0" data-act="budreset" data-p="'+esc(x.c.n)+'">Moyenne</button></div></div>':'')+'</div>'; }).join('')+'</div>'+
    '<p class="note">Sans plafond, le budget d\'un poste est sa moyenne sur '+S.f.moy+' mois. Appuyez sur un poste pour fixer votre plafond. Il est enregistré dans votre Sheet.</p>'; }

  /* ---------- bilan annuel ---------- */

  /* ---------- Épargne : virements vers les autres comptes (Livret A…) ---------- */
  function livretCard(){ var Lv=D.livret; if(!Lv) return '';
    var usage=Lv.usage!=null?Math.min(100,Math.max(0,Lv.usage)):null;
    return '<h3 style="font-size:16px">Livret A <span class="muted" style="font-size:12px;font-weight:500">déclaré au '+esc(fmtDate(Lv.date))+'</span></h3><div class="card ins"><div class="ins-sec"><div style="font-size:30px;font-weight:600;letter-spacing:-.02em">'+eur(Lv.est)+'</div>'+
      '<div class="muted" style="font-size:12.5px;line-height:1.4">Solde déclaré '+eur(Lv.solde)+' au '+esc(fmtDate(Lv.date))+(Lv.nSince?', plus '+eur(Lv.since)+' versés depuis ('+Lv.nSince+' virement'+(Lv.nSince>1?'s':'')+' interne'+(Lv.nSince>1?'s':'')+').':', aucun versement depuis.')+'</div></div>'+
      (usage!=null?'<div class="ins-sec"><h3 class="ins-h">Plafond</h3><div class="pair" style="grid-template-columns:1fr auto;font-size:13px"><span>Plafond '+eur(Lv.plafond)+'</span><b>'+Math.round(Lv.usage)+' %</b></div><span class="pvis dep"><i data-w="'+usage.toFixed(1)+'"></i></span><div class="muted" style="font-size:12px">Il reste '+eur(Lv.reste)+' avant le plafond (hors intérêts acquis).</div></div>':'')+
      '<div class="ins-sec">'+(Lv.taux!=null?'<div class="pair" style="grid-template-columns:1fr auto;font-size:13px"><span>Taux de rémunération</span><b>'+String(Lv.taux).replace('.',',')+' %</b></div>':'')+
      (Lv.interets!=null?'<div class="pair" style="grid-template-columns:1fr auto;font-size:13px"><span>Intérêts nets en cours d’acquisition</span><b>'+eur(Lv.interets,true)+'</b></div>':'')+'</div>'+
      '<div class="muted" style="font-size:11.5px;line-height:1.4">Chiffres saisis dans le fichier Banque-regles.txt (ligne « @livret »). Mettez-les à jour quand vous voulez ; avec l’export du Livret A, la lecture devient automatique.</div></div>'; }
  function epargneScreen(){
    var E=D.epargne||{accounts:[],total:0}, SA=D.seriesAll||[], sa=SA.slice(-12);
    var sent=sum(sa.map(function(x){return x.sav||0})), allNet=sum(SA.map(function(x){return x.sav||0}));
    var mx=Math.max.apply(null,sa.map(function(x){return Math.abs(x.sav||0)}).concat([1]));
    function ml(k,first){ var m=+k.slice(5,7); return MOIS_C[m-1]+(m===1||first?' '+k.slice(2,4):''); }
    function rowsHtml(list,get){ var m=Math.max.apply(null,list.map(function(x){return Math.abs(get(x))}).concat([1]));
      return '<div class="ins-rows">'+list.map(function(x,i){ var v=get(x); return '<div class="ins-row'+(v<0?' neg':'')+'"><div class="ins-top"><span class="ins-nm">'+ml(x.k,i===0)+'</span><span class="ins-v">'+(v?(v<0?'−':'')+eur(Math.abs(v)):'—')+'</span></div><span class="ins-bar"><i style="width:'+(Math.abs(v)/m*100).toFixed(1)+'%"></i></span></div>'; }).join('')+'</div>'; }
    var h='<button class="back" data-act="subclose">'+ico(I.back)+'Plus</button><h1>Épargne</h1>';
    h+='<div class="card ins"><div class="ins-sec"><h3 class="ins-h">Mes livrets</h3><div class="muted" style="font-size:12.5px;line-height:1.4">Saisissez les soldes du jour. L’accueil affiche le Livret A et le LEP séparément ; les virements faits ensuite sont ajoutés au Livret A.</div>'+
      '<label class="fsel"><span>Livret A (€)</span><input id="eplivret" inputmode="decimal" autocomplete="off" value="'+(D.livret?String(D.livret.est).replace('.',','):'')+'" style="font:inherit"></label>'+
      '<label class="fsel"><span>LEP (€)</span><input id="eplep" inputmode="decimal" autocomplete="off" value="'+(D.lep?String(D.lep.solde).replace('.',','):'')+'" style="font:inherit"></label>'+
      (S.epErr?'<div class="badt" style="font-size:12px">'+esc(S.epErr)+'</div>':'')+
      '<button class="fbtn" data-act="saveep"'+(S.epBusy?' disabled':'')+' style="width:100%">'+(S.epBusy?'Enregistrement…':'Enregistrer')+'</button></div></div>';
    h+='<div class="card ins"><div class="ins-sec"><h3 class="ins-h">Mis de côté</h3><div style="font-size:30px;font-weight:600;letter-spacing:-.02em">'+eur(sent)+'</div><div class="muted" style="font-size:12.5px;line-height:1.4">envoyés vers vos autres comptes sur 12 mois, soit environ '+eur(sent/12)+' par mois. Depuis le début de l’historique : '+eur(allNet)+' nets.</div>'+rowsHtml(sa.map(function(x){return {k:x.k,v:x.sav||0}}),function(x){return x.v})+'<div class="muted" style="font-size:11.5px">Ces virements ne sont pas comptés dans vos dépenses. Un montant en moins (−) est un retour vers le compte courant.</div></div></div>';
    if(E.accounts.length){
      var recu=sum(E.accounts.map(function(a){return a.apports12}));
      E.accounts.forEach(function(a,i){ var open=S.epOpen===i, s12=a.series.slice(-12);
        h+='<h3 style="font-size:16px">'+esc(a.n)+' <span class="muted" style="font-size:12px;font-weight:500">••'+esc(String(a.num).slice(-4))+'</span></h3><div class="card ins"><div class="ins-sec"><div style="font-size:30px;font-weight:600;letter-spacing:-.02em">'+eur(a.solde)+'</div><div class="muted" style="font-size:12.5px;line-height:1.4">au '+esc(fmtDate(a.to))+' · '+a.count+' opérations depuis '+esc(fmtDate(a.from))+'</div>'+
          '<div class="pair" style="grid-template-columns:1fr auto;font-size:13px"><span>Versements, 12 mois</span><b>'+eur(a.apports12)+'</b></div>'+
          '<div class="pair" style="grid-template-columns:1fr auto;font-size:13px"><span>Intérêts, 12 mois</span><b>'+eur(a.interets12)+'</b></div>'+
          (a.interetsYtd?'<div class="pair" style="grid-template-columns:1fr auto;font-size:13px"><span>Intérêts versés cette année</span><b>'+eur(a.interetsYtd)+'</b></div>':'')+
          (a.retraits12>0?'<div class="pair" style="grid-template-columns:1fr auto;font-size:13px"><span>Retraits, 12 mois</span><b>'+eur(a.retraits12)+'</b></div>':'')+'</div>'+
          '<div class="ins-sec"><h3 class="ins-h">Versements par mois</h3>'+rowsHtml(s12,function(x){return x.dep})+'</div>'+
          '<button class="fbtn ghost" data-ep="'+i+'" style="width:100%">'+(open?'Masquer les opérations':'Voir les opérations')+'</button>'+(open?'<div style="padding:0 2px">'+opsList(a.ops.map(function(o){return [o[0],o[1],a.n,o[2],0]}))+'</div>':'')+'</div>'; });
      h+='<div class="card ins"><div class="ins-sec"><h3 class="ins-h">Rapprochement, 12 mois</h3>'+
        '<div class="pair" style="grid-template-columns:1fr auto;font-size:13px"><span>Envoyé depuis le compte courant</span><b>'+eur(sent)+'</b></div>'+
        '<div class="pair" style="grid-template-columns:1fr auto;font-size:13px"><span>Reçu sur vos comptes d’épargne</span><b>'+eur(recu)+'</b></div>'+
        '<div class="muted" style="font-size:11.5px;line-height:1.4">'+(Math.abs(sent-recu)<1?'Les deux montants correspondent.':'Écart de '+eur(Math.abs(sent-recu))+' : des virements ont pu partir vers un compte absent du dossier, ou avoir lieu à la limite des 12 mois.')+'</div></div>'+
        '<div class="ins-sec"><h3 class="ins-h">Total</h3><div class="pair" style="grid-template-columns:1fr auto;font-size:13px"><span>Compte courant</span><b>'+eur(D.soldeEstime!=null?D.soldeEstime:D.solde)+'</b></div><div class="pair" style="grid-template-columns:1fr auto;font-size:13px"><span>Épargne</span><b>'+eur(E.total)+'</b></div><div class="pair" style="grid-template-columns:1fr auto;font-size:15px"><span style="font-weight:600">Ensemble</span><b>'+eur((D.soldeEstime!=null?D.soldeEstime:D.solde)+E.total)+'</b></div></div></div>';
    } else {
      h+=livretCard();
      h+='<div class="card ins"><div class="ins-sec"><h3 class="ins-h">Ajouter votre Livret A</h3><div class="muted" style="font-size:13px;line-height:1.5">Pour voir le solde, les intérêts et les versements reçus :<br>1. Dans l’appli BoursoBank : Comptes, puis le menu (⋯) et « Exporter mes opérations ».<br>2. Choisissez le Livret A (vous pouvez cocher plusieurs comptes), la période la plus large, le format CSV, « Inclure les documents » désactivé.<br>3. Enregistrez le fichier dans le dossier « Export banque » de votre Drive.<br>4. Ici, ouvrez Plus puis « Relire le dossier maintenant ».</div><div class="muted" style="font-size:11.5px;line-height:1.4">L’appli sépare automatiquement ce compte du compte courant : vos dépenses et votre solde ne sont pas modifiés.</div></div></div>';
    }
    return h; }
  function bilanScreen(){ var B=D.bilan||{}, c=B.cur, p=B.prev;
    function delta(a,b,goodUp){ if(!b) return '<span class="muted">—</span>'; var d=(a-b)/b*100, up=d>=0, good=goodUp?up:!up; return '<span class="'+(Math.abs(d)<2?'muted':good?'okt':'badt')+'">'+(up?'+':'−')+Math.abs(Math.round(d))+' %</span>'; }
    function row(l,a,b,goodUp){ return '<div class="pair" style="grid-template-columns:1fr 78px 78px 52px;padding:9px 0;border-bottom:1px solid var(--rim-soft);font-size:13px"><span>'+l+'</span><span style="text-align:right;font-weight:600">'+eur(a)+'</span><span class="muted" style="text-align:right">'+eur(b)+'</span><span style="text-align:right">'+delta(a,b,goodUp)+'</span></div>'; }
    var cs=c?c.yRev-c.yDep:0, ps=p?p.yRev-p.yDep:0, top=c&&c.top.length?c.top:[];
    return '<button class="back" data-act="subclose">'+ico(I.back)+'Plus</button><h1>Bilan '+(c?c.y:'')+'</h1>'+
    (c?'<div class="card"><div class="muted" style="font-size:12px;margin-bottom:6px">Du 1er janvier au '+esc(fmtDate(D.today.iso))+', '+(p?'comparé à la même période en '+p.y:'')+'</div><div class="pair muted" style="grid-template-columns:1fr 78px 78px 52px;font-size:11px"><span></span><span style="text-align:right">'+c.y+'</span><span style="text-align:right">'+(p?p.y:'')+'</span><span style="text-align:right">Écart</span></div>'+
      row('Revenus',c.yRev,p?p.yRev:0,true)+row('Dépenses',c.yDep,p?p.yDep:0,false)+row('Épargne (revenus − dépenses)',cs,ps,true)+row('Impôts payés',c.yTax,p?p.yTax:0,false)+'</div>'+
      (p?'<div class="card"><div class="muted" style="font-size:13px">Année '+p.y+' complète</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px"><div><div class="muted" style="font-size:12px">Revenus</div><b>'+eur(p.rev)+'</b></div><div><div class="muted" style="font-size:12px">Dépenses</div><b>'+eur(p.dep)+'</b></div><div><div class="muted" style="font-size:12px">Épargne</div><b>'+eur(p.rev-p.dep)+'</b></div><div><div class="muted" style="font-size:12px">Impôts payés</div><b>'+eur(p.tax)+'</b></div></div></div>':'')+
      (top.length?'<h3 style="font-size:16px">Plus gros postes de '+c.y+'</h3><div class="card" style="padding:4px 16px">'+top.map(function(t){ return '<div class="switch"><span>'+esc(t[0])+'</span><b>'+eur(t[1])+'</b></div>'; }).join('')+'</div>':'')
      :'<div class="card muted">Pas encore d\'opérations pour cette année.</div>')+
    '<p class="note">Les mouvements entre vos comptes sont exclus. L\'épargne est la différence entre revenus et dépenses de la période.</p>'; }

  var TABS=[['home','Accueil',I.home],['subs','Abonnements',I.repeat],['fopen','Filtres',I.filter],['ops','Opérations',I.list],['plus','Plus',I.more]];
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
    if(S.tab==='plus') return S.sub==='bilan'?bilanScreen():S.sub==='epargne'?epargneScreen():S.sub==='rules'?rulesScreen():S.sub==='analyse'?analyseScreen():S.sub==='vacances'?vacScreen():S.sub==='rapport'?rapportScreen():plusScreen();
    return S.open? detailScreen() : homeScreen();
  }
  function heroify(h){ if(h.indexOf('<div class="hero')===0||h.indexOf('class="rcover"')>-1||h.indexOf('<h1')<0) return h;
    return h.replace(/^([\s\S]*?<\/h1>)((?:<span class="badge[^>]*>[^<]*<\/span>)?<\/div>)?/,function(m,a,b){ return '<div class="hero slim">'+a+(b||'')+'</div>'; }); }
  function heroify(h){ if(h.indexOf('<div class="hero')===0||h.indexOf('class="rcover"')>-1||h.indexOf('<h1')<0) return h;
    return h.replace(/^([\s\S]*?<\/h1>)((?:<span class="badge[^>]*>[^<]*<\/span>)?<\/div>)?/,function(m,a,b){ return '<div class="hero slim">'+a+(b||'')+'</div>'; }); }
  var lastView;   /* écran affiché au dernier rendu : le fondu ne joue que quand on change d'écran, pas quand les chiffres se rafraîchissent */
  function render(){
    if(D) CATS=buildCats();
    var vk=[S.stage,S.tab,S.sub,S.open,S.loading,!!S.error].join('|'), fx=lastView!==undefined&&vk!==lastView; lastView=vk;
    app.innerHTML='<div class="orbs" aria-hidden="true"><i class="o1"></i><i class="o2"></i><i class="o3"></i></div><div class="screen'+(fx?' fade':'')+'" id="screen">'+heroify(screen())+'</div>'+(S.stage==='ready'?'<nav class="nav" aria-label="Navigation principale">'+TABS.map(function(x){ if(x[0]==='fopen'){ var nf=fcount(); return '<button data-act="fopen" style="position:relative" aria-label="Filtres'+(nf?', '+nf+' actif'+(nf>1?'s':''):'')+'">'+ico(x[2])+x[1]+(nf?'<span class="fbadge">'+nf+'</span>':'')+'</button>'; } return '<button data-tab="'+x[0]+'"'+(x[0]===S.tab?' aria-current="page"':'')+'>'+ico(x[2])+x[1]+'</button>'}).join('')+'</nav>':'');
    app.querySelectorAll('.hscroll').forEach(function(h){ h.scrollLeft=(S.hsKey===h.dataset.hs&&S.hsPos!=null)?S.hsPos:h.scrollWidth; });
    var fill=function(){ app.querySelectorAll('.bar i,.strack i,.pvis i,.pbar i').forEach(function(el){ if(!(fx&&!reduce)) el.style.transition='none'; el.style.width=el.dataset.w+'%'; }); };
    if(fx&&!reduce) requestAnimationFrame(function(){requestAnimationFrame(fill)}); else fill();
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
    var el=e.target.closest('[data-alert],[data-tab],[data-open],[data-act],[data-view],[data-sub],[data-bud],[data-aopen],[data-atab],[data-rdel],[data-rpick],[data-rpickn],[data-bar],[data-pv],[data-cal],[data-ssel],[data-msel],[data-gr],[data-ep],[data-rsel],[data-vper],[data-vposte]'); if(!el||el.disabled) return;
    else if(el.dataset.alert!==undefined){S.alertOff[el.dataset.alert]=1;render()}
    else if(el.dataset.view){S.view=el.dataset.view;savePrefs();render()}
    else if(el.dataset.tab){S.tab=el.dataset.tab;S.merch=null;S.open=null;S.sub=null;S.bud=null;render();window.scrollTo(0,0)}
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
    else if(el.dataset.act==='subclose'){S.sub=null;S.vper=null;S.vposte=null;render();window.scrollTo(0,0)}
    else if(el.dataset.act==='budsave'||el.dataset.act==='budreset'){ var inp=document.getElementById('budin'), v=el.dataset.act==='budreset'?0:Math.round(+(inp&&inp.value)); if(!(v>=0)) return; S.budBusy=true; render();
      authed('saveBudget',[el.dataset.p,v]).then(function(b){ D.budgets=b; S.budBusy=false; S.bud=null; render(); }).catch(function(err){ S.budBusy=false; S.error=errMsg(err); render(); }); }
    else if(el.dataset.gr){S.f.graph=el.dataset.gr;render()}
    else if(el.dataset.ep!==undefined){S.epOpen=(S.epOpen===+el.dataset.ep)?null:+el.dataset.ep;render()}
    else if(el.dataset.vper){S.vper=el.dataset.vper;S.vposte=null;render();window.scrollTo(0,0)}
    else if(el.dataset.vposte){S.vposte=el.dataset.vposte;render();window.scrollTo(0,0)}
    else if(el.dataset.act==='vback'){ if(S.vposte) S.vposte=null; else S.vper=null; render();window.scrollTo(0,0)}
    else if(el.dataset.rsel!==undefined){S.revSel=(S.revSel===el.dataset.rsel)?null:el.dataset.rsel;render()}
    else if(el.dataset.msel!==undefined){S.merch=(S.merch===el.dataset.msel)?null:el.dataset.msel;render();if(S.merch){ var mc=document.querySelector('.mcard'); if(mc) mc.scrollIntoView({block:'start'}); }}
    else if(el.dataset.ssel!==undefined){S.subSel=(S.subSel===el.dataset.ssel)?null:el.dataset.ssel;S.merch=null;render()}
    else if(el.dataset.open){S.open=el.dataset.open;S.subSel=null;S.insP=false;S.merch=null;render();window.scrollTo(0,0)}
    else if(el.dataset.act==='fopen'){S.fopen=true;S.fanim=true;paintPanel()}
    else if(el.dataset.act==='hide'){S.hide=!S.hide;savePrefs();render()}
    else if(el.dataset.act==='allpostes'){S.all=!S.all;render()}
    else if(el.dataset.act==='lvl'){S.lvl=S.lvl==='sub'?'poste':'sub';S.all=false;render()}
    else if(el.dataset.act==='insp'){S.insP=!S.insP;render()}
    else if(el.dataset.act==='close'){S.insP=false;S.open=null;S.subSel=null;S.merch=null;render();window.scrollTo(0,0)}
    else if(el.dataset.act==='theme'){S.theme=S.theme==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',S.theme);savePrefs();render()}
    else if(el.dataset.act==='retry'){S.error=null;API.signIn(true).then(function(){S.stage='ready';load()}).catch(function(err){S.error=errMsg(err);render()})}
    else if(el.dataset.act==='unlock'){doUnlock()}
    else if(el.dataset.act==='saveep'){ var a=document.getElementById('eplivret'), b=document.getElementById('eplep'); if(!a||!b||S.epBusy) return;
      var va=a.value, vb=b.value; S.epBusy=true; S.epErr=null; render(); authed('saveEpargne',[va,vb]).then(function(){ S.epBusy=false; return load(true); }).catch(function(err){ S.epBusy=false; S.epErr=errMsg(err); render(); }); }
    else if(el.dataset.act==='refresh'){ if(!S.refreshing) refresh(true) }
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
    return run('getDashboard').then(function(d){ setData(d); S.loading=false; S.error=null; S.stale=false; S.silentErr=null; S.lastCheck=Date.now(); render(); }).catch(function(err){ S.loading=false; if(D){ S.stale=true; S.refreshErr=errMsg(err); } else if(err&&err.status===401){ S.stage='signin'; S.error=null; } else S.error=errMsg(err); render(); }); }
  function withTimeout(p,ms){ return new Promise(function(res,rej){ var t=setTimeout(function(){rej(new Error('délai dépassé'))},ms); p.then(function(v){clearTimeout(t);res(v)},function(e){clearTimeout(t);rej(e)}); }); }
  function spinBtn(on){ var b=app.querySelector('[data-act="refresh"]'); if(b) b.classList.toggle('spin',on); }
  function refresh(interactive){ S.refreshing=true; S.lastCheck=Date.now(); spinBtn(true);
    var tok=withTimeout(API.signIn(false),interactive?4000:8000).catch(function(e){ if(!interactive) throw e; return withTimeout(API.signIn(true),120000); });
    return tok.then(function(){ S.refreshErr=null; S.refreshing=false; return load(true); }).catch(function(e){ S.refreshing=false; S.stale=true; S.refreshErr=interactive?errMsg(e):null; S.silentErr=interactive?null:errMsg(e); render(); }); }
  function openApp(){ var c=API.cached();
    if(c){ setData(c); S.stage='ready'; S.loading=false; S.error=null; S.stale=true; S.first=false; render(); return refresh(false); }
    return enter(); }
  function enter(){ S.stage='ready'; S.loading=true; render();
    return API.signIn(false).then(function(){ return load(true); }).catch(function(){ S.loading=false; S.stage='signin'; render(); }); }
  function doUnlock(){ if(S.lockBusy) return; S.lockBusy=true;
    Lock.unlock().then(function(){ S.lockBusy=false; S.lockOk=true; openApp(); }).catch(function(){ S.lockBusy=false; S.stage='lock'; render(); }); }
  function boot(){
    API.prewarm();   /* le jeton Google se renouvelle pendant que l'écran s'affiche */
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
    else if(S.stage==='ready'&&!S.refreshing&&Date.now()-(S.lastCheck||0)>120000){ refresh(false); }   /* retour sur l'appli : on relit le dossier si la dernière vérification a plus de 2 minutes */
  });
  if('serviceWorker' in navigator){ var hadCtl=!!navigator.serviceWorker.controller, reloaded=false;
    navigator.serviceWorker.addEventListener('controllerchange',function(){ if(!hadCtl||reloaded) return; reloaded=true; location.reload(); });
    navigator.serviceWorker.register('sw.js').then(function(r){ if(r&&r.update) r.update(); }).catch(function(){}); }
  boot();
  var gf=document.getElementById('gf'); if(gf) gf.media='all';
})();
