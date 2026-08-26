import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, 'users'), where('email', '==', 'sidneyjc05@gmail.com'));
  const snap = await getDocs(q);
  if (snap.empty) {
    console.log("no user found");
  } else {
    snap.forEach(doc => console.log(JSON.stringify(doc.data(), null, 2)));
  }
  process.exit(0);
}
run();
