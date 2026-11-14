// Environmental readings, alerts and recent feedings below remain demo examples.
// Dashboard pet cards and pet/enclosure counts use the real APIs.
const assets = './public/assets/illustrations/animals/';
const enclosures = [
  { name: 'Enclosure 1', pet: 'Nox', temperature: 28.4, humidity: 45, status: 'Normal', time: '14 Nov, 14:32' },
  { name: 'Enclosure 2', pet: 'Kukulcán', temperature: 32.7, humidity: 58, status: 'Abnormal', time: '14 Nov, 14:30' },
  { name: 'Enclosure 3', pet: 'Unassigned', temperature: 26.1, humidity: 62, status: 'Normal', time: '14 Nov, 14:28' }
];
const alerts = [
  { title: 'Enclosure 2: Temperature too high', details: '32.7 °C · configured maximum 30.0 °C', time: '14 Nov · 14:30' },
  { title: 'Enclosure 2: Humidity below minimum', details: '58% · configured minimum 60%', time: '14 Nov · 14:30' }
];
const feedings = []; // Real feedings load asynchronously from the Data Management API.
const $ = (selector) => document.querySelector(selector);
function elem(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function renderReadings() {
  const body = $('#readingsRows'); body.replaceChildren();
  for (const row of enclosures) {
    const tr = elem('tr');
    const name = elem('td'); name.append(elem('strong', null, row.name), elem('small', null, row.pet));
    const temp = elem('td', 'value-cell', `${row.temperature.toFixed(1)} °C`);
    const humidity = elem('td', 'value-cell', `${row.humidity}%`);
    const status = elem('td'); status.append(elem('span', `status ${row.status.toLowerCase()}`, row.status === 'Normal' ? '✓ Normal' : '⚠ Abnormal'));
    tr.append(name, temp, humidity, status, elem('td', 'muted-cell', row.time)); body.append(tr);
  }
}
function renderAlerts() {
  const host = $('#alertItems'); host.replaceChildren();
  alerts.forEach((alert) => { const row = elem('div','alert-item'); row.append(elem('span','alert-icon','!')); const text = elem('div'); text.append(elem('strong',null,alert.title),elem('p',null,alert.details),elem('small',null,alert.time)); row.append(text); host.append(row); });
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
  dashboardPetsStatus = 'loading';
  dashboardEnclosuresStatus = 'loading';
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
  $('#main').classList.toggle('pets-active', page === 'pets');
  $('#main').classList.toggle('feeding-active', page === 'feeding');
  $('#dashboardContent').hidden = page !== 'dashboard';
  $('#petsPage').hidden = page !== 'pets';
  $('#feedingPage').hidden = page !== 'feeding';
  $('#addPetPage').hidden = true;
  $('#petDetailsPage').hidden = true;
  ++petDetailsRequest;
  $('#otherPage').hidden = page === 'dashboard' || page === 'pets' || page === 'feeding';
  $('#dashboardDemoBanner').hidden = page !== 'dashboard';
  $('#pageEyebrow').textContent = page === 'pets' ? 'PET MANAGEMENT' : page === 'feeding' ? 'CARE MANAGEMENT' : 'YOUR HABITAT AT A GLANCE';
  $('#pageTitle').textContent = pages[page][0]; $('#pageDescription').textContent = pages[page][1]; $('#otherTitle').textContent = `${pages[page][0]} page coming next`;
  document.querySelectorAll('.nav-link').forEach((link) => { const active = link.dataset.page === page; link.classList.toggle('active', active); if (active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current'); });
  $('#sidebar').classList.remove('open'); $('#menuButton').setAttribute('aria-expanded','false');
  // Navigation is a new view: never carry scroll position from the previous page.
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  if (page === 'pets') { loadPetsCollection(); }
  if (page === 'feeding') { loadFeedingWorkspace(); }
  if (page === 'dashboard') { loadDashboardData(); }
}
$('#alertCount').textContent = alerts.length; // Demo only, explicitly labeled in UI.
renderReadings(); renderAlerts(); renderFeedings();
document.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.page)));
document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.go)));
$('#headerHome').addEventListener('click', () => navigate('dashboard'));
$('#bell').addEventListener('click', () => toast('Notifications will be available in a future stage.'));
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
    footer.append(elem('span', 'collection-details-button', 'View profile →'));
    content.append(footer);
    card.append(imageBox, content);
    // One full-card button is easier to discover and keyboard-accessible.
    const openCard = elem('button', 'collection-card-action');
    openCard.type = 'button';
    openCard.setAttribute('aria-label', `View profile for ${pet.name || 'unnamed pet'}`);
    openCard.addEventListener('click', () => openPetDetails(pet.id));
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
  $('#feedingPage').hidden = true;
  $('#pageEyebrow').textContent = 'PET MANAGEMENT';
  $('#pageTitle').textContent = 'Pet Details';
  $('#pageDescription').textContent = 'Your companion’s profile and feeding history.';
  $('#petDetailsContent').hidden = true;
  $('#petDetailsEdit').disabled = true;
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
$('#petDetailsClose').addEventListener('click', () => { if (petEditing) requestCancelPetEdit(); else navigate('pets'); });
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

// Initial dashboard load: live pet/enclosure summary, demo monitoring and feeding.
loadDashboardData();

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
 $('#feedingGroupDialogTitle').textContent=group?'Edit Feeding Group':'Create Feeding Group';$('#feedingGroupName').value=group?.name||'';
 renderGroupMembers(groupMembersDraft);feedingFeedback('#feedingGroupError','');groupInitial=JSON.stringify({name:$('#feedingGroupName').value,pet_ids:[...groupMembersDraft].sort((a,b)=>a-b)});$('#feedingGroupDialog').showModal();}
function groupIsDirty(){return JSON.stringify({name:$('#feedingGroupName').value,pet_ids:[...groupMembersDraft].sort((a,b)=>a-b)})!==groupInitial;}
function cancelGroupForm(){if(groupIsDirty())confirmFeeding('Discard your unsaved group changes?',()=>$('#feedingGroupDialog').close());else $('#feedingGroupDialog').close();}
$('#feedingCreateGroup').addEventListener('click',()=>openGroupForm());$('#feedingGroupCancel').addEventListener('click',cancelGroupForm);
$('#feedingGroupDialog').addEventListener('cancel',e=>{if(groupIsDirty()){e.preventDefault();cancelGroupForm();}});
$('#groupSelectAll').addEventListener('click',()=>{groupMembersDraft=new Set(feedState.pets.map(p=>p.id));renderGroupMembers(groupMembersDraft);});
$('#groupClearAll').addEventListener('click',()=>{groupMembersDraft.clear();renderGroupMembers(groupMembersDraft);});
$('#feedingGroupForm').addEventListener('submit',async e=>{
 e.preventDefault();if(feedState.busy)return;const name=$('#feedingGroupName').value.trim();if(!name){feedingFeedback('#feedingGroupError','Enter a group name.',true);return;}
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
  $('#dashboardDemoBanner').replaceChildren(elem('span','demo-tag','LIVE + PREVIEW'),document.createTextNode(' Pets, enclosures and feeding are live · Readings and alerts are demo examples'));
 }catch(err){console.warn('Recent feedings unavailable',err);$('#feedingRows').replaceChildren(elem('p','feeding-hint','Recent feeding records are unavailable. Check the Data Management Service.'));}
}
loadRecentFeedings();
