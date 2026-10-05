/**
 * Firebase Firestore Cloud Sync Module for ATM Transaction Counter
 * Handles real-time cloud synchronization, offline caching, and automatic fallback.
 */

// Default Firebase Configuration (Users can replace this or configure via UI)
window.FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// Storage key for user-provided Firebase config in localStorage
const FIREBASE_CONFIG_STORAGE_KEY = 'atm_counter_firebase_config';

// State variables for Firebase connection
let db = null;
let isCloudSyncActive = false;
let unsubscribeFirestoreListener = null;

/**
 * Get active Firebase config (from localStorage or window.FIREBASE_CONFIG)
 */
function getActiveFirebaseConfig() {
  try {
    const saved = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.projectId && parsed.apiKey) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read saved Firebase config:', e);
  }
  return window.FIREBASE_CONFIG;
}

/**
 * Check if Firebase configuration has valid credentials
 */
function isFirebaseConfigured() {
  const config = getActiveFirebaseConfig();
  return Boolean(config && config.apiKey && config.projectId && config.apiKey.trim() !== "" && config.projectId.trim() !== "");
}

/**
 * Save Firebase configuration to local storage
 */
function saveFirebaseConfig(config) {
  try {
    localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch (e) {
    console.error('Failed to save Firebase config:', e);
    return false;
  }
}

/**
 * Clear saved Firebase configuration
 */
function clearFirebaseConfig() {
  localStorage.removeItem(FIREBASE_CONFIG_STORAGE_KEY);
  if (unsubscribeFirestoreListener) {
    unsubscribeFirestoreListener();
    unsubscribeFirestoreListener = null;
  }
  db = null;
  isCloudSyncActive = false;
  updateCloudSyncStatusBadge('local');
}

/**
 * Initialize Firebase and Firestore Database
 */
async function initFirebaseSync(onRemoteDataReceived) {
  if (!isFirebaseConfigured()) {
    console.log('ℹ️ Firebase is not configured yet. Operating in LocalStorage mode.');
    updateCloudSyncStatusBadge('local');
    return false;
  }

  try {
    updateCloudSyncStatusBadge('syncing');
    const config = getActiveFirebaseConfig();

    // Check if Firebase SDK is loaded
    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK not loaded from CDN.');
      updateCloudSyncStatusBadge('error', 'Firebase SDK not loaded');
      return false;
    }

    // Initialize or get existing Firebase app
    let app;
    if (!firebase.apps || firebase.apps.length === 0) {
      app = firebase.initializeApp(config);
    } else {
      app = firebase.app();
    }

    db = firebase.firestore();

    // Setup real-time listener for app state
    setupFirestoreListener(onRemoteDataReceived);

    isCloudSyncActive = true;
    updateCloudSyncStatusBadge('connected');
    console.log('✅ Firebase Firestore connected successfully!');
    return true;
  } catch (error) {
    console.error('Firebase initialization error:', error);
    updateCloudSyncStatusBadge('error', error.message);
    isCloudSyncActive = false;
    return false;
  }
}

/**
 * Setup real-time document listener on Firestore
 */
function setupFirestoreListener(onRemoteDataReceived) {
  if (!db) return;

  if (unsubscribeFirestoreListener) {
    unsubscribeFirestoreListener();
  }

  const docRef = db.collection('atm_counter').doc('user_data');

  unsubscribeFirestoreListener = docRef.onSnapshot((doc) => {
    if (doc.exists) {
      const data = doc.data();
      if (data && onRemoteDataReceived) {
        onRemoteDataReceived(data);
        updateCloudSyncStatusBadge('connected');
      }
    } else {
      console.log('No cloud record found yet. Will create on next save.');
    }
  }, (error) => {
    console.warn('Firestore real-time listener error:', error);
    updateCloudSyncStatusBadge('offline');
  });
}

/**
 * Save current state directly to Firebase Firestore
 */
async function syncStateToCloud(stateData) {
  if (!isCloudSyncActive || !db) {
    return false;
  }

  try {
    updateCloudSyncStatusBadge('syncing');
    const docRef = db.collection('atm_counter').doc('user_data');
    
    await docRef.set({
      cards: stateData.cards,
      transactions: stateData.transactions,
      lastUpdated: new Date().toISOString(),
      appVersion: '2.0'
    }, { merge: true });

    updateCloudSyncStatusBadge('connected');
    return true;
  } catch (error) {
    console.error('Failed to sync data to Firestore:', error);
    updateCloudSyncStatusBadge('offline');
    return false;
  }
}

/**
 * Update UI Badge for Cloud Sync Status
 */
function updateCloudSyncStatusBadge(status, message) {
  const badge = document.getElementById('cloudSyncBadge');
  const text = document.getElementById('cloudSyncText');
  const dot = document.getElementById('cloudSyncDot');

  if (!badge || !text || !dot) return;

  badge.className = 'cloud-sync-badge';

  if (status === 'connected') {
    badge.classList.add('status-connected');
    text.textContent = 'Cloud Synced (ఆన్‌లైన్ సేఫ్)';
    badge.title = 'Firebase Firestore తో రియల్‌టైమ్ కనెక్ట్ అయింది. డేటా క్లౌడ్‌లో సేఫ్ గా ఉంది.';
  } else if (status === 'syncing') {
    badge.classList.add('status-syncing');
    text.textContent = 'Syncing...';
    badge.title = 'క్లౌడ్ డేటాబేస్ తో సింక్ అవుతోంది...';
  } else if (status === 'offline') {
    badge.classList.add('status-offline');
    text.textContent = 'Cloud Offline (స్థానికంగా సేవ్)';
    badge.title = 'ఇంటర్నెట్ లేదు / సర్వర్ ఆఫ్ లైన్. లోకల్ గా సేవ్ చేయబడింది.';
  } else if (status === 'error') {
    badge.classList.add('status-error');
    text.textContent = 'Cloud Config Error';
    badge.title = message || 'Firebase కనెక్షన్ లో లోపం ఉంది. సెట్టింగ్స్ చెక్ చేయండి.';
  } else {
    badge.classList.add('status-local');
    text.textContent = 'Local Mode (క్లౌడ్ కనెక్ట్ చేయండి)';
    badge.title = 'ప్రస్తుతం బ్రౌజర్ లోకల్ స్టోరేజ్ లో ఉంది. క్లౌడ్ డేటాబేస్ కనెక్ట్ చేయడానికి క్లిక్ చేయండి.';
  }
}
