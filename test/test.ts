// test/test.ts
var assert = require('assert');

describe('Array#join', () => {
  it('joins all elements into a string with separator', () => {
    assert(['a', 'b', 'c'].join(':') === 'a:b:c:');
  });
});