
(function(){
'use strict';
var ETAPAS=['interesada','registrada','suscriptora','inactiva'];
var EDADES=['2–4','4–6','6–9'];
var VALORES=['Empatía','Valentía','Generosidad','Cuidado','Creatividad','Gratitud','Honestidad','Paciencia'];
var VAL_HUE={'Empatía':340,'Valentía':16,'Generosidad':40,'Cuidado':150,'Creatividad':268,'Gratitud':195,'Honestidad':225,'Paciencia':95};
var TIPOS=['Email','WhatsApp','Llamada','Reunión','Nota'];
var PERSONAJE=['sin empezar','cuestionario enviado','cuestionario recibido','personaje listo'];
var NAV=[
 {id:'panel',t:'Panel',i:'<path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z"/>'},
 {id:'familias',t:'Familias',i:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17.5" cy="9.5" r="2.4"/><path d="M17 14.5c2.4 0 4 1.6 4 4"/>'},
 {id:'cuentos',t:'Cuentos',i:'<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15ZM5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/>'},
 {id:'ia',t:'Asistente IA',i:'<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3ZM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/>'},
 {id:'previa',t:'Vista familia',i:'<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>'}
];

var S={view:'panel',cuentos:[],familias:[],ready:{cuentos:false,familias:false},stale:false,err:null,
  fq:'',fe:'todas',fs:'todas',ce:'todas',cs:'todas',modal:null,
  pv:{screen:'inicio',id:null,favs:[],edad:'todas',tab:'registro'},
  ia:{form:{nombre:'',tema:'',edad:'4–6',valor:'',personajes:'Pepita y la Iaia Carola'},tipo:'resumen',out:{},busy:false},token:'',refresh:'',email:'',loginErr:''};
var ctl=null, sample=true, memMode=false;
var $=function(s){return document.querySelector(s)};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function today(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function addDays(iso,n){var d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function fdate(iso){if(!iso)return '—';var d=new Date(iso+'T12:00:00');return d.toLocaleDateString('es-ES',{day:'numeric',month:'short'})}
function secOf(a){a=+a;return a<=3?'2–4':a<=5?'4–6':'6–9'}
function toast(m){var t=$('#toast');t.textContent=m;clearTimeout(toast.t);toast.t=setTimeout(function(){t.textContent=''},2600)}
function hash(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h}
function ico(p){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>'}
function cover(c,cls){var h=VAL_HUE[c.valor]!=null?VAL_HUE[c.valor]:hash(c.titulo||'x')%360;var t=(c.titulo||'?').replace(/^(La |El |Los |Las )?Pepita\s+(y\s+)?(la |el |los |las )?/i,'')||c.titulo||'?';return '<div class="cover '+(cls||'')+'" style="--h:'+h+'"><span>'+esc(t.charAt(0).toUpperCase())+'</span></div>'}
function favCount(id){return S.familias.reduce(function(a,f){return a+((f.favoritos||[]).indexOf(id)>=0?1:0)},0)}
function lastContact(f){var l=(f.interacciones||[]).map(function(x){return x.fecha}).sort().pop();return l||f.alta||''}

/* ---------- datos (API) ---------- */
function store(k,v){try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(_){}}
function stored(k){try{return localStorage.getItem(k)||''}catch(_){return ''}}
function newId(){return crypto.randomUUID()}
async function rawApi(method,url,body){
  var r=await fetch(url,{method:method,headers:Object.assign({'Content-Type':'application/json'},S.token?{Authorization:'Bearer '+S.token}:{}),body:body?JSON.stringify(body):undefined});
  var j={};try{j=await r.json()}catch(_){}
  if(!r.ok){var e=new Error(j.error||('Error '+r.status));e.status=r.status;throw e}
  return j;
}
async function api(method,url,body){
  try{return await rawApi(method,url,body)}
  catch(e){
    if(e.status===401&&S.refresh&&url.indexOf('/api/auth/')!==0){
      try{var j=await rawApi('POST','/api/auth/refresh',{refresh:S.refresh});setSession(j);return await rawApi(method,url,body)}catch(_){}
    }
    if(e.status===401&&url.indexOf('/api/auth/')!==0){logout('Tu sesión ha caducado. Entra de nuevo.')}
    throw e;
  }
}
function setSession(j){S.token=j.token;S.refresh=j.refresh;S.email=j.email;store('mc_token',j.token);store('mc_refresh',j.refresh);store('mc_email',j.email)}
function logout(msg){S.token='';S.refresh='';S.email='';S.familias=[];S.cuentos=[];S.ready={cuentos:false,familias:false};S.loginErr=msg||'';store('mc_token');store('mc_refresh');store('mc_email');closeModal();render()}
function save(col,id,data){
  var d=Object.assign({},data);delete d.id;
  return api('PUT','/api/'+col+'/'+id,d).then(function(saved){
    var arr=S[col],i=arr.findIndex(function(x){return x.id===id});
    if(i>=0)arr[i]=saved;else arr.push(saved);
    render();return saved;
  });
}
function remove(col,id){
  return api('DELETE','/api/'+col+'/'+id).then(function(){S[col]=S[col].filter(function(x){return x.id!==id});render()});
}
async function loadAll(){
  S.err=null;render();
  try{
    var r=await Promise.all([api('GET','/api/cuentos'),api('GET','/api/familias')]);
    S.cuentos=r[0];S.familias=r[1];
  }catch(e){if(e.status!==401)S.err=e.message}
  S.ready.cuentos=S.ready.familias=true;render();
}

/* ---------- vistas ---------- */
function head(t,p,btn){return '<div class="head"><div><h1>'+t+'</h1><p>'+p+'</p></div>'+(btn||'')+'</div>'}
function exBanner(){return ''}
function loading(){
  if(S.err)return '<div class="empty">No se pudieron cargar los datos: '+esc(S.err)+'<button class="btn" data-act="reload">Reintentar</button></div>';
  return '';
}
function vPanel(){
  var fam=S.familias,cu=S.cuentos,pub=cu.filter(function(c){return c.estado==='publicado'});
  var subs=fam.filter(function(f){return f.etapa==='suscriptora'}).length;
  var favs=fam.reduce(function(a,f){return a+(f.favoritos||[]).length},0);
  var tot=fam.length;
  var cnt={};ETAPAS.forEach(function(e){cnt[e]=fam.filter(function(f){return f.etapa===e}).length});
  var top=cu.slice().sort(function(a,b){return (b.vistas||0)-(a.vistas||0)}).filter(function(c){return c.vistas>0}).slice(0,5);
  var mx=top.length?top[0].vistas:1;
  var secs={'2–4':0,'4–6':0,'6–9':0};
  fam.forEach(function(f){(f.hijos||[]).forEach(function(h){if(h.edad!==''&&h.edad!=null)secs[secOf(h.edad)]++})});
  var secMax=Math.max(1,secs['2–4'],secs['4–6'],secs['6–9']);
  var lim=addDays(today(),7);
  var seg=fam.filter(function(f){return f.proximo&&f.proximo<=lim&&f.etapa!=='inactiva'}).sort(function(a,b){return a.proximo<b.proximo?-1:1}).slice(0,6);
  var pers=fam.filter(function(f){return f.etapa==='suscriptora'&&f.personaje!=='personaje listo'}).slice(0,5);
  var h=head('Panel','Cómo van las familias y los cuentos de Moralicuentos.',
    '<button class="btn pri" data-act="nueva-fam">Nueva familia</button>')+loading()+exBanner();
  h+='<div class="grid kpis">'
   +'<div class="card kpi"><small>Familias</small><b>'+tot+'</b><span>'+(cnt.registrada+cnt.suscriptora)+' con cuenta</span></div>'
   +'<div class="card kpi"><small>Suscriptoras</small><b>'+subs+'</b><span>'+(tot?Math.round(subs*100/tot):0)+'% de las familias</span></div>'
   +'<div class="card kpi"><small>Cuentos publicados</small><b>'+pub.length+'</b><span>'+(cu.length-pub.length)+' en borrador</span></div>'
   +'<div class="card kpi"><small>Favoritos guardados</small><b>'+favs+'</b><span>entre todas las familias</span></div></div>';
  h+='<div class="grid two">';
  h+='<div class="card stack"><h2>Cuentos más vistos</h2>'+(top.length?top.map(function(c){return '<div class="bar"><span title="'+esc(c.titulo)+'">'+esc(c.titulo)+'</span><div class="t"><i style="width:'+Math.round(c.vistas*100/mx)+'%"></i></div><em>'+c.vistas+'</em></div>'}).join(''):'<div class="empty">Aún no hay visitas registradas.</div>')+'</div>';
  h+='<div class="card stack"><h2>Familias por etapa</h2>'+(tot?'<div class="funnel">'+ETAPAS.filter(function(e){return cnt[e]}).map(function(e){return '<i class="f-'+e+'" style="flex:'+cnt[e]+'"></i>'}).join('')+'</div><div class="legend">'+ETAPAS.map(function(e){return '<span class="l-'+e+'"><b>'+cap(e)+'s '+cnt[e]+'</b></span>'}).join('')+'</div>':'<div class="empty">Añade la primera familia para ver el embudo.</div>')
   +'<h3 style="margin-top:6px">Peques por sección de edad</h3>'+EDADES.map(function(e){return '<div class="bar"><span>'+e+' años</span><div class="t"><i style="width:'+Math.round(secs[e]*100/secMax)+'%"></i></div><em>'+secs[e]+'</em></div>'}).join('')+'</div>';
  h+='<div class="card stack"><h2>Seguimientos de esta semana</h2>'+(seg.length?'<div class="list">'+seg.map(function(f){var late=f.proximo<today();return '<button class="li" data-act="edit-fam" data-id="'+f.id+'"><span><b>'+esc(f.nombre)+'</b><br><span class="muted small">'+esc((f.interacciones&&f.interacciones[0]&&f.interacciones[0].texto)||'Sin notas')+'</span></span><span class="pill '+(late?'p-borrador':'p-interesada')+'">'+(late?'Vencido · ':'')+fdate(f.proximo)+'</span></button>'}).join('')+'</div>':'<p class="muted">Nada pendiente. Pon una fecha de seguimiento en la ficha de cada familia.</p>')+'</div>';
  h+='<div class="card stack"><h2>Peques por convertir en personaje</h2>'+(pers.length?'<div class="list">'+pers.map(function(f){return '<button class="li" data-act="edit-fam" data-id="'+f.id+'"><span><b>'+esc(f.nombre)+'</b><br><span class="muted small">'+esc((f.hijos||[]).map(function(x){return x.nombre}).filter(Boolean).join(', ')||'Sin peques anotados')+'</span></span><span class="pill p-registrada">'+esc(f.personaje||'sin empezar')+'</span></button>'}).join('')+'</div>':'<p class="muted">Las suscriptoras que aún no tienen su personaje listo aparecen aquí.</p>')+'</div>';
  h+='</div>';
  return h;
}
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1)}
function famRows(){
  var q=S.fq.trim().toLowerCase();
  var rows=S.familias.filter(function(f){
    if(S.fe!=='todas'&&f.etapa!==S.fe)return false;
    if(S.fs!=='todas'&&!(f.hijos||[]).some(function(h){return secOf(h.edad)===S.fs}))return false;
    if(q&&((f.nombre||'')+' '+(f.email||'')+' '+(f.hijos||[]).map(function(h){return h.nombre}).join(' ')).toLowerCase().indexOf(q)<0)return false;
    return true}).sort(function(a,b){return (a.nombre||'').localeCompare(b.nombre||'','es')});
  if(!rows.length)return '<div class="empty">'+(S.familias.length?'Ninguna familia coincide con la búsqueda.':'Todavía no hay familias. Añade la primera o espera a que se registren desde la app.')+(S.familias.length?'':'<button class="btn pri" data-act="nueva-fam">Añadir familia</button>')+'</div>';
  return '<div class="tbl"><table><thead><tr><th>Familia</th><th>Etapa</th><th>Peques</th><th>Favoritos</th><th>Último contacto</th><th>Seguimiento</th></tr></thead><tbody>'+rows.map(function(f){
    return '<tr data-act="edit-fam" data-id="'+f.id+'"><td><div class="n">'+esc(f.nombre)+'</div><div class="e">'+esc(f.email||'')+'</div></td><td><span class="pill p-'+f.etapa+'">'+cap(f.etapa||'')+'</span></td><td><div class="kids">'+((f.hijos||[]).map(function(h){return '<span class="chip">'+esc(h.nombre||'Peque')+' · '+esc(h.edad)+'</span>'}).join('')||'<span class="muted">—</span>')+'</div></td><td>'+(f.favoritos||[]).length+'</td><td>'+fdate(lastContact(f))+'</td><td>'+(f.proximo?fdate(f.proximo):'—')+'</td></tr>'}).join('')+'</tbody></table></div>';
}
function vFamilias(){
  return head('Familias','Contactos, peques, favoritos y seguimiento de cada familia.','<button class="btn pri" data-act="nueva-fam">Nueva familia</button>')+loading()+exBanner()
   +'<div class="tools"><input type="search" id="fq" placeholder="Buscar por nombre, email o peque" value="'+esc(S.fq)+'" aria-label="Buscar familias">'
   +'<select id="fe" aria-label="Etapa"><option value="todas">Todas las etapas</option>'+ETAPAS.map(function(e){return '<option value="'+e+'"'+(S.fe===e?' selected':'')+'>'+cap(e)+'</option>'}).join('')+'</select>'
   +'<select id="fs" aria-label="Edad del peque"><option value="todas">Todas las edades</option>'+EDADES.map(function(e){return '<option value="'+e+'"'+(S.fs===e?' selected':'')+'>'+e+' años</option>'}).join('')+'</select></div>'
   +'<div id="flist">'+famRows()+'</div>';
}
function vCuentos(){
  var rows=S.cuentos.filter(function(c){return (S.ce==='todas'||c.edad===S.ce)&&(S.cs==='todos'||S.cs==='todas'||c.estado===S.cs)}).sort(function(a,b){return (b.creado||'')<(a.creado||'')?-1:1});
  var h=head('Cuentos','Biblioteca de cuentos: añade, edita o elimina y decide cuáles ven las familias.','<button class="btn pri" data-act="nuevo-cuento">Añadir cuento nuevo</button>')+loading()+exBanner();
  h+='<div class="tools"><select id="ce" aria-label="Edad recomendada"><option value="todas">Todas las edades</option>'+EDADES.map(function(e){return '<option value="'+e+'"'+(S.ce===e?' selected':'')+'>'+e+' años</option>'}).join('')+'</select>'
   +'<select id="cs" aria-label="Estado"><option value="todas">Publicados y borradores</option><option value="publicado"'+(S.cs==='publicado'?' selected':'')+'>Publicados</option><option value="borrador"'+(S.cs==='borrador'?' selected':'')+'>Borradores</option></select></div>';
  if(!rows.length)return h+'<div class="empty">'+(S.cuentos.length?'Ningún cuento coincide con el filtro.':'Aún no hay cuentos. Crea el primero o genera uno con el asistente IA.')+'<button class="btn pri" data-act="nuevo-cuento">Añadir cuento nuevo</button></div>';
  return h+'<div class="grid cards">'+rows.map(function(c){return '<button class="cuento" data-act="edit-cuento" data-id="'+c.id+'">'+cover(c)+'<div class="b"><div class="row"><span class="pill p-'+c.estado+'">'+cap(c.estado||'borrador')+'</span><span class="chip">'+esc(c.edad)+' años</span><span class="chip">'+esc(c.valor||'')+'</span></div><h3>'+esc(c.titulo)+'</h3><p>'+esc(c.descripcion||'')+'</p><span class="muted small">'+(c.vistas||0)+' vistas · '+favCount(c.id)+' favoritos</span></div></button>'}).join('')+'</div>';
}
var IA_TIPOS=[['resumen','Resumen'],['escenas','Escenas'],['dialogos','Diálogos'],['guion','Guion de vídeo'],['imagenes','Descripciones para imágenes']];
function vIA(){
  var f=S.ia.form;
  var h=head('Asistente IA','Dime de qué va el cuento y genero el material para escribirlo y producirlo.');
  if(!sample)return h+'<div class="empty">El asistente necesita abrir esta página desde Claude. Aquí no está disponible.</div>';
  h+='<div class="grid two" style="align-items:start"><div class="card f" style="gap:14px">'
   +'<div class="f"><label for="ia-nombre">Nombre del cuento</label><input id="ia-nombre" data-ia="nombre" value="'+esc(f.nombre)+'" placeholder="Pepita Calabacita y la noche de las luces"></div>'
   +'<div class="f"><label for="ia-tema">Temática</label><input id="ia-tema" data-ia="tema" value="'+esc(f.tema)+'" placeholder="Halloween, Navidad, el bosque…"></div>'
   +'<div class="fg"><div class="f"><label for="ia-edad">Edad</label><select id="ia-edad" data-ia="edad">'+EDADES.map(function(e){return '<option'+(f.edad===e?' selected':'')+'>'+e+'</option>'}).join('')+'</select></div>'
   +'<div class="f"><label for="ia-valor">Mensaje o valor</label><input id="ia-valor" data-ia="valor" value="'+esc(f.valor)+'" placeholder="Empatía"></div></div>'
   +'<div class="f"><label for="ia-pers">Personajes</label><input id="ia-pers" data-ia="personajes" value="'+esc(f.personajes)+'"></div>'
   +'<p class="muted small">Cada pestaña se genera al pulsar el botón. El resumen sirve de base para las escenas, los diálogos, el guion y las imágenes.</p></div>';
  h+='<div class="card stack"><div class="seg" role="tablist">'+IA_TIPOS.map(function(t){return '<button role="tab" class="'+(S.ia.tipo===t[0]?'on':'')+'" data-act="ia-tab" data-t="'+t[0]+'">'+t[1]+'</button>'}).join('')+'</div>'
   +'<div class="out" id="ia-out" aria-live="polite">'+esc(S.ia.out[S.ia.tipo]||'Pulsa “Generar” para crear este material.')+'</div>'
   +'<div class="row"><button class="btn pri" data-act="ia-gen" id="ia-gen"'+(S.ia.busy?' disabled':'')+'>'+(S.ia.busy?'Generando…':'Generar')+'</button>'
   +(S.ia.busy?'<button class="btn" data-act="ia-stop">Parar</button>':'')
   +'<button class="btn" data-act="ia-copy">Copiar</button>'
   +'<button class="btn" data-act="ia-borrador"'+(S.ia.out.resumen?'':' disabled')+'>Crear borrador de cuento</button></div></div></div>';
  return h;
}
function vPrevia(){
  var p=S.pv;
  var h=head('Vista familia','Así ve la app una familia. Navega como lo haría ella; esta vista no cambia las visitas de los cuentos.');
  var scr=p.screen,body='';
  var pub=S.cuentos.filter(function(c){return c.estado==='publicado'});
  var cu=S.cuentos.find(function(c){return c.id===p.id});
  if(scr==='inicio'){
    body='<div class="art"><div><b>Imagen bonita de Pepita</b><br><span class="small">Aquí irá su ilustración</span></div></div>'
     +'<div class="fr-big">Los Moralicuentos de la Iaia Carola</div><p class="muted">Descubre cuentos mágicos llenos de aventuras y valores.</p>'
     +'<button class="btn pri" data-act="pv" data-s="registro" data-tab="registro" style="justify-content:center">Registrarse</button>'
     +'<button class="btn" data-act="pv" data-s="registro" data-tab="login" style="justify-content:center">Iniciar sesión</button>'
     +'<p class="small muted" style="text-align:center">No solo entretiene, también educa.</p>';
  }else if(scr==='registro'){
    body='<div class="seg"><button class="'+(p.tab==='registro'?'on':'')+'" data-act="pv-tab" data-tab="registro">Registrarse</button><button class="'+(p.tab==='login'?'on':'')+'" data-act="pv-tab" data-tab="login">Iniciar sesión</button></div>'
     +'<div class="f" style="gap:12px">'+(p.tab==='registro'?'<div class="f"><label for="r-nombre">Nombre</label><input id="r-nombre" autocomplete="off"></div>':'')
     +'<div class="f"><label for="r-email">Email</label><input id="r-email" type="email" autocomplete="off"></div>'
     +'<div class="f"><label for="r-pass">Contraseña</label><input id="r-pass" type="password" autocomplete="off"></div></div>'
     +'<button class="btn pri" data-act="pv-reg" style="justify-content:center">'+(p.tab==='registro'?'Crear cuenta':'Entrar')+'</button>'
     +'<p class="small muted">Prueba: al registrarte se crea la familia en el CRM como “registrada”. La contraseña no se guarda.</p>';
  }else if(scr==='biblioteca'){
    var list=pub.filter(function(c){return p.edad==='todas'||c.edad===p.edad});
    body='<div class="fr-big" style="font-size:1.4rem">Biblioteca de cuentos</div><div class="row">'+['todas'].concat(EDADES).map(function(e){return '<button class="btn sm'+(p.edad===e?' pri':'')+'" data-act="pv-edad" data-e="'+e+'">'+(e==='todas'?'Todos':e)+'</button>'}).join('')+'</div>'
     +(list.length?list.map(function(c){return '<div class="fr-card">'+cover(c,'sm')+'<div style="min-width:0;flex:1"><b>'+esc(c.titulo)+'</b><div class="small muted">'+esc(c.descripcion||'')+'</div><div class="row" style="margin-top:6px;gap:6px"><span class="chip">'+esc(c.edad)+' años</span><span class="chip">'+esc(c.valor||'')+'</span></div><button class="btn sm" style="margin-top:8px" data-act="pv-cuento" data-id="'+c.id+'">Ver cuento</button></div></div>'}).join(''):'<div class="empty">No hay cuentos publicados para esta edad.</div>');
  }else if(scr==='cuento'&&cu){
    var fav=p.favs.indexOf(cu.id)>=0;
    body='<button class="btn sm" data-act="pv" data-s="biblioteca" style="align-self:flex-start">← Biblioteca</button>'+cover(cu,'big')
     +'<div class="fr-big" style="font-size:1.4rem">'+esc(cu.titulo)+'</div><div class="row"><span class="chip">'+esc(cu.edad)+' años</span><span class="chip">'+esc(cu.valor||'')+'</span></div>'
     +'<div><div class="lbl">SINOPSIS</div><p>'+esc(cu.sinopsis||cu.descripcion||'Pronto habrá sinopsis.')+'</p></div>'
     +(cu.video?'<a class="btn" href="'+esc(cu.video)+'" target="_blank" rel="noopener" style="justify-content:center">Reproducir vídeo</a>':'<button class="btn" disabled style="justify-content:center">Vídeo próximamente</button>')
     +'<button class="btn'+(fav?' pri':'')+'" data-act="pv-fav" data-id="'+cu.id+'" style="justify-content:center">'+(fav?'Guardado en favoritos':'Marcar como favorito')+'</button>'
     +'<button class="btn pri" data-act="pv" data-s="actividad" style="justify-content:center">Actividad final</button>';
  }else if(scr==='actividad'&&cu){
    body='<button class="btn sm" data-act="pv" data-s="cuento" style="align-self:flex-start">← '+esc(cu.titulo)+'</button><div class="fr-big" style="font-size:1.4rem">Actividad final</div>'
     +'<div class="tag"><div class="lbl">PEQUEÑA ACTIVIDAD</div><p>'+esc(cu.actividad||'Sin actividad todavía.')+'</p></div>'
     +'<div class="tag"><div class="lbl">PREGUNTA SOBRE LA HISTORIA</div><p>'+esc(cu.pregunta||'Sin pregunta todavía.')+'</p></div>'
     +'<div class="moral">'+esc(cu.moraleja||'La moraleja aparecerá aquí.')+'</div>';
  }else if(scr==='favoritos'){
    var fl=p.favs.map(function(id){return S.cuentos.find(function(c){return c.id===id})}).filter(Boolean);
    body='<div class="fr-big" style="font-size:1.4rem">Favoritos</div>'+(fl.length?fl.map(function(c){return '<div class="fr-card">'+cover(c,'sm')+'<div style="flex:1;min-width:0"><b>'+esc(c.titulo)+'</b><div><button class="btn sm" style="margin-top:6px" data-act="pv-cuento" data-id="'+c.id+'">Ver cuento</button></div></div></div>'}).join(''):'<div class="empty">Marca un cuento como favorito y lo guardaremos aquí.</div>');
  }else{body='<div class="empty">Elige un cuento en la biblioteca.</div>'}
  var logged=scr!=='inicio'&&scr!=='registro';
  h+='<div class="frame"><div class="fr-top"><span>Moralicuentos</span><span class="small muted">vista previa</span></div><div class="fr-body">'+body+'</div>'
   +(logged?'<div class="fr-nav"><button class="'+(scr==='biblioteca'||scr==='cuento'||scr==='actividad'?'on':'')+'" data-act="pv" data-s="biblioteca">Biblioteca</button><button class="'+(scr==='favoritos'?'on':'')+'" data-act="pv" data-s="favoritos">Favoritos</button><button data-act="pv" data-s="inicio">Salir</button></div>':'')+'</div>';
  return h;
}

/* ---------- modales ---------- */
function field(id,label,val,type,full,ph){return '<div class="f'+(full?' full':'')+'"><label for="'+id+'">'+label+'</label><input id="'+id+'" type="'+(type||'text')+'" value="'+esc(val||'')+'"'+(ph?' placeholder="'+esc(ph)+'"':'')+'></div>'}
function area(id,label,val,full,ph){return '<div class="f'+(full?' full':'')+'"><label for="'+id+'">'+label+'</label><textarea id="'+id+'"'+(ph?' placeholder="'+esc(ph)+'"':'')+'>'+esc(val||'')+'</textarea></div>'}
function sel(id,label,opts,val,full){return '<div class="f'+(full?' full':'')+'"><label for="'+id+'">'+label+'</label><select id="'+id+'">'+opts.map(function(o){return '<option value="'+esc(o)+'"'+(o===val?' selected':'')+'>'+esc(cap(o))+'</option>'}).join('')+'</select></div>'}
function dlg(title,body,foot){$('#modal').innerHTML='<div class="ov" data-act="ov"><div class="dlg" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><header><h2>'+esc(title)+'</h2><button class="btn sm" data-act="close" aria-label="Cerrar">Cerrar</button></header><div class="body">'+body+'</div><footer>'+foot+'</footer></div></div>'}
function closeModal(){S.modal=null;$('#modal').innerHTML=''}
function drawFam(){
  var m=S.modal,d=m.d,isNew=!m.id;
  var pub=S.cuentos.filter(function(c){return c.estado==='publicado'});
  var b='<div class="fg">'+field('m-nombre','Nombre de la familia',d.nombre,'text',false,'Familia Pérez')+field('m-email','Email',d.email,'email')
   +sel('m-etapa','Etapa',ETAPAS,d.etapa)+field('m-proximo','Próximo seguimiento',d.proximo,'date')
   +sel('m-personaje','Peque como personaje',PERSONAJE,d.personaje||'sin empezar',true)+'</div>'
   +'<div class="f"><span class="lbl">PEQUES</span>'+(d.hijos||[]).map(function(h,i){return '<div class="hijo"><input class="hn" placeholder="Nombre" value="'+esc(h.nombre)+'" aria-label="Nombre del peque"><input class="he" type="number" min="1" max="12" placeholder="Edad" value="'+esc(h.edad)+'" aria-label="Edad"><button class="btn sm" data-act="del-hijo" data-i="'+i+'" aria-label="Quitar peque">×</button></div>'}).join('')+'<div><button class="btn sm" data-act="add-hijo">Añadir peque</button></div></div>'
   +(pub.length?'<div class="f"><span class="lbl">CUENTOS FAVORITOS</span><div class="checks">'+pub.map(function(c){return '<label><input type="checkbox" class="fv" value="'+c.id+'"'+((d.favoritos||[]).indexOf(c.id)>=0?' checked':'')+'>'+esc(c.titulo)+'</label>'}).join('')+'</div></div>':'')
   +area('m-notas','Notas',d.notas,false,'Intereses, cómo llegó, qué le gusta…')
   +'<div class="f"><span class="lbl">HISTORIAL DE CONTACTO</span><div class="fg"><div class="f">'+sel('i-tipo','Tipo',TIPOS,'Email').replace('<label for="i-tipo">Tipo</label>','')+'</div><div class="f"><input id="i-texto" placeholder="¿Qué habéis hablado?" aria-label="Texto del contacto" style="border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:9px 12px"></div></div><div><button class="btn sm" data-act="add-int">Añadir al historial</button></div>'
   +'<div class="hist">'+((d.interacciones||[]).map(function(x){return '<div class="h"><span class="muted">'+fdate(x.fecha)+'</span><b>'+esc(x.tipo)+'</b><span>'+esc(x.texto)+'</span></div>'}).join('')||'<p class="muted small">Todavía no hay contactos anotados.</p>')+'</div></div>'
   +'<div class="err" id="m-err"></div>';
  var foot=isNew?'<span></span>':(m.confirm?'<span class="row"><span class="small">¿Eliminar esta familia?</span><button class="btn sm danger" data-act="del-fam-ok">Sí, eliminar</button><button class="btn sm" data-act="del-no">Cancelar</button></span>':'<button class="btn danger" data-act="del-fam">Eliminar</button>');
  foot+='<button class="btn pri" data-act="save-fam">Guardar</button>';
  dlg(isNew?'Nueva familia':d.nombre,b,foot);
}
function readFam(){
  var d=S.modal.d;
  d.nombre=$('#m-nombre').value.trim();d.email=$('#m-email').value.trim();d.etapa=$('#m-etapa').value;d.proximo=$('#m-proximo').value;d.personaje=$('#m-personaje').value;d.notas=$('#m-notas').value;
  var hn=document.querySelectorAll('.hn'),he=document.querySelectorAll('.he');
  d.hijos=[].map.call(hn,function(el,i){return {nombre:el.value.trim(),edad:he[i].value}});
  d.favoritos=[].map.call(document.querySelectorAll('.fv:checked'),function(el){return el.value});
}
function drawCuento(){
  var m=S.modal,d=m.d,isNew=!m.id;
  var b='<div class="fg">'+field('c-titulo','Título',d.titulo,'text',true,'Pepita Calabacita y la noche de las luces')
   +sel('c-edad','Edad recomendada',EDADES,d.edad)+sel('c-valor','Valor que transmite',VALORES,d.valor)
   +sel('c-estado','Estado',['borrador','publicado'],d.estado)+field('c-video','Enlace del vídeo (YouTube)',d.video,'url',false,'https://')
   +area('c-desc','Pequeña descripción',d.descripcion,true,'Una o dos frases para la biblioteca')
   +area('c-sin','Sinopsis',d.sinopsis,true)
   +area('c-act','Pequeña actividad final',d.actividad,true,'Dibuja, cuenta, imita…')
   +area('c-preg','Pregunta sobre la historia',d.pregunta,true)
   +field('c-mor','Moraleja',d.moraleja,'text',true)+'</div><div class="err" id="m-err"></div>';
  var foot=isNew?'<span></span>':(m.confirm?'<span class="row"><span class="small">¿Eliminar este cuento?</span><button class="btn sm danger" data-act="del-cuento-ok">Sí, eliminar</button><button class="btn sm" data-act="del-no">Cancelar</button></span>':'<button class="btn danger" data-act="del-cuento">Eliminar</button>');
  foot+='<button class="btn pri" data-act="save-cuento">Guardar</button>';
  dlg(isNew?'Cuento nuevo':d.titulo,b,foot);
}
function readCuento(){
  var d=S.modal.d;
  d.titulo=$('#c-titulo').value.trim();d.edad=$('#c-edad').value;d.valor=$('#c-valor').value;d.estado=$('#c-estado').value;d.video=$('#c-video').value.trim();
  d.descripcion=$('#c-desc').value.trim();d.sinopsis=$('#c-sin').value.trim();d.actividad=$('#c-act').value.trim();d.pregunta=$('#c-preg').value.trim();d.moraleja=$('#c-mor').value.trim();
}

/* ---------- IA ---------- */
function iaErr(e){return (e&&e.message)||'Se interrumpió la generación. Pulsa Generar para intentarlo otra vez.'}
async function iaGen(){
  var f=S.ia.form,tipo=S.ia.tipo;
  if(!f.nombre.trim()||!f.valor.trim()){toast('Escribe al menos el nombre y el valor del cuento');return}
  ctl=new AbortController();S.ia.busy=true;delete S.ia.out[tipo];render();
  var out=$('#ia-out');if(out)out.textContent='Pensando…';
  try{
    var r=await fetch('/api/ia/generar',{method:'POST',signal:ctl.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+S.token},body:JSON.stringify({tipo:tipo,form:f,resumen:S.ia.out.resumen||''})});
    var j=await r.json().catch(function(){return {}});
    if(r.status===401){logout('Tu sesión ha caducado. Entra de nuevo.');return}
    if(!r.ok)throw new Error(j.error||('Error '+r.status));
    S.ia.out[tipo]=j.text;
  }catch(e){if(e.name!=='AbortError')toast(iaErr(e))}
  S.ia.busy=false;ctl=null;if(S.view==='ia')render();
}

function vLogin(){
  return '<form class="login card raise" id="lg" autocomplete="on"><div><img class="logo" src="/pepita.jpg" alt="Pepita"><p class="eyebrow">Panel de gestión</p><h1>Moralicuentos</h1><p class="muted">Panel de la Iaia Carola. Entra con tu cuenta.</p></div>'
   +'<div class="f"><label for="lg-user">Usuario</label><input id="lg-user" type="text" autocomplete="username" autocapitalize="off" spellcheck="false" required></div>'
   +'<div class="f"><label for="lg-pass">Contraseña</label><input id="lg-pass" type="password" autocomplete="current-password" required></div>'
   +(S.loginErr?'<div class="err" role="alert">'+esc(S.loginErr)+'</div>':'')
   +'<button class="btn pri" type="submit" style="justify-content:center">Entrar</button></form>';
}
/* ---------- render ---------- */
function render(){
  $('#nav').innerHTML=NAV.map(function(n){return '<button class="nav-i'+(S.view===n.id?' on':'')+'" data-act="nav" data-v="'+n.id+'"'+(S.view===n.id?' aria-current="page"':'')+'>'+ico(n.i)+'<span>'+n.t+'</span></button>'}).join('');
  document.body.classList.toggle('anon',!S.token);
  if(!S.token){$('#main').innerHTML=vLogin();return}
  var wait=!S.ready.cuentos||!S.ready.familias;
  $('#status').innerHTML=(wait?'Cargando datos…':esc(S.email))+'<br><button class="btn sm" data-act="logout">Cerrar sesión</button>';
  var v=({panel:vPanel,familias:vFamilias,cuentos:vCuentos,ia:vIA,previa:vPrevia})[S.view];
  var fx=document.activeElement&&document.activeElement.id;
  $('#main').innerHTML=v();
  if(fx&&fx.indexOf('ia-')===0||fx==='fq'){var el=document.getElementById(fx);if(el){el.focus();try{el.setSelectionRange(el.value.length,el.value.length)}catch(_){}}}
}

/* ---------- eventos ---------- */
document.addEventListener('click',function(ev){
  var t=ev.target.closest('[data-act]');if(!t)return;
  var a=t.dataset.act;
  if(a==='ov'){if(ev.target===t)closeModal();return}
  if(a==='close'){closeModal();return}
  if(a==='nav'){S.view=t.dataset.v;render();window.scrollTo(0,0);return}
  if(a==='nueva-fam'){S.modal={t:'fam',id:null,d:{nombre:'',email:'',etapa:'interesada',hijos:[],notas:'',interacciones:[],favoritos:[],personaje:'sin empezar',proximo:'',alta:today()}};drawFam();return}
  if(a==='edit-fam'){var f=S.familias.find(function(x){return x.id===t.dataset.id});if(!f)return;S.modal={t:'fam',id:f.id,d:JSON.parse(JSON.stringify(f))};drawFam();return}
  if(a==='add-hijo'){readFam();S.modal.d.hijos.push({nombre:'',edad:''});drawFam();return}
  if(a==='del-hijo'){readFam();S.modal.d.hijos.splice(+t.dataset.i,1);drawFam();return}
  if(a==='add-int'){var tx=$('#i-texto').value.trim();if(!tx){$('#i-texto').focus();return}var tp=$('#i-tipo').value;readFam();S.modal.d.interacciones=[{fecha:today(),tipo:tp,texto:tx}].concat(S.modal.d.interacciones||[]);drawFam();return}
  if(a==='save-fam'){readFam();var d=S.modal.d;if(!d.nombre){$('#m-err').textContent='Escribe el nombre de la familia.';return}
    d.hijos=d.hijos.filter(function(h){return h.nombre||h.edad});
    var id=S.modal.id||newId('familias');t.disabled=true;
    save('familias',id,d).then(function(){closeModal();toast('Familia guardada')},function(e){t.disabled=false;$('#m-err').textContent='No se pudo guardar ('+(e&&e.message||'error')+').'});return}
  if(a==='del-fam'||a==='del-cuento'){S.modal.confirm=true;(S.modal.t==='fam'?drawFam:drawCuento)();return}
  if(a==='del-no'){S.modal.confirm=false;(S.modal.t==='fam'?drawFam:drawCuento)();return}
  if(a==='del-fam-ok'){remove('familias',S.modal.id).then(function(){closeModal();toast('Familia eliminada')});return}
  if(a==='nuevo-cuento'){S.modal={t:'cuento',id:null,d:{titulo:'',edad:'4–6',valor:'Empatía',estado:'borrador',video:'',descripcion:'',sinopsis:'',actividad:'',pregunta:'',moraleja:'',vistas:0,creado:today()}};drawCuento();return}
  if(a==='edit-cuento'){var c=S.cuentos.find(function(x){return x.id===t.dataset.id});if(!c)return;S.modal={t:'cuento',id:c.id,d:JSON.parse(JSON.stringify(c))};drawCuento();return}
  if(a==='save-cuento'){readCuento();var dc=S.modal.d;if(!dc.titulo){$('#m-err').textContent='Escribe el título del cuento.';return}
    var cid=S.modal.id||newId('cuentos');t.disabled=true;
    save('cuentos',cid,dc).then(function(){closeModal();toast('Cuento guardado')},function(e){t.disabled=false;$('#m-err').textContent='No se pudo guardar ('+(e&&e.message||'error')+').'});return}
  if(a==='del-cuento-ok'){remove('cuentos',S.modal.id).then(function(){closeModal();toast('Cuento eliminado')});return}
  if(a==='logout'){logout();return}
  if(a==='reload'){loadAll();return}
  if(a==='ia-tab'){S.ia.tipo=t.dataset.t;render();return}
  if(a==='ia-gen'){iaGen();return}
  if(a==='ia-stop'){if(ctl)ctl.abort();return}
  if(a==='ia-copy'){var tx2=S.ia.out[S.ia.tipo]||'';if(!tx2){toast('Todavía no hay texto que copiar');return}
    (navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(tx2):Promise.reject()).then(function(){toast('Copiado')},function(){var o=$('#ia-out');var r=document.createRange();r.selectNodeContents(o);var s=getSelection();s.removeAllRanges();s.addRange(r);toast('Selecciona y copia con Ctrl+C')});return}
  if(a==='ia-borrador'){var f2=S.ia.form,r=S.ia.out.resumen||'';var m=r.match(/Moraleja:\s*(.+)$/im);
    var body=r.replace(/Moraleja:.*$/im,'').trim();
    save('cuentos',newId('cuentos'),{titulo:f2.nombre,edad:f2.edad,valor:VALORES.indexOf(f2.valor)>=0?f2.valor:'Empatía',estado:'borrador',video:'',descripcion:body.split(/(?<=[.!?])\s/)[0].slice(0,160),sinopsis:body,actividad:'',pregunta:'',moraleja:m?m[1].trim():'',vistas:0,creado:today()}).then(function(){S.view='cuentos';render();toast('Borrador creado en Cuentos')});return}
  if(a==='pv'){S.pv.screen=t.dataset.s;if(t.dataset.tab)S.pv.tab=t.dataset.tab;render();return}
  if(a==='pv-tab'){S.pv.tab=t.dataset.tab;render();return}
  if(a==='pv-edad'){S.pv.edad=t.dataset.e;render();return}
  if(a==='pv-cuento'){S.pv.id=t.dataset.id;S.pv.screen='cuento';render();return}
  if(a==='pv-fav'){var i=S.pv.favs.indexOf(t.dataset.id);if(i>=0)S.pv.favs.splice(i,1);else S.pv.favs.push(t.dataset.id);render();return}
  if(a==='pv-reg'){
    if(S.pv.tab==='registro'){var nm=$('#r-nombre').value.trim(),em=$('#r-email').value.trim();if(!nm||!em){toast('Escribe nombre y email');return}
      save('familias',newId('familias'),{nombre:nm,email:em,etapa:'registrada',hijos:[],notas:'',favoritos:[],personaje:'sin empezar',proximo:'',alta:today(),interacciones:[{fecha:today(),tipo:'Nota',texto:'Alta desde la vista previa de la app'}]}).then(function(){toast('Familia creada en el CRM')})}
    S.pv.screen='biblioteca';render();return}
  if(a==='edit-fam'){return}
});
document.addEventListener('input',function(ev){
  var t=ev.target;
  if(t.id==='fq'){S.fq=t.value;$('#flist').innerHTML=famRows()}
  if(t.dataset&&t.dataset.ia){S.ia.form[t.dataset.ia]=t.value}
});
document.addEventListener('change',function(ev){
  var t=ev.target;
  if(t.id==='fe'){S.fe=t.value;$('#flist').innerHTML=famRows()}
  if(t.id==='fs'){S.fs=t.value;$('#flist').innerHTML=famRows()}
  if(t.id==='ce'){S.ce=t.value;render()}
  if(t.id==='cs'){S.cs=t.value;render()}
  if(t.dataset&&t.dataset.ia){S.ia.form[t.dataset.ia]=t.value}
});
document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&S.modal)closeModal()});

/* ---------- arranque ---------- */
document.addEventListener('submit',function(ev){
  if(ev.target.id!=='lg')return;
  ev.preventDefault();
  var btn=ev.target.querySelector('button');btn.disabled=true;
  rawApi('POST','/api/auth/login',{usuario:$('#lg-user').value,password:$('#lg-pass').value}).then(function(j){
    setSession(j);S.loginErr='';loadAll();
  },function(e){S.loginErr=e.message;render()});
});
S.token=stored('mc_token');S.refresh=stored('mc_refresh');S.email=stored('mc_email');
render();
if(S.token)loadAll();
})();
