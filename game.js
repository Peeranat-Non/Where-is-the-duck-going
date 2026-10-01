(()=>{
const $=s=>document.querySelector(s),lerp=(a,b,t)=>a+(b-a)*t,clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const cv=$('#c'),mctx=cv.getContext('2d');
let ctx=mctx,dpr=1,K=1;
let W=0,H=0,F=1,HZ=0;
function resize(){
  dpr=Math.min(window.devicePixelRatio||1,1.75);
  W=cv.clientWidth||1;H=cv.clientHeight||1;
  cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);
  F=Math.min(W*.62,H*.5);HZ=H*.3;
}
addEventListener('resize',resize);

const FIXED=1/120,MAXF=.1;
const ROPE={L:2.5,m:1,k:400,cRope:16,cX:2,cZ:3,Lmax:3.5,Tmax:60,vxMax:6,vPhysMax:12};
const DUCK={omega:16,zeta:.5};
const JUMP={v0:9.5,g:26};
const RESCUE={radius:.5};
const VIC_MSGS=['ช่วยด้วย','รวยไม่ไหวแล้ว!'];
const LANE=[-3.3,0,3.3],OBSTACLE_X=[-2.5,0,2.5],CAM={z:8,y:2.4},BANK=4.4,SPEEDBOAT_RZ=22;
let S,camX=0,dbg=false,testMode=false,highScore=0,best=0;
let currentSkin='duck';

try{
  highScore=+localStorage.getItem('highScore')||+localStorage.getItem('duckBest')||0;
  best=highScore;
  currentSkin=localStorage.getItem('currentSkin')||'duck';
}catch(e){}

function updateHighScoreUI(){
  if($('#mm-best-val')) $('#mm-best-val').textContent = Math.floor(highScore);
}
if($('#bd'))$('#bd').onclick=()=>{dbg=!dbg;$('#bd').textContent='Hitbox: '+(dbg?'เปิด':'ปิด')};
function setTestMode(val){
  testMode=!!val;
  if($('#bt')){
    $('#bt').textContent='โหมดทดสอบ: '+(testMode?'เปิด':'ปิด');
    $('#bt').classList.toggle('active',testMode);
  }
  if($('#mt')){
    $('#mt').textContent='🛡️ โหมดทดสอบ: '+(testMode?'เปิด 🟢':'ปิด ⚪');
    $('#mt').classList.toggle('active-mode',testMode);
  }
  if($('#sm-test')){
    $('#sm-test').textContent='🛡️ โหมดทดสอบ: '+(testMode?'เปิด 🟢':'ปิด ⚪');
  }
  if($('#ht-badge'))$('#ht-badge').hidden=!testMode;
}
if($('#bt'))$('#bt').onclick=()=>setTestMode(!testMode);
if($('#mt'))$('#mt').onclick=()=>setTestMode(!testMode);

/* ---------- Sound Effects (SFX) System ---------- */
const AUDIO_PATHS={
  click:'assets/sfx_click.mp3',
  lane:'assets/sfx_swipe.mp3',
  jump:'assets/sfx_jump.mp3',
  splash:'assets/sfx_splash.mp3',
  rescue:'assets/sfx_rescue.mp3',
  hit:'assets/sfx_hit.mp3',
  countdown:'assets/sfx_countdown.mp3',
  go:'assets/sfx_go.mp3',
  speedboat_warn:'assets/sfx_speedboat_warn.mp3',
  horse_run:'assets/sfx_horse_run.mp3',
  tuktuk_warn:'assets/sfx_tuktuk_warn.mp3',
  tuktuk_horn:'assets/sfx_tuktuk_horn.mp3',
  taxi_warn:'assets/sfx_taxi_warn.mp3',
  taxi_horn:'assets/sfx_taxi_horn.mp3'
};

class SoundManager{
  constructor(){
    this.enabled=true;this.ctx=null;this.pool={};
    for(const[k,p]of Object.entries(AUDIO_PATHS)){
      try{const a=new Audio(p);a.preload='none';this.pool[k]=a}catch(e){}
    }
  }
  init(){
    if(!this.ctx){
      const AC=window.AudioContext||window.webkitAudioContext;
      if(AC)this.ctx=new AC();
    }
    if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume();
  }
  play(k){
    if(!this.enabled||!snd)return;
    this.init();
    const a=this.pool[k];
    if(a&&a.src){
      try{
        const cl=a.cloneNode();cl.volume=.45;
        const p=cl.play();
        if(p){p.catch(()=>this.synth(k));return}
      }catch(e){}
    }
    this.synth(k);
  }
  synth(t){
    if(!this.ctx)return;
    const ctx=this.ctx,now=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.connect(gain);gain.connect(ctx.destination);
    if(t==='click'){
      osc.type='triangle';osc.frequency.setValueAtTime(600,now);osc.frequency.exponentialRampToValueAtTime(300,now+.05);
      gain.gain.setValueAtTime(.2,now);gain.gain.exponentialRampToValueAtTime(.001,now+.05);
      osc.start(now);osc.stop(now+.05);
    }else if(t==='lane'){
      osc.type='sine';osc.frequency.setValueAtTime(340,now);osc.frequency.exponentialRampToValueAtTime(520,now+.08);
      gain.gain.setValueAtTime(.18,now);gain.gain.exponentialRampToValueAtTime(.001,now+.08);
      osc.start(now);osc.stop(now+.08);
    }else if(t==='jump'){
      osc.type='sine';osc.frequency.setValueAtTime(260,now);osc.frequency.exponentialRampToValueAtTime(740,now+.16);
      gain.gain.setValueAtTime(.24,now);gain.gain.exponentialRampToValueAtTime(.001,now+.16);
      osc.start(now);osc.stop(now+.16);
    }else if(t==='splash'){
      const sz=ctx.sampleRate*.14,buf=ctx.createBuffer(1,sz,ctx.sampleRate),d=buf.getChannelData(0);
      for(let i=0;i<sz;i++)d[i]=Math.random()*2-1;
      const n=ctx.createBufferSource();n.buffer=buf;
      const fl=ctx.createBiquadFilter();fl.type='lowpass';fl.frequency.setValueAtTime(800,now);fl.frequency.linearRampToValueAtTime(250,now+.14);
      n.connect(fl);fl.connect(gain);gain.gain.setValueAtTime(.2,now);gain.gain.exponentialRampToValueAtTime(.001,now+.14);
      n.start(now);n.stop(now+.14);
    }else if(t==='rescue'){
      osc.type='triangle';osc.frequency.setValueAtTime(440,now);osc.frequency.setValueAtTime(554,now+.08);osc.frequency.setValueAtTime(659,now+.16);
      gain.gain.setValueAtTime(.25,now);gain.gain.exponentialRampToValueAtTime(.001,now+.28);
      osc.start(now);osc.stop(now+.28);
    }else if(t==='hit'){
      osc.type='sawtooth';osc.frequency.setValueAtTime(140,now);osc.frequency.exponentialRampToValueAtTime(40,now+.25);
      gain.gain.setValueAtTime(.3,now);gain.gain.exponentialRampToValueAtTime(.001,now+.25);
      osc.start(now);osc.stop(now+.25);
    }else if(t==='countdown'){
      osc.type='sine';osc.frequency.setValueAtTime(659.25,now);
      gain.gain.setValueAtTime(.22,now);gain.gain.exponentialRampToValueAtTime(.001,now+.14);
      osc.start(now);osc.stop(now+.14);
    }else if(t==='go'){
      osc.type='triangle';osc.frequency.setValueAtTime(880,now);
      osc.frequency.exponentialRampToValueAtTime(1174.66,now+.1);
      gain.gain.setValueAtTime(.26,now);gain.gain.exponentialRampToValueAtTime(.001,now+.32);
      osc.start(now);osc.stop(now+.32);
    }else if(t==='speedboat_warn'){
      // เสียงหวูด/ไซเรนเตือนเรือสปีดโบ๊ท 2 โทนสูง-ต่ำคมชัด (Marine Warning Blast)
      osc.type='sawtooth';
      osc.frequency.setValueAtTime(380,now);
      osc.frequency.setValueAtTime(560,now+.14);
      gain.gain.setValueAtTime(.28,now);
      gain.gain.exponentialRampToValueAtTime(.001,now+.45);
      osc.start(now);osc.stop(now+.45);
    }else if(t==='horse_run'){
      // เสียงฝีเท้าม้าควบย่ำน้ำเป็นจังหวะกระแทกกระทั้น (Galloping Hoofbeats)
      osc.type='triangle';
      osc.frequency.setValueAtTime(220,now);
      osc.frequency.exponentialRampToValueAtTime(70,now+.06);
      gain.gain.setValueAtTime(.32,now);
      gain.gain.exponentialRampToValueAtTime(.001,now+.13);
      osc.start(now);osc.stop(now+.13);
    }else if(t==='tuktuk_warn'){
      // สัญญาณเตือนภัยรถตุ๊กๆ ซิ่งมาจากด้านหลัง (Double Rapid Warning Beep)
      osc.type='square';
      osc.frequency.setValueAtTime(880,now);
      osc.frequency.setValueAtTime(1174,now+.08);
      osc.frequency.setValueAtTime(880,now+.16);
      osc.frequency.setValueAtTime(1174,now+.24);
      gain.gain.setValueAtTime(.22,now);
      gain.gain.exponentialRampToValueAtTime(.001,now+.36);
      osc.start(now);osc.stop(now+.36);
    }else if(t==='tuktuk_horn'){
      // เสียงแตรรถตุ๊กๆ ไทยแท้ 2 โทนสูง "แป๊นๆ!" (Dual-tone Thai Tuk-Tuk Horn)
      const osc2=ctx.createOscillator(),gain2=ctx.createGain();
      osc2.connect(gain2);gain2.connect(ctx.destination);
      osc.type='sawtooth';
      osc.frequency.setValueAtTime(520,now);
      osc.frequency.setValueAtTime(0,now+.09);
      osc.frequency.setValueAtTime(520,now+.12);
      osc2.type='sawtooth';
      osc2.frequency.setValueAtTime(660,now);
      osc2.frequency.setValueAtTime(0,now+.09);
      osc2.frequency.setValueAtTime(660,now+.12);
      gain.gain.setValueAtTime(.24,now);
      gain.gain.exponentialRampToValueAtTime(.001,now+.32);
      gain2.gain.setValueAtTime(.24,now);
      gain2.gain.exponentialRampToValueAtTime(.001,now+.32);
      osc.start(now);osc.stop(now+.32);
      osc2.start(now);osc2.stop(now+.32);
    }else if(t==='taxi_warn'){
      // สัญญาณเตือนแท็กซี่เขียว-เหลืองใจดี โน้ตเมโลดี้สดใส (Bright Friendly Triple-Chime)
      osc.type='triangle';
      osc.frequency.setValueAtTime(523.25,now);
      osc.frequency.setValueAtTime(659.25,now+.09);
      osc.frequency.setValueAtTime(783.99,now+.18);
      gain.gain.setValueAtTime(.25,now);
      gain.gain.exponentialRampToValueAtTime(.001,now+.38);
      osc.start(now);osc.stop(now+.38);
    }else if(t==='taxi_horn'){
      // เสียงแตรรถแท็กซี่กรุงเทพฯ "ปี๊นๆ!" ทรงพลัง 2 จังหวะ (Dual-Tone Car Horn)
      const osc2=ctx.createOscillator(),gain2=ctx.createGain();
      osc2.connect(gain2);gain2.connect(ctx.destination);
      osc.type='sawtooth';
      osc.frequency.setValueAtTime(440,now);
      osc.frequency.setValueAtTime(0,now+.08);
      osc.frequency.setValueAtTime(440,now+.11);
      osc2.type='sawtooth';
      osc2.frequency.setValueAtTime(554.37,now);
      osc2.frequency.setValueAtTime(0,now+.08);
      osc2.frequency.setValueAtTime(554.37,now+.11);
      gain.gain.setValueAtTime(.24,now);
      gain.gain.exponentialRampToValueAtTime(.001,now+.32);
      gain2.gain.setValueAtTime(.24,now);
      gain2.gain.exponentialRampToValueAtTime(.001,now+.32);
      osc.start(now);osc.stop(now+.32);
      osc2.start(now);osc2.stop(now+.32);
    }
  }
}
const sfx=new SoundManager();

/* ---------- Input: event เก็บเข้าคิว, fixed step ค่อยกิน ---------- */
class Input{
  constructor(el){
    this.queue=[];this.ts=null;
    addEventListener('keydown',e=>{
      if(['ArrowLeft','ArrowRight','ArrowUp','Space'].includes(e.code))e.preventDefault();
      if($('#hw')&&!$('#hw').hidden){if(e.code==='KeyP'||e.code==='Escape'||e.code==='Enter'||e.code==='Space'){e.preventDefault();closeHowToPlay();return}}
      if($('#skin-modal')&&!$('#skin-modal').hidden){
        if(e.code==='ArrowLeft'||e.code==='KeyA'){e.preventDefault();prevSkin();return}
        if(e.code==='ArrowRight'||e.code==='KeyD'){e.preventDefault();nextSkin();return}
        if(e.code==='Enter'||e.code==='Space'){e.preventDefault();applyViewedSkin();return}
        if(e.code==='KeyP'||e.code==='Escape'){e.preventDefault();closeSkinModal();if(S.state==='PAUSED')resume();return}
      }
      const mv=!$('#mm').hidden;if(mv||!$('#ov').hidden||($('#settings-menu')&&!$('#settings-menu').hidden)){if(e.code==='KeyP'||e.code==='Escape'){e.preventDefault();if($('#settings-menu')&&!$('#settings-menu').hidden){closeSettings();resume();return}if(S.state==='PAUSED'){resume();return}}if(e.code==='Enter'||e.code==='Space'){e.preventDefault();if($('#settings-menu')&&!$('#settings-menu').hidden)return;$(mv?(S.state==='PAUSED'?'#mr':'#ms'):'#go').click()}return}
      if(e.repeat)return;
      if(e.code==='ArrowLeft'||e.code==='KeyA')this.push(-1);
      if(e.code==='ArrowRight'||e.code==='KeyD')this.push(1);
      if(e.code==='ArrowUp'||e.code==='KeyW'||e.code==='Space')this.jump();
      if(e.code==='KeyP'||e.code==='Escape'){if(S.state==='RUN'||S.state==='COUNTDOWN')openSettings();else if(S.state==='PAUSED')resume()}
    });
    el.addEventListener('pointerdown',e=>{this.ts={x:e.clientX,y:e.clientY,t:e.timeStamp,m:false}});
    el.addEventListener('pointermove',e=>{
      if(!this.ts)return;const dx=e.clientX-this.ts.x,dy=e.clientY-this.ts.y,md=Math.max(28,innerWidth*.06);
      if(dy<-md&&-dy>Math.abs(dx)){this.jump();this.ts.m=true;this.ts.x=e.clientX;this.ts.y=e.clientY}
      else if(Math.abs(dx)>=md){this.push(Math.sign(dx));this.ts.m=true;this.ts.x=e.clientX;this.ts.y=e.clientY}
    });
    el.addEventListener('pointerup',e=>{if(this.ts&&!this.ts.m&&e.timeStamp-this.ts.t<250)this.jump();this.ts=null});
    el.addEventListener('pointercancel',()=>this.ts=null);
  }
  push(d){sfx.play('lane');this.queue.push({dir:d,t:performance.now()})}
  jump(){sfx.play('jump');this.jumpAt=performance.now()}
}
const input=new Input(cv);

/* ---------- ฟิสิกส์ ---------- */
function stepDuck(d,dt){
  const now=performance.now();
  for(const c of input.queue)if(now-c.t<150)d.lane=clamp(d.lane+c.dir,0,2);
  input.queue.length=0;
  const ax=DUCK.omega*DUCK.omega*(LANE[d.lane]-d.x)-2*DUCK.zeta*DUCK.omega*d.vx;
  d.vx+=ax*dt;d.x+=d.vx*dt;
}
function stepJump(s,dt){
  const j=s.jump;
  if(!j.air&&input.jumpAt&&performance.now()-input.jumpAt<150){
    j.vy=JUMP.v0;j.air=true;input.jumpAt=0;
    spawnSplash(s.duck.x,0,0,6,1.4);
  }
  if(j.air){
    j.vy-=JUMP.g*dt;j.y+=j.vy*dt;
    if(j.y<=0){
      j.y=0;j.vy=0;j.air=false;
      sfx.play('splash');
      spawnSplash(s.duck.x,0,0,16,2.5);
      s.wakes.push({x:s.duck.x,z:0,r:.35,maxR:2.2,life:0,maxLife:.7,type:'land'});
    }
  }
}
function stepTube(t,duck,v,dt){
  const vp=ROPE.vPhysMax*Math.tanh(v/ROPE.vPhysMax); // (1) ความเร็วน้ำแบบอิ่มตัว
  const dx=duck.x-t.x,dz=-t.z,len=Math.sqrt(dx*dx+dz*dz)||1e-6,nx=dx/len,nz=dz/len;
  let fx=0,fz=0;t.T=0;
  if(len>ROPE.L){
    const vRel=(duck.vx-t.vx)*nx+(0-t.vz)*nz;
    const T=clamp(ROPE.k*(len-ROPE.L)+ROPE.cRope*vRel,0,ROPE.Tmax); // (2) จำกัดแรงตึง
    fx+=T*nx;fz+=T*nz;t.T=T;
  }
  fx+=-ROPE.cX*t.vx;fz+=-ROPE.cZ*(t.vz-vp);
  let ax=fx/ROPE.m;
  if(ax*t.vx>0)ax*=Math.max(0,1-(t.vx/ROPE.vxMax)**2); // (3) ยิ่งใกล้เพดาน ยิ่งเร่งไม่ขึ้น
  t.vx+=ax*dt;t.vz+=fz/ROPE.m*dt;t.x+=t.vx*dt;t.z+=t.vz*dt;
  const ex=duck.x-t.x,ez=-t.z,l2=Math.sqrt(ex*ex+ez*ez);
  if(l2>ROPE.Lmax){
    const k=ROPE.Lmax/l2;t.x=duck.x-ex*k;t.z=-ez*k;
    const ux=ex/l2,uz=ez/l2,vOut=-(t.vx*ux+t.vz*uz);
    if(vOut>0){t.vx+=vOut*ux;t.vz+=vOut*uz}
  }
  t.vx=clamp(t.vx,-ROPE.vxMax,ROPE.vxMax); // (4) hard clamp กันหลุด
}
const PLAYER_Y_RATIO = 0.24;
function getPlayerYOff(){
  return Math.round(H * PLAYER_Y_RATIO);
}
function getVisualZ(baseZ){
  const pyOff = getPlayerYOff();
  const d0 = Math.max(0.8, CAM.z - baseZ);
  const s0 = F / d0;
  const yBase = CAM.y * s0;
  const targetY = yBase + pyOff;
  if(targetY <= 0) return baseZ;
  return CAM.z - (CAM.y * F) / targetY;
}
function getPlayerHitbox(s, al = 1){
  const pyOff = getPlayerYOff();
  const d = s.duck, t = s.tube;
  const run = s.state === 'RUN';
  const dx = lerp(d.px, d.x, run ? al : 1);
  const tx = lerp(t.px, t.x, run ? al : 1);
  const tz = lerp(t.pz, t.z, run ? al : 1);

  // 1. พิกัด 2D จริงบน Canvas ของเป็ด (Base Sprite Coordinates)
  const pd = P(dx, 0);
  pd.y += pyOff;

  // 2. คำนวณ Scale และ Z ในโลก 3D ที่สอดคล้องกับพิกัดบนจอ pd.y แบบ 1:1
  const targetY_duck = Math.max(0.1, pd.y - HZ);
  const s_duck_depth = targetY_duck / CAM.y;
  const duckZ = CAM.z - F / s_duck_depth;
  const ratio_duck = pd.s / s_duck_depth;
  const duckEffX = camX + (dx - camX) * ratio_duck;
  const duckEffR = d.r * ratio_duck;

  // 3. พิกัด 2D จริงบน Canvas ของคนบนห่วงยาง (Base Sprite Coordinates)
  const pt = P(tx, tz);
  pt.y += pyOff;

  // 4. คำนวณ Scale และ Z ในโลก 3D ที่สอดคล้องกับพิกัดบนจอ pt.y แบบ 1:1
  const targetY_tube = Math.max(0.1, pt.y - HZ);
  const s_tube_depth = targetY_tube / CAM.y;
  const tubeZ = CAM.z - F / s_tube_depth;
  const ratio_tube = pt.s / s_tube_depth;
  const tubeEffX = camX + (tx - camX) * ratio_tube;
  const tubeEffR = t.r * ratio_tube;

  return {
    duck: { x: duckEffX, z: duckZ, r: duckEffR, pd },
    tube: { x: tubeEffX, z: tubeZ, r: tubeEffR, pt }
  };
}
function circleAABB(cx,cz,r,o){
  const nx=clamp(cx,o.x-o.hw,o.x+o.hw),nz=clamp(cz,o.z-o.hd,o.z+o.hd),dx=cx-nx,dz=cz-nz;
  return dx*dx+dz*dz<r*r;
}
function touchVictim(t,v){const dx=t.x-v.x,dz=t.z-v.z,rr=t.r+RESCUE.radius;return dx*dx+dz*dz<=rr*rr}

/* ---------- สถานะเกม ---------- */
function spawnSplash(x,y,z,count=6,power=1.5,dirX=0){
  if(!S.splashes)S.splashes=[];
  for(let i=0;i<count;i++){
    const ang=Math.random()*Math.PI*2,spd=(.5+Math.random()*.8)*power;
    const vx=dirX?(dirX*.65+(Math.random()-.5)*1.8):(Math.cos(ang)*spd);
    const vz=(Math.random()-.5)*spd*.8;
    const vy=2.2+Math.random()*3.2*power*.6;
    S.splashes.push({x:x+(Math.random()-.5)*.3,y:y+.04,z:z+(Math.random()-.5)*.3,vx,vy,vz,r:.04+Math.random()*.04,life:0,maxLife:.4+Math.random()*.25});
  }
}
/* ---------- ระบบเฟสพิเศษ (Special Event Phase / Wave System) ---------- */
const PHASES = {
  NORMAL: 'NORMAL',
  TRANSITION_BUFFER: 'TRANSITION_BUFFER',
  HORSE_STAMPEDE: 'HORSE_STAMPEDE',
  SPEEDBOAT_RUSH: 'SPEEDBOAT_RUSH',
  RESCUE_MISSION: 'RESCUE_MISSION',
  LOG_HURDLES: 'LOG_HURDLES'
};

const SPECIAL_PHASE_LIST = [
  PHASES.LOG_HURDLES,
  PHASES.HORSE_STAMPEDE,
  PHASES.SPEEDBOAT_RUSH,
  PHASES.RESCUE_MISSION
];

const PHASE_INFO = {
  [PHASES.NORMAL]: {
    name: 'ปกติ',
    banner: null
  },
  [PHASES.TRANSITION_BUFFER]: {
    name: 'เตรียมพร้อม...',
    banner: null
  },
  [PHASES.HORSE_STAMPEDE]: {
    name: 'ม้าศึกวิ่งเตลิด',
    banner: '🐴 ระวัง! ม้าศึกวิ่งเตลิดข้ามคลอง!',
    col: '#ff9234',
    duration: 25,
    durDist: 320
  },
  [PHASES.SPEEDBOAT_RUSH]: {
    name: 'เรือด่วนคลั่ง',
    banner: '🚤 อันตราย! ฝูงเรือด่วนพุ่งสวนเลน!',
    col: '#ff3366',
    duration: 25,
    durDist: 320
  },
  [PHASES.RESCUE_MISSION]: {
    name: 'กู้ภัยฉุกเฉิน',
    banner: '🏊‍♂️ ภารกิจเร่งด่วน! ช่วยคนตกน้ำ!',
    col: '#39ff14',
    duration: 25,
    durDist: 320
  },
  [PHASES.LOG_HURDLES]: {
    name: 'วิบากท่อนไม้',
    banner: '🪵 กระโดดด่วน! ท่อนไม้ขวางลำน้ำ!',
    col: '#ffe11a',
    duration: 25,
    durDist: 320
  }
};

function selectNextPhase(lastPhase){
  // สุ่มเลือก 1 ใน 4 เฟสพิเศษโดยให้ทุกเฟสมีโอกาสเกิดเท่ากัน 100%
  // พร้อมตัดเฟสล่าสุดออกเพื่อป้องกันการสุ่มเจอเฟสเดิมซ้ำ 2 รอบติด
  const candidates = SPECIAL_PHASE_LIST.filter(p => p !== lastPhase);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// 1. ระบบตรวจจับเลนที่มีสิ่งกีดขวางทับซ้อน (Safe Lane Checker - Always One Safe Lane Guarantee)
// ตรวจสอบทั้งมิติระยะทางแกน Z (Spatial) และมิติเวลาที่วัตถุจะวิ่งมาถึงตัวผู้เล่น (Temporal Arrival Time)
function getOccupiedLanesAt(targetZ, targetRz = 0, safetyDist = 8.5, safetyTime = 0.70, s = S){
  const occupied = [false, false, false];
  const targetSpeed = Math.max(1, s.v + (targetRz || 0));
  const targetTime = (0 - targetZ) / targetSpeed;

  for(let i = 0; i < s.obs.length; i++){
    const o = s.obs[i];
    if(o.z > 10) continue; // ข้ามสิ่งกีดขวางที่วิ่งเลยหลังผู้เล่นไปแล้ว

    const oSpeed = Math.max(1, s.v + (o.rz || 0));
    const oTime = (0 - o.z) / oSpeed;
    const distDiff = Math.abs(o.z - targetZ);
    const timeDiff = Math.abs(oTime - targetTime);

    // หากระยะทางห่างกันน้อยกว่า safetyDist หรือเวลาที่จะมาถึงผู้เล่นห่างกันน้อยกว่า safetyTime
    if(distDiff < safetyDist || timeDiff < safetyTime){
      if((o.hw || 0) >= 2.5){
        // ขอนไม้ยาว 3 เลน (Wide log)
        occupied[0] = true;
        occupied[1] = true;
        occupied[2] = true;
      } else {
        for(let l = 0; l < 3; l++){
          if(Math.abs(o.x - OBSTACLE_X[l]) < ((o.hw || 0.48) + 0.45)){
            occupied[l] = true;
          }
        }
      }
    }
  }

  // รวมเลนที่รถตุ๊กๆ กำลังเตือนภัยเตรียมพุ่งมาด้วย
  if(s.tuktukWarn && s.tuktukWarn.lane !== undefined){
    occupied[s.tuktukWarn.lane] = true;
  }

  return occupied;
}

// 2. ระบบจัดการสถานะเฟส (Phase State Manager พร้อม TRANSITION_BUFFER หยุดสปอว์นเคลียร์ถนน)
function updatePhase(s){
  if(s.phase === PHASES.NORMAL){
    // ครบกำหนดคูลดาวน์ 60 วินาที ให้เข้าสู่สถานะ TRANSITION_BUFFER ก่อน 1.4 วินาที
    if(s.t >= (s.specialCooldownUntil || 0)){
      const chosen = selectNextPhase(s.lastSpecialPhase);
      s.phase = PHASES.TRANSITION_BUFFER;
      s.pendingSpecialPhase = chosen;
      s.transitionUntil = s.t + 1.4; // พักหยุดสปอว์น 1.4 วินาทีเพื่อเคลียร์สิ่งกีดขวางเดิมให้หมดถนน
      
      // ส่งสัญญาณแจ้งเตือนล่วงหน้าให้ผู้เล่นเตรียมตัวระหว่างที่ถนนกำลังเคลียร์โล่ง
      fx('⚠️ เตรียมพร้อม! ' + PHASE_INFO[chosen].banner, PHASE_INFO[chosen].col);
      if(chosen === PHASES.HORSE_STAMPEDE) sfx.play('horse_run');
      else if(chosen === PHASES.SPEEDBOAT_RUSH) sfx.play('speedboat_warn');
      else if(chosen === PHASES.RESCUE_MISSION) sfx.play('rescue');
      else if(chosen === PHASES.LOG_HURDLES) sfx.play('jump');

      // ล็อกระยะ gap ไม่ให้มีวัตถุใดๆ เกิดขึ้นมาทับซ้อน
      s.gap = Math.max(s.gap, s.v * 1.5 + 16);
    }
  } else if(s.phase === PHASES.TRANSITION_BUFFER){
    // อยู่ในสถานะหยุดสปอว์นชั่วคราว รอจนครบเวลา 1.4 วินาทีให้ถนนเคลียร์โล่ง 100%
    if(s.t >= (s.transitionUntil || 0)){
      const chosen = s.pendingSpecialPhase;
      s.phase = chosen;
      s.lastSpecialPhase = chosen;
      s.phaseEndTime = s.t + (PHASE_INFO[chosen].duration || 25);
      s.phaseEndDist = s.dist + (PHASE_INFO[chosen].durDist || 320);
      s.pendingSpecialPhase = null;
      s.gap = Math.min(s.gap, 5);
    }
  } else {
    // อยู่ในเฟสพิเศษ เมื่อครบกำหนดระยะเวลา 25 วินาที ให้กลับสู่สภาวะปกติ
    if(s.t >= (s.phaseEndTime || Infinity)){
      s.phase = PHASES.NORMAL;
      s.specialCooldownUntil = s.t + 60.0; // พัก 60 วินาทีเต็มใน NORMAL_PHASE
      fx('เข้าสู่สภาวะปกติ (พัก 60 วิ)', '#3bd4ff');
      s.gap = Math.max(s.gap, 16);
    }
  }
}

function newGame(){
  S={state:'MENU',tuns:[],tunEnd:0,tun:0,zt:0,dist:0,v:10,score:0,combo:0,rescued:0,pass:0,gap:10,grace:0,slow:0,shake:0,t:0,fx:[],obs:[],vic:[],wakes:[],splashes:[],lastDuckWake:0,lastTubeWake:0,
    duck:{x:0,px:0,vx:0,lane:1,r:.46},tube:{x:0,px:0,z:2.6,pz:2.6,vx:0,vz:0,r:.75,T:0},jump:{y:0,py:0,vy:0,air:false},
    phase:PHASES.NORMAL,phaseEndTime:0,phaseEndDist:0,specialCooldownUntil:60,lastSpecialPhase:null,
    pendingSpecialPhase:null,transitionUntil:0,
    tuktukWarn:null,nextTuktukDist:200,
    taxiWarn:null,taxiCooldown:120,nextTaxiDist:0,isRidingTaxi:false,taxiTimer:0,taxiLane:1,invincibleTimer:0};
  input.queue.length=0;input.jumpAt=0;
}
function spawn(){
  const s = S, z = -75;

  // 0. ช่วงเปลี่ยนผ่านเฟส (Transition Buffer) - หยุดการสปอว์นทุกชนิด 100% เพื่อเคลียร์ถนนให้โล่งสะอาด
  if(s.phase === PHASES.TRANSITION_BUFFER){
    return Math.max(14, s.v * 1.3);
  }

  // 1. เฟสม้าศึกวิ่งเตลิด (Horse Stampede) - สปอว์นถี่ขึ้นอย่างดุเดือด พร้อมคงระยะปลอดภัยให้หลบทัน
  if(s.phase === PHASES.HORSE_STAMPEDE){
    const dir = Math.random() < 0.5 ? -1 : 1;
    // สุ่มความเร็วควบม้าทั้งแนวขวาง (vx: 2.8 ถึง 5.2 ม./วิ) และแนวลึกตามสายน้ำ (vz: -2.2 ถึง 2.2 ม./วิ) เพื่อทำลายการแช่เลนกลาง
    const horseVx = 2.8 + Math.random() * 2.4;
    const horseVz = (Math.random() - 0.5) * 4.4;
    s.obs.push({npc: 1, type: 'horse', x: -dir * 4, z, hw: 0.48, hd: 0.28, h: 1.8, dir, st: 'wait', vx: horseVx, vz: horseVz, rz: horseVz});
    sfx.play('horse_run');
    // Hard Minimum Cap: รับประกันเวลาการสังเกตและสลับเลน/กระโดดขั้นต่ำ >= 0.48s
    const minGap = Math.max(5.0, s.v * 0.38 + 0.8);
    return minGap + Math.random() * 0.9;
  }

  // 2. เฟสเรือด่วนคลั่ง (Speedboat Rush) - ความถี่และความหนาแน่นสูงขึ้น พร้อม Safe Lane Checker รับประกันเลนปลอดภัย 100%
  if(s.phase === PHASES.SPEEDBOAT_RUSH){
    const occupied = getOccupiedLanesAt(-95, SPEEDBOAT_RZ);
    const freeLanes = [0, 1, 2].filter(l => !occupied[l]);

    // รับประกันว่าต้องเหลือเลนปลอดภัยอย่างน้อย 1 เลนเสมอ
    if(freeLanes.length <= 1){
      return Math.max(8.0, (s.v + SPEEDBOAT_RZ) * 0.24);
    }

    // ล็อกเลนปลอดภัย 1 เลนที่ไม่มีสิ่งกีดขวางเด็ดขาด (Safe Lane Guarantee)
    const safeLaneIndex = Math.floor(Math.random() * freeLanes.length);
    const safeLane = freeLanes[safeLaneIndex];
    const availableRushLanes = freeLanes.filter(l => l !== safeLane);
    
    // เพิ่มโอกาสสปอว์น 2 ลำพร้อมกันให้เข้มข้นขึ้น (65%) เมื่อมีเลนว่างเพียงพอ
    const count = (availableRushLanes.length >= 2 && Math.random() < 0.65) ? 2 : 1;
    for(let i = 0; i < count && i < availableRushLanes.length; i++){
      s.obs.push({npc: 1, type: 'speedboat', x: OBSTACLE_X[availableRushLanes[i]], z: -95, hw: 0.48, hd: 0.38, h: 2.0, rz: SPEEDBOAT_RZ});
    }
    sfx.play('speedboat_warn');
    // Hard Minimum Cap: เว้นระยะสัมพัทธ์ให้ผู้เล่นสังเกตและโยกหลบเข้า Safe Lane ทันเสมอ
    const minGap = Math.max(11.0, (s.v + SPEEDBOAT_RZ) * 0.34 + 1.2);
    return minGap + Math.random() * 1.5;
  }

  // 3. เฟสกู้ภัยฉุกเฉิน (Rescue Mission) - ถี่ขึ้นแบบคอมโบกระหน่ำเร้าใจ
  if(s.phase === PHASES.RESCUE_MISSION){
    const occupied = getOccupiedLanesAt(z, 0);
    const freeLanes = [0, 1, 2].filter(l => !occupied[l]);
    const l = freeLanes.length > 0 ? freeLanes[Math.floor(Math.random() * freeLanes.length)] : Math.floor(Math.random() * 3);
    s.vic.push({x: OBSTACLE_X[l], z, ph: Math.random() * 6, gender: Math.random() < 0.5 ? 'girl' : 'boy', txt: VIC_MSGS[Math.random() < 0.5 ? 0 : 1]});
    const minGap = Math.max(4.2, s.v * 0.32 + 0.8);
    return minGap + Math.random() * 1.0;
  }

  // 4. เฟสวิบากท่อนไม้ (Log Hurdles) - Rhythm Jump ต่อเนื่องเร้าใจ พร้อม Safe Lane Checker
  if(s.phase === PHASES.LOG_HURDLES){
    const occupied = getOccupiedLanesAt(z, 0, 7.5, 0.73);
    // หากมีสิ่งกีดขวางอื่นอยู่ในระนาบเดียวกัน ห้ามสปอว์นขอนไม้ยาว 3 เลนทับซ้อนเด็ดขาด
    if(occupied.some(Boolean)){
      return Math.max(7.2, s.v * 0.74);
    }
    s.obs.push({x: 0, z, hw: 3.1, hd: 0.05, h: 0.18, type: 'wide'});
    // คำนวณช่องว่างผูกติดกับระยะเวลาลอยตัวของการกระโดดอย่างเคร่งครัด (T = 2*v0/g = 0.7308s)
    // การันตีว่าผู้เล่นมีเวลาลอยตัวพ้น + จังหวะแตะผิวน้ำและกดกระโดดลูกโซ่ต่อเนื่อง (Chain Jump) ได้ 100%
    const minGap = Math.max(7.5, s.v * 0.74 + 0.3);
    return minGap + Math.random() * 0.5;
  }

  // 5. เฟสปกติ (Normal Phase) - การสุ่มพร้อม Safe Lane Checker รับประกันเลนปลอดภัย 100%
  const r = Math.random(), d = s.dist;
  const occupied = getOccupiedLanesAt(z, 0);
  const freeLanes = [0, 1, 2].filter(l => !occupied[l]);

  // หากเลนว่างเหลือเพียง 1 เลน ห้ามสปอว์นสิ่งกีดขวางลงในเลนสุดท้ายเด็ดขาด (ป้องกัน 3 เลนตัน 100%)
  if(freeLanes.length <= 1){
    if(freeLanes.length === 1 && Math.random() < 0.45){
      // สปอว์นคนตกน้ำให้ช่วยได้ปลอดภัย ไม่เป็นอันตรายถึงชีวิต
      s.vic.push({x: OBSTACLE_X[freeLanes[0]], z, ph: Math.random() * 6, gender: Math.random() < 0.5 ? 'girl' : 'boy', txt: VIC_MSGS[Math.random() < 0.5 ? 0 : 1]});
    }
    return Math.max(5.8, s.v * 0.42 + 0.6);
  }

  // มีเลนว่างอย่างน้อย 2 เลน สามารถสปอว์นสิ่งกีดขวางลงใน 1 เลนได้ โดยรับประกันเหลือเลนปลอดภัยอย่างน้อย 1 เลนเสมอ
  const chosenLane = freeLanes[Math.floor(Math.random() * freeLanes.length)];

  if(r < 0.24){
    s.vic.push({x: OBSTACLE_X[chosenLane], z, ph: Math.random() * 6, gender: Math.random() < 0.5 ? 'girl' : 'boy', txt: VIC_MSGS[Math.random() < 0.5 ? 0 : 1]});
  } else if(r < 0.36 && freeLanes.length === 3){
    // ขอนไม้ยาว 3 เลน สปอว์นได้เฉพาะตอนที่ทั้ง 3 เลนว่างโล่ง 100% เท่านั้น
    s.obs.push({x: 0, z, hw: 3.1, hd: 0.05, h: 0.18, type: 'wide'});
    return Math.max(8.5, s.v * 0.75 + 0.8) + Math.random() * 1.5;
  } else if(r < 0.48 && d > 150){
    const dir = Math.random() < 0.5 ? -1 : 1;
    const horseVx = 2.8 + Math.random() * 2.4;
    const horseVz = (Math.random() - 0.5) * 4.4;
    s.obs.push({npc: 1, type: 'horse', x: -dir * 4, z, hw: 0.48, hd: 0.28, h: 1.8, dir, st: 'wait', vx: horseVx, vz: horseVz, rz: horseVz});
    sfx.play('horse_run');
  } else if(r < 0.58 && d > 300){
    const boatOccupied = getOccupiedLanesAt(-95, SPEEDBOAT_RZ);
    const boatFreeLanes = [0, 1, 2].filter(l => !boatOccupied[l]);
    if(boatFreeLanes.length >= 2){
      const boatLane = boatFreeLanes[Math.floor(Math.random() * boatFreeLanes.length)];
      s.obs.push({npc: 1, type: 'speedboat', x: OBSTACLE_X[boatLane], z: -95, hw: 0.48, hd: 0.38, h: 2.0, rz: SPEEDBOAT_RZ});
      sfx.play('speedboat_warn');
      return Math.max(11.0, (s.v + SPEEDBOAT_RZ) * 0.42 + 1.2) + Math.random() * 1.8;
    }
  } else if(r < 0.72){
    s.obs.push({npc: 1, type: 'rowboat', x: OBSTACLE_X[chosenLane], z, hw: 0.48, hd: 0.24, h: 0.85, rz: -2, vx: (Math.random() < 0.5 ? -1 : 1) * 0.5});
  } else {
    s.obs.push({x: OBSTACLE_X[chosenLane], z, hw: 0.60, hd: 0.05, h: 0.18, type: 'log'});
  }
  return Math.max(5.8, s.v * 0.42 + 0.8) + Math.random() * 1.6;
}
function npcStep(o,s,dt){
  if(o.type==='rowboat'){o.x+=o.vx*dt;if(Math.abs(o.x)>2.4){o.x=clamp(o.x,-2.4,2.4);o.vx=-o.vx}}
  else if(o.type==='horse'){
    if(o.st==='wait'&&o.z>=-s.v*1.8){
      o.st='go';
      sfx.play('horse_run');
    }
    if(o.st==='go'){
      o.x+=o.dir*(o.vx||3.4)*dt;
      // ละอองน้ำกระจายรอบขาม้าขณะวิ่งย่ำน้ำ (Dynamic Water Splashes at horse feet synced to gallop)
      const hoofPulse=Math.abs(Math.sin(S.t*16));
      if(hoofPulse>0.72){
        spawnSplash(o.x,0,o.z,3,1.3,-o.dir*1.5);
        s.wakes.push({x:o.x,z:o.z,r:.28,maxR:1.6,life:0,maxLife:.58,type:'droplet'});
      }
      if(o.dir*o.x>=4){o.x=o.dir*4;o.st='done'}
    }
  }else if(o.type==='speedboat'){
    const t=s.tube,dx=t.x-o.x;
    if(Math.abs(o.z-t.z)<2&&Math.abs(dx)<2.4&&Math.abs(dx)>.1)t.vx+=Math.sign(dx)*6*dt;
    // คลื่นแหวกน้ำและละอองน้ำท้ายเรือสปีดโบ๊ตฟุ้งกระจาย (Prominent trailing wake & spray particles)
    spawnSplash(o.x+(Math.random()-.5)*.5,0,o.z-1.3,3,1.6,(Math.random()-.5)*3.2);
    s.wakes.push({x:o.x-0.35,z:o.z-1.1,r:.45,maxR:2.6,life:0,maxLife:.75,type:'tube',vx:-1.4});
    s.wakes.push({x:o.x+0.35,z:o.z-1.1,r:.45,maxR:2.6,life:0,maxLife:.75,type:'tube',vx:1.4});
  }else if(o.type==='tuktuk'){
    // 1. ตรวจจับสิ่งกีดขวางข้างหน้า: แยกประเภทระหว่าง ท่อนไม้ (Auto-Jump) กับ สิ่งกีดขวางอื่น/คน (Ramming Knockback)
    for(let j = 0; j < s.obs.length; j++){
      const other = s.obs[j];
      if(other === o || other.type === 'tuktuk' || other.isKnockedOut) continue;
      const halfW = (other.hw || 0.48) + o.hw;
      if(Math.abs(other.x - o.x) < halfW){
        const distAhead = o.z - other.z;
        const isLog = (other.type === 'log' || other.type === 'wide');
        if(isLog){
          // Auto-Jump สำหรับท่อนไม้ (รวมขอนไม้ยาว 3 เลน): คำนวณ Z-depth และขนาด bounding box
          if(!o.jumping && (o.jumpY || 0) <= 0){
            const triggerDist = 7.5 + (other.hd || 0.1) * 4 + (other.type === 'wide' ? 2.5 : 0);
            if(distAhead > 0.6 && distAhead < triggerDist){
              o.jumping = true;
              o.vy = (other.type === 'wide') ? 13.5 : 11.0; // กระโดดเร็วขึ้น สูงขึ้น และลอยตัวนานขึ้นเพื่อข้ามขอนไม้ยาวได้พ้นสนิท
              sfx.play('jump');
            }
          }
        } else {
          // Ramming Effect: สำหรับสิ่งกีดขวางอื่นที่ไม่ใช่ท่อนไม้ (Rowboat, Speedboat, Horse) ไม่กระโดด แต่พุ่งชนกระเด็น
          const ramDist = o.hd + (other.hd || 0.3) + 0.6;
          if(Math.abs(distAhead) < ramDist){
            other.isKnockedOut = true;
            other.vy = 16.0;
            other.vx = (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 8);
            other.vz = (Math.random() - 0.5) * 12;
            sfx.play('hit');
            fx('ชนกระเด็น! 💥', '#ff3366');
            spawnSplash(other.x, 0, other.z, 10, 2.2);
          }
        }
      }
    }

    // Ramming Effect สำหรับคนตกน้ำ (Drowning NPC): พุ่งชนกระเด็น ไม่กระโดด
    for(let j = 0; j < s.vic.length; j++){
      const v = s.vic[j];
      if(v.isKnockedOut) continue;
      if(Math.abs(v.x - o.x) < (o.hw + 0.5)){
        const distV = o.z - v.z;
        if(Math.abs(distV) < (o.hd + 0.65)){
          v.isKnockedOut = true;
          v.vy = 16.0;
          v.vx = (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 8);
          v.vz = (Math.random() - 0.5) * 12;
          sfx.play('hit');
          fx('ปลิวเลย! 💥', '#ff3366');
          spawnSplash(v.x, 0, v.z, 8, 2.0);
        }
      }
    }

    // 2. ฟิสิกส์การลอยตัวตามวิถีโค้งแกน Y (Y-Axis Jump Arc Physics)
    if(o.jumping){
      o.vy -= 26 * dt;
      o.jumpY = (o.jumpY || 0) + o.vy * dt;
      if(o.jumpY <= 0){
        o.jumpY = 0;
        o.vy = 0;
        o.jumping = false;
        // ละอองน้ำแตกกระจายและคลื่นกระแทกผิวน้ำเมื่อล้อทั้งสองแตะพื้นน้ำตอนแลนดิ้ง (Landing Splashes)
        spawnSplash(o.x - 0.45, 0, o.z, 6, 1.8);
        spawnSplash(o.x + 0.45, 0, o.z, 6, 1.8);
        s.wakes.push({x: o.x, z: o.z, r: 0.4, maxR: 2.2, life: 0, maxLife: 0.65, type: 'land'});
        sfx.play('splash');
      }
    }

    // 3. อนุภาคละอองน้ำล้อวิ่งลุยน้ำต่อเนื่อง (Continuous Wheel Sprays)
    // จะหยุดสร้างละอองน้ำโดยสิ้นเชิงเมื่อรถลอยตัวอยู่กลางอากาศ (o.jumpY > 0.05) ตามกฎเหล็ก
    if((o.jumpY || 0) <= 0.05){
      if(Math.random() < 0.65){
        spawnSplash(o.x - 0.42, 0, o.z + 0.5, 2, 1.4, -0.9);
        spawnSplash(o.x + 0.42, 0, o.z + 0.5, 2, 1.4, 0.9);
        s.wakes.push({x: o.x - 0.4, z: o.z + 0.4, r: 0.28, maxR: 1.6, life: 0, maxLife: 0.55, type: 'tube', vx: -1.2});
        s.wakes.push({x: o.x + 0.4, z: o.z + 0.4, r: 0.28, maxR: 1.6, life: 0, maxLife: 0.55, type: 'tube', vx: 1.2});
      }
    }

    // 4. ตรวจจับจังหวะแซงผู้เล่น: กดแตร "แป๊นๆ" และแสดงเอฟเฟกต์ทันทีที่แซงผ่านเป็ด
    const duckZ = getVisualZ(0);
    if(!o.honked && o.z <= duckZ + 0.9 && o.z >= duckZ - 3.0){
      o.honked = true;
      sfx.play('tuktuk_horn');
      fx('ซิ่งจี๊ดดด! 🛺💨', '#ffd125');
    }
  }else if(o.type==='taxi'){
    // รถแท็กซี่เขียว-เหลือง NPC (ขับตามธรรมชาติเมื่อผู้เล่นไม่ได้ขึ้น)
    // 1. ตรวจจับสิ่งกีดขวางข้างหน้า: ท่อนไม้ (Auto-Jump) กับ สิ่งกีดขวางอื่น (Ramming Knockback)
    for(let j = 0; j < s.obs.length; j++){
      const other = s.obs[j];
      if(other === o || other.type === 'tuktuk' || other.type === 'taxi' || other.isKnockedOut) continue;
      const halfW = (other.hw || 0.48) + o.hw;
      if(Math.abs(other.x - o.x) < halfW){
        const distAhead = o.z - other.z;
        const isLog = (other.type === 'log' || other.type === 'wide');
        if(isLog){
          if(!o.jumping && (o.jumpY || 0) <= 0){
            const triggerDist = 7.5 + (other.hd || 0.1) * 4 + (other.type === 'wide' ? 2.5 : 0);
            if(distAhead > 0.6 && distAhead < triggerDist){
              o.jumping = true;
              o.vy = (other.type === 'wide') ? 13.5 : 11.0;
              sfx.play('jump');
            }
          }
        } else {
          const ramDist = o.hd + (other.hd || 0.3) + 0.6;
          if(Math.abs(distAhead) < ramDist){
            other.isKnockedOut = true;
            other.vy = 16.0;
            other.vx = (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 8);
            other.vz = (Math.random() - 0.5) * 12;
            sfx.play('hit');
            fx('ชนกระเด็น! 💥', '#ff3366');
            spawnSplash(other.x, 0, other.z, 10, 2.2);
          }
        }
      }
    }
    // ชนคนตกน้ำ (Drowning NPC)
    for(let j = 0; j < s.vic.length; j++){
      const v = s.vic[j];
      if(v.isKnockedOut) continue;
      if(Math.abs(v.x - o.x) < (o.hw + 0.5)){
        const distV = o.z - v.z;
        if(Math.abs(distV) < (o.hd + 0.65)){
          v.isKnockedOut = true;
          v.vy = 16.0;
          v.vx = (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 8);
          v.vz = (Math.random() - 0.5) * 12;
          sfx.play('hit');
          fx('ปลิวเลย! 💥', '#ff3366');
          spawnSplash(v.x, 0, v.z, 8, 2.0);
        }
      }
    }
    // ฟิสิกส์การกระโดด
    if(o.jumping){
      o.vy -= 26 * dt;
      o.jumpY = (o.jumpY || 0) + o.vy * dt;
      if(o.jumpY <= 0){
        o.jumpY = 0;
        o.vy = 0;
        o.jumping = false;
        spawnSplash(o.x - 0.45, 0, o.z, 6, 1.8);
        spawnSplash(o.x + 0.45, 0, o.z, 6, 1.8);
        s.wakes.push({x: o.x, z: o.z, r: 0.4, maxR: 2.2, life: 0, maxLife: 0.65, type: 'land'});
        sfx.play('splash');
      }
    }
    // อนุภาคละอองน้ำล้อวิ่งลุยน้ำ
    if((o.jumpY || 0) <= 0.05){
      if(Math.random() < 0.65){
        spawnSplash(o.x - 0.42, 0, o.z + 0.5, 2, 1.4, -0.9);
        spawnSplash(o.x + 0.42, 0, o.z + 0.5, 2, 1.4, 0.9);
        s.wakes.push({x: o.x - 0.4, z: o.z + 0.4, r: 0.28, maxR: 1.6, life: 0, maxLife: 0.55, type: 'tube', vx: -1.2});
        s.wakes.push({x: o.x + 0.4, z: o.z + 0.4, r: 0.28, maxR: 1.6, life: 0, maxLife: 0.55, type: 'tube', vx: 1.2});
      }
    }
    // กดแตรเมื่อแซงผู้เล่น
    const duckZ = getVisualZ(0);
    if(!o.honked && o.z <= duckZ + 0.9 && o.z >= duckZ - 3.0){
      o.honked = true;
      sfx.play('taxi_horn');
      fx('แท็กซี่แซงฉิว! 🚕💨', '#39ff14');
    }
  }
}
function fx(txt,col){const p=P(S.tube.x,S.tube.z);S.fx.push({txt,x:p.x,y:p.y-p.s*1.2,t:0,col})}
function step(dt){
  const s=S,wd=dt*(s.slow>0?.35:1);
  if(s.slow>0)s.slow-=dt;if(s.grace>0)s.grace-=dt;if(s.shake>0)s.shake-=dt;
  if(s.invincibleTimer>0)s.invincibleTimer-=wd;
  if(s.taxiCooldown>0)s.taxiCooldown-=dt;
  s.v=Math.min(22,10+s.dist*.012) + (s.isRidingTaxi ? 10 : 0);
  stepDuck(s.duck,wd);stepJump(s,wd);
  s.tube.r=(.75+.03*s.pass)*(1-.08*clamp((s.v-10)/12,0,1));
  stepTube(s.tube,s.duck,s.v,wd);
  const dz=s.v*wd;s.dist+=dz;s.score+=dz*.5;

  // การนับเวลาถอยหลังการนั่งรถแท็กซี่และการลงจากรถ (Disembarking Illusion + 2s Invincibility)
  if(s.isRidingTaxi){
    s.taxiTimer -= wd;
    if(s.taxiTimer <= 0){
      s.isRidingTaxi = false;
      s.taxiTimer = 0;
      s.invincibleTimer = 3.0; // 👈 มอบสถานะอมตะ (I-frames) 3 วินาทีเต็มทันทีที่ลงจากรถ
      fx('ส่งถึงที่แล้ว! ขอบคุณครับ 🚕💨 (อมตะ 3 วิ)', '#ffe11a');
      // The Illusion of Leaving: เสกรถ Taxi NPC คันใหม่พุ่งพรวดไปข้างหน้าจากตำแหน่งปัจจุบันของผู้เล่นทันที
      s.obs.push({
        npc: 1,
        type: 'taxi',
        x: s.duck.x,
        z: 0,
        hw: 0.65,
        hd: 0.55,
        h: 2.0,
        rz: -(s.v + 18), // พุ่งแซงไปข้างหน้าอย่างรวดเร็วสู่ขอบฟ้า
        jumpY: 0,
        vy: 0,
        jumping: false,
        honked: true
      });
      sfx.play('taxi_horn');
      spawnSplash(s.duck.x, 0, 0, 14, 2.2);
    }
  }
  if(!s.jump.air&&(s.t-(s.lastDuckWake||0)>.04)){
    s.lastDuckWake=s.t;
    s.wakes.push({x:s.duck.x,z:0,r:.25,maxR:1.6,life:0,maxLife:.62,type:'duck',vx:s.duck.vx});
    if(Math.abs(s.duck.vx)>1.8){
      spawnSplash(s.duck.x-Math.sign(s.duck.vx)*.2,0,0,3,1.2,-Math.sign(s.duck.vx)*3.5);
    }
  }
  if(s.t-(s.lastTubeWake||0)>.045){
    s.lastTubeWake=s.t;
    const tr=s.tube.r*.9;
    s.wakes.push({x:s.tube.x,z:s.tube.z,r:tr*.6,maxR:tr*2.4,life:0,maxLife:.75,type:'tube',vx:s.tube.vx});
    if(Math.abs(s.tube.vx)>1.3||s.tube.T>25){
      const spd=Math.sign(s.tube.vx)||1;
      spawnSplash(s.tube.x+spd*tr*.7,0,s.tube.z,4,1.5,spd*4);
    }
  }
  let wCount=0;
  for(let i=0;i<s.wakes.length;i++){
    const w=s.wakes[i];w.z+=dz;w.life+=wd;w.r+=wd*(2.2+s.v*.08);
    if(w.life<w.maxLife&&w.z<=14)s.wakes[wCount++]=w;
  }
  s.wakes.length=wCount;

  let spCount=0;
  for(let i=0;i<s.splashes.length;i++){
    const sp=s.splashes[i];sp.z+=dz;sp.x+=sp.vx*wd;sp.y+=sp.vy*wd;sp.vy-=22*wd;sp.life+=wd;
    if(sp.y<=0&&sp.life>.04){
      if(sp.z>-10&&sp.z<12)s.wakes.push({x:sp.x,z:sp.z,r:.08,maxR:.45,life:0,maxLife:.3,type:'droplet'});
    }else if(sp.life<=sp.maxLife&&sp.z<=14){
      s.splashes[spCount++]=sp;
    }
  }
  s.splashes.length=spCount;
  ensureTuns(s);s.tun+=((inTun(s,s.dist)?1:0)-s.tun)*Math.min(1,dt*1.5);
  updatePhase(s);
  s.gap-=dz;if(s.gap<=0){s.gap=Math.max(s.gap,0)+spawn()}

  // ระบบเตือนภัยและสปอว์นรถตุ๊กๆ ซิ่งแซงจากข้างหลัง (Tuk-Tuk Warning & Overtake Spawner)
  // กฎเหล็ก: เกิดได้เฉพาะใน NORMAL Phase เท่านั้น ห้ามเกิดใน Special Phase ใดๆ เด็ดขาด
  if(s.tuktukWarn){
    if(s.phase !== PHASES.NORMAL){
      s.tuktukWarn = null; // ยกเลิกการเตือนทันทีหากเข้าสู่ Special Phase
    } else {
      s.tuktukWarn.timer -= dt;
      if(s.tuktukWarn.timer <= 0){
        // สปอว์นรถตุ๊กๆ ที่ขอบล่างของหน้าจอหลังกล้อง (z = 7.2) พุ่งไปข้างหน้าสู่ขอบฟ้า
        s.obs.push({
          npc: 1,
          type: 'tuktuk',
          x: s.tuktukWarn.x,
          z: 7.2,
          hw: 0.62,
          hd: 0.50,
          h: 2.2,
          rz: -(s.v + 15), // วิ่งเร็วกว่าความเร็วโลก 15 ม./วิ เพื่อแซงผู้เล่นไปข้างหน้า
          jumpY: 0,
          vy: 0,
          jumping: false,
          honked: false
        });
        sfx.play('tuktuk_warn'); // เล่นเสียงเตือนเฉพาะเมื่อรถตุ๊กๆ ได้รับการสปอว์นลงสู่อาร์เรย์จริงแล้ว 100%
        s.tuktukWarn = null;
      }
    }
  } else if(s.phase === PHASES.NORMAL && s.dist >= (s.nextTuktukDist || 200)){
    const hasTuktuk = s.obs.some(o => o.type === 'tuktuk');
    if(!hasTuktuk){
      // ตรวจสอบว่าในระนาบของผู้เล่น มีเลนปลอดภัยเหลืออย่างน้อย 2 เลนหรือไม่ (Always One Safe Lane Guarantee)
      const playerOccupied = getOccupiedLanesAt(0, 0, 10.0, 0.85);
      const safeLanes = [0, 1, 2].filter(l => !playerOccupied[l]);
      if(safeLanes.length >= 2){
        if(Math.random() < 0.5){
          const targetLane = safeLanes[Math.floor(Math.random() * safeLanes.length)];
          s.tuktukWarn = {
            lane: targetLane,
            x: OBSTACLE_X[targetLane],
            timer: 1.3,
            maxTimer: 1.3
          };
          fx('⚠️ ระวังหลัง! ตุ๊กๆ ซิ่งจี๊ด!', '#ff3366');
          // เพิ่มคูลดาวน์และระยะห่างอย่างมาก: 240 ถึง 400 เมตร (นานๆ โผล่มาที)
          s.nextTuktukDist = s.dist + 240 + Math.random() * 160;
        } else {
          // หากไม่เกิด เลื่อนระยะเช็คถัดไปออกไป 120-180 เมตร
          s.nextTuktukDist = s.dist + 120 + Math.random() * 60;
        }
      } else {
        s.nextTuktukDist = s.dist + 60;
      }
    }
  }

  // ระบบสปอว์นรถแท็กซี่เขียว-เหลือง (Taxi Spawner - ยานพาหนะช่วยชีวิตมิตรผู้เล่น)
  // กฎเหล็ก: เกิดเฉพาะใน NORMAL_PHASE ข้าม Safe Lane Checker 100% (CRITICAL: Bypasses Safe Lane Checker)
  if(s.taxiWarn){
    if(s.phase !== PHASES.NORMAL){
      s.taxiWarn = null;
    } else {
      s.taxiWarn.timer -= dt;
      if(s.taxiWarn.timer <= 0){
        s.obs.push({
          npc: 1,
          type: 'taxi',
          x: s.taxiWarn.x,
          z: 7.2,
          hw: 0.65,
          hd: 0.55,
          h: 2.0,
          rz: -(s.v + 16),
          jumpY: 0,
          vy: 0,
          jumping: false,
          honked: false
        });
        sfx.play('taxi_warn');
        s.taxiWarn = null;
      }
    }
  } else if(!s.isRidingTaxi && s.phase === PHASES.NORMAL && s.taxiCooldown <= 0){
    const hasTaxi = s.obs.some(o => o.type === 'taxi');
    if(!hasTaxi){
      // สุ่มเลือกเลนที่จะมา โดยข้าม Safe Lane Checker 100% (ไม่ยกเลิกแม้เลนจะเต็ม)
      // โอกาส 65% เกิดที่เลนเดียวกับเป็ด เพื่อเปิดโอกาสให้ผู้เล่นชนเพื่อขึ้นรถได้ง่าย
      const targetLane = Math.random() < 0.65 ? s.duck.lane : Math.floor(Math.random() * 3);
      s.taxiWarn = {
        lane: targetLane,
        x: OBSTACLE_X[targetLane],
        timer: 1.4,
        maxTimer: 1.4
      };
      fx('🚕 แท็กซี่กำลังมา! รอขึ้นเลย!', '#39ff14');
      s.taxiCooldown = 120.0; // รีเซ็ตคูลดาวน์แท็กซี่ 2 นาทีเต็ม (120 วินาที) ทันที
    }
  }

  const jy=s.jump.y;
  // Hitbox ของเป็ดและคนบนห่วงยาง ผูกพิกัดตรงกับตำแหน่งที่วาดภาพบน Canvas แบบ 100% (Hard-Bound Hitbox)
  const hb = getPlayerHitbox(s, 1);
  for(let i=s.obs.length-1;i>=0;i--){
    const o=s.obs[i];
    if(o.isKnockedOut){
      o.y=(o.y||0)+(o.vy||0)*wd;o.vy=(o.vy||0)-26*wd;o.x+=(o.vx||0)*wd;o.z+=dz+(o.vz||0)*wd;
      o.rot=(o.rot||0)+8*wd;
      if(o.z>16||o.z<-120||Math.abs(o.x)>20||o.y<-5){s.obs.splice(i,1);continue}
      continue; // ข้ามการชนกับผู้เล่นโดยสิ้นเชิง (Player ignores knocked-out entities)
    }
    o.z+=dz+(o.rz||0)*wd;if(o.npc)npcStep(o,s,wd);
    // การ Despawn สิ่งกีดขวาง:
    if(o.type==='tuktuk'||o.type==='taxi'){
      if(o.z<-100){s.obs.splice(i,1);continue}
    }else{
      if(o.z>14){s.obs.splice(i,1);continue}
    }
    if(o.isKnockedOut)continue;

    // ตรวจจับการขึ้นแท็กซี่ (Boarding Taxi):
    if(o.type==='taxi'){
      if(!s.isRidingTaxi && (circleAABB(hb.duck.x,hb.duck.z,hb.duck.r,o) || (s.grace<=0&&circleAABB(hb.tube.x,hb.tube.z,hb.tube.r,o)))){
        s.obs.splice(i,1); // ลบ Taxi NPC ออกจากอาร์เรย์
        // Fix Part A: Snap พิกัดและเลนของผู้เล่นให้ตรงกับเลนของรถแท็กซี่ทันที 100%
        const taxiLane = (Math.abs(o.x - OBSTACLE_X[0]) < 0.8) ? 0 : ((Math.abs(o.x - OBSTACLE_X[2]) < 0.8) ? 2 : 1);
        s.duck.lane = taxiLane;
        s.duck.x = LANE[taxiLane];
        s.duck.px = LANE[taxiLane];
        s.duck.vx = 0;
        s.tube.x = LANE[taxiLane];
        s.tube.px = LANE[taxiLane];
        s.tube.vx = 0;
        s.taxiLane = taxiLane;
        input.queue.length = 0;
        s.isRidingTaxi = true;
        s.taxiTimer = 10.0; // จับเวลา 10 วินาที
        sfx.play('taxi_horn');
        fx('ขึ้นแท็กซี่แล้ว! 🚕💨 (10 วิ)', '#39ff14');
        spawnSplash(s.duck.x, 0, 0, 16, 2.5);
        continue;
      }
      continue; // ถ้ายังไม่ชน หรือวิ่งแซงไป ให้แท็กซี่วิ่งผ่านไปได้ ไม่ทำร้ายผู้เล่น
    }

    // ขณะที่ผู้เล่นขึ้นแท็กซี่อยู่ (isRidingTaxi): สืบทอดพลังแท็กซี่ (Immune + Auto-jump Log + Ram Others)
    if(s.isRidingTaxi){
      if(circleAABB(hb.duck.x,hb.duck.z,hb.duck.r+0.35,o)){
        const isLog = (o.type==='log'||o.type==='wide');
        if(isLog){
          // Auto-Jump ข้ามขอนไม้อัตโนมัติทันที
          if(!s.jump.air){
            s.jump.vy = JUMP.v0 * 1.15;
            s.jump.air = true;
            sfx.play('jump');
            spawnSplash(s.duck.x, 0, 0, 10, 2.0);
          }
        } else {
          // ชนสิ่งกีดขวางอื่นกระเด็นปลิวทันที (Ram / Knockback)
          o.isKnockedOut = true;
          o.vy = 16.0;
          o.vx = (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 8);
          o.vz = (Math.random() - 0.5) * 12;
          sfx.play('hit');
          fx('แท็กซี่ชนกระเด็น! 💥', '#ff3366');
          spawnSplash(o.x, 0, o.z, 14, 2.5);
        }
      }
      continue; // ผู้เล่นเป็นอมตะ ไม่ตายเด็ดขาด!
    }
    if(o.z<hb.duck.z-6||o.z>hb.tube.z+3)continue;
    // เรือแจว (Rowboat) เป็นสิ่งกีดขวางทรงสูง ไม่สามารถกระโดดข้ามได้ทุกกรณี (Un-jumpable absolute blocker)
    // หากเป็นสิ่งกีดขวางอื่น (เช่น ขอนไม้) และผู้เล่นกระโดดสูงกว่าความสูงสิ่งกีดขวาง (jy >= o.h) ให้ข้ามผ่านได้ปลอดภัย
    if(o.type!=='rowboat'&&o.type!=='tuktuk'&&jy>=o.h)continue;
    if(!testMode && !(s.invincibleTimer > 0)){
      // ตรวจจับการชนอิงพิกัดฐานสไปรต์จริงของเป็ด (Hard-bound to bottom-center of Duck sprite)
      if(circleAABB(hb.duck.x,hb.duck.z,hb.duck.r,o)){
        return die(o.type==='rowboat'?'เป็ดชนเรือแจว (ห้ามกระโดดข้ามเรือแจว)':(o.type==='tuktuk'?'โดนรถตุ๊กๆ ซิ่งจี๊ดชนเข้าเต็มๆ!':'เป็ดชนสิ่งกีดขวาง'));
      }
      // ตรวจจับการชนอิงพิกัดฐานสไปรต์จริงของคนบนห่วงยาง (Hard-bound to bottom-center of Tube sprite)
      if(s.grace<=0&&circleAABB(hb.tube.x,hb.tube.z,hb.tube.r,o)){
        return die(o.type==='rowboat'?'ห่วงยางชนเรือแจว':(o.type==='tuktuk'?'โดนรถตุ๊กๆ สอยห่วงยางคว่ำ!':'คนบนห่วงยางชนเข้าแล้ว'));
      }
    }
  }
  for(let i=s.vic.length-1;i>=0;i--){
    const v=s.vic[i];
    if(v.isKnockedOut){
      v.y=(v.y||0)+(v.vy||0)*wd;v.vy=(v.vy||0)-26*wd;v.x+=(v.vx||0)*wd;v.z+=dz+(v.vz||0)*wd;
      v.rot=(v.rot||0)+8*wd;
      if(v.z>16||v.z<-120||Math.abs(v.x)>20||v.y<-5){s.vic.splice(i,1);continue}
      continue; // ข้ามการตรวจจับช่วยคนของผู้เล่น (Player ignores knocked-out victim)
    }
    v.z+=dz;
    // ละอองน้ำและคลื่นน้ำฟุ้งกระจายรอบคนจมน้ำที่กำลังตะเกียกตะกาย (Continuous struggling water splashes)
    if(v.z>-70&&v.z<10){
      if(Math.random()<0.32){
        spawnSplash(v.x+(Math.random()-.5)*.5,0,v.z+(Math.random()-.5)*.4,2,0.85);
      }
      if(Math.random()<0.2){
        s.wakes.push({x:v.x+(Math.random()-.5)*.2,z:v.z,r:.18,maxR:1.1,life:0,maxLife:.45,type:'droplet'});
      }
    }
    if(touchVictim({x:hb.tube.x,z:hb.tube.z,r:hb.tube.r},v)){ // แตะที่ความเร็วใดก็ได้ = ช่วยสำเร็จทันที
      s.combo++;s.rescued++;s.pass=Math.min(3,s.pass+1);s.score+=100*Math.min(s.combo,10);
      s.slow=.3;s.grace=.15;sfx.play('rescue');fx('ช่วยได้! x'+s.combo,'#7dff9a');s.vic.splice(i,1);continue;
    }
    if(v.z>hb.tube.z+1.5){if(s.combo>0)fx('พลาด!','#ff8a7d');s.combo=0;s.vic.splice(i,1)}
  }
}
function die(why){
  if(testMode || (S.invincibleTimer > 0))return;
  sfx.play('hit');
  S.state='OVER';S.shake=.4;
  if(S.score>highScore){
    highScore=Math.floor(S.score);
    best=highScore;
    try{
      localStorage.setItem('highScore',highScore);
      localStorage.setItem('duckBest',highScore);
    }catch(e){}
  }
  updateHighScoreUI();
  overlay('over',why);
}
function savePrev(){const s=S;s.jump.py=s.jump.y;s.duck.px=s.duck.x;s.tube.px=s.tube.x;s.tube.pz=s.tube.z}

/* ---------- Overlay / สถานะ ---------- */
const mm=$('#mm'),hw=$('#hw');let snd=true;
let countdownTimer=null;
const cdEl=$('#cd'),cdnEl=$('#cdn');
function cancelCountdown(){
  if(countdownTimer){clearTimeout(countdownTimer);countdownTimer=null}
  if(cdEl)cdEl.hidden=true;
}
function showCountdownStep(val,text,isGo){
  if(!cdEl||!cdnEl)return;
  cdEl.hidden=false;
  cdnEl.textContent=text||val;
  if(isGo)cdnEl.classList.add('go');
  else cdnEl.classList.remove('go');
  cdnEl.style.animation='none';
  void cdnEl.offsetWidth;
  cdnEl.style.animation='';
}
function overlay(kind,why){
  cancelCountdown();
  $('#ov').hidden=false;$('#ot').textContent='จบเกม';
  $('#op').innerHTML=`${why}<br><span style="font-size:1.05em;display:inline-block;margin-top:6px;">คะแนนรอบนี้: <b>${Math.floor(S.score)}</b> คะแนน (วิ่งได้ ${Math.floor(S.dist)} ม. · ช่วยคนได้ ${S.rescued} คน)</span><br><span style="display:inline-block;margin-top:4px;color:var(--duck);font-weight:700;">🏆 สถิติสูงสุด (Best): <b>${Math.floor(highScore)}</b> คะแนน</span>`;
  $('#oh').textContent='ขอนไม้ต้องกระโดดข้าม ส่วนม้าและเรือต้องหลบเลน';
}
function showMenu(){
  cancelCountdown();
  closeSettings();
  closeSkinModal();
  closeHowToPlay();
  resetRestartConfirm();
  updateHighScoreUI();
  mm.hidden=false;$('#ov').hidden=true;
  $('#mr').disabled=S.state!=='PAUSED';
}
function pause(){
  if(S.state==='RUN'||S.state==='COUNTDOWN'){
    cancelCountdown();
    S.state='PAUSED';
    showMenu();
  }
}
function startNew(){
  cancelCountdown();
  closeSettings();
  closeSkinModal();
  closeHowToPlay();
  newGame();
  S.state='RUN';
  mm.hidden=true;
  $('#ov').hidden=true;
  acc=0;
  last=performance.now()/1000;
}
function resume(){
  if(S.state!=='PAUSED')return;
  cancelCountdown();
  S.state='COUNTDOWN';
  mm.hidden=true;
  $('#ov').hidden=true;
  let step=3;
  showCountdownStep(3,'3',false);
  sfx.play('countdown');
  const tick=()=>{
    if(S.state!=='COUNTDOWN')return;
    step--;
    if(step>0){
      showCountdownStep(step,''+step,false);
      sfx.play('countdown');
      countdownTimer=setTimeout(tick,1000);
    }else{
      showCountdownStep(0,'ลุย!',true);
      sfx.play('go');
      countdownTimer=setTimeout(()=>{
        if(S.state!=='COUNTDOWN')return;
        cancelCountdown();
        acc=0;
        last=performance.now()/1000;
        S.state='RUN';
      },400);
    }
  };
  countdownTimer=setTimeout(tick,1000);
}
// ตัวแปรสำหรับระบบยืนยันเริ่มใหม่ในปุ่มแบบกดซ้ำ 2 ครั้ง (In-Button Two-Tap Confirmation)
let isConfirmingRestart = false;
let confirmTimeout = null;

function resetRestartConfirm(){
  if(confirmTimeout){
    clearTimeout(confirmTimeout);
    confirmTimeout = null;
  }
  isConfirmingRestart = false;
  const btnMs = $('#ms');
  const btnSmRestart = $('#sm-restart');
  const btnBr = $('#br');
  if(btnMs) btnMs.textContent = '▶ เริ่มเกม';
  if(btnSmRestart) btnSmRestart.textContent = '🔄 เริ่มเกมใหม่';
  if(btnBr) btnBr.textContent = 'เริ่มใหม่';
}

function updateSettingsUI(){
  if($('#sm-sound')) $('#sm-sound').textContent = '🔊 เปิด/ปิดเสียง: ' + (snd ? 'เปิด' : 'ปิด');
  if($('#sm-hitbox')) $('#sm-hitbox').textContent = '🎯 เปิด/ปิดฮิตบ็อกซ์: ' + (dbg ? 'เปิด' : 'ปิด');
  if($('#sm-test')) $('#sm-test').textContent = '🛡️ โหมดทดสอบ: ' + (testMode ? 'เปิด 🟢' : 'ปิด ⚪');
}

function openSettings(){
  if(S.state === 'RUN' || S.state === 'COUNTDOWN'){
    cancelCountdown();
    S.state = 'PAUSED';
  }
  updateSettingsUI();
  resetRestartConfirm();
  if($('#settings-menu')) $('#settings-menu').hidden = false;
  if($('#btn-settings')) $('#btn-settings').hidden = true;
}

function closeSettings(){
  if($('#settings-menu')) $('#settings-menu').hidden = true;
  resetRestartConfirm();
}

/* ---------- Skin System & Live Animated Preview ---------- */
const SKINS = [
  { id: 'duck', name: 'เป็ดไปไหนวะ' },
  { id: 'shark', name: 'ปลาทูย่านแม่กลอง' }
];
let viewedSkinIndex = 0;
let skinPreviewActive = false;
let skinPreviewRaf = null;
let pendingStartFromSkin = false;

function updateSkinDisplay(){
  const skin = SKINS[viewedSkinIndex];
  if($('#skin-name-display')){
    $('#skin-name-display').textContent = skin.name;
  }
  if($('#skin-action-btn')){
    if(pendingStartFromSkin){
      $('#skin-action-btn').textContent = 'ตกลง & เริ่มเกม (' + skin.name + ')';
      $('#skin-action-btn').classList.remove('active-skin-btn');
    } else {
      const isEquipped = (currentSkin === skin.id);
      $('#skin-action-btn').textContent = isEquipped ? '✓ กำลังใช้งาน' : 'เลือกใช้งาน';
      $('#skin-action-btn').classList.toggle('active-skin-btn', isEquipped);
    }
  }
}

function updateSkinUI(){
  updateSkinDisplay();
}

function nextSkin(){
  viewedSkinIndex = (viewedSkinIndex + 1) % SKINS.length;
  updateSkinDisplay();
}

function prevSkin(){
  viewedSkinIndex = (viewedSkinIndex - 1 + SKINS.length) % SKINS.length;
  updateSkinDisplay();
}

function applyViewedSkin(){
  const skin = SKINS[viewedSkinIndex];
  selectSkin(skin.id);
  closeSkinModal();
  if(pendingStartFromSkin){
    pendingStartFromSkin = false;
    startNew();
  } else if(S && S.state === 'PAUSED'){
    resume();
  }
}

function skinPreviewLoop(ms){
  if(!skinPreviewActive) return;
  const canvas = $('#skin-preview-canvas');
  if(!canvas){ skinPreviewActive = false; return; }
  const pctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const time = ms / 1000;

  // วาดพื้นหลังระลอกคลื่นน้ำ
  pctx.clearRect(0, 0, w, h);
  pctx.save();
  pctx.fillStyle = '#0e4a5d';
  pctx.beginPath();
  pctx.roundRect(0, 0, w, h, 18);
  pctx.fill();
  pctx.clip();

  pctx.strokeStyle = 'rgba(34, 182, 238, 0.24)';
  pctx.lineWidth = 2.5;
  for(let y = 16; y < h + 20; y += 22){
    pctx.beginPath();
    for(let x = -10; x < w + 16; x += 16){
      pctx.quadraticCurveTo(x + 4, y + Math.sin(time * 3 + x) * 2, x + 8, y);
    }
    pctx.stroke();
  }

  // วาดตัวละครสกินที่กำลังดูอยู่ (หันหลังมุมเดียวกับในเกม พร้อมแอนิเมชันเคลื่อนไหวแบบเรียลไทม์)
  const currentViewed = SKINS[viewedSkinIndex].id;
  drawDuck({ x: w / 2, y: h / 2 + 10, s: 68 }, 0, 0, pctx, currentViewed, time);

  pctx.restore();

  skinPreviewRaf = requestAnimationFrame(skinPreviewLoop);
}

function openSkinModal(isFirstTime = false){
  pendingStartFromSkin = isFirstTime;
  viewedSkinIndex = SKINS.findIndex(s => s.id === currentSkin);
  if(viewedSkinIndex < 0) viewedSkinIndex = 0;

  if($('#skin-modal')) $('#skin-modal').hidden = false;
  if($('#btn-settings')) $('#btn-settings').hidden = true;
  if($('#btn-skin')) $('#btn-skin').hidden = true;

  updateSkinDisplay();

  if(!skinPreviewActive){
    skinPreviewActive = true;
    skinPreviewRaf = requestAnimationFrame(skinPreviewLoop);
  }
}

function closeSkinModal(){
  if($('#skin-modal')) $('#skin-modal').hidden = true;
  skinPreviewActive = false;
  if(skinPreviewRaf){
    cancelAnimationFrame(skinPreviewRaf);
    skinPreviewRaf = null;
  }
}

function selectSkin(skinId){
  currentSkin = skinId;
  try {
    localStorage.setItem('currentSkin', skinId);
  } catch(e) {}
  updateSkinDisplay();
}

function handleSkinBtnClick(e){
  if(e && e.preventDefault) e.preventDefault();
  if(S.state === 'RUN' || S.state === 'COUNTDOWN'){
    cancelCountdown();
    S.state = 'PAUSED';
  }
  openSkinModal(false);
}

function toggleSound(){
  snd = !snd;
  sfx.enabled = snd;
  if($('#mso')) $('#mso').textContent = 'เสียง: ' + (snd ? 'เปิด 🔊' : 'ปิด 🔇');
  updateSettingsUI();
}

function toggleHitbox(){
  dbg = !dbg;
  if($('#bd')) $('#bd').textContent = 'Hitbox: ' + (dbg ? 'เปิด' : 'ปิด');
  updateSettingsUI();
}

function toggleTestMode(){
  setTestMode(!testMode);
  updateSettingsUI();
}

// ฟังก์ชันเริ่มเกมใหม่พร้อมระบบยืนยันในปุ่ม (Two-Tap Confirmation - ปลอดภัย 100% ไม่ใช้ window.confirm)
function handleStartGame(e){
  if(e && e.preventDefault) e.preventDefault();
  const btn = (e && e.currentTarget) || (e && e.target && e.target.closest('button')) || $('#ms');

  // กรณีที่ 1: ไม่มีเกมค้างอยู่ (หน้าแรกสุดหรือหน้า Game Over)
  if(!S || S.state === 'MENU' || S.state === 'OVER'){
    resetRestartConfirm();
    closeSettings();
    closeSkinModal();

    // ตรวจสอบว่าผู้เล่นเคยเลือกสกินไว้แล้วหรือไม่ (First-Time Flow)
    let hasSavedSkin = false;
    try {
      hasSavedSkin = !!localStorage.getItem('currentSkin');
    } catch(err) {}

    if(!hasSavedSkin){
      // ผู้เล่นเล่นครั้งแรก -> เปิด Modal สกินให้เลือกก่อนเริ่มเกม
      openSkinModal(true);
      return;
    }

    startNew();
    return;
  }

  // กรณีที่ 2: มีเกมกำลังเล่นอยู่หรือถูกหยุดชั่วคราว (S.state === 'PAUSED' หรือ 'RUN')
  if(S.state === 'PAUSED' || S.state === 'RUN' || S.state === 'COUNTDOWN'){
    if(!isConfirmingRestart){
      // กดครั้งที่ 1: เปลี่ยนข้อความปุ่มเป็นข้อความยืนยัน และนับเวลา 3 วินาที (3000ms)
      isConfirmingRestart = true;
      if(btn) btn.textContent = 'ยืนยันเริ่มใหม่? (กดซ้ำ)';
      if(confirmTimeout) clearTimeout(confirmTimeout);
      confirmTimeout = setTimeout(()=>{
        resetRestartConfirm();
      }, 3000);
      return;
    } else {
      // กดครั้งที่ 2 (ภายใน 3 วินาที): ผู้เล่นยืนยันการเริ่มเกมใหม่
      resetRestartConfirm();
      closeSettings();
      closeSkinModal();
      startNew();
      return;
    }
  }

  resetRestartConfirm();
  closeSettings();
  closeSkinModal();
  startNew();
}

// ตัวจัดการปุ่มหยุด / เล่นต่อ (Pause Button)
function handleTogglePause(e){
  if(e && e.preventDefault) e.preventDefault();
  if(!S) return;

  if(S.state === 'RUN' || S.state === 'COUNTDOWN'){
    openSettings();
  } else if(S.state === 'PAUSED'){
    closeSettings();
    resume();
  }
}

function openHowToPlay(){
  if(hw){
    hw.hidden = false;
    hw.style.display = 'flex';
  }
}
function closeHowToPlay(){
  if(hw){
    hw.hidden = true;
    hw.style.display = 'none';
  }
}

$('#go').onclick = startNew;
$('#ms').onclick = handleStartGame;
if($('#br')) $('#br').onclick = handleStartGame;
$('#mr').onclick = resume;
if($('#bp')) $('#bp').onclick = handleTogglePause;
$('#gm').onclick = ()=>{cancelCountdown();closeSettings();closeSkinModal();closeHowToPlay();newGame();showMenu()};
if($('#mh')) $('#mh').onclick = openHowToPlay;
if($('#hx')) $('#hx').onclick = closeHowToPlay;
$('#mso').onclick = toggleSound;

// ผูกการทำงานปุ่มของ Settings Menu
if($('#btn-settings')) $('#btn-settings').onclick = openSettings;
if($('#sm-resume')) $('#sm-resume').onclick = ()=>{ closeSettings(); resume(); };
if($('#sm-restart')) $('#sm-restart').onclick = handleStartGame;
if($('#sm-sound')) $('#sm-sound').onclick = toggleSound;
if($('#sm-hitbox')) $('#sm-hitbox').onclick = toggleHitbox;
if($('#sm-test')) $('#sm-test').onclick = toggleTestMode;
if($('#sm-menu')) $('#sm-menu').onclick = ()=>{ closeSettings(); showMenu(); };

// ผูกการทำงานปุ่มของ Skin Selection Menu
if($('#btn-skin')) $('#btn-skin').onclick = handleSkinBtnClick;
if($('#skin-prev')) $('#skin-prev').onclick = prevSkin;
if($('#skin-next')) $('#skin-next').onclick = nextSkin;
if($('#skin-action-btn')) $('#skin-action-btn').onclick = applyViewedSkin;
document.addEventListener('click',e=>{const b=e.target.closest('button');if(b){sfx.play('click');b.blur()}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();last=performance.now()/1000});

/* ---------- Render (faux-3D) ---------- */
function P(x,z,y=0){const d=Math.max(.8,CAM.z-z),s=F/d;return{x:W/2+(x-camX)*s,y:HZ+(CAM.y-y)*s,s,d}}
function quad(x1,x2,zn,zf,c){
  const dn=Math.max(.8,CAM.z-zn),sn=F/dn,df=Math.max(.8,CAM.z-zf),sf=F/df;
  const sxn=W*.5-camX*sn,sxf=W*.5-camX*sf,yn=HZ+CAM.y*sn,yf=HZ+CAM.y*sf;
  ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(sxn+x1*sn,yn);ctx.lineTo(sxn+x2*sn,yn);ctx.lineTo(sxf+x2*sf,yf);ctx.lineTo(sxf+x1*sf,yf);ctx.fill();
}
function ell(x,y,rx,ry){ctx.beginPath();ctx.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,7);ctx.fill()}
function circ(x,y,r){ctx.beginPath();ctx.arc(x,y,Math.max(.1,r),0,7);ctx.fill()}
function dbgCircle(x,z,r,col,yOff=0){const p=P(x,z),rx=r*p.s;ctx.strokeStyle=col;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(p.x,p.y+yOff,rx,rx*Math.min(.8,CAM.y/p.d*.8),0,0,7);ctx.stroke()}
function dbgBox(o,z){const a=P(o.x-o.hw,z+o.hd),b=P(o.x+o.hw,z+o.hd),c=P(o.x+o.hw,z-o.hd),d=P(o.x-o.hw,z-o.hd);ctx.strokeStyle='#ff3b3b';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.closePath();ctx.stroke()}

const INK='#141226',lw=u=>Math.max(2,u*.07);
function E(x,y,rx,ry,f,w){ctx.beginPath();ctx.ellipse(x,y,Math.max(.5,rx),Math.max(.5,ry),0,0,7);ctx.fillStyle=f;ctx.fill();ctx.lineWidth=w;ctx.strokeStyle=INK;ctx.stroke()}
function RR(x,y,w,h,r,f,l){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=f;ctx.fill();ctx.lineWidth=l;ctx.strokeStyle=INK;ctx.stroke()}
function TRI(pts,f,l){ctx.beginPath();pts.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.closePath();ctx.fillStyle=f;ctx.fill();ctx.lineWidth=l;ctx.lineJoin='round';ctx.strokeStyle=INK;ctx.stroke()}

/* คลื่นน้ำและหยดน้ำกระจาย (Water Wakes & Splashes) */
function drawWakes(zoff){
  if(!S.wakes)return;
  const pOff = getPlayerYOff();
  for(let i=0;i<S.wakes.length;i++){
    const w=S.wakes[i],z=w.z+zoff;
    if(z<-10||z>14)continue;
    const p=P(w.x,z,0);if(p.d<.7)continue;
    if(w.type==='duck'||w.type==='tube'||w.type==='land') p.y += pOff;
    const al=Math.max(0,1-w.life/w.maxLife);
    const rx=w.r*p.s,ry=rx*Math.min(.36,CAM.y/p.d*.42);
    ctx.strokeStyle=`rgba(255,255,255,${.44*al})`;
    ctx.lineWidth=Math.max(1.2,2*p.s*.04);
    ctx.beginPath();ctx.ellipse(p.x,p.y,rx,ry,0,0,7);ctx.stroke();
    if(w.type==='duck'||w.type==='tube'||w.type==='land'){
      ctx.fillStyle=`rgba(175,245,255,${.24*al})`;
      ctx.beginPath();ctx.ellipse(p.x,p.y,rx*.62,ry*.62,0,0,7);ctx.fill();
      const vs=rx*.82;
      ctx.strokeStyle=`rgba(255,255,255,${.48*al})`;
      ctx.beginPath();ctx.moveTo(p.x-vs,p.y+ry*.3);ctx.lineTo(p.x,p.y-ry*.2);ctx.lineTo(p.x+vs,p.y+ry*.3);ctx.stroke();
    }
  }
}
function drawSplashes(zoff){
  if(!S.splashes)return;
  const pOff = getPlayerYOff();
  for(let i=0;i<S.splashes.length;i++){
    const sp=S.splashes[i],z=sp.z+zoff;
    if(z<-10||z>14||sp.y<=0)continue;
    const p=P(sp.x,z,sp.y);if(p.d<.7)continue;
    if(z>=-0.5) p.y += pOff;
    const al=Math.max(0,1-sp.life/sp.maxLife);
    const r=Math.max(1.3,sp.r*p.s);
    ctx.fillStyle=`rgba(240,252,255,${.9*al})`;
    ctx.beginPath();ctx.arc(p.x,p.y,r,0,7);ctx.fill();
    ctx.strokeStyle=`rgba(15,110,150,${.35*al})`;
    ctx.lineWidth=.8;ctx.stroke();
  }
}

/* ตัวละครโมเดลเป็ดดั้งเดิม (Duck Model: เป็ดไปไหนวะ) - รองรับ targetCtx */
function drawDuckModel(tctx, p, tilt = 0, h = 0, time = 0){
  const u = p.s, w = Math.max(2, u * .07);
  const sw = Math.sin(time * 9), bob = Math.abs(sw) * .03 * u;
  tctx.save();
  tctx.translate(p.x, p.y);
  if(h < .05){
    const bw = .58 * u + Math.sin(time * 12) * .06 * u;
    tctx.fillStyle = 'rgba(255,255,255,.55)';
    tctx.beginPath(); tctx.ellipse(0, .02 * u, bw, .15 * u, 0, 0, 7); tctx.fill();
    tctx.strokeStyle = '#fff'; tctx.lineWidth = w * .75;
    tctx.beginPath(); tctx.arc(0, .02 * u, bw * .85, .2, Math.PI - .2); tctx.stroke();
  }
  tctx.fillStyle = 'rgba(10,20,60,.35)';
  tctx.beginPath(); tctx.ellipse(0, 0, .44 * u, .15 * u, 0, 0, 7); tctx.fill();

  tctx.translate(0, -h * u - bob);
  tctx.rotate(tilt + sw * .03);

  // เท้าเป็ด
  tctx.beginPath(); tctx.ellipse(-.18 * u, -.04 * u + sw * .03 * u, .11 * u, .05 * u, 0, 0, 7); tctx.fillStyle = '#ff8a00'; tctx.fill(); tctx.lineWidth = w * .8; tctx.strokeStyle = INK; tctx.stroke();
  tctx.beginPath(); tctx.ellipse(.18 * u, -.04 * u - sw * .03 * u, .11 * u, .05 * u, 0, 0, 7); tctx.fillStyle = '#ff8a00'; tctx.fill(); tctx.lineWidth = w * .8; tctx.strokeStyle = INK; tctx.stroke();

  // ลำตัวเป็ดสีเหลือง
  tctx.beginPath(); tctx.ellipse(0, -.34 * u, .42 * u, .34 * u, 0, 0, 7); tctx.fillStyle = '#ffe11a'; tctx.fill(); tctx.lineWidth = w; tctx.strokeStyle = INK; tctx.stroke();

  // ปีกสองข้าง
  tctx.beginPath(); tctx.ellipse(-.3 * u, -.4 * u, .14 * u, .23 * u, 0, 0, 7); tctx.fillStyle = '#ffb800'; tctx.fill(); tctx.lineWidth = w * .8; tctx.strokeStyle = INK; tctx.stroke();
  tctx.beginPath(); tctx.ellipse(.3 * u, -.4 * u, .14 * u, .23 * u, 0, 0, 7); tctx.fillStyle = '#ffb800'; tctx.fill(); tctx.lineWidth = w * .8; tctx.strokeStyle = INK; tctx.stroke();

  // หางเป็ด
  tctx.beginPath(); tctx.moveTo(-.13 * u, -.14 * u); tctx.lineTo(.13 * u, -.14 * u); tctx.lineTo(0, -.42 * u); tctx.closePath(); tctx.fillStyle = '#ffb800'; tctx.fill(); tctx.lineWidth = w * .8; tctx.strokeStyle = INK; tctx.stroke();

  // ศีรษะและหงอน
  tctx.beginPath(); tctx.ellipse(0, -.74 * u, .24 * u, .23 * u, 0, 0, 7); tctx.fillStyle = '#ffe11a'; tctx.fill(); tctx.lineWidth = w; tctx.strokeStyle = INK; tctx.stroke();
  tctx.beginPath(); tctx.ellipse(0, -.63 * u, .15 * u, .07 * u, 0, 0, 7); tctx.fillStyle = '#ffc800'; tctx.fill(); tctx.lineWidth = w * .4; tctx.strokeStyle = INK; tctx.stroke();

  tctx.beginPath(); tctx.moveTo(-.05 * u, -.93 * u); tctx.lineTo(.05 * u, -.93 * u); tctx.lineTo(.02 * u, -1.06 * u); tctx.closePath(); tctx.fillStyle = '#ffe11a'; tctx.fill(); tctx.lineWidth = w * .6; tctx.strokeStyle = INK; tctx.stroke();

  tctx.restore();
}

/* ตัวละครโมเดลฉลาม (Shark Model: ปลาทูย่านแม่กลอง) - รองรับ targetCtx */
function drawSharkModel(tctx, p, tilt = 0, h = 0, time = 0){
  const u = p.s, w = Math.max(2, u * .07);
  const sw = Math.sin(time * 12), bob = Math.abs(sw) * .025 * u;
  const tailWag = Math.sin(time * 14); // Tail wagging animation
  tctx.save();
  tctx.translate(p.x, p.y);

  // 1. ระลอกคลื่นน้ำและละอองท้ายหาง
  if(h < .05){
    const rw = .62 * u + Math.sin(time * 10) * .07 * u;
    const rh = .22 * u + Math.cos(time * 10) * .03 * u;
    tctx.fillStyle = 'rgba(255,255,255,.62)';
    tctx.beginPath(); tctx.ellipse(0, .03 * u, rw, rh, 0, 0, 7); tctx.fill();
    tctx.strokeStyle = 'rgba(165,243,252,.85)';
    tctx.lineWidth = w * .8;
    tctx.beginPath(); tctx.ellipse(0, .03 * u, rw * .88, rh * .75, 0, 0, 7); tctx.stroke();

    const twx = tailWag * .08 * u;
    tctx.fillStyle = 'rgba(255,255,255,.7)';
    tctx.beginPath(); tctx.ellipse(twx, .16 * u, .24 * u, .08 * u, 0, 0, 7); tctx.fill();
  }

  // เงาใต้ตัว
  tctx.fillStyle = 'rgba(10,20,60,.35)';
  tctx.beginPath(); tctx.ellipse(0, 0, .46 * u, .16 * u, 0, 0, 7); tctx.fill();

  tctx.translate(0, -h * u - bob);
  tctx.rotate(tilt + sw * .025);

  const SHARK_BLUE = '#50769d';
  const SHARK_BELLY = '#f0f4f8';
  const SHARK_DARK = '#3d5d7e';

  // 2. ครีบข้างซ้ายและขวา
  tctx.beginPath();
  tctx.moveTo(-.18 * u, -.32 * u);
  tctx.bezierCurveTo(-.44 * u, -.26 * u, -.52 * u, -.14 * u, -.4 * u, -.04 * u);
  tctx.bezierCurveTo(-.3 * u, -.08 * u, -.18 * u, -.18 * u, -.14 * u, -.2 * u);
  tctx.closePath();
  tctx.fillStyle = SHARK_BLUE; tctx.fill();
  tctx.lineWidth = w; tctx.strokeStyle = INK; tctx.stroke();

  tctx.beginPath();
  tctx.moveTo(.18 * u, -.32 * u);
  tctx.bezierCurveTo(.44 * u, -.26 * u, .52 * u, -.14 * u, .4 * u, -.04 * u);
  tctx.bezierCurveTo(.3 * u, -.08 * u, .18 * u, -.18 * u, .14 * u, -.2 * u);
  tctx.closePath();
  tctx.fillStyle = SHARK_BLUE; tctx.fill();
  tctx.lineWidth = w; tctx.strokeStyle = INK; tctx.stroke();

  // 3. ครีบหางดุ๊กดิ๊กด้านหลัง (Tail-Wagging Animation)
  tctx.save();
  tctx.translate(0, -.08 * u);
  tctx.rotate(tailWag * .34);
  tctx.beginPath();
  tctx.moveTo(-.11 * u, -.1 * u);
  tctx.quadraticCurveTo(0, .02 * u, .11 * u, -.1 * u);
  tctx.lineTo(.06 * u, .06 * u);
  tctx.lineTo(-.06 * u, .06 * u);
  tctx.closePath();
  tctx.fillStyle = SHARK_BLUE; tctx.fill();
  tctx.lineWidth = w * .8; tctx.strokeStyle = INK; tctx.stroke();

  tctx.beginPath();
  tctx.moveTo(0, .04 * u);
  tctx.bezierCurveTo(-.14 * u, .07 * u, -.28 * u, .17 * u, -.24 * u, .27 * u);
  tctx.bezierCurveTo(-.15 * u, .23 * u, -.05 * u, .17 * u, 0, .13 * u);
  tctx.bezierCurveTo(.05 * u, .17 * u, .15 * u, .23 * u, .24 * u, .27 * u);
  tctx.bezierCurveTo(.28 * u, .17 * u, .14 * u, .07 * u, 0, .04 * u);
  tctx.closePath();
  tctx.fillStyle = SHARK_BLUE; tctx.fill();
  tctx.lineWidth = w; tctx.strokeStyle = INK; tctx.stroke();
  tctx.restore();

  // 4. ลำตัวฉลาม
  tctx.beginPath();
  tctx.moveTo(0, -.84 * u);
  tctx.bezierCurveTo(-.38 * u, -.74 * u, -.42 * u, -.26 * u, -.18 * u, -.05 * u);
  tctx.bezierCurveTo(-.08 * u, -.01 * u, .08 * u, -.01 * u, .18 * u, -.05 * u);
  tctx.bezierCurveTo(.42 * u, -.26 * u, .38 * u, -.74 * u, 0, -.84 * u);
  tctx.closePath();
  tctx.fillStyle = SHARK_BLUE; tctx.fill();
  tctx.lineWidth = w * 1.15; tctx.strokeStyle = INK; tctx.stroke();

  // 5. ท้องขาว
  tctx.beginPath();
  tctx.moveTo(-.17 * u, -.05 * u);
  tctx.bezierCurveTo(-.1 * u, -.01 * u, .1 * u, -.01 * u, .17 * u, -.05 * u);
  tctx.bezierCurveTo(.11 * u, -.15 * u, -.11 * u, -.15 * u, -.17 * u, -.05 * u);
  tctx.fillStyle = SHARK_BELLY; tctx.fill();
  tctx.lineWidth = w * .7; tctx.strokeStyle = INK; tctx.stroke();

  // 6. ครีบหลัง
  tctx.beginPath();
  tctx.moveTo(-.03 * u, -.54 * u);
  tctx.quadraticCurveTo(0, -.78 * u, .08 * u, -.92 * u);
  tctx.quadraticCurveTo(.03 * u, -.68 * u, .05 * u, -.42 * u);
  tctx.closePath();
  tctx.fillStyle = SHARK_DARK; tctx.fill();
  tctx.lineWidth = w; tctx.strokeStyle = INK; tctx.stroke();

  // 7. รอยเหงือก 3 ขีด
  tctx.lineWidth = w * .85; tctx.strokeStyle = INK; tctx.lineCap = 'round';
  tctx.beginPath(); tctx.arc(-.24 * u, -.45 * u, .08 * u, .2, 1.1); tctx.stroke();
  tctx.beginPath(); tctx.arc(-.21 * u, -.38 * u, .08 * u, .2, 1.1); tctx.stroke();
  tctx.beginPath(); tctx.arc(-.18 * u, -.31 * u, .08 * u, .2, 1.1); tctx.stroke();
  tctx.beginPath(); tctx.arc(.24 * u, -.45 * u, .08 * u, Math.PI - 1.1, Math.PI - .2); tctx.stroke();
  tctx.beginPath(); tctx.arc(.21 * u, -.38 * u, .08 * u, Math.PI - 1.1, Math.PI - .2); tctx.stroke();
  tctx.beginPath(); tctx.arc(.18 * u, -.31 * u, .08 * u, Math.PI - 1.1, Math.PI - .2); tctx.stroke();

  tctx.restore();
}

/* ตัวละครหลัก: สลับการวาดตามสกิน และรองรับ targetCtx (ทั้ง Game Canvas และ Preview Canvas) */
function drawDuck(p, tilt = 0, h = 0, targetCtx = ctx, skinOverride = null, time = (S ? S.t : 0)){
  const skin = skinOverride || currentSkin;
  if(skin === 'shark'){
    drawSharkModel(targetCtx, p, tilt, h, time);
  } else {
    drawDuckModel(targetCtx, p, tilt, h, time);
  }
}

/* คนบนห่วงยาง (Inner-tube Character - ปรับตามรูปต้นแบบ Reference Image เป๊ะ) */
function drawTube(p,tilt,n,h=0){
  const u=p.s,w=lw(u);ctx.save();ctx.translate(p.x,p.y);
  // คลื่นและเงาใต้ห่วงยาง
  const tw=1.08*u+Math.sin(S.t*10+p.x)*.06*u;
  ctx.fillStyle='rgba(255,255,255,.55)';ell(0,.08*u,tw,.28*u);
  ctx.strokeStyle='#fff';ctx.lineWidth=w*.75;ctx.beginPath();ctx.ellipse(0,.06*u,tw*.9,.22*u,0,.1,Math.PI-.1);ctx.stroke();
  ctx.fillStyle='rgba(10,20,60,.38)';ell(0,0,.92*u,.32*u);

  ctx.translate(0,-h*u);ctx.rotate(tilt);

  // 1. ตัวห่วงยางสีเหลืองสดใส
  const trX=1.02*u,trY=.48*u,tubeY=-.16*u;
  ctx.beginPath();ctx.ellipse(0,tubeY,trX,trY,0,0,7);ctx.fillStyle='#ffcf24';ctx.fill();ctx.lineWidth=w*1.25;ctx.strokeStyle=INK;ctx.stroke();

  // 2. แถบสีส้มโค้งมนสองข้าง (Orange Stripes/Segments)
  ctx.save();
  ctx.beginPath();ctx.ellipse(0,tubeY,trX,trY,0,0,7);ctx.clip();
  // แถบส้มซ้าย
  ctx.beginPath();
  ctx.moveTo(-.95*u,tubeY-.1*u);
  ctx.bezierCurveTo(-.85*u,tubeY+.35*u,-.45*u,tubeY+.45*u,-.32*u,tubeY+.45*u);
  ctx.bezierCurveTo(-.4*u,tubeY+.1*u,-.45*u,tubeY-.2*u,-.48*u,tubeY-.35*u);
  ctx.bezierCurveTo(-.75*u,tubeY-.35*u,-.9*u,tubeY-.25*u,-.95*u,tubeY-.1*u);
  ctx.fillStyle='#ff7818';ctx.fill();ctx.lineWidth=w*.9;ctx.strokeStyle=INK;ctx.stroke();
  // แถบส้มขวา
  ctx.beginPath();
  ctx.moveTo(.95*u,tubeY-.1*u);
  ctx.bezierCurveTo(.85*u,tubeY+.35*u,.45*u,tubeY+.45*u,.32*u,tubeY+.45*u);
  ctx.bezierCurveTo(.4*u,tubeY+.1*u,.45*u,tubeY-.2*u,.48*u,tubeY-.35*u);
  ctx.bezierCurveTo(.75*u,tubeY-.35*u,.9*u,tubeY-.25*u,.95*u,tubeY-.1*u);
  ctx.fillStyle='#ff7818';ctx.fill();ctx.lineWidth=w*.9;ctx.strokeStyle=INK;ctx.stroke();

  // 3. ไฮไลท์เงาสะท้อนสีขาวทรงเม็ดยา (Glossy Pill Highlight มุมขวาล่างตาม Reference)
  ctx.beginPath();ctx.ellipse(.46*u,tubeY+.23*u,.24*u,.075*u,-.22,0,7);ctx.fillStyle='#fff';ctx.fill();
  ctx.beginPath();ctx.ellipse(-.52*u,tubeY+.22*u,.09*u,.045*u,.25,0,7);ctx.fillStyle='rgba(255,255,255,.7)';ctx.fill();

  // 4. ช่องกลางห่วงยาง (หลุมน้ำลึก)
  ctx.beginPath();ctx.ellipse(0,tubeY-.05*u,.48*u,.22*u,0,0,7);ctx.fillStyle='#0e4a5d';ctx.fill();ctx.lineWidth=w*1.1;ctx.strokeStyle=INK;ctx.stroke();
  ctx.restore();

  // 5. ผู้โดยสารที่ช่วยขึ้นมาบนห่วงยาง (Rescued Chibi Passengers sitting on the tube next to main character)
  for(let i=0;i<n;i++){
    const sd=(i%2===0)?-1:1;
    // นั่งอยู่ข้างตัวละครหลักบนห่วงยาง (Smaller person sitting backward next to main character)
    const px=(i===2)?0:sd*(.46+(i>>1)*.1)*u;
    const py=(i===2)?(tubeY+.12*u):(tubeY-.08*u-(i>>1)*.05*u);
    const scale=(i===2)?.6:.68;
    const isGirl=(i%2===0); // สลับเพศหญิง/ชายตามรูป Reference

    ctx.save();
    ctx.translate(px,py);
    ctx.scale(scale,scale);

    // ตัวและเสื้อนักเรียนสีขาว
    RR(-.22*u,-.32*u,.44*u,.38*u,.08*u,'#ffffff',w*1.15);
    // กระโปรงนักเรียนหญิง/กางเกงขาสั้นชายสีกรมท่า/ดำ
    RR(-.24*u,-.04*u,.48*u,.16*u,.04*u,'#1e293b',w*1.15);

    // มือเล็กๆ เกาะขอบห่วงยางแน่นหนาปลอดภัย (Hands clutching the inner tube rim)
    E(-.24*u,-.02*u,.07*u,.06*u,'#ffb48e',w);
    E(.24*u,-.02*u,.07*u,.06*u,'#ffb48e',w);

    // ศีรษะและใบหน้าสไตล์จิบิ
    E(0,-.52*u,.25*u,.23*u,'#ffb48e',w*1.1);
    // หูสองข้าง
    E(-.27*u,-.52*u,.06*u,.07*u,'#ffb48e',w);
    E(.27*u,-.52*u,.06*u,.07*u,'#ffb48e',w);

    // ตาและรอยยิ้มโล่งอกดีใจที่รอดชีวิต (Relieved happy expression ^^)
    ctx.strokeStyle=INK;ctx.lineWidth=w*1.2;ctx.lineCap='round';
    // ตาโค้งยิ้มมีความสุข
    ctx.beginPath();ctx.arc(-.1*u,-.54*u,.042*u,Math.PI*1.1,Math.PI*1.9);ctx.stroke();
    ctx.beginPath();ctx.arc(.1*u,-.54*u,.042*u,Math.PI*1.1,Math.PI*1.9);ctx.stroke();
    // แก้มชมพูระเรื่อ
    ctx.fillStyle='rgba(251,113,133,0.6)';
    circ(-.15*u,-.48*u,.038*u);circ(.15*u,-.48*u,.038*u);
    // รอยยิ้ม
    ctx.beginPath();ctx.arc(0,-.46*u,.05*u,.1,Math.PI-.1);ctx.stroke();

    // ทรงผมตามเพศ (หญิง: หางม้าผูกยางรัดชมพู / ชาย: หมวกแก๊ปดำ)
    if(isGirl){
      // ผมหน้าม้าสีน้ำตาลเข้ม
      ctx.beginPath();
      ctx.arc(0,-.56*u,.26*u,Math.PI*1.05,Math.PI*1.95);
      ctx.lineTo(.18*u,-.62*u);ctx.lineTo(0,-.66*u);ctx.lineTo(-.18*u,-.62*u);
      ctx.closePath();
      ctx.fillStyle='#231f20';ctx.fill();ctx.lineWidth=w;ctx.stroke();

      // หางม้าข้างมัดด้วยยางรัดผมสีชมพู (Pink hair tie & ponytail)
      ctx.fillStyle='#f43f5e';circ(sd*.25*u,-.68*u,.06*u);
      ctx.beginPath();
      ctx.moveTo(sd*.25*u,-.68*u);
      ctx.quadraticCurveTo(sd*.48*u,-.75*u,sd*.42*u,-.42*u);
      ctx.quadraticCurveTo(sd*.32*u,-.55*u,sd*.24*u,-.64*u);
      ctx.closePath();
      ctx.fillStyle='#231f20';ctx.fill();ctx.stroke();
    }else{
      // หมวกแก๊ปสีดำหันไปข้างหลัง/ข้าง
      ctx.beginPath();
      ctx.arc(0,-.65*u,.26*u,Math.PI*0.9,Math.PI*2.1);
      ctx.closePath();
      ctx.fillStyle='#1e293b';ctx.fill();ctx.lineWidth=w*1.1;ctx.stroke();
      // ปีกหมวกแก๊ป
      ctx.beginPath();
      ctx.ellipse(-sd*.1*u,-.58*u,.24*u,.07*u,sd*.2,0,7);
      ctx.fillStyle='#0f172a';ctx.fill();ctx.stroke();
    }

    ctx.restore();
  }

  // 6. ตัวละครหลักมองจากด้านหลัง (Exact Reference Model)
  // เสื้อยืดสีขาว (Torso)
  ctx.beginPath();
  ctx.moveTo(-.28*u,tubeY-.02*u);
  ctx.bezierCurveTo(-.35*u,-.4*u,-.32*u,-.68*u,-.24*u,-.74*u);
  ctx.bezierCurveTo(-.12*u,-.78*u,.12*u,-.78*u,.24*u,-.74*u);
  ctx.bezierCurveTo(.32*u,-.68*u,.35*u,-.4*u,.28*u,tubeY-.02*u);
  ctx.closePath();
  ctx.fillStyle='#ffffff';ctx.fill();ctx.lineWidth=w*1.15;ctx.strokeStyle=INK;ctx.stroke();

  // รอยเย็บแขนเสื้อซ้าย-ขวา
  ctx.beginPath();ctx.moveTo(-.25*u,-.48*u);ctx.quadraticCurveTo(-.22*u,-.62*u,-.24*u,-.72*u);ctx.lineWidth=w*.85;ctx.strokeStyle=INK;ctx.stroke();
  ctx.beginPath();ctx.moveTo(.25*u,-.48*u);ctx.quadraticCurveTo(.22*u,-.62*u,.24*u,-.72*u);ctx.lineWidth=w*.85;ctx.strokeStyle=INK;ctx.stroke();

  // หูสองข้างน่ารัก (Peach Ears peeking out)
  E(-.32*u,-.92*u,.085*u,.095*u,'#fca780',w*1.05);
  E(.32*u,-.92*u,.085*u,.095*u,'#fca780',w*1.05);

  // ทรงผมดกดำฟูใต้หมวก (Fluffy Dark Hair)
  ctx.beginPath();
  ctx.moveTo(-.32*u,-.98*u);
  ctx.bezierCurveTo(-.4*u,-.84*u,-.32*u,-.72*u,-.2*u,-.72*u);
  ctx.bezierCurveTo(-.14*u,-.68*u,-.06*u,-.7*u,0,-.69*u);
  ctx.bezierCurveTo(.06*u,-.7*u,.14*u,-.68*u,.2*u,-.72*u);
  ctx.bezierCurveTo(.32*u,-.72*u,.4*u,-.84*u,.32*u,-.98*u);
  ctx.closePath();
  ctx.fillStyle='#22202f';ctx.fill();ctx.lineWidth=w*1.15;ctx.strokeStyle=INK;ctx.stroke();

  // หมวกแก๊ปสีขาวใส่หันหลัง (White Baseball Cap Snapback)
  ctx.beginPath();
  ctx.arc(0,-1.05*u,.31*u,Math.PI*.92,Math.PI*2.08,false);
  ctx.bezierCurveTo(.34*u,-.96*u,.32*u,-.88*u,.25*u,-.86*u);
  ctx.bezierCurveTo(.18*u,-.96*u,-.18*u,-.96*u,-.25*u,-.86*u);
  ctx.bezierCurveTo(-.32*u,-.88*u,-.34*u,-.96*u,-.31*u,-1.05*u);
  ctx.closePath();
  ctx.fillStyle='#f8f8fb';ctx.fill();ctx.lineWidth=w*1.2;ctx.strokeStyle=INK;ctx.stroke();

  // ช่องเว้าปรับสายหมวกด้านหลัง (Snapback Arch Cutout)
  ctx.beginPath();ctx.moveTo(-.16*u,-.88*u);ctx.quadraticCurveTo(0,-1.02*u,.16*u,-.88*u);ctx.closePath();
  ctx.fillStyle='#22202f';ctx.fill();ctx.lineWidth=w*.9;ctx.strokeStyle=INK;ctx.stroke();

  // สายปรับระดับแนวนอน (Adjuster Strap)
  RR(-.14*u,-.91*u,.28*u,.05*u,.02*u,'#2e2c3e',w*.7);

  // กระดุมบนยอดหมวก (Cap Top Button)
  E(0,-1.37*u,.055*u,.035*u,'#22202f',w*.9);

  // ขอบหน้าห่วงยางพาดทับสะโพก
  ctx.beginPath();ctx.ellipse(0,tubeY+.1*u,.75*u,.26*u,0,.15,Math.PI-.15);ctx.lineWidth=w*1.25;ctx.strokeStyle=INK;ctx.stroke();

  ctx.restore();
}

function drawRope(pd,pt,T){
  const a=clamp(T/160,0,1),mx=(pd.x+pt.x)/2,my=(pd.y+pt.y)/2+(1-a)*.35*(pd.s+pt.s)/2,w=Math.max(2,.07*pt.s);
  ctx.lineCap='round';
  for(const[c,k]of[[INK,2.3],['#fff3a0',1]]){ctx.strokeStyle=c;ctx.lineWidth=w*k;ctx.beginPath();ctx.moveTo(pd.x,pd.y-.3*pd.s);ctx.quadraticCurveTo(mx,my-.4*pt.s,pt.x,pt.y-.45*pt.s);ctx.stroke()}
}
function foot(o,z,pl){
  if(o.isKnockedOut)return;
  const a=P(o.x-o.hw,z+o.hd),b=P(o.x+o.hw,z+o.hd),c=P(o.x+o.hw,z-o.hd),d=P(o.x-o.hw,z-o.hd);
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.closePath();
  ctx.fillStyle=`rgba(255,45,85,${.22+.14*pl})`;ctx.fill();ctx.strokeStyle='#ff2d55';ctx.lineWidth=2;ctx.stroke();
}

/* สิ่งกีดขวาง & NPC (Arcade Chibi Style) */
function drawObs(o,z){
  const p=P(o.x,z,o.y||0),u=p.s,w=o.hw*u,l=lw(u),pl=.5+.5*Math.sin(S.t*7),T=S.t;if(p.d<1)return;
  foot(o,z,pl);ctx.save();ctx.translate(p.x,p.y);ctx.lineCap='round';ctx.lineJoin='round';
  if(o.isKnockedOut && o.rot) ctx.rotate(o.rot);
  if(o.type==='log'||o.type==='wide'){
    const hh=o.type==='wide'?.66:.58,H2=hh*u/2,n=o.type==='wide'?5:1;
    ctx.translate(0,Math.sin(T*3+o.x*2)*.03*u);ctx.rotate(Math.sin(T*2.4+o.x)*.025);
    RR(-w,-hh*u,2*w,hh*u,H2,'#c8641a',l);
    ctx.fillStyle='#ff9a3c';ctx.beginPath();ctx.roundRect(-w+.18*u,-hh*u+.06*u,2*w-.36*u,hh*u*.3,.08*u);ctx.fill();
    ctx.strokeStyle='#7a3a0e';ctx.lineWidth=l*.6;ctx.beginPath();for(const y of[.5,.75]){ctx.moveTo(-w+.3*u,-hh*u*y);ctx.lineTo(w-.3*u,-hh*u*y)}ctx.stroke();
    ctx.fillStyle='#ffd23f';ctx.fillRect(-w+.4*u,-hh*u,.1*u,hh*u);ctx.fillRect(w-.5*u,-hh*u,.1*u,hh*u);
    for(const sx of[-1,1]){const ex=sx*(w-.12*u);E(ex,-hh*u/2,.13*u,H2,'#ffd58a',l*.7);E(ex,-hh*u/2,.08*u,H2*.62,'#e0902e',l*.4);ctx.fillStyle='#8a4210';circ(ex,-hh*u/2,.03*u)}
    for(const[c,k]of[[INK,2.3],['#ff2f92',1.3]]){ctx.strokeStyle=c;ctx.lineWidth=l*k;ctx.beginPath();for(let i=0;i<n;i++){const cx=(i-(n-1)/2)*1.3*u;ctx.moveTo(cx-.18*u,-.15*u);ctx.lineTo(cx,-.38*u);ctx.lineTo(cx+.18*u,-.15*u)}ctx.stroke()}
  }else if(o.type==='rowboat'){
    // เรือพายและชาวบ้านสไตล์จิบิ
    ctx.translate(0,Math.sin(T*4+o.x)*.04*u);ctx.rotate(Math.sin(T*3+o.x)*.06);
    // คลื่นแหวกน้ำรอบเรือ
    ctx.fillStyle='rgba(255,255,255,.45)';ell(0,0,.92*u,.22*u);
    TRI([[-.85*u,-.42*u],[.85*u,-.42*u],[.6*u,-.02*u],[-.6*u,-.02*u]],'#8a4b1c',l);
    ctx.fillStyle='#ffd166';ctx.fillRect(-.7*u,-.34*u,1.4*u,.09*u);
    // พายเรือพร้อมหยดน้ำ
    const padRot=Math.sin(T*4);
    ctx.strokeStyle=INK;ctx.lineWidth=l*1.4;ctx.beginPath();ctx.moveTo(-.75*u,-.15*u+padRot*.15*u);ctx.lineTo(-.25*u,-.6*u);ctx.stroke();
    // หยดน้ำจากปลายพาย
    ctx.fillStyle='rgba(255,255,255,.8)';circ(-.78*u,-.15*u+padRot*.15*u,.06*u);
    // ตัวคนพาย
    ctx.translate(Math.sin(T*4)*.04*u,0);RR(-.22*u,-.78*u,.44*u,.4*u,.1*u,'#ffffff',l);
    E(-.22*u,-.92*u,.06*u,.07*u,'#ffcf9e',l*.7);E(.22*u,-.92*u,.06*u,.07*u,'#ffcf9e',l*.7);
    E(0,-.9*u,.18*u,.16*u,'#232130',l*.8);
    // งอบใบลานสาน (Woven Straw Hat)
    TRI([[-.38*u,-.94*u],[.38*u,-.94*u],[0,-1.24*u]],'#ffd166',l*.9);
  }else if(o.type==='horse'){
    // คนขี่ม้าและม้าวิ่งลุยน้ำ (Horse & Rider ตามรูปต้นแบบ Reference Image เป๊ะ)
    const d=o.dir||1,gl=o.st==='go';
    const phase=S.t*(gl?15:5);
    const bobY=Math.abs(Math.sin(phase))*(gl?.12:.03)*u;
    const pitch=Math.sin(phase)*(gl?.06:.02);

    ctx.save();
    ctx.scale(d,1); // หันหน้าตามทิศทางการวิ่ง
    ctx.translate(0,-bobY);
    ctx.rotate(pitch);

    // 1. คลื่นและระลอกฟองน้ำรอบขาม้า (Water ripples around hooves)
    ctx.fillStyle='rgba(255,255,255,.55)';
    ell(0,-.02*u,.95*u,.24*u);

    // ฟังก์ชันวาดขาม้า 4 ขา พร้อมข้อเท้าขาวและกีบดำ (Articulated Legs with White Socks & Black Hooves)
    const rLeg1=Math.sin(phase);
    const rLeg2=Math.sin(phase+1.2);
    const fLeg1=Math.sin(phase+2.0);
    const fLeg2=Math.sin(phase+3.2);

    const drawLeg=(ox,legSwing,isFar)=>{
      const col=isFar?'#844420':'#a3562a';
      const sockCol=isFar?'#e2ded6':'#fcfaf4';
      const hoofCol=isFar?'#181a20':'#222630';
      const kneeX=ox+legSwing*.16*u;
      const footX=kneeX+legSwing*.1*u;
      // ท่อนขาบน
      ctx.strokeStyle=col;ctx.lineWidth=.15*u;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(ox,-.55*u);ctx.lineTo(kneeX,-.28*u);ctx.stroke();
      // ข้อเท้าสีขาว (White sock)
      ctx.strokeStyle=sockCol;ctx.lineWidth=.13*u;
      ctx.beginPath();ctx.moveTo(kneeX,-.28*u);ctx.lineTo(footX,-.08*u);ctx.stroke();
      // กีบเท้าม้าสีดำโค้งมน (Black rounded hoof)
      RR(footX-.08*u,-.08*u,.16*u,.09*u,.03*u,hoofCol,0);
    };

    // วาดขาไกล 2 ข้างก่อน (Far rear and front legs)
    drawLeg(-.42*u,rLeg2,true);
    drawLeg(.38*u,fLeg2,true);

    // 2. พวงหางม้าสีดำหนาพลิ้วไหวตามแรงวิ่ง (Flowing Dark Tail)
    const tailSwing=Math.sin(phase-.5)*.2;
    ctx.save();
    ctx.translate(-.6*u,-.65*u);
    ctx.rotate(-.3+tailSwing);
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.bezierCurveTo(-.25*u,.2*u,-.4*u,.6*u,-.15*u,.85*u);
    ctx.bezierCurveTo(-.05*u,.7*u,.05*u,.5*u,.1*u,.2*u);
    ctx.closePath();
    ctx.fillStyle='#241e1c';ctx.fill();
    ctx.lineWidth=l*.8;ctx.strokeStyle=INK;ctx.stroke();
    ctx.restore();

    // 3. ลำตัวม้าสีน้ำตาลเกาลัด (Warm Chestnut Body)
    ctx.beginPath();
    ctx.ellipse(-.05*u,-.68*u,.58*u,.38*u,-.04,0,Math.PI*2);
    ctx.fillStyle='#a3562a';ctx.fill();
    ctx.lineWidth=l*1.1;ctx.strokeStyle=INK;ctx.stroke();

    // วาดขาใกล้ 2 ข้างด้านหน้าลำตัว (Near rear and front legs)
    drawLeg(-.35*u,rLeg1,false);
    drawLeg(.44*u,fLeg1,false);

    // 4. ผ้าปูอานม้าสีขาวและอานม้าหนังสีน้ำตาลเข้ม (Saddle Pad & Saddle)
    RR(-.26*u,-.84*u,.44*u,.36*u,.08*u,'#fbf8f2',l*.8);
    RR(-.22*u,-.88*u,.36*u,.22*u,.06*u,'#4a2f1c',l*.8);
    ctx.fillStyle='#2c1e14';ctx.fillRect(-.08*u,-.48*u,.06*u,.2*u); // สายรัดทึบ

    // 5. คอม้าและแผงคอสีดำหยักลอน (Neck & Mane)
    ctx.beginPath();
    ctx.moveTo(.2*u,-.82*u);
    ctx.lineTo(.52*u,-1.36*u);
    ctx.lineTo(.72*u,-1.22*u);
    ctx.lineTo(.46*u,-.65*u);
    ctx.closePath();
    ctx.fillStyle='#a3562a';ctx.fill();
    ctx.lineWidth=l;ctx.strokeStyle=INK;ctx.stroke();

    // แผงคอม้าสีดำเป็นลอน (Scalloped Dark Mane)
    for(let m=0;m<4;m++){
      const mx=.22*u+m*.09*u,my=-.92*u-m*.13*u;
      circ(mx,my,.11*u);
    }
    ctx.fillStyle='#26201e';ctx.fill();

    // 6. หัวม้า จมูกขาว และตากลมโต (Horse Head, White Muzzle & Eye)
    ctx.beginPath();
    ctx.ellipse(.66*u,-1.28*u,.26*u,.18*u,.5,0,Math.PI*2);
    ctx.fillStyle='#a3562a';ctx.fill();
    ctx.lineWidth=l;ctx.strokeStyle=INK;ctx.stroke();

    // ปลายจมูกสีครีมขาวมน (White Muzzle)
    ctx.beginPath();
    ctx.ellipse(.82*u,-1.18*u,.12*u,.11*u,.4,0,Math.PI*2);
    ctx.fillStyle='#f6eee8';ctx.fill();
    ctx.lineWidth=l*.8;ctx.strokeStyle=INK;ctx.stroke();
    ctx.fillStyle='#222';circ(.86*u,-1.19*u,.026*u); // รูจมูก

    // หูม้าตั้งชัน (Alert Ear)
    TRI([[.54*u,-1.4*u],[.66*u,-1.62*u],[.68*u,-1.38*u]],'#a3562a',l*.8);
    TRI([[.58*u,-1.42*u],[.65*u,-1.56*u],[.66*u,-1.41*u]],'#6c3616',0);

    // ตากลมโตน่ารัก
    ctx.fillStyle='#1c1c22';circ(.64*u,-1.34*u,.045*u);
    ctx.fillStyle='#ffffff';circ(.65*u,-1.355*u,.016*u);

    // สายบังเหียน (Bridle, Bit & Reins)
    ctx.strokeStyle='#2b201a';ctx.lineWidth=l*.9;
    ctx.beginPath();ctx.moveTo(.56*u,-1.42*u);ctx.lineTo(.74*u,-1.22*u);ctx.stroke();
    ctx.beginPath();ctx.moveTo(.7*u,-1.12*u);ctx.lineTo(.78*u,-1.26*u);ctx.stroke();
    circ(.74*u,-1.22*u,.035*u); // ห่วงเหล็กบังเหียน
    ctx.beginPath();
    ctx.moveTo(.74*u,-1.22*u);
    ctx.quadraticCurveTo(.42*u,-1.12*u,.14*u,-1.04*u);
    ctx.stroke();

    // 7. คนขี่ม้าสไตล์จิบิ (Chibi Rider: White Shirt, Dark Pants & Black Helmet)
    // ขาคนขี่และรองเท้าบู้ตยาวในโกลน
    ctx.strokeStyle='#222632';ctx.lineWidth=.15*u;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(-.06*u,-.92*u);ctx.lineTo(.04*u,-.68*u);ctx.lineTo(.02*u,-.48*u);ctx.stroke();
    ctx.strokeStyle='#64748b';ctx.lineWidth=l*.8;
    ctx.strokeRect(-.04*u,-.47*u,.12*u,.08*u); // โกลนเหล็ก

    // เสื้อเชิ้ตขี่ม้าสีขาว (White Riding Shirt)
    RR(-.16*u,-1.26*u,.32*u,.36*u,.08*u,'#ffffff',l);
    ctx.strokeStyle='#ffffff';ctx.lineWidth=.11*u;
    ctx.beginPath();ctx.moveTo(-.02*u,-1.2*u);ctx.lineTo(.12*u,-1.05*u);ctx.stroke();
    ctx.fillStyle='#ffb48e';circ(.14*u,-1.04*u,.045*u); // มือจับสายบังเหียน

    // ใบหน้าคนขี่ม้าสไตล์จิบิ (Peach skin head)
    E(.02*u,-1.4*u,.16*u,.15*u,'#ffb48e',l*.7);

    // หมวกขี่ม้าสีดำพร้อมปีกหมวกหน้า (Black Riding Helmet & Visor)
    ctx.beginPath();
    ctx.ellipse(0,-1.54*u,.22*u,.2*u,-.1,Math.PI*.8,Math.PI*2.2);
    ctx.lineTo(.24*u,-1.46*u); // ปีกหมวกยื่นไปด้านหน้า
    ctx.lineTo(.12*u,-1.43*u);
    ctx.closePath();
    ctx.fillStyle='#1c202a';ctx.fill();
    ctx.lineWidth=l*1.1;ctx.strokeStyle=INK;ctx.stroke();

    ctx.restore();

    // เครื่องหมายตกใจเตือนเมื่อกำลังรอข้ามถนน
    if(o.st==='wait'){
      const yy=-2.3*u-Math.abs(Math.sin(T*8))*.15*u;
      TRI([[-.26*u,yy-.45*u],[.26*u,yy-.45*u],[0,yy]],'#ff2d55',l);
      TRI([[d*.4*u,yy-.65*u],[d*.9*u,yy-.42*u],[d*.4*u,yy-.2*u]],'#ff2d55',l);
      ctx.fillStyle='#fff';ctx.font=`700 ${.38*u}px Mali,sans-serif`;ctx.textAlign='center';ctx.fillText('!',0,yy-.55*u);
    }
  }else if(o.type==='speedboat'){
    // เรือสปีดโบ๊ท (Speedboat ตามรูปต้นแบบ Reference Image เป๊ะ)
    ctx.translate(0,-Math.abs(Math.sin(T*12))*.06*u);
    ctx.rotate(Math.sin(T*10)*.03);
    
    // 1. คลื่นโฟมขาวแหวกน้ำกระจายท้ายเรือและข้างลำเรือ (Prominent Water Wake & Foamy Spray)
    const wakeW=1.35*u+Math.sin(T*15)*.1*u;
    ctx.fillStyle='rgba(255,255,255,.55)';
    ell(0,.05*u,wakeW,.26*u);
    for(let side of[-1,1]){
      ctx.fillStyle='rgba(220,245,255,.7)';
      ell(side*.85*u,-.2*u,.4*u,.16*u);
    }

    // 2. ท้องเรือด้านล่างสีดำ/น้ำเงินเข้ม (Deep V-Keel & Underside)
    ctx.beginPath();
    ctx.moveTo(0,.08*u);
    ctx.lineTo(-.78*u,-.36*u);
    ctx.lineTo(.78*u,-.36*u);
    ctx.closePath();
    ctx.fillStyle='#181c2b';ctx.fill();
    ctx.lineWidth=l*1.2;ctx.strokeStyle=INK;ctx.stroke();

    // สันกระดูกงูตรงกลางท้องเรือ
    ctx.beginPath();
    ctx.moveTo(0,.08*u);
    ctx.lineTo(0,-.55*u);
    ctx.lineWidth=l*1.4;ctx.strokeStyle='#141226';ctx.stroke();

    // 3. ตัวลำเรือสีขาวทรง V-Hull ปีกกว้าง (White Aerodynamic Hull)
    ctx.beginPath();
    ctx.moveTo(0,-.02*u);
    ctx.bezierCurveTo(-.4*u,-.15*u,-.85*u,-.4*u,-.92*u,-.56*u);
    ctx.bezierCurveTo(-.88*u,-.76*u,-.4*u,-.88*u,0,-.88*u);
    ctx.bezierCurveTo(.4*u,-.88*u,.88*u,-.76*u,.92*u,-.56*u);
    ctx.bezierCurveTo(.85*u,-.4*u,.4*u,-.15*u,0,-.02*u);
    ctx.closePath();
    ctx.fillStyle='#ffffff';ctx.fill();
    ctx.lineWidth=l*1.3;ctx.strokeStyle=INK;ctx.stroke();

    // 4. แถบสีฟ้าสดคาดขอบกราบเรือ (Bright Cyan-Blue Racing Stripe)
    ctx.beginPath();
    ctx.moveTo(0,-.18*u);
    ctx.bezierCurveTo(-.4*u,-.26*u,-.85*u,-.44*u,-.9*u,-.58*u);
    ctx.lineTo(-.86*u,-.68*u);
    ctx.bezierCurveTo(-.4*u,-.48*u,-.2*u,-.38*u,0,-.35*u);
    ctx.bezierCurveTo(.2*u,-.38*u,.4*u,-.48*u,.86*u,-.68*u);
    ctx.lineTo(.9*u,-.58*u);
    ctx.bezierCurveTo(.85*u,-.44*u,.4*u,-.26*u,0,-.18*u);
    ctx.closePath();
    ctx.fillStyle='#0096ff';ctx.fill();
    ctx.lineWidth=l*.9;ctx.strokeStyle=INK;ctx.stroke();

    // สันไฮไลท์สีขาวทรงเม็ดยาบนแถบสีฟ้ากราบขวา
    ctx.beginPath();
    ctx.ellipse(.52*u,-.46*u,.16*u,.045*u,-.2,0,7);
    ctx.fillStyle='#ffffff';ctx.fill();

    // 5. ช่องตะแกรงระบายอากาศ 3 แถบดำบนดาดฟ้าหน้า (Foredeck Grille Slats)
    ctx.fillStyle='#202432';
    RR(-.18*u,-.58*u,.36*u,.035*u,.015*u,'#202432',0);
    RR(-.13*u,-.53*u,.26*u,.032*u,.015*u,'#202432',0);
    RR(-.08*u,-.48*u,.16*u,.03*u,.015*u,'#202432',0);

    // 6. กระจกหน้าห้องคนขับทรงสปอร์ตโค้งมน 2 บาน (Sporty Tinted Blue Windshield)
    // บานซ้าย
    ctx.beginPath();
    ctx.moveTo(-.04*u,-.66*u);
    ctx.lineTo(-.68*u,-.68*u);
    ctx.bezierCurveTo(-.65*u,-.86*u,-.38*u,-.98*u,-.04*u,-.98*u);
    ctx.closePath();
    ctx.fillStyle='#4ec5ff';ctx.fill();
    ctx.lineWidth=l*1.1;ctx.strokeStyle=INK;ctx.stroke();

    ctx.save();ctx.clip();
    ctx.beginPath();ctx.ellipse(-.36*u,-.84*u,.22*u,.06*u,.6,0,7);ctx.fillStyle='rgba(255,255,255,.85)';ctx.fill();
    ctx.restore();

    // บานขวา
    ctx.beginPath();
    ctx.moveTo(.04*u,-.66*u);
    ctx.lineTo(.68*u,-.68*u);
    ctx.bezierCurveTo(.65*u,-.86*u,.38*u,-.98*u,.04*u,-.98*u);
    ctx.closePath();
    ctx.fillStyle='#4ec5ff';ctx.fill();
    ctx.lineWidth=l*1.1;ctx.strokeStyle=INK;ctx.stroke();

    ctx.save();ctx.clip();
    ctx.beginPath();ctx.ellipse(.36*u,-.84*u,.22*u,.06*u,.6,0,7);ctx.fillStyle='rgba(255,255,255,.85)';ctx.fill();
    ctx.restore();

    // 7. หลังคาห้องโดยสารสีเข้มและพนักพิงเบาะสีฟ้า 2 ตัว (Dark Roof & Twin Blue Seats)
    ctx.beginPath();
    ctx.ellipse(0,-.96*u,.46*u,.16*u,0,0,7);
    ctx.fillStyle='#2b3040';ctx.fill();ctx.lineWidth=l;ctx.strokeStyle=INK;ctx.stroke();

    // เบาะซ้าย
    E(-.24*u,-1.14*u,.19*u,.15*u,'#0084ff',l);
    E(-.24*u,-1.18*u,.12*u,.09*u,'#0060c0',0);
    // เบาะขวา
    E(.24*u,-1.14*u,.19*u,.15*u,'#0084ff',l);
    E(.24*u,-1.18*u,.12*u,.09*u,'#0060c0',0);

    // 8. เสาธงชาติไทยด้านหลังคาบนสุด (Thai Flag on Mast)
    ctx.beginPath();
    ctx.moveTo(0,-.96*u);ctx.lineTo(0,-1.5*u);
    ctx.lineWidth=l*1.3;ctx.strokeStyle='#141226';ctx.stroke();
    circ(0,-1.5*u,.045*u);
    
    // ผืนธงไตรรงค์
    const flW=.38*u,flH=.24*u,flX=0,flY=-1.48*u;
    const stripeH=flH/5;
    ctx.fillStyle='#ee1c25';ctx.fillRect(flX,flY,flW,stripeH);
    ctx.fillStyle='#ffffff';ctx.fillRect(flX,flY+stripeH,flW,stripeH);
    ctx.fillStyle='#242858';ctx.fillRect(flX,flY+stripeH*2,flW,stripeH);
    ctx.fillStyle='#ffffff';ctx.fillRect(flX,flY+stripeH*3,flW,stripeH);
    ctx.fillStyle='#ee1c25';ctx.fillRect(flX,flY+stripeH*4,flW,stripeH);
    ctx.lineWidth=Math.max(1,l*.7);ctx.strokeStyle=INK;ctx.strokeRect(flX,flY,flW,flH);
  }else if(o.type==='tuktuk'){
    // รถตุ๊กๆ ซิ่งจี๊ด (Thai Tuk-Tuk ตามรูปต้นแบบ Reference Image เป๊ะ)
    const jumpY = o.jumpY || 0;
    const bodyY = -jumpY * u;
    
    // 1. เงาและระลอกคลื่นน้ำบนผิวน้ำ (Water Shadow stays anchored on water surface even when jumping)
    const shadowScale = clamp(1 - jumpY * 0.15, 0.45, 1);
    ctx.fillStyle = `rgba(10,20,50,${0.38 * shadowScale})`;
    ell(0, 0, 0.88 * u * shadowScale, 0.28 * u * shadowScale);
    
    if(jumpY <= 0.05){
      // คลื่นโฟมน้ำแหวกข้างล้อซ้าย-ขวา
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ell(-.45 * u, .05 * u, .42 * u, .16 * u);
      ell(.45 * u, .05 * u, .42 * u, .16 * u);
    }
    
    ctx.save();
    ctx.translate(0, bodyY);
    
    // สั่นสะเทือนเครื่องยนต์สองจังหวะเล็กน้อย (Two-stroke engine vibration)
    const vib = jumpY <= 0.05 ? Math.sin(T * 40) * 0.012 * u : 0;
    ctx.translate(0, vib);
    
    // 2. ล้อหลัง 2 ข้าง (Chunky Rear Tires with Tread)
    // ล้อซ้าย
    RR(-.58 * u, -.42 * u, .22 * u, .44 * u, .06 * u, '#18171f', l * 1.1);
    ctx.strokeStyle = '#2d2b38'; ctx.lineWidth = l * 0.5;
    ctx.beginPath();
    ctx.moveTo(-.47 * u, -.36 * u); ctx.lineTo(-.47 * u, -.04 * u);
    ctx.moveTo(-.52 * u, -.32 * u); ctx.lineTo(-.52 * u, -.08 * u);
    ctx.moveTo(-.42 * u, -.32 * u); ctx.lineTo(-.42 * u, -.08 * u);
    ctx.stroke();
    
    // ล้อขวา
    RR(.36 * u, -.42 * u, .22 * u, .44 * u, .06 * u, '#18171f', l * 1.1);
    ctx.beginPath();
    ctx.moveTo(.47 * u, -.36 * u); ctx.lineTo(.47 * u, -.04 * u);
    ctx.moveTo(.42 * u, -.32 * u); ctx.lineTo(.42 * u, -.08 * u);
    ctx.moveTo(.52 * u, -.32 * u); ctx.lineTo(.52 * u, -.08 * u);
    ctx.stroke();
    
    // ท่อไอเสียคู่ใต้ท้องรถ (Dual Exhaust Pipes)
    ctx.fillStyle = '#475569';
    circ(-.22 * u, -.16 * u, .065 * u);
    circ(.22 * u, -.16 * u, .065 * u);
    ctx.fillStyle = '#0f172a';
    circ(-.22 * u, -.16 * u, .035 * u);
    circ(.22 * u, -.16 * u, .035 * u);
    
    // 3. กันชนหลังสีเหลืองทอง (Yellow Rear Bumper)
    RR(-.62 * u, -.2 * u, 1.24 * u, .09 * u, .035 * u, '#fbbf24', l * 0.9);
    
    // 4. ตัวถังส่วนท้ายรถตุ๊กๆ สีน้ำเงินสดใส (Vibrant Royal Blue Tuk-Tuk Body)
    RR(-.56 * u, -.82 * u, 1.12 * u, .64 * u, .12 * u, '#1259db', l * 1.2);
    // แถบคาดสีเหลืองและเส้นลายซิ่งสีแดง (Yellow & Red Racing Accent Bands)
    ctx.fillStyle = '#fbbf24'; ctx.fillRect(-.53 * u, -.48 * u, 1.06 * u, .05 * u);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(-.42 * u, -.52 * u, .84 * u, .025 * u);
    // แถบฟ้าอ่อนล่าง
    ctx.fillStyle = '#38bdf8'; ctx.fillRect(-.53 * u, -.35 * u, 1.06 * u, .05 * u);
    
    // 5. ไฟท้ายคู่ ซ้าย-ขวา (Dual Rear Taillights: Amber Top, Red Bottom)
    // ไฟซ้าย
    RR(-.53 * u, -.74 * u, .14 * u, .24 * u, .04 * u, '#18181b', l * 0.8);
    RR(-.51 * u, -.72 * u, .10 * u, .09 * u, .025 * u, '#f59e0b', 0);
    RR(-.51 * u, -.61 * u, .10 * u, .10 * u, .025 * u, '#dc2626', 0);
    // ไฟขวา
    RR(.39 * u, -.74 * u, .14 * u, .24 * u, .04 * u, '#18181b', l * 0.8);
    RR(.41 * u, -.72 * u, .10 * u, .09 * u, .025 * u, '#f59e0b', 0);
    RR(.41 * u, -.61 * u, .10 * u, .10 * u, .025 * u, '#dc2626', 0);
    
    // 6. ป้ายทะเบียนสีเหลืองเด่นใจกลางรถ "ซิ่งจี๊ด..." (Yellow License Plate)
    RR(-.32 * u, -.77 * u, .64 * u, .28 * u, .05 * u, '#facc15', l * 1.1);
    ctx.strokeStyle = '#854d0e'; ctx.lineWidth = l * 0.45;
    ctx.strokeRect(-.29 * u, -.74 * u, .58 * u, .22 * u);
    ctx.fillStyle = '#18181b';
    ctx.font = `900 ${.13 * u}px Mali, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('• ซิ่งจี๊ด... •', 0, -.58 * u);
    
    // 7. พนักพิงเบาะและราวจับโครเมียมสแตนเลส (Chrome Railing & Passenger Seat)
    RR(-.5 * u, -.98 * u, 1.0 * u, .18 * u, .06 * u, '#e2e8f0', l * 1.1);
    RR(-.44 * u, -.94 * u, .88 * u, .11 * u, .035 * u, '#1e293b', l * 0.7);
    // ราวจับโค้งด้านหลัง
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = l * 1.3;
    ctx.beginPath();
    ctx.moveTo(-.48 * u, -.97 * u); ctx.lineTo(.48 * u, -.97 * u);
    ctx.stroke();
    
    // 8. เสาค้ำหลังคาโครเมียม ซ้าย-ขวา (Chrome Roof Pillars)
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = l * 1.4;
    ctx.beginPath();
    ctx.moveTo(-.52 * u, -.98 * u); ctx.lineTo(-.52 * u, -1.45 * u);
    ctx.moveTo(.52 * u, -.98 * u); ctx.lineTo(.52 * u, -1.45 * u);
    ctx.stroke();
    
    // 9. หลังคาและแผงลำโพงซับวูฟเฟอร์ (Black Canopy Ceiling & Triple Subwoofers)
    // โครงหลังคาโค้งสีดำ
    ctx.beginPath();
    ctx.moveTo(-.62 * u, -1.42 * u);
    ctx.quadraticCurveTo(0, -1.68 * u, .62 * u, -1.42 * u);
    ctx.lineTo(.58 * u, -1.18 * u);
    ctx.quadraticCurveTo(0, -1.35 * u, -.58 * u, -1.18 * u);
    ctx.closePath();
    ctx.fillStyle = '#1e1e24'; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = l * 1.1; ctx.stroke();
    
    // ลำโพงซับวูฟเฟอร์ 3 ตัวใต้หลังคา (Triple Sound System Subwoofers)
    // ลำโพงซ้าย
    circ(-.28 * u, -1.38 * u, .15 * u);
    ctx.fillStyle = '#0f172a'; ctx.fill();
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = l * 0.8; ctx.stroke();
    ctx.fillStyle = '#f59e0b'; circ(-.28 * u, -1.38 * u, .04 * u);
    
    // ลำโพงขวา
    circ(.28 * u, -1.38 * u, .15 * u);
    ctx.fillStyle = '#0f172a'; ctx.fill();
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = l * 0.8; ctx.stroke();
    ctx.fillStyle = '#f59e0b'; circ(.28 * u, -1.38 * u, .04 * u);
    
    // ทวีตเตอร์เสียงแหลมตรงกลาง
    circ(0, -1.39 * u, .09 * u);
    ctx.fillStyle = '#0f172a'; ctx.fill();
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = l * 0.7; ctx.stroke();
    ctx.fillStyle = '#f59e0b'; circ(0, -1.39 * u, .025 * u);
    
    // 10. พวงมาลัยดอกดาวเรือง ดอกมะลิ และพู่แดงห้อยระย้า (Marigold Garland & Tassels)
    // ฟังก์ชันวาดดอกดาวเรืองสีเหลืองส้ม
    function flower(fx, fy, fr){
      ctx.fillStyle = '#fbbf24';
      for(let a = 0; a < 5; a++){
        const ang = a * Math.PI * 0.4;
        circ(fx + Math.cos(ang) * fr * 0.65, fy + Math.sin(ang) * fr * 0.65, fr * 0.55);
      }
      ctx.fillStyle = '#f59e0b';
      circ(fx, fy, fr * 0.5);
    }
    
    // พวงมาลัยพาดใต้หลังคาโค้ง
    const fRadius = .045 * u;
    for(let f = -5; f <= 5; f++){
      const fx = (f / 5) * .42 * u;
      const fy = -1.23 * u + (Math.abs(f) / 5) * .05 * u;
      flower(fx, fy, fRadius);
    }
    
    // พวงมาลัยห้อยตามเสาซ้าย
    for(let k = 0; k < 6; k++){
      const fy = -1.4 * u + k * .09 * u;
      flower(-.54 * u, fy, fRadius * 1.05);
    }
    // ดอกมะลิขาวและพู่แดงเสาซ้าย
    ctx.fillStyle = '#f8fafc';
    circ(-.54 * u, -.84 * u, .04 * u);
    circ(-.54 * u, -.79 * u, .035 * u);
    TRI([[-.58*u, -.76*u], [-.50*u, -.76*u], [-.54*u, -.68*u]], '#dc2626', l*0.5);
    TRI([[-.62*u, -.75*u], [-.54*u, -.75*u], [-.58*u, -.67*u]], '#dc2626', l*0.5);
    
    // พวงมาลัยห้อยตามเสาขวา
    for(let k = 0; k < 6; k++){
      const fy = -1.4 * u + k * .09 * u;
      flower(.54 * u, fy, fRadius * 1.05);
    }
    // ดอกมะลิขาวและพู่แดงเสาขวา
    ctx.fillStyle = '#f8fafc';
    circ(.54 * u, -.84 * u, .04 * u);
    circ(.54 * u, -.79 * u, .035 * u);
    TRI([[.50*u, -.76*u], [.58*u, -.76*u], [.54*u, -.68*u]], '#dc2626', l*0.5);
    TRI([[.54*u, -.75*u], [.62*u, -.75*u], [.58*u, -.67*u]], '#dc2626', l*0.5);
    
    // 11. หลังคาดำด้านบนสุดและป้ายไฟแท็กซี่สีส้ม (Outer Black Roof & Amber Roof Light)
    ctx.beginPath();
    ctx.moveTo(-.65 * u, -1.44 * u);
    ctx.quadraticCurveTo(0, -1.74 * u, .65 * u, -1.44 * u);
    ctx.quadraticCurveTo(0, -1.64 * u, -.65 * u, -1.44 * u);
    ctx.fillStyle = '#09090b'; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = l * 1.2; ctx.stroke();
    
    // ป้ายไฟสีส้มโค้งมนบนหลังคา (TAXI / Amber Roof Light)
    RR(-.14 * u, -1.74 * u, .28 * u, .085 * u, .035 * u, '#f59e0b', l * 0.8);
    ctx.fillStyle = '#fbbf24';
    RR(-.11 * u, -1.72 * u, .22 * u, .05 * u, .02 * u, '#fde047', 0);
    
    ctx.restore();
  }else if(o.type==='taxi'){
    // รถแท็กซี่เขียว-เหลือง กรุงเทพมหานคร (Bangkok Taxi ตามภาพ Reference เป๊ะ)
    const jumpY = o.jumpY || 0;
    drawTaxi(0, -jumpY * u, u, o, jumpY);
  }
  ctx.restore();
  if(dbg)dbgBox(o,z);
}

/* วาดรถแท็กซี่เขียว-เหลือง กรุงเทพมหานคร (Bangkok Taxi ตามภาพ Reference IMG_1187.png เป๊ะ 100%) */
function drawTaxi(x, y, u, o, jy=0){
  const l=lw(u);
  ctx.save();
  ctx.translate(x, y);

  // 1. เงาและระลอกคลื่นน้ำ
  const shadowScale = clamp(1 - jy * 0.15, 0.45, 1);
  ctx.fillStyle = `rgba(10,20,50,${0.4 * shadowScale})`;
  ell(0, 0.08 * u, 1.15 * u * shadowScale, 0.36 * u * shadowScale);

  if(jy <= 0.05){
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ell(-.55 * u, .1 * u, .48 * u, .18 * u);
    ell(.55 * u, .1 * u, .48 * u, .18 * u);
  }

  // ล้อหลัง 2 ข้างพร้อมดอกยาง V-tread ลุยน้ำ
  for(let sx of [-1, 1]){
    const lx = sx * 0.58 * u;
    RR(lx - 0.14 * u, -0.42 * u, 0.28 * u, 0.48 * u, 0.08 * u, '#18181b', l * 1.1);
    ctx.strokeStyle = '#27272a'; ctx.lineWidth = l * 0.6;
    for(let k = 0; k < 3; k++){
      const ty = -0.35 * u + k * 0.12 * u;
      ctx.beginPath();
      ctx.moveTo(lx - 0.08 * u, ty - 0.04 * u);
      ctx.lineTo(lx, ty);
      ctx.lineTo(lx + 0.08 * u, ty - 0.04 * u);
      ctx.stroke();
    }
  }

  // 2. ตัวถังส่วนล่างสีเขียวแท็กซี่ (Bangkok Taxi Green #16a34a)
  ctx.beginPath();
  ctx.roundRect(-0.85 * u, -0.92 * u, 1.7 * u, 0.76 * u, [0.12 * u, 0.12 * u, 0.22 * u, 0.22 * u]);
  ctx.fillStyle = '#16a34a'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = l * 1.2; ctx.stroke();

  // ไฮไลต์ผิวมันเงาบนกันชนเขียว
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  RR(-0.76 * u, -0.32 * u, 0.22 * u, 0.06 * u, 0.03 * u, 'rgba(255,255,255,0.22)', 0);
  RR(0.54 * u, -0.32 * u, 0.22 * u, 0.06 * u, 0.03 * u, 'rgba(255,255,255,0.22)', 0);

  // ท่อไอเสียโครเมียมด้านล่างขวา
  circ(0.48 * u, -0.22 * u, 0.11 * u);
  ctx.fillStyle = '#3f3f46'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = l * 0.9; ctx.stroke();
  circ(0.48 * u, -0.22 * u, 0.06 * u);
  ctx.fillStyle = '#18181b'; ctx.fill();

  // 3. ตัวถังส่วนบนสีเหลืองสด (Bangkok Taxi Yellow #facc15)
  ctx.beginPath();
  ctx.moveTo(-0.82 * u, -0.92 * u);
  ctx.lineTo(-0.72 * u, -1.48 * u);
  ctx.quadraticCurveTo(0, -1.68 * u, 0.72 * u, -1.48 * u);
  ctx.lineTo(0.82 * u, -0.92 * u);
  ctx.closePath();
  ctx.fillStyle = '#facc15'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = l * 1.2; ctx.stroke();

  // กระจกมองข้างสีดำ ซ้าย-ขวา
  E(-0.84 * u, -1.22 * u, 0.12 * u, 0.09 * u, '#18181b', l * 0.9);
  E(0.84 * u, -1.22 * u, 0.12 * u, 0.09 * u, '#18181b', l * 0.9);

  // 4. กระจกหลังรถยนต์สีดำตัดแสง (Tinted Rear Windshield)
  ctx.beginPath();
  ctx.moveTo(-0.62 * u, -1.02 * u);
  ctx.lineTo(-0.54 * u, -1.42 * u);
  ctx.quadraticCurveTo(0, -1.54 * u, 0.54 * u, -1.42 * u);
  ctx.lineTo(0.62 * u, -1.02 * u);
  ctx.closePath();
  ctx.fillStyle = '#1e293b'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = l * 1.0; ctx.stroke();

  // กระจกมองหลังและพนักพิงเบาะด้านในรถ
  RR(-0.1 * u, -1.46 * u, 0.2 * u, 0.06 * u, 0.02 * u, '#0f172a', 0);
  RR(-0.44 * u, -1.24 * u, 0.26 * u, 0.18 * u, 0.06 * u, '#334155', 0);
  RR(0.18 * u, -1.24 * u, 0.26 * u, 0.18 * u, 0.06 * u, '#334155', 0);

  // 5. ไฟเบรกดวงที่สามสีแดงตรงกลางฝากระโปรงท้าย
  RR(-0.15 * u, -0.98 * u, 0.3 * u, 0.07 * u, 0.03 * u, '#dc2626', l * 0.6);

  // 6. ไฟท้าย 3 สี ซ้าย-ขวา (Red, Amber, White)
  for(let sx of [-1, 1]){
    const tx = sx * 0.62 * u;
    RR(tx - 0.2 * u, -0.92 * u, 0.4 * u, 0.22 * u, 0.06 * u, '#dc2626', l * 0.8);
    ctx.fillStyle = '#f97316';
    ctx.fillRect(tx - (sx > 0 ? 0.18 : 0.02) * u, -0.9 * u, 0.12 * u, 0.1 * u);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(tx - (sx > 0 ? 0.18 : 0.02) * u, -0.79 * u, 0.12 * u, 0.07 * u);
  }

  // 7. ป้ายทะเบียนสีเหลือง "กรุงเทพมหานคร" กลางกระโปรงท้าย (Geometric Centering Fix)
  const plateX = -0.36 * u, plateY = -0.88 * u, plateW = 0.72 * u, plateH = 0.24 * u;
  RR(plateX, plateY, plateW, plateH, 0.04 * u, '#fde047', l * 0.8);
  ctx.save();
  const plateText = 'กรุงเทพมหานคร';
  ctx.font = `900 ${0.105 * u}px Mali, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const plateTextW = ctx.measureText(plateText).width;
  const plateTextX = Math.round(plateX + (plateW - plateTextW) * 0.5);
  const plateTextY = Math.round(plateY + plateH * 0.5);
  ctx.fillStyle = '#18181b';
  ctx.fillText(plateText, plateTextX, plateTextY);
  ctx.restore();

  // 8. ป้ายกล่องไฟ TAXI สีขาวโค้งมนบนหลังคา (TAXI Roof Lightbox)
  ctx.beginPath();
  ctx.roundRect(-0.34 * u, -1.82 * u, 0.68 * u, 0.22 * u, [0.08 * u, 0.08 * u, 0.04 * u, 0.04 * u]);
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = l * 1.1; ctx.stroke();
  ctx.save();
  ctx.fillStyle = '#09090b';
  ctx.font = `900 ${0.14 * u}px Mali, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const taxiText = 'TAXI';
  const taxiTextW = ctx.measureText(taxiText).width;
  ctx.fillText(taxiText, Math.round(-taxiTextW * 0.5), Math.round(-1.71 * u));
  ctx.restore();

  ctx.restore();
}

/* ผู้ประสบภัยรอความช่วยเหลือ (Victim: เด็กนักเรียนหญิง/ชาย ตะเกียกตะกายจมน้ำตามภาพ Reference) */
function drawVic(v,z,t){
  const p=P(v.x,z,v.y||0),u=p.s;if(p.d<1)return;
  // ปรับขนาดเส้นขอบโมเดล (Stroke Width) ให้เล็กลง คมชัด ละเอียดสวยงามตามคำขอของผู้ใช้
  // ลดขนาดเส้นลงอย่างประณีต คงสไตล์อาร์ตเดิมแต่เส้นบางคมชัด (Delicate & Clean Arcade Art Style)
  const vw=Math.max(0.65,Math.min(1.8,u*0.015)),subVw=Math.max(0.45,Math.min(1.1,vw*0.62)),pl=.5+.5*Math.sin(t*6);
  const isGirl=(v.gender==='girl');
  // แอนิเมชันตะเกียกตะกายขึ้นลงในน้ำ (Struggling/bobbing animation on Y-axis)
  const bobY=Math.sin(t*9+(v.ph||0))*.08*u;
  const flail=Math.sin(t*15+(v.ph||0));
  
  ctx.save();
  ctx.translate(p.x,p.y+bobY);
  if(v.isKnockedOut && v.rot) ctx.rotate(v.rot);
  ctx.lineCap='round';ctx.lineJoin='round';

  // 1. วงคลื่นน้ำกระเพื่อมระลอกเขียวช่วยชีวิต (Rescue Aura Ripple)
  ctx.fillStyle=`rgba(57,255,20,${.22+.18*pl})`;ell(0,0,(1.15+.15*pl)*u,.44*u);
  ctx.strokeStyle='#39ff14';ctx.lineWidth=Math.max(0.8,vw*0.85);ctx.beginPath();ctx.ellipse(0,0,(1.15+.15*pl)*u,.44*u,0,0,7);ctx.stroke();

  // วงคลื่นฟองน้ำสีขาวระลอกกลาง
  ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=Math.max(0.6,subVw);
  ctx.beginPath();ctx.ellipse(0,0,.8*u,.28*u,0,0,7);ctx.stroke();

  // 2. หยาดน้ำกระเซ็นและละอองน้ำรอบตัว (Water Splash Droplets)
  const drops=[
    [-.52*u,-.88*u+flail*.04*u],[-.64*u,-.68*u-flail*.04*u],
    [.52*u,-.88*u-flail*.04*u],[.64*u,-.68*u+flail*.04*u],
    [-.28*u,-1.05*u],[.28*u,-1.05*u]
  ];
  ctx.fillStyle='#38bdf8';ctx.strokeStyle='rgba(20,18,38,.4)';ctx.lineWidth=Math.max(0.4,subVw*0.7);
  for(const[dx,dy]of drops){
    ctx.beginPath();ctx.ellipse(dx,dy,.05*u,.08*u,.3,0,7);ctx.fill();ctx.stroke();
  }

  // 3. ท่อนล่างและลำตัว (เสื้อนักเรียนสีขาว + กระโปรง/กางเกง)
  if(isGirl){
    // กระโปรงนักเรียนหญิงสีดำ (Black pleated skirt)
    RR(-.26*u,-.12*u,.52*u,.16*u,.04*u,'#1e293b',vw);
  }else{
    // กางเกงขาสั้นนักเรียนชายสีดำ (Black school shorts)
    RR(-.22*u,-.12*u,.44*u,.16*u,.04*u,'#1e293b',vw);
  }
  // เสื้อเชิ้ต/เสื้อยืดนักเรียนสีขาว (White shirt)
  RR(-.22*u,-.36*u,.44*u,.32*u,.08*u,'#ffffff',vw);

  // 4. แขนชูตะเกียกตะกาย 2 ข้างพร้อมนิ้วมือกางขอความช่วยเหลือ (Flailing spread-finger hands)
  const leftHandY=-.68*u+flail*.08*u;
  const rightHandY=-.68*u-flail*.08*u;

  // แขนเสื้อขาวและแขนซ้าย
  ctx.strokeStyle='#ffffff';ctx.lineWidth=.065*u;
  ctx.beginPath();ctx.moveTo(-.14*u,-.28*u);ctx.lineTo(-.32*u,leftHandY+.12*u);ctx.stroke();
  ctx.strokeStyle=INK;ctx.lineWidth=subVw;
  ctx.beginPath();ctx.moveTo(-.16*u,-.26*u);ctx.lineTo(-.34*u,leftHandY+.1*u);ctx.stroke();

  // แขนเสื้อขาวและแขนขวา
  ctx.strokeStyle='#ffffff';ctx.lineWidth=.065*u;
  ctx.beginPath();ctx.moveTo(.14*u,-.28*u);ctx.lineTo(.32*u,rightHandY+.12*u);ctx.stroke();
  ctx.strokeStyle=INK;ctx.lineWidth=subVw;
  ctx.beginPath();ctx.moveTo(.16*u,-.26*u);ctx.lineTo(.34*u,rightHandY+.1*u);ctx.stroke();

  // ฝ่ามือกางนิ้ว 4 แฉกข้างซ้าย (Left spread hand - เส้นคมชัด เรียวเล็ก ไม่ทับเป็นก้อน)
  ctx.save();ctx.translate(-.36*u,leftHandY);
  ctx.beginPath();
  ctx.arc(0,0,.08*u,0,7);
  ctx.fillStyle='#ffb48e';ctx.fill();
  ctx.lineWidth=subVw;ctx.strokeStyle=INK;ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-.06*u,-.03*u);ctx.lineTo(-.12*u,-.15*u);
  ctx.moveTo(-.01*u,-.06*u);ctx.lineTo(-.03*u,-.18*u);
  ctx.moveTo(.04*u,-.05*u);ctx.lineTo(.07*u,-.17*u);
  ctx.moveTo(.08*u,-.01*u);ctx.lineTo(.13*u,-.11*u);
  ctx.lineWidth=Math.max(0.4,subVw*0.8);ctx.strokeStyle=INK;ctx.stroke();
  ctx.restore();

  // ฝ่ามือกางนิ้ว 4 แฉกข้างขวา (Right spread hand - เส้นคมชัด เรียวเล็ก ไม่ทับเป็นก้อน)
  ctx.save();ctx.translate(.36*u,rightHandY);
  ctx.beginPath();
  ctx.arc(0,0,.08*u,0,7);
  ctx.fillStyle='#ffb48e';ctx.fill();
  ctx.lineWidth=subVw;ctx.strokeStyle=INK;ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-.08*u,-.01*u);ctx.lineTo(-.13*u,-.11*u);
  ctx.moveTo(-.04*u,-.05*u);ctx.lineTo(-.07*u,-.17*u);
  ctx.moveTo(.01*u,-.06*u);ctx.lineTo(.03*u,-.18*u);
  ctx.moveTo(.06*u,-.03*u);ctx.lineTo(.12*u,-.15*u);
  ctx.lineWidth=Math.max(0.4,subVw*0.8);ctx.strokeStyle=INK;ctx.stroke();
  ctx.restore();

  // 5. ใบหน้าสไตล์จิบิตกใจร้องขอความช่วยเหลือ (Chibi Distressed Face)
  E(0,-.56*u,.28*u,.25*u,'#ffb48e',vw);
  // หูสองข้าง
  E(-.3*u,-.56*u,.07*u,.08*u,'#ffb48e',subVw);
  E(.3*u,-.56*u,.07*u,.08*u,'#ffb48e',subVw);

  // ตาโตสีดำตื่นตกใจ
  E(-.12*u,-.58*u,.05*u,.068*u,'#141226',0);
  E(.12*u,-.58*u,.05*u,.068*u,'#141226',0);
  // ประกายตาขาว
  circ(-.13*u,-.6*u,.018*u);circ(.11*u,-.6*u,.018*u);

  // ปากอ้ากว้างร้องตะโกนขอความช่วยเหลือ (Open Crying/Shouting Mouth)
  ctx.beginPath();
  ctx.ellipse(0,-.44*u,.13*u,.095*u,0,0,7);
  ctx.fillStyle='#7f1d1d';ctx.fill();
  ctx.lineWidth=subVw;ctx.strokeStyle=INK;ctx.stroke();
  // ลิ้นสีชมพูคอรัลสดใส
  ctx.beginPath();
  ctx.arc(0,-.42*u,.08*u,0,Math.PI);
  ctx.fillStyle='#f87171';ctx.fill();

  // 6. ทรงผมและหมวกตามเพศ (Hair / Cap Variation)
  if(isGirl){
    // ทรงผมนักเรียนหญิง: ผมหน้าม้าดกดำปรกหน้าผาก
    ctx.beginPath();
    ctx.arc(0,-.64*u,.29*u,Math.PI*0.9,Math.PI*2.1);
    ctx.bezierCurveTo(.22*u,-.62*u,.12*u,-.7*u,0,-.65*u);
    ctx.bezierCurveTo(-.12*u,-.7*u,-.22*u,-.62*u,-.29*u,-.64*u);
    ctx.closePath();
    ctx.fillStyle='#231f20';ctx.fill();
    ctx.lineWidth=vw;ctx.strokeStyle=INK;ctx.stroke();

    // หางม้าผูกข้างขวาพร้อมยางรัดผมสีชมพู (Side Ponytail with pink hair tie)
    ctx.save();ctx.translate(.28*u,-.78*u);ctx.rotate(flail*.2);
    ctx.fillStyle='#f43f5e';circ(0,0,.065*u); // ยางรัดผมชมพู
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.bezierCurveTo(.25*u,-.1*u,.4*u,.2*u,.22*u,.45*u);
    ctx.bezierCurveTo(.12*u,.32*u,.05*u,.12*u,-.02*u,.05*u);
    ctx.closePath();
    ctx.fillStyle='#231f20';ctx.fill();
    ctx.lineWidth=subVw;ctx.strokeStyle=INK;ctx.stroke();
    ctx.restore();
  }else{
    // ทรงผมนักเรียนชาย: หมวกแก๊ปสีดำหันไปข้างหน้า
    ctx.beginPath();
    ctx.arc(0,-.7*u,.29*u,Math.PI*0.85,Math.PI*2.15);
    ctx.closePath();
    ctx.fillStyle='#1e293b';ctx.fill();
    ctx.lineWidth=vw;ctx.strokeStyle=INK;ctx.stroke();

    // ปีกหมวกด้านหน้า (Curved Cap Visor)
    ctx.beginPath();
    ctx.ellipse(0,-.68*u,.32*u,.085*u,0,0,Math.PI);
    ctx.fillStyle='#0f172a';ctx.fill();
    ctx.lineWidth=subVw;ctx.strokeStyle=INK;ctx.stroke();

    // ปอยผมดำข้างใบหู
    ctx.fillStyle='#231f20';
    circ(-.25*u,-.62*u,.05*u);circ(.25*u,-.62*u,.05*u);
  }

  // 7. ป้ายข้อความขอความช่วยเหลือ และลูกศรชี้ลอยอยู่เหนือหัว
  const by=-1.35*u-Math.abs(Math.sin(t*5))*.15*u;
  TRI([[-.26*u,by-.36*u],[.26*u,by-.36*u],[0,by]],'#39ff14',Math.max(0.8,vw*0.85));
  if(u>14){
    const msg = v.txt || 'ช่วยด้วย';
    ctx.font=`700 ${Math.max(12,.28*u)}px Mali,sans-serif`;
    ctx.textAlign='center';ctx.lineWidth=Math.max(1.5,Math.min(3,u*0.03));
    ctx.strokeStyle=INK;ctx.strokeText(msg,0,by-.55*u);
    ctx.fillStyle='#fff';ctx.fillText(msg,0,by-.55*u);
  }

  ctx.restore();
  if(dbg)dbgCircle(v.x,z,RESCUE.radius,'#7dff9a');
}

/* ---------- โลก: Arcade ---------- */
const ZN=['ซอยชุมชน','ตลาดน้ำ','เมืองเก่า'];
const zoneAt=d=>{const m=((d%1200)+1200)%1200;return m<300?0:m<700?1:2};
const hash=n=>{n=Math.imul(n^(n>>>15),2246822519);n=Math.imul(n^(n>>>13),3266489917);return((n^(n>>>16))>>>0)/4294967296};
const inTun=()=>false;function ensureTuns(){}
const KF=[
{nm:'กลางวัน',t:[38,132,255],b:[168,232,255],f:[112,186,246],n:[84,158,232],sun:0,gold:0,dk:0,lt:0,st:0},
{nm:'พลบค่ำ',t:[64,28,120],b:[255,118,84],f:[140,70,150],n:[104,44,130],sun:1,gold:.5,dk:.14,lt:.4,st:.1},
{nm:'กลางคืน',t:[8,10,40],b:[36,50,112],f:[24,32,84],n:[16,22,62],sun:0,gold:0,dk:.36,lt:1,st:1},
{nm:'รุ่งเช้า',t:[96,84,176],b:[255,196,150],f:[150,112,170],n:[120,86,150],sun:.4,gold:.3,dk:.1,lt:.3,st:.15}],CYC=2400;
const cur={t:[0,0,0],b:[0,0,0],f:[0,0,0],n:[0,0,0],sun:0,gold:0,dk:0,lt:0,st:0,nm:''},rgb=a=>`rgb(${a[0]|0},${a[1]|0},${a[2]|0})`;
const mixc=(a,b,f)=>[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f];
const WC=[['rgba(25,168,224,.6)','rgba(34,182,238,.6)'],['rgba(26,160,216,.6)','rgba(34,174,230,.6)'],['rgba(28,176,218,.6)','rgba(38,190,232,.6)']],GC=['#2e9e6a','#27905f'];
const SC={};function sh(c,f){const k=c+f;if(SC[k])return SC[k];const n=parseInt(c.slice(1),16),r=Math.min(255,(n>>16&255)*f|0),g=Math.min(255,(n>>8&255)*f|0),b=Math.min(255,(n&255)*f|0);return SC[k]='#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1)}
function poly(a,b,c,d,col){ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);if(d)ctx.lineTo(d.x,d.y);ctx.fill()}
function vq(x,zn,zf,y0,y1,c){
  const dn=Math.max(.8,CAM.z-zn),sn=F/dn,df=Math.max(.8,CAM.z-zf),sf=F/df;
  const xn=W*.5+(x-camX)*sn,xf=W*.5+(x-camX)*sf;
  const yn0=HZ+(CAM.y-y0)*sn,yn1=HZ+(CAM.y-y1)*sn,yf0=HZ+(CAM.y-y0)*sf,yf1=HZ+(CAM.y-y1)*sf;
  ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(xn,yn0);ctx.lineTo(xf,yf0);ctx.lineTo(xf,yf1);ctx.lineTo(xn,yn1);ctx.fill();
}
function fq(x0,x1,z,y0,y1,c){
  const d=Math.max(.8,CAM.z-z),s=F/d,sx=W*.5-camX*s;
  const xa=sx+x0*s,xb=sx+x1*s,ya=HZ+(CAM.y-y0)*s,yb=HZ+(CAM.y-y1)*s;
  ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(xa,ya);ctx.lineTo(xb,ya);ctx.lineTo(xb,yb);ctx.lineTo(xa,yb);ctx.fill();
}
function hq(x0,x1,zn,zf,y,c){
  const dn=Math.max(.8,CAM.z-zn),sn=F/dn,df=Math.max(.8,CAM.z-zf),sf=F/df;
  const sxn=W*.5-camX*sn,sxf=W*.5-camX*sf,yn=HZ+(CAM.y-y)*sn,yf=HZ+(CAM.y-y)*sf;
  ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(sxn+x0*sn,yn);ctx.lineTo(sxn+x1*sn,yn);ctx.lineTo(sxf+x1*sf,yf);ctx.lineTo(sxf+x0*sf,yf);ctx.fill();
}
let lanternGlowCanvas=null;
function getLanternGlow(){
  if(lanternGlowCanvas)return lanternGlowCanvas;
  lanternGlowCanvas=document.createElement('canvas');lanternGlowCanvas.width=64;lanternGlowCanvas.height=64;
  const gctx=lanternGlowCanvas.getContext('2d');
  const g=gctx.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,210,80,1)');g.addColorStop(.5,'rgba(255,140,20,0.45)');g.addColorStop(1,'rgba(255,120,0,0)');
  gctx.fillStyle=g;gctx.beginPath();gctx.arc(32,32,32,0,Math.PI*2);gctx.fill();
  return lanternGlowCanvas;
}
let logo711Canvas=null;
function get711Logo(){
  if(logo711Canvas)return logo711Canvas;
  logo711Canvas=document.createElement('canvas');logo711Canvas.width=160;logo711Canvas.height=160;
  const c=logo711Canvas.getContext('2d');
  c.fillStyle='#008139';
  if(c.roundRect){c.beginPath();c.roundRect(0,0,160,160,22);c.fill()}
  else{c.fillRect(0,0,160,160)}
  c.fillStyle='#ffffff';
  if(c.roundRect){c.beginPath();c.roundRect(10,10,140,140,16);c.fill()}
  else{c.fillRect(10,10,140,140)}
  c.fillStyle='#f58220';
  c.beginPath();
  c.moveTo(26,26);c.lineTo(134,26);c.lineTo(134,54);c.lineTo(56,54);c.lineTo(42,66);c.lineTo(26,66);
  c.closePath();c.fill();
  c.fillStyle='#ee1c25';
  c.beginPath();
  c.moveTo(102,54);c.lineTo(134,54);c.lineTo(84,136);c.lineTo(52,136);
  c.closePath();c.fill();
  c.fillStyle='#ffffff';
  c.fillRect(16,70,128,28);
  c.fillStyle='#008139';
  c.font='900 20px "Arial Black",sans-serif';
  c.textAlign='center';c.textBaseline='middle';
  c.fillText('ELEVEn',80,84);
  return logo711Canvas;
}
function skyline(t){
  const k=H/560,b=HZ+2,off=-camX*6,ro=-camX*12;
  const g=ctx.createLinearGradient(0,0,0,HZ);g.addColorStop(0,rgb(cur.t));g.addColorStop(1,rgb(cur.b));ctx.fillStyle=g;ctx.fillRect(0,0,W,b);
  if(cur.st>.03){ctx.fillStyle=`rgba(255,255,255,${cur.st*.85})`;for(let i=0;i<46;i++){const z=1+hash(i+500)*1.6+Math.sin(t*3+i)*.4;ctx.fillRect((hash(i+300)*W+off*.15+W)%W,hash(i+400)*HZ*.8,z,z)}
    const mx=W*.8+off*.2,my=HZ*.25;ctx.fillStyle=`rgba(255,250,220,${cur.st})`;circ(mx,my,HZ*.09);ctx.fillStyle=rgb(cur.t);circ(mx+HZ*.04,my-HZ*.02,HZ*.08)}
  if(cur.sun>.03){
    ctx.globalAlpha=cur.sun;const sx=W*.5+off*.3,sy=HZ*.62,r=HZ*.34,sg=ctx.createLinearGradient(0,sy-r,0,sy+r);sg.addColorStop(0,'#ffe15a');sg.addColorStop(1,'#ff3fa4');
    ctx.fillStyle=sg;ctx.beginPath();ctx.arc(sx,sy,r,0,7);ctx.fill();
    for(let i=0;i<5;i++){const y=sy+r*i*.2;ctx.fillStyle=rgb(mixc(cur.t,cur.b,y/HZ));ctx.fillRect(sx-r,y,2*r,3+i*1.6)}
    ctx.globalAlpha=1;
  }
  // 1. ตึกระฟ้าขอบฟ้าฉากหลัง (Distant City Skyline Silhouettes - วาดก่อนนกและโคมลอย)
  ctx.fillStyle=rgb(cur.f);
  for(let x=-60,i=0;x<W+60;i++){const w=30+hash(i+91)*26,hh=(70+hash(i+5)*170)*k;ctx.fillRect(x+off,b-hh,w,hh);if(hash(i+8)>.6)ctx.fillRect(x+off+w/2-2,b-hh-22*k,4,22*k);x+=w+hash(i+3)*10}
  const tone=mixc(cur.n,[255,205,74],cur.gold*.8);
  ctx.fillStyle=rgb(tone);
  const cx=W*.7+ro*.6;ctx.beginPath();[[-26,0],[26,0],[16,-70],[9,-125],[4,-165],[0,-200],[-4,-165],[-9,-125],[-16,-70]].forEach((q,i)=>i?ctx.lineTo(cx+q[0]*k,b+q[1]*k):ctx.moveTo(cx+q[0]*k,b+q[1]*k));ctx.fill();
  ctx.fillStyle=rgb(cur.n);const bx=W*.16+ro*.6;ctx.fillRect(bx-17*k,b-230*k,34*k,230*k);ctx.fillRect(bx-10*k,b-262*k,20*k,32*k);ctx.fillRect(bx-2*k,b-300*k,4*k,38*k);
  const tx=W*.42+ro*.7;for(let i=0;i<3;i++){const wd=(60-i*14)*k,y=b-(24+i*30)*k;ctx.beginPath();ctx.moveTo(tx-wd,y);ctx.lineTo(tx+wd,y);ctx.lineTo(tx,y-30*k);ctx.fill()}
  ctx.fillRect(tx-40*k,b-24*k,80*k,24*k);
  for(let x=-60,i=0;x<W+60;i++){const w=40+hash(i+60)*30,hh=(26+hash(i+61)*46)*k;ctx.fillRect(x+ro,b-hh,w,hh);if(hash(i+9)>.5){ctx.beginPath();ctx.moveTo(x+ro-3,b-hh);ctx.lineTo(x+ro+w+3,b-hh);ctx.lineTo(x+ro+w/2,b-hh-14*k);ctx.fill()}x+=w+hash(i+7)*8}

  // 2. ก้อนเมฆ (Clouds)
  if(cur.sun<.6){ctx.fillStyle=`rgba(255,255,255,${.9*(1-cur.sun)*(1-cur.st*.85)})`;for(let i=0;i<4;i++){const cx=((i*W*.33+t*6-camX*10)%(W+160)+W+160)%(W+160)-80,cy=HZ*(.12+.16*(i%3));ctx.beginPath();ctx.roundRect(cx,cy,60+20*k,14+6*k,10);ctx.roundRect(cx+16,cy-9,40,14,8);ctx.fill()}}

  // 3. ฝูงนก (กลางวัน) บินอยู่หน้าตึกระฟ้าขอบฟ้า (In FRONT of City Skyline)
  if(cur.st<.65){
    const birdAlpha=Math.min(1,Math.max(.15,(1-cur.st)*.95));
    ctx.strokeStyle=`rgba(24,20,38,${birdAlpha})`;ctx.lineWidth=Math.max(1.4,1.8*k);ctx.lineCap='round';
    for(let i=0;i<6;i++){
      const bx=((t*32+i*42-camX*8)%(W+240)+W+240)%(W+240)-120;
      const by=HZ*(.14+(i%3)*.1)+Math.sin(t*1.8+i)*6*k;
      const flap=Math.sin(t*8+i*1.7);
      ctx.beginPath();
      ctx.moveTo(bx-7*k,by+flap*3.5*k);
      ctx.quadraticCurveTo(bx-2.5*k,by-2.5*k,bx,by);
      ctx.quadraticCurveTo(bx+2.5*k,by-2.5*k,bx+7*k,by+flap*3.5*k);
      ctx.stroke();
    }
  }

  // 4. โคมลอยสีทอง (กลางคืน) ลอยอยู่หน้าตึกระฟ้าขอบฟ้า (In FRONT of City Skyline)
  if(cur.st>.08||cur.dk>.2){
    const lanternAlpha=Math.min(1,Math.max(0,(cur.st-.08)*2.2+cur.dk*.8));
    if(lanternAlpha>.02){
      const lSprite=getLanternGlow();
      for(let i=0;i<16;i++){
        const seed=i*61.7,spd=7+(i%5)*3;
        const lx=((hash(seed)*W+Math.sin(t*.4+i)*24*k-camX*4)%W+W)%W;
        const ly=((hash(seed+1)*HZ*1.5-t*spd)%(HZ*1.2)+HZ*1.2)%(HZ*1.2)-8*k;
        const sz=(3.6+(i%4)*1.4)*k,flick=.85+Math.sin(t*9+i*2.5)*.15;
        const glowSz=sz*8;
        ctx.globalAlpha=.5*lanternAlpha*flick;
        ctx.drawImage(lSprite,lx-glowSz/2,ly-glowSz/2,glowSz,glowSz);
        ctx.globalAlpha=1;
        ctx.fillStyle=`rgba(255,240,195,${.95*lanternAlpha*flick})`;
        ctx.beginPath();ctx.roundRect(lx-sz*.6,ly-sz*.9,sz*1.2,sz*1.8,[sz*.3,sz*.3,sz*.15,sz*.15]);ctx.fill();
        ctx.fillStyle=`rgba(255,95,20,${.98*lanternAlpha*flick})`;
        ctx.beginPath();ctx.arc(lx,ly+sz*.45,sz*.28,0,7);ctx.fill();
      }
    }
  }
}
function bldg0(m,sd,zn,zf,Z,par){
  const h=hash(m*2+(sd>0?1:0)+Z*777),h2=hash(m*13+sd+5),xs=sd*(BANK+1.5),xw=sd*(BANK+5.2),xm=(xs+xw)/2,z1=zf+(zn-zf)*.12,hb=Z===2?2.4:2.4+h*2.8;
  hq(sd*BANK,xs,zn,zf,.45,par?'#f0d9a8':'#e6cc94');
  const pal=[['#ffd6a5','#caffbf','#fdffb6'],['#ffc6ff','#bdb2ff','#ffd6e0'],['#fff3d6','#fff3d6','#ffe9b8']][Z],wall=pal[h*3|0],roof=['#8aa4c8','#9a6ad8','#ff7a59'][Z];
  vq(xs,zn,z1,0,hb,wall);vq(xs,zn,z1,0,.7,'#8a7a5a');fq(xs,xw,zn,0,hb,sh(wall,.8));fq(xs,xw,zn,0,.7,'#6a5a3c');
  // หน้าต่างข้างตึกผูกพิกัดสัมพัทธ์ (Relative Coordinates) กับผนังด้านข้าง ไม่ลอยหลุด
  if(h2>.3){
    const wZ0=lerp(zn,z1,.22),wZ1=lerp(zn,z1,.62),wY0=hb*.45,wY1=hb*.82;
    vq(xs,wZ0,wZ1,wY0,wY1,'#3a4a6a');
    const midZ=(wZ0+wZ1)*.5;
    vq(xs,midZ-.04,midZ+.04,wY0,wY1,'#ffffff');
  }
  const rh=Z===2?1.9:1.3;
  poly(P(xs,zn,hb),P(xw,zn,hb),P(xm,zn,hb+rh),null,sh(roof,.85));poly(P(xs,zn,hb),P(xs,z1,hb),P(xm,z1,hb+rh),P(xm,zn,hb+rh),roof);
  if(Z===2)poly(P(xm-.1,zn,hb+rh),P(xm+.1,zn,hb+rh),P(xm,zn,hb+rh+.8),null,'#ffcf4a');
  if(Z===0&&h>.55)for(let q=0;q<3;q++){
    const qZ0=lerp(zn,z1,.12+q*.26),qZ1=lerp(zn,z1,.28+q*.26);
    vq(sd*(BANK+.9),qZ0,qZ1,hb*.45,hb*.75,['#e88ab0','#f4ece0','#ffd166'][q]);
  }
}
function tod(d){const p=(((d%CYC)+CYC)%CYC)/CYC*4,i=p|0,e=clamp((p-i-.25)*2,0,1),q=e*e*(3-2*e),A=KF[i],B2=KF[(i+1)&3];
  for(const k of['t','b','f','n'])for(let j=0;j<3;j++)cur[k][j]=lerp(A[k][j],B2[k][j],q);
  for(const k of['sun','gold','dk','lt','st'])cur[k]=lerp(A[k],B2[k],q);cur.nm=(q<.5?A:B2).nm}
const WR=[],glows=[],wp=[null,null],D_QUEUE=[],WORLD_ITEMS=[],TF=['#a51931','#f4f5f8','#2d2a4a','#2d2a4a','#f4f5f8','#a51931'],SCOL=['#e8412f','#ffd166','#39a9ff','#ff7ab6','#7ddc5a'];
const SG=['ข้าวแกง','ก๋วยเตี๋ยว','ร้านชำ','ตัดผม','ส้มตำ','ชาเย็น','ซ่อมรถ','ห้องเช่า','โชห่วย','กาแฟสด'];
const glow=(x,y,r)=>{if(cur.lt>.15)glows.push(x,y,r)};
function txt(t,x,z,y,k,col){const q=P(x,z,y);if(q.s<6)return;ctx.font=`700 ${q.s*k}px Mali,sans-serif`;ctx.textAlign='center';ctx.fillStyle=col;ctx.fillText(t,q.x,q.y)}
function street(m,zn,zf){ // ถนนแอสฟัลต์ใต้น้ำ: ฟุตปาธ เส้นขอบ เส้นเลน ทางม้าลาย รอยซ่อม
  const zd=zn-zf;quad(-BANK,BANK,zn,zf,m&1?'#3b414d':'#343a45');
  hq(-BANK,-BANK+1.2,zn,zf,0,'#a39c8c');hq(BANK-1.2,BANK,zn,zf,0,'#a39c8c');hq(-BANK+1.2,-BANK+1.35,zn,zf,0,'#6d685d');hq(BANK-1.35,BANK-1.2,zn,zf,0,'#6d685d');
  for(const x of[-3.1,3.1])hq(x-.05,x+.05,zn,zf,0,'#e0b52a');
  for(const x of[-1,1])hq(x-.06,x+.06,zn-zd*.1,zn-zd*.5,0,'#eceff1');
  if(hash(m*7+3)>.75)for(let j=0;j<7;j++){const x=-2.7+j*.85;hq(x,x+.42,zn-zd*.55,zn-zd*.8,0,'#e6e6e6')}
  for(let j=0;j<3;j++){const x=(hash(m*11+j)*2-1)*3,zz=zn-zd*hash(m*11+j+9);hq(x,x+.8,zz,zz-.25,0,'rgba(0,0,0,.2)')}
}
/* สัตว์จรจัดบนทางเท้า: สุนัข และ แมว (Distinct Arcade Animal Silhouettes) */
function drawStrayDog(x,y,u,sd,isSleeping,col='#c87a32'){
  if(u<3)return;
  ctx.save();ctx.translate(x,y);
  if(isSleeping){
    // หมานอนขดตัวหลับสบาย (Sleeping Dog)
    E(0,-.08*u,.22*u,.11*u,col,1);
    E(sd*.16*u,-.06*u,.11*u,.08*u,col,1);
    E(sd*.12*u,-.12*u,.05*u,.07*u,'#7a3e14',1);
    ctx.fillStyle='#111';circ(sd*.23*u,-.05*u,.03*u);
    ctx.strokeStyle=col;ctx.lineWidth=Math.max(1,u*.04);ctx.beginPath();ctx.arc(-sd*.16*u,-.07*u,.08*u,1,4.5);ctx.stroke();
    if(u>5){
      const zPh=(S.t*1.5)%1;ctx.fillStyle=`rgba(255,255,255,${.8*(1-zPh)})`;ctx.font=`700 ${u*.18}px Mali,sans-serif`;ctx.fillText('z',sd*.22*u,-.16*u-zPh*.15*u);
    }
  }else{
    // หมายืน/เดินกระดิกหาง (Alert Walking Dog)
    const legWalk=Math.sin(S.t*8)*.04*u;
    ctx.fillStyle=col;
    ctx.fillRect(-sd*.14*u-.02*u,-.12*u,.05*u,.12*u+legWalk);
    ctx.fillRect(-sd*.08*u-.02*u,-.12*u,.05*u,.12*u-legWalk);
    ctx.fillRect(sd*.08*u-.02*u,-.12*u,.05*u,.12*u-legWalk);
    ctx.fillRect(sd*.14*u-.02*u,-.12*u,.05*u,.12*u+legWalk);
    E(0,-.18*u,.22*u,.12*u,col,1);
    E(sd*.08*u,-.17*u,.08*u,.08*u,'#f2e4d0',.5);
    RR(sd*.08*u-.02*u,-.28*u,.08*u,.06*u,.02*u,'#e82828',.8); // ปลอกคอแดง
    E(sd*.16*u,-.28*u,.1*u,.09*u,col,1);
    E(sd*.24*u,-.26*u,.07*u,.06*u,col,1);
    ctx.fillStyle='#111';circ(sd*.28*u,-.27*u,.025*u);circ(sd*.18*u,-.3*u,.02*u);
    TRI([[sd*.12*u,-.34*u],[sd*.17*u,-.34*u],[sd*.13*u,-.42*u]],'#7a3e14',1);
    const tailWag=Math.sin(S.t*14)*.08*u;
    ctx.strokeStyle=col;ctx.lineWidth=Math.max(1.5,u*.05);ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(-sd*.18*u,-.2*u);ctx.quadraticCurveTo(-sd*.28*u,-.35*u,-sd*.24*u+tailWag,-.42*u);ctx.stroke();
  }
  ctx.restore();
}
function drawStrayCat(x,y,u,sd,catType=0){
  if(u<3)return;
  ctx.save();ctx.translate(x,y);
  const colors=['#f2822a','#2d2b35','#d4d8e0'];
  const bodyCol=colors[catType%3];
  ctx.fillStyle=bodyCol;
  ctx.fillRect(-.06*u,-.08*u,.04*u,.08*u);ctx.fillRect(.02*u,-.08*u,.04*u,.08*u);
  E(0,-.16*u,.14*u,.1*u,bodyCol,1);
  E(sd*.1*u,-.25*u,.085*u,.08*u,bodyCol,1);
  // หูสามเหลี่ยมแหลม 2 ข้าง (Signature Cat Ears!)
  TRI([[sd*.05*u,-.31*u],[sd*.11*u,-.31*u],[sd*.07*u,-.4*u]],bodyCol,1);
  TRI([[sd*.11*u,-.31*u],[sd*.17*u,-.31*u],[sd*.15*u,-.39*u]],bodyCol,1);
  TRI([[sd*.06*u,-.32*u],[sd*.1*u,-.32*u],[sd*.08*u,-.37*u]],'#ff9ebb',.5);
  ctx.fillStyle='#b4e832';circ(sd*.12*u,-.26*u,.022*u);
  if(u>6){
    ctx.strokeStyle='#fff';ctx.lineWidth=.8;ctx.beginPath();
    ctx.moveTo(sd*.14*u,-.24*u);ctx.lineTo(sd*.22*u,-.26*u);
    ctx.moveTo(sd*.14*u,-.23*u);ctx.lineTo(sd*.22*u,-.22*u);ctx.stroke();
  }
  const tailSway=Math.sin(S.t*5)*.06*u;
  ctx.strokeStyle=bodyCol;ctx.lineWidth=Math.max(1.2,u*.035);ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(-sd*.12*u,-.16*u);
  ctx.bezierCurveTo(-sd*.22*u,-.18*u,-sd*.24*u+tailSway,-.32*u,-sd*.18*u+tailSway,-.38*u);ctx.stroke();
  ctx.restore();
}

/* ร้านอาหารริมทางสไตล์สตรีทฟู้ด (Roadside Arcade Restaurant - หันหน้าออกสู่แม่น้ำโดยตรง) */
function drawRestaurant(m,sd,zn,zf,Z,xs,xw,xm,q,lit){
  const restType=(m%4);
  const restNames=['ก๋วยเตี๋ยวต้มยำ','ข้าวมันไก่ตอน','อาหารตามสั่ง','หมูกระทะริมน้ำ'];
  const name=restNames[restType];
  const awnings=[
    ['#e82828','#ffffff'],
    ['#f58220','#ffd166'],
    ['#008139','#ffffff'],
    ['#39a9ff','#ffffff']
  ][restType];

  // 1. โครงสร้างหลัก: หันหน้าหน้าร้านออกสู่แม่น้ำที่แนวตลิ่ง x = xs ตลอดแนว zn -> zf
  vq(xs,zn,zf,0,2.6,lit?'#fff6e8':'#e6dfd5'); // ผนังด้านหน้าร้านหันหาแม่น้ำ
  fq(xs,xw,zn,0,2.6,'#cfc5b4');              // ผนังด้านข้างตึกหันหาผู้เล่น
  hq(xs,xw,zn,zf,2.6,'#b0a490');              // หลังคาดาดฟ้า

  // 2. กันสาดผ้าใบหน้าร้านยื่นเฉียงลงมาคลุมฟุตปาธริมน้ำ (Canvas Awning sloping toward river)
  // ยื่นจากผนัง x = xs (y=2.4) ออกมาทางแม่น้ำ x = xs - sd * 0.95 (y=1.55)
  const awX=xs-sd*.95;
  for(let i=0;i<6;i++){
    const zA=lerp(zn,zf,i/6),zB=lerp(zn,zf,(i+1)/6);
    poly(P(xs,zA,2.4),P(awX,zA,1.55),P(awX,zB,1.55),P(xs,zB,2.4),i&1?awnings[1]:awnings[0]);
  }
  // ชายผ้าระบายกันสาดด้านล่างหันหาแม่น้ำ
  vq(awX,zn,zf,1.38,1.55,awnings[0]);
  // เสาค้ำกันสาดหัว-ท้าย
  fq(awX-.04,awX+.04,zn,0,1.55,'#555555');
  fq(awX-.04,awX+.04,zf,0,1.55,'#555555');

  // 3. ป้ายชื่อร้านไฟนีออนติดชายกันสาดหันสู่แม่น้ำ
  const zm=(zn+zf)/2;
  const pSign=P(awX,zm,1.46);
  if(pSign.s>3.2){
    const signW=Math.min(180,pSign.s*2.2);
    RR(pSign.x-signW/2,pSign.y-pSign.s*.2,signW,pSign.s*.38,3,'#181a20',1);
    ctx.font=`700 ${Math.min(22,pSign.s*.24)}px Mali,sans-serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle=lit?'#ffd166':'#ffffff';
    ctx.fillText(name,pSign.x,pSign.y-.02*pSign.s);
    glow(pSign.x,pSign.y,pSign.s*1.2);
  }

  // 4. เคาน์เตอร์ครัวปรุงอาหารหน้าร้านริมตลิ่ง (Open Kitchen Counter facing river)
  const kX=xs-sd*.35;
  const kz1=lerp(zn,zf,.08),kz2=lerp(zn,zf,.52);
  vq(kX,kz1,kz2,0,.85,'#9aa5b2');
  hq(kX,xs,kz1,kz2,.85,'#cbd5e1'); // ผิวเคาน์เตอร์สแตนเลส
  fq(Math.min(kX,xs),Math.max(kX,xs),kz1,0,.85,'#7e8b9b');

  // หม้อต้มน้ำซุปสแตนเลสควันฉุยริมน้ำ
  const potZ=(kz1+kz2)/2;
  const pPot=P(kX,potZ,.85);
  if(pPot.s>3){
    RR(pPot.x-pPot.s*.14,pPot.y-pPot.s*.26,pPot.s*.28,pPot.s*.26,pPot.s*.04,'#e2e8f0',1);
    const steamPhase=(S.t*.8+m*.3)%1;
    const pSt=P(kX,potZ,1.15+steamPhase*.5);
    if(pSt.s>3){
      ctx.fillStyle=`rgba(255,255,255,${.55*(1-steamPhase)})`;
      circ(pSt.x+Math.sin(steamPhase*8)*.04*pSt.s,pSt.y,(.08+steamPhase*.1)*pSt.s);
    }
  }

  // ตู้กระจกแขวนเป็ด/ไก่พะโล้หน้าร้าน
  const cabZ=lerp(kz1,kz2,.75);
  const pCab=P(kX,cabZ,.88);
  if(pCab.s>4){
    RR(pCab.x-pCab.s*.16,pCab.y-pCab.s*.45,pCab.s*.32,pCab.s*.45,pCab.s*.03,'rgba(180,230,255,0.45)',1);
    ctx.fillStyle='#c87820';circ(pCab.x-pCab.s*.05,pCab.y-pCab.s*.22,pCab.s*.06);
    ctx.fillStyle='#a65215';circ(pCab.x+pCab.s*.05,pCab.y-pCab.s*.22,pCab.s*.06);
  }

  // 5. โต๊ะอาหารและเก้าอี้พลาสติกริมทางชมวิวแม่น้ำ (Dining Table & Stools)
  const tz1=lerp(zn,zf,.6),tz2=lerp(zn,zf,.92);
  const tX=xs-sd*.45;
  vq(tX,tz1,tz2,.45,.68,'#cfd8dc');
  hq(tX,xs-sd*.15,tz1,tz2,.68,'#eceff1');
  const pTbl=P(tX,(tz1+tz2)/2,.68);
  if(pTbl.s>3.5){
    RR(pTbl.x-pTbl.s*.24,pTbl.y+pTbl.s*.08,pTbl.s*.15,pTbl.s*.24,pTbl.s*.03,'#ee2b2b',1);
    RR(pTbl.x+pTbl.s*.09,pTbl.y+pTbl.s*.08,pTbl.s*.15,pTbl.s*.24,pTbl.s*.03,'#1e88e5',1);
  }

  // 6. หลอดไฟนีออนแสงอุ่นห้อยส่องหน้าร้าน
  const qLamp=P(xs-sd*.5,zm,1.75);
  if(qLamp.s>3){
    ctx.fillStyle=lit?'#fff394':'#888888';
    circ(qLamp.x,qLamp.y,qLamp.s*.07);
    glow(qLamp.x,qLamp.y,qLamp.s*1.2);
  }
}

function bldg(m,sd,zn,zf,Z,par){ // ห้องแถวหลากสไตล์ + 7-Eleven + ร้านอาหารริมทาง + สัตว์ฟุตปาธ
  const h=hash(m*2+(sd>0?1:0)+Z*777),hb=Z===2?2.4:2.4+h*2.8,xs=sd*(BANK+1.5),xw=sd*(BANK+5.2),xm=(xs+xw)/2;
  const q=P(xm,zn,1.85);if(q.s<4)return;
  const lit=cur.lt>.35;
  
  // 7-Eleven: ปรับลดความถี่ให้ออกน้อยลง เป็นอาคารพิเศษเฉพาะ (Rare Special Building)
  const is711=(Z!==1)&&(m%28===14)&&(sd>0);
  // ร้านอาหารริมทางสตรีทฟู้ด (Roadside Arcade Restaurant)
  const isRest=(!is711)&&(Z!==1)&&(m%7===3);

  if(is711){
    // 7-Eleven หันหน้าตรงขนานริมตลิ่ง ออกสู่แม่น้ำโดยตรง (Faces riverbank / water directly)
    // 1. ผนังด้านหน้าร้านหันหาแม่น้ำที่ x = xs ตลอดแนวริมตลิ่ง
    vq(xs,zn,zf,0,2.5,lit?'#ffffff':'#f0f3f6');
    fq(xs,xw,zn,0,2.5,'#e0e4e8'); // ผนังด้านข้างตึกหันหาผู้เล่น
    hq(xs,xw,zn,zf,2.5,'#c4c8d0'); // ดาดฟ้า
    
    // 2. ป้าย Fascia คาด 3 แถบสี (ส้ม, เขียว, แดง) ทั้งด้านริมน้ำและด้านหน้าตึก
    const signTop=2.45,signBot=1.65,bH=(signTop-signBot)/3;
    vq(xs,zn,zf,signTop-bH,signTop,'#f58220');      // แถบส้มบน
    vq(xs,zn,zf,signBot+bH,signTop-bH,'#008139'); // แถบเขียวกลาง
    vq(xs,zn,zf,signBot,signBot+bH,'#ee1c25');      // แถบแดงล่าง
    fq(xs,xw,zn,signTop-bH,signTop,'#f58220');
    fq(xs,xw,zn,signBot+bH,signTop-bH,'#008139');
    fq(xs,xw,zn,signBot,signBot+bH,'#ee1c25');

    // 3. ป้ายโลโก้ 7-Eleven แท้ (Official Logo Badge: กล่องเขียว กรอบขาว เลข 7 ส้ม/แดง พร้อมข้อความ ELEVEn)
    const lSprite=get711Logo();
    
    // โลโก้ด้านหน้าตึกหันหาผู้เล่นโดยตรง (เห็นชัดเจน ไม่ซ้อนทับ)
    const frontLogoP=P((xs+xw)*.5,zn,(signTop+signBot)*.5);
    if(frontLogoP.s>3.2){
      const sz=Math.min((signTop-signBot)*frontLogoP.s*1.2,Math.abs(xw-xs)*frontLogoP.s*.75);
      ctx.drawImage(lSprite,frontLogoP.x-sz*.5,frontLogoP.y-sz*.5,sz,sz);
      if(lit)glow(frontLogoP.x,frontLogoP.y,frontLogoP.s*1.2);
    }

    // โลโก้บนแผงป้ายริมน้ำ (Side Riverbank Logo)
    const zm=(zn+zf)/2;
    vq(xs,zm+.7,zm-.7,signBot,signTop,'#ffffff');
    const sideLogoP=P(xs,zm,(signTop+signBot)*.5);
    if(sideLogoP.s>3.2){
      const sz=(signTop-signBot)*sideLogoP.s*.95;
      ctx.drawImage(lSprite,sideLogoP.x-sz*.5,sideLogoP.y-sz*.5,sz,sz);
      if(lit)glow(sideLogoP.x,sideLogoP.y,sideLogoP.s*1.1);
    }

    // 4. ประตูกระจกบานใหญ่และประตูเลื่อนอัตโนมัติหันหาแม่น้ำ
    const inCol=lit?'#fffef2':'#d2e8f5';
    const doorZ=1.1;
    vq(xs,zm+doorZ/2,zm-doorZ/2,0,1.5,lit?'#e2f6ff':'#bad8ea');
    vq(xs,zm+doorZ/2-.04,zm+doorZ/2+.04,0,1.5,'#c81e2b');
    vq(xs,zm-doorZ/2-.04,zm-doorZ/2+.04,0,1.5,'#c81e2b');

    // กระจกบานหน้าต่างด้านซ้ายและขวาของประตู
    vq(xs,zn-.2,zm+doorZ/2+.04,.08,1.52,inCol);
    vq(xs,zm-doorZ/2-.04,zf+.2,.08,1.52,inCol);

    // แถบสติ๊กเกอร์ 3 สี (ส้ม, เขียว, แดง) คาดกลางกระจกทุกบาน
    const stY=.75,stH=.055;
    vq(xs,zn-.2,zf+.2,stY+stH,stY+stH*2,'#f58220');
    vq(xs,zn-.2,zf+.2,stY,stY+stH,'#008139');
    vq(xs,zn-.2,zf+.2,stY-stH,stY,'#ee1c25');

    // ชั้นวางสินค้าและตู้แช่เครื่องดื่มด้านใน (Silhouettes)
    if(q.s>7){
      vq(xs+sd*.4,zn,zm-doorZ/2-.2,.15,.7,'#ffd24a');
      vq(xs+sd*.4,zm+doorZ/2+.2,zf,.15,1.1,'#39a9ff');
    }

    // 5. ถังขยะสีแดงหน้าร้าน 7-Eleven ริมฟุตปาธ
    const binP=P(xs-sd*.4,zm+sd*(doorZ/2+.35),.35);
    if(binP.s>4){
      RR(binP.x-binP.s*.1,binP.y-binP.s*.3,binP.s*.2,binP.s*.3,binP.s*.03,'#ee1c25',1);
      ctx.fillStyle='#222';circ(binP.x,binP.y-binP.s*.24,binP.s*.04);
    }

    // 6. หมาเซเว่นนอนหลับสบายรับลมแอร์เย็นฉ่ำตรงประตูทางเข้าริมน้ำ
    const dogP=P(xs-sd*.35,zm-sd*(doorZ/2+.3),.12);
    drawStrayDog(dogP.x,dogP.y,dogP.s,sd,true,'#c87a32');
  }else if(isRest){
    // ร้านอาหารสตรีทฟู้ดริมทางหันหน้าตรงเข้าหาแม่น้ำ
    drawRestaurant(m,sd,zn,zf,Z,xs,xw,xm,q,lit);
  }else{
    // ตึกแถวหลากสไตล์ตามโซนปกติ
    bldg0(m,sd,zn,zf,Z,par);
    const c=SCOL[(m+(sd>0?2:0))%5];
    for(let i=0;i<3;i++){
      const a=lerp(xs,xw,i/3+.03),b=lerp(xs,xw,(i+1)/3-.03);
      const bayW=b-a;
      if(Z===1){ // โซนตลาดน้ำ: บ้านไม้ริมน้ำ
        fq(a,b,zn,0,1.4,i===1?'#8a522a':'#6b3e1e');
        if(hb>3.2){
          // หน้าต่างไม้ชั้นบน ผูกพิกัดสัมพัทธ์ (Relative Coordinates) กับผนังแม่
          const wY0=hb*0.58,wY1=hb*0.88;
          const wX0=a+bayW*0.18,wX1=b-bayW*0.18;
          fq(wX0,wX1,zn,wY0,wY1,'#3d6e5a');
          fq(wX0,wX1,zn,(wY0+wY1)*0.5-0.03,(wY0+wY1)*0.5+0.03,'#224434');
        }
      }else if(Z===2){ // โซนเมืองเก่า: สถาปัตยกรรมชิโน-โปรตุกีส หน้าต่างซุ้มโค้ง
        fq(a,b,zn,0,1.4,i===1?'#f7ebd2':'#edd8b4');
        if(hb>3.2){
          const wY0=hb*0.54,wY1=hb*0.88;
          const wX0=a+bayW*0.16,wX1=b-bayW*0.16;
          fq(wX0,wX1,zn,wY0,wY1,lit?'#ffe89c':'#4a6572');
          fq(wX0,wX1,zn,wY1-0.06,wY1,'#d2be98');
          const midX=(wX0+wX1)*0.5;
          fq(midX-0.03,midX+0.03,zn,wY0,wY1,'#ffffff');
        }
      }else{ // โซนซอยชุมชน: ตึกพาณิชย์โมเดิร์น ประตูเหล็กม้วน
        fq(a,b,zn,0,1.4,i===1?'#d9dee3':'#8b9db0');
        if(hb>3.2){
          const wY0=hb*0.56,wY1=hb*0.88;
          const wX0=a+bayW*0.16,wX1=b-bayW*0.16;
          fq(wX0,wX1,zn,wY0,wY1,lit?'#ffd75e':'#5f8fc0');
          // วงกบอลูมิเนียมขาวแบ่ง 4 ช่อง
          const midX=(wX0+wX1)*0.5,midY=(wY0+wY1)*0.5;
          fq(midX-0.03,midX+0.03,zn,wY0,wY1,'#ffffff');
          fq(wX0,wX1,zn,midY-0.03,midY+0.03,'#ffffff');
          // คอมเพรสเซอร์แอร์ผูกตำแหน่ง 3D สัมพัทธ์ติดใต้หน้าต่างอย่างมั่นคง
          if(i===0){
            const acX0=wX0+0.04,acX1=wX0+0.38;
            const acY0=wY0-0.34,acY1=wY0-0.06;
            fq(acX0,acX1,zn,acY0,acY1,'#e4e8ec');
            fq(acX0,acX1,zn,(acY0+acY1)*0.5-0.02,(acY0+acY1)*0.5+0.02,'#94a3b8');
          }
        }
      }
    }
    fq(xs,xw,zn,1.5,2.2,c);
    if(q.s>13){
      ctx.font=`700 ${q.s*.36}px Mali,sans-serif`;ctx.textAlign='center';ctx.textBaseline='alphabetic';
      ctx.fillStyle=c==='#ffd166'?'#3a2a00':'#fff';
      ctx.fillText(SG[(m*3+(sd>0?1:0))%SG.length],q.x,q.y+.12*q.s,Math.abs(xw-xs)*q.s*.9);
    }
    glow(q.x,q.y,q.s*1.1);

    // ธงชาติไทย: ลดโอกาสเกิดลงอย่างมาก (เหลือเพียง ~10% นานๆ เจอที)
    if(h>.88&&Z!==1){
      const b=P(xs+sd*.3,zn-.4,hb),t=P(xs+sd*.3,zn-.4,hb+1.7),u=t.s;
      if(u>3){
        ctx.fillStyle='#ddd';ctx.fillRect(t.x-.03*u,t.y,.06*u,b.y-t.y);
        const fw=.8*u,fx=sd>0?t.x-fw:t.x,ph=S.t*4+m;
        for(let i=0;i<6;i++){ctx.fillStyle=TF[i];ctx.fillRect(fx+Math.sin(ph+i*.6)*.04*u,t.y+.05*u+i*.09*u,fw,.095*u)}
      }
    }
  }

  // --- ชีวิตบนทางเท้า (Sidewalk Life: Pedestrians, Stray Dogs, Stray Cats) ---
  if(q.s>6){
    const pedH=hash(m*29+(sd>0?3:1));
    const pPos=P(sd*(BANK+0.65),zn-.8,0.45);
    if(pPos.s>3.5){
      const pu=pPos.s;
      if(pedH>.68){
        // คนเดินถนน (3 แบบ: พระสงฆ์, คนกางร่ม, คนสะพายเป้)
        const pType=(pedH*10)|0;
        if(pType%3===0){ // พระสงฆ์ห่มจีวร
          RR(pPos.x-.09*pu,pPos.y-.68*pu,.18*pu,.68*pu,.04*pu,'#f58220',1);
          E(pPos.x,pPos.y-.76*pu,.08*pu,.08*pu,'#ffb48e',1);
        }else if(pType%3===1){ // คนกางร่มกันแดด/ฝน
          RR(pPos.x-.08*pu,pPos.y-.6*pu,.16*pu,.6*pu,.04*pu,'#356895',1);
          E(pPos.x,pPos.y-.68*pu,.075*pu,.075*pu,'#ffb48e',1);
          TRI([[pPos.x-.28*pu,pPos.y-.78*pu],[pPos.x+.28*pu,pPos.y-.78*pu],[pPos.x,pPos.y-1.05*pu]],'#ff5fa2',1.2);
        }else{ // คนสะพายเป้
          RR(pPos.x-.08*pu,pPos.y-.6*pu,.16*pu,.6*pu,.04*pu,'#f4f5f8',1);
          E(pPos.x,pPos.y-.68*pu,.075*pu,.075*pu,'#ffb48e',1);
          RR(pPos.x-sd*.12*pu,pPos.y-.55*pu,.07*pu,.2*pu,.02*pu,'#232130',1);
        }
      }else if(pedH<.26&&!is711){
        // สัตว์จรจัดบนฟุตปาธ: สุนัข หรือ แมว
        if(pedH<.13){
          // หมาจรจัดเดินสำรวจกระดิกหาง
          drawStrayDog(pPos.x,pPos.y,pu,sd,false,'#c87a32');
        }else{
          // แมวส้มนั่งชมวิวริมน้ำ
          drawStrayCat(pPos.x,pPos.y,pu,sd,((pedH*100)|0));
        }
      }
    }
  }
}
function stall(x,z,m){ // แผงลอยน้ำ (5 รูปแบบ: ก๋วยเตี๋ยวเรือ, ผลไม้, ส้มตำไก่ย่าง, ขนมไทย, กาแฟโบราณ)
  const p=P(x,z),u=p.s;if(u<4||p.d<2.5)return;
  ctx.save();ctx.translate(p.x,p.y+Math.sin(S.t*2+m)*.03*u);
  // เงาสะท้อนผิวน้ำธรรมชาติ
  ctx.fillStyle='rgba(6,28,38,.45)';ell(0,.05*u,.98*u,.26*u);

  const stType=((m%5)+5)%5;
  // ลำเรือไม้
  const boatCol=stType===0?'#4a2610':stType===1?'#8a522a':'#6e3c1a';
  ctx.fillStyle=boatCol;ctx.beginPath();
  ctx.moveTo(-.95*u,-.28*u);ctx.lineTo(.95*u,-.28*u);ctx.lineTo(.68*u,.02*u);ctx.lineTo(-.68*u,.02*u);ctx.fill();

  // ตัวแผงและเครื่องเคราตามประเภท
  if(stType===0){ // ก๋วยเตี๋ยวเรือ: หม้อน้ำซุปควันฉุย + ผักบุ้ง
    ctx.fillStyle='#f4ece0';ctx.fillRect(-.75*u,-.68*u,1.5*u,.4*u);
    ctx.fillStyle='#c81e2b';ctx.fillRect(-.45*u,-.86*u,.4*u,.18*u); // หม้อก๋วยเตี๋ยว
    ctx.fillStyle='#ffd166';ctx.fillRect(.05*u,-.84*u,.35*u,.14*u); // ชาม
    const f=(S.t*.7+m*.3)%1;ctx.fillStyle=`rgba(255,255,255,${.6*(1-f)})`;circ(-.25*u+Math.sin(f*6)*.05*u,-.95*u-f*.4*u,(.08+.08*f)*u);
  }else if(stType===1){ // เรือผลไม้ & มะพร้าวน้ำหอม
    ctx.fillStyle='#ffd23f';circ(-.4*u,-.45*u,.12*u);circ(-.2*u,-.45*u,.12*u); // กล้วย
    ctx.fillStyle='#2e9e6a';circ(.1*u,-.46*u,.14*u);circ(.35*u,-.46*u,.14*u); // มะพร้าว
    ctx.fillStyle='#e8412f';circ(-.05*u,-.52*u,.1*u); // แตงโม
  }else if(stType===2){ // ส้มตำ & ไก่ย่างเตาถ่าน
    ctx.fillStyle='#f4ece0';ctx.fillRect(-.7*u,-.62*u,1.4*u,.34*u);
    ctx.fillStyle='#2d2a4a';ctx.fillRect(-.55*u,-.75*u,.45*u,.14*u); // ตะแกรงย่าง
    ctx.fillStyle='#c8641a';circ(.2*u,-.55*u,.14*u); // ครกดินเผา
    const f=(S.t*.9+m*.5)%1;ctx.fillStyle=`rgba(255,255,255,${.5*(1-f)})`;circ(-.32*u,-.85*u-f*.45*u,(.07+.1*f)*u);
  }else if(stType===3){ // ขนมหวานไทย & ข้าวเหนียวมะม่วง
    ctx.fillStyle='#f4ece0';ctx.fillRect(-.7*u,-.6*u,1.4*u,.32*u);
    ctx.fillStyle='#ffd166';circ(-.3*u,-.52*u,.16*u);circ(.25*u,-.52*u,.16*u); // ถาดทองเหลือง
    ctx.fillStyle='#39a9ff';circ(0,-.56*u,.11*u);
  }else{ // ชาเย็น & กาแฟโบราณ
    ctx.fillStyle='#f4ece0';ctx.fillRect(-.7*u,-.62*u,1.4*u,.34*u);
    ctx.fillStyle='#ff7818';ctx.fillRect(-.4*u,-.82*u,.22*u,.22*u); // โหลชาไทย
    ctx.fillStyle='#3a2a14';ctx.fillRect(.05*u,-.82*u,.2*u,.2*u); // กาแฟโบราณ
  }

  // เสาและหลังคาผ้าใบ
  ctx.fillStyle='#5a3014';ctx.fillRect(-.74*u,-1.3*u,.05*u,.65*u);ctx.fillRect(.69*u,-1.3*u,.05*u,.65*u);
  const cPalette=[['#e8412f','#fff'],['#ffd166','#2e9e6a'],['#ff5fa2','#fff'],['#39a9ff','#ffd166'],['#ff7818','#39a9ff']][stType];
  for(let i=0;i<6;i++){
    ctx.fillStyle=i&1?cPalette[1]:cPalette[0];
    ctx.beginPath();ctx.moveTo((-.8+i*.27)*u,-1.32*u);ctx.lineTo((-.8+(i+1)*.27)*u,-1.32*u);
    ctx.lineTo((-.95+(i+1)*.32)*u,-1.02*u);ctx.lineTo((-.95+i*.32)*u,-1.02*u);ctx.fill();
  }
  ctx.restore();glow(p.x,p.y-1.0*u,u*.8);
}
function roadside(m,dist){ // เสาไฟ + สายไฟระโยงระยางขนานข้างทาง + ตลาดน้ำหนาแน่น
  const zc=dist-m*6-3;if(zc>6||zc<-92)return;
  const Z=zoneAt(dist),isFM=(Z===1);
  const tp=[];
  for(let k=0;k<2;k++){
    const sd=k?1:-1,b=P(sd*(BANK+.75),zc,.45),t=P(sd*(BANK+.75),zc,4.4),u=b.s;tp[k]=t;
    if(u>2){
      ctx.fillStyle='#55525c';ctx.fillRect(t.x-.06*u,t.y,.12*u,b.y-t.y);
      ctx.fillRect(t.x-.5*u,t.y+.25*u,u,.09*u);ctx.fillRect(t.x-.4*u,t.y+.7*u,.8*u,.07*u);
      ctx.fillStyle='#3d3a44';ctx.fillRect(t.x-.2*u,t.y+1*u,.4*u,.5*u);glow(t.x,t.y+.15*u,u*.9);
      
      // กิ่งโคมไฟถนนยื่นออกไปทางถนน (Streetlamp Fixture on Utility Pole)
      const armDir=-sd,lx=t.x+armDir*.75*u,ly=t.y+.35*u;
      ctx.strokeStyle='#444754';ctx.lineWidth=Math.max(1.2,.05*u);
      ctx.beginPath();ctx.moveTo(t.x,t.y+.1*u);
      ctx.quadraticCurveTo(t.x+armDir*.4*u,t.y-.1*u,lx,ly);ctx.stroke();
      ctx.fillStyle='#2c2e38';ctx.fillRect(lx-.14*u,ly,.28*u,.08*u);

      // ผูกกับ Day/Night Cycle: โคมไฟส่องสว่างในเวลากลางคืน/พลบค่ำ
      const isNight=(cur.lt>.15||cur.dk>.1);
      if(isNight){
        const bVal=Math.min(1,Math.max(0,cur.lt*1.6+cur.dk*.8));
        ctx.fillStyle='#fff4a8';circ(lx,ly+.06*u,.07*u);
        glow(lx,ly+.06*u,u*1.6);
        // กรวยแสงส่องสว่างลงสู่พื้นถนนและผิวน้ำ (Street Illumination Cone)
        const gP=P(sd*(BANK+.75-.7),zc,.45);
        ctx.fillStyle=`rgba(255,230,120,${.18*bVal})`;
        ctx.beginPath();ctx.moveTo(lx,ly+.08*u);
        ctx.lineTo(gP.x-.85*u,gP.y);ctx.lineTo(gP.x+.85*u,gP.y);ctx.fill();
      }else{
        ctx.fillStyle='#787c88';circ(lx,ly+.05*u,.05*u);
      }

      const w=wp[k];if(w)for(let i=0;i<3;i++){
        const hs=hash(m*9+k*3+i),ox=(i-1)*.4;
        const x1=w.x+ox*w.s,y1=w.y+(.3+.22*i)*w.s,x2=t.x+ox*u,y2=t.y+(.3+.22*i)*u;
        WR.push(x1,y1,(x1+x2)/2+(hs-.5)*1.6*u,(y1+y2)/2+(.5+hs*.8)*u,x2,y2);
      }
      wp[k]=t;
    }
    // โซนตลาดน้ำ (Z===1): เกิดแผงลอยน้ำหนาแน่นมาก (~65% spawn chance!)
    const stallRate=isFM?.35:.82;
    if(hash(m*3+k+40)>stallRate){
      stall(sd*(isFM?3.35:3.55),zc-(hash(m+k)*1.2),m+k);
    }
  }
}
function post(){
  if(WR.length){ctx.strokeStyle='#15112e';ctx.lineWidth=1.2;ctx.lineCap='round';ctx.beginPath();for(let i=0;i<WR.length;i+=6){ctx.moveTo(WR[i],WR[i+1]);ctx.quadraticCurveTo(WR[i+2],WR[i+3],WR[i+4],WR[i+5])}ctx.stroke()}
  if(cur.dk>.01){ctx.fillStyle=`rgba(6,10,48,${cur.dk})`;ctx.fillRect(-20,-20,W+40,H+40)}
  if(glows.length){ctx.fillStyle=`rgba(255,214,120,${.3*cur.lt})`;for(let i=0;i<glows.length;i+=3)circ(glows[i],glows[i+1],glows[i+2])}
}
/* แลนด์มาร์ก: เกิดทุก 14 ช่วง (~84 ม.) สลับซ้าย/ขวา วาดเป็นกล่อง/ polygon ไม่กี่ชิ้น ไม่มีรูปภาพ */
function B(sd,xi,w,z,dp,y0,y1,c){const xo=xi+sd*w,a=Math.min(xi,xo),b=Math.max(xi,xo);fq(a,b,z,y0,y1,c);vq(xi,z,z-dp,y0,y1,sh(c,.7));hq(a,b,z,z-dp,y1,sh(c,1.15))}
function prang(xc,z,H,w){
  fq(xc-w*1.35,xc+w*1.35,z,0,H*.1,'#d8cba6');
  for(let i=0;i<5;i++){const y0=H*(.1+.15*i),y1=y0+H*.15,w0=w*(1-.16*i),w1=w*(1-.16*(i+1));
    poly(P(xc-w0,z,y0),P(xc+w0,z,y0),P(xc+w1,z,y1),P(xc-w1,z,y1),i&1?'#e4d9bd':'#f2ebd8');fq(xc-w0*1.1,xc+w0*1.1,z,y0,y0+H*.018,'#b89b5a');
    const c=P(xc,z,(y0+y1)/2);ctx.fillStyle=i&1?'#e8663a':'#3fa7c9';circ(c.x,c.y,w1*.25*c.s)}
  poly(P(xc-w*.22,z,H*.85),P(xc+w*.22,z,H*.85),P(xc,z,H*1.12),null,'#ffd25a');
}
function wat(sd,z){const xc=sd*(BANK+10.5);fq(xc-6,xc+6,z,0,.8,'#cdbf9a');prang(xc,z,22,2.5);prang(xc-3.9,z,10,1.1);prang(xc+3.9,z,10,1.1)}
function tower(sd,z){const xc=sd*(BANK+9.5),w=1.6,H=27;B(sd,xc-sd*w,2*w,z,3,0,H,'#a9b9cb');
  for(let i=0;i<9;i++){const x=xc-w*.8+(i%5)*w*.36,y=2+i*2.6;fq(x,x+w*.5,z,y,y+2.2,'#5f748c')}
  fq(xc-w*.7,xc+w*.7,z,H,H+1.4,'#8398b0');poly(P(xc-.12,z,H+1.4),P(xc+.12,z,H+1.4),P(xc,z,H+4),null,'#c9d4e0');const q=P(xc,z,H+4);glow(q.x,q.y,q.s*1.5)}
function elephant(sd,z){ // ตึกช้างมุมมองด้านข้าง (Side Profile ตามรูปถ่ายต้นแบบ)
  const xc=sd*(BANK+11.8),w=10,H=23,dp=3.5;
  B(sd,xc-sd*w,2*w,z,dp,0,H,'#dce3eb');
  // ช่องโค้งทะลุ 2 ช่องขนาดใหญ่ระหว่างเสา (ช่องหน้าท้องช้างและช่องขา)
  fq(xc-w*.45,xc-w*.1,z,0,H*.6,'#0e1824');
  fq(xc+w*.18,xc+w*.58,z,0,H*.6,'#0e1824');

  // เสาหน้าสุด (หัวและงวงช้าง)
  // 1. ดวงตากลมโตสีดำ (Iconic Circular Eye Window พร้อมประกายแสงสะท้อน)
  const eyeX=xc-sd*w*.7,eyeP=P(eyeX,z,H*.83);
  if(eyeP.s>4){
    ctx.fillStyle='#181a22';circ(eyeP.x,eyeP.y,.45*eyeP.s);
    ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(1,eyeP.s*.06);ctx.stroke();
    ctx.fillStyle='#fff';circ(eyeP.x+.12*eyeP.s,eyeP.y-.12*eyeP.s,.14*eyeP.s);
  }
  // 2. งาช้างสีทองยื่นออกมา (Cantilevered Golden Tusk Box)
  const tuskX=xc-sd*(w*.92);
  fq(tuskX-sd*.8,tuskX+sd*.8,z,H*.68,H*.75,'#f0b828');
  // 3. แถบกระจกสีดำแนวดิ่ง (หูช้าง)
  fq(xc-sd*w*.5,xc-sd*w*.4,z,H*.68,H*.94,'#1e2532');

  // ตารางหน้าต่างคอนกรีตเรียงเป็นแนว (LOD: แสดงเมื่อใกล้พอ)
  const pChk=P(xc,z,H/2);
  if(pChk.s>5){
    for(let r=0;r<7;r++){
      const wy=2+r*2.7;
      for(let c=0;c<5;c++){
        const wx=xc-w*.8+c*(w*.38);
        if(((wx<xc-w*.45||wx>xc-w*.1)&&(wx<xc+w*.18||wx>xc+w*.58))||wy>H*.6){
          fq(wx-.24,wx+.24,z,wy,wy+1.2,'#2d3748');
        }
      }
    }
  }
}
function victory(sd,z){ // อนุสาวรีย์ชัยสมรภูมิ (Victory Monument - ดาบปลายปืน 5 เล่ม)
  const xc=sd*(BANK+11.2),H=30;
  // ฐานวงเวียนทรงกลมขั้นบันได
  fq(xc-6.5,xc+6.5,z,0,1.2,'#a29d96');
  fq(xc-4.8,xc+4.8,z,1.2,2.4,'#8e8982');
  fq(xc-3.2,xc+3.2,z,2.4,4.2,'#b8b4ae');

  // ดาบปลายปืน 5 เล่มพุ่งขึ้นสู่ท้องฟ้า (5 Iconic Bayonet Obelisks)
  for(let i=0;i<5;i++){
    const ang=(i*Math.PI*2)/5,ox=Math.cos(ang)*1.4,oz=Math.sin(ang)*1.4;
    poly(P(xc+ox-1.1,z+oz,4.2),P(xc+ox+1.1,z+oz,4.2),P(xc+ox*.2+.25,z+oz*.2,H),P(xc+ox*.2-.25,z+oz*.2,H),i%2===0?'#d8d5cf':'#eae7e2');
  }
  poly(P(xc-.3,z,H),P(xc+.3,z,H),P(xc,z,H+2.5),null,'#ffd25a'); // ยอดแหลมสีทอง

  // รูปปั้นบรอนซ์ 5 เหล่าทัพรอบฐาน
  for(const s of[-1,1]){
    const q=P(xc+s*2.5,z,4.4);
    if(q.s>3.5){
      RR(q.x-.14*q.s,q.y-.8*q.s,.28*q.s,.8*q.s,.05*q.s,'#26221c',1);
      E(q.x,q.y-.95*q.s,.12*q.s,.12*q.s,'#26221c',1);
      ctx.strokeStyle='#181512';ctx.lineWidth=Math.max(1,q.s*.06);
      ctx.beginPath();ctx.moveTo(q.x+s*.1*q.s,q.y-.4*q.s);ctx.lineTo(q.x+s*.28*q.s,q.y-1.3*q.s);ctx.stroke();
    }
  }
}
function paragon(sd,z){
  // สยามพารากอน (Siam Paragon - ปรับตำแหน่งแกน X ถอยร่นไปด้านหลังอย่างสง่างาม ไม่รุกล้ำพื้นที่ห้องแถวริมทาง)
  const xInner=sd*(BANK+6.8),w=13,xOuter=sd*(BANK+6.8+w);
  const a=Math.min(xInner,xOuter),b=Math.max(xInner,xOuter),H=24,mid=(a+b)/2,dp=6.5;
  B(sd,xInner,w,z,dp,0,H,cur.lt>.45?'#e0f2fe':'#0284c7');
  
  // แผงกระจกคริสตัลมรกตหลายระดับ (Multi-Tiered Crystal Glass Facades)
  for(let fl=0;fl<5;fl++){
    const y0=fl*4.5,y1=y0+4.1;
    fq(a+.4,b-.4,z,y0,y1,cur.lt>.45?'#fef08a':'#38bdf8');
    for(let m=1;m<6;m++){
      const mx=a+.4+m*((b-a-.8)/6);
      fq(mx-.08,mx+.08,z,y0,y1,'#ffffff');
    }
  }
  // ยอดอาคารและป้ายชื่อ SIAM PARAGON สีทองอร่าม
  fq(a-.3,b+.3,z,H,H+1.4,'#eab308');
  fq(mid-4.2,mid+4.2,z,H+1.4,H+3.8,'#0f172a');
  fq(mid-4.2,mid+4.2,z,H+3.7,H+3.9,'#facc15');
  txt('SIAM PARAGON',mid,z,H+2.3,.48,'#fde047');
  const qP=P(mid,z,H+2.3);
  if(qP.s>3)glow(qP.x,qP.y,qP.s*1.8);
}
function yao(sd,z){const xc=sd*(BANK+8.2),R='#c81e2b';fq(xc-3.5,xc-2.7,z,0,7,R);fq(xc+2.7,xc+3.5,z,0,7,R);fq(xc-3.7,xc+3.7,z,7,8,'#a01822');fq(xc-3.7,xc+3.7,z,7.9,8.1,'#f2c230');
  poly(P(xc-4.8,z,8.1),P(xc+4.8,z,8.1),P(xc+3.4,z,9.8),P(xc-3.4,z,9.8),'#f2c230');poly(P(xc-4.8,z,8.1),P(xc-5.6,z,9.3),P(xc-3.4,z,9.8),null,'#f2c230');poly(P(xc+4.8,z,8.1),P(xc+5.6,z,9.3),P(xc+3.4,z,9.8),null,'#f2c230');
  fq(xc-1.3,xc+1.3,z,7.1,7.9,INK);txt('เยาวราช',xc,z,7.3,.42,'#ffd166');fq(xc-5.4,xc-4.4,z,2.5,7.5,'#ffd166');fq(xc+4.4,xc+5.4,z,2.5,7.5,'#ffd166');
  for(let i=0;i<4;i++){const q=P(xc-2.4+i*1.6,z,6);ctx.fillStyle='#ff2d2d';circ(q.x,q.y,.32*q.s);glow(q.x,q.y,q.s*.9)}}
function swing(sd,z){const xc=sd*(BANK+8),R='#c81e2b',sw=Math.sin(S.t*1.6)*.5;fq(xc-4.6,xc+4.6,z,0,.9,'#cdbf9a');
  poly(P(xc-3.4,z,.9),P(xc-2.6,z,.9),P(xc-1.2,z,16),P(xc-1.9,z,16),R);poly(P(xc+2.6,z,.9),P(xc+3.4,z,.9),P(xc+1.9,z,16),P(xc+1.2,z,16),R);
  fq(xc-2.2,xc+2.2,z,15.2,16.3,R);fq(xc-2.5,xc+2.5,z,16.3,16.6,'#f2c230');fq(xc-2.9,xc+2.9,z,8.5,8.9,R);fq(xc-3.1,xc+3.1,z,4.5,4.9,R);
  fq(xc+sw-.65,xc+sw-.58,z,10.6,15.2,'#6b3d14');fq(xc+sw+.58,xc+sw+.65,z,10.6,15.2,'#6b3d14');fq(xc+sw-.7,xc+sw+.7,z,10.2,10.6,'#8a4b1c')}
function mbk(sd,z){ // เอ็มบีเค เซ็นเตอร์ (MBK Center - ปรับขนาดและตำแหน่งให้อยู่บนฟุตปาธริมทาง ไม่ล้ำเลนน้ำ)
  const xInner=sd*(BANK+1.6),w=10.5,xOuter=sd*(BANK+1.6+w);
  const a=Math.min(xInner,xOuter),b=Math.max(xInner,xOuter),H=24,dp=5.5;
  const xc=(a+b)/2;
  
  // อาคารหลักตั้งอยู่บนทางเท้า ปลอดภัยจากเลนน้ำ 100%
  fq(a,b,z,0,H,'#eae6df');
  vq(xInner,z,z-dp,0,H,'#cfc9be');
  hq(a,b,z,z-dp,H,'#b8b2a7');
  
  // ลวดลายตะแกรงสถาปัตยกรรม (Perforated Screen Pattern)
  const pMid=P(xc,z,H/2);
  if(pMid.s>4){
    for(let r=0;r<5;r++){
      const ly=3+r*4.2;
      fq(a+.6,b-.6,z,ly,ly+.12,'#cfc9be');
    }
  }

  // --- 1. กรอบวงรีสีฟ้าขนาดใหญ่ (The Iconic Large Curved Blue Oval Frame) ---
  const ovalY=15.5;
  const pOval=P(xc,z,ovalY);
  if(pOval.s>2.5){
    const rx=pOval.s*4.2,ry=pOval.s*2.6;
    ctx.fillStyle='#0277bd';
    ell(pOval.x,pOval.y,rx,ry);
    ctx.strokeStyle='#ffffff';ctx.lineWidth=Math.max(1.5,pOval.s*.12);
    ctx.stroke();

    // --- 2. จอ LED ยักษ์สี่เหลี่ยมด้านใน (Giant Animated LED Billboard) ---
    const scrW=rx*1.42,scrH=ry*1.32;
    const sx=pOval.x-scrW/2,sy=pOval.y-scrH/2;
    
    // อัปเดตสถานะอนิเมชันป้ายจอยักษ์แบบ Arcade (3-Frame Cycling Animation)
    const mbkFrame=Math.floor(S.t*.9)%3;

    // ฟังก์ชันจัดกึ่งกลางข้อความเชิงเรขาคณิต (Geometric Centering Method)
    // บังคับ textAlign = 'left', วัดขนาดจริงด้วย measureText, และคำนวณตำแหน่ง X ด้วยตนเอง (cx - width/2)
    // ป้องกันบั๊ก WebKit/CoreText ตัวอักษรและวรรณยุกต์ภาษาไทยเลื่อนหลุดกรอบ billboard
    const drawTextGeo = (str, cx, cy, font, col) => {
      ctx.save();
      ctx.font = font;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = col;
      const tw = ctx.measureText(str).width;
      ctx.fillText(str, cx - (tw / 2), cy);
      ctx.restore();
    };

    if(mbkFrame===0){
      // เฟรม 1: โลโก้ MBK CENTER ทางการ พื้นขาว ตัว K สีชมพูมาเจนต้าหางเฉียง
      ctx.fillStyle='#ffffff';
      ctx.fillRect(sx,sy,scrW,scrH);
      ctx.strokeStyle='#01579b';ctx.lineWidth=Math.max(1,pOval.s*.08);
      ctx.strokeRect(sx,sy,scrW,scrH);

      if(pOval.s>4.5){
        drawTextGeo('MB', pOval.x - scrW * 0.09, pOval.y - scrH * 0.08, `900 ${scrH*.42}px Mali,sans-serif`, '#1c1f26');
        drawTextGeo('K', pOval.x + scrW * 0.15, pOval.y - scrH * 0.08, `900 ${scrH*.42}px Mali,sans-serif`, '#d81b60');
        drawTextGeo('CENTER', pOval.x, pOval.y + scrH * 0.22, `900 ${scrH*.18}px sans-serif`, '#2b303c');
      }
    }else if(mbkFrame===1){
      // เฟรม 2: จอโฆษณา Cyber Neon Mega Sale สีสันสดใส
      ctx.fillStyle='#0a0e1c';
      ctx.fillRect(sx,sy,scrW,scrH);
      
      // เส้นสแกนไลน์ดิจิทัลกราฟิก (Equalizer Scanlines)
      for(let bar=0;bar<7;bar++){
        const bh=(Math.sin(S.t*12+bar*1.2)*.5+.5)*scrH*.5;
        ctx.fillStyle=bar%2===0?'#00e5ff':'#ff007f';
        ctx.fillRect(sx+(bar+.5)*(scrW/8),sy+scrH-bh-scrH*.1,scrW/10,bh);
      }
      if(pOval.s>4.5){
        drawTextGeo('MEGA SALE', pOval.x, pOval.y - scrH * 0.18, `900 ${scrH*.28}px Mali,sans-serif`, '#ffea00');
        drawTextGeo('UP TO 70% OFF', pOval.x, pOval.y + scrH * 0.2, `700 ${scrH*.16}px sans-serif`, '#ffffff');
      }
    }else{
      // เฟรม 3: สโลแกนท่องเที่ยวกรุงเทพฯ & ยินดีต้อนรับ (พื้นหลังส้ม-ชมพู)
      const gScr=ctx.createLinearGradient(sx,sy,sx+scrW,sy+scrH);
      gScr.addColorStop(0,'#f58220');gScr.addColorStop(1,'#d81b60');
      ctx.fillStyle=gScr;
      ctx.fillRect(sx,sy,scrW,scrH);

      if(pOval.s>4.5){
        drawTextGeo('ชีวิตดีๆ ที่ MBK', pOval.x, pOval.y - scrH * 0.1, `700 ${scrH*.25}px Mali,sans-serif`, '#ffffff');
        drawTextGeo('WELCOME TO BANGKOK', pOval.x, pOval.y + scrH * 0.2, `900 ${scrH*.16}px sans-serif`, '#ffea00');
      }
    }

    glow(pOval.x,pOval.y,pOval.s*2.2);
  }

  // --- 3. สะพานสกายวอล์กคนเดินยกระดับด้านหน้า (Elevated Pedestrian Skywalk) ---
  const swY0=3.6,swY1=4.8;
  fq(a+.2,b-.2,z+1.2,swY0,swY1,'#ffffff');
  fq(a+.2,b-.2,z+1.2,swY1,swY1+.5,'rgba(100,200,255,0.45)');
  for(let c=-1;c<=1;c++){
    const colX=xc+c*(w*.38);
    fq(colX-.3,colX+.3,z+1.2,0,swY0,'#e0e0e0');
  }
}

const LM=[wat,tower,elephant,victory,mbk,paragon,yao,swing];
function landmark(m,dist){if(m%14!==7)return;const L=m/14|0,z=dist-m*6-3;if(z>4||z<-93)return;LM[L%8](L&1?1:-1,z)}
/* ---------- ทางยกระดับรถไฟฟ้า BTS พาดข้ามถนน (BTS Skytrain Overpass - ทอดยาวเต็มความกว้างจอ) ---------- */
function drawBtsOverpass(bz,t){
  if(bz>7.5||bz<-85)return;
  const pCheck=P(0,bz,5.8);if(pCheck.s<1.2)return;
  const beamY0=5.4,beamY1=6.8,depth=3.2,zFar=bz-depth;
  
  // คำนวณ spanW ให้ครอบคลุมความกว้างจอทุกอัตราส่วน (Full Width Bridge - ไม่แหว่งด้านข้าง)
  const distCam=Math.max(0.5,CAM.z-bz);
  const spanW=Math.max(90,(W*distCam)/F+45+Math.abs(camX));
  
  // 1. เสาตอม่อคอนกรีต 2 เสาหลักริมคลอง + เสารองนอกเมือง
  for(const s of[-1,1]){
    const px1=s*(BANK+1.2),pw=.95;
    fq(px1-pw*.5,px1+pw*.5,bz,0,beamY0,'#8e96a4');
    vq(px1+s*pw*.5,bz,zFar,0,beamY0,'#757d8a');
    fq(px1-pw*.75,px1+pw*.75,bz,0,.9,'#5d6470');

    // เสารองฝั่งแผ่นดิน
    const px2=s*(BANK+13);
    fq(px2-pw*.5,px2+pw*.5,bz,0,beamY0,'#7d8592');
    vq(px2+s*pw*.5,bz,zFar,0,beamY0,'#676f7c');
  }
  
  // 2. ท้องคานสะพาน (Soffit) - ยกสูงโปร่งเหนือแม่น้ำที่ y = 5.4 ม. ทอดยาวสุดจอซ้าย-ขวา
  hq(-spanW,spanW,bz,zFar,beamY0,'#464c58');
  
  // 3. หน้าตัดคานด้านหน้าที่หันหาผู้เล่น
  fq(-spanW,spanW,bz,beamY0,beamY1,'#a8b2c0');
  fq(-spanW,spanW,bz,beamY0,beamY0+.14,'#7a8390');
  fq(-spanW,spanW,bz,beamY1-.14,beamY1,'#c5cfdc');
  
  // 4. แผ่นป้ายและข้อความ "กรุงเทพ…ชีวิตดีๆที่ลงตัว" บนคานรถไฟฟ้า (Realistic 3D Perspective Scaling & Universal Centering)
  const banY0=beamY0+.2,banY1=beamY1-.2,banYMid=(banY0+banY1)/2;
  const qMid=P(0,bz,banYMid); // จุดกึ่งกลาง 3D Projection ของสะพานและราง ณ ระยะ bz
  
  if(qMid.s>1.8){
    const textStr='กรุงเทพ…ชีวิตดีๆที่ลงตัว';
    // จุดกึ่งกลางร่วมกันสำหรับทั้งกล่อง (fillRect) และตัวหนังสือ (fillText) ในระบบพิกัด 3D Projection
    const centerX=qMid.x;
    const centerY=qMid.y;

    // คำนวณขนาดฟอนต์ตามระยะ 3D Perspective จริง (ขยายใหญ่ขึ้นอย่างสมจริงตามระยะที่เข้าใกล้ ไม่มีการลดขนาดหรือฝืนสเกล)
    const fontSize=Math.max(7,Math.round(0.42*qMid.s));
    ctx.font=`700 ${fontSize}px 'Mali','Noto Sans Thai','Sukhumvit Set','Thonburi',sans-serif`;
    ctx.textAlign='left';
    ctx.textBaseline='middle';

    const textW=ctx.measureText(textStr).width;
    const padX=Math.max(6,Math.round(0.30*qMid.s));
    const boxW=textW+padX*2;
    const boxH=Math.max(fontSize*1.35,(beamY1-beamY0)*0.65*qMid.s);
    const rectX=centerX-boxW*0.5;
    const rectY=centerY-boxH*0.5;

    // 1. วาดพื้นหลังกล่องสีน้ำเงิน (fillRect) กึ่งกลางอยู่ที่ centerX อย่างสมบูรณ์แบบ
    ctx.fillStyle='#0b5ca8';
    ctx.fillRect(rectX,rectY,boxW,boxH);

    // 2. เส้นขอบสีน้ำเงินเข้มรอบกล่อง
    ctx.strokeStyle='#00254d';
    ctx.lineWidth=Math.max(1,0.04*qMid.s);
    ctx.strokeRect(rectX,rectY,boxW,boxH);
    
    // 3. ขลิบแถบเส้นสีขาวบน-ล่างของแผ่นป้าย
    const stripeH=Math.max(1,0.035*qMid.s);
    ctx.fillStyle='#ffffff';
    ctx.fillRect(rectX,rectY,boxW,stripeH);
    ctx.fillRect(rectX,rectY+boxH-stripeH,boxW,stripeH);

    // 4. จุดไฟประดับสีขาวหัว-ท้ายป้ายเมื่อเข้ามาใกล้พอ (สมมาตรซ้าย-ขวาเท่ากันเป๊ะที่ระยะ padX*0.45 จากขอบ)
    if(qMid.s>6){
      ctx.fillStyle='#ffffff';
      circ(rectX+padX*0.45,centerY,Math.max(1.2,qMid.s*0.035));
      circ(rectX+boxW-padX*0.45,centerY,Math.max(1.2,qMid.s*0.035));
    }

    // 5. วาดตัวหนังสือสีขาว ขอบเงาสีน้ำเงินเข้ม
    // ใช้ textAlign = 'left' โดยกำหนดจุดเริ่มต้น X = rectX + padX
    // วิธีนี้ทำให้ข้อความเริ่มต้นที่ระยะ padX จากขอบซ้ายเสมอ และสิ้นสุดที่ระยะ padX จากขอบขวาเสมอ (boxW = textW + padX*2)
    // ขจัดบั๊กการคำนวณ Center Alignment ของ WebKit CoreText บน iPad/Safari ได้ 100% บนทุกแพลตฟอร์ม
    const textX=rectX+padX;
    ctx.lineWidth=Math.max(1.2,fontSize*0.14);
    ctx.strokeStyle='#00254d';
    ctx.strokeText(textStr,textX,centerY);
    ctx.fillStyle='#ffffff';
    ctx.fillText(textStr,textX,centerY);
  }
  
  // 5. ราวกั้นคอนกรีตบนสะพาน
  fq(-spanW,spanW,bz,beamY1,beamY1+.48,'#929baa');
  
  // 6. ขบวนรถไฟฟ้า BTS วิ่งบนรางยกระดับสูง (Animated BTS Skytrain)
  const trainCycle=14,trTime=(t%trainCycle);
  if(trTime<5.2){
    const trProg=trTime/5.2;
    const trStartX=-spanW-10,trEndX=spanW+10;
    const leadX=trStartX+trProg*(trEndX-trStartX+14);
    const carLen=3.8,carH=1.45,carY0=beamY1+.16;
    for(let c=0;c<4;c++){
      const cx1=leadX-c*(carLen+.3),cx2=cx1-carLen;
      if(cx1>-spanW-10&&cx2<spanW+10){
        const cl1=Math.max(-spanW,cx2),cl2=Math.min(spanW,cx1);
        if(cl2>cl1){
          fq(cl1,cl2,bz-.6,carY0,carY0+carH,'#f4f6f8');
          fq(cl1,cl2,bz-.6,carY0+carH*.45,carY0+carH*.62,'#002868');
          fq(cl1,cl2,bz-.6,carY0+carH*.28,carY0+carH*.42,'#ed1b24');
          const lit=cur.lt>.35;
          for(let w=0;w<3;w++){
            const wx1=cx2+.4+w*1.1,wx2=wx1+.8;
            if(wx1<spanW&&wx2>-spanW){
              fq(Math.max(-spanW,wx1),Math.min(spanW,wx2),bz-.6,carY0+carH*.55,carY0+carH*.9,lit?'#ffe894':'#2b3848');
            }
          }
          if(c===0&&cx1>-spanW&&cx1<spanW){
            const qHead=P(cx1,bz-.6,carY0+carH*.35);
            if(qHead.s>2){
              ctx.fillStyle='#fff4a0';circ(qHead.x,qHead.y,qHead.s*.12);
              glow(qHead.x,qHead.y,qHead.s*.8);
            }
          }
        }
      }
    }
  }
}

function render(al,fd){
  const s=S,run=s.state==='RUN',zoff=run?s.v*FIXED*al:0,dist=s.dist+zoff;
  ctx=mctx;ctx.setTransform(dpr,0,0,dpr,0,0);
  camX+=(s.duck.x*.4-camX)*Math.min(1,fd*4);
  tod(dist);
  ctx.save();
  const shk=(s.shake>0?s.shake*20:0)+clamp((s.tube.T-130)/130,0,1)*2;
  if(shk>0)ctx.translate((Math.random()-.5)*shk,(Math.random()-.5)*shk);
  skyline(s.t);
  ctx.fillStyle='#19a8e0';ctx.fillRect(-20,HZ,W+40,H-HZ+20);
  const seg=6,m0=Math.floor((dist-8)/seg),m1=Math.ceil((dist+90)/seg);
  WR.length=0;glows.length=0;wp[0]=wp[1]=null;
  const OVERPASS_GAP=280;
  const minBtsM=Math.floor((dist-8)/OVERPASS_GAP),maxBtsM=Math.ceil((dist+85)/OVERPASS_GAP);
  // 2. Layer 2: พื้นดิน ถนน ทางเท้า และผิวน้ำ (Ground, Street, Sidewalk, River Surface - Far to Near)
  for(let m=m1;m>=m0;m--){
    const fw=m*seg,zn=Math.min(dist-fw,7.2),zf=Math.max(dist-fw-seg,-90);if(zf>7.2||zn<-90)continue;
    const par=m&1,Z=zoneAt(fw);
    street(m,zn,zf);quad(-BANK,BANK,zn,zf,WC[Z][par]);
    for(let j=0;j<3;j++){const x1=(hash(m*5+j)*2-1)*3.6,zz=zn-seg*(.2+.28*j);hq(x1,x1+.8+hash(m*5+j+50)*1.6,zz,zz-.16,0,'rgba(255,255,255,.3)')}
    quad(-60,-BANK,zn,zf,GC[par]);quad(BANK,60,zn,zf,GC[par]);
  }

  // 3. Layer 3: โครงสร้าง 3 มิติ (Landmarks, Roadside Buildings, MRT Overpasses)
  // จัดกลุ่มและเรียงลำดับตามความลึกจริง (Strict Depth Sorting from Far to Near: a.z - b.z)
  // หากอยู่ในระนาบความลึกเดียวกัน ใช้ Sub-Layer Priority (Landmark [1] -> Roadside [2] -> Overpass [3])
  WORLD_ITEMS.length=0;

  // เพิ่มสะพานรถไฟฟ้า BTS/MRT ที่อยู่ในระยะสายตา
  for(let bm=maxBtsM;bm>=minBtsM;bm--){
    const bz=dist-bm*OVERPASS_GAP;
    if(bz>-85&&bz<=7.2){
      WORLD_ITEMS.push({
        z:bz,
        p:3, // สะพานลอยยกระดับพาดผ่านด้านหน้าอาคารในระยะ Z เดียวกัน
        f:()=>drawBtsOverpass(bz,s.t)
      });
    }
  }

  // เพิ่มแลนด์มาร์กและห้องแถวริมทางตามช่วงระยะ
  for(let m=m1;m>=m0;m--){
    const fw=m*seg,zn=Math.min(dist-fw,7.2),zf=Math.max(dist-fw-seg,-90);if(zf>7.2||zn<-90)continue;
    const par=m&1,Z=zoneAt(fw);
    const zMid=(zn+zf)/2;

    // แลนด์มาร์กฉากหลัง (Background Landmark - ตั้งอยู่ลึกบนตลิ่งด้านหลัง)
    if(m%14===7){
      const zLm=dist-m*6-3;
      if(zLm<=4&&zLm>=-93){
        WORLD_ITEMS.push({
          z:zLm,
          p:1, // อยู่ระนาบหลังสุดของฝั่งแผ่นดิน
          f:()=>landmark(m,dist)
        });
      }
    }

    // ห้องแถวริมทาง ร้านค้า และวิถีชีวิตบนทางเท้า (Roadside Buildings)
    WORLD_ITEMS.push({
      z:zMid,
      p:2, // อยู่ด้านหน้าแลนด์มาร์กฉากหลัง
      f:()=>{
        bldg(m,-1,zn,zf,Z,par);
        bldg(m,1,zn,zf,Z,par);
        roadside(m,dist);
      }
    });
  }

  // เรียงลำดับจาก ไกล -> ใกล้ (Far to Near: ascending Z)
  WORLD_ITEMS.sort((a,b)=>{
    if(Math.abs(a.z-b.z)>0.6)return a.z-b.z;
    return a.p-b.p;
  });
  for(let i=0;i<WORLD_ITEMS.length;i++)WORLD_ITEMS[i].f();
  post();
  drawWakes(zoff);
  const pl=.5+.5*Math.sin(s.t*10);
  s.obs.forEach(o=>{if(o.type==='speedboat'&&o.z+zoff<-2){const zb=o.z+zoff-1.4;hq(o.x-.85,o.x+.85,3,zb,0,`rgba(255,45,85,${.14+.16*pl})`);poly(P(o.x-.5,zb,0),P(o.x+.5,zb,0),P(o.x+2,zb-5,0),P(o.x-2,zb-5,0),'rgba(255,255,255,.5)')}});
  if(s.tuktukWarn){
    const tw=s.tuktukWarn,pulse=.5+.5*Math.sin(s.t*16);
    hq(tw.x-.85,tw.x+.85,7.2,3.2,0,`rgba(255,30,80,${.28+.28*pulse})`);
    for(let az=6.8;az>=3.6;az-=1.1){
      const pA=P(tw.x,az,0);
      if(pA.d>.8){
        ctx.fillStyle=`rgba(255,235,59,${.4+.5*pulse})`;
        ctx.font=`900 ${Math.max(16,pA.s*.45)}px Mali,sans-serif`;
        ctx.textAlign='center';
        ctx.fillText('▲',pA.x,pA.y);
      }
    }
  }
  if(s.taxiWarn){
    const tw=s.taxiWarn,pulse=.5+.5*Math.sin(s.t*16);
    hq(tw.x-.85,tw.x+.85,7.2,3.2,0,`rgba(34,197,94,${.28+.28*pulse})`);
    for(let az=6.8;az>=3.6;az-=1.1){
      const pA=P(tw.x,az,0);
      if(pA.d>.8){
        ctx.fillStyle=`rgba(187,247,208,${.4+.5*pulse})`;
        ctx.font=`900 ${Math.max(16,pA.s*.45)}px Mali,sans-serif`;
        ctx.textAlign='center';
        ctx.fillText('▲',pA.x,pA.y);
      }
    }
  }
  const d=s.duck,t=s.tube;
  const jy=lerp(s.jump.py,s.jump.y,run?al:1);
  const hb = getPlayerHitbox(s, run ? al : 1);
  const duckSortZ = (jy > 0.08) ? (hb.duck.z + 0.35) : hb.duck.z;

  D_QUEUE.length=0;
  for(let i=0;i<s.obs.length;i++){const o=s.obs[i];D_QUEUE.push({z:o.z+zoff,f:()=>drawObs(o,o.z+zoff)})}
  for(let i=0;i<s.vic.length;i++){const v=s.vic[i];D_QUEUE.push({z:v.z+zoff,f:()=>drawVic(v,v.z+zoff,s.t)})}
  if(s.isRidingTaxi){
    // ขยายขนาดตัวรถแท็กซี่ให้ใหญ่เต็มคัน สมจริงระดับรถยนต์จริง (Full-sized Vehicle Scale)
    // โดยไม่กระทบต่อขนาดปกติของเป็ดและห่วงยางหลังหมดเวลาบัฟ
    const taxiScale = 1.95;
    const taxiU = hb.duck.pd.s * taxiScale;
    D_QUEUE.push({z:hb.duck.z, f:()=>{
      drawTaxi(hb.duck.pd.x, hb.duck.pd.y - jy * taxiU, taxiU, null, jy);
    }});
  } else {
    // กะพริบถี่ๆ และแสดงเกราะสะท้อนแสงช่วงสถานะอมตะหลังลงจากแท็กซี่ (Post-Taxi Invincibility I-Frames)
    const isInvincible = s.invincibleTimer > 0;
    const blinkAlpha = isInvincible ? ((Math.floor(s.t * 22) % 2 === 0) ? 0.35 : 0.85) : 1.0;
    D_QUEUE.push({z:duckSortZ,f:()=>{
      if(isInvincible){
        ctx.save();
        ctx.globalAlpha = blinkAlpha;
        // วาดประกายเกราะคุ้มกันสีทองอ่อนรอบเป็ด
        ctx.strokeStyle = `rgba(255,225,50,${0.5 + 0.5 * Math.sin(s.t * 24)})`;
        ctx.lineWidth = Math.max(2, hb.duck.pd.s * 0.08);
        ctx.beginPath();
        ctx.ellipse(hb.duck.pd.x, hb.duck.pd.y - jy*hb.duck.pd.s - hb.duck.pd.s*0.35, hb.duck.pd.s*0.55, hb.duck.pd.s*0.48, 0, 0, 7);
        ctx.stroke();
      }
      drawDuck(hb.duck.pd,clamp(d.vx*.03,-.25,.25),jy);
      if(isInvincible){ ctx.restore(); }
    }});
    D_QUEUE.push({z:hb.tube.z,f:()=>{
      if(isInvincible){ ctx.save(); ctx.globalAlpha = blinkAlpha; }
      drawRope({x:hb.duck.pd.x,y:hb.duck.pd.y-jy*hb.duck.pd.s,s:hb.duck.pd.s},{x:hb.tube.pt.x,y:hb.tube.pt.y-jy*hb.tube.pt.s,s:hb.tube.pt.s},t.T);
      drawTube(hb.tube.pt,clamp(t.vx*.04,-.3,.3),s.pass,jy);
      if(isInvincible){ ctx.restore(); }
    }});
  }

  D_QUEUE.sort((a,b)=>a.z-b.z);
  for(let i=0;i<D_QUEUE.length;i++)D_QUEUE[i].f();
  drawSplashes(zoff);
  if(dbg){dbgCircle(hb.duck.x,hb.duck.z,hb.duck.r,'#3bd4ff',0);dbgCircle(hb.tube.x,hb.tube.z,hb.tube.r,'#ffe23b',0)}
  if(s.slow>0){ctx.fillStyle='rgba(255,255,255,.14)';ctx.fillRect(-20,-20,W+40,H+40)}
  ctx.restore();
  for(let i=s.fx.length-1;i>=0;i--){
    const f=s.fx[i];f.t+=fd;if(f.t>1.1){s.fx.splice(i,1);continue}
    const y=f.y-f.t*50;ctx.globalAlpha=1-f.t/1.1;ctx.font='700 24px Mali,sans-serif';ctx.textAlign='center';ctx.lineWidth=6;ctx.strokeStyle=INK;ctx.strokeText(f.txt,f.x,y);ctx.fillStyle=f.col;ctx.fillText(f.txt,f.x,y);ctx.globalAlpha=1;
  }

  // ฟังก์ชันจัดกึ่งกลางข้อความเชิงเรขาคณิต (Geometric Centering Method)
  // บังคับ textAlign = 'left' แล้วคำนวณตำแหน่งเริ่มต้น X ด้วย Math.round(cx - tw / 2)
  // ป้องกันบั๊ก WebKit/CoreText Font Rendering เลื่อนและกระตุกหลุดกึ่งกลาง 100%
  const drawGeoWarnText = (str, cx, cy, font, fillCol, strokeCol = null, strokeW = 0) => {
    ctx.save();
    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(str).width;
    const tx = Math.round(cx - tw / 2);
    const ty = Math.round(cy);
    if(strokeCol && strokeW > 0){
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = strokeW;
      ctx.lineJoin = 'round';
      ctx.strokeText(str, tx, ty);
    }
    ctx.fillStyle = fillCol;
    ctx.fillText(str, tx, ty);
    ctx.restore();
  };

  if(s.tuktukWarn){
    const tw=s.tuktukWarn,pulse=.5+.5*Math.sin(s.t*18);
    const boxW=168,boxH=38;
    const pTarget=P(tw.x,3.6,0);
    const warnX=clamp(pTarget.x,boxW/2+8,W-boxW/2-8);
    const warnY=H-34+Math.sin(s.t*22)*3;
    const rectX=Math.round(warnX-boxW/2);
    const rectY=Math.round(warnY-boxH/2);
    ctx.save();
    ctx.fillStyle=`rgba(225,29,72,${.88+.12*pulse})`;
    ctx.strokeStyle='#fef08a';ctx.lineWidth=3;
    ctx.beginPath();ctx.roundRect(rectX,rectY,boxW,boxH,10);ctx.fill();ctx.stroke();
    drawGeoWarnText('⚠️ ตุ๊กๆ ซิ่งจากหลัง!', warnX, warnY - 5, '900 14px Mali,sans-serif', '#ffffff', 'rgba(0,0,0,0.8)', 2.5);
    drawGeoWarnText('▲ ▲ ▲ หลบด่วน ▲ ▲ ▲', warnX, warnY + 9, '900 11px Mali,sans-serif', '#fde047', null, 0);
    ctx.restore();
  }
  if(s.taxiWarn){
    const tw=s.taxiWarn,pulse=.5+.5*Math.sin(s.t*16);
    const boxW=178,boxH=38;
    const pTarget=P(tw.x,3.6,0);
    const warnX=clamp(pTarget.x,boxW/2+8,W-boxW/2-8);
    const warnY=H-34+Math.sin(s.t*20)*3;
    const rectX=Math.round(warnX-boxW/2);
    const rectY=Math.round(warnY-boxH/2);
    ctx.save();
    ctx.fillStyle=`rgba(22,163,74,${.88+.12*pulse})`;
    ctx.strokeStyle='#86efac';ctx.lineWidth=3;
    ctx.beginPath();ctx.roundRect(rectX,rectY,boxW,boxH,10);ctx.fill();ctx.stroke();
    drawGeoWarnText('🚕 แท็กซี่เขียวเหลืองมาแล้ว!', warnX, warnY - 5, '900 14px Mali,sans-serif', '#ffffff', 'rgba(0,0,0,0.8)', 2.5);
    drawGeoWarnText('▲ ▲ ▲ ขึ้นฟรี (อมตะ) ▲ ▲ ▲', warnX, warnY + 9, '900 11px Mali,sans-serif', '#bbf7d0', null, 0);
    ctx.restore();
  }
  const isRunning = (s.state === 'RUN');
  if($('#btn-settings')){
    if($('#btn-settings').hidden === isRunning){
      $('#btn-settings').hidden = !isRunning;
    }
  }
  if($('#btn-skin')){
    if($('#btn-skin').hidden === isRunning){
      $('#btn-skin').hidden = !isRunning;
    }
  }
  if($('#bp')){
    const bl=s.state==='PAUSED'?'เล่นต่อ':(s.state==='COUNTDOWN'?'เตรียมพร้อม...':'หยุด');if($('#bp').textContent!==bl)$('#bp').textContent=bl;$('#bp').disabled=!(s.state==='RUN'||s.state==='PAUSED'||s.state==='COUNTDOWN');
  }
  const zz=zoneAt(s.dist);let zt='โซน '+(zz+1)+': '+ZN[zz]+' · '+cur.nm;
  if(s.isRidingTaxi){
    zt+=' · 🚖 นั่งแท็กซี่ ('+Math.ceil(s.taxiTimer)+'วิ)';
  } else if(s.invincibleTimer > 0){
    zt+=' · 🛡️ อมตะ ('+s.invincibleTimer.toFixed(1)+'วิ)';
  } else if(s.phase&&s.phase!==PHASES.NORMAL){
    const pName = (s.phase===PHASES.TRANSITION_BUFFER&&s.pendingSpecialPhase) ? ('เตรียมพร้อม: '+PHASE_INFO[s.pendingSpecialPhase].name) : (PHASE_INFO[s.phase]?.name || '');
    if(pName) zt+=' · ⚡ '+pName;
  }
  if($('#hz').textContent!==zt)$('#hz').textContent=zt;
  $('#hs').textContent=Math.floor(s.score);$('#hd').textContent=Math.floor(s.dist)+' ม. · '+s.v.toFixed(0)+' ม./วิ';
  $('#hc').textContent=s.combo>1?'คอมโบ x'+s.combo:'';$('#hr').textContent='ช่วยแล้ว '+s.rescued+' คน';
}

/* ---------- Game loop: fixed timestep + interpolation ---------- */
let acc=0,last=performance.now()/1000;
function frame(ms){
  const now=ms/1000,fd=Math.min(now-last,MAXF);last=now;
  if(S.state==='RUN'){
    S.t+=fd;acc+=fd;
    while(acc>=FIXED){savePrev();step(FIXED);acc-=FIXED;if(S.state!=='RUN')break}
  }
  if(S.state==='MENU')S.t+=fd;
  render(S.state==='RUN'?acc/FIXED:1,(S.state==='PAUSED'||S.state==='COUNTDOWN')?0:fd);
  requestAnimationFrame(frame);
}
newGame();showMenu();updateHighScoreUI();updateSkinDisplay();resize();requestAnimationFrame(frame);
})();