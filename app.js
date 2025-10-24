// app.js (ES module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, addDoc, getDocs, getDoc,
  onSnapshot, query, where, updateDoc, orderBy
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* ====== 1) Firebase config - ALMASHTIR ====== */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  // ... qolgan parametrlar
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ====== 2) DOM elements ====== */
const authSection = document.getElementById('authSection');
const dashboard = document.getElementById('dashboard');
const reportSection = document.getElementById('reportSection');

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const signinBtn = document.getElementById('signin');
const signupBtn = document.getElementById('signup');

const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logout');

const classSelect = document.getElementById('classSelect');
const newClassBtn = document.getElementById('newClassBtn');
const classTitle = document.getElementById('classTitle');

const studentName = document.getElementById('studentName');
const studentRoll = document.getElementById('studentRoll');
const addStudent = document.getElementById('addStudent');
const studentsWrap = document.getElementById('studentsWrap');

const attendanceDate = document.getElementById('attendanceDate');
const loadDate = document.getElementById('loadDate');

const reportBtn = document.getElementById('reportBtn');
const backDash = document.getElementById('backDash');
const reportStudent = document.getElementById('reportStudent');
const reportFrom = document.getElementById('reportFrom');
const reportTo = document.getElementById('reportTo');
const generateReport = document.getElementById('generateReport');
const reportResult = document.getElementById('reportResult');

const promptModal = document.getElementById('promptModal');
const promptText = document.getElementById('promptText');
const promptInput = document.getElementById('promptInput');
const promptOk = document.getElementById('promptOk');
const promptCancel = document.getElementById('promptCancel');

let currentUser = null;
let currentClassId = null;
let classesCache = [];

/* ====== Utility: show prompt modal ====== */
function ask(promptStr, defaultVal=''){
  return new Promise((res)=>{
    promptText.textContent = promptStr;
    promptInput.value = defaultVal;
    promptModal.classList.remove('hidden');
    promptInput.focus();
    const ok = () => { cleanup(); res(promptInput.value); };
    const cancel = () => { cleanup(); res(null); };
    function cleanup(){
      promptModal.classList.add('hidden');
      promptOk.removeEventListener('click', ok);
      promptCancel.removeEventListener('click', cancel);
    }
    promptOk.addEventListener('click', ok);
    promptCancel.addEventListener('click', cancel);
  })
}

/* ====== Auth handlers ====== */
signupBtn.addEventListener('click', async ()=>{
  const email = emailInput.value.trim();
  const pass = passwordInput.value.trim();
  if(!email || !pass){ alert('Email va parolni kiriting'); return; }
  try{
    const userCred = await createUserWithEmailAndPassword(auth, email, pass);
    // create minimal user doc
    await setDoc(doc(db, 'users', userCred.user.uid), {email, created: Date.now()});
    alert('Ro\'yxatdan o\'tildi');
  }catch(e){ alert(e.message) }
});

signinBtn.addEventListener('click', async ()=>{
  const email = emailInput.value.trim();
  const pass = passwordInput.value.trim();
  if(!email || !pass){ alert('Email va parolni kiriting'); return; }
  try{
    await signInWithEmailAndPassword(auth, email, pass);
  }catch(e){ alert(e.message) }
});

logoutBtn.addEventListener('click', ()=> signOut(auth));

onAuthStateChanged(auth, async user=>{
  currentUser = user;
  if(user){
    authSection.classList.add('hidden');
    dashboard.classList.remove('hidden');
    document.getElementById('userArea').innerHTML = `<span class="muted">${user.email}</span>`;
    await loadClasses();
  } else {
    authSection.classList.remove('hidden');
    dashboard.classList.add('hidden');
    reportSection.classList.add('hidden');
    document.getElementById('userArea').innerHTML = `<button id="loginBtn" class="btn primary">Kirish</button>`;
  }
});

/* ====== Classes: create & load ====== */
newClassBtn.addEventListener('click', async ()=>{
  const name = await ask('Sinf nomini kiriting (masalan: 7-A)');
  if(!name) return;
  const docRef = await addDoc(collection(db,'classes'),{
    name,
    owner: currentUser.uid,
    created: Date.now()
  });
  await loadClasses();
  classSelect.value = docRef.id;
  setClass(docRef.id);
});

async function loadClasses(){
  // olamiz — foydalanuvchining sinflari (owner==uid) yoki umumiy sinflar
  const q = query(collection(db,'classes'), where('owner','==', currentUser.uid));
  const snap = await getDocs(q);
  classesCache = [];
  classSelect.innerHTML = '';
  snap.forEach(d => {
    classesCache.push({id:d.id, ...d.data()});
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.data().name;
    classSelect.appendChild(opt);
  });
  if(classesCache.length>0){
    setClass(classesCache[0].id);
  } else {
    classTitle.textContent = 'Sinf yo‘q — yangi sinf yarating';
    studentsWrap.innerHTML = '<p class="muted">Sinf tanlanmagan</p>';
  }
}

classSelect.addEventListener('change', ()=> setClass(classSelect.value));

function setClass(id){
  currentClassId = id;
  const c = classesCache.find(x=>x.id===id);
  classTitle.textContent = c ? `Sinf: ${c.name}` : 'Sinf';
  loadStudents();
}

/* ====== Students management ====== */
addStudent.addEventListener('click', async ()=>{
  const name = studentName.value.trim();
  if(!name || !currentClassId){ alert('Ism va sinfni kiriting'); return; }
  const s = {name, roll: studentRoll.value.trim()||null, created: Date.now()};
  await addDoc(collection(db, `classes/${currentClassId}/students`), s);
  studentName.value=''; studentRoll.value='';
  await loadStudents();
});

async function loadStudents(){
  if(!currentClassId){ studentsWrap.innerHTML = '<p class="muted">Sinf tanlanmagan</p>'; return; }
  const snap = await getDocs(collection(db, `classes/${currentClassId}/students`));
  studentsWrap.innerHTML = '';
  reportStudent.innerHTML = '<option value="">-- tanlang --</option>';
  const students = [];
  snap.forEach(d=>{
    const data = {id:d.id,...d.data()};
    students.push(data);
    renderStudentCard(data);
  });
  // fill report student select
  students.forEach(s=>{
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    reportStudent.appendChild(opt);
  });
}

/* ====== render student card ====== */
function renderStudentCard(s){
  const el = document.createElement('div');
  el.className = 'student';
  el.id = 'stu-'+s.id;
  el.innerHTML = `
    <div class="row"><div><div class="name">${s.name}</div><div class="muted">#${s.roll||s.id.slice(0,4)}</div></div></div>
    <div class="status-row">
      <button class="sbtn keldi" data-status="keldi">Keldi</button>
      <button class="sbtn kech" data-status="kech">Kech</button>
      <button class="sbtn qoldi" data-status="qoldi">Qoldi</button>
    </div>
    <div class="muted small" id="stu-status-${s.id}">—</div>
  `;
  // attach handlers
  const [b1,b2,b3] = el.querySelectorAll('.sbtn');
  b1.onclick = ()=> setAttendance(s.id,'keldi');
  b2.onclick = ()=> setAttendance(s.id,'kech');
  b3.onclick = ()=> setAttendance(s.id,'qoldi');
  studentsWrap.appendChild(el);
  // load today's status
  displayAttendanceStatus(s.id);
}

/* ====== Attendance set/get ====== */
function getSelectedDateStr(){
  const d = attendanceDate.value ? new Date(attendanceDate.value) : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

loadDate.addEventListener('click', ()=> loadStudents()); // reload student cards for selected date

async function setAttendance(studentId, status){
  if(!currentClassId) return alert('Sinf tanlanmagan');
  const dateStr = getSelectedDateStr();
  const attDoc = doc(db, `classes/${currentClassId}/attendance`, dateStr);
  // get existing
  const existing = await getDoc(attDoc);
  let data = {};
  if(existing.exists()){
    data = existing.data();
  }
  // save as map: studentId -> {status, by, at}
  data[studentId] = {status, by: currentUser.uid, at: Date.now()};
  await setDoc(attDoc, data);
  displayAttendanceStatus(studentId);
}

async function displayAttendanceStatus(studentId){
  if(!currentClassId) return;
  const dateStr = getSelectedDateStr();
  const attDoc = doc(db, `classes/${currentClassId}/attendance`, dateStr);
  const snapshot = await getDoc(attDoc);
  const el = document.getElementById('stu-status-'+studentId);
  if(snapshot.exists()){
    const d = snapshot.data();
    const rec = d[studentId];
    if(rec){
      let label = '';
      if(rec.status==='keldi') label = 'Bugun: Keldi';
      if(rec.status==='kech') label = 'Bugun: Kech keldi';
      if(rec.status==='qoldi') label = 'Bugun: Dars qoldirdi';
      el.textContent = label;
    } else el.textContent = 'Belgilanmadi';
  } else el.textContent = 'Belgilanmadi';
}

/* ====== Reports ====== */
reportBtn.addEventListener('click', ()=> {
  dashboard.classList.add('hidden'); reportSection.classList.remove('hidden');
});

backDash.addEventListener('click', ()=> {
  reportSection.classList.add('hidden'); dashboard.classList.remove('hidden');
});

generateReport.addEventListener('click', async ()=>{
  const sid = reportStudent.value;
  if(!sid){ alert('O\'quvchini tanlang'); return; }
  const from = reportFrom.value ? new Date(reportFrom.value) : new Date(Date.now()-1000*60*60*24*30);
  const to = reportTo.value ? new Date(reportTo.value) : new Date();
  // normalize date strings
  const list = [];
  // iterate day by day
  for(let d=new Date(from); d<=to; d.setDate(d.getDate()+1)){
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const attDoc = doc(db, `classes/${currentClassId}/attendance`, dateStr);
    const snap = await getDoc(attDoc);
    if(snap.exists()){
      const rec = snap.data()[sid];
      if(rec) list.push({date:dateStr, status: rec.status});
    }
  }
  // summarize
  const total = list.length;
  const counts = {keldi:0, kech:0, qoldi:0};
  list.forEach(r => counts[r.status] = (counts[r.status]||0)+1);
  reportResult.innerHTML = `<p><strong>Natija:</strong> ${total} kun (Keldi: ${counts.keldi}, Kech: ${counts.kech}, Qoldi: ${counts.qoldi})</p>`;
  reportResult.innerHTML += `<ul>${list.map(r=>`<li>${r.date} — ${r.status}</li>`).join('')}</ul>`;
});

/* ====== small UX: date default today ====== */
attendanceDate.valueAsDate = new Date();
reportFrom.value = new Date(Date.now()-1000*60*60*24*30).toISOString().slice(0,10);
reportTo.value = new Date().toISOString().slice(0,10);

/* ====== initial load ====== */
/* nothing else needed - auth state listener will load classes */
