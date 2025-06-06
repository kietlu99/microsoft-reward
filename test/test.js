const { generate } = require('random-words');

const words = generate({
  exactly: 5,
  minLength: 4,
  maxLength: 8,
  formatter: (word, index) => word.toUpperCase(),
});

console.log(words);
