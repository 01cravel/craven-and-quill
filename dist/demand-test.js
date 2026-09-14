(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const labels = { 1: 'Their name', 2: 'Reading level', 3: 'Story style', 4: 'Their photo', 5: 'Your email', 6: 'Review' };
  const storyNames = { funny: 'Funny', adventure: 'Adventure', classic: 'Warm and classic' };
  const storyCovers = {
    funny: { art: 'assets/cake-book-portrait/page-01.jpg', title: 'and the Cake That Ran Away' },
    adventure: { art: 'assets/books-cartoon/amara/cover.jpg', title: 'and the Map Beneath the Moon' },
    classic: { art: 'assets/books-cartoon/noah/cover.jpg', title: 'and the Little Cloud' }
  };
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
    const progress = !Number.isNaN(numeric) ? numeric : 6;
    const finished = ['reserved', 'declined', 'thanks'].includes(String(screen));
    $('#progress-label').textContent = finished ? 'Complete' : `Question ${Math.min(progress, 6)} of 6`;
    $('#progress-name').textContent = screen === 'making' ? 'Making the cover' : screen === 'result' ? 'Your cover' : screen === 'reserved' ? 'Reserved' : screen === 'declined' ? 'Your answer' : screen === 'thanks' ? 'Thank you' : labels[progress];
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

  $('[data-next="6"]').addEventListener('click', () => {
    if (!$('#email').checkValidity()) {
      $('#email-error').textContent = 'Add a valid email address.';
      $('#email').focus();
      return;
    }
    if (!$('#permission').checked) {
      $('#email-error').textContent = 'Confirm you have permission to use the photo.';
      $('#permission').focus();
      return;
    }
    $('#email-error').textContent = '';
    const name = $('#person-name').value.trim();
    $('#review-name').textContent = `${name}’s`;
    $('#summary-name').textContent = name;
    $('#summary-age').textContent = value('age') === 'Adult' ? 'An adult' : `Ages ${value('age')}`;
    $('#summary-story').textContent = storyNames[value('story')];
    track('email_completed');
    show(6);
  });

  $$('[data-back]').forEach((button) => button.addEventListener('click', () => show(button.dataset.back)));
  $('#start-again').addEventListener('click', () => location.reload());

  $('#make-cover').addEventListener('click', () => {
    const name = $('#person-name').value.trim();
    $('#making-name').textContent = name;
    track('preview_requested', { age: value('age'), story: value('story') });
    show('making');
    setTimeout(() => $('#drawing-status').classList.add('done'), 650);
    setTimeout(() => $('#book-status').classList.add('done'), 1250);
    setTimeout(() => {
      const cover = storyCovers[value('story')];
      $('#cover-art').src = cover.art;
      $('#cover-name').textContent = name;
      $('#cover-title').textContent = cover.title;
      track('preview_revealed', { age: value('age'), story: value('story') });
      show('result');
    }, 1800);
  });

  $('#reserve').addEventListener('click', () => {
    $('#reserved-email').textContent = $('#email').value.trim();
    track('reservation_completed', { price: 199, currency: 'AED', age: value('age'), story: value('story') });
    show('reserved');
  });

  $('#not-yet').addEventListener('click', () => {
    track('reservation_declined', { price: 199, currency: 'AED' });
    show('declined');
  });

  $$('.reason-list button').forEach((button) => button.addEventListener('click', () => {
    track('decline_reason', { reason: button.dataset.reason });
    show('thanks');
  }));

  const modelContext = document.modelContext;
  if (modelContext?.registerTool) {
    const lifecycle = new AbortController();
    try {
      Promise.resolve(modelContext.registerTool({
        name: 'reserve_personalised_book_interest',
        title: 'Reserve personalised book interest',
        description: 'Complete the visible no-payment reservation after the cover preview is ready.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute() {
          if (!$('.result-screen.active')) throw new Error('Complete all six questions and create the cover first.');
          $('#reserve').click();
          return { status: 'reserved', paymentTaken: false, price: 199, currency: 'AED' };
        }
      }, { signal: lifecycle.signal })).catch(() => {});
    } catch (_) {}
  }

  track('demand_test_opened');
})();
