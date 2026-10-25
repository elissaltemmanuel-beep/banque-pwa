(function(){
  'use strict';
  var TOL=0.15, MIN_EUR=20, D=null, DAY=1, DAYS=30, ELAPSED=0, CATS=[];
  var S={tab:'home',open:null,hide:false,q:'',view:'ecarts',per:'mois',theme:'light',stage:'boot',loading:true,error:null,lockOk:false,lockBusy:false,syncing:false,fopen:false,fanim:false,first:true,all:false};
  function fcopy(){ return {graph:'solde',off:{},alertes:0,moy:'12',min:0}; }
  S.f=fcopy();
  try{ var pr=JSON.parse(localStorage.getItem('banque-prefs')||'{}'); if(pr.theme) S.theme=pr.theme; if(pr.hide) S.hide=true; if(pr.view) S.view=pr.view; if(pr.per) S.per=pr.per; }catch(e){}
  function savePrefs(){ try{ localStorage.setItem('banque-prefs',JSON.stringify({theme:S.theme,hide:S.hide,view:S.view,per:S.per})); }catch(e){} }
  document.documentElement.setAttribute('data-theme',S.theme);
  var app=document.getElementById('app');
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MOIS=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];

  function eur(v,d){ if(S.hide) return '••••'; return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:d?2:0,maximumFractionDigits:d?2:0}).format(v); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]}); }
  function fmtDate(iso){ if(!iso) return ''; var p=iso.split('-'); return +p[2]+' '+MOIS[+p[1]-1]; }
  function daysBetween(a,b){ var x=a.split('-'),y=b.split('-'); return Math.round((Date.UTC(+y[0],+y[1]-1,+y[2])-Date.UTC(+x[0],+x[1]-1,+x[2]))/864e5); }
  function ico(p){ return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>'; }
  var I={home:'<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',more:'<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',eyeoff:'<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6C3.7 8.3 2 12 2 12s3.6 7 10 7a10 10 0 0 0 4.4-1"/>',back:'<path d="M15 18l-6-6 6-6"/>',filter:'<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',close:'<path d="M6 6l12 12M18 6L6 18"/>',repeat:'<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',pie:'<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6.4 6.4"/>',chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'};

  /* ---------- données ---------- */
  function avgOf(h,k){ var a=h.slice(-k); return a.length? a.reduce(function(s,v){return s+v},0)/a.length : 0; }
  function buildCats(){ var k=+S.f.moy;
    return D.cats.map(function(c){ return {id:c.id,n:c.n,spent:c.spent,avg:Math.max(avgOf(c.hist,k),1),ops:c.ops,
      subs:c.subs.map(function(s,i){ return {id:c.id+'-'+i,n:s.n,spent:s.spent,avg:Math.max(avgOf(s.hist,k),1)}; })}; }); }
  function setData(d){ D=d; DAY=d.today.day; DAYS=d.today.days; ELAPSED=DAY/DAYS; }
  function status(c){ var p=c.spent/c.avg, gap=p-ELAPSED, over=c.spent-c.avg*ELAPSED;
    if(over<MIN_EUR) return {k:'ok',t:p<ELAPSED-0.15?'En retard':'Dans le rythme'};
    if(gap>TOL) return {k:'bad',t:'En avance'}; if(gap>0.05) return {k:'warn',t:'À surveiller'}; return {k:'ok',t:p<ELAPSED-0.15?'En retard':'Dans le rythme'}; }
  function srt(arr,ec){ return arr.slice().sort(ec?function(a,b){return (b.spent/b.avg-ELAPSED)-(a.spent/a.avg-ELAPSED)}:function(a,b){return b.spent-a.spent}); }
  function applyF(list){ return list.filter(function(c){ return !S.f.off[c.id] && (!S.f.alertes||status(c).k==='bad') && c.spent>=S.f.min; }); }
  function fcount(){ var f=S.f,n=0; if(f.graph!=='solde')n++; if(Object.keys(f.off).some(function(k){return f.off[k]}))n++; if(f.alertes)n++; if(f.moy!=='12')n++; if(f.min>0)n++; return n; }

  /* ---------- en-tête ---------- */
  function exportInfo(){ var fd=D.sync&&D.sync.fileDate, stale=fd&&daysBetween(fd,D.today.iso)>7;
    return {label: fd? 'Export du '+fmtDate(fd) : 'Données au '+fmtDate(D.stats.lastRealDate), stale: !!stale}; }
  function header(){ var n=fcount(), ex=D?exportInfo():{label:'Chargement…',stale:false};
    return '<div class="row">'+(S.stale&&D?'<button class="chip" data-act="refresh" style="cursor:pointer"><span class="dot stale"></span>Actualiser · chiffres du '+esc(fmtDate(D.stats.lastRealDate))+'</button>':'<span class="chip"><span class="dot'+(ex.stale?' stale':'')+'"></span>'+esc(ex.label)+(ex.stale?' · ancien':'')+'</span>')+'<div style="display:flex;gap:8px"><button class="iconbtn" data-act="fopen" aria-label="Filtres'+(n?', '+n+' actif'+(n>1?'s':''):'')+'" style="position:relative">'+ico(I.filter)+(n?'<span class="fbadge">'+n+'</span>':'')+'</button><button class="iconbtn" data-act="hide" aria-label="'+(S.hide?'Afficher':'Masquer')+' les montants" aria-pressed="'+S.hide+'">'+ico(S.hide?I.eyeoff:I.eye)+'</button></div></div>'; }

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
    function val(x){ return ecarts? '<span class="sval"><b class="'+x.k+'t">'+(x.pos?'+':'−')+eur(Math.abs(x.d))+'</b></span>' : '<span class="sval"><b>'+eur(x.c.spent)+'</b><small class="muted">'+Math.round(x.pct)+' %</small></span>'; }
    function track(x){ var w;
      if(ecarts){ w=Math.min(Math.abs(x.gap)/45,1)*50; return '<span class="strack"><span class="axis"></span><i class="'+x.k+'" style="'+(x.pos?'left:50%':'left:auto;right:50%')+'" data-w="'+w+'"></i></span>'; }
      return '<span class="strack"><i class="'+x.k+'" style="left:0" data-w="'+(Math.min(x.pct,130)/130*100)+'"></i><span class="tick" style="left:'+(100/130*100)+'%"></span></span>'; }
    var items=cats.map(info), body;
    if(!items.length) body='<p class="muted" style="padding:16px 4px">'+(sub?'Pas de sous-poste pour ce poste.':'Aucun poste ne correspond à ces filtres.')+'</p>';
    else body=items.map(function(x){ return '<'+T+' class="srow'+(ecarts?'':' tall')+'"'+(sub?' role="group"':' data-open="'+esc(x.c.id)+'"')+' aria-label="'+lab(x)+'"><span class="sname">'+esc(x.c.n)+'</span>'+track(x)+val(x)+'</'+T+'>'; }).join('');
    var cap= ecarts ? 'Écart en euros par rapport au rythme attendu au jour '+DAY+'. En rouge : le poste dépasse ce rythme de plus de 15 points (et de plus de 20 €). Les 8 postes les plus importants sont affichés.' : 'Le repère marque 100 % de la moyenne du poste. Triés du plus dépensé au moins dépensé.';
    return '<div class="card syn"><div class="seg" role="group" aria-label="Type de graphique"><button data-view="ecarts" aria-pressed="'+ecarts+'">Écarts</button><button data-view="depenses" aria-pressed="'+!ecarts+'">Dépenses</button></div>'+
      '<p class="gapl muted" style="text-align:center;margin:4px 0">'+(ecarts?'Rythme attendu au centre · à gauche en retard · à droite en avance':'Montant dépensé et % de la moyenne du poste')+'</p>'+body+(!sub&&(extra>0||S.all)&&applyF(list).length>8?'<button class="back" data-act="allpostes" style="min-height:40px;align-self:flex-start;font-size:13px">'+(S.all?'Réduire la liste':'Voir les '+extra+' autres postes')+'</button>':'')+
      '<div class="gapl muted" style="margin-top:6px">'+cap+'</div></div>'; }

  /* ---------- graphique de l'accueil ---------- */
  function niceCeil(v){ var step=v>12000?5000:v>6000?2000:v>2500?1000:v>1000?500:100; return Math.max(step,Math.ceil(v*1.08/step)*step); }
  function maxOf(a){ return a.reduce(function(m,v){return v>m?v:m},0); }
  function chartCard(){
    var mois=S.per==='mois', dr=S.f.graph==='dr', G=120, B=140, svg='', sum='', leg='', badge='', aria='', C=D.curve, P=D.proj, N=DAYS;
    var title=mois?D.today.label:'Les 12 derniers mois';
    function X(i){ return 10+i/(N-1)*330; }
    function Y(v,mx){ return (B-Math.max(0,Math.min(v,mx))/mx*G).toFixed(1); }
    function pts(arr,mx){ return arr.map(function(v,i){return X(i).toFixed(1)+','+Y(v,mx)}).join(' '); }
    function pp(list,mx){ return list.map(function(p){return X(p[0]-1).toFixed(1)+','+Y(p[1],mx)}).join(' '); }
    function txt(x,y,t,o){ o=o||{}; return '<text x="'+x+'" y="'+y+'" fill="'+(o.fill||'var(--muted)')+'" font-size="'+(o.size||10)+'"'+(o.w?' font-weight="'+o.w+'"':'')+(o.a?' text-anchor="'+o.a+'"':'')+'>'+t+'</text>'; }
    function grid(mx){ var mid=mx/2; return '<line x1="10" y1="'+B+'" x2="340" y2="'+B+'" stroke="var(--rim-soft)"/><line x1="10" y1="'+Y(mid,mx)+'" x2="340" y2="'+Y(mid,mx)+'" stroke="var(--rim-soft)" stroke-dasharray="2 4"/>'+(S.hide?'':txt(12,(Y(mid,mx)-4),new Intl.NumberFormat('fr-FR').format(mid)+' €')); }
    function days(){ return txt(10,156,'1')+txt(X(14).toFixed(0)-6,156,'15')+txt((X(DAY-1)-6).toFixed(0),156,String(DAY),{fill:'var(--text)',w:600})+txt(330,156,String(N)); }
    function ln(p,col,w,dash){ return '<polyline points="'+p+'" fill="none" stroke="'+col+'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>'; }
    function lg(col,dash,t){ return '<span style="display:inline-flex;align-items:center;gap:6px"><svg width="18" height="4" aria-hidden="true"><line x1="0" y1="2" x2="18" y2="2" stroke="'+col+'" stroke-width="2.4"'+(dash?' stroke-dasharray="'+dash+'"':'')+' stroke-linecap="round"/></svg>'+t+'</span>'; }
    function sq(col,t){ return '<span style="display:inline-flex;align-items:center;gap:6px"><i style="width:10px;height:10px;border-radius:3px;background:'+col+';display:inline-block"></i>'+t+'</span>'; }
    var sd=P.salary.day, sal=P.salary.expected, endTxt=fmtDate(D.today.month+'-'+(N<10?'0':'')+N);
    if(mois&&dr){
      var depNow=C.depCum[DAY-1]||0, revNow=C.revCum[DAY-1]||0, hNow=C.habit[DAY-1]||0;
      var mx=niceCeil(Math.max(P.depEnd,P.revEnd,maxOf(C.habit),depNow,revNow));
      if(hNow>0){ var pc=Math.round((depNow/hNow-1)*100); badge='<span class="badge '+(pc>15?'bad':pc>5?'warn':'ok')+'">'+(pc>0?'+':'')+pc+' % vs rythme habituel</span>'; }
      sum=eur(depNow)+' dépensés et '+eur(revNow)+' reçus au jour '+DAY+(hNow>0?', contre '+eur(hNow)+' dépensés en moyenne à cette date':'')+'.'+(sal>0?' Salaire attendu vers le '+sd+' : +'+eur(sal)+'.':'');
      aria='Courbes cumulées du mois : dépenses '+Math.round(depNow)+' euros au jour '+DAY+', revenus '+Math.round(revNow)+' euros';
      var rp=sal>0? [[DAY,revNow],[Math.max(DAY,sd-1),revNow],[sd,P.revEnd],[N,P.revEnd]] : [[DAY,revNow],[N,P.revEnd]];
      svg=grid(mx)+ln(pts(C.habit,mx),'var(--muted)',1.6,'4 4')+ln(pp([[DAY,depNow],[N,P.depEnd]],mx),'var(--accent)',1.8,'2 4')+ln(pp(rp,mx),'var(--c2)',1.8,'2 4')+ln(pts(C.revCum,mx),'var(--c2)',2.2)+ln(pts(C.depCum,mx),'var(--accent)',2.8)+'<circle cx="'+X(DAY-1).toFixed(1)+'" cy="'+Y(depNow,mx)+'" r="4.5" fill="var(--accent)" stroke="var(--bg)" stroke-width="2"/>'+days();
      leg=lg('var(--accent)','','Dépenses')+lg('var(--muted)','4 4','Rythme habituel')+lg('var(--c2)','','Revenus')+'<span>Pointillés : projection</span>';
    } else if(mois){
      var vals=C.bal.concat(C.proj.map(function(p){return p[1]})), mx2=niceCeil(Math.max(maxOf(vals),1));
      var LD=P.landing, inMonth=LD&&LD.date.slice(0,7)===D.today.month&&LD.days>0, endP=C.proj[C.proj.length-1];
      if(inMonth){
        sum='Solde actuel '+eur(D.solde)+'. Atterrissage au '+fmtDate(LD.date)+', juste avant la paie : '+eur(LD.value)+', après les opérations déjà programmées et vos dépenses courantes estimées.';
        aria='Courbe du solde du mois : '+Math.round(D.solde)+' euros aujourd\'hui, '+Math.round(LD.value)+' euros la veille de la paie';
      } else {
        sum='Solde actuel '+eur(D.solde)+'. Projeté au '+endTxt+' : '+eur(P.value)+', après les opérations déjà programmées'+(sal>0?', le salaire attendu vers le '+sd:'')+' et vos dépenses courantes estimées.'+(LD&&LD.days>0?' Atterrissage avant la prochaine paie, au '+fmtDate(LD.date)+' : '+eur(LD.value)+'.':'');
        aria='Courbe du solde du mois : '+Math.round(D.solde)+' euros aujourd\'hui, projeté à '+Math.round(P.value)+' euros en fin de mois';
      }
      var lx=Math.min(endP[0],N), lt=(lx>=N-3||lx>DAY+(N-DAY)*.6);
      svg=grid(mx2)+ln(pp(C.proj,mx2),'var(--accent)',1.8,'2 4')+ln(pts(C.bal,mx2),'var(--accent)',2.8)+'<circle cx="'+X(DAY-1).toFixed(1)+'" cy="'+Y(D.solde,mx2)+'" r="4.5" fill="var(--accent)" stroke="var(--bg)" stroke-width="2"/>'+(inMonth?'<circle cx="'+X(lx-1).toFixed(1)+'" cy="'+Y(LD.value,mx2)+'" r="3.5" fill="var(--bg)" stroke="var(--accent)" stroke-width="2"/>':'')+(S.hide?'':txt(inMonth?(lt?X(lx-1).toFixed(1):(X(lx-1)+8).toFixed(1)):340,(Y(inMonth?LD.value:P.value,mx2)-7),eur(inMonth?LD.value:P.value),{a:inMonth&&!lt?'start':'end',fill:'var(--text)',w:600}))+days();
      leg=lg('var(--accent)','','Solde')+'<span>Pointillés : projection'+(inMonth?' jusqu’à la veille de la paie':(sal>0?' (salaire attendu vers le '+sd+')':''))+'</span>';
    } else {
      var M=D.months, bw=330/M.length, last=M.length-1, g='', i, cx, mx3, mxs;
      if(dr){ mx3=niceCeil(Math.max(maxOf(M.map(function(m){return Math.max(m.rev,m.dep)})),P.revEnd,P.depEnd,1));
        sum='Revenus et dépenses de chaque mois. Le mois en cours est marqué : les contours en pointillés montrent la projection de fin de mois.';
        aria='Barres des 12 derniers mois : revenus et dépenses';
        g=grid(mx3);
        for(i=0;i<M.length;i++){ cx=10+bw*(i+.5);
          g+='<rect x="'+(cx-10).toFixed(1)+'" y="'+Y(M[i].rev,mx3)+'" width="9" height="'+(Math.min(M[i].rev,mx3)/mx3*G).toFixed(1)+'" rx="2.5" fill="var(--neu)"/><rect x="'+(cx+1).toFixed(1)+'" y="'+Y(M[i].dep,mx3)+'" width="9" height="'+(Math.min(M[i].dep,mx3)/mx3*G).toFixed(1)+'" rx="2.5" fill="var(--accent)"/>';
          if(i===last) g+='<rect x="'+(cx-10).toFixed(1)+'" y="'+Y(P.revEnd,mx3)+'" width="9" height="'+(Math.min(P.revEnd,mx3)/mx3*G).toFixed(1)+'" rx="2.5" fill="none" stroke="var(--neu)" stroke-dasharray="2 2"/><rect x="'+(cx+1).toFixed(1)+'" y="'+Y(P.depEnd,mx3)+'" width="9" height="'+(Math.min(P.depEnd,mx3)/mx3*G).toFixed(1)+'" rx="2.5" fill="none" stroke="var(--accent)" stroke-dasharray="2 2"/>';
          g+=txt(cx.toFixed(1),156,M[i].lab,{a:'middle',fill:i===last?'var(--text)':'var(--muted)',w:i===last?600:0}); }
        svg=g; leg=sq('var(--neu)','Revenus')+sq('var(--accent)','Dépenses')+'<span>Pointillés : projection</span>';
      } else { mxs=niceCeil(Math.max(maxOf(M.map(function(m){return m.bal})),P.value,1));
        sum='Solde en fin de chaque mois. Mois en cours : '+eur(D.solde)+' aujourd\'hui, projeté à '+eur(P.value)+' en fin de mois.';
        aria='Barres du solde en fin de mois sur 12 mois, '+Math.round(D.solde)+' euros aujourd\'hui, projeté à '+Math.round(P.value)+' euros';
        g=grid(mxs);
        for(i=0;i<M.length;i++){ cx=10+bw*(i+.5);
          g+='<rect x="'+(cx-8).toFixed(1)+'" y="'+Y(M[i].bal,mxs)+'" width="16" height="'+(Math.min(Math.max(M[i].bal,0),mxs)/mxs*G).toFixed(1)+'" rx="4" fill="'+(i===last?'var(--accent)':'var(--neu)')+'"/>';
          if(i===last) g+='<rect x="'+(cx-8).toFixed(1)+'" y="'+Y(P.value,mxs)+'" width="16" height="'+(Math.min(Math.max(P.value,0),mxs)/mxs*G).toFixed(1)+'" rx="4" fill="none" stroke="var(--accent)" stroke-dasharray="2 2"/>'+(S.hide?'':txt((cx+10).toFixed(1),(Y(P.value,mxs)-6),eur(P.value),{a:'end',fill:'var(--text)',w:600}));
          g+=txt(cx.toFixed(1),156,M[i].lab,{a:'middle',fill:i===last?'var(--text)':'var(--muted)',w:i===last?600:0}); }
        svg=g; leg=sq('var(--neu)','Fin de mois')+sq('var(--accent)','Mois en cours')+'<span>Pointillés : projection</span>'; }
    }
    return '<div class="card"><div class="row"><h2 style="font-size:16px">'+title+'</h2>'+badge+'</div>'+
      '<div class="ctrls"><div class="seg sm" role="group" aria-label="Période du graphique"><button data-per="mois" aria-pressed="'+mois+'">Mois en cours</button><button data-per="annee" aria-pressed="'+!mois+'">Tous les mois</button></div></div>'+
      '<p class="muted" style="font-size:13px;margin:2px 0 6px;line-height:1.4">'+sum+'</p>'+
      '<svg viewBox="0 0 350 162" width="100%" role="img" aria-label="'+aria+'">'+svg+'</svg>'+
      '<div class="muted" style="display:flex;gap:6px 14px;font-size:11px;flex-wrap:wrap;margin-top:4px">'+leg+'</div></div>'; }

  /* ---------- écrans ---------- */
  function syncNote(){ var s=D.sync; if(s&&s.error) return '<div class="card muted" style="font-size:13px;line-height:1.45"><b style="color:var(--text)">Lecture du dernier export impossible</b><br>'+esc(s.error)+'<br>Les chiffres viennent des opérations déjà importées.</div>'; return ''; }
  function landingCard(){
    var L=D.proj.landing, lab, sub;
    if(!L){ lab='Solde projeté au '+fmtDate(D.today.month+'-'+(DAYS<10?'0':'')+DAYS); sub='Paie non repérée dans l’historique.'; return landingHtml(lab,sub,D.proj.value); }
    lab='Atterrissage avant la paie';
    if(L.days<=0) sub='Paie attendue d’un jour à l’autre.';
    else sub='Au '+fmtDate(L.date)+', veille de la paie '+(L.payKnown?'programmée le '+fmtDate(L.payDate):'estimée au '+fmtDate(L.payDate)+(L.payMin!==L.payMax?' (versée entre le '+L.payMin+' et le '+L.payMax+' ces derniers mois)':''))+'.';
    return landingHtml(lab,sub,L.value);
  }
  function landingHtml(lab,sub,v){
    return '<div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px"><div style="min-width:0"><div class="muted" style="font-size:13px">'+esc(lab)+'</div><div class="muted" style="font-size:11.5px;line-height:1.35;margin-top:2px">'+esc(sub)+'</div></div><span style="font-size:20px;font-weight:600;color:var(--accent);white-space:nowrap">'+eur(v)+'</span></div>';
  }
  function homeScreen(){
    return header()+syncNote()+'<div><div class="muted" style="font-size:14px">Solde BoursoBank</div><div class="balance" id="bal" data-v="'+D.solde+'">'+eur(D.solde)+'</div></div>'+
    landingCard()+chartCard()+
    '<div class="row"><h2 style="font-size:18px">Postes</h2><span class="muted" style="font-size:12px">Jour '+DAY+' sur '+DAYS+'</span></div>'+compactCard(CATS);
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
    return '<h1 style="font-size:26px">Plus</h1><div class="card" style="padding:4px 16px"><button class="switch" data-sub="bilan" style="width:100%;border:0;background:transparent;text-align:left;min-height:44px;font-size:inherit"><span style="display:flex;align-items:center;gap:10px">'+ico(I.chart)+'Bilan annuel</span><span class="muted">›</span></button></div><div class="card" style="padding:4px 16px"><div class="switch"><span>Masquer les montants</span><button class="tog" data-act="hide" aria-pressed="'+S.hide+'" aria-label="Masquer les montants"></button></div><div class="switch"><span>Thème sombre</span><button class="tog" data-act="theme" aria-pressed="'+dark+'" aria-label="Thème sombre"></button></div>'+(S.lockAvail?'<div class="switch"><span>Verrouiller avec l\'empreinte</span><button class="tog" data-act="lock" aria-pressed="'+Lock.enabled()+'" aria-label="Verrouiller avec l\'empreinte"></button></div>':'')+'</div>'+
    '<div class="card" style="display:flex;flex-direction:column;gap:8px"><h3 style="font-size:15px">Vos données</h3>'+
      '<div class="muted" style="font-size:13px;line-height:1.5">Dernier export lu : <b style="color:var(--text)">'+esc(s.fileName||'inconnu')+'</b>'+(s.fileDate?' ('+esc(fmtDate(s.fileDate))+')':'')+'<br>'+st.rows+' opérations en mémoire, du '+esc(fmtDate(st.from))+' au '+esc(fmtDate(st.to))+'.'+(s.lastSync?'<br>Dernière synchronisation : '+esc(String(s.lastSync).replace('T',' à ')):'')+'<br>Les mouvements entre vos propres comptes ('+st.internal+') ne sont pas comptés dans les dépenses.</div>'+
      '<button class="fbtn" data-act="sync"'+(S.syncing?' disabled':'')+'>'+(S.syncing?'Lecture du dossier…':'Relire le dossier maintenant')+'</button>'+
      '<div class="muted" style="font-size:12px;line-height:1.4">Déposez un nouvel export dans le dossier « Export banque » : il est lu automatiquement à l\'ouverture de cette page.</div></div><button class="fbtn ghost" data-act="signout">Se déconnecter et effacer les données de cet appareil</button><p class="note">Prévus ensuite : règles de catégorisation, objectifs d\'épargne.</p>'; }


  /* ---------- abonnements ---------- */
  function subLine(x){ return '<div class="opline"><div class="l"><span style="font-weight:600;font-size:14px">'+esc(x.n)+'</span><span class="muted" style="font-size:12px">'+(x.active?'Prochain vers le '+esc(fmtDate(x.next)):'Dernier le '+esc(fmtDate(x.last)))+' · '+esc(x.par)+'</span>'+
      (x.hausse?'<span class="badge warn" style="align-self:flex-start;margin-top:4px">Hausse : '+eur(x.hausse.from,true)+' → '+eur(x.hausse.to,true)+'</span>':'')+(x.nouveau&&!x.hausse?'<span class="badge ok" style="align-self:flex-start;margin-top:4px">Nouveau</span>':'')+'</div><span style="font-weight:600">'+eur(x.amt,true)+'</span></div>'; }
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
  function budScreen(){ var items=CATS.filter(function(c){return c.spent>0||c.avg>10}).map(budInfo).sort(function(a,b){return b.c.spent-a.c.spent});
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
    if(S.tab==='ops') return opsScreen();
    if(S.tab==='subs') return subsScreen();
    if(S.tab==='bud') return budScreen();
    if(S.tab==='plus') return S.sub==='bilan'?bilanScreen():plusScreen();
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
    function chip(k,v,l,on){ return '<button class="fchip" data-f="'+k+'" data-v="'+esc(v)+'" aria-pressed="'+!!on+'">'+esc(l)+'</button>'; }
    function sec(t,b){ return '<div class="fsec"><h3>'+t+'</h3>'+b+'</div>'; }
    var all=!Object.keys(f.off).some(function(k){return f.off[k]}), mx=Math.max(100,Math.ceil(maxOf(D.cats.map(function(c){return c.spent}))/10)*10);
    var body=sec('Graphique de l\'accueil','<div class="fchips">'+[['solde','Solde'],['dr','Dépenses et revenus']].map(function(p){return chip('graph',p[0],p[1],f.graph===p[0])}).join('')+'</div>')+
      sec('Postes','<div class="fchips">'+chip('postes_all','all','Tous',all)+D.cats.map(function(c){return chip('poste',c.id,c.n,!f.off[c.id])}).join('')+'</div>')+
      sec('Montant minimum dépensé ce mois','<div class="frange"><input type="range" id="fmin" min="0" max="'+mx+'" step="10" value="'+f.min+'" aria-label="Montant minimum dépensé par poste"><output id="fminv">'+(f.min?f.min+' €':'Aucun')+'</output></div>')+
      sec('Statut','<div class="fchips">'+chip('flag','alertes','Alertes seulement',f.alertes)+'</div>')+
      sec('Moyenne calculée sur','<div class="fchips">'+[['3','3 mois'],['6','6 mois'],['12','12 mois']].map(function(p){return chip('moy',p[0],p[1],f.moy===p[0])}).join('')+'</div>');
    var n=applyF(CATS).length;
    el.innerHTML='<div class="fwrap"><div class="scrim" data-fc="close"></div><div class="fin"><section class="fpanel fpB'+(anim?' anim':'')+'" role="dialog" aria-modal="true" aria-label="Filtres">'+
      '<div class="fhead"><h2>Filtres'+(fcount()?' <span class="muted" style="font-weight:500;font-size:14px">· '+fcount()+' actif'+(fcount()>1?'s':'')+'</span>':'')+'</h2><button class="iconbtn" data-fc="close" aria-label="Fermer les filtres">'+ico(I.close)+'</button></div><div class="fbody">'+body+'</div>'+
      '<div class="ffoot"><button class="fbtn ghost" data-fc="reset">Réinitialiser</button><button class="fbtn" data-fc="close">Voir '+n+' poste'+(n>1?'s':'')+'</button></div></section></div></div>';
    var nb=el.querySelector('.fbody'); if(nb) nb.scrollTop=top; if(anim){ var c=el.querySelector('[data-fc="close"].iconbtn'); if(c) c.focus(); } }
  var fp=document.getElementById('fpanel');
  fp.addEventListener('click',function(e){ var b=e.target.closest('[data-fc],[data-f]'); if(!b) return;
    if(b.dataset.fc==='close'){ S.fopen=false; paintPanel(); return; }
    if(b.dataset.fc==='reset'){ S.f=fcopy(); render(); return; }
    var k=b.dataset.f, v=b.dataset.v;
    if(k==='graph'||k==='moy') S.f[k]=v;
    else if(k==='poste') S.f.off[v]=S.f.off[v]?0:1;
    else if(k==='postes_all'){ var all=!Object.keys(S.f.off).some(function(x){return S.f.off[x]}); S.f.off={}; if(all) D.cats.forEach(function(c){S.f.off[c.id]=1}); }
    else if(k==='flag') S.f[v]=S.f[v]?0:1;
    render(); });
  fp.addEventListener('input',function(e){ if(e.target.id==='fmin'){ S.f.min=+e.target.value; document.getElementById('fminv').textContent=S.f.min?S.f.min+' €':'Aucun'; } });
  fp.addEventListener('change',function(e){ if(e.target.id==='fmin') render(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&S.fopen){ S.fopen=false; paintPanel(); } });

  /* ---------- interactions ---------- */
  app.addEventListener('click',function(e){
    var el=e.target.closest('[data-per],[data-tab],[data-open],[data-act],[data-view],[data-sub],[data-bud]'); if(!el||el.disabled) return;
    if(el.dataset.per){S.per=el.dataset.per;savePrefs();render()}
    else if(el.dataset.view){S.view=el.dataset.view;savePrefs();render()}
    else if(el.dataset.tab){S.tab=el.dataset.tab;S.open=null;S.sub=null;S.bud=null;render();window.scrollTo(0,0)}
    else if(el.dataset.sub){S.sub=el.dataset.sub;render();window.scrollTo(0,0)}
    else if(el.dataset.bud){S.bud=S.bud===el.dataset.bud?null:el.dataset.bud;render()}
    else if(el.dataset.act==='subclose'){S.sub=null;render();window.scrollTo(0,0)}
    else if(el.dataset.act==='budsave'||el.dataset.act==='budreset'){ var inp=document.getElementById('budin'), v=el.dataset.act==='budreset'?0:Math.round(+(inp&&inp.value)); if(!(v>=0)) return; S.budBusy=true; render();
      run('saveBudget',[el.dataset.p,v]).then(function(b){ D.budgets=b; S.budBusy=false; S.bud=null; render(); }).catch(function(err){ S.budBusy=false; S.error=errMsg(err); render(); }); }
    else if(el.dataset.open){S.open=el.dataset.open;render();window.scrollTo(0,0)}
    else if(el.dataset.act==='fopen'){S.fopen=true;S.fanim=true;paintPanel()}
    else if(el.dataset.act==='hide'){S.hide=!S.hide;savePrefs();render()}
    else if(el.dataset.act==='allpostes'){S.all=!S.all;render()}
    else if(el.dataset.act==='close'){S.open=null;render();window.scrollTo(0,0)}
    else if(el.dataset.act==='theme'){S.theme=S.theme==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',S.theme);savePrefs();render()}
    else if(el.dataset.act==='retry'){boot()}
    else if(el.dataset.act==='unlock'){doUnlock()}
    else if(el.dataset.act==='refresh'){refresh(true)}
    else if(el.dataset.act==='signin'){S.error=null;API.signIn(true).then(function(){S.stage='ready';load()}).catch(function(err){S.error=errMsg(err);render()})}
    else if(el.dataset.act==='lock'){ if(Lock.enabled()){Lock.disable();render()} else Lock.enable().then(render).catch(function(err){S.error=errMsg(err);render()}) }
    else if(el.dataset.act==='signout'){API.signOut();Lock.disable();D=null;S.stage='signin';S.error=null;render();window.scrollTo(0,0)}
    else if(el.dataset.act==='sync'){S.syncing=true;render();run('forceSync').then(function(){S.syncing=false;return load(true)}).catch(function(err){S.syncing=false;S.error=errMsg(err);render()})}
  });
  app.addEventListener('input',function(e){ if(e.target.id==='q'){S.q=e.target.value;var q=S.q.toLowerCase(),r=D.ops.filter(function(o){return !q||(o[1]+' '+o[2]).toLowerCase().indexOf(q)>-1});document.getElementById('oplist').innerHTML=opsHtml(r,r.slice(0,150))} });

  /* ---------- chargement ---------- */
  function errMsg(e){ return (e&&e.message)?e.message:String(e); }
  function run(fn,args){ return API[fn].apply(null,args||[]); }
  function load(keep){ if(!keep){ S.loading=true; S.error=null; render(); }
    return run('getDashboard').then(function(d){ setData(d); S.loading=false; S.error=null; S.stale=false; render(); }).catch(function(err){ S.loading=false; if(D){ S.stale=true; } else if(err&&err.status===401){ S.stage='signin'; S.error=null; } else S.error=errMsg(err); render(); }); }
  function withTimeout(p,ms){ return new Promise(function(res,rej){ var t=setTimeout(function(){rej(new Error('délai dépassé'))},ms); p.then(function(v){clearTimeout(t);res(v)},function(e){clearTimeout(t);rej(e)}); }); }
  function refresh(interactive){ return withTimeout(API.signIn(interactive),interactive?120000:8000).then(function(){ return load(true); }).catch(function(){ S.stale=true; render(); }); }
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
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function(){});
  boot();
})();
