'use strict';

const kindOf = require('kind-of')
    , TYPE_ALIAS = require('./alias')
    , parse = require('./parse')

const cache = (function(mem) {
  if (typeof Map !== 'undefined') return new Map
  return { get(k) { return mem[k] }, set(k,v) { mem[k] = v } }
})({})

function cached(expr) {
  if (typeof expr !== 'string') {
    throw new Error('Type expression must be a string')
  }

  let fn = cache.get(expr)
  if (fn === undefined) cache.set(expr, fn = generate(expr))

  return fn
}

function assert(val, type, name) {
  const kindOfType = kindOf(type)

  if (kindOfType === 'array') {
    // AND assertion
    type.forEach(t => assert(val, t, name))
  } else if (kindOfType === 'function') {
    if (!type(val)) throw new Error(message(val, name))
  } else if (kindOfType === 'boolean') {
    if (type === false) throw new Error(message(val, name))
  } else if (kindOfType === 'regex' || kindOfType === 'string') {
    const err = cached(type.toString())(val, name, message, kindOf)
    if (err) throw new Error(err)
  } else {
    throw new Error(`Invalid assertion type: ${kindOfType}`)
  }

  return val
}

function generate(expr, isChild = false, indent = 1) {
  const anyOf = isChild ? expr : parse(expr)
      , lines = []

  // if (!isChild) console.log(JSON.stringify(anyOf, null, ' '))

  const push = (...args) => lines.push(...args.map(indentLine))
  const unshift = (...args) => lines.unshift(...args.map(indentLine))
  const indentLine = (l) => l ? new Array(indent).join('  ') + l : ''

  // Start function body
  indent++; if (!isChild) push("'use strict';")
  push('var err,i,l,arr,subname')

  // Start while loop
  const doWhile = anyOf.length > 1
  if (doWhile) { push('while (true) {'); indent++ }

  anyOf.forEach((orType, i) => {
    const members = orType.members || []
    const type = TYPE_ALIAS[orType.type] || orType.type
    const negate = orType.negate

    if (orType.regex) {
      if (negate) throw new Error('Negate option is not supported on regular expressions')
      push(`err = kindOf(val) === "string" && ${orType.regex}.test(val)`)
      push(`  ? undefined : message(val, name, "Expected string of format ${orType.regex}")`)
    } else {
      if (negate) {
        const msg = `Expected anything other than ${type}`
        push(`err = kindOf(val) !== "${type}" ? undefined: message(val, name, "${msg}")`)
      } else {
        const msg = `Expected ${type}`
        push(`err = kindOf(val) === "${type}" ? undefined : message(val, name, "${msg}")`)
      }
    }

    if (members.length) {
      const valIter = `v${i}`
          , keyIter = `k${i}`
          , keyMembers = []

      push( `var ${valIter} = ${generate(members, true, indent)}\n`
          , 'if (err === undefined) {' )

      members.forEach(m => {
        if (m.key) keyMembers.push({ type: m.key
                                   , regex: m.keyRegex
                                   , negate: m.keyNegate })
      })

      if (keyMembers.length) {
        const fn = generate(keyMembers, true, indent)
        push( `const ${keyIter} = ${fn}\n`)
      }

      indent++
      push(...generateIterator(type, valIter, keyMembers.length ? keyIter : null))
      indent--

      push('}')
    }

    if (doWhile && i < anyOf.length-1) push('if (err === undefined) break')
  })

  // End while loop
  if (doWhile) { push('break'); indent--; push('}', '') }

  // End function body
  push('return err'); indent--;

  // Wrap function body
  if (isChild) {
    unshift('function(val, name, message, kindOf) {')
    push('}')
    return lines.join('\n').trim()
  } else {
    // console.log(lines.join('\n'))
    return new Function('val', 'name', 'message', 'kindOf', lines.join('\n'))
  }
}

function generateIterator(type, valIter, keyIter) {
  if (type === 'array') {
    // Ignoring keyIterator, can only be numbers
    return [ `for(i=0, l=val.length; i<l; i++) {`
           , '  let subname = name ? name + "[" + i + "]" : i'
           , `  if (err = ${valIter}(val[i], subname, message, kindOf)) break`
           , `}` ]
  } else if (type === 'object') {
    // Ignoring keyIterator, can only be strings
    return [ `for(arr = Object.keys(val), i=0, l=arr.length; i<l; i++) {`
           , '  subname = name ? name + "." + arr[i] : arr[i]'
           , `  if (err = ${valIter}(val[arr[i]], subname, message, kindOf)) break`
           , `}` ]
  } else if (type === 'map') {
    const lines =
      [ `for(arr = val.entries(), i=0, l=arr.length; i<l; i++) {`
      , '  subname = name ? name + "[" + i + "]" : i' ]

    if (keyIter !== null) {
      lines.push('  let subkey = name ? "key " + i + " in " + name : "key " + i')
      lines.push(`  if (err = ${keyIter}(arr[i][0], subkey, message, kindOf)) break`)
    }

    lines.push(`  if (err = ${valIter}(arr[i][1], subname, message, kindOf)) break`)
    lines.push(`}`)

    return lines
  } else {
    throw new Error(`Unsupported or invalid iterable: ${type}`)
  }
}

function message(val, name, msg = 'Invalid value') {
  const json = JSON.stringify(val)
      , subject = name ? ` for "${name}"` : ''

  return `${msg}${subject}, got ${json} (${kindOf(val)})`
}

module.exports = assert
assert.parse = parse
