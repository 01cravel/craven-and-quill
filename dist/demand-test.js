(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const labels = { 1: 'Their name', 2: 'Reading level', 3: 'Story style', 4: 'Their photo', 5: 'Your email' };
  let photoUrl = '';

  function track(event, details = {}) {
    const key = 'cq_demand_test_events';
    const events = JSON.parse(localStorage.getItem(key) || '[]');
    events.push({ event, details, at: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(events.slice(-150)));
  }

  function value(name) {
    return $(`input[name="${name}"]:checked`)?.value || '';
  }

  function show(screen) {
    $$('.question-screen').forEach((panel) => {
      const isActive = panel.dataset.screen === String(screen);
      panel.hidden = !isActive;
      panel.classList.toggle('active', isActive);
    });

    const numeric = Number(screen);
    const progress = !Number.isNaN(numeric) ? numeric : 5;
    const finished = String(screen) === 'queued';
    $('#progress-label').textContent = finished ? 'Complete' : `Question ${Math.min(progress, 5)} of 5`;
    $('#progress-name').textContent = finished ? 'Cover requested' : labels[progress];
    $$('.progress-steps span').forEach((bar, index) => bar.classList.toggle('active', index < progress));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    track('screen_viewed', { screen: String(screen) });
  }

  function chooseAndContinue(selector, next) {
    $$(selector).forEach((input) => input.addEventListener('change', () => {
      track('answer_selected', { question: input.name, answer: input.value });
      setTimeout(() => show(next), 150);
    }));
  }

  $('#start-preview').addEventListener('click', () => {
    $('#progress').hidden = false;
    track('journey_started');
    show(1);
    setTimeout(() => $('#person-name').focus(), 320);
  });

  $('[data-next="2"]').addEventListener('click', () => {
    const name = $('#person-name').value.trim();
    if (!name) {
      $('#name-error').textContent = 'Add their first name to continue.';
      $('#person-name').focus();
      return;
    }
    $('#name-error').textContent = '';
    track('answer_selected', { question: 'name' });
    show(2);
  });

  chooseAndContinue('input[name="age"]', 3);
  chooseAndContinue('input[name="story"]', 4);

  $('#person-photo').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      $('#photo-error').textContent = 'Choose a JPG, PNG or WEBP under 8 MB.';
      event.target.value = '';
      return;
    }
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = URL.createObjectURL(file);
    $('#photo-image').src = photoUrl;
    $('#upload-empty').hidden = true;
    $('#photo-preview').hidden = false;
    $('#photo-error').textContent = '';
    track('photo_added', { type: file.type, sizeBand: file.size < 2e6 ? 'under_2mb' : 'over_2mb' });
  });

  $('[data-next="5"]').addEventListener('click', () => {
    if (!$('#person-photo').files?.[0]) {
      $('#photo-error').textContent = 'Choose a clear photo to continue.';
      $('#person-photo').focus();
      return;
    }
    $('#photo-error').textContent = '';
    show(5);
  });

  function requestCover() {
    if (!$('#email').checkValidity()) {
      $('#email-error').textContent = 'Add a valid email address.';
      $('#email').focus();
      return false;
    }
    $('#email-error').textContent = '';
    const name = $('#person-name').value.trim();
    const email = $('#email').value.trim();
    $('#queued-name').textContent = `${name}’s`;
    $('#queued-email').textContent = email;
    track('generation_requested', { age: value('age'), story: value('story') });
    show('queued');
    return true;
  }

  $('#request-cover').addEventListener('click', requestCover);

  $$('[data-back]').forEach((button) => button.addEventListener('click', () => show(button.dataset.back)));
  $('#start-again').addEventListener('click', () => location.reload());

  const modelContext = document.modelContext;
  if (modelContext?.registerTool) {
    const lifecycle = new AbortController();
    try {
      Promise.resolve(modelContext.registerTool({
        name: 'request_personalised_cover',
        title: 'Request personalised cover',
        description: 'Request a free personalised cover using the details already entered. The cover will be sent by email when ready.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute() {
          if (!$('[data-screen="5"].active')) throw new Error('Complete the first four questions before requesting the cover.');
          if (!requestCover()) throw new Error($('#email-error').textContent);
          return { status: 'requested', delivery: 'email', paymentTaken: false };
        }
      }, { signal: lifecycle.signal })).catch(() => {});
    } catch (_) {}
  }

  track('demand_test_opened');
})();
