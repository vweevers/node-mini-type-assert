# mini-type-assert

**Concise type assertions like `a<map<fn:s>>`. Expressions are parsed just once: it generates functions and caches them. Supports the types of [kind-of](https://github.com/jonschlinkert/kind-of) and has [short aliases](https://github.com/vweevers/node-mini-type-assert/blob/master/alias.js) for most.**

[![npm status](http://img.shields.io/npm/v/mini-type-assert.svg?style=flat-square)](https://www.npmjs.org/package/mini-type-assert) [![Dependency status](https://img.shields.io/david/vweevers/node-mini-type-assert.svg?style=flat-square)](https://david-dm.org/vweevers/node-mini-type-assert)

## example

`npm i mini-type-assert`

```js
const t = require('mini-type-assert')

class Example{
  constructor(age, mixed, words, store, opts = {}) {
    this.age = t(age, 'n', 'age')
    this.mixed = t(mixed, 'a<s|n>', 'mixed')
    this.words = t(words, 'a</^[a-z]+$/>', 'words')
    this.store = t(store, 'map<fn:re>', 'store')

    const { a = false } = t(opts, 'o<bool>', 'opts')
  }
}

// Instantiate maps with key-value pairs
const goodboy = new Map([ [function(){}, /a/] ])
const badboy = new Map([ ['not a function', /a/] ])

// Okay
new Example(27, [1, 'a'], ['beep'], goodboy, { a: true })

// Throws
new Example('bad', [null], ['BEEP'], badboy, { a: 0 })
```

## `t(value, assertion, name = '')`

Throws if `value` does not pass `assertion`. Otherwise, it returns `value`. The `name` will be used in the error message.

### assertions

If `assertion` is a string or regular expression, it will be treated as a type expression (see below). If it's a function, it will receive the value and should return `false` if the value is invalid. A boolean `assertion` works like `assert(assertion === true)`. If `assertion` is an array, each element must pass assertion. For example, to assert that an argument is a number and greater than two: `t(arg, ['n', (v) => v > 2 ])`.

### type expressions

- Aliases: `a<s|f>` is `arr<str|fn>` is `array<string|function>`. See the [full list](https://github.com/vweevers/node-mini-type-assert/blob/master/alias.js).
- Member types: `a<n>` means an array of numbers. Note that the entire iterable (array, object, map, ..) will be traversed, so use it wisely.
- Member key types: `map<r:n>` means a Map with regular expressions for keys and numbers for values. Again, traversed entirely. Key types are ignored for arrays (can only be numbers) and objects (can only be strings).
- OR: `n|s` (a number or string)
- Regular expressions:
  - `/\d/` (a string containing at least one number)
  - `a</^x$/i>` (an array containing "x" or "X" strings)
  - `map</^[a-z]+$/:/^[a-z]+$/>` (a Map with lowercase strings for both keys and values)
- Negation: `!fn` (anything but a function)
- Whitespace: `s | a` is `s|a`. Except within regular expressions, spaces are ignored.
- Operator precedence: `s|a<n|b>` (a string, or an array containing numbers or booleans)

## install

With [npm](https://npmjs.org) do:

```
npm install mini-type-assert --save
```

## license

[MIT](http://opensource.org/licenses/MIT) © Vincent Weevers
