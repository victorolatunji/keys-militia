// Picks a random word whose first letter isn't already on screen,
// and that isn't the word the target just had.
export function pickWord(list, usedFirstLetters, previousWord = null) {
  const options = list.filter(
    (word) => !usedFirstLetters.has(word[0]) && word !== previousWord
  );
  if (options.length === 0) return null; // all 26 letters taken
  return options[Math.floor(Math.random() * options.length)];
}