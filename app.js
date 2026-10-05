/**
 * ATM Free Transaction Counter - Complete Application Logic
 * Supports: Dual cards (Canara Bank for User & SBI for Mummy),
 * 5 free monthly limit, auto monthly reset, sound synthesis, haptic feedback,
 * confetti animation, transaction history, and localStorage persistence.
 */

// --- Default Configuration & State ---
const DEFAULT_CARDS = [
  {
    id: 'my_card',
    name: 'Naa ATM Card',
    bank: 'CANARA BANK',
    number: '•••• 4821',
    limit: 5,
    theme: 'canara'
  },
  {
    id: 'mummy_card',
    name: "Mummy's ATM Card",
    bank: 'SBI BANK',
    number: '•••• 8192',
    limit: 5,
    theme: 'sbi'
  }
];

const STORAGE_KEY = 'atm_counter_data_v2';
const SOUND_SETTING_KEY = 'atm_counter_sound_enabled';

// App State
let state = {
  cards: DEFAULT_CARDS,
  transactions: [], // Array of { id, cardId, timestamp, monthKey, amount, note }
  activeMonthKey: getCurrentMonthKey() // Format: 'YYYY-MM'
};

let soundEnabled = localStorage.getItem(SOUND_SETTING_KEY) !== 'false';

// Helper: Get 'YYYY-MM' string
function getCurrentMonthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// Format Month Display (e.g., "September 2026")
function formatMonthDisplay(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Load data from LocalStorage
function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('atm_counter_data_v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.cards && parsed.cards.length > 0) {
        state.cards = parsed.cards.map(c => {
          // Update default bank names if not customized
          if (c.id === 'my_card' && (!c.bank || c.bank === 'SBI BANK')) {
            c.bank = 'CANARA BANK';
          }
          if (c.id === 'mummy_card' && (!c.bank || c.bank === 'HDFC BANK')) {
            c.bank = 'SBI BANK';
          }
          return c;
        });
      }
      if (Array.isArray(parsed.transactions)) {
        state.transactions = parsed.transactions;
      }
    }
  } catch (err) {
    console.error('Error loading state from localStorage:', err);
  }
}

// Save state to LocalStorage and Cloud Database (Firebase)
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      cards: state.cards,
      transactions: state.transactions
    }));
  } catch (err) {
    console.error('Error saving state to localStorage:', err);
  }

  // Real-time Cloud Sync to Firebase Firestore
  if (typeof syncStateToCloud === 'function') {
    syncStateToCloud({
      cards: state.cards,
      transactions: state.transactions
    });
  }
}

// Callback when remote data updates arrive from Firebase Firestore
function handleRemoteCloudData(remoteData) {
  if (!remoteData) return;
  let hasChanges = false;

  if (Array.isArray(remoteData.cards) && remoteData.cards.length > 0) {
    state.cards = remoteData.cards;
    hasChanges = true;
  }
  if (Array.isArray(remoteData.transactions)) {
    state.transactions = remoteData.transactions;
    hasChanges = true;
  }

  if (hasChanges) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        cards: state.cards,
        transactions: state.transactions
      }));
    } catch (e) {}
    renderApp();
  }
}

// Haptic feedback for mobile phones
function triggerHaptic(type = 'light') {
  if (navigator.vibrate) {
    if (type === 'light') {
      navigator.vibrate(25);
    } else if (type === 'success') {
      navigator.vibrate([40, 60, 40]);
    } else if (type === 'warning') {
      navigator.vibrate([80, 50, 80]);
    }
  }
}

// --- Audio Effects (Web Audio API Synthesizer) ---
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSound(type) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.06);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.07);
      osc.frequency.setValueAtTime(783.99, now + 0.14);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'warning') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(180, now + 0.1);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.28);
    } else if (type === 'undo') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.1);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    }
  } catch (e) {
    console.warn('Audio play error:', e);
  }
}

// --- Confetti Particles Effect ---
const confettiCanvas = document.getElementById('confettiCanvas');
const confettiCtx = confettiCanvas ? confettiCanvas.getContext('2d') : null;
let confettiParticles = [];
let confettiAnimationId = null;

function resizeConfettiCanvas() {
  if (confettiCanvas) {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
}
window.addEventListener('resize', resizeConfettiCanvas);
resizeConfettiCanvas();

function triggerConfetti(originX, originY) {
  if (!confettiCtx) return;
  const colors = ['#0284c7', '#38bdf8', '#fbbf24', '#10b981', '#f59e0b', '#f43f5e', '#a855f7'];
  const count = 40;
  const x = originX || window.innerWidth / 2;
  const y = originY || window.innerHeight / 2;

  for (let i = 0; i < count; i++) {
    confettiParticles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.8) * 12,
      size: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 10
    });
  }

  if (!confettiAnimationId) {
    animateConfetti();
  }
}

function animateConfetti() {
  if (!confettiCtx) return;
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

  for (let i = confettiParticles.length - 1; i >= 0; i--) {
    const p = confettiParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.25;
    p.alpha -= 0.015;
    p.rotation += p.vRot;

    if (p.alpha <= 0 || p.y > window.innerHeight) {
      confettiParticles.splice(i, 1);
      continue;
    }

    confettiCtx.save();
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate((p.rotation * Math.PI) / 180);
    confettiCtx.globalAlpha = p.alpha;
    confettiCtx.fillStyle = p.color;
    confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    confettiCtx.restore();
  }

  if (confettiParticles.length > 0) {
    confettiAnimationId = requestAnimationFrame(animateConfetti);
  } else {
    confettiAnimationId = null;
  }
}

// --- Toast Notifications ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// --- Data Queries ---
function getMonthTransactions(monthKey = state.activeMonthKey) {
  return state.transactions.filter(t => t.monthKey === monthKey);
}

function getCardMonthCount(cardId, monthKey = state.activeMonthKey) {
  return getMonthTransactions(monthKey).filter(t => t.cardId === cardId).length;
}

function getCardMonthTransactions(cardId, monthKey = state.activeMonthKey) {
  return getMonthTransactions(monthKey).filter(t => t.cardId === cardId);
}

function getCardConfig(cardId) {
  return state.cards.find(c => c.id === cardId) || { id: cardId, name: 'Card', limit: 5 };
}

// --- Transaction Actions ---
function addTransaction(cardId, amount = 0, note = '', customTimestamp = null) {
  const now = customTimestamp ? new Date(customTimestamp) : new Date();
  const monthKey = getCurrentMonthKey(now);

  const newTx = {
    id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    cardId: cardId,
    timestamp: now.toISOString(),
    monthKey: monthKey,
    amount: Number(amount) || 0,
    note: (note || '').trim()
  };

  state.transactions.unshift(newTx);
  saveState();

  const newCount = getCardMonthCount(cardId, state.activeMonthKey);
  const cardConfig = getCardConfig(cardId);

  if (newCount <= cardConfig.limit) {
    playSound('success');
    triggerHaptic('success');
    triggerConfetti();
    const remaining = cardConfig.limit - newCount;
    showToast(`✅ ${cardConfig.name}: Transaction added! (${newCount}/5 - ${remaining} Free left)`, 'success');
  } else {
    playSound('warning');
    triggerHaptic('warning');
    const extra = newCount - cardConfig.limit;
    showToast(`⚠️ ${cardConfig.name}: 5 Free Limit Reached! Extra transaction #${extra} (Charges apply)`, 'danger');
  }

  renderApp();
}

function removeLastTransaction(cardId) {
  const cardTxs = getCardMonthTransactions(cardId, state.activeMonthKey);
  if (cardTxs.length === 0) {
    showToast(`ఈ నెలలో ${getCardConfig(cardId).name} కి ఎలాంటి లావాదేవీలు లేవు!`, 'warn');
    return;
  }

  const txToRemove = cardTxs[0];
  state.transactions = state.transactions.filter(t => t.id !== txToRemove.id);
  saveState();
  playSound('undo');
  triggerHaptic('light');
  showToast(`↩️ Last transaction removed (-1) from ${getCardConfig(cardId).name}`, 'info');
  renderApp();
}

function deleteTransactionById(txId) {
  const tx = state.transactions.find(t => t.id === txId);
  if (!tx) return;

  if (confirm(`ఈ లావాదేవీని ఖచ్చితంగా డిలీట్ చేయాలనుకుంటున్నారా?`)) {
    state.transactions = state.transactions.filter(t => t.id !== txId);
    saveState();
    playSound('undo');
    triggerHaptic('light');
    showToast('Transaction deleted', 'info');
    renderApp();
  }
}

// --- Render UI ---
function renderApp() {
  const activeMonth = state.activeMonthKey;
  const currentActualMonth = getCurrentMonthKey();
  const isViewingCurrentMonth = activeMonth === currentActualMonth;

  // 1. Month Bar
  const activeMonthDisplay = document.getElementById('activeMonthDisplay');
  const currentMonthBadge = document.getElementById('currentMonthBadge');
  if (activeMonthDisplay) {
    activeMonthDisplay.textContent = formatMonthDisplay(activeMonth);
  }
  if (currentMonthBadge) {
    if (isViewingCurrentMonth) {
      currentMonthBadge.textContent = 'Active Month (ప్రస్తుత నెల)';
      currentMonthBadge.style.color = 'var(--accent-cyan)';
    } else {
      currentMonthBadge.textContent = 'Archived Month (గత నెల రికార్డ్)';
      currentMonthBadge.style.color = 'var(--accent-amber)';
    }
  }

  // 2. Summary Pills
  let totalWithdrawn = 0;
  let totalFreeRemaining = 0;

  state.cards.forEach(card => {
    const used = getCardMonthCount(card.id, activeMonth);
    const limit = card.limit || 5;
    const remaining = Math.max(0, limit - used);
    totalFreeRemaining += remaining;
  });

  const monthTxs = getMonthTransactions(activeMonth);
  monthTxs.forEach(t => {
    totalWithdrawn += (Number(t.amount) || 0);
  });

  const totalFreeLeftPill = document.getElementById('totalFreeLeftPill');
  const totalWithdrawnPill = document.getElementById('totalWithdrawnPill');
  if (totalFreeLeftPill) {
    totalFreeLeftPill.textContent = `${totalFreeRemaining} / 10 Free`;
    if (totalFreeRemaining === 0) {
      totalFreeLeftPill.classList.remove('highlight-green');
      totalFreeLeftPill.style.color = 'var(--accent-red)';
    } else {
      totalFreeLeftPill.classList.add('highlight-green');
      totalFreeLeftPill.style.color = '';
    }
  }
  if (totalWithdrawnPill) {
    totalWithdrawnPill.textContent = `₹${totalWithdrawn.toLocaleString('en-IN')}`;
  }

  // 3. Render Each Card
  state.cards.forEach(card => {
    const cardId = card.id;
    const count = getCardMonthCount(cardId, activeMonth);
    const limit = card.limit || 5;
    const remaining = Math.max(0, limit - count);

    // Visual card elements
    const nameEl = document.getElementById(`nameDisplay_${cardId}`);
    const bankEl = document.getElementById(`bankDisplay_${cardId}`);
    const numberEl = document.getElementById(`numberDisplay_${cardId}`);
    if (nameEl) nameEl.textContent = card.name;
    if (bankEl) bankEl.textContent = card.bank;
    if (numberEl) numberEl.textContent = card.number;

    // Dashboard count
    const countEl = document.getElementById(`countDisplay_${cardId}`);
    const statusDotEl = document.getElementById(`statusDot_${cardId}`);
    const statusTextEl = document.getElementById(`statusText_${cardId}`);
    const warningBannerEl = document.getElementById(`warningBanner_${cardId}`);
    const warningMsgEl = document.getElementById(`warningMsg_${cardId}`);

    if (countEl) countEl.textContent = count;

    if (statusDotEl && statusTextEl) {
      statusDotEl.className = 'status-indicator';
      if (count === 0) {
        statusTextEl.textContent = `5 Free Transactions Available (5 మిగిలి ఉన్నాయి)`;
      } else if (count < 4) {
        statusTextEl.textContent = `${remaining} Free Left (${remaining} ఉచితం మిగిలాయి)`;
      } else if (count === 4) {
        statusDotEl.classList.add('status-warn');
        statusTextEl.textContent = `⚠️ Only 1 Free Left! (చివరి 1 ఉచితం)`;
      } else if (count === 5) {
        statusDotEl.classList.add('status-danger');
        statusTextEl.textContent = `🛑 Free Limit Reached! (5 పూర్తయ్యాయి)`;
      } else {
        statusDotEl.classList.add('status-danger');
        statusTextEl.textContent = `🛑 Extra Paid: ${count - limit} (ఛార్జీలు పడతాయి)`;
      }
    }

    // Step dots (1 to 5)
    const stepDotsContainer = document.getElementById(`quotaSteps_${cardId}`);
    if (stepDotsContainer) {
      const stepDots = stepDotsContainer.querySelectorAll('.step-dot');
      stepDots.forEach((dot, index) => {
        const stepNum = index + 1;
        dot.className = 'step-dot';
        if (count >= stepNum) {
          if (stepNum === 5) {
            dot.classList.add('limit-reached');
          } else if (stepNum === 4) {
            dot.classList.add('warning-step');
          } else {
            dot.classList.add('active');
          }
        }
      });
    }

    // Warning banner
    if (warningBannerEl) {
      if (count >= limit) {
        warningBannerEl.classList.remove('hidden');
        if (warningMsgEl) {
          if (count === limit) {
            warningMsgEl.textContent = `5 ఉచిత లావాదేవీలు పూర్తయ్యాయి! తర్వాతి ట్రాన్సాక్షన్లకు బ్యాంక్ ఛార్జ్ (₹21+GST) పడుతుంది.`;
          } else {
            warningMsgEl.textContent = `గమనిక: ఉచిత పరిమితి దాటింది. ఇప్పటికే ${count - limit} పెయిడ్ లావాదేవీలు జరిగాయి.`;
          }
        }
      } else {
        warningBannerEl.classList.add('hidden');
      }
    }
  });

  // 4. Render Transaction History
  renderHistoryList();
}

function renderHistoryList() {
  const container = document.getElementById('transactionList');
  const cardFilterSelect = document.getElementById('cardFilterSelect');
  const historyMonthSub = document.getElementById('historyMonthSub');
  if (!container) return;

  const selectedFilter = cardFilterSelect ? cardFilterSelect.value : 'all';
  const activeMonth = state.activeMonthKey;

  if (historyMonthSub) {
    historyMonthSub.textContent = `${formatMonthDisplay(activeMonth)} లో చేసిన లావాదేవీల రికార్డ్`;
  }

  let txs = getMonthTransactions(activeMonth);
  if (selectedFilter !== 'all') {
    txs = txs.filter(t => t.cardId === selectedFilter);
  }

  if (txs.length === 0) {
    container.innerHTML = `
      <div class="empty-history">
        <p>ఈ నెలకు ఎలాంటి లావాదేవీలు నమోదు కాలేదు.</p>
        <small style="color: var(--text-muted);">ATM వద్ద డ్రా చేసిన వెంటనే పైన ఉన్న <strong>+ 1 Transaction Done</strong> బటన్ నొక్కండి.</small>
      </div>
    `;
    return;
  }

  container.innerHTML = txs.map(tx => {
    const card = getCardConfig(tx.cardId);
    const dateObj = new Date(tx.timestamp);
    const formattedDate = dateObj.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
    const amountHtml = tx.amount > 0 ? `<div class="tx-amount">₹${tx.amount.toLocaleString('en-IN')}</div>` : '';
    const noteHtml = tx.note ? `<div class="tx-note">📍 ${escapeHtml(tx.note)}</div>` : '';

    return `
      <div class="tx-item">
        <div class="tx-left">
          <div class="tx-card-badge theme-${tx.cardId}">
            ${tx.cardId === 'my_card' ? 'YOU' : 'MOM'}
          </div>
          <div class="tx-details">
            <span class="tx-card-name">${escapeHtml(card.name)} <small style="opacity: 0.75; font-size: 0.72rem;">(${card.bank})</small></span>
            <span class="tx-meta">🕒 ${formattedDate}</span>
            ${noteHtml}
          </div>
        </div>
        <div class="tx-right">
          ${amountHtml}
          <button class="tx-delete-btn" onclick="deleteTransactionById('${tx.id}')" title="Delete record" aria-label="Delete">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// --- Month Switcher Logic ---
function shiftMonth(offset) {
  const [y, m] = state.activeMonthKey.split('-').map(Number);
  const date = new Date(y, m - 1 + offset, 1);
  state.activeMonthKey = getCurrentMonthKey(date);
  playSound('click');
  triggerHaptic('light');
  renderApp();
}

// --- Detail Modal Functions ---
function openDetailModal(cardId) {
  const card = getCardConfig(cardId);
  const modal = document.getElementById('addDetailModal');
  const title = document.getElementById('modalCardTitle');
  const cardIdInput = document.getElementById('modalCardId');
  const amountInput = document.getElementById('detailAmount');
  const noteInput = document.getElementById('detailNote');
  const dateTimeInput = document.getElementById('detailDateTime');

  if (!modal) return;

  title.textContent = `Add Transaction • ${card.name} (${card.bank})`;
  cardIdInput.value = cardId;
  amountInput.value = '';
  noteInput.value = '';

  const now = new Date();
  const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  dateTimeInput.value = localIso;

  modal.classList.remove('hidden');
  triggerHaptic('light');
  amountInput.focus();
}

function closeDetailModal() {
  const modal = document.getElementById('addDetailModal');
  if (modal) modal.classList.add('hidden');
}

// --- Settings Modal Functions ---
function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (!modal) return;

  state.cards.forEach(card => {
    const nameInp = document.getElementById(`settingName_${card.id}`);
    const bankInp = document.getElementById(`settingBank_${card.id}`);
    const numInp = document.getElementById(`settingNumber_${card.id}`);

    if (nameInp) nameInp.value = card.name;
    if (bankInp) bankInp.value = card.bank;
    if (numInp) numInp.value = card.number;
  });

  modal.classList.remove('hidden');
  triggerHaptic('light');
}

function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) modal.classList.add('hidden');
}

function saveSettings() {
  state.cards.forEach(card => {
    const nameInp = document.getElementById(`settingName_${card.id}`);
    const bankInp = document.getElementById(`settingBank_${card.id}`);
    const numInp = document.getElementById(`settingNumber_${card.id}`);

    if (nameInp && nameInp.value.trim()) card.name = nameInp.value.trim();
    if (bankInp && bankInp.value.trim()) card.bank = bankInp.value.trim();
    if (numInp && numInp.value.trim()) card.number = numInp.value.trim();
  });

  saveState();
  closeSettingsModal();
  showToast('Settings saved successfully!', 'success');
  playSound('click');
  triggerHaptic('success');
  renderApp();
}

// Export / Import Data
function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `atm_counter_backup_${getCurrentMonthKey()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Data exported successfully!', 'success');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported.cards && Array.isArray(imported.transactions)) {
        state.cards = imported.cards;
        state.transactions = imported.transactions;
        saveState();
        showToast('Data restored successfully!', 'success');
        renderApp();
      } else {
        alert('Invalid backup file structure.');
      }
    } catch (err) {
      alert('Failed to parse backup JSON file.');
    }
  };
  reader.readAsText(file);
}

// Reset current month transactions
function resetCurrentMonth() {
  const monthName = formatMonthDisplay(state.activeMonthKey);
  if (confirm(`ఖచ్చితంగా ${monthName} నెల లావాదేవీలను 0 కి రీసెట్ చేయాలనుకుంటున్నారా?`)) {
    state.transactions = state.transactions.filter(t => t.monthKey !== state.activeMonthKey);
    saveState();
    playSound('undo');
    triggerHaptic('light');
    showToast(`${monthName} transactions reset to 0`, 'info');
    closeSettingsModal();
    renderApp();
  }
}

// Mobile Card Filter Tab Switcher
function setupMobileCardTabs() {
  const tabBtns = document.querySelectorAll('.mobile-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      triggerHaptic('light');

      const target = btn.dataset.tab;
      const card1 = document.getElementById('cardContainer_my_card');
      const card2 = document.getElementById('cardContainer_mummy_card');

      if (target === 'all') {
        if (card1) card1.style.display = 'flex';
        if (card2) card2.style.display = 'flex';
      } else if (target === 'my_card') {
        if (card1) card1.style.display = 'flex';
        if (card2) card2.style.display = 'none';
      } else if (target === 'mummy_card') {
        if (card1) card1.style.display = 'none';
        if (card2) card2.style.display = 'flex';
      }
    });
  });
}

// --- Attach Event Listeners ---
function initEvents() {
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundOnIcon = document.getElementById('soundOnIcon');
  const soundOffIcon = document.getElementById('soundOffIcon');

  function updateSoundIcon() {
    if (soundOnIcon && soundOffIcon) {
      soundOnIcon.classList.toggle('hidden', !soundEnabled);
      soundOffIcon.classList.toggle('hidden', soundEnabled);
    }
  }
  updateSoundIcon();

  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      localStorage.setItem(SOUND_SETTING_KEY, soundEnabled);
      updateSoundIcon();
      if (soundEnabled) playSound('click');
      triggerHaptic('light');
      showToast(soundEnabled ? 'Sound Enabled 🔊' : 'Sound Muted 🔇', 'info');
    });
  }

  // Month navigation
  const prevMonthBtn = document.getElementById('prevMonthBtn');
  const nextMonthBtn = document.getElementById('nextMonthBtn');
  if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => shiftMonth(-1));
  if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => shiftMonth(1));

  // Card Buttons for Card 1 & Card 2
  state.cards.forEach(card => {
    const quickAddBtn = document.getElementById(`quickAddBtn_${card.id}`);
    const customAddBtn = document.getElementById(`customAddBtn_${card.id}`);
    const undoBtn = document.getElementById(`undoBtn_${card.id}`);

    if (quickAddBtn) {
      quickAddBtn.addEventListener('click', (e) => {
        const rect = quickAddBtn.getBoundingClientRect();
        triggerConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
        addTransaction(card.id);
      });
    }

    if (customAddBtn) {
      customAddBtn.addEventListener('click', () => openDetailModal(card.id));
    }

    if (undoBtn) {
      undoBtn.addEventListener('click', () => removeLastTransaction(card.id));
    }
  });

  // History Card Filter
  const cardFilterSelect = document.getElementById('cardFilterSelect');
  if (cardFilterSelect) {
    cardFilterSelect.addEventListener('change', renderHistoryList);
  }

  // Mobile Tabs
  setupMobileCardTabs();

  // Modal: Detail Add Form
  const addDetailForm = document.getElementById('addDetailForm');
  const closeDetailModalBtn = document.getElementById('closeDetailModalBtn');
  const cancelDetailBtn = document.getElementById('cancelDetailBtn');

  if (addDetailForm) {
    addDetailForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const cardId = document.getElementById('modalCardId').value;
      const amount = document.getElementById('detailAmount').value;
      const note = document.getElementById('detailNote').value;
      const datetime = document.getElementById('detailDateTime').value;

      addTransaction(cardId, amount, note, datetime);
      closeDetailModal();
    });
  }

  if (closeDetailModalBtn) closeDetailModalBtn.addEventListener('click', closeDetailModal);
  if (cancelDetailBtn) cancelDetailBtn.addEventListener('click', closeDetailModal);

  // Modal: Settings
  const settingsBtn = document.getElementById('settingsBtn');
  const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const resetCurrentMonthBtn = document.getElementById('resetCurrentMonthBtn');
  const exportDataBtn = document.getElementById('exportDataBtn');
  const importDataInput = document.getElementById('importDataInput');

  if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);
  if (closeSettingsModalBtn) closeSettingsModalBtn.addEventListener('click', closeSettingsModal);
  if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveSettings);
  if (resetCurrentMonthBtn) resetCurrentMonthBtn.addEventListener('click', resetCurrentMonth);
  if (exportDataBtn) exportDataBtn.addEventListener('click', exportData);
  if (importDataInput) importDataInput.addEventListener('change', importData);

  // Modal: Firebase Cloud Database
  const cloudSyncBadge = document.getElementById('cloudSyncBadge');
  const openFirebaseConfigBtn = document.getElementById('openFirebaseConfigBtn');
  const firebaseModal = document.getElementById('firebaseModal');
  const closeFirebaseModalBtn = document.getElementById('closeFirebaseModalBtn');
  const cancelFirebaseBtn = document.getElementById('cancelFirebaseBtn');
  const saveAndConnectFirebaseBtn = document.getElementById('saveAndConnectFirebaseBtn');
  const disconnectFirebaseBtn = document.getElementById('disconnectFirebaseBtn');

  function openFirebaseModal() {
    if (firebaseModal) {
      // Pre-fill fields if saved config exists
      const config = typeof getActiveFirebaseConfig === 'function' ? getActiveFirebaseConfig() : null;
      if (config) {
        document.getElementById('fbApiKey').value = config.apiKey || '';
        document.getElementById('fbProjectId').value = config.projectId || '';
        document.getElementById('fbAuthDomain').value = config.authDomain || '';
        document.getElementById('fbAppId').value = config.appId || '';
        
        if (config.apiKey && config.projectId) {
          document.getElementById('firebaseJsonConfig').value = JSON.stringify(config, null, 2);
        }
      }

      const fbBannerDot = document.getElementById('fbBannerDot');
      const fbBannerText = document.getElementById('fbBannerText');
      if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured()) {
        fbBannerDot.className = 'status-indicator status-dot-safe';
        fbBannerText.textContent = 'Firebase Cloud Synced & Active (డేటా క్లౌడ్‌లో సేఫ్ గా ఉంది)';
      } else {
        fbBannerDot.className = 'status-indicator status-dot-warn';
        fbBannerText.textContent = 'Local Mode Active (Firebase కనెక్ట్ చేయండి)';
      }

      firebaseModal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeFirebaseModal() {
    if (firebaseModal) {
      firebaseModal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  function handleSaveFirebase() {
    let config = {};
    const rawJson = document.getElementById('firebaseJsonConfig').value.trim();

    if (rawJson) {
      try {
        // Handle JS object format like apiKey: "..." or JSON format
        let cleaned = rawJson;
        if (cleaned.includes('const firebaseConfig =')) {
          cleaned = cleaned.replace(/const firebaseConfig\s*=\s*/, '').replace(/;$/, '');
        }
        // Normalize keys without quotes to valid JSON
        if (!cleaned.startsWith('{')) {
          const match = cleaned.match(/\{[\s\S]*\}/);
          if (match) cleaned = match[0];
        }
        // Try direct JSON.parse first, or function eval safely
        try {
          config = JSON.parse(cleaned);
        } catch (e) {
          // If relaxed JS object syntax
          config = Function('"use strict";return (' + cleaned + ')')();
        }
      } catch (err) {
        console.warn('Could not parse JSON snippet, checking manual fields:', err);
      }
    }

    // Fallback to manual input fields if not found in JSON
    if (!config.apiKey || !config.projectId) {
      config = {
        apiKey: document.getElementById('fbApiKey').value.trim(),
        projectId: document.getElementById('fbProjectId').value.trim(),
        authDomain: document.getElementById('fbAuthDomain').value.trim(),
        appId: document.getElementById('fbAppId').value.trim()
      };
    }

    if (!config.apiKey || !config.projectId) {
      alert('దయచేసి Firebase API Key మరియు Project ID తప్పనిసరిగా నమోదు చేయండి.');
      return;
    }

    if (typeof saveFirebaseConfig === 'function') {
      saveFirebaseConfig(config);
      showToast('Firebase Config Saved! Connecting...', 'info');
      closeFirebaseModal();

      if (typeof initFirebaseSync === 'function') {
        initFirebaseSync(handleRemoteCloudData).then(connected => {
          if (connected) {
            showToast('Cloud Database Connected! 🎉', 'success');
            // Immediately sync current state to cloud
            syncStateToCloud({
              cards: state.cards,
              transactions: state.transactions
            });
          } else {
            showToast('Firebase connection failed. Check credentials.', 'warning');
          }
        });
      }
    }
  }

  function handleDisconnectFirebase() {
    if (confirm('Firebase డిస్‌కనెక్ట్ చేయాలనుకుంటున్నారా? డేటా బ్రౌజర్ లోకల్ స్టోరేజ్ లో మాత్రమే ఉంటుంది.')) {
      if (typeof clearFirebaseConfig === 'function') {
        clearFirebaseConfig();
      }
      document.getElementById('firebaseJsonConfig').value = '';
      document.getElementById('fbApiKey').value = '';
      document.getElementById('fbProjectId').value = '';
      document.getElementById('fbAuthDomain').value = '';
      document.getElementById('fbAppId').value = '';
      showToast('Disconnected from Firebase (Local mode active)', 'info');
      closeFirebaseModal();
    }
  }

  if (cloudSyncBadge) cloudSyncBadge.addEventListener('click', openFirebaseModal);
  if (openFirebaseConfigBtn) {
    openFirebaseConfigBtn.addEventListener('click', () => {
      closeSettingsModal();
      openFirebaseModal();
    });
  }
  if (closeFirebaseModalBtn) closeFirebaseModalBtn.addEventListener('click', closeFirebaseModal);
  if (cancelFirebaseBtn) cancelFirebaseBtn.addEventListener('click', closeFirebaseModal);
  if (saveAndConnectFirebaseBtn) saveAndConnectFirebaseBtn.addEventListener('click', handleSaveFirebase);
  if (disconnectFirebaseBtn) disconnectFirebaseBtn.addEventListener('click', handleDisconnectFirebase);

  // Close modals on overlay backdrop click
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeDetailModal();
      closeSettingsModal();
      closeFirebaseModal();
    }
  });

  // Auto detect month roll-over in active tab
  setInterval(() => {
    const currentActual = getCurrentMonthKey();
    if (currentActual !== state.activeMonthKey) {
      state.activeMonthKey = currentActual;
      renderApp();
    }
  }, 60000);
}

// Window global helper for inline deletion
window.deleteTransactionById = deleteTransactionById;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  initEvents();
  renderApp();

  // Initialize Firebase Cloud Database Sync
  if (typeof initFirebaseSync === 'function') {
    initFirebaseSync(handleRemoteCloudData);
  }
});

