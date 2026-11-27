// Local US and Australian dictionaries, shared by suggestions and underlines.
importScripts('../vendor/spelling/nspell.min.js');
const dictionaries = Promise.all(['en.aff','en-us.dic','en-au.dic'].map(async name => {
  const response = await fetch(`../vendor/spelling/${name}`);
  if (!response.ok) throw new Error('Dictionary could not load');
  return response.text();
})).then(([aff, us, au]) => [nspell(aff, us), nspell(aff, au)]);
function adjacentSwap(word, candidate) {
  word = word.toLowerCase(); candidate = candidate.toLowerCase();
  if (word.length !== candidate.length) return false;
  for (let i = 0; i < word.length - 1; i++) {
    if (word[i] !== word[i+1] && word.slice(0,i) + word[i+1] + word[i] + word.slice(i+2) === candidate) return true;
  }
  return false;
}
self.onmessage = async ({data}) => {
  try {
    const {id, word} = data;
    if (data.kind === 'check') {
      if (!Array.isArray(data.words) || data.words.length > 200 || data.words.some(w => typeof w !== 'string' || w.length < 2 || w.length > 32 || !/^[A-Za-z]+(?:['’][A-Za-z]+)*$/.test(w))) throw new Error('Unsupported word batch');
      const engines = await dictionaries;
      self.postMessage({id, correct:data.words.map(w=>engines.some(engine=>engine.correct(w.replace(/’/g,"'"))))});
      return;
    }
    if (typeof word !== 'string' || word.length > 32 || !/^[A-Za-z]+(?:['’][A-Za-z]+)*$/.test(word)) throw new Error('Unsupported word');
    const engines = await dictionaries, normalized = word.replace(/’/g, "'");
    if (engines.some(engine => engine.correct(normalized))) { self.postMessage({id, correct:true}); return; }
    const suggestions = [...new Set(engines.flatMap(engine => engine.suggest(normalized)))];
    suggestions.sort((a,b) => Number(adjacentSwap(normalized,b)) - Number(adjacentSwap(normalized,a)));
    self.postMessage({id, correct:false, suggestions:suggestions.slice(0,6).map(s => word.includes('’') ? s.replace(/'/g,'’') : s)});
  } catch (error) { self.postMessage({id:data?.id, error:error?.message || 'Spelling suggestions unavailable'}); }
};
