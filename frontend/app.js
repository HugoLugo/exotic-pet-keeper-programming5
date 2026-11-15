// Stage 3D.5.1: dashboard conditions come from the authoritative current-reading API.
// WebSocket notification events remain separate and transient (Stage 3D.4).
const assets = './public/assets/illustrations/animals/';
const feedings = []; // Recent feeding records load from Data Management.
const $ = (selector) => document.querySelector(selector);
function elem(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
let dashboardConditions = [];
let dashboardConditionsStatus = 'loading';
let dashboardConditionsFailed = 0;
// Stage 3D.5.1 follow-up: poll current conditions and refresh on WebSocket events.
// Keep notification events transient and REST readings authoritative.
const DASHBOARD_REFRESH_MS = 5000;
let dashboardConditionsRequest = 0;
let dashboardConditionEnclosures = null;
let dashboardRefreshTimer = null;
let dashboardEventRefreshTimer = null;

function stopDashboardRefresh() {
  if (dashboardRefreshTimer !== null) clearInterval(dashboardRefreshTimer);
  if (dashboardEventRefreshTimer !== null) clearTimeout(dashboardEventRefreshTimer);
  dashboardRefreshTimer = null;
  dashboardEventRefreshTimer = null;
  ++dashboardConditionsRequest; // Ignore responses from an older dashboard view.
}
function startDashboardRefresh() {
  if (dashboardRefreshTimer !== null) return;
  dashboardRefreshTimer = setInterval(() => {
    if (currentPage === 'dashboard' && !document.hidden) void refreshDashboardConditions();
  }, DASHBOARD_REFRESH_MS);
}
function refreshDashboardConditions() {
  if (currentPage !== 'dashboard' || document.hidden || !dashboardConditionEnclosures) return;
  return loadDashboardConditions(dashboardConditionEnclosures,dashboardRequest,true);
}
function scheduleDashboardEventRefresh() {
  if (currentPage !== 'dashboard' || document.hidden || !dashboardConditionEnclosures) return;
  if (dashboardEventRefreshTimer !== null) clearTimeout(dashboardEventRefreshTimer);
  dashboardEventRefreshTimer = setTimeout(() => {
    dashboardEventRefreshTimer = null;
    void refreshDashboardConditions();
  }, 150);
}

function dashboardReadingState(entry) {
  if (entry.error) return 'unavailable';
  const {enclosure,reading} = entry;
  if (!reading || reading.status === 'no_reading') return 'no_reading';
  if (!['normal','abnormal'].includes(reading.status) ||
      !Number.isFinite(reading.temperature) || !Number.isFinite(reading.humidity) ||
      Number(reading.enclosureId) !== Number(enclosure.id) ||
      reading.monitoringMode !== enclosure.monitoringMode ||
      reading.source !== (enclosure.monitoringMode === 'manual' ? 'manual' : 'sensor')) return 'unavailable';
  const recorded = enclosureMonitorDate(reading.recordedAt);
  if (!recorded) return 'unavailable';
  if (enclosure.monitoringMode === 'automatic' && Math.abs(Date.now() - recorded.getTime()) > MONITOR_STALE_MS) return 'stale';
  return reading.status;
}
function dashboardReadingTime(reading) {
  const date = enclosureMonitorDate(reading?.recordedAt);
  return date ? date.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}) : '—';
}
function dashboardMeasurement(value,unit) {
  return Number.isFinite(value) ? `${enclosureMonitorFormat(value)}${unit}` : '—';
}
function dashboardMessageCell(message) {
  const tr = elem('tr'); const td = elem('td','dashboard-reading-message',message); td.colSpan=5; tr.append(td); return tr;
}
function renderReadings() {
  const body=$('#readingsRows'); body.replaceChildren();
  if (dashboardConditionsStatus === 'loading') {body.append(dashboardMessageCell('Loading environmental readings…'));return;}
  if (dashboardConditionsStatus === 'error') {body.append(dashboardMessageCell('Unable to load enclosures. Check the Enclosure Service and reopen the Dashboard.'));return;}
  if (!dashboardConditions.length) {body.append(dashboardMessageCell('No enclosures yet. Add an enclosure to start monitoring.'));return;}
  const ordered=[...dashboardConditions].sort((a,b) => {
    const time = entry => enclosureMonitorDate(entry.reading?.recordedAt)?.getTime() ?? -Infinity;
    return time(b)-time(a) || Number(a.enclosure.id)-Number(b.enclosure.id);
  });
  for (const entry of ordered) {
    const {enclosure,reading}=entry;
    const state=dashboardReadingState(entry);
    const valid=['normal','abnormal','stale'].includes(state);
    const tr=elem('tr');
    const name=elem('td');
    name.append(elem('strong',null,enclosure.name || `Enclosure #${enclosure.id}`),
      elem('small',null,enclosure.monitoringMode === 'manual' ? 'Manual monitoring' : 'Automatic monitoring'));
    const temp=elem('td','value-cell',valid ? dashboardMeasurement(reading.temperature,' °C') : '—');
    const humidity=elem('td','value-cell',valid ? dashboardMeasurement(reading.humidity,'%') : '—');
    const labels={normal:'✓ Normal',abnormal:'⚠ Abnormal',stale:reading?.status === 'abnormal' ? '⚠ Stale · abnormal' : '◷ Stale',no_reading:'No reading',unavailable:'Unavailable'};
    const status=elem('td'); status.append(elem('span',`status ${state}`,labels[state]));
    tr.append(name,temp,humidity,status,elem('td','muted-cell',valid ? dashboardReadingTime(reading) : '—'));
    body.append(tr);
  }
}
function dashboardThresholdProblems(enclosure,reading) {
  const problems=[];
  const rules=[
    ['Temperature',reading.temperature,enclosure.minTemperature,enclosure.maxTemperature,' °C'],
    ['Humidity',reading.humidity,enclosure.minHumidity,enclosure.maxHumidity,'%']
  ];
  for (const [name,value,min,max,unit] of rules) {
    if (Number.isFinite(min) && value < min) problems.push(`${name} too low: ${dashboardMeasurement(value,unit)} · minimum ${dashboardMeasurement(min,unit)}`);
    if (Number.isFinite(max) && value > max) problems.push(`${name} too high: ${dashboardMeasurement(value,unit)} · maximum ${dashboardMeasurement(max,unit)}`);
  }
  return problems;
}
function renderAlerts() {
  const host=$('#alertItems'); host.replaceChildren();
  const count=$('#alertCount');
  if (dashboardConditionsStatus === 'loading') {count.textContent='—';host.append(elem('p','dashboard-alert-message','Checking enclosure conditions…'));return;}
  if (dashboardConditionsStatus === 'error') {count.textContent='—';host.append(elem('p','dashboard-alert-message','Unable to verify enclosure conditions. Check the Enclosure Service.'));return;}
  const abnormal=dashboardConditions.filter(entry => !entry.error && entry.reading?.status === 'abnormal' &&
    ['abnormal','stale'].includes(dashboardReadingState(entry)));
  // Count affected enclosures, not individual temperature/humidity violations.
  count.textContent=dashboardConditionsFailed ? `${abnormal.length}+` : String(abnormal.length);
  for (const {enclosure,reading} of abnormal) {
    const stale=dashboardReadingState({enclosure,reading}) === 'stale';
    const title=`${enclosure.name || `Enclosure #${enclosure.id}`} — ${stale ? 'Last sensor reading abnormal (stale)' :
      enclosure.monitoringMode === 'manual' ? 'Last manual observation abnormal' : 'Abnormal conditions'}`;
    const details=dashboardThresholdProblems(enclosure,reading);
    const row=elem('div','alert-item');row.append(elem('span','alert-icon','!'));
    const message=elem('div');message.append(elem('strong',null,title),elem('p',null,details.join(' · ') || 'Reading outside configured limits'),
      elem('small',null,dashboardReadingTime(reading)));row.append(message);host.append(row);
  }
  if (dashboardConditionsFailed) host.append(elem('p','dashboard-alert-message',`${dashboardConditionsFailed} enclosure ${dashboardConditionsFailed === 1 ? 'status' : 'statuses'} could not be checked. Alert count is a minimum.`));
  if (!abnormal.length && !dashboardConditionsFailed) host.append(elem('p','dashboard-alert-message',
    dashboardConditions.length ? 'No abnormal current or last-known readings. Stale normal readings do not confirm safe conditions.' : 'No enclosures to monitor yet.'));
}
async function loadDashboardConditions(enclosures,request,quiet=false) {
  const conditionsRequest = ++dashboardConditionsRequest;
  if (!quiet) {
    dashboardConditionsStatus='loading'; dashboardConditionsFailed=0;
    renderReadings(); renderAlerts();
  }
  const responses=await Promise.all(enclosures.map(async enclosure => {
    try {return {enclosure,reading:await getCollectionJson(`/api/enclosures/${encodeURIComponent(enclosure.id)}/readings/current`)};}
    catch(error) {console.warn(`Dashboard reading unavailable for enclosure ${enclosure.id}`,error);return {enclosure,error};}
  }));
  if (request !== dashboardRequest || conditionsRequest !== dashboardConditionsRequest || currentPage !== 'dashboard') return;
  dashboardConditions=responses;
  dashboardConditionsFailed=responses.filter(entry => dashboardReadingState(entry) === 'unavailable').length;
  dashboardConditionsStatus='ready';
  renderReadings();renderAlerts();
}
let dashboardPets = [];
let dashboardEnclosures = new Map();
let dashboardPetsStatus = 'loading';
let dashboardEnclosuresStatus = 'loading';
let dashboardRequest = 0;

function renderDashboardPets() {
  const host = $('#petsGrid');
  host.replaceChildren();
  const feedback = $('#noPets');
  feedback.hidden = true;
  if (dashboardPetsStatus === 'loading') { feedback.textContent = 'Loading your pets…'; feedback.hidden = false; return; }
  if (dashboardPetsStatus === 'error') { feedback.textContent = 'Unable to load pets. Check the Data Management Service and reload the Dashboard.'; feedback.hidden = false; return; }
  if (!dashboardPets.length) {
    feedback.textContent = 'No pets registered yet. Visit Pets to add your first companion.';
    feedback.hidden = false;
    return;
  }
  // Keep this overview to one row of three on desktop.
  const recent = [...dashboardPets].sort((a,b) => Number(b.id) - Number(a.id)).slice(0,3);
  for (const pet of recent) {
    const card = elem('button', 'pet-card dashboard-pet-link');
    card.type = 'button';
    card.setAttribute('aria-label', `View profile for ${pet.name || 'unnamed pet'}`);
    card.addEventListener('click', () => openPetDetails(pet.id));
    const imageBox = elem('div', 'pet-image');
    const filename = Object.hasOwn(approvedIllustrations,pet.illustration_key)
      ? approvedIllustrations[pet.illustration_key] : null;
    if (filename) {
      const image = elem('img');
      image.src = `${assets}${filename}`;
      image.alt = '';
      image.loading = 'lazy';
      if (pet.illustration_key === 'scorpion') image.classList.add('dashboard-pet-scorpion');
      image.addEventListener('error', () => imageBox.replaceChildren(elem('span','dashboard-pet-fallback','◇')), {once:true});
      imageBox.append(image);
    } else {
      imageBox.append(elem('span','dashboard-pet-fallback','◇'));
    }
    const info = elem('div','pet-info');
    const enclosure = pet.enclosure_id == null ? 'Unassigned'
      : dashboardEnclosures.get(Number(pet.enclosure_id)) || `Enclosure #${pet.enclosure_id}`;
    info.append(elem('strong',null,pet.name || 'Unnamed pet'),elem('span',null,pet.species || 'Unknown'),elem('small',null,`⌂  ${enclosure}`));
    card.append(imageBox,info);
    host.append(card);
  }
}

async function loadDashboardData() {
  const request = ++dashboardRequest;
  ++dashboardConditionsRequest;
  dashboardConditionEnclosures = null;
  dashboardPetsStatus = 'loading';
  dashboardEnclosuresStatus = 'loading';
  dashboardConditionsStatus = 'loading';
  renderReadings(); renderAlerts();
  $('#petCount').textContent = '—';
  $('#enclosureCount').textContent = '—';
  renderDashboardPets();
  const [petResult, enclosureResult] = await Promise.allSettled([
    getCollectionJson('/api/pets'),getCollectionJson('/api/enclosures')
  ]);
  if (request !== dashboardRequest) return;
  if (petResult.status === 'fulfilled' && Array.isArray(petResult.value)) {
    dashboardPets = petResult.value;
    dashboardPetsStatus = 'ready';
    $('#petCount').textContent = String(dashboardPets.length);
  } else {
    dashboardPetsStatus = 'error';
    $('#petCount').textContent = '—';
    console.error('Dashboard pets API unavailable',petResult.reason);
  }
  if (enclosureResult.status === 'fulfilled' && Array.isArray(enclosureResult.value)) {
    dashboardEnclosures = new Map(enclosureResult.value.map(item => [Number(item.id),item.name]));
    dashboardEnclosuresStatus = 'ready';
    $('#enclosureCount').textContent = String(enclosureResult.value.length);
  } else {
    dashboardEnclosuresStatus = 'error';
    $('#enclosureCount').textContent = '—';
    console.error('Dashboard enclosure API unavailable',enclosureResult.reason);
  }
  renderDashboardPets();
  if (request !== dashboardRequest || currentPage !== 'dashboard') return;
  if (enclosureResult.status === 'fulfilled' && Array.isArray(enclosureResult.value)) {
    dashboardConditionEnclosures = enclosureResult.value;
    void loadDashboardConditions(dashboardConditionEnclosures,request);
  } else {
    dashboardConditions=[];
    dashboardConditionsFailed=0;
    dashboardConditionsStatus='error';
    renderReadings();renderAlerts();
  }
}
function renderFeedings() {
  const host = $('#feedingRows'); host.replaceChildren();
  if (!feedings.length) host.append(elem('p','feeding-hint','Loading recent feeding records…'));
  feedings.forEach(({pet, food, time}) => {const row=elem('div','feeding-item'); const left=elem('div'); left.append(elem('strong',null,pet),elem('small',null,time)); row.append(left,elem('span','feeding-food',food)); host.append(row);});
}
let toastTimeout;
function toast(message) { const t = $('#toast'); t.textContent = message; t.hidden = false; clearTimeout(toastTimeout); toastTimeout = setTimeout(() => t.hidden = true, 4500); }
let pendingPetEditNavigation = null;
function navigate(page) {
  if (enclosureCreateSaving) return;
  if (!$('#enclosureCreatePage').hidden && enclosureFormDirty()) {
    pendingEnclosureNavigation = page;
    $('#enclosureDiscardDialog').showModal();
    return;
  }
  if (petSaving) return;
  if (petEditing) {
    if (isPetEditDirty()) {
      pendingPetEditNavigation = page;
      $('#petEditConfirm').showModal();
      return;
    }
    stopPetEdit();
  }
  const pages = {dashboard:['Dashboard','Overview of your pets, enclosures, and recent activity.'],pets:['Pets','Your animals and their care records.'],enclosures:['Enclosures','Habitats and environmental monitoring.'],alerts:['Alerts','Environmental conditions requiring attention.'],feeding:['Feeding','Log meals, build groups, and manage care records.']};
  if (!pages[page]) return;
  ++editStartRequest;
  currentPage = page;
  if (page !== 'dashboard') stopDashboardRefresh();
  petReturnEnclosureId = null;
  $('#main').classList.toggle('pets-active', page === 'pets');
  $('#main').classList.toggle('feeding-active', page === 'feeding');
  $('#main').classList.toggle('enclosures-active', page === 'enclosures');
  $('#dashboardContent').hidden = page !== 'dashboard';
  $('#petsPage').hidden = page !== 'pets';
  $('#enclosuresPage').hidden = page !== 'enclosures';
  $('#enclosureCreatePage').hidden = true;
  $('#enclosureDetailsPage').hidden = true;
  stopEnclosureMonitoring();
  stopEnclosureHistory();
  ++enclosureDetailsRequest;
  $('#feedingPage').hidden = page !== 'feeding';
  $('#addPetPage').hidden = true;
  $('#petDetailsPage').hidden = true;
  ++petDetailsRequest;
  $('#otherPage').hidden = page === 'dashboard' || page === 'pets' || page === 'feeding' || page === 'enclosures';
  $('#dashboardDemoBanner').hidden = true;
  $('#pageEyebrow').textContent = page === 'pets' ? 'PET MANAGEMENT' : page === 'feeding' ? 'CARE MANAGEMENT' : page === 'enclosures' ? 'HABITAT MANAGEMENT' : 'YOUR HABITAT AT A GLANCE';
  $('#pageTitle').textContent = pages[page][0]; $('#pageDescription').textContent = pages[page][1]; $('#otherTitle').textContent = `${pages[page][0]} page coming next`;
  document.querySelectorAll('.nav-link').forEach((link) => { const active = link.dataset.page === page; link.classList.toggle('active', active); if (active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current'); });
  $('#sidebar').classList.remove('open'); $('#menuButton').setAttribute('aria-expanded','false');
  // Navigation is a new view: never carry scroll position from the previous page.
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  if (page === 'pets') { setPetDeleteMode(false); loadPetsCollection(); }
  if (page === 'feeding') { loadFeedingWorkspace(); }
  if (page === 'enclosures') { loadEnclosuresCollection(); }
  if (page === 'dashboard') { loadDashboardData(); startDashboardRefresh(); }
}
renderReadings(); renderAlerts(); renderFeedings();
document.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.page)));
document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.go)));
$('#headerHome').addEventListener('click', () => navigate('dashboard'));
// Stage 3D.4 follow-up: live notifications, outage visibility and state reconciliation.
// Transient events are not durable history. REST readings remain the source of truth.
const notificationItems = [];
const notificationSeenIds = new Set();
let notificationSocket = null;
let notificationRetry = null;
let notificationAttempts = 0;
let notificationStopped = false;
let notificationConnectedAt = 0;
let notificationOutage = false;
let notificationGeneration = 0;
let notificationUnreadCount = 0;
function setNotificationConnection(message) { $('#notificationConnection').textContent = message; }
function updateNotificationBell() {
  const bell = $('#bell');
  const unread = $('#notificationUnread');
  const offline = $('#notificationOffline');
  unread.hidden = notificationUnreadCount === 0;
  unread.textContent = notificationUnreadCount > 9 ? '9+' : String(notificationUnreadCount);
  offline.hidden = !notificationOutage;
  bell.classList.toggle('has-notifications', notificationUnreadCount > 0);
  bell.classList.toggle('notifications-offline', notificationOutage);
  bell.setAttribute('aria-label', `Environmental notifications${notificationUnreadCount ? `, ${notificationUnreadCount} unread` : ''}${notificationOutage ? ', connection unavailable' : ''}`);
}
function setNotificationPanelOpen(open) {
  $('#notificationPanel').hidden = !open;
  $('#bell').setAttribute('aria-expanded', String(open));
  if (open) { notificationUnreadCount = 0; updateNotificationBell(); }
}
function renderNotificationItems() {
  const host = $('#notificationEvents'); host.replaceChildren();
  $('#notificationClear').disabled = notificationItems.length === 0;
  if (!notificationItems.length) {
    host.append(elem('p','notification-empty','No recent environmental notifications.'));
    return;
  }
  for (const item of notificationItems) {
    const system = item.type === 'notification_system';
    const recovery = item.status === 'recovered' || item.status === 'service_restored';
    const node = elem('div',`notification-event ${recovery ? 'is-recovery' : 'is-warning'}${system ? ' is-system' : ''}`);
    const heading = elem('strong',null,system ? item.message : `${item.enclosureName} — ${item.status === 'recovered' ? 'Conditions restored' : item.message}`);
    const detail = elem('p',null, system ? (item.detail || '') : `${enclosureMonitorFormat(item.temperature)} °C · ${enclosureMonitorFormat(item.humidity)}%`);
    const source = system ? (item.status === 'status_check' ? 'Enclosure status check' : 'Notification connection') :
      item.source === 'manual' ? 'Manual observation' : 'Automatic sensor';
    const time = elem('small',null,`${source} · ${new Date(item.emittedAt).toLocaleString()}`);
    node.append(heading, detail, time); host.append(node);
  }
}
function addNotification(item, unread = true) {
  if (notificationSeenIds.has(item.eventId)) return;
  notificationSeenIds.add(item.eventId);
  notificationItems.unshift(item);
  if (notificationItems.length > 20) notificationItems.length = 20;
  if (notificationSeenIds.size > 200) notificationSeenIds.delete(notificationSeenIds.values().next().value);
  renderNotificationItems();
  if (unread && $('#notificationPanel').hidden) notificationUnreadCount = Math.min(99,notificationUnreadCount+1);
  updateNotificationBell();
}
function addNotificationSystem(status, message, detail, unread = true) {
  addNotification({ type:'notification_system', status, message, detail,
    eventId:`system-${++notificationGeneration}`, emittedAt:new Date().toISOString() }, unread);
}
function receiveNotification(raw) {
  let event;
  try { event = JSON.parse(raw); } catch { return; }
  if (!event || event.type !== 'environment_alert' ||
      typeof event.eventId !== 'string' || !Number.isSafeInteger(event.enclosureId) || event.enclosureId <= 0 ||
      !['abnormal','recovered'].includes(event.status) || !['sensor','manual'].includes(event.source) ||
      typeof event.message !== 'string' || typeof event.enclosureName !== 'string' ||
      !Number.isFinite(event.temperature) || !Number.isFinite(event.humidity) ||
      !Number.isFinite(Date.parse(event.emittedAt))) return;
  const timestamp = Date.parse(event.emittedAt);
  if (timestamp < notificationConnectedAt - 2000 || timestamp > Date.now() + 30000) return;
  addNotification(event);
  scheduleDashboardEventRefresh();
}
// A REST snapshot is not replayed WebSocket history: show only verified abnormal states.
// In particular, a long-stale sensor reading is called 'last reported', not live.
async function reconcileNotificationStates(socket) {
  try {
    const enclosures = await getCollectionJson('/api/enclosures');
    if (!Array.isArray(enclosures)) throw new Error('Invalid enclosure list');
    const readings = await Promise.all(enclosures.map(async enclosure => {
      try { return { enclosure, reading: await getCollectionJson(`/api/enclosures/${enclosure.id}/readings/current`) }; }
      catch { return null; }
    }));
    if (notificationSocket !== socket || notificationStopped) return;
    let failed = 0;
    for (const entry of readings) {
      if (!entry) { failed++; continue; }
      const {enclosure,reading} = entry;
      if (reading.status !== 'abnormal' || !Number.isFinite(reading.temperature) || !Number.isFinite(reading.humidity)) continue;
      // Do not duplicate an abnormal event that arrived live while REST checks were running.
      if (notificationItems.some(item => item.type === 'environment_alert' && item.enclosureId === enclosure.id && item.status === 'abnormal' && Date.parse(item.emittedAt) >= notificationConnectedAt)) continue;
      const problems = [
        reading.temperature < enclosure.minTemperature ? 'Temperature too low' : null,
        reading.temperature > enclosure.maxTemperature ? 'Temperature too high' : null,
        reading.humidity < enclosure.minHumidity ? 'Humidity too low' : null,
        reading.humidity > enclosure.maxHumidity ? 'Humidity too high' : null
      ].filter(Boolean);
      const recent = Number.isFinite(Date.parse(reading.recordedAt)) && Date.now() - Date.parse(reading.recordedAt) < 20000;
      const label = reading.source === 'sensor' ? (recent ? 'Current sensor reading abnormal' : 'Last sensor reading abnormal (may be stale)') : 'Last manual observation abnormal';
      addNotificationSystem('status_check', `${enclosure.name} — ${label}`,
        `${problems.join(' and ') || 'Outside acceptable range'} · ${enclosureMonitorFormat(reading.temperature)} °C · ${enclosureMonitorFormat(reading.humidity)}%`);
    }
    if (failed) addNotificationSystem('status_check', 'Some enclosure statuses could not be checked', 'Open Enclosures to verify their conditions.');
  } catch {
    if (notificationSocket === socket && !notificationStopped) {
      addNotificationSystem('status_check', 'Could not verify enclosure conditions', 'Please check the Enclosures page manually.');
    }
  }
}
function connectNotifications() {
  if (notificationStopped || notificationSocket || typeof WebSocket === 'undefined') return;
  const url = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.hostname}:3004`;
  let socket;
  try { socket = new WebSocket(url); }
  catch { setNotificationConnection('Live notifications unavailable · Check enclosures'); return; }
  notificationSocket = socket;
  setNotificationConnection(notificationOutage ? 'Notifications offline · Retrying…' : 'Connecting to Notification Service…');
  socket.addEventListener('open', () => {
    if (notificationSocket !== socket) return;
    const recoveredConnection = notificationOutage;
    notificationOutage = false;
    notificationAttempts = 0;
    notificationConnectedAt = Date.now();
    setNotificationConnection('Connected · Live events');
    updateNotificationBell();
    scheduleDashboardEventRefresh();
    if (recoveredConnection) {
      addNotificationSystem('service_restored','Live notifications connected again','Checking current enclosure readings now.');
      void reconcileNotificationStates(socket);
    }
  });
  socket.addEventListener('message', event => { if (notificationSocket === socket) receiveNotification(event.data); });
  socket.addEventListener('close', () => {
    if (notificationSocket !== socket) return;
    notificationSocket = null;
    if (notificationStopped) return;
    if (!notificationOutage) {
      notificationOutage = true;
      addNotificationSystem('service_offline','Live notifications are unavailable','You may miss alerts during this outage. Check the Enclosures page; stored readings can still be available.');
    }
    setNotificationConnection('Live notifications offline · Check enclosures · Retrying…');
    updateNotificationBell();
    const delay = Math.min(30000, 1000 * 2 ** Math.min(notificationAttempts++, 5));
    notificationRetry = setTimeout(() => { notificationRetry = null; connectNotifications(); }, delay);
  });
  socket.addEventListener('error', () => { /* close handles retry; REST monitoring stays independent */ });
}
function stopNotifications() {
  notificationStopped = true;
  if (notificationRetry) clearTimeout(notificationRetry);
  notificationRetry = null;
  if (notificationSocket) { notificationSocket.close(); notificationSocket = null; }
}
$('#bell').addEventListener('click', () => setNotificationPanelOpen($('#notificationPanel').hidden));
$('#notificationClose').addEventListener('click', () => setNotificationPanelOpen(false));
// Clears only the browser's transient notification history, never sensor readings
// or server-side enclosure status. Keep seen event IDs to avoid duplicates.
$('#notificationClear').addEventListener('click', () => {
  notificationItems.length = 0;
  notificationUnreadCount = 0;
  renderNotificationItems();
  updateNotificationBell();
});
document.addEventListener('click', event => {
  if (!$('#notificationPanel').hidden && !$('#notificationContainer').contains(event.target)) setNotificationPanelOpen(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('#notificationPanel').hidden) { setNotificationPanelOpen(false); $('#bell').focus(); }
});
window.addEventListener('pagehide', () => {stopDashboardRefresh(); stopNotifications();});
window.addEventListener('pageshow', () => {
  if (notificationStopped) { notificationStopped = false; connectNotifications(); }
  if (currentPage === 'dashboard') {startDashboardRefresh(); scheduleDashboardEventRefresh();}
});
renderNotificationItems();
updateNotificationBell();
connectNotifications();
$('#menuButton').addEventListener('click', () => {const open = $('#sidebar').classList.toggle('open'); $('#menuButton').setAttribute('aria-expanded',String(open));});
$('#addPet').addEventListener('click', () => navigate('pets'));
$('#feedingHistory').addEventListener('click', () => navigate('feeding'));


// Pets collection backed by existing services. Dashboard pet overview is connected separately.
const approvedIllustrations = Object.freeze({
  gecko: 'leopard-gecko.webp',
  python: 'ball-python.webp',
  tarantula: 'tarantula.webp',
  scorpion: 'scorpion.webp'
});
let currentPage = 'dashboard';
let collectionPets = [];
let collectionEnclosures = new Map();
let collectionState = 'idle';
let collectionRequest = 0;

async function getCollectionJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status} requesting ${url}`);
  return response.json();
}

function collectionMessage(message, retry = false) {
  const box = $('#petsCollectionMessage');
  box.replaceChildren();
  box.append(elem('p', null, message));
  if (retry) {
    const button = elem('button', 'primary-button', 'Try again');
    button.type = 'button';
    button.addEventListener('click', loadPetsCollection);
    box.append(button);
  }
  box.hidden = false;
}

async function loadPetsCollection() {
  const request = ++collectionRequest;
  collectionState = 'loading';
  collectionMessage('Loading registered pets…');
  $('#petsCollectionGrid').replaceChildren();
  $('#petsResultsCount').textContent = '';
  try {
    const [petResults, enclosureResults] = await Promise.allSettled([
      getCollectionJson('/api/pets'),
      getCollectionJson('/api/enclosures')
    ]);
    if (request !== collectionRequest) return;
    if (petResults.status !== 'fulfilled' || !Array.isArray(petResults.value)) {
      throw new Error('Could not retrieve registered pets');
    }
    collectionPets = petResults.value;
    collectionEnclosures = enclosureResults.status === 'fulfilled' && Array.isArray(enclosureResults.value)
      ? new Map(enclosureResults.value.map(enclosure => [Number(enclosure.id), enclosure.name]))
      : new Map();
    collectionState = enclosureResults.status === 'fulfilled' && Array.isArray(enclosureResults.value)
      ? 'ready' : 'partial';
    renderPetsCollection();
  } catch (error) {
    if (request !== collectionRequest) return;
    console.error('Pets collection request failed:', error);
    collectionState = 'error';
    $('#petsCollectionGrid').replaceChildren();
    $('#petsResultsCount').textContent = '';
    collectionMessage('Unable to load pets. Check that the Data Management Service (port 3001) and the frontend development server are running.', true);
  }
}

function renderPetsCollection() {
  if (collectionState !== 'ready' && collectionState !== 'partial') return;
  const search = $('#petsPageSearch').value.trim().toLocaleLowerCase();
  const matches = collectionPets.filter(pet =>
    `${pet.name || ''} ${pet.species || ''}`.toLocaleLowerCase().includes(search)
  );
  const host = $('#petsCollectionGrid');
  host.replaceChildren();
  const message = $('#petsCollectionMessage');
  message.hidden = true;
  $('#petsResultsCount').textContent = `${matches.length} of ${collectionPets.length} pets`;
  if (collectionState === 'partial') {
    collectionMessage('Enclosure names are temporarily unavailable. Assigned enclosures are shown by ID.');
  }
  if (!collectionPets.length) {
    collectionMessage('No pets registered yet. You can add your first pet in Stage 2.');
    return;
  }
  if (!matches.length) {
    collectionMessage('No pets match your search. Try another name or species.');
    return;
  }
  const fragment = document.createDocumentFragment();
  matches.forEach(pet => {
    const card = elem('article', 'collection-pet-card');
    const imageBox = elem('div', 'collection-pet-art');
    const filename = Object.hasOwn(approvedIllustrations, pet.illustration_key)
      ? approvedIllustrations[pet.illustration_key] : null;
    if (filename) {
      const image = elem('img');
      image.src = `${assets}${filename}`;
      image.alt = `Selected illustration for ${pet.name}`;
      image.loading = 'lazy';
      image.addEventListener('error', () => {
        imageBox.replaceChildren(elem('span', 'collection-pet-fallback', '◇'));
      }, { once: true });
      if (pet.illustration_key === 'tarantula') image.classList.add('collection-art-tarantula');
      if (pet.illustration_key === 'scorpion') image.classList.add('collection-art-scorpion');
      imageBox.append(image);
    } else {
      imageBox.append(elem('span', 'collection-pet-fallback', '◇'));
      imageBox.setAttribute('aria-label', 'No illustration selected');
    }
    const content = elem('div', 'collection-pet-info');
    content.append(elem('h3', null, pet.name || 'Unnamed pet'));
    content.append(elem('p', 'collection-pet-species', pet.species || 'Species not specified'));
    const enclosure = pet.enclosure_id == null ? 'Unassigned'
      : collectionEnclosures.get(Number(pet.enclosure_id)) || `Enclosure #${pet.enclosure_id}`;
    content.append(elem('p', 'collection-pet-enclosure', `⌂  ${enclosure}`));
    const footer = elem('div', 'collection-pet-footer');
    footer.append(elem('span', 'collection-details-button', petDeleteMode ? 'Select to delete' : 'View profile →'));
    content.append(footer);
    card.append(imageBox, content);
    // One full-card button is easier to discover and keyboard-accessible.
    const openCard = elem('button', 'collection-card-action');
    openCard.type = 'button';
    openCard.setAttribute('aria-label', `${petDeleteMode ? 'Select to delete' : 'View profile for'} ${pet.name || 'unnamed pet'}`);
    openCard.addEventListener('click', () => petDeleteMode ? requestPetDeletion(pet) : openPetDetails(pet.id));
    card.append(openCard);
    fragment.append(card);
  });
  host.append(fragment);
}

$('#petsPageSearch').addEventListener('input', () => {
  renderPetsCollection();
});
$('#petsPageAddPet').addEventListener('click', openAddPetForm);

// Stage 3A — read-only pet details. Each profile is loaded by pet ID,
// rather than relying on potentially stale collection data.
let petDetailsRequest = 0;
let petDeleteMode = false;
let petDeleteTarget = null;
let petDeleteBusy = false;
function setPetDeleteMode(enabled) {
  petDeleteMode = enabled;
  $('#petsDeleteToggle').textContent = enabled ? 'Cancel' : 'Delete Pet';
  $('#petsCollectionGrid').classList.toggle('is-deleting', enabled);
  if (collectionState === 'ready' || collectionState === 'partial') renderPetsCollection();
}
$('#petsDeleteToggle').addEventListener('click', () => setPetDeleteMode(!petDeleteMode));
function requestPetDeletion(pet) {
  if (!pet || petDeleteBusy) return;
  petDeleteTarget = { id: Number(pet.id), name: pet.name || 'Unnamed pet' };
  $('#petDeleteText').textContent = `Permanently delete ${petDeleteTarget.name}? This will also permanently remove this pet’s feeding records and feeding group memberships. This cannot be undone.`;
  $('#petDeleteError').hidden = true;
  $('#petDeleteProceed').disabled = false;
  $('#petDeleteConfirm').showModal();
}
$('#petDeleteCancel').addEventListener('click', () => { if (!petDeleteBusy) $('#petDeleteConfirm').close(); });
$('#petDeleteConfirm').addEventListener('close', () => { if (!petDeleteBusy) petDeleteTarget = null; });
$('#petDeleteConfirm').addEventListener('cancel', event => { if (petDeleteBusy) event.preventDefault(); });
$('#petDeleteProceed').addEventListener('click', async () => {
  if (!petDeleteTarget || petDeleteBusy) return;
  petDeleteBusy = true;
  $('#petDeleteProceed').disabled = true;
  const target = petDeleteTarget;
  try {
    await enclosureApiRequest(`/api/pets/${target.id}`, 'DELETE');
    $('#petDeleteConfirm').close();
    petDeleteTarget = null;
    const inDetails = !$('#petDetailsPage').hidden && Number($('#petDetailsPage').dataset.petId) === target.id;
    if (inDetails) { activePet = null; petReturnEnclosureId = null; navigate('pets'); }
    else { setPetDeleteMode(false); await loadPetsCollection(); }
    toast(`${target.name} was permanently deleted.`);
  } catch (error) {
    $('#petDeleteError').hidden = false;
    $('#petDeleteError').textContent = error.message || 'Unable to delete pet. Please try again.';
  } finally { petDeleteBusy = false; $('#petDeleteProceed').disabled = false; }
});
$('#petDetailsDelete').addEventListener('click', () => {
  if (petEditing || petSaving || !activePet) return;
  requestPetDeletion(activePet);
});

function detailText(value, fallback = 'Not provided') {
  return value === null || value === undefined || String(value).trim() === ''
    ? fallback : String(value);
}
function detailBirthDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'Not provided';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}
function detailStatus(text, retryId = null) {
  const target = $('#petDetailsStatus');
  target.replaceChildren(elem('p', null, text));
  if (retryId !== null) {
    const retry = elem('button', 'primary-button', 'Try again');
    retry.type = 'button';
    retry.addEventListener('click', () => openPetDetails(retryId));
    target.append(retry);
  }
  target.hidden = false;
}
function showDetailField(label, value) {
  const field = elem('div', 'pet-details-field');
  field.append(elem('dt', null, label), elem('dd', null, value));
  return field;
}
function renderDetailsProfile(pet) {
  $('#petDetailsStatus').hidden = true;
  $('#petDetailsContent').hidden = false;
  $('#petDetailsName').textContent = pet.name;
  $('#petDetailsSpecies').textContent = detailText(pet.species, 'Unknown');
  const enclosure = pet.enclosure_id == null ? 'Unassigned'
    : collectionEnclosures.get(Number(pet.enclosure_id)) || `Enclosure #${pet.enclosure_id}`;
  $('#petDetailsEnclosure').textContent = enclosure;
  const art = $('#petDetailsArtwork');
  art.replaceChildren();
  const filename = Object.hasOwn(approvedIllustrations, pet.illustration_key)
    ? approvedIllustrations[pet.illustration_key] : null;
  if (filename) {
    const img = elem('img');
    img.src = `${assets}${filename}`;
    img.alt = `Selected illustration for ${pet.name}`;
    if (pet.illustration_key === 'tarantula') img.classList.add('collection-art-tarantula');
    img.addEventListener('error', () => art.replaceChildren(elem('span', 'collection-pet-fallback', '◇')), {once:true});
    art.append(img);
  } else {
    art.append(elem('span', 'collection-pet-fallback', '◇'));
  }
  const info = $('#petDetailsFacts');
  info.replaceChildren(
    showDetailField('Gender', detailText(pet.gender, 'Unknown').replace(/^./, c => c.toUpperCase())),
    showDetailField('Date of birth', detailBirthDate(pet.date_of_birth)),
    showDetailField('Enclosure', enclosure)
  );
  $('#petDetailsNotes').textContent = detailText(pet.notes, 'No notes added yet.');
}
function renderDetailsFeedings(rows) {
  const host = $('#petDetailsFeedings');
  host.replaceChildren();
  $('#petDetailsFeedingCount').textContent = `${rows.length} record${rows.length === 1 ? '' : 's'}`;
  if (!rows.length) {
    host.append(elem('p', 'pet-details-empty', 'No feeding records yet. Use Add Feeding to log the first meal.'));
    return;
  }
  for (const feeding of rows) {
    const item = elem('article', 'pet-details-feeding');
    const left = elem('div');
    left.append(elem('strong', null, detailText(feeding.food, 'Feeding')),
      elem('small', null, detailText(feeding.feeding_date, 'Date not provided')));
    const actions = elem('div','feeding-entry-actions');
    const edit = elem('button','text-button','Edit'); edit.type='button'; edit.addEventListener('click',()=>openFeedingRecord('edit',feeding));
    const del = elem('button','text-button feeding-danger','Delete'); del.type='button'; del.addEventListener('click',()=>deleteFeedingRecord(feeding));
    actions.append(edit,del);
    item.append(left,actions);
    if (feeding.notes) item.append(elem('p', null, feeding.notes));
    host.append(item);
  }
}
let petReturnEnclosureId = null;
async function openPetDetails(id) {
  if (petSaving || petEditing) return;
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) return;
  const request = ++petDetailsRequest;
  ++editStartRequest;
  $('#petDetailsPage').dataset.petId = String(id);
  currentPage = 'pets';
  $('#main').classList.add('pets-active');
  $('#main').classList.remove('feeding-active');
  $('#dashboardContent').hidden = true;
  $('#dashboardDemoBanner').hidden = true;
  $('#petsPage').hidden = true;
  $('#addPetPage').hidden = true;
  $('#otherPage').hidden = true;
  $('#petDetailsPage').hidden = false;
  $('#enclosureDetailsPage').hidden = true;
  stopEnclosureMonitoring();
  stopEnclosureHistory();
  ++enclosureDetailsRequest;
  $('#enclosuresPage').hidden = true;
  $('#enclosureCreatePage').hidden = true;
  $('#feedingPage').hidden = true;
  $('#pageEyebrow').textContent = 'PET MANAGEMENT';
  $('#pageTitle').textContent = 'Pet Details';
  $('#pageDescription').textContent = 'Your companion’s profile and feeding history.';
  $('#petDetailsContent').hidden = true;
  $('#petDetailsEdit').disabled = true;
  $('#petDetailsDelete').disabled = true;
  detailStatus('Loading pet profile…');
  document.querySelectorAll('.nav-link').forEach(link => {
    const active = link.dataset.page === 'pets';
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
  $('#sidebar').classList.remove('open');
  $('#menuButton').setAttribute('aria-expanded', 'false');
  window.scrollTo(0,0);
  try {
    const [petResult, feedingResult, enclosureResult] = await Promise.allSettled([
      getCollectionJson(`/api/pets/${id}`),
      getCollectionJson(`/api/pets/${id}/feedings`),
      getCollectionJson('/api/enclosures')
    ]);
    if (request !== petDetailsRequest) return;
    if (petResult.status !== 'fulfilled' || !petResult.value || !petResult.value.id) {
      throw new Error('Pet profile could not be loaded. The pet may have been deleted or the service is unavailable.');
    }
    if (enclosureResult.status === 'fulfilled' && Array.isArray(enclosureResult.value)) {
      collectionEnclosures = new Map(enclosureResult.value.map(e => [Number(e.id), e.name]));
    }
    activePet = petResult.value;
    $('#petDetailsEdit').disabled = false;
    $('#petDetailsDelete').disabled = false;
    renderDetailsProfile(petResult.value);
    if (feedingResult.status === 'fulfilled' && Array.isArray(feedingResult.value)) {
      renderDetailsFeedings(feedingResult.value);
      $('#petDetailsFeedingError').hidden = true;
    } else {
      $('#petDetailsFeedings').replaceChildren();
      $('#petDetailsFeedingCount').textContent = '';
      $('#petDetailsFeedingError').hidden = false;
    }
  } catch (error) {
    if (request !== petDetailsRequest) return;
    console.error('Pet details could not be loaded:', error);
    $('#petDetailsContent').hidden = true;
    detailStatus(error.message || 'Unable to load the pet profile.', Number(id));
  }
}
$('#petDetailsClose').addEventListener('click', () => { if (petEditing) requestCancelPetEdit(); else if (petReturnEnclosureId) { const id = petReturnEnclosureId; petReturnEnclosureId = null; openEnclosureDetails(id); } else navigate('pets'); });
$('#petDetailsRetryFeedings').addEventListener('click', () => {
  const id = Number($('#petDetailsPage').dataset.petId);
  if (id > 0) openPetDetails(id);
});



// Stage 2B — Add Pet form connected to the existing Data Management API.
let selectedNewPetIllustration = null;
let addPetSaving = false;
let addPetEnclosureRequest = 0;
const illustrationChoices = [
  {key:null, label:'No Illustration', filename:null},
  {key:'gecko', label:'Gecko', filename:approvedIllustrations.gecko},
  {key:'python', label:'Python', filename:approvedIllustrations.python},
  {key:'tarantula', label:'Tarantula', filename:approvedIllustrations.tarantula},
  {key:'scorpion', label:'Scorpion', filename:approvedIllustrations.scorpion}
];

function syncNewPetPortrait() {
  const current = illustrationChoices.find(choice => choice.key === selectedNewPetIllustration);
  const image = $('#addPetPortraitImage');
  const fallback = $('#addPetPortraitFallback');
  if (current.filename) {
    image.src = `${assets}${current.filename}`;
    image.alt = `${current.label} illustration`;
    image.hidden = false;
    fallback.hidden = true;
    $('#illustrationSelectionLabel').textContent = `${current.label} illustration selected. You can change it anytime.`;
  } else {
    image.removeAttribute('src');
    image.hidden = true;
    fallback.hidden = false;
    $('#illustrationSelectionLabel').textContent = 'No illustration selected — neutral placeholder will be used.';
  }
  document.querySelectorAll('.illustration-option').forEach(button => {
    const chosen = button.dataset.key === (selectedNewPetIllustration || 'none');
    button.classList.toggle('selected', chosen);
    button.setAttribute('aria-pressed', String(chosen));
  });
}

function populateAddPetIllustrations() {
  const host = $('#illustrationOptions');
  host.replaceChildren();
  illustrationChoices.forEach(choice => {
    const button = elem('button', 'illustration-option');
    button.type = 'button';
    button.dataset.key = choice.key || 'none';
    const art = elem('span', 'illustration-option-art');
    if (choice.filename) {
      const image = elem('img');
      image.src = `${assets}${choice.filename}`;
      image.alt = '';
      if (choice.key === 'tarantula') image.classList.add('collection-art-tarantula');
      art.append(image);
    } else art.append(elem('span', 'collection-pet-fallback', '◇'));
    button.append(art, elem('strong', null, choice.label));
    button.addEventListener('click', () => {
      if (petEditing) {
        selectedEditPetIllustration = choice.key;
        syncEditPetPortrait();
      } else {
        selectedNewPetIllustration = choice.key;
        syncNewPetPortrait();
      }
      $('#illustrationDialog').close();
      (petEditing ? $('#editIllustrationPickerOpen') : $('#illustrationPickerOpen')).focus();
    });
    host.append(button);
  });
  syncNewPetPortrait();
}

// Keep the actual select values in place for Stage 2B form submission.
// The visible listboxes replace platform-styled native dropdown popups.
function createAddPetDropdown(selectId, triggerId, listId) {
  const select = document.getElementById(selectId);
  const trigger = document.getElementById(triggerId);
  const list = document.getElementById(listId);
  const isOpen = () => trigger.getAttribute('aria-expanded') === 'true';
  function close(restoreFocus = false) {
    trigger.setAttribute('aria-expanded', 'false');
    list.hidden = true;
    if (restoreFocus) trigger.focus();
  }
  function render() {
    list.replaceChildren();
    const selected = select.options[select.selectedIndex];
    trigger.querySelector('.add-pet-select-value').textContent = selected ? selected.text : '';
    Array.from(select.options).forEach((option, index) => {
      const item = elem('button', 'add-pet-option', option.text);
      item.type = 'button';
      item.id = `${selectId}Option${index}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(option.selected));
      item.disabled = option.disabled;
      item.dataset.value = option.value;
      item.addEventListener('click', () => {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        close(true);
      });
      list.append(item);
    });
  }
  function open(focusIndex) {
    document.querySelectorAll('.add-pet-select-trigger[aria-expanded="true"]').forEach(other => {
      if (other !== trigger) other.click();
    });
    render();
    list.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    if (focusIndex != null) {
      const options = Array.from(list.querySelectorAll('.add-pet-option:not(:disabled)'));
      (options[focusIndex] || options[0])?.focus();
    }
  }
  trigger.addEventListener('click', () => isOpen() ? close() : open());
  trigger.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const usable = Array.from(select.options).filter(option => !option.disabled);
      const selectedIndex = usable.findIndex(option => option.value === select.value);
      open(event.key === 'End' ? usable.length - 1 : event.key === 'Home' ? 0 : event.key === 'ArrowUp' ? Math.max(0,selectedIndex - 1) : Math.min(usable.length - 1,selectedIndex + 1));
    } else if (event.key === 'Escape' && isOpen()) { event.preventDefault(); close(true); }
  });
  list.addEventListener('keydown', event => {
    const usable = Array.from(list.querySelectorAll('.add-pet-option:not(:disabled)'));
    const index = usable.indexOf(document.activeElement);
    let next = index;
    if (event.key === 'ArrowDown') next = Math.min(usable.length - 1, index + 1);
    else if (event.key === 'ArrowUp') next = Math.max(0, index - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = usable.length - 1;
    else if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault();
      close(event.key === 'Escape');
      return;
    } else return;
    event.preventDefault();
    usable[next]?.focus();
  });
  document.addEventListener('pointerdown', event => {
    if (isOpen() && !trigger.contains(event.target) && !list.contains(event.target)) close();
  });
  select.addEventListener('change', render);
  render();
  return {render, close};
}

const genderDropdown = createAddPetDropdown('newPetGender', 'newPetGenderTrigger', 'newPetGenderOptions');
const enclosureDropdown = createAddPetDropdown('newPetEnclosure', 'newPetEnclosureTrigger', 'newPetEnclosureOptions');

async function populateAddPetEnclosures() {
  const request = ++addPetEnclosureRequest;
  const selector = $('#newPetEnclosure');
  selector.replaceChildren();
  selector.append(new Option('Unassigned — you can add an enclosure later', ''));
  try {
    const enclosures = await getCollectionJson('/api/enclosures');
    if (!Array.isArray(enclosures)) throw new Error('Invalid enclosure response');
    if (request !== addPetEnclosureRequest) return;
    enclosures.forEach(enclosure => {
      if (enclosure.id != null && typeof enclosure.name === 'string') {
        selector.append(new Option(enclosure.name, String(enclosure.id)));
      }
    });
  } catch (error) {
    if (request !== addPetEnclosureRequest) return;
    console.warn('Could not load enclosure options in Add Pet:', error);
    selector.append(new Option('Enclosure list temporarily unavailable', 'unavailable'));
    selector.options[selector.options.length - 1].disabled = true;
  } finally {
    if (request === addPetEnclosureRequest) enclosureDropdown.render();
  }
}

function openAddPetForm() {
  if (addPetSaving) return;
  // Keep the Pets sidebar active while presenting an internal subview.
  navigate('pets');
  $('#petsPage').hidden = true;
  $('#addPetPage').hidden = false;
  $('#pageEyebrow').textContent = 'PET MANAGEMENT';
  $('#pageTitle').textContent = 'Add New Pet';
  $('#pageDescription').textContent = 'Create a profile for your new companion.';
  $('#addPetForm').reset();
  setAddPetMessage('Name and species are required. All other fields are optional.');
  $('#newPetName').removeAttribute('aria-invalid');
  $('#newPetSpecies').removeAttribute('aria-invalid');
  birthCalendar.reset();
  genderDropdown.close();
  enclosureDropdown.close();
  genderDropdown.render();
  enclosureDropdown.render();
  selectedNewPetIllustration = null;
  syncNewPetPortrait();
  populateAddPetEnclosures();
  window.scrollTo(0,0);
}
function closeAddPetForm() {
  if (addPetSaving) return;
  ++addPetEnclosureRequest;
  navigate('pets'); window.scrollTo(0,0);
}

populateAddPetIllustrations();
$('#illustrationPickerOpen').addEventListener('click', () => { syncNewPetPortrait(); $('#illustrationDialog').showModal(); });
$('#illustrationDialogClose').addEventListener('click', () => $('#illustrationDialog').close());
$('#illustrationDialog').addEventListener('click', (event) => {
  if (event.target === $('#illustrationDialog')) $('#illustrationDialog').close();
});
$('#backToPets').addEventListener('click', closeAddPetForm);
$('#cancelAddPet').addEventListener('click', closeAddPetForm);
function setAddPetMessage(message, isError = false) {
  const messageEl = $('#addPetSaveMessage');
  messageEl.textContent = message;
  messageEl.classList.toggle('is-error', isError);
}

function validateAddPetForm() {
  const nameEl = $('#newPetName');
  const speciesEl = $('#newPetSpecies');
  const name = nameEl.value.trim();
  const species = speciesEl.value.trim();
  nameEl.removeAttribute('aria-invalid');
  speciesEl.removeAttribute('aria-invalid');
  if (!name || !species) {
    const invalid = !name ? nameEl : speciesEl;
    invalid.setAttribute('aria-invalid', 'true');
    invalid.focus();
    throw new Error('Please enter both a pet name and species. You can enter "Unknown" for species.');
  }
  if (name.length > 120 || species.length > 160) {
    throw new Error('Pet name or species is too long.');
  }
  const enclosureValue = $('#newPetEnclosure').value;
  const enclosureId = enclosureValue === '' ? null : Number(enclosureValue);
  if (enclosureId !== null && (!Number.isSafeInteger(enclosureId) || enclosureId <= 0)) {
    throw new Error('Please choose a valid enclosure or leave it unassigned.');
  }
  const birth = $('#newPetBirth').value;
  if (birth) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth);
    if (!match) throw new Error('Please choose a valid date of birth.');
    const y = Number(match[1]); const m = Number(match[2]); const d = Number(match[3]);
    const parsed = new Date(Date.UTC(y, m - 1, d));
    const today = new Date();
    const localToday = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d || birth > localToday) {
      throw new Error('Date of birth must be a real date and cannot be in the future.');
    }
  }
  const notes = $('#newPetNotes').value.trim();
  if (notes.length > 2000) throw new Error('Notes cannot exceed 2,000 characters.');
  const gender = $('#newPetGender').value;
  if (!['male', 'female', 'unknown'].includes(gender)) throw new Error('Please select a valid gender.');
  return {
    name, species, gender,
    date_of_birth: birth || null,
    notes: notes || null,
    enclosure_id: enclosureId,
    illustration_key: selectedNewPetIllustration
  };
}

$('#addPetForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (addPetSaving) return;
  let payload;
  try {
    payload = validateAddPetForm();
  } catch (error) {
    setAddPetMessage(error.message, true);
    return;
  }
  addPetSaving = true;
  const submitButton = $('#createPetButton');
  submitButton.disabled = true;
  submitButton.textContent = 'Creating Pet…';
  $('#cancelAddPet').disabled = true;
  $('#backToPets').disabled = true;
  setAddPetMessage('Saving your pet…');
  try {
    const response = await fetch('/api/pets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(result && typeof result.error === 'string'
        ? result.error
        : `Could not create pet (HTTP ${response.status}).`);
    }
    if (!result || !Number.isSafeInteger(result.id) || result.id <= 0) {
      // The backend may have committed the record; do not encourage a second submission.
      setAddPetMessage('The server returned an unexpected response. Check the Pets collection before trying again.', true);
      return;
    }
    ++addPetEnclosureRequest;
    navigate('pets');
    toast(`${result.name} was added to your collection.`);
  } catch (error) {
    console.error('Creating pet failed:', error);
    setAddPetMessage(`Could not save pet: ${error.message}. Your form entries are still here. If the connection dropped, check the Pets collection before retrying.`, true);
  } finally {
    addPetSaving = false;
    submitButton.disabled = false;
    submitButton.textContent = 'Create Pet';
    $('#cancelAddPet').disabled = false;
    $('#backToPets').disabled = false;
  }
});
// Stage 2A Rev 2 — accessible, dependency-free birth-date calendar.
// The hidden field retains the backend's YYYY-MM-DD date format for Stage 2B.
function createBirthCalendar(prefix = "newPet") {
  const input = $('#' + prefix + 'Birth');
  const trigger = $('#' + prefix + 'BirthTrigger');
  const label = $('#' + prefix + 'BirthLabel');
  const popup = $('#' + prefix + 'Calendar');
  const wrap = $('#' + prefix + 'CalendarWrap');
  const monthSelect = $('#' + prefix + 'CalendarMonth');
  const yearSelect = $('#' + prefix + 'CalendarYear');
  const days = $('#' + prefix + 'CalendarDays');
  const prev = $('#' + prefix + 'CalendarPrev');
  const next = $('#' + prefix + 'CalendarNext');
  const today = new Date();
  const maxYear = today.getFullYear();
  const maxMonth = today.getMonth();
  const maxDay = today.getDate();
  let visibleYear = maxYear;
  let visibleMonth = maxMonth;
  let returnFocus = trigger;
  const open = () => !popup.hidden;
  const iso = (year, month, day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const valid = (year, month, day) => year < maxYear || (year === maxYear && (month < maxMonth || (month === maxMonth && day <= maxDay)));
  const selectedParts = () => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.value);
    return match ? [Number(match[1]), Number(match[2]) - 1, Number(match[3])] : null;
  };
  function syncLabel() {
    const parts = selectedParts();
    label.textContent = parts ? `${String(parts[2]).padStart(2, '0')}/${String(parts[1] + 1).padStart(2, '0')}/${parts[0]}` : 'Select date of birth';
    label.classList.toggle('add-pet-calendar-placeholder', !parts);
  }
  function close(restoreFocus = false) {
    popup.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) returnFocus.focus();
  }
  function render() {
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    monthSelect.replaceChildren(...months.map((name, index) => {
      const option = new Option(name, String(index));
      option.disabled = visibleYear === maxYear && index > maxMonth;
      return option;
    }));
    monthSelect.value = String(visibleMonth);
    // Allow choosing older dates directly, without navigating back month by month.
    yearSelect.replaceChildren();
    for (let year = maxYear; year >= maxYear - 125; year--) yearSelect.append(new Option(String(year), String(year)));
    yearSelect.value = String(visibleYear);
    prev.disabled = visibleYear <= maxYear - 125 && visibleMonth === 0;
    next.disabled = visibleYear === maxYear && visibleMonth === maxMonth;
    days.replaceChildren();
    const offset = (new Date(visibleYear, visibleMonth, 1).getDay() + 6) % 7;
    for (let i = 0; i < offset; i++) {
      const gap = document.createElement('span');
      gap.className = 'add-pet-calendar-blank';
      gap.setAttribute('aria-hidden','true');
      days.append(gap);
    }
    const lastDay = new Date(visibleYear, visibleMonth + 1, 0).getDate();
    const selected = input.value;
    for (let day = 1; day <= lastDay; day++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'add-pet-calendar-day';
      button.textContent = String(day);
      const value = iso(visibleYear, visibleMonth, day);
      button.setAttribute('aria-label', `${months[visibleMonth]} ${day}, ${visibleYear}`);
      button.setAttribute('aria-pressed', String(selected === value));
      if (visibleYear === maxYear && visibleMonth === maxMonth && day === maxDay) button.classList.add('is-today');
      button.disabled = !valid(visibleYear, visibleMonth, day);
      button.addEventListener('click', () => {
        input.value = value;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        syncLabel();
        close(true);
      });
      days.append(button);
    }
  }
  function show() {
    const parts = selectedParts();
    visibleYear = parts ? parts[0] : maxYear;
    visibleMonth = parts ? parts[1] : maxMonth;
    render();
    popup.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    returnFocus = trigger;
    monthSelect.focus();
  }
  trigger.addEventListener('click', () => open() ? close() : show());
  $('#' + prefix + 'CalendarClose').addEventListener('click', () => close(true));
  $('#' + prefix + 'CalendarClear').addEventListener('click', () => {
    input.value = '';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    syncLabel();
    close(true);
  });
  $('#' + prefix + 'CalendarToday').addEventListener('click', () => {
    input.value = iso(maxYear, maxMonth, maxDay);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    syncLabel();
    close(true);
  });
  prev.addEventListener('click', () => {
    if (visibleMonth === 0) {visibleMonth = 11; visibleYear--;} else visibleMonth--;
    render();
  });
  next.addEventListener('click', () => {
    if (visibleMonth === 11) {visibleMonth = 0; visibleYear++;} else visibleMonth++;
    render();
  });
  monthSelect.addEventListener('change', () => { visibleMonth = Number(monthSelect.value); render(); });
  yearSelect.addEventListener('change', () => {
    visibleYear = Number(yearSelect.value);
    if (visibleYear === maxYear && visibleMonth > maxMonth) visibleMonth = maxMonth;
    render();
  });
  popup.addEventListener('keydown', event => {
    if (event.key === 'Escape') {event.preventDefault(); close(true);}
  });
  document.addEventListener('pointerdown', event => {
    if (open() && !wrap.contains(event.target)) close();
  });
  // Keyboard navigation: arrow keys move among dates; Home/End move within a week.
  days.addEventListener('keydown', event => {
    const keys = {ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
    if (!(event.key in keys) && !['Home','End'].includes(event.key)) return;
    const focused = document.activeElement;
    if (!focused.classList.contains('add-pet-calendar-day')) return;
    event.preventDefault();
    const day = Number(focused.textContent);
    const delta = keys[event.key] ?? (event.key === 'Home' ? -((new Date(visibleYear, visibleMonth, day).getDay()+6)%7) : (6-(new Date(visibleYear, visibleMonth, day).getDay()+6)%7));
    const nextDate = new Date(visibleYear,visibleMonth,day+delta);
    const year = nextDate.getFullYear(); const month = nextDate.getMonth();
    if (year < maxYear - 125 || year > maxYear || !valid(year,month,nextDate.getDate())) return;
    visibleYear = year; visibleMonth = month; render();
    Array.from(days.querySelectorAll('.add-pet-calendar-day')).find(button => Number(button.textContent) === nextDate.getDate())?.focus();
  });
  syncLabel();
  return {reset() {close(); syncLabel();}, close, refresh:syncLabel};
}
const birthCalendar = createBirthCalendar();


// Stage 3B — inline editing reuses the existing Add Pet controls and CSS.
// The original Add Pet form is never moved or changed.
let activePet = null;
let petEditing = false;
let petSaving = false;
let editSnapshot = '';
let editStartRequest = 0;
let selectedEditPetIllustration = null;
let editGenderDropdown, editEnclosureDropdown, editBirthCalendar;
const editContainer = $('#petEditContainer');
const editForm = document.createElement('form');
editForm.id = 'editPetForm';
editForm.noValidate = true;
// Duplicate only the approved form's visual fields with unique IDs.
for (const source of ['.add-pet-profile-row','.add-pet-details-panel']) {
  const cloned = $('#addPetForm').querySelector(source).cloneNode(true);
  for (const node of [cloned,...cloned.querySelectorAll('*')]) {
    for (const attribute of ['id','for','aria-controls']) {
      if (!node.hasAttribute(attribute)) continue;
      let value = node.getAttribute(attribute);
      value = value.replaceAll('newPet','editPet')
        .replaceAll('illustrationPickerOpen','editIllustrationPickerOpen')
        .replaceAll('addPetPortrait','editPetPortrait')
        .replaceAll('illustrationSelectionLabel','editIllustrationSelectionLabel');
      node.setAttribute(attribute,value);
    }
  }
  editForm.append(cloned);
}
editContainer.append(editForm);
editGenderDropdown = createAddPetDropdown('editPetGender','editPetGenderTrigger','editPetGenderOptions');
editEnclosureDropdown = createAddPetDropdown('editPetEnclosure','editPetEnclosureTrigger','editPetEnclosureOptions');
editBirthCalendar = createBirthCalendar('editPet');
$('#editIllustrationPickerOpen').addEventListener('click', () => {
  syncEditPetPortrait();
  $('#illustrationDialog').showModal();
});

function syncEditPetPortrait() {
  const item = illustrationChoices.find(i => i.key === selectedEditPetIllustration) || illustrationChoices[0];
  const image = $('#editPetPortraitImage');
  image.hidden = !item.filename;
  $('#editPetPortraitFallback').hidden = !!item.filename;
  if (item.filename) { image.src = `${assets}${item.filename}`; image.alt = `${item.label} illustration`; }
  else image.removeAttribute('src');
  $('#editIllustrationSelectionLabel').textContent = item.filename
    ? `${item.label} illustration selected. You can change it anytime.`
    : 'No illustration selected — neutral placeholder will be used.';
  document.querySelectorAll('.illustration-option').forEach(button => {
    const chosen = button.dataset.key === (selectedEditPetIllustration || 'none');
    button.classList.toggle('selected',chosen);
    button.setAttribute('aria-pressed',String(chosen));
  });
}
function editFormPayload() {
  const name = $('#editPetName').value.trim();
  const species = $('#editPetSpecies').value.trim();
  if (!name || !species) throw new Error('Pet name and species are required. Enter "Unknown" if necessary.');
  if (name.length > 120 || species.length > 160) throw new Error('Name or species is too long.');
  const gender = $('#editPetGender').value;
  if (!['unknown','male','female'].includes(gender)) throw new Error('Choose a valid gender.');
  const enclosureValue = $('#editPetEnclosure').value;
  const enclosure_id = enclosureValue === '' ? null : Number(enclosureValue);
  if (enclosure_id !== null && (!Number.isSafeInteger(enclosure_id) || enclosure_id <= 0)) throw new Error('Choose an available enclosure.');
  const date_of_birth = $('#editPetBirth').value || null;
  if (date_of_birth) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date_of_birth);
    if (!match) throw new Error('Choose a valid date of birth.');
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    const today = new Date();
    const localToday = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day || date_of_birth > localToday) throw new Error('Birth date must be a real date and cannot be in the future.');
  }
  const notes = $('#editPetNotes').value.trim() || null;
  if (notes && notes.length > 2000) throw new Error('Notes cannot exceed 2,000 characters.');
  return {name,species,gender,date_of_birth,notes,enclosure_id,illustration_key:selectedEditPetIllustration};
}
function editState() {
  return JSON.stringify({
    name:$('#editPetName').value, species:$('#editPetSpecies').value,
    gender:$('#editPetGender').value, date_of_birth:$('#editPetBirth').value,
    notes:$('#editPetNotes').value, enclosure_id:$('#editPetEnclosure').value,
    illustration_key:selectedEditPetIllustration
  });
}
function isPetEditDirty() { return petEditing && editState() !== editSnapshot; }
function editMessage(message, error = false) {
  const box = $('#petEditMessage');
  box.hidden = !message;
  box.textContent = message;
  box.classList.toggle('is-error',error);
}
function stopPetEdit() {
  ++editStartRequest;
  petEditing = false;
  $('#petDetailsPage').classList.remove('is-editing');
  editContainer.hidden = true;
  $('#petDetailsEdit').hidden = false;
  $('#petDetailsSave').hidden = true;
  $('#petDetailsClose span').textContent = 'Close';
  $('#petDetailsClose').setAttribute('aria-label','Close pet profile and return to Pets');
  editGenderDropdown.close(); editEnclosureDropdown.close(); editBirthCalendar.close();
  editMessage('');
}
async function beginPetEdit() {
  if (!activePet || petEditing || petSaving) return;
  const request = ++editStartRequest;
  const editingPetId = activePet.id;
  // Refresh enclosure choices; do not allow editing with a stale/unavailable list.
  editMessage('Loading enclosure choices…');
  $('#petDetailsEdit').disabled = true;
  let options;
  try {
    options = await getCollectionJson('/api/enclosures');
    if (!Array.isArray(options)) throw new Error('Invalid enclosure response');
  } catch (error) {
    if (request !== editStartRequest || $('#petDetailsPage').hidden) return;
    editMessage('Enclosure options could not be loaded. Try Edit again when the Enclosure Service is running.',true);
    $('#petDetailsEdit').disabled = false;
    return;
  }
  if (request !== editStartRequest || $('#petDetailsPage').hidden || activePet?.id !== editingPetId) return;
  $('#petDetailsEdit').disabled = false;
  collectionEnclosures = new Map(options.map(e => [Number(e.id),e.name]));
  const select = $('#editPetEnclosure');
  select.replaceChildren(new Option('Unassigned — you can add an enclosure later',''));
  options.forEach(e => { if (e.id != null && typeof e.name === 'string') select.append(new Option(e.name,String(e.id))); });
  if (activePet.enclosure_id != null && !options.some(e => Number(e.id) === Number(activePet.enclosure_id))) {
    editMessage('This pet’s current enclosure is unavailable. Editing is disabled until the enclosure can be loaded.',true);
    return;
  }
  $('#editPetName').value = activePet.name || '';
  $('#editPetSpecies').value = activePet.species || '';
  $('#editPetNotes').value = activePet.notes || '';
  $('#editPetGender').value = activePet.gender || 'unknown';
  $('#editPetBirth').value = activePet.date_of_birth || '';
  select.value = activePet.enclosure_id == null ? '' : String(activePet.enclosure_id);
  selectedEditPetIllustration = activePet.illustration_key || null;
  editGenderDropdown.render(); editEnclosureDropdown.render(); editBirthCalendar.refresh();
  petEditing = true;
  editSnapshot = editState();
  syncEditPetPortrait();
  $('#petDetailsPage').classList.add('is-editing');
  editContainer.hidden = false;
  $('#petDetailsEdit').hidden = true;
  $('#petDetailsSave').hidden = false;
  $('#petDetailsClose span').textContent = 'Cancel';
  $('#petDetailsClose').setAttribute('aria-label','Cancel editing pet');
  editMessage('');
  $('#editPetName').focus();
}
function requestCancelPetEdit() {
  if (petSaving) return;
  pendingPetEditNavigation = null;
  if (isPetEditDirty()) $('#petEditConfirm').showModal();
  else stopPetEdit();
}
$('#petDetailsEdit').addEventListener('click',beginPetEdit);
$('#petEditKeep').addEventListener('click',() => { pendingPetEditNavigation = null; $('#petEditConfirm').close(); });
$('#petEditDiscard').addEventListener('click',() => {
  const destination = pendingPetEditNavigation;
  pendingPetEditNavigation = null;
  $('#petEditConfirm').close();
  stopPetEdit();
  if (destination) navigate(destination);
});
$('#petEditConfirm').addEventListener('cancel', () => { pendingPetEditNavigation = null; });
$('#petDetailsSave').addEventListener('click',() => editForm.requestSubmit());
editForm.addEventListener('submit',async event => {
  event.preventDefault();
  if (!petEditing || petSaving || !activePet) return;
  let payload;
  try { payload = editFormPayload(); }
  catch(error) { editMessage(error.message,true); return; }
  if (!isPetEditDirty()) { stopPetEdit(); return; }
  petSaving = true;
  $('#petDetailsSave').disabled = true;
  $('#petDetailsClose').disabled = true;
  $('#petDetailsSave').textContent = 'Saving…';
  editMessage('Saving your changes…');
  try {
    const response = await fetch(`/api/pets/${activePet.id}`, {
      method:'PUT', headers:{'Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify(payload)
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : `Update failed (HTTP ${response.status})`);
    if (!result || Number(result.id) !== Number(activePet.id)) {
      throw new Error('Unexpected response. Check the pet record before saving again.');
    }
    activePet = result;
    renderDetailsProfile(activePet);
    stopPetEdit();
    loadPetsCollection();
    toast('Pet changes saved.');
  } catch(error) {
    console.error('Updating pet failed:',error);
    editMessage(`Could not save changes: ${error.message}. Your entries are preserved. If the connection failed, verify the pet before retrying.`,true);
  } finally {
    petSaving = false;
    $('#petDetailsSave').disabled = false;
    $('#petDetailsClose').disabled = false;
    $('#petDetailsSave').textContent = 'Save Changes';
  }
});

// Initial dashboard load: live pet/enclosure summary and environmental conditions.
loadDashboardData();
startDashboardRefresh();

// Stage 3C — Feeding Management. This uses existing individual feeding APIs
// and additive feeding-group/bulk endpoints in Data Management.
const feedState = {pets:[],groups:[],selected:new Set(),groupEditing:null,busy:false};
const isoToday = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const apiDate = iso => {const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||'');return m?`${m[3]}/${m[2]}/${m[1]}`:'';};
const isoDate = display => {const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display||'');return m?`${m[3]}-${m[2]}-${m[1]}`:'';};
async function feedingRequest(url,method='GET',body) {
  const response=await fetch(url,{method,headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=response.status===204?null:await response.json().catch(()=>null);
  if(!response.ok) throw new Error(data?.error||`Request failed (HTTP ${response.status})`);
  return data;
}
function feedingFeedback(id,message,error=false){const target=$(id);target.textContent=message;target.classList.toggle('feeding-error',error);}
function feedingOption(pet,selected,onChange){
  const label=elem('label','feeding-pet-choice');const check=elem('input');check.type='checkbox';check.checked=selected;
  check.addEventListener('change',()=>onChange(check.checked));
  const info=elem('span');info.append(elem('strong',null,pet.name),elem('small',null,pet.species||'Unknown species'));
  label.append(check,info);return label;
}
function filteredFeedingPets(){const query=$('#feedingPetSearch').value.trim().toLowerCase();const species=$('#feedingSpeciesFilter').value;
 return feedState.pets.filter(p=>(!query||`${p.name} ${p.species}`.toLowerCase().includes(query))&&(!species||p.species===species));}
function renderFeedingChoices(){
 const host=$('#feedingPetChoices');host.replaceChildren();
 const pets=filteredFeedingPets();if(!pets.length)host.append(elem('p','feeding-hint','No matching animals. You can create pets from the Pets page.'));
 for(const pet of pets)host.append(feedingOption(pet,feedState.selected.has(pet.id),checked=>{
   if(checked)feedState.selected.add(pet.id);else feedState.selected.delete(pet.id);
   renderFeedingChoices();
 }));
 $('#feedingSelectedCount').textContent=`${feedState.selected.size} selected`;
 $('#quickFeedingSave').textContent=`Save ${feedState.selected.size} Feeding${feedState.selected.size===1?'':'s'}`;
}
function renderFeedingGroups(){
 const host=$('#feedingGroupsList');host.replaceChildren();
 const select=$('#feedingGroupSelect');const previous=select.value;select.replaceChildren(new Option('Select a saved group (optional)',''));
 for(const group of feedState.groups){
   select.add(new Option(`${group.name} (${group.pet_ids.length})`,String(group.id)));
   const card=elem('article','feeding-group-card');const info=elem('div');info.append(elem('strong',null,group.name),elem('small',null,`${group.pet_ids.length} animal${group.pet_ids.length===1?'':'s'}`));
   const actions=elem('div','feeding-entry-actions');const use=elem('button','text-button','Select');use.type='button';use.addEventListener('click',()=>applyFeedingGroup(group));
   const edit=elem('button','text-button','Edit');edit.type='button';edit.addEventListener('click',()=>openGroupForm(group));
   const remove=elem('button','text-button feeding-danger','Delete');remove.type='button';remove.addEventListener('click',()=>confirmFeeding(`Delete group “${group.name}”? Its animals and feeding histories will be preserved.`,async()=>{
     await feedingRequest(`/api/feeding-groups/${group.id}`,'DELETE');await reloadFeedingGroups();toast('Feeding group deleted.');
   }));
   actions.append(use,edit,remove);card.append(info,actions);host.append(card);
 }
 if([...select.options].some(option=>option.value===previous))select.value=previous;
 if(!feedState.groups.length)host.append(elem('p','feeding-hint','No groups yet. Create one to save a reusable selection of pets.'));
}
async function reloadFeedingGroups(){feedState.groups=await feedingRequest('/api/feeding-groups');renderFeedingGroups();}
function applyFeedingGroup(group){feedState.selected=new Set(group.pet_ids);$('#feedingGroupSelect').value=String(group.id);renderFeedingChoices();feedingFeedback('#quickFeedingMessage',`${group.name}: ${group.pet_ids.length} animals selected. Uncheck any that did not eat.`);}
async function loadFeedingWorkspace(){
 feedingFeedback('#quickFeedingMessage','Loading feeding data…');
 try{
  const [pets,groups]=await Promise.all([feedingRequest('/api/pets'),feedingRequest('/api/feeding-groups')]);
  feedState.pets=pets.map(p=>({...p,id:Number(p.id)}));feedState.groups=groups;
  feedState.selected=new Set([...feedState.selected].filter(id=>pets.some(p=>Number(p.id)===id)));
  const species=[...new Set(pets.map(p=>p.species||'Unknown'))].sort((a,b)=>a.localeCompare(b));
  const select=$('#feedingSpeciesFilter');const old=select.value;select.replaceChildren(new Option('All species',''));
  for(const value of species)select.add(new Option(value,value));if(species.includes(old))select.value=old;
  renderFeedingGroups();renderFeedingChoices();feedingFeedback('#quickFeedingMessage','');
 }catch(err){feedingFeedback('#quickFeedingMessage',`Could not load feeding data: ${err.message}`,true);}
}
$('#feedingPetSearch').addEventListener('input',renderFeedingChoices);
$('#feedingSpeciesFilter').addEventListener('change',renderFeedingChoices);
$('#feedingGroupSelect').addEventListener('change',()=>{const group=feedState.groups.find(g=>String(g.id)===$('#feedingGroupSelect').value);if(group)applyFeedingGroup(group);});
$('#feedingSelectVisible').addEventListener('click',()=>{for(const p of filteredFeedingPets())feedState.selected.add(p.id);renderFeedingChoices();});
$('#feedingDeselectAll').addEventListener('click',()=>{feedState.selected.clear();$('#feedingGroupSelect').value='';renderFeedingChoices();});
$('#quickDate').value=isoToday();
$('#quickFeedingForm').addEventListener('submit',async e=>{
 e.preventDefault();if(feedState.busy)return;
 const pet_ids=[...feedState.selected];const food=$('#quickFood').value.trim();const feeding_date=apiDate($('#quickDate').value);const notes=$('#quickNotes').value.trim();
 if(!pet_ids.length||!food||!feeding_date){feedingFeedback('#quickFeedingMessage','Select at least one animal, enter food and choose a valid date.',true);return;}
 feedState.busy=true;$('#quickFeedingSave').disabled=true;feedingFeedback('#quickFeedingMessage','Saving feedings…');
 try{const data=await feedingRequest('/api/feedings/bulk','POST',{pet_ids,food,feeding_date,notes});
  feedingFeedback('#quickFeedingMessage',`Saved ${data.count} individual feeding record${data.count===1?'':'s'} successfully.`);
  toast(`${data.count} feeding record${data.count===1?'':'s'} saved.`);feedState.selected.clear();renderFeedingChoices();$('#quickFood').value='';$('#quickNotes').value='';loadRecentFeedings();
 }catch(err){feedingFeedback('#quickFeedingMessage',`Could not save feedings: ${err.message}. Selection and fields were preserved.`,true);}
 finally{feedState.busy=false;$('#quickFeedingSave').disabled=false;}
});
function renderGroupMembers(selected){const host=$('#feedingGroupMembers');host.replaceChildren();for(const pet of feedState.pets){
 host.append(feedingOption(pet,selected.has(pet.id),checked=>{if(checked)selected.add(pet.id);else selected.delete(pet.id);}));
 }if(!feedState.pets.length)host.append(elem('p','feeding-hint','No pets registered yet.'));}
let groupMembersDraft=new Set(),groupInitial='';
function openGroupForm(group=null){feedState.groupEditing=group;groupMembersDraft=new Set(group?.pet_ids||[]);
 $('#feedingGroupDialogTitle').textContent=group?'Edit Feeding Group':'Create Feeding Group';$('#feedingGroupName').value=group?.name||'';$('#feedingGroupName').removeAttribute('aria-invalid');
 renderGroupMembers(groupMembersDraft);feedingFeedback('#feedingGroupError','');groupInitial=JSON.stringify({name:$('#feedingGroupName').value,pet_ids:[...groupMembersDraft].sort((a,b)=>a-b)});$('#feedingGroupDialog').showModal();}
function groupIsDirty(){return JSON.stringify({name:$('#feedingGroupName').value,pet_ids:[...groupMembersDraft].sort((a,b)=>a-b)})!==groupInitial;}
function cancelGroupForm(){if(groupIsDirty())confirmFeeding('Discard your unsaved group changes?',()=>$('#feedingGroupDialog').close());else $('#feedingGroupDialog').close();}
$('#feedingCreateGroup').addEventListener('click',()=>openGroupForm());$('#feedingGroupCancel').addEventListener('click',cancelGroupForm);
$('#feedingGroupName').addEventListener('input',()=>{if($('#feedingGroupName').value.trim()){$('#feedingGroupName').removeAttribute('aria-invalid');if($('#feedingGroupError').textContent==='Enter a group name.')feedingFeedback('#feedingGroupError','');}});
$('#feedingGroupDialog').addEventListener('cancel',e=>{if(groupIsDirty()){e.preventDefault();cancelGroupForm();}});
$('#groupSelectAll').addEventListener('click',()=>{groupMembersDraft=new Set(feedState.pets.map(p=>p.id));renderGroupMembers(groupMembersDraft);});
$('#groupClearAll').addEventListener('click',()=>{groupMembersDraft.clear();renderGroupMembers(groupMembersDraft);});
$('#feedingGroupForm').addEventListener('submit',async e=>{
 e.preventDefault();if(feedState.busy)return;const name=$('#feedingGroupName').value.trim();if(!name){$('#feedingGroupName').setAttribute('aria-invalid','true');feedingFeedback('#feedingGroupError','Enter a group name.',true);$('#feedingGroupName').focus();return;}
 const group=feedState.groupEditing;feedState.busy=true;$('#feedingGroupSave').disabled=true;
 try{await feedingRequest(group?`/api/feeding-groups/${group.id}`:'/api/feeding-groups',group?'PUT':'POST',{name,pet_ids:[...groupMembersDraft]});
  $('#feedingGroupDialog').close();await reloadFeedingGroups();toast(group?'Feeding group updated.':'Feeding group created.');
 }catch(err){feedingFeedback('#feedingGroupError',`Could not save group: ${err.message}`,true);}
 finally{feedState.busy=false;$('#feedingGroupSave').disabled=false;}
});
// Confirmation dialog is reusable for destructive operations and unsaved forms.
let feedingConfirmAction=null;
function confirmFeeding(message,action){feedingConfirmAction=action;$('#feedingConfirmText').textContent=message;$('#feedingConfirmDialog').showModal();}
$('#feedingConfirmCancel').addEventListener('click',()=>{$('#feedingConfirmDialog').close();feedingConfirmAction=null;});
$('#feedingConfirmDialog').addEventListener('close',()=>{feedingConfirmAction=null;});
$('#feedingConfirmProceed').addEventListener('click',async()=>{
 const action=feedingConfirmAction;if(!action)return;$('#feedingConfirmProceed').disabled=true;
 try{await action();$('#feedingConfirmDialog').close();}catch(err){$('#feedingConfirmText').textContent=`Action failed: ${err.message}`;}
 finally{$('#feedingConfirmProceed').disabled=false;}
});
// Individual feeding is kept independent of pet-profile editing.
let recordMode='add',recordBeingEdited=null,recordPetId=null,recordInitial='',recordBusy=false;
function recordFields(){return {food:$('#feedingRecordFood').value.trim(),feeding_date:apiDate($('#feedingRecordDate').value),notes:$('#feedingRecordNotes').value.trim()};}
function recordIsDirty(){return JSON.stringify(recordFields())!==recordInitial;}
function openFeedingRecord(mode,record=null){
 if(!activePet||petEditing)return toast('Finish pet profile editing first.');
 recordMode=mode;recordBeingEdited=record;recordPetId=Number(activePet.id);
 $('#feedingRecordDialogTitle').textContent=mode==='edit'?'Edit Feeding Record':'Add Feeding';
 $('#feedingRecordFood').value=record?.food||'';$('#feedingRecordDate').value=record?isoDate(record.feeding_date):isoToday();$('#feedingRecordNotes').value=record?.notes||'';
 $('#feedingRecordSave').textContent=mode==='edit'?'Save Changes':'Save Feeding';feedingFeedback('#feedingRecordMessage','');
 recordInitial=JSON.stringify(recordFields());$('#feedingRecordDialog').showModal();
}
function cancelFeedingRecord(){if(recordIsDirty())confirmFeeding('Discard your unsaved feeding changes?',()=>$('#feedingRecordDialog').close());else $('#feedingRecordDialog').close();}
$('#petAddFeeding').addEventListener('click',()=>openFeedingRecord('add'));
$('#feedingRecordCancel').addEventListener('click',cancelFeedingRecord);
$('#feedingRecordDialog').addEventListener('cancel',e=>{if(recordIsDirty()){e.preventDefault();cancelFeedingRecord();}});
$('#feedingRecordForm').addEventListener('submit',async e=>{
 e.preventDefault();if(recordBusy)return;const payload=recordFields();
 if(!payload.food||!payload.feeding_date){feedingFeedback('#feedingRecordMessage','Food and feeding date are required.',true);return;}
 recordBusy=true;$('#feedingRecordSave').disabled=true;
 try{const path=`/api/pets/${recordPetId}/feedings${recordMode==='edit'?`/${recordBeingEdited.id}`:''}`;
  await feedingRequest(path,recordMode==='edit'?'PUT':'POST',payload);$('#feedingRecordDialog').close();
  await refreshPetFeedings(recordPetId);loadRecentFeedings();toast(recordMode==='edit'?'Feeding updated.':'Feeding added.');
 }catch(err){feedingFeedback('#feedingRecordMessage',`Could not save: ${err.message}`,true);}
 finally{recordBusy=false;$('#feedingRecordSave').disabled=false;}
});
async function refreshPetFeedings(petId){if(Number($('#petDetailsPage').dataset.petId)!==petId)return;
 try{const records=await feedingRequest(`/api/pets/${petId}/feedings`);
  if(Number($('#petDetailsPage').dataset.petId)!==petId)return;
  renderDetailsFeedings(records);$('#petDetailsFeedingError').hidden=true;
 }catch(err){toast(`Could not refresh feeding history: ${err.message}`);}
}
function deleteFeedingRecord(record){if(!activePet||petEditing)return;const petId=Number(activePet.id);
 confirmFeeding(`Permanently delete “${record.food}” from ${record.feeding_date}? This cannot be undone.`,async()=>{
  await feedingRequest(`/api/pets/${petId}/feedings/${record.id}`,'DELETE');
  await refreshPetFeedings(petId);loadRecentFeedings();toast('Feeding record deleted.');
 });
}
async function loadRecentFeedings(){
 try{const records=await feedingRequest('/api/feedings/recent');const host=$('#feedingRows');host.replaceChildren();
  if(!records.length){host.append(elem('p','feeding-hint','No feeding records yet. Visit Feeding to log a meal.'));return;}
  for(const record of records.slice(0,3)){
   const row=elem('div','feeding-item');const left=elem('div');left.append(elem('strong',null,record.pet_name),elem('small',null,record.feeding_date));
   row.append(left,elem('span','feeding-food',record.food));host.append(row);
  }
 }catch(err){console.warn('Recent feedings unavailable',err);$('#feedingRows').replaceChildren(elem('p','feeding-hint','Recent feeding records are unavailable. Check the Data Management Service.'));}
}
loadRecentFeedings();


// Stage 3D.2.1 — Read-only enclosure details. Artwork stays separate from functionality.
let enclosureDetailsRequest = 0;
function enclosureArtworkFor(pet) {
  return Object.hasOwn(approvedIllustrations, pet.illustration_key)
    ? `${assets}${approvedIllustrations[pet.illustration_key]}` : null;
}
function enclosurePetPicture(pet, className) {
  const wrapper = elem('span', className);
  if (Object.hasOwn(approvedIllustrations, pet.illustration_key)) {
    wrapper.classList.add(`${className}--${pet.illustration_key}`);
  }
  const url = enclosureArtworkFor(pet);
  if (!url) { wrapper.append(elem('span', 'enclosure-art-fallback', '◇')); return wrapper; }
  const img = elem('img'); img.src = url; img.alt = ''; img.loading = 'lazy';
  if (Object.hasOwn(approvedIllustrations, pet.illustration_key)) {
    img.classList.add(`enclosure-art-image--${pet.illustration_key}`);
  }
  img.addEventListener('error', () => wrapper.replaceChildren(elem('span','enclosure-art-fallback','◇')), {once:true});
  wrapper.append(img); return wrapper;
}
function enclosureDetailStatus(message, retryId = null) {
  const host = $('#enclosureDetailsStatus'); host.replaceChildren(elem('p',null,message));
  if (retryId != null) {
    const retry = elem('button','primary-button','Try again'); retry.type = 'button';
    retry.addEventListener('click',()=>openEnclosureDetails(retryId)); host.append(retry);
  }
  host.hidden = false;
}
const featuredPetSyncPending = new Set();
let featuredPetBusy = false;
function renderFeaturedPetControl(enclosure, pets, featuredPet, petsError) {
  const wrapper = $('#habitatFeaturedControl');
  const trigger = $('#habitatFeaturedTrigger');
  const options = $('#habitatFeaturedOptions');
  options.replaceChildren();
  wrapper.hidden = petsError || pets.length < 2;
  options.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
  if (wrapper.hidden) return;
  for (const pet of pets) {
    const choice = elem('button', 'habitat-featured-option', `${pet.name || 'Unnamed pet'}${Number(pet.id) === Number(featuredPet?.id) ? ' ✓' : ''}`);
    choice.type = 'button';
    choice.disabled = featuredPetBusy || Number(pet.id) === Number(featuredPet?.id);
    choice.addEventListener('click', async () => {
      if (featuredPetBusy) return;
      featuredPetBusy = true;
      trigger.disabled = true;
      options.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      try {
        await enclosureApiRequest(`/api/enclosures/${enclosure.id}/featured-pet`, 'PATCH', {featuredPetId: Number(pet.id)});
        // Clear the busy state before rebuilding the selector: otherwise the
        // newly rendered options inherit disabled=true until a full refresh.
        featuredPetBusy = false;
        await openEnclosureDetails(Number(enclosure.id));
        toast(`${pet.name || 'Pet'} is now featured.`);
      } catch (error) { toast(error.message || 'Unable to change featured pet.'); }
      finally { featuredPetBusy = false; trigger.disabled = false; }
    });
    options.append(choice);
  }
}
$('#habitatFeaturedTrigger').addEventListener('click', () => {
  const options = $('#habitatFeaturedOptions');
  options.hidden = !options.hidden;
  $('#habitatFeaturedTrigger').setAttribute('aria-expanded', String(!options.hidden));
});
document.addEventListener('click', event => {
  const control = $('#habitatFeaturedControl');
  if (!control.contains(event.target)) {
    $('#habitatFeaturedOptions').hidden = true;
    $('#habitatFeaturedTrigger').setAttribute('aria-expanded', 'false');
  }
});
$('#habitatFeaturedControl').addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    $('#habitatFeaturedOptions').hidden = true;
    $('#habitatFeaturedTrigger').setAttribute('aria-expanded', 'false');
    $('#habitatFeaturedTrigger').focus();
  }
});
function renderEnclosureDetails(enclosure, pets, petsError) {
  currentEnclosureDetail = enclosure;
  $('#enclosureDetailsName').textContent = enclosure.name || `Enclosure #${enclosure.id}`;
  $('#enclosureHabitatSlots').closest('.enclosure-habitat-placeholder').classList.toggle('is-tropical', enclosure.enclosureType === 'Tropical');
  $('#enclosureDetailsType').textContent = (enclosure.enclosureType || 'UNSPECIFIED HABITAT').toUpperCase();
  const facts = $('#enclosureDetailsFacts'); facts.replaceChildren();
  for (const [label,value] of [
    ['Habitat type',enclosure.enclosureType || 'Not specified'],
    ['Temperature range',`${enclosure.minTemperature}–${enclosure.maxTemperature} °C`],
    ['Humidity range',`${enclosure.minHumidity}–${enclosure.maxHumidity} %`]]) {
    const item = elem('div','enclosure-fact'); item.append(elem('span',null,label),elem('strong',null,value)); facts.append(item);
  }
  $('#enclosureDetailsNotes').textContent = enclosure.notes?.trim() || 'No notes added yet.';
  const occupants = $('#enclosureDetailsPets'); occupants.replaceChildren();
  const slots = $('#enclosureHabitatSlots'); slots.replaceChildren();
  const count = pets.length;
  $('#enclosureDetailsPetCount').textContent = petsError ? 'Unavailable' : `${count} ${count===1?'pet':'pets'}`;
  const warning = $('#enclosureDetailsPetsWarning'); warning.hidden = !petsError;
  if (petsError) warning.textContent = 'Assigned pets could not be loaded. Check the Data Management Service (port 3001) and reopen this enclosure.';
  // Display exactly one occupant; stale stored IDs fall back gracefully.
  const featuredPet = petsError ? null : (pets.find(p => Number(p.id) === Number(enclosure.featuredPetId)) || pets[0]);
  renderFeaturedPetControl(enclosure, pets, featuredPet, petsError);
  if (!petsError && (enclosure.featuredPetId != null) &&
      Number(enclosure.featuredPetId) !== Number(featuredPet?.id) &&
      !featuredPetSyncPending.has(Number(enclosure.id))) {
    // A pet might have been moved or deleted since the last visit.
    const enclosureId = Number(enclosure.id);
    featuredPetSyncPending.add(enclosureId);
    enclosureApiRequest(`/api/enclosures/${enclosureId}/featured-pet`, 'PATCH',
      { featuredPetId: featuredPet ? Number(featuredPet.id) : null })
      .catch(error => console.warn('Could not synchronize featured pet fallback:', error.message))
      .finally(() => featuredPetSyncPending.delete(enclosureId));
  }
  if (featuredPet) {
    const slot = elem('div','enclosure-habitat-slot enclosure-habitat-slot--center');
    slot.append(enclosurePetPicture(featuredPet,'enclosure-habitat-art'),elem('span','enclosure-habitat-pet-name',featuredPet.name || 'Unnamed pet'));
    slots.append(slot);
  }
  if (!petsError && !count) occupants.append(elem('p','enclosure-occupants-empty','No pets assigned yet. Use Assign Pet to choose a companion.'));
  for (const pet of pets) {
    const button = elem('button','enclosure-occupant-card'); button.type='button';
    button.setAttribute('aria-label',`Open profile for ${pet.name || 'unnamed pet'}`);
    const info = elem('span','enclosure-occupant-info');
    info.append(elem('strong',null,pet.name || 'Unnamed pet'),elem('small',null,pet.species || 'Species unknown'));
    button.append(enclosurePetPicture(pet,'enclosure-occupant-art'), info, elem('span','enclosure-occupant-arrow','→'));
    button.addEventListener('click',()=>{petReturnEnclosureId=Number(enclosure.id);openPetDetails(Number(pet.id));});
    const row = elem('div','enclosure-occupant-row');
    const remove = elem('button','enclosure-occupant-remove','Remove'); remove.type='button';
    remove.setAttribute('aria-label',`Remove ${pet.name || 'pet'} from this enclosure`);
    remove.addEventListener('click',()=>confirmEnclosureAction(`Remove ${pet.name || 'this pet'} from this enclosure? The pet profile will remain registered.`,async()=>{
      await updatePetEnclosure(pet,null); await openEnclosureDetails(Number(enclosure.id)); toast('Pet removed from enclosure.');
    }));
    row.append(button,remove); occupants.append(row);
  }
}
async function openEnclosureDetails(id) {
  if (!Number.isSafeInteger(id) || id<=0) return;
  stopEnclosureMonitoring();
  stopEnclosureHistory();
  const request = ++enclosureDetailsRequest;
  ++enclosureCollectionRequest; // invalidate any pending collection render while viewing details
  currentPage = 'enclosures';
  $('#main').classList.add('enclosures-active');
  $('#main').classList.remove('pets-active','feeding-active');
  $('#dashboardContent').hidden = true;
  $('#dashboardDemoBanner').hidden = true;
  $('#petsPage').hidden = true;
  $('#addPetPage').hidden = true;
  $('#petDetailsPage').hidden = true;
  ++petDetailsRequest;
  $('#feedingPage').hidden = true;
  $('#otherPage').hidden = true;
  $('#enclosuresPage').hidden = true;
  $('#enclosureCreatePage').hidden = true;
  $('#enclosureDetailsPage').hidden = false;
  $('#enclosureDetailsContent').hidden = true;
  $('#enclosureAssignOpen').disabled = true;
  $('#enclosureDetailsPage').dataset.enclosureId=String(id);
  enclosureDetailStatus('Loading enclosure profile…');
  $('#pageEyebrow').textContent = 'HABITAT MANAGEMENT';
  $('#pageTitle').textContent = 'Enclosure Details';
  $('#pageDescription').textContent = 'Habitat overview and assigned companions.';
  document.querySelectorAll('.nav-link').forEach(link=>{
    const active=link.dataset.page==='enclosures';link.classList.toggle('active',active);
    if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
  });
  $('#sidebar').classList.remove('open'); $('#menuButton').setAttribute('aria-expanded','false');
  window.scrollTo({top:0,left:0,behavior:'instant'});
  const [enclosureResult,petsResult] = await Promise.allSettled([
    getCollectionJson(`/api/enclosures/${id}`),
    getCollectionJson(`/api/enclosures/${id}/pets`)
  ]);
  if (request!==enclosureDetailsRequest) return;
  if (enclosureResult.status!=='fulfilled' || !enclosureResult.value?.id) {
    enclosureDetailStatus('Unable to load this enclosure. It may have been removed, or the Enclosure Service is unavailable.',id);
    return;
  }
  const petsError = petsResult.status!=='fulfilled' || !Array.isArray(petsResult.value);
  renderEnclosureDetails(enclosureResult.value,petsError?[]:petsResult.value,petsError);
  $('#enclosureAssignOpen').disabled = petsError;
  $('#enclosureDetailsStatus').hidden=true;
  $('#enclosureDetailsContent').hidden=false;
  startEnclosureMonitoring(enclosureResult.value,request);
  startEnclosureHistory(enclosureResult.value,request);
}
$('#enclosureDetailsBack').addEventListener('click',()=>{petReturnEnclosureId=null;navigate('enclosures');});

// Stage 3D.3 — Mode-aware environmental monitoring, scoped to the active enclosure.
const MONITOR_POLL_MS = 5000;
const MONITOR_STALE_MS = 20000;
let enclosureMonitorTimer = null;
let enclosureMonitorGeneration = 0;
let enclosureMonitorInFlight = false;
let enclosureMonitorSaving = false;
let enclosureMonitorActive = null;
let enclosureMonitorReading = null;
let enclosureMonitorError = false;

function stopEnclosureMonitoring() {
  ++enclosureMonitorGeneration;
  if (enclosureMonitorTimer !== null) clearInterval(enclosureMonitorTimer);
  enclosureMonitorTimer = null;
  enclosureMonitorActive = null;
  enclosureMonitorReading = null;
  enclosureMonitorInFlight = false;
  enclosureMonitorError = false;
}
function enclosureMonitorVisible(generation, enclosureId) {
  return generation === enclosureMonitorGeneration &&
    !$('#enclosureDetailsPage').hidden &&
    !$('#enclosureDetailsContent').hidden &&
    Number($('#enclosureDetailsPage').dataset.enclosureId) === enclosureId;
}
function enclosureMonitorDate(value) {
  if (typeof value !== 'string' || !/Z$/.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
function enclosureMonitorFormat(value) {
  return Number.isFinite(value) ? Number(value).toLocaleString(undefined,{maximumFractionDigits:2}) : '—';
}
function enclosureMonitorFeedback(message, error = false) {
  const element = $('#enclosureMonitoringFeedback');
  element.hidden = !message;
  element.textContent = message;
  element.classList.toggle('is-error',error);
}
function renderEnclosureMonitoring() {
  const enclosure = enclosureMonitorActive;
  if (!enclosure) return;
  const manual = enclosure.monitoringMode === 'manual';
  const reading = enclosureMonitorReading;
  const validReading = reading && (reading.status === 'normal' || reading.status === 'abnormal') &&
    Number.isFinite(reading.temperature) && Number.isFinite(reading.humidity);
  const recorded = validReading ? enclosureMonitorDate(reading.recordedAt) : null;
  // Automatic observations must never display as currently safe once outdated.
  const stale = !manual && validReading && (!recorded || Math.abs(Date.now() - recorded.getTime()) > MONITOR_STALE_MS);
  let status = 'no_reading';
  let message = manual ? 'No manual observations recorded for this monitoring period.' : 'Waiting for the first sensor reading.';
  if (enclosureMonitorError) {status='unavailable';message='Environmental readings unavailable. Check the Enclosure Service.';}
  else if (validReading) {
    if (stale) {status='stale';message=reading.status === 'abnormal' ? 'Last reading was abnormal · Sensor data outdated' : 'Sensor data outdated · Current conditions unknown';}
    else if (reading.status === 'abnormal') {status='abnormal';message='Conditions outside the acceptable range';}
    else {status='normal';message='Conditions within the acceptable range';}
  }
  const statusNode = $('#enclosureMonitoringStatus');
  statusNode.dataset.state=status;
  statusNode.textContent=message;
  $('#enclosureMonitoringTemperature').textContent=validReading ? `${enclosureMonitorFormat(reading.temperature)} °C` : '—';
  $('#enclosureMonitoringHumidity').textContent=validReading ? `${enclosureMonitorFormat(reading.humidity)}%` : '—';
  for (const [id,value,min,max] of [
    ['enclosureMonitoringTemperatureCard',reading?.temperature,enclosure.minTemperature,enclosure.maxTemperature],
    ['enclosureMonitoringHumidityCard',reading?.humidity,enclosure.minHumidity,enclosure.maxHumidity]
  ]) {
    const node=$('#'+id);
    node.classList.toggle('is-abnormal',Boolean(validReading && (value < min || value > max)));
  }
  $('#enclosureMonitoringSource').textContent=`Source: ${manual ? 'Manual observation' : 'Sensor / simulator'}`;
  $('#enclosureMonitoringTimestamp').textContent=recorded && !enclosureMonitorError ? `Last ${manual ? 'observation' : 'reading'}: ${recorded.toLocaleString()}` : `Last ${manual ? 'observation' : 'reading'}: —`;
}
async function refreshEnclosureMonitoring(generation, enclosureId) {
  if (!enclosureMonitorVisible(generation,enclosureId) || enclosureMonitorInFlight || document.hidden) return;
  enclosureMonitorInFlight=true;
  try {
    const result=await getCollectionJson(`/api/enclosures/${enclosureId}/readings/current`);
    if (!enclosureMonitorVisible(generation,enclosureId)) return;
    if (!result || Number(result.enclosureId)!==enclosureId || result.monitoringMode!==enclosureMonitorActive.monitoringMode ||
        !['normal','abnormal','no_reading'].includes(result.status) ||
        (result.status!=='no_reading' && (typeof result.temperature!=='number' || typeof result.humidity!=='number' ||
          result.source!==(enclosureMonitorActive.monitoringMode==='manual'?'manual':'sensor')))) {
      throw new Error('Invalid monitoring response');
    }
    enclosureMonitorReading=result;
    enclosureMonitorError=false;
  } catch (error) {
    if (!enclosureMonitorVisible(generation,enclosureId)) return;
    enclosureMonitorError=true;
    enclosureMonitorReading=null;
    console.warn('Environmental monitoring unavailable:',error);
  } finally {
    if (generation===enclosureMonitorGeneration) {
      enclosureMonitorInFlight=false;
      if (enclosureMonitorVisible(generation,enclosureId)) renderEnclosureMonitoring();
    }
  }
}
function startEnclosureMonitoring(enclosure, detailsRequest) {
  // Opening any enclosure resets the lifecycle and its previous measurement.
  stopEnclosureMonitoring();
  if (detailsRequest!==enclosureDetailsRequest || $('#enclosureDetailsPage').hidden) return;
  enclosureMonitorActive=enclosure;
  const generation=enclosureMonitorGeneration;
  const id=Number(enclosure.id);
  const manual=enclosure.monitoringMode==='manual';
  $('#enclosureMonitoringMode').textContent=manual?'Manual':'Automatic';
  $('#enclosureMonitoringTemperatureRange').textContent=`Acceptable range: ${enclosureMonitorFormat(enclosure.minTemperature)}–${enclosureMonitorFormat(enclosure.maxTemperature)} °C`;
  $('#enclosureMonitoringHumidityRange').textContent=`Acceptable range: ${enclosureMonitorFormat(enclosure.minHumidity)}–${enclosureMonitorFormat(enclosure.maxHumidity)}%`;
  $('#enclosureMonitoringManualForm').hidden=!manual;
  $('#enclosureMonitoringRefresh').hidden=manual;
  $('#enclosureManualTemperature').value='';
  $('#enclosureManualHumidity').value='';
  enclosureMonitorFeedback('');
  renderEnclosureMonitoring();
  void refreshEnclosureMonitoring(generation,id);
  if (!manual) {
    enclosureMonitorTimer=setInterval(()=>{
      if (!enclosureMonitorVisible(generation,id)) {stopEnclosureMonitoring();return;}
      renderEnclosureMonitoring(); // Age readings even when the network is unavailable.
      void refreshEnclosureMonitoring(generation,id);
    },MONITOR_POLL_MS);
  }
}
$('#enclosureMonitoringManualForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const enclosure=enclosureMonitorActive;
  if (!enclosure || enclosure.monitoringMode!=='manual' || enclosureMonitorSaving) return;
  const tempInput=$('#enclosureManualTemperature');
  const humInput=$('#enclosureManualHumidity');
  const temperature=Number(tempInput.value);
  const humidity=Number(humInput.value);
  if (tempInput.value.trim()==='' || humInput.value.trim()==='' ||
      !Number.isFinite(temperature) || !Number.isFinite(humidity) || humidity<0 || humidity>100) {
    enclosureMonitorFeedback('Enter a valid temperature and humidity between 0% and 100%.',true);
    return;
  }
  const generation=enclosureMonitorGeneration;
  const id=Number(enclosure.id);
  enclosureMonitorSaving=true;
  $('#enclosureMonitoringSave').disabled=true;
  enclosureMonitorFeedback('');
  try {
    const recordedAt=new Date().toISOString().replace(/\.\d{3}Z$/,'Z');
    await enclosureApiRequest(`/api/enclosures/${id}/readings/manual`,'POST',{temperature,humidity,recordedAt});
    if (!enclosureMonitorVisible(generation,id)) return;
    tempInput.value='';humInput.value='';
    enclosureMonitorFeedback('Observation saved successfully.');
    await refreshEnclosureMonitoring(generation,id);
    void refreshEnclosureHistory();
  } catch (error) {
    if (enclosureMonitorVisible(generation,id)) enclosureMonitorFeedback(error.message || 'Unable to save observation.',true);
  } finally {
    enclosureMonitorSaving=false;
    $('#enclosureMonitoringSave').disabled=false;
  }
});
document.addEventListener('visibilitychange',()=>{
  if (!document.hidden && currentPage === 'dashboard') {
    startDashboardRefresh();
    void refreshDashboardConditions();
  }
  const enclosure=enclosureMonitorActive;
  if (!document.hidden && enclosureHistoryActive) void refreshEnclosureHistory();
  if (!document.hidden && enclosure && enclosure.monitoringMode==='automatic') {
    renderEnclosureMonitoring();
    void refreshEnclosureMonitoring(enclosureMonitorGeneration,Number(enclosure.id));
  }
});

// Stage 3D.5.2 — Historical observations, independent of live monitoring and alerts.
// All history is enclosure-scoped. The backend returns newest-first, max 1000.
const HISTORY_POLL_MS = 15000;
const HISTORY_LIMIT = 1000;
const HISTORY_NS = 'http://www.w3.org/2000/svg';
let enclosureHistoryActive = null;
let enclosureHistoryGeneration = 0;
let enclosureHistoryRequest = 0;
let enclosureHistoryTimer = null;
let enclosureHistoryBusy = false;
let enclosureHistoryPending = false;
let enclosureHistoryRecords = [];
let enclosureHistoryInvalid = 0;
let enclosureHistoryTruncated = false;
let enclosureHistoryError = '';
let enclosureHistoryRange = '24h';
let enclosureHistoryFocused = true;

function stopEnclosureHistory() {
  ++enclosureHistoryGeneration;
  ++enclosureHistoryRequest;
  if (enclosureHistoryTimer !== null) clearInterval(enclosureHistoryTimer);
  enclosureHistoryTimer = null;
  enclosureHistoryActive = null;
  enclosureHistoryBusy = false;
  enclosureHistoryPending = false;
  enclosureHistoryRecords = [];
  enclosureHistoryError = '';
}
function enclosureHistoryVisible() {
  return enclosureHistoryActive && currentPage === 'enclosures' &&
    !$('#enclosureDetailsPage').hidden && !$('#enclosureDetailsContent').hidden &&
    Number($('#enclosureDetailsPage').dataset.enclosureId) === Number(enclosureHistoryActive.id);
}
function enclosureHistoryLocalDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function enclosureHistoryBounds() {
  const now = new Date();
  if (enclosureHistoryRange !== 'custom') {
    const days = enclosureHistoryRange === '24h' ? 1 : enclosureHistoryRange === '7d' ? 7 : 30;
    return {start:new Date(now.getTime()-days*86400000),end:now};
  }
  const from=$('#enclosureHistoryFrom').value, to=$('#enclosureHistoryTo').value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const start=new Date(`${from}T00:00:00`), exclusiveEnd=new Date(`${to}T00:00:00`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(exclusiveEnd.getTime()) ||
      enclosureHistoryLocalDate(start)!==from || enclosureHistoryLocalDate(exclusiveEnd)!==to || start>exclusiveEnd) return null;
  exclusiveEnd.setDate(exclusiveEnd.getDate()+1);
  return {start,end:new Date(exclusiveEnd.getTime()-1)};
}
function enclosureHistoryQueryBounds(bounds) {
  // The API accepts UTC calendar days, not times. Expand one day either side,
  // then filter using exact timestamps in the browser.
  const from=new Date(bounds.start.getTime()-86400000).toISOString().slice(0,10);
  const to=new Date(bounds.end.getTime()+86400000).toISOString().slice(0,10);
  return {from,to};
}
function enclosureHistoryValid(record,id) {
  if (!record || !Number.isSafeInteger(record.id) || record.id<=0 || Number(record.enclosureId)!==id ||
      typeof record.temperature!=='number' || !Number.isFinite(record.temperature) ||
      typeof record.humidity!=='number' || !Number.isFinite(record.humidity) ||
      record.humidity<0 || record.humidity>100 || !['sensor','manual'].includes(record.source)) return false;
  return Boolean(enclosureMonitorDate(record.recordedAt));
}
function enclosureHistorySvg(tag,attrs={}) {
  const node=document.createElementNS(HISTORY_NS,tag);
  Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,String(value)));
  return node;
}
function enclosureHistoryChart(records,bounds,metric) {
  const host=$(`#enclosureHistory${metric==='temperature'?'Temperature':'Humidity'}`);
  host.replaceChildren();
  const enclosure=enclosureHistoryActive;
  const low=metric==='temperature' ? enclosure.minTemperature : enclosure.minHumidity;
  const high=metric==='temperature' ? enclosure.maxTemperature : enclosure.maxHumidity;
  const values=records.map(record=>record[metric]);
  const marks=[...values,...[low,high].filter(Number.isFinite)];
  let min=metric==='humidity' ? 0 : Math.min(...marks);
  let max=metric==='humidity' ? 100 : Math.max(...marks);
  if (metric==='temperature') {
    const pad=Math.max((max-min)*.12,.75);min-=pad;max+=pad;
  }
  if (!Number.isFinite(min)||!Number.isFinite(max)||max<=min) {min=0;max=1;}
  const w=900,h=250,left=57,right=17,top=16,bottom=38;
  const plotW=w-left-right,plotH=h-top-bottom;
  // Focus mode zooms to the recorded timestamps without changing the selected
  // date filter. Full range remains available to reveal gaps in coverage.
  const times=records.map(record=>Date.parse(record.recordedAt));
  let start=bounds.start.getTime(),end=Math.max(bounds.end.getTime(),start+1);
  if(enclosureHistoryFocused && times.length) {
    const first=Math.min(...times),last=Math.max(...times);
    const pad=Math.max((last-first)*.05,5*60000);
    start=Math.max(start,first-pad);
    end=Math.min(end,last+pad);
    if(end<=start) end=start+1;
  }
  const x=date=>left+((date-start)/(end-start))*plotW;
  const y=value=>top+(max-value)/(max-min)*plotH;
  const svg=enclosureHistorySvg('svg',{viewBox:`0 0 ${w} ${h}`,role:'img',
    'aria-label':`${metric==='temperature'?'Temperature in degrees Celsius':'Humidity percentage'} history, ${records.length} observations`});
  // The soft band represents the enclosure's configured range today, not a
  // reconstructed historical range and not an animal-health determination.
  if(Number.isFinite(low) && Number.isFinite(high) && low<high) {
    const bandTop=y(high),bandBottom=y(low);
    svg.append(enclosureHistorySvg('rect',{x:left,y:bandTop,width:plotW,height:bandBottom-bandTop,class:'enclosure-history-range-band'}));
  }
  for(let n=0;n<=4;n++) {
    const value=min+(max-min)*n/4, yy=y(value);
    svg.append(enclosureHistorySvg('line',{x1:left,y1:yy,x2:w-right,y2:yy,class:'enclosure-history-grid'}));
    const label=enclosureHistorySvg('text',{x:left-9,y:yy+4,'text-anchor':'end',class:'enclosure-history-axis'});
    label.textContent=enclosureMonitorFormat(value);svg.append(label);
  }
  const axisLabels=[new Date(start),new Date((start+end)/2),new Date(end)];
  axisLabels.forEach((date,index)=>{
    const txt=enclosureHistorySvg('text',{x:x(date.getTime()),y:h-12,
      'text-anchor':index===0?'start':index===2?'end':'middle',class:'enclosure-history-axis'});
    txt.textContent=date.toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
    svg.append(txt);
  });
  for(const value of [low,high]) {
    if(!Number.isFinite(value)) continue;
    svg.append(enclosureHistorySvg('line',{x1:left,y1:y(value),x2:w-right,y2:y(value),class:'enclosure-history-limit'}));
  }
  // Connect consecutive observations from each source independently. Lines
  // are visual guides between known measurements, not interpolated readings.
  let previousSensor=null, previousManual=null;
  records.forEach(record=>{
    const time=Date.parse(record.recordedAt);
    const previous=record.source==='sensor' ? previousSensor : previousManual;
    if(previous && time>=previous.time) {
      svg.append(enclosureHistorySvg('line',{
        x1:x(previous.time),y1:y(previous.value),x2:x(time),y2:y(record[metric]),
        class:record.source==='manual' ? 'enclosure-history-manual-series' : 'enclosure-history-series'
      }));
    }
    if(record.source==='manual') previousManual={time,value:record[metric]};
    else previousSensor={time,value:record[metric]};
  });
  records.forEach(record=>{
    const time=Date.parse(record.recordedAt), px=x(time),py=y(record[metric]);
    const mark=record.source==='manual'
      ? enclosureHistorySvg('polygon',{points:`${px},${py-5} ${px+5},${py} ${px},${py+5} ${px-5},${py}`,class:'enclosure-history-point manual'})
      : enclosureHistorySvg('circle',{cx:px,cy:py,r:2.8,class:'enclosure-history-point sensor'});
    const date=new Date(time).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'medium'});
    const tooltip=enclosureHistorySvg('title');
    tooltip.textContent=`${date} · ${record.source==='manual'?'Manual observation':'Sensor reading'} · ${enclosureMonitorFormat(record[metric])}${metric==='temperature'?' °C':'%'}`;
    mark.append(tooltip);mark.setAttribute('tabindex','0');svg.append(mark);
  });
  host.append(svg);
}
// Zoom choices reflect the current date window; the cutoff is measured back
// from the latest observation so historic/custom ranges remain useful.
function enclosureHistoryZoomChoices() {
  const bounds=enclosureHistoryBounds();
  if (!bounds) return [{minutes:0,label:'All readings'}];
  const duration=(bounds.end.getTime()-bounds.start.getTime())/60000;
  let options;
  if (duration<=2*1440) options=[[30,'Latest 30 minutes'],[120,'Latest 2 hours'],[360,'Latest 6 hours']];
  else if (duration<=14*1440) options=[[360,'Latest 6 hours'],[1440,'Latest 1 day'],[4320,'Latest 3 days']];
  else options=[[1440,'Latest 1 day'],[10080,'Latest 7 days'],[20160,'Latest 14 days']];
  return [{minutes:0,label:'All readings'},
    ...options.filter(([minutes])=>minutes<duration).map(([minutes,label])=>({minutes,label}))];
}
function updateEnclosureHistoryZoom(reset=false) {
  const select=$('#enclosureHistoryZoom');
  const previous=reset ? '0' : select.value;
  const choices=enclosureHistoryZoomChoices();
  select.replaceChildren();
  choices.forEach(choice=>{
    const option=document.createElement('option');
    option.value=String(choice.minutes);
    option.textContent=choice.label;
    select.append(option);
  });
  select.value=choices.some(choice=>String(choice.minutes)===previous)?previous:'0';
}
function renderEnclosureHistory() {
  if(!enclosureHistoryVisible()) return;
  const bounds=enclosureHistoryBounds();
  const feedback=$('#enclosureHistoryFeedback'), charts=$('#enclosureHistoryCharts');
  if(!bounds) {feedback.hidden=false;feedback.textContent='Choose a valid start and end date (start must not be after end).';charts.hidden=true;return;}
  if(enclosureHistoryError) {feedback.hidden=false;feedback.textContent=enclosureHistoryError;charts.hidden=true;return;}
  const source=$('#enclosureHistorySource').value;
  const rows=enclosureHistoryRecords.filter(r=>{
    const t=Date.parse(r.recordedAt);
    return t>=bounds.start.getTime() && t<=bounds.end.getTime() && (source==='all'||source===r.source);
  });
  const notes=[];
  notes.push(`${rows.length} ${rows.length===1?'observation':'observations'} in this view.`);
  if(enclosureHistoryTruncated) notes.push('The API returned its 1,000-record limit; earlier observations in this period may be missing.');
  if(enclosureHistoryInvalid) notes.push(`${enclosureHistoryInvalid} invalid ${enclosureHistoryInvalid===1?'record was':'records were'} excluded.`);
  if(!rows.length) notes.push('No recorded measurements match these filters.');
  feedback.hidden=false;feedback.textContent=notes.join(' ');
  charts.hidden=!rows.length;
  if(!rows.length) return;
  updateEnclosureHistoryZoom();
  const zoomMinutes=Number($('#enclosureHistoryZoom').value);
  const latest=Date.parse(rows[rows.length-1].recordedAt);
  const chartRows=zoomMinutes>0
    ? rows.filter(row=>Date.parse(row.recordedAt)>=latest-zoomMinutes*60000)
    : rows;
  $('#enclosureHistoryZoomCount').textContent=zoomMinutes>0
    ? `Showing ${chartRows.length} of ${rows.length} filtered observations in the charts. Measurement details retain all filtered observations.`
    : '';
  enclosureHistoryChart(chartRows,bounds,'temperature');
  enclosureHistoryChart(chartRows,bounds,'humidity');
  const body=$('#enclosureHistoryRows');body.replaceChildren();
  // The chart includes every returned valid point. Details are capped for usability.
  const listed=rows.slice(-25).reverse();
  $('#enclosureHistoryDetailsSummary').textContent=`Measurement details · latest ${listed.length} of ${rows.length}`;
  listed.forEach(record=>{
    const tr=elem('tr');
    [new Date(record.recordedAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'medium'}),
      record.source==='manual'?'Manual':'Sensor',`${enclosureMonitorFormat(record.temperature)} °C`,`${enclosureMonitorFormat(record.humidity)}%`]
      .forEach(value=>tr.append(elem('td',null,value)));
    body.append(tr);
  });
}
async function refreshEnclosureHistory() {
  if(!enclosureHistoryVisible() || document.hidden) return;
  if(enclosureHistoryBusy) {enclosureHistoryPending=true;return;}
  const bounds=enclosureHistoryBounds();
  if(!bounds) {renderEnclosureHistory();return;}
  const generation=enclosureHistoryGeneration, request=++enclosureHistoryRequest;
  const id=Number(enclosureHistoryActive.id), query=enclosureHistoryQueryBounds(bounds);
  enclosureHistoryBusy=true;
  try {
    const result=await getCollectionJson(`/api/enclosures/${id}/readings/history?from=${query.from}&to=${query.to}&limit=${HISTORY_LIMIT}`);
    if(generation!==enclosureHistoryGeneration || request!==enclosureHistoryRequest || !enclosureHistoryVisible()) return;
    if(!Array.isArray(result) || result.length>HISTORY_LIMIT) throw new Error('Invalid history API response');
    enclosureHistoryTruncated=result.length===HISTORY_LIMIT;
    enclosureHistoryInvalid=0;
    const valid=[];
    result.forEach(record=>{
      if(enclosureHistoryValid(record,id)) valid.push(record);
      else enclosureHistoryInvalid++;
    });
    valid.sort((a,b)=>Date.parse(a.recordedAt)-Date.parse(b.recordedAt)||a.id-b.id);
    enclosureHistoryRecords=valid;
    enclosureHistoryError='';
  }catch(error) {
    if(generation!==enclosureHistoryGeneration || !enclosureHistoryVisible()) return;
    console.warn('Environmental history unavailable:',error);
    enclosureHistoryError='Unable to load environmental history. Check the Enclosure Service and select Refresh history to retry.';
  }finally {
    if(generation===enclosureHistoryGeneration) {
      enclosureHistoryBusy=false;
      if(enclosureHistoryVisible()) {
        if(enclosureHistoryPending) {
          enclosureHistoryPending=false;
          void refreshEnclosureHistory();
        } else renderEnclosureHistory();
      }
    }
  }
}
function startEnclosureHistory(enclosure,detailsRequest) {
  stopEnclosureHistory();
  if(detailsRequest!==enclosureDetailsRequest || $('#enclosureDetailsPage').hidden) return;
  enclosureHistoryActive=enclosure;
  enclosureHistoryRange='24h';
  $('#enclosureHistorySource').value='all';
  enclosureHistoryFocused=true;
  $('#enclosureHistoryFocus').checked=true;
  updateEnclosureHistoryZoom(true);
  const today=new Date();
  $('#enclosureHistoryTo').value=enclosureHistoryLocalDate(today);
  today.setDate(today.getDate()-7);
  $('#enclosureHistoryFrom').value=enclosureHistoryLocalDate(today);
  $('#enclosureHistoryCustom').hidden=true;
  document.querySelectorAll('[data-history-range]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.historyRange==='24h')));
  $('#enclosureHistoryFeedback').textContent='Loading reading history…';
  $('#enclosureHistoryCharts').hidden=true;
  void refreshEnclosureHistory();
  if(enclosure.monitoringMode==='automatic') {
    const generation=enclosureHistoryGeneration;
    enclosureHistoryTimer=setInterval(()=>{
      if(generation!==enclosureHistoryGeneration || !enclosureHistoryVisible()) {clearInterval(enclosureHistoryTimer);enclosureHistoryTimer=null;return;}
      if(!document.hidden) void refreshEnclosureHistory();
    },HISTORY_POLL_MS);
  }
}
document.querySelectorAll('[data-history-range]').forEach(button=>button.addEventListener('click',()=>{
  enclosureHistoryRange=button.dataset.historyRange;
  document.querySelectorAll('[data-history-range]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  $('#enclosureHistoryCustom').hidden=enclosureHistoryRange!=='custom';
  updateEnclosureHistoryZoom(true);
  if(enclosureHistoryRange==='custom') {renderEnclosureHistory();return;}
  void refreshEnclosureHistory();
}));
$('#enclosureHistoryApply').addEventListener('click',()=>{updateEnclosureHistoryZoom(true);void refreshEnclosureHistory();});
$('#enclosureHistorySource').addEventListener('change',renderEnclosureHistory);
$('#enclosureHistoryFocus').addEventListener('change',event=>{enclosureHistoryFocused=event.target.checked;renderEnclosureHistory();});
$('#enclosureHistoryZoom').addEventListener('change',renderEnclosureHistory);
$('#enclosureHistoryRetry').addEventListener('click',()=>void refreshEnclosureHistory());

// Stage 3D.2 — enclosure editing, occupancy management and confirmation.
let currentEnclosureDetail = null;
let enclosureEditInitial = '';
let enclosureEditBusy = false;
let enclosureConfirmCallback = null;
let enclosurePendingCancel = null;
// Both enclosure forms use radio controls; the saved mode stays independent of the latest readings.
function enclosureSelectedMode(groupName) {
  return document.querySelector(`input[name="${groupName}"]:checked`)?.value || 'manual';
}
function enclosureSetMode(groupName, value) {
  const radio = document.querySelector(`input[name="${groupName}"][value="${value === 'manual' ? 'manual' : 'automatic'}"]`);
  if (radio) radio.checked = true;
}
const enclosureEditFields = ['enclosureEditName','enclosureEditType','enclosureEditMinTemp','enclosureEditMaxTemp','enclosureEditMinHum','enclosureEditMaxHum','enclosureEditNotes'];
function enclosureEditSnapshot() {return JSON.stringify([...enclosureEditFields.map(id=>$('#'+id).value),enclosureSelectedMode('enclosureEditMonitoringMode')]);}
async function enclosureApiRequest(url,method,payload) {
  const response = await fetch(url,{method,headers:{'Content-Type':'application/json',Accept:'application/json'},body:payload==null?undefined:JSON.stringify(payload)});
  let body = null;
  if(response.status!==204) body=await response.json().catch(()=>null);
  if(!response.ok) throw new Error(body?.error || `Request failed (HTTP ${response.status}).`);
  return body;
}
function enclosureEditError(message) {const el=$('#enclosureEditFeedback');el.hidden=!message;el.textContent=message;}
function showEnclosureEdit() {
  if(!currentEnclosureDetail)return;
  const e=currentEnclosureDetail;
  const values=[e.name,e.enclosureType||'',e.minTemperature,e.maxTemperature,e.minHumidity,e.maxHumidity,e.notes||''];
  enclosureEditFields.forEach((id,i)=>{$('#'+id).value=values[i]??'';$('#'+id).classList.remove('enclosure-input-invalid');});
  enclosureSetMode('enclosureEditMonitoringMode', e.monitoringMode || 'automatic');
  enclosureEditInitial=enclosureEditSnapshot(); enclosureEditError('');
  $('#enclosureEditDialog').showModal();
}
function closeEnclosureEdit() {
  if(enclosureEditBusy)return;
  if(enclosureEditSnapshot()!==enclosureEditInitial){$('#enclosureEditDiscardDialog').showModal();return;}
  $('#enclosureEditDialog').close();
}
$('#enclosureDetailsEdit').addEventListener('click',showEnclosureEdit);
$('#enclosureEditCancel').addEventListener('click',closeEnclosureEdit);
$('#enclosureEditDialog').addEventListener('cancel',e=>{if(enclosureEditBusy||enclosureEditSnapshot()!==enclosureEditInitial){e.preventDefault();if(!enclosureEditBusy)$('#enclosureEditDiscardDialog').showModal();}});
$('#enclosureEditKeep').addEventListener('click',()=>$('#enclosureEditDiscardDialog').close());
$('#enclosureEditDiscard').addEventListener('click',()=>{$('#enclosureEditDiscardDialog').close();$('#enclosureEditDialog').close();});
$('#enclosureEditForm').addEventListener('submit',async e=>{
  e.preventDefault();if(enclosureEditBusy||!currentEnclosureDetail)return;
  enclosureEditFields.forEach(id=>$('#'+id).classList.remove('enclosure-input-invalid'));
  const name=$('#enclosureEditName').value.trim();
  const numericIds=['enclosureEditMinTemp','enclosureEditMaxTemp','enclosureEditMinHum','enclosureEditMaxHum'];
  const raw=numericIds.map(id=>$('#'+id).value.trim());
  const numbers=raw.map(Number);
  let error='',bad=[];
  if(!name){error='Please enter an enclosure name.';bad=['enclosureEditName'];}
  else if(raw.some(v=>v==='')||numbers.some(n=>!Number.isFinite(n))){error='Enter valid numbers in every environmental field.';bad=numericIds;}
  else if(numbers[0]>=numbers[1]){error='Minimum temperature must be lower than maximum temperature.';bad=numericIds.slice(0,2);}
  else if(numbers[2]<0||numbers[3]>100||numbers[2]>=numbers[3]){error='Humidity must be between 0% and 100%, with minimum lower than maximum.';bad=numericIds.slice(2);}
  if(error){bad.forEach(id=>$('#'+id).classList.add('enclosure-input-invalid'));enclosureEditError(error);return;}
  const [minTemperature,maxTemperature,minHumidity,maxHumidity]=numbers;
  const payload={name,enclosureType:$('#enclosureEditType').value||null,notes:$('#enclosureEditNotes').value.trim()||null,minTemperature,maxTemperature,minHumidity,maxHumidity,monitoringMode:enclosureSelectedMode('enclosureEditMonitoringMode')};
  enclosureEditBusy=true;$('#enclosureEditSave').disabled=true;enclosureEditError('');
  try{
    const id=Number(currentEnclosureDetail.id);
    await enclosureApiRequest(`/api/enclosures/${id}`,'PUT',payload);
    enclosureEditInitial=enclosureEditSnapshot();$('#enclosureEditDialog').close();
    await openEnclosureDetails(id);toast('Enclosure updated successfully.');
  }catch(err){enclosureEditError(err.message);}
  finally{enclosureEditBusy=false;$('#enclosureEditSave').disabled=false;}
});
function confirmEnclosureAction(message,callback,title='Confirm action') {
  enclosureConfirmCallback=callback;
  $('#enclosureConfirmTitle').textContent=title;
  $('#enclosureConfirmText').textContent=message;
  $('#enclosureConfirmError').hidden=true;
  $('#enclosureConfirmProceed').disabled=false;
  $('#enclosureConfirmDialog').showModal();
}
$('#enclosureConfirmCancel').addEventListener('click',()=>{$('#enclosureConfirmDialog').close();enclosureConfirmCallback=null;});
$('#enclosureConfirmProceed').addEventListener('click',async()=>{
  if(!enclosureConfirmCallback)return;
  $('#enclosureConfirmProceed').disabled=true;
  try{await enclosureConfirmCallback();enclosureConfirmCallback=null;$('#enclosureConfirmDialog').close();}
  catch(error){const el=$('#enclosureConfirmError');el.hidden=false;el.textContent=error.message;}
  finally{$('#enclosureConfirmProceed').disabled=false;}
});
$('#enclosureDeleteOpen').addEventListener('click',()=>{
  const e=currentEnclosureDetail;if(!e)return;
  $('#enclosureEditDialog').close();
  confirmEnclosureAction(`Permanently delete ${e.name}? Historical readings belonging to this enclosure will also be deleted. Deletion is blocked while pets are assigned.`,async()=>{
    await enclosureApiRequest(`/api/enclosures/${e.id}`,'DELETE');
    currentEnclosureDetail=null;navigate('enclosures');toast('Enclosure permanently deleted.');
  },'Delete enclosure permanently?');
});
async function updatePetEnclosure(pet,enclosureId){
  // PUT requires a complete profile; never overwrite other values with defaults.
  const full=await getCollectionJson(`/api/pets/${pet.id}`);
  const payload={name:full.name,species:full.species,enclosure_id:enclosureId,
    gender:full.gender||'unknown',date_of_birth:full.date_of_birth||null,
    notes:full.notes??null,illustration_key:full.illustration_key??null};
  await enclosureApiRequest(`/api/pets/${pet.id}`,'PUT',payload);
}
let enclosureAssignablePets=[];
function renderEnclosureAssignmentOptions(){
  const host=$('#enclosureAssignmentOptions');host.replaceChildren();
  const search=$('#enclosureAssignmentSearch').value.trim().toLowerCase();
  const available=enclosureAssignablePets.filter(p=>Number(p.enclosure_id)!==Number(currentEnclosureDetail?.id)).filter(p=>`${p.name||''} ${p.species||''}`.toLowerCase().includes(search));
  if(!available.length){host.append(elem('p','enclosure-occupants-empty','No available pets match your search.'));return;}
  available.forEach(p=>{
    const btn=elem('button','enclosure-assignment-option');btn.type='button';
    const info=elem('span');info.append(elem('strong',null,p.name||'Unnamed pet'),elem('small',null,`${p.species||'Species unknown'} · ${p.enclosure_id==null?'Unassigned':'Currently in another enclosure'}`));
    btn.append(enclosurePetPicture(p,'enclosure-occupant-art'),info);
    btn.addEventListener('click',()=>{
      const id=Number(currentEnclosureDetail.id);
      $('#enclosureAssignmentDialog').close();
      confirmEnclosureAction(`Assign ${p.name||'this pet'} to ${currentEnclosureDetail.name}? ${p.enclosure_id==null?'':'This will move the pet from its current enclosure.'}`,async()=>{
        await updatePetEnclosure(p,id);await openEnclosureDetails(id);toast('Pet assigned successfully.');
      });
    });
    host.append(btn);
  });
}
$('#enclosureAssignOpen').addEventListener('click',async()=>{
  const msg=$('#enclosureAssignmentFeedback');msg.hidden=true;msg.textContent='';
  $('#enclosureAssignmentSearch').value='';enclosureAssignablePets=[];
  $('#enclosureAssignmentOptions').replaceChildren(elem('p','enclosure-occupants-empty','Loading pets…'));
  $('#enclosureAssignmentDialog').showModal();
  try{const all=await getCollectionJson('/api/pets');if(!Array.isArray(all))throw new Error('Invalid pets response');if(!$('#enclosureAssignmentDialog').open)return;enclosureAssignablePets=all;renderEnclosureAssignmentOptions();}
  catch(err){if(!$('#enclosureAssignmentDialog').open)return;msg.textContent='Unable to load pets. Check Data Management and try again.';msg.hidden=false;$('#enclosureAssignmentOptions').replaceChildren();}
});
$('#enclosureAssignmentSearch').addEventListener('input',renderEnclosureAssignmentOptions);
$('#enclosureAssignmentCancel').addEventListener('click',()=>$('#enclosureAssignmentDialog').close());
$('#enclosureDetailsClose').addEventListener('click',()=>navigate('enclosures'));

// Stage 3D.1 — Enclosure collection and creation, using real Enclosure/Pets APIs.
let enclosureCollectionRequest = 0;
let enclosureCreateSaving = false;
let pendingEnclosureNavigation = null;
let enclosureFormInitial = '';
const enclosureFormFieldIds = ['enclosureNewName', 'enclosureNewType', 'enclosureMinTemperature',
  'enclosureMaxTemperature', 'enclosureMinHumidity', 'enclosureMaxHumidity', 'enclosureNewNotes'];
function enclosureFormSnapshot() { return JSON.stringify([...enclosureFormFieldIds.map(id => $(`#${id}`).value),enclosureSelectedMode('enclosureCreateMonitoringMode')]); }
function enclosureFormDirty() { return enclosureFormSnapshot() !== enclosureFormInitial; }
function enclosureMessage(message, retry = false) {
  const host = $('#enclosuresMessage'); host.replaceChildren(elem('p', null, message));
  if (retry) {
    const button = elem('button', 'primary-button', 'Try again'); button.type = 'button';
    button.addEventListener('click', loadEnclosuresCollection); host.append(button);
  }
  host.hidden = false;
}
let enclosureCollection = [];
let enclosurePetCounts = null;
function renderEnclosuresCollection() {
  const host = $('#enclosuresGrid'); host.replaceChildren();
  const search = $('#enclosuresSearch').value.trim().toLocaleLowerCase();
  const filtered = enclosureCollection.filter(item =>
    `${item.name || ''} ${item.enclosureType || ''}`.toLocaleLowerCase().includes(search));
  $('#enclosuresTotal').textContent = String(enclosureCollection.length);
  $('#enclosuresOccupied').textContent = enclosurePetCounts == null ? '—' :
    String([...enclosurePetCounts.values()].reduce((sum, count) => sum + count, 0));
  $('#enclosuresResults').textContent = `${filtered.length} of ${enclosureCollection.length} enclosures`;
  if (enclosurePetCounts == null) enclosureMessage('Pet occupancy is temporarily unavailable. Enclosures are still available.');
  else $('#enclosuresMessage').hidden = true;
  if (!filtered.length) {
    const empty = elem('div', 'enclosure-empty');
    empty.append(elem('span', 'section-kicker', 'YOUR HABITATS'),
      elem('h2', null, search ? 'No matching enclosures' : 'A home for every companion'),
      elem('p', null, search ? 'Try a different search.' : 'Create your first enclosure to organize environmental requirements.'));
    host.append(empty); return;
  }
  for (const enclosure of filtered) {
    const card = elem('article', 'enclosure-card');
    const head = elem('div', 'enclosure-card-head');
    const title = elem('div');
    title.append(elem('span', 'section-kicker', (enclosure.enclosureType || 'HABITAT').toUpperCase()),
      elem('h3', null, enclosure.name));
    const icon = elem('span', 'enclosure-card-icon', '⌂'); icon.setAttribute('aria-hidden','true');
    head.append(title, icon);
    const count = enclosurePetCounts == null ? null : (enclosurePetCounts.get(Number(enclosure.id)) || 0);
    const occupancy = elem('p', 'enclosure-card-occupancy', count === null ? 'Occupancy unavailable' :
      `${count} ${count === 1 ? 'pet' : 'pets'} assigned`);
    const ranges = elem('div','enclosure-card-ranges');
    const temp = elem('div');
    temp.append(elem('span', null, 'Temperature range'),elem('strong', null, `${enclosure.minTemperature}–${enclosure.maxTemperature} °C`));
    const humidity = elem('div');
    humidity.append(elem('span', null, 'Humidity range'),elem('strong', null, `${enclosure.minHumidity}–${enclosure.maxHumidity} %`));
    ranges.append(temp, humidity);
    card.append(head, occupancy, ranges);
    if (enclosure.notes) card.append(elem('p', 'enclosure-card-note', enclosure.notes));
    const detailsButton = elem('button', 'enclosure-card-open', 'View Details →');
    detailsButton.type = 'button';
    detailsButton.setAttribute('aria-label', `View details for ${enclosure.name}`);
    detailsButton.addEventListener('click', (event) => { event.stopPropagation(); openEnclosureDetails(Number(enclosure.id)); });
    card.addEventListener('click', () => openEnclosureDetails(Number(enclosure.id)));
    card.classList.add('enclosure-card--interactive');
    card.append(detailsButton);
    host.append(card);
  }
}
async function loadEnclosuresCollection() {
  const request = ++enclosureCollectionRequest;
  enclosureMessage('Loading registered enclosures…');
  $('#enclosuresGrid').replaceChildren();
  $('#enclosuresTotal').textContent = '—'; $('#enclosuresOccupied').textContent = '—';
  $('#enclosuresResults').textContent = '';
  const [enclosuresResult, petsResult] = await Promise.allSettled([
    getCollectionJson('/api/enclosures'), getCollectionJson('/api/pets')
  ]);
  if (request !== enclosureCollectionRequest) return;
  if (enclosuresResult.status !== 'fulfilled' || !Array.isArray(enclosuresResult.value)) {
    enclosureCollection = []; enclosurePetCounts = null;
    enclosureMessage('Unable to load enclosures. Check the Enclosure Service (port 3002) and frontend server (port 5500).', true);
    return;
  }
  enclosureCollection = enclosuresResult.value;
  enclosurePetCounts = null;
  if (petsResult.status === 'fulfilled' && Array.isArray(petsResult.value)) {
    enclosurePetCounts = new Map();
    for (const pet of petsResult.value) {
      if (pet.enclosure_id != null) {
        const id = Number(pet.enclosure_id);
        enclosurePetCounts.set(id, (enclosurePetCounts.get(id) || 0) + 1);
      }
    }
  }
  renderEnclosuresCollection();
}
function openEnclosureCreate() {
  $('#enclosureCreateForm').reset();
  enclosureSetMode('enclosureCreateMonitoringMode', 'manual');
  clearEnclosureValidation();
  enclosureFormInitial = enclosureFormSnapshot();
  $('#enclosureCreateStatus').textContent = '';
  $('#enclosureCreateStatus').hidden = true;
  $('#enclosuresPage').hidden = true;
  $('#enclosureCreatePage').hidden = false;
  $('#pageTitle').textContent = 'Add Enclosure';
  $('#pageDescription').textContent = 'Create a habitat with your own environmental requirements.';
  window.scrollTo({top:0,left:0,behavior:'instant'});
  $('#enclosureNewName').focus();
}
function closeEnclosureCreate() {
  $('#enclosureCreatePage').hidden = true;
  $('#enclosuresPage').hidden = false;
  $('#pageTitle').textContent = 'Enclosures';
  $('#pageDescription').textContent = 'Habitats and environmental monitoring.';
  window.scrollTo({top:0,left:0,behavior:'instant'});
}
function requestCloseEnclosureCreate() {
  if (enclosureCreateSaving) return;
  if (enclosureFormDirty()) { pendingEnclosureNavigation = null; $('#enclosureDiscardDialog').showModal(); }
  else closeEnclosureCreate();
}
$('#enclosuresAdd').addEventListener('click',openEnclosureCreate);
$('#enclosuresSearch').addEventListener('input',renderEnclosuresCollection);
$('#enclosureCreateBack').addEventListener('click',requestCloseEnclosureCreate);
$('#enclosureCreateCancel').addEventListener('click',requestCloseEnclosureCreate);
$('#enclosureDiscardKeep').addEventListener('click',()=>$('#enclosureDiscardDialog').close());
$('#enclosureDiscardProceed').addEventListener('click',()=>{
  $('#enclosureDiscardDialog').close();
  const destination = pendingEnclosureNavigation; pendingEnclosureNavigation = null;
  enclosureFormInitial = enclosureFormSnapshot();
  if (destination) navigate(destination); else closeEnclosureCreate();
});
const enclosureNumericFieldIds = ['enclosureMinTemperature', 'enclosureMaxTemperature', 'enclosureMinHumidity', 'enclosureMaxHumidity'];
const enclosureRequiredFieldIds = ['enclosureNewName', ...enclosureNumericFieldIds];
function clearEnclosureValidation() {
  for (const id of enclosureRequiredFieldIds) {
    const field = $(`#${id}`);
    field.classList.remove('enclosure-input-invalid');
    field.removeAttribute('aria-invalid');
  }
  for (const id of ['enclosureTemperatureError', 'enclosureHumidityError']) {
    const message = $(`#${id}`); message.textContent = ''; message.hidden = true;
  }
  const status = $('#enclosureCreateStatus');
  status.classList.remove('is-error');
  status.hidden = true;
}
function showEnclosureValidation(message, fieldIds, groupId = null) {
  const status = $('#enclosureCreateStatus');
  status.textContent = message;
  status.hidden = false;
  status.classList.add('is-error');
  fieldIds.forEach(id => {
    const field = $(`#${id}`);
    field.classList.add('enclosure-input-invalid');
    field.setAttribute('aria-invalid','true');
  });
  if (groupId) { const group = $(`#${groupId}`); group.hidden = false; group.textContent = message; }
  status.scrollIntoView({block:'nearest',behavior:'instant'});
  if (fieldIds.length) $(`#${fieldIds[0]}`).focus({preventScroll:true});
}
for (const id of enclosureRequiredFieldIds) {
  $(`#${id}`).addEventListener('input', () => {
    if ($('#enclosureCreateStatus').classList.contains('is-error')) {
      clearEnclosureValidation();
      $('#enclosureCreateStatus').textContent = '';
      $('#enclosureCreateStatus').hidden = true;
    }
  });
}
$('#enclosureCreateForm').addEventListener('submit',async event => {
  event.preventDefault(); if (enclosureCreateSaving) return;
  clearEnclosureValidation();
  const name = $('#enclosureNewName').value.trim();
  const inputs = enclosureNumericFieldIds;
  const values = inputs.map(id => $(`#${id}`).value.trim());
  const status = $('#enclosureCreateStatus');
  if (!name) { showEnclosureValidation('Please enter an enclosure name.', ['enclosureNewName']); return; }
  const missing = inputs.filter((id,i) => values[i] === '' || !Number.isFinite(Number(values[i])));
  if (missing.length) {
    showEnclosureValidation('Enter a valid number in every temperature and humidity field.', missing);
    return;
  }
  const [minTemperature,maxTemperature,minHumidity,maxHumidity] = values.map(Number);
  if (minTemperature >= maxTemperature) {
    showEnclosureValidation('Minimum temperature must be lower than maximum temperature.',
      ['enclosureMinTemperature', 'enclosureMaxTemperature'], 'enclosureTemperatureError');
    return;
  }
  if (minHumidity < 0 || maxHumidity > 100 || minHumidity > 100 || maxHumidity < 0) {
    showEnclosureValidation('Humidity values must be between 0% and 100%.',
      ['enclosureMinHumidity', 'enclosureMaxHumidity'], 'enclosureHumidityError');
    return;
  }
  if (minHumidity >= maxHumidity) {
    showEnclosureValidation('Minimum humidity must be lower than maximum humidity.',
      ['enclosureMinHumidity', 'enclosureMaxHumidity'], 'enclosureHumidityError');
    return;
  }
  const body = {name,minTemperature,maxTemperature,minHumidity,maxHumidity,
    enclosureType: $('#enclosureNewType').value || null,
    notes: $('#enclosureNewNotes').value.trim() || null,
    monitoringMode: enclosureSelectedMode('enclosureCreateMonitoringMode')};
  enclosureCreateSaving = true;
  $('#enclosureCreateSave').disabled = true; status.hidden = false; status.textContent = 'Saving enclosure…';
  try {
    const response = await fetch('/api/enclosures', {method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body)});
    const payload = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(payload.error || `Unable to create enclosure (HTTP ${response.status}).`);
    enclosureFormInitial = enclosureFormSnapshot();
    closeEnclosureCreate();
    $('#enclosuresSearch').value = '';
    toast(`${payload.name || name} created successfully.`);
    await loadEnclosuresCollection();
  } catch (error) {
    console.error('Enclosure creation failed:',error);
    status.hidden = false; status.textContent = error.message || 'Unable to create enclosure. Please try again.';
    status.classList.add('is-error');
  } finally {
    enclosureCreateSaving = false; $('#enclosureCreateSave').disabled = false;
  }
});
