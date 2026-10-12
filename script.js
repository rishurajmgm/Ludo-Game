const COLORS=['red','green','blue','yellow'];
const START={red:0,green:13,blue:26,yellow:39};
const ORIGIN={red:[0,0],green:[0,9],blue:[9,9],yellow:[9,0]};
const LAST=56; // 0-50 track, 51-55 home column, 56 finished

// Build the 52-cell track from segments [dRow,dCol,steps]
const PATH=[[6,1]];
[[0,1,4],[-1,1,1],[-1,0,5],[0,1,2],[1,0,5],[1,1,1],[0,1,5],[1,0,2],[0,-1,5],[1,-1,1],[1,0,5],[0,-1,2],
 [-1,0,5],[-1,-1,1],[0,-1,5],[-1,0,2]].forEach(([dr,dc,n])=>{for(let i=0;i<n;i++){const l=PATH.at(-1);PATH.push([l[0]+dr,l[1]+dc]);}});
const HOME={red:[],green:[],yellow:[],blue:[]};
for(let i=0;i<6;i++){HOME.red.push([7,1+i]);HOME.green.push([1+i,7]);HOME.blue.push([7,13-i]);HOME.yellow.push([13-i,7]);}
const SAFE=new Set();COLORS.forEach(c=>{SAFE.add(START[c]);SAFE.add((START[c]+8)%52);});

const ARROW={'7,0':['➜','ar-red'],'0,7':['⬇','ar-green'],'7,14':['⬅','ar-blue'],'14,7':['⬆','ar-yellow']};
let snd=true,ac;
function beep(f=440,t=.08){const A=window.AudioContext||window.webkitAudioContext;if(!snd||!A)return;ac=ac||new A();const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=f;g.gain.value=.05;o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+t);}
const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let active,turn,dice,rolled,busy,tokens,els,over;

function buildBoard(){
  const b=$('board');b.innerHTML='';
  const trackKey=new Map(PATH.map((p,i)=>[p+'',i]));
  const homeKey=new Map();COLORS.forEach(c=>HOME[c].slice(0,5).forEach(p=>homeKey.set(p+'',c)));
  const skip=(r,c)=>(r<6||r>8)&&(c<6||c>8)||(r>=6&&r<=8&&c>=6&&c<=8);
  for(let r=0;r<15;r++)for(let c=0;c<15;c++){
    if(skip(r,c))continue;
    const d=document.createElement('div');d.className='cell';
    const t=trackKey.get([r,c]+''),h=homeKey.get([r,c]+'');
    if(h)d.classList.add(h);
    const ar=ARROW[[r,c]+''];if(ar){d.textContent=ar[0];d.classList.add('arrow',ar[1]);}
    if(t!==undefined){
      const sc=COLORS.find(k=>START[k]===t);
      if(sc)d.classList.add(sc);
      if(SAFE.has(t)){d.classList.add('safe');d.textContent='★';}
    }
    d.style.gridArea=`${r+1}/${c+1}`;b.appendChild(d);
  }
  COLORS.forEach(c=>{const d=document.createElement('div');d.className='base '+c;
    d.style.gridArea=`${ORIGIN[c][0]+1}/${ORIGIN[c][1]+1}/span 6/span 6`;b.appendChild(d);});
  const m=document.createElement('div');m.className='center';m.style.gridArea='7/7/span 3/span 3';b.appendChild(m);
}

function coord(color,p,i){
  if(p<0){const[o,q]=ORIGIN[color];return[o+(i<2?2:4),q+(i%2?4:2)];}
  const[r,c]=p<=50?PATH[(START[color]+p)%52]:HOME[color][p-51];
  return[r+.5,c+.5];
}
function render(){
  const groups={};
  active.forEach(c=>tokens[c].forEach((p,i)=>{
    const[r,cc]=coord(c,p,i);const k=r+','+cc;(groups[k]=groups[k]||[]).push([c,i,r,cc,p]);}));
  Object.values(groups).forEach(g=>g.forEach(([c,i,r,cc,p],n)=>{
    const off=p<0||g.length===1?0:(n-(g.length-1)/2)*.28;
    const e=els[c][i];e.style.left=(cc+off)/15*100+'%';e.style.top=(r+off*.6)/15*100+'%';}));
  const cap=c=>c[0].toUpperCase()+c.slice(1);
  $('players').innerHTML=active.map((c,i)=>`<div class="pl ${c} ${i===turn?'on':''}"><span class="av ${c}"></span><div><strong>${cap(c)}</strong><small>${tokens[c].filter(p=>p===LAST).length}/4 finished</small></div><em>${i===turn?'♛':'♕'}</em></div>`).join('');
  const tc=active[turn];$('turnName').textContent=cap(tc)+' Player';$('av').className='av big '+tc;
  document.querySelector('.turn').style.borderColor=`var(--${tc})`;
}
function showDice(v){
  $('dice').innerHTML='';const P={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]}[v||1];
  for(let i=0;i<9;i++){const s=document.createElement('span');if(!P.includes(i)||!v)s.style.visibility='hidden';$('dice').appendChild(s);}
}
const msg=t=>$('msg').textContent=t;
const isCpu=c=>$('cpu').checked&&c!==active[0];
const movable=(c,d)=>tokens[c].map((p,i)=>(p<0?d===6:p+d<=LAST)?i:-1).filter(i=>i>=0);

function newGame(){
  const n=+$('count').value;
  active=n===2?['red','blue']:n===3?['red','green','blue']:[...COLORS];
  turn=0;dice=0;rolled=false;busy=false;over=false;
  tokens={};els={};buildBoard();
  active.forEach(c=>{tokens[c]=[-1,-1,-1,-1];els[c]=[];
    for(let i=0;i<4;i++){const e=document.createElement('div');e.className='token '+c;e.onclick=()=>pick(c,i);
      $('board').appendChild(e);els[c].push(e);}});
  showDice(0);render();msg('Red starts. Roll a 6 to bring a token out.');$('rollBtn').disabled=false;
  maybeCpu();
}
async function roll(){
  if(busy||rolled||over)return;
  busy=true;$('rollBtn').disabled=true;
  const d=$('dice');d.classList.add('roll');
  for(let i=0;i<6;i++){showDice(1+Math.floor(Math.random()*6));beep(260+i*40,.04);await sleep(70);}
  d.classList.remove('roll');
  dice=1+Math.floor(Math.random()*6);showDice(dice);rolled=true;
  const c=active[turn],opts=movable(c,dice);
  if(!opts.length){msg(`${c} rolled ${dice}. No move available.`);await sleep(900);rolled=false;busy=false;return next(false);}
  msg(`${c} rolled ${dice}. ${isCpu(c)?'Thinking...':'Tap a glowing token.'}`);
  busy=false;
  if(isCpu(c)){await sleep(700);return pick(c,cpuChoice(c,opts));}
  opts.forEach(i=>els[c][i].classList.add('can'));
}
function cpuChoice(c,opts){
  const score=i=>{const p=tokens[c][i],np=p<0?0:p+dice;let s=np;
    if(np===LAST)s+=100;if(p<0)s+=40;
    if(np<=50&&!SAFE.has((START[c]+np)%52)&&active.some(o=>o!==c&&tokens[o].some(q=>q>=0&&q<=50&&(START[o]+q)%52===(START[c]+np)%52)))s+=80;
    return s;};
  return opts.sort((a,b)=>score(b)-score(a))[0];
}
async function pick(c,i){
  if(busy||!rolled||c!==active[turn]||!movable(c,dice).includes(i))return;
  busy=true;els[c].forEach(e=>e.classList.remove('can'));
  const t=tokens[c];let extra=dice===6;
  if(t[i]<0){t[i]=0;render();await sleep(200);}
  else for(let s=0;s<dice;s++){t[i]++;beep(520,.05);render();await sleep(160);}
  if(t[i]<=50&&!SAFE.has((START[c]+t[i])%52)){
    const abs=(START[c]+t[i])%52;
    active.forEach(o=>{if(o!==c)tokens[o].forEach((q,k)=>{if(q>=0&&q<=50&&(START[o]+q)%52===abs){tokens[o][k]=-1;extra=true;beep(160,.3);msg(`${c} captured a ${o} token!`);}});});
  }
  if(t[i]===LAST)extra=true;
  render();
  if(t.every(p=>p===LAST)){over=true;busy=false;msg(`${c.toUpperCase()} wins! 🎉`);return;}
  rolled=false;busy=false;next(extra);
}
function next(extra){
  if(!extra)turn=(turn+1)%active.length;
  rolled=false;render();
  const c=active[turn];
  msg(extra?`${c} rolls again.`:`${c}'s turn.`);
  $('rollBtn').disabled=isCpu(c);
  maybeCpu();
}
function maybeCpu(){if(!over&&isCpu(active[turn]))setTimeout(roll,800);}
$('rollBtn').onclick=roll;$('newBtn').onclick=newGame;
$('count').onchange=newGame;$('cpu').onchange=()=>{$('rollBtn').disabled=isCpu(active[turn]);maybeCpu();};
newGame();

$('snd').onchange=e=>snd=e.target.checked;
$('gear').onclick=()=>$('settings').classList.toggle('open');
