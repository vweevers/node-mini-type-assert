const t = require('./') // ('mini-type-assert')
    , util = require('util')

var expr1 = 'arr<str|buf>|str<a<b|b2>>'
  , expr2 = '<num : buf>arr|arr<str>'
  , expr3 = 'arr<obj<num:/^a-z\\/$/i>>|!func'

// console.log(expr1, util.inspect(t.parse(expr1), { depth: 10, colors: true }))
// console.log(expr2, util.inspect(t.parse(expr2), { depth: 10, colors: true }))
console.log(expr3, '\n', util.inspect(t.parse(expr3), { depth: 10, colors: true }))

t([['aA/']], 'a<a<n|/^a+\\/$/i>>', 'foo')
t(function() {}, 'a<a<n|s>>|func', 'foo')
t({a: new Map([ [/s/, 3] ])}, 'obj<map<re:num>>', 'obj')
t(true, 'n|!s')
t(1, 'number')
t(3, (v) => v != null)
