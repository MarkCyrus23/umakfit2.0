import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAgaLunqEf2gs6dSpF_sz1hV5XQ5Wm52jo',
  authDomain: 'umakfit-e3b1d.firebaseapp.com',
  projectId: 'umakfit-e3b1d',
  storageBucket: 'umakfit-e3b1d.appspot.com',
  messagingSenderId: '276569891504',
  appId: '1:276569891504:web:39b1732b519f4d8b785175',
};

function getFirebaseApp() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

function parseRolesFromMeta() {
  const meta = document.querySelector('meta[name="umakfit-roles"]');
  const raw = (meta?.content || '').trim();
  if (!raw) return null;
  const roles = raw
    .split(',')
    .map(r => r.trim().toLowerCase())
    .filter(Boolean);
  return roles.length ? roles : null;
}

function isPublicPage(roles) {
  return roles?.includes('public') || roles?.includes('any') || roles?.includes('*');
}

function buildUrl(relativePath) {
  return new URL(relativePath, window.location.href).toString();
}

function redirectTo(relativePath) {
  window.location.replace(buildUrl(relativePath));
}

function roleHome(role) {
  switch ((role || '').toLowerCase()) {
    case 'student':
      return '../student/studentDashboard.html';
    case 'professor':
      return '../professor/professor.html';
    case 'secretary':
      return '../secretary/secretary.html';
    case 'dean':
      return '../dean/dean.html';
    default:
      return '../login/index.html';
  }
}

async function resolveRoleFromFirestore(db, email) {
  const lowerEmail = (email || '').toLowerCase();
  if (!lowerEmail) return null;
  const emailKey = lowerEmail.replace(/\./g, '_');

  // 1) Fast path: users/<emailKey>
  try {
    const snap = await getDoc(doc(db, 'users', emailKey));
    if (snap.exists()) return (snap.data().role || '').toString().toLowerCase() || null;
  } catch (_) {}

  // 2) Query users by email
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('email', '==', lowerEmail)));
    if (!snap.empty) return (snap.docs[0].data().role || '').toString().toLowerCase() || null;
  } catch (_) {}

  // 3) Fall back to role collections by email
  const roleCollections = [
    { col: 'deans', role: 'dean' },
    { col: 'secretaries', role: 'secretary' },
    { col: 'professors', role: 'professor' },
    { col: 'students', role: 'student' },
  ];

  for (const rc of roleCollections) {
    try {
      const snap = await getDocs(query(collection(db, rc.col), where('email', '==', lowerEmail)));
      if (!snap.empty) return rc.role;
    } catch (_) {}
  }

  return null;
}

function getCachedRole(uid) {
  try {
    const raw = sessionStorage.getItem(`umakfit_role_${uid}`);
    return raw ? raw.toLowerCase() : null;
  } catch (_) {
    return null;
  }
}

function setCachedRole(uid, role) {
  try {
    sessionStorage.setItem(`umakfit_role_${uid}`, (role || '').toLowerCase());
  } catch (_) {}
}

async function enforceRoleGate() {
  const requiredRoles = parseRolesFromMeta();
  if (!requiredRoles) return; // If page didn't declare roles, do nothing (safe default).
  if (isPublicPage(requiredRoles)) return;

  const app = getFirebaseApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  onAuthStateChanged(auth, async user => {
    if (!user) {
      redirectTo('../login/index.html');
      return;
    }

    const cached = getCachedRole(user.uid);
    const role =
      cached ||
      (await resolveRoleFromFirestore(db, user.email || '')) ||
      null;

    if (role && !cached) setCachedRole(user.uid, role);

    const allowed = requiredRoles.includes(role);
    if (!allowed) {
      redirectTo(roleHome(role));
    }
  });
}

// Auto-run on import
enforceRoleGate();

