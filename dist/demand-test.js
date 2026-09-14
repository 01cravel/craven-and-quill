(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const stepNames = { 1: 'About them', 2: 'Photo and email', 3: 'Your free cover' };
  const stories = {
    funny: { title: 'and the Cake That Ran Away', art: 'assets/books-cartoon/luke/cover.jpg' },
    adventure: { title: 'and the Map Beneath the Moon', art: 'assets/books-cartoon/amara/cover.jpg' },
    classic: { title: 'and the Little Cloud', art: 'assets/books-cartoon/noah/cover.jpg' }
  };
  let photoUrl = '';

  function track(event, details = {}) {
    const key = 'cq_demand_test_events';
    const events = JSON.parse(localStorage.getItem(key) || '[]');
    events.push({ event, details, at: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(events.slice(-100)));
  }

  function showStep(step) {
    $$('.journey-step').forEach((panel) => {
      const active = panel.dataset.step === String(step);
      panel.hidden = !active;
      panel.classList.toggle('active', active);
    });

    const progressStep = step === 'making' ? 2 : step === 'success' ? 3 : Number(step);
    $('#step-count').textContent = step === 'success' ? 'Complete' : `Step ${progressStep} of 3`;
    $('#step-name').textContent = step === 'making' ? 'Creating the cover' : step === 'success' ? 'Book reserved' : stepNames[progressStep];
    $('#progress-bar').style.width = `${(progressStep / 3) * 100}%`;
    window.scrollTo({ top: window.innerWidth < 1100 ? $('.form-side').offsetTop : 0, behavior: 'smooth' });
    track('step_viewed', { step: String(step) });
  }

  function selectedValue(name) {
    return $(`input[name="${name}"]:checked`)?.value || '';
  }

  function updateCover() {
    const name = $('#person-name').value.trim() || 'Oliver';
    const story = stories[selectedValue('story')] || stories.classic;
    $('#cover-name').textContent = name;
    $('#cover-title').textContent = story.title;
    $('#cover-art').src = story.art;
  }

  $('[data-next="2"]').addEventListener('click', () => {
    const name = $('#person-name').value.trim();
    if (!name) {
      $('#step-one-error').textContent = 'Add their first name to continue.';
      $('#person-name').focus();
      return;
    }
    $('#step-one-error').textContent = '';
    updateCover();
    track('details_completed', { age: selectedValue('age'), story: selectedValue('story') });
    showStep(2);
  });

  $$('[data-back]').forEach((button) => button.addEventListener('click', () => showStep(button.dataset.back)));
  $$('input[name="story"]').forEach((input) => input.addEventListener('change', updateCover));
  $('#person-name').addEventListener('input', updateCover);

  $('#person-photo').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      $('#step-two-error').textContent = 'Choose a JPG, PNG or WEBP under 8 MB.';
      event.target.value = '';
      return;
    }
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = URL.createObjectURL(file);
    $('#upload-thumb').src = photoUrl;
    $('#upload-thumb').hidden = false;
    $('#receipt-photo').src = photoUrl;
    $('#upload-title').textContent = 'Photo added';
    $('#upload-detail').textContent = file.name;
    $('#upload-box').classList.add('has-photo');
    $('#step-two-error').textContent = '';
    track('photo_added', { type: file.type, sizeBand: file.size < 2e6 ? 'under_2mb' : 'over_2mb' });
  });

  $('#make-preview').addEventListener('click', () => {
    const file = $('#person-photo').files?.[0];
    const email = $('#email');
    if (!file) {
      $('#step-two-error').textContent = 'Add a clear photo to create the cover.';
      $('#person-photo').focus();
      return;
    }
    if (!email.checkValidity()) {
      $('#step-two-error').textContent = 'Add a valid email address for the preview.';
      email.focus();
      return;
    }
    if (!$('#permission').checked) {
      $('#step-two-error').textContent = 'Confirm you have permission to use the photo.';
      $('#permission').focus();
      return;
    }
    $('#step-two-error').textContent = '';
    track('preview_requested', { age: selectedValue('age'), story: selectedValue('story') });
    showStep('making');
    setTimeout(() => $('#draw-status').classList.add('done'), 700);
    setTimeout(() => $('#cover-build-status').classList.add('done'), 1350);
    setTimeout(() => {
      updateCover();
      const name = $('#person-name').value.trim();
      $('#result-name').textContent = `${name}’s`;
      $('#result-age').textContent = selectedValue('age') === 'Adult' ? 'adults' : `ages ${selectedValue('age')}`;
      $('#cover-status').textContent = 'YOUR FREE COVER';
      $('.cover-stage').classList.add('generated');
      track('preview_revealed', { age: selectedValue('age'), story: selectedValue('story') });
      showStep(3);
    }, 2100);
  });

  $('#reserve-button').addEventListener('click', () => {
    const email = $('#email').value.trim();
    $('#success-email').textContent = email;
    track('reservation_completed', { price: 199, currency: 'AED', age: selectedValue('age'), story: selectedValue('story') });
    showStep('success');
  });

  const modelContext = document.modelContext;
  if (modelContext?.registerTool) {
    const lifecycle = new AbortController();
    try {
      Promise.resolve(modelContext.registerTool({
        name: 'reserve_personalised_book_interest',
        title: 'Reserve personalised book interest',
        description: 'Complete the no-payment reservation using the details already entered in the visible preview journey.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute() {
          if (!$('#email').checkValidity() || !$('#person-name').value.trim()) throw new Error('Complete the name, photo and email steps first.');
          $('#reserve-button').click();
          return { status: 'reserved', paymentTaken: false, price: 199, currency: 'AED' };
        }
      }, { signal: lifecycle.signal })).catch(() => {});
    } catch (_) {}
  }

  updateCover();
  track('demand_test_opened');
})();
