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
  const pages = {dashboard:['Dashboard','Overview of your pets, enclosures, and recent activity.'],pets:['Pets','Your animals and their care records.'],enclosures:['Enclosures','Habitats and environmental monitoring.'],alerts:['Alerts','Environmental conditions requiring attention.']};
  if (!pages[page]) return;
  currentPage = page;
  $('#main').classList.toggle('pets-active', page === 'pets');
  $('#dashboardContent').hidden = page !== 'dashboard';
  $('#petsPage').hidden = page !== 'pets';
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
$('#addPet').addEventListener('click', () => toast('Add Pet form is a planned next step. No record was created.'));
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
    const details = elem('button', 'collection-details-button', 'View Details · Stage 3');
    details.type = 'button';
    details.disabled = true;
    details.title = 'Pet details will be available in Stage 3';
    footer.append(details);
    content.append(footer);
    card.append(imageBox, content);
    fragment.append(card);
  });
  host.append(fragment);
}

$('#petsPageSearch').addEventListener('input', () => {
  $('#search').value = $('#petsPageSearch').value;
  renderPetsCollection();
});
$('#petsPageAddPet').addEventListener('click', () => toast('Add Pet arrives in Stage 2. No record was created.'));
