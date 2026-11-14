// DESIGN PREVIEW ONLY. These example records are deliberately separate from API calls.
// Later: replace this module's demo data with a data-access layer for ports 3001/3002/3004.
const assets = './public/assets/illustrations/animals/';
const pets = [
  { id: 1, name: 'Nox', species: 'Leopard Gecko', asset: 'leopard-gecko.webp', enclosure: 'Enclosure 1' },
  { id: 2, name: 'Kukulcán', species: 'Ball Python', asset: 'ball-python.webp', enclosure: 'Enclosure 2' },
  { id: 3, name: 'Vesper', species: 'Tarantula', asset: 'tarantula.webp', enclosure: 'Unassigned' },
  { id: 4, name: 'Atlas', species: 'Scorpion', asset: 'scorpion.webp', enclosure: 'Unassigned' }
];
const enclosures = [
  { name: 'Enclosure 1', pet: 'Nox', temperature: 28.4, humidity: 45, status: 'Normal', time: '14 Nov, 14:32' },
  { name: 'Enclosure 2', pet: 'Kukulcán', temperature: 32.7, humidity: 58, status: 'Abnormal', time: '14 Nov, 14:30' },
  { name: 'Enclosure 3', pet: 'Unassigned', temperature: 26.1, humidity: 62, status: 'Normal', time: '14 Nov, 14:28' }
];
const alerts = [
  { title: 'Enclosure 2: Temperature too high', details: '32.7 °C · configured maximum 30.0 °C', time: '14 Nov · 14:30' },
  { title: 'Enclosure 2: Humidity below minimum', details: '58% · configured minimum 60%', time: '14 Nov · 14:30' }
];
const feedings = [
  { pet: 'Nox', food: '2 × Cricket', time: '14 Nov · 09:00' },
  { pet: 'Kukulcán', food: '1 × Small rat', time: '13 Nov · 20:00' },
  { pet: 'Vesper', food: '1 × Cricket', time: '12 Nov · 18:00' }
];
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
function renderPets(search = '') {
  const host = $('#petsGrid'); host.replaceChildren();
  const matches = pets.filter((pet) => `${pet.name} ${pet.species} ${pet.enclosure}`.toLowerCase().includes(search.toLowerCase()));
  matches.forEach((pet) => { const card = elem('article','pet-card'); const imageBox = elem('div', `pet-image pet-image--${pet.asset.replace('.webp', '')}`); const image = elem('img'); image.src = `${assets}${pet.asset}`; image.alt = `Illustration of ${pet.species}`; imageBox.append(image); const info = elem('div','pet-info'); info.append(elem('strong',null,pet.name),elem('span',null,pet.species),elem('small',null,`⌂  ${pet.enclosure}`)); card.append(imageBox,info); host.append(card); });
  $('#noPets').hidden = matches.length !== 0;
}
function renderFeedings() {
  const host = $('#feedingRows'); host.replaceChildren();
  feedings.forEach(({pet, food, time}) => {const row=elem('div','feeding-item'); const left=elem('div'); left.append(elem('strong',null,pet),elem('small',null,time)); row.append(left,elem('span','feeding-food',food)); host.append(row);});
}
let toastTimeout;
function toast(message) { const t = $('#toast'); t.textContent = message; t.hidden = false; clearTimeout(toastTimeout); toastTimeout = setTimeout(() => t.hidden = true, 4500); }
function navigate(page) {
  if (petSaving) return;
  if (petEditing && !petSaving) {
    if (isPetEditDirty() && !window.confirm('Discard unsaved changes?')) return;
    stopPetEdit();
  }
  const pages = {dashboard:['Dashboard','Overview of your pets, enclosures, and recent activity.'],pets:['Pets','Your animals and their care records.'],enclosures:['Enclosures','Habitats and environmental monitoring.'],alerts:['Alerts','Environmental conditions requiring attention.']};
  if (!pages[page]) return;
  ++editStartRequest;
  currentPage = page;
  $('#main').classList.toggle('pets-active', page === 'pets');
  $('#dashboardContent').hidden = page !== 'dashboard';
  $('#petsPage').hidden = page !== 'pets';
  $('#addPetPage').hidden = true;
  $('#petDetailsPage').hidden = true;
  ++petDetailsRequest;
  $('#otherPage').hidden = page === 'dashboard' || page === 'pets';
  $('#dashboardDemoBanner').hidden = page !== 'dashboard';
  $('#pageEyebrow').textContent = page === 'pets' ? 'PET MANAGEMENT' : 'YOUR HABITAT AT A GLANCE';
  $('#pageTitle').textContent = pages[page][0]; $('#pageDescription').textContent = pages[page][1]; $('#otherTitle').textContent = `${pages[page][0]} page coming next`;
  document.querySelectorAll('.nav-link').forEach((link) => { const active = link.dataset.page === page; link.classList.toggle('active', active); if (active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current'); });
  $('#sidebar').classList.remove('open'); $('#menuButton').setAttribute('aria-expanded','false');
  if (page === 'pets') { loadPetsCollection(); }
  if (page === 'dashboard') $('#search').focus();
}
$('#petCount').textContent = pets.length;
$('#enclosureCount').textContent = enclosures.length;
$('#alertCount').textContent = alerts.length;
renderReadings(); renderAlerts(); renderPets(); renderFeedings();
document.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.page)));
document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.go)));
$('#search').addEventListener('input', (event) => {
  if (currentPage === 'pets') {
    $('#petsPageSearch').value = event.target.value;
    renderPetsCollection();
  } else {
    navigate('dashboard');
    renderPets(event.target.value);
  }
});
$('#bell').addEventListener('click', () => navigate('alerts'));
$('#menuButton').addEventListener('click', () => {const open = $('#sidebar').classList.toggle('open'); $('#menuButton').setAttribute('aria-expanded',String(open));});
$('#addPet').addEventListener('click', openAddPetForm);
$('#feedingHistory').addEventListener('click', () => toast('Feeding history page is planned. This is sample data.'));


// Stage 1A: pets collection backed by existing services. Dashboard sample records remain unchanged.
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
  $('#search').value = $('#petsPageSearch').value;
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
    host.append(elem('p', 'pet-details-empty', 'No feeding records yet. Feeding management will be added in a later stage.'));
    return;
  }
  for (const feeding of rows) {
    const item = elem('article', 'pet-details-feeding');
    const left = elem('div');
    left.append(elem('strong', null, detailText(feeding.food, 'Feeding')),
      elem('small', null, detailText(feeding.feeding_date, 'Date not provided')));
    item.append(left);
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
  $('#dashboardContent').hidden = true;
  $('#dashboardDemoBanner').hidden = true;
  $('#petsPage').hidden = true;
  $('#addPetPage').hidden = true;
  $('#otherPage').hidden = true;
  $('#petDetailsPage').hidden = false;
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
  if (isPetEditDirty()) $('#petEditConfirm').showModal();
  else stopPetEdit();
}
$('#petDetailsEdit').addEventListener('click',beginPetEdit);
$('#petEditKeep').addEventListener('click',() => $('#petEditConfirm').close());
$('#petEditDiscard').addEventListener('click',() => { $('#petEditConfirm').close(); stopPetEdit(); });
$('#petEditConfirm').addEventListener('cancel', () => {});
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
