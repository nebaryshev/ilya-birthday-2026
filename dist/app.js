const defaultMemories = [
  { title: 'Самое первое приключение', caption: 'Пусть впереди будет ещё тысяча таких моментов', colors: '#d27a2d, #712716' },
  { title: 'День, который хочется повторить', caption: 'Один день — и столько тёплых воспоминаний', colors: '#e4a43c, #8f3d1e' },
  { title: 'Вот это был смех!', caption: 'Сохраняй эту улыбку на долгие-долгие годы', colors: '#a54b25, #3d5935' },
  { title: 'Маленькая большая победа', caption: 'Каждая победа начинается с первого шага', colors: '#c86b2b, #70251b' },
  { title: 'Навстречу новому', caption: 'Самое интересное всегда ждёт впереди', colors: '#b28635, #315b3b' },
  { title: 'Когда всё получилось', caption: 'Ты можешь гораздо больше, чем тебе кажется', colors: '#9f3a23, #d48830' },
  { title: 'Вместе — лучше всего', caption: 'Пусть рядом всегда будут любимые люди', colors: '#b85a28, #4d3824' },
  { title: 'Ещё один яркий день', caption: 'Такие дни хочется бережно хранить', colors: '#d69a37, #6f2a1b' },
  { title: 'Десять лет — только начало', caption: 'Впереди — целый мир удивительных открытий', colors: '#9b3a21, #284932' },
  { title: 'Сегодня тебе десять', caption: 'Это воспоминание создаётся прямо сейчас', colors: '#d79231, #6d2419' },
];

const app = document.querySelector('#app');
const header = document.querySelector('#site-header');
const leaves = document.querySelector('.leaves');
const modalRoot = document.querySelector('#modal-root');
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const MAX_PHOTO_SIZE = 20 * 1024 * 1024;
const DB_NAME = 'ilya-birthday-memories';
const DB_STORE = 'videos';
const CLOUD = window.ILYA_UPLOAD_CONFIG || null;
let objectUrls = [];
let previousRouteWasVideo = false;
let cloudManifest = null;

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

function pad(number) { return String(number).padStart(2, '0'); }

function getMemories() {
  if (cloudManifest?.memories) {
    return defaultMemories.map((memory, index) => ({ ...memory, ...(cloudManifest.memories[index] || {}) }));
  }
  const saved = JSON.parse(localStorage.getItem('ilya-memory-copy') || '{}');
  return defaultMemories.map((memory, index) => ({ ...memory, ...(saved[index + 1] || {}) }));
}

function cloudObjectUrl(key, revision = '') {
  if (!CLOUD) return '';
  const suffix = revision ? `?v=${encodeURIComponent(revision)}` : `?v=${Date.now()}`;
  return `${CLOUD.publicBase}/${key}${suffix}`;
}

async function loadCloudManifest() {
  if (!CLOUD) return;
  try {
    const response = await fetch(cloudObjectUrl('data/memories.json'), { cache: 'no-store' });
    if (response.ok) cloudManifest = await response.json();
  } catch {
    // The manifest does not exist until the first edit; defaults remain available.
  }
}

function saveMemoryCopy(index, title, caption) {
  const saved = JSON.parse(localStorage.getItem('ilya-memory-copy') || '{}');
  saved[index + 1] = { title, caption };
  localStorage.setItem('ilya-memory-copy', JSON.stringify(saved));
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getLocalVideo(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(DB_STORE).objectStore(DB_STORE).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function saveLocalVideo(id, file) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put(file, id);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

async function getLocalPhoto(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(DB_STORE).objectStore(DB_STORE).get(`photo-${id}`);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function saveLocalPhoto(id, file) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put(file, `photo-${id}`);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

function makeObjectUrl(blob) {
  const url = URL.createObjectURL(blob);
  objectUrls.push(url);
  return url;
}

function clearObjectUrls() {
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls = [];
}

function renderHome() {
  clearObjectUrls();
  document.body.classList.remove('video-view');
  header.innerHTML = '';
  header.classList.add('is-empty');
  const memories = getMemories();
  document.title = 'Илья, с юбилеем!';
  app.innerHTML = `
    <section class="hero">
      <div class="hero-content">
        <p class="eyebrow">8 октября · твой особенный день</p>
        <h1>Илья,<br>с юбилеем!</h1>
        <span class="hero-age">Тебе уже 10!</span>
        <p class="hero-copy">Десять фотографий. Десять тёплых историй. И целая жизнь удивительных приключений впереди</p>
        <a class="primary-button" href="#stories">Смотреть воспоминания ↓</a>
      </div>
    </section>
    <section class="gallery-section" id="stories">
      <div class="section-head">
        <p class="eyebrow" style="color:#9c3c1f">Маленькая машина времени</p>
        <h2>Десять моментов,<br>которые всегда рядом</h2>
      </div>
      <div class="gallery">
        ${memories.map((memory, index) => `
          <a class="memory-card" data-memory-card="${index + 1}" href="#/video/${index + 1}" style="--card-bg:linear-gradient(145deg, ${memory.colors})">
            <img class="card-photo" data-card-photo="${index + 1}" alt="" hidden>
            <video class="card-video" data-card-video="${index + 1}" muted playsinline preload="${CLOUD ? 'none' : 'auto'}" tabindex="-1" aria-hidden="true">
              ${CLOUD ? '' : `<source src="./videos/video-${pad(index + 1)}.mp4" type="video/mp4">`}
            </video>
            <div class="card-body">
              <span class="card-number">${pad(index + 1)}</span>
              <span class="card-kicker">История №${index + 1}</span>
              <h3>${escapeHtml(memory.title)}</h3>
              <p>Открыть видео →</p>
            </div>
          </a>`).join('')}
      </div>
    </section>`;

  app.querySelectorAll('[data-memory-card]').forEach((card) => {
    card.addEventListener('click', () => sessionStorage.setItem('memory-gallery-scroll', String(window.scrollY)));
  });
  app.querySelectorAll('.card-video').forEach(showFirstVideoFrame);
  hydrateCardMedia();
}

function showFirstVideoFrame(video) {
  const seekToFirstFrame = () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    video.currentTime = Math.min(0.12, video.duration / 10);
  };
  if (video.readyState >= 1) seekToFirstFrame();
  else video.addEventListener('loadedmetadata', seekToFirstFrame, { once: true });
}

async function hydrateCardMedia() {
  for (let id = 1; id <= 10; id += 1) {
    if (CLOUD) {
      const memory = getMemories()[id - 1];
      const image = app.querySelector(`[data-card-photo="${id}"]`);
      const video = app.querySelector(`[data-card-video="${id}"]`);
      const loadVideoPreview = () => {
        if (!video) return;
        video.hidden = false;
        video.preload = 'auto';
        video.src = cloudObjectUrl(`videos/${pad(id)}`, memory.videoRevision);
        video.load();
        showFirstVideoFrame(video);
      };
      if (memory.photoRevision && image) {
        image.addEventListener('load', () => {
          image.hidden = false;
          if (video) video.hidden = true;
        }, { once: true });
        image.addEventListener('error', () => {
          image.hidden = true;
          loadVideoPreview();
        }, { once: true });
        image.src = cloudObjectUrl(`covers/${pad(id)}`, memory.photoRevision);
      } else {
        loadVideoPreview();
      }
      continue;
    }
    const [photo, videoBlob] = await Promise.all([
      getLocalPhoto(id).catch(() => null),
      getLocalVideo(id).catch(() => null),
    ]);
    const image = app.querySelector(`[data-card-photo="${id}"]`);
    const video = app.querySelector(`[data-card-video="${id}"]`);
    if (photo && image) {
      image.src = makeObjectUrl(photo);
      image.hidden = false;
      if (video) video.hidden = true;
    } else if (videoBlob && video) {
      video.src = makeObjectUrl(videoBlob);
      video.load();
      showFirstVideoFrame(video);
    }
  }
}

async function renderVideo(index) {
  clearObjectUrls();
  const memories = getMemories();
  const memory = memories[index];
  if (!memory) return renderNotFound();
  const id = index + 1;
  const localVideo = CLOUD ? null : await getLocalVideo(id).catch(() => null);
  const source = CLOUD
    ? cloudObjectUrl(`videos/${pad(id)}`, memory.videoRevision)
    : (localVideo ? makeObjectUrl(localVideo) : `./videos/video-${pad(id)}.mp4`);
  document.body.classList.add('video-view');
  header.classList.remove('is-empty');
  header.innerHTML = `<button class="header-back" type="button" id="header-back">← Назад</button>`;
  header.querySelector('#header-back').addEventListener('click', returnToGallery);
  document.title = memory.title;
  app.innerHTML = `
    <section class="video-page">
      <div class="video-shell">
        <div class="video-title-row">
          <h1 id="memory-title">${escapeHtml(memory.title)}</h1>
          <div class="title-actions">
            <span class="video-count">${pad(id)} / 10</span>
            <button class="edit-button" type="button" id="edit-memory" aria-label="Редактировать воспоминание" title="Редактировать">✎</button>
          </div>
        </div>
        <div class="player-stage">
          ${arrowButton('previous', id - 1, id === 1)}
          <div class="player-wrap">
            <video id="memory-video" controls playsinline preload="auto" src="${source}">Ваш браузер не поддерживает воспроизведение видео.</video>
          </div>
          ${arrowButton('next', id + 1, id === 10)}
        </div>
        <p class="video-caption" id="memory-caption">${escapeHtml(memory.caption)}</p>
      </div>
    </section>`;

  app.querySelector('#edit-memory').addEventListener('click', () => requestEditAccess(index));
  hydratePlayerPreview(id, memory);
  scrollPageToTop();
}

async function hydratePlayerPreview(id, memory) {
  const video = app.querySelector('#memory-video');
  if (!video) return;
  showFirstVideoFrame(video);
  if (CLOUD) {
    const cover = cloudObjectUrl(`covers/${pad(id)}`, memory.photoRevision);
    const probe = new Image();
    probe.addEventListener('load', () => { video.poster = cover; }, { once: true });
    probe.src = cover;
    return;
  }
  const photo = await getLocalPhoto(id).catch(() => null);
  if (photo && video.isConnected) video.poster = makeObjectUrl(photo);
}

function arrowButton(direction, target, disabled) {
  const symbol = direction === 'previous' ? '←' : '→';
  const label = direction === 'previous' ? 'Предыдущее воспоминание' : 'Следующее воспоминание';
  if (disabled) return `<button class="story-arrow story-arrow--${direction}" type="button" disabled aria-label="${label}">${symbol}</button>`;
  return `<a class="story-arrow story-arrow--${direction}" href="#/video/${target}" aria-label="${label}">${symbol}</a>`;
}

function returnToGallery() {
  previousRouteWasVideo = true;
  if (window.location.hash === '#/' || !window.location.hash) {
    renderHome();
    restoreGalleryScroll();
  } else {
    window.location.hash = '#/';
  }
}

function restoreGalleryScroll() {
  const savedScroll = Number(sessionStorage.getItem('memory-gallery-scroll') || 0);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, savedScroll);
    requestAnimationFrame(() => { document.documentElement.style.scrollBehavior = ''; });
  }));
}

function scrollPageToTop() {
  requestAnimationFrame(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    requestAnimationFrame(() => { document.documentElement.style.scrollBehavior = ''; });
  });
}

function requestEditAccess(index) {
  openDateModal({
    title: 'Чтобы редактировать воспоминание',
    prompt: 'Введите день рождения мамы Ильи',
    expected: ['09', '09', '1988'],
    onSuccess: () => enterEditMode(index),
  });
}

function openDateModal({ title, prompt, expected, onSuccess }) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop" role="presentation">
      <section class="date-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button class="modal-close" type="button" aria-label="Закрыть">×</button>
        <span class="modal-leaf" aria-hidden="true">🍁</span>
        <h2 id="modal-title">${title}</h2>
        <p>${prompt}</p>
        <form id="date-form" novalidate>
          <div class="date-inputs" aria-label="Дата рождения">
            <input inputmode="numeric" maxlength="2" aria-label="День" placeholder="ДД" autocomplete="off">
            <span>⋅</span>
            <input inputmode="numeric" maxlength="2" aria-label="Месяц" placeholder="ММ" autocomplete="off">
            <span>⋅</span>
            <input inputmode="numeric" maxlength="4" aria-label="Год" placeholder="ГГГГ" autocomplete="off">
          </div>
          <button class="secondary-button modal-submit" type="submit">Подтвердить</button>
        </form>
      </section>
    </div>`;
  const backdrop = modalRoot.querySelector('.modal-backdrop');
  const form = modalRoot.querySelector('#date-form');
  const inputs = [...form.querySelectorAll('input')];
  const submitButton = form.querySelector('.modal-submit');
  let finished = false;
  const close = () => { modalRoot.innerHTML = ''; };
  const showDateError = (clearInputs) => {
    if (clearInputs) inputs.forEach((input) => { input.value = ''; });
    submitButton.classList.remove('is-shaking');
    void submitButton.offsetWidth;
    submitButton.classList.add('is-shaking');
    (inputs.find((input) => input.value.length !== input.maxLength) || inputs[0]).focus();
  };
  const checkDate = (force = false) => {
    if (finished) return;
    const isComplete = inputs.every((input) => input.value.length === input.maxLength);
    if (!isComplete) {
      if (force) showDateError(false);
      return;
    }
    const values = inputs.map((input) => input.value);
    if (values.join('-') === expected.join('-')) {
      finished = true;
      inputs.forEach((input) => { input.disabled = true; });
      form.classList.add('is-success');
      submitButton.disabled = true;
      submitButton.textContent = 'Верно!';
      submitButton.classList.add('is-success');
      window.setTimeout(() => {
        close();
        onSuccess();
      }, 850);
      return;
    }
    showDateError(true);
  };
  modalRoot.querySelector('.modal-close').addEventListener('click', close);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  inputs.forEach((input, index) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '');
      if (input.value.length === input.maxLength && inputs[index + 1]) inputs[index + 1].focus();
      checkDate(false);
    });
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    checkDate(true);
  });
  inputs[0].focus();
}

function enterEditMode(index) {
  const memory = getMemories()[index];
  const title = app.querySelector('#memory-title');
  const caption = app.querySelector('#memory-caption');
  const editButton = app.querySelector('#edit-memory');
  const playerWrap = app.querySelector('.player-wrap');
  const playerStage = app.querySelector('.player-stage');
  title.innerHTML = `<input class="edit-title-input" id="edit-title-input" maxlength="80" value="${escapeAttribute(memory.title)}" aria-label="Заголовок воспоминания">`;
  caption.innerHTML = `<textarea class="edit-caption-input" id="edit-caption-input" maxlength="180" aria-label="Подпись под видео">${escapeHtml(memory.caption)}</textarea>`;
  playerWrap.insertAdjacentHTML('beforeend', `
    <label class="replace-video-button" for="replace-video-input">Заменить видео · до 100 МБ</label>
    <input class="visually-hidden" id="replace-video-input" type="file" accept="video/mp4,video/*">`);
  playerStage.insertAdjacentHTML('afterend', `
    <label class="photo-dropzone" id="photo-dropzone" for="card-photo-input">
      <span class="photo-dropzone-icon">＋</span>
      <strong>Добавить фото для карточки</strong>
      <span>Нажмите, чтобы выбрать изображение</span>
      <img id="photo-preview" alt="Предпросмотр фотографии" hidden>
    </label>
    <input class="visually-hidden" id="card-photo-input" type="file" accept="image/jpeg,image/png,image/webp,image/*">`);
  editButton.textContent = '✓';
  editButton.classList.add('is-saving');
  editButton.setAttribute('aria-label', 'Сохранить изменения');
  editButton.replaceWith(editButton.cloneNode(true));
  const saveButton = app.querySelector('#edit-memory');
  const videoInput = app.querySelector('#replace-video-input');
  const photoInput = app.querySelector('#card-photo-input');
  videoInput.addEventListener('change', () => {
    const file = videoInput.files[0];
    if (!file || !validateVideoFile(file)) {
      videoInput.value = '';
      return;
    }
    const previewVideo = app.querySelector('#memory-video');
    previewVideo.src = makeObjectUrl(file);
    previewVideo.load();
    showToast('Предпросмотр видео готов — нажмите ✓ для сохранения');
  });
  photoInput.addEventListener('change', () => {
    const file = photoInput.files[0];
    if (!file || !validatePhotoFile(file)) {
      photoInput.value = '';
      return;
    }
    const preview = app.querySelector('#photo-preview');
    preview.src = makeObjectUrl(file);
    preview.hidden = false;
    app.querySelector('#photo-dropzone').classList.add('has-preview');
  });
  saveButton.addEventListener('click', async () => {
    const newTitle = app.querySelector('#edit-title-input').value.trim();
    const newCaption = app.querySelector('#edit-caption-input').value.trim();
    const file = videoInput.files[0];
    const photo = photoInput.files[0];
    if (!newTitle) return showToast('Заголовок не может быть пустым');
    if (file && !validateVideoFile(file)) return;
    if (photo && !validatePhotoFile(photo)) return;
    const progress = (file || photo || CLOUD) ? showUploadProgress() : null;
    try {
      if (CLOUD) {
        await saveCloudMemory(index, newTitle, newCaption, file, photo, (value) => progress?.set(value));
      } else {
        await Promise.all([
          file ? saveLocalVideo(index + 1, file) : Promise.resolve(),
          photo ? saveLocalPhoto(index + 1, photo) : Promise.resolve(),
        ]);
        saveMemoryCopy(index, newTitle, newCaption);
      }
      if (progress) {
        progress.set(100);
        await new Promise((resolve) => setTimeout(resolve, 300));
        progress.close();
      }
      await renderVideo(index);
      showToast('Изменения сохранены');
    } catch {
      progress?.close();
      showToast('Не удалось сохранить изменения. Попробуйте ещё раз');
    }
  });
  app.querySelector('#edit-title-input').focus();
}

function uploadCloudObject(key, file, onProgress) {
  const upload = CLOUD?.uploads?.[key];
  if (!upload) return Promise.reject(new Error('Разрешение на загрузку отсутствует или истекло'));
  return new Promise((resolve, reject) => {
    const form = new FormData();
    Object.entries(upload.fields).forEach(([name, value]) => form.append(name, value));
    form.append('Content-Type', file.type);
    form.append('file', file);
    const request = new XMLHttpRequest();
    request.open('POST', upload.url);
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    });
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`Object Storage returned ${request.status}`));
    });
    request.addEventListener('error', () => reject(new Error('Network upload failed')));
    request.send(form);
  });
}

async function saveCloudMemory(index, title, caption, video, photo, setProgress) {
  const id = index + 1;
  const memories = getMemories().map((memory) => ({ ...memory }));
  const uploads = [
    video && { key: `videos/${pad(id)}`, file: video },
    photo && { key: `covers/${pad(id)}`, file: photo },
  ].filter(Boolean);
  const totalBytes = uploads.reduce((sum, item) => sum + item.file.size, 0) || 1;
  let completedBytes = 0;
  for (const item of uploads) {
    await uploadCloudObject(item.key, item.file, (part) => {
      setProgress(Math.round(((completedBytes + item.file.size * part) / totalBytes) * 90));
    });
    completedBytes += item.file.size;
  }
  const revision = Date.now();
  memories[index] = {
    ...memories[index],
    title,
    caption,
    ...(video ? { videoRevision: revision } : {}),
    ...(photo ? { photoRevision: revision } : {}),
  };
  const manifest = {
    version: 1,
    updatedAt: new Date().toISOString(),
    memories: memories.map(({ title: memoryTitle, caption: memoryCaption, videoRevision, photoRevision }) => ({
      title: memoryTitle,
      caption: memoryCaption,
      ...(videoRevision ? { videoRevision } : {}),
      ...(photoRevision ? { photoRevision } : {}),
    })),
  };
  const manifestFile = new File([JSON.stringify(manifest)], 'memories.json', { type: 'application/json' });
  setProgress(94);
  await uploadCloudObject('data/memories.json', manifestFile);
  cloudManifest = manifest;
}

function validatePhotoFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Выберите изображение');
    return false;
  }
  if (file.size > MAX_PHOTO_SIZE) {
    showToast('Фотография должна быть не больше 20 МБ');
    return false;
  }
  return true;
}

function showUploadProgress() {
  modalRoot.innerHTML = `
    <div class="modal-backdrop" role="presentation">
      <section class="upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-title">
        <span class="modal-leaf" aria-hidden="true">🍂</span>
        <h2 id="upload-title">Сохраняем воспоминание</h2>
        <p>Ещё немного — воспоминание почти готово</p>
        <div class="upload-progress" role="progressbar" aria-label="Загрузка видео" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <span></span>
        </div>
        <strong class="upload-percent">0%</strong>
      </section>
    </div>`;
  const bar = modalRoot.querySelector('.upload-progress');
  const fill = bar.querySelector('span');
  const percent = modalRoot.querySelector('.upload-percent');
  return {
    set(value) {
      fill.style.width = `${value}%`;
      percent.textContent = `${value}%`;
      bar.setAttribute('aria-valuenow', String(value));
    },
    close() { modalRoot.innerHTML = ''; },
  };
}

function validateVideoFile(file) {
  if (!file.type.startsWith('video/')) {
    showToast('Выберите видеофайл');
    return false;
  }
  if (file.size > MAX_VIDEO_SIZE) {
    showToast('Видео должно быть не больше 100 МБ');
    return false;
  }
  return true;
}

function showToast(message) {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  setTimeout(() => toast.remove(), 3200);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function escapeAttribute(value) { return escapeHtml(value); }

function renderNotFound() {
  document.body.classList.add('video-view');
  header.innerHTML = `<button class="header-back" type="button" id="header-back">← Назад</button>`;
  header.querySelector('#header-back').addEventListener('click', returnToGallery);
  app.innerHTML = `<section class="video-page"><div class="video-shell"><h1>Страница не найдена</h1></div></section>`;
  scrollPageToTop();
}

function route() {
  const match = window.location.hash.match(/^#\/video\/(\d+)$/);
  if (match) {
    previousRouteWasVideo = true;
    renderVideo(Number(match[1]) - 1);
  } else {
    renderHome();
    if (previousRouteWasVideo) restoreGalleryScroll();
    previousRouteWasVideo = false;
  }
  app.focus({ preventScroll: true });
}

function createLeaves() {
  const glyphs = ['🍁', '🍂', '◆'];
  const colors = ['#d46325', '#f0a52b', '#8e321d'];
  for (let i = 0; i < 13; i += 1) {
    const leaf = document.createElement('span');
    leaf.className = 'leaf';
    leaf.textContent = glyphs[i % glyphs.length];
    leaf.style.setProperty('--left', `${(i * 19 + 7) % 100}%`);
    leaf.style.setProperty('--size', `${15 + (i % 4) * 5}px`);
    leaf.style.setProperty('--duration', `${11 + (i % 5) * 2.3}s`);
    leaf.style.setProperty('--delay', `${-i * 1.8}s`);
    leaf.style.setProperty('--color', colors[i % colors.length]);
    leaves.appendChild(leaf);
  }
}

window.addEventListener('hashchange', route);
createLeaves();
loadCloudManifest().finally(route);
