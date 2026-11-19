// Starting points use the same editable fields as a book started from scratch.
const storyStarts = new Map([
  ['kids', ['A children’s adventure', '', 'adventure', 'An everyday object turns out to be a map. Follow it somewhere surprising and help a new friend get home.']],
  ['adults', ['A story for a grown-up', 'teen-adult', 'funny', 'A quiet afternoon is interrupted by something completely ridiculous. Build the comedy around the hero’s own habits and interests.']],
  ['birthday', ['A birthday story', '', 'funny', 'A birthday surprise goes astray. The hero follows the clues and brings everyone together for the celebration.']],
  ['christmas', ['The Last Christmas Lantern', '6-8', 'classic', 'On Christmas Eve the last lantern in a snowy village goes dark. Follow tiny pawprints to a lost fox cub and find a way to bring it home.']],
  ['noah', ['Noah and the Little Cloud', '3-5', 'classic', 'Befriend a little cloud. Together water thirsty flowers, wash a muddy duck and help the cloud find its family.']],
  ['amara', ['The Map Beneath the Moon', '6-8', 'adventure', 'Find a silver map under a rug. Follow it to a library in the clouds and discover what happened to the missing North Star.']],
  ['oliver', ['Oliver and the Cake That Wouldn’t Wait', '9-12', 'funny', 'A birthday cake escapes from the kitchen. Follow it through the village with a fox and discover whom the cake wants to bring to the party.']],
  ['luke', ['The Cake That Quit', 'teen-adult', 'funny', 'The hero wants a quiet birthday. The cake grows legs and runs away. Give the chase through the village a dry sense of humour.']]
]);

function showStoryStart(key) {
  const start = storyStarts.get(key);
  state.startingPreset = start ? key : null;
  $('#starting-story').hidden = !start;
  $('#starting-story').textContent = start ? 'Starting with ' + start[0] + '. You can change the story idea.' : '';
  $('#starting-tone').hidden = !start;
}

function applyStoryStart() {
  const key = new URLSearchParams(location.search).get('like');
  const start = storyStarts.get(key);
  const fragment = new URLSearchParams(location.hash.slice(1));
  if (!start || (fragment.has('draft') && fragment.has('key'))) return;
  const [,age,mood,idea] = start;
  if (age) $('input[name="age"][value="' + age + '"]').checked = true;
  $('input[name="mood"][value="' + mood + '"]').checked = true;
  $('#personal-details').value = idea;
  showStoryStart(key);
}
