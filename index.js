'use strict';

const kindOf = require('kind-of')
    , TYPE_ALIAS = require('./alias')
    , parse = require('./parse')

const cache = (function(mem) {
  if (typeof Map !== 'undefined') return new Map
  return { get(k) { return mem[k] }, set(k,v) { mem[k] = v } }
})({})

function cached(expr, placeholders) {
  if (typeof expr !== 'string') {
    throw new Error('Type expression must be a string')
  }

  const id = placeholders.length > 0
      ? placeholders.concat(expr).join(',')
      : expr

  let fn = cache.get(id)
  if (fn === undefined) cache.set(id, fn = generate(expr, placeholders))

  return fn
}

function assert(val, type, name, ...placeholders) {
  if (assert.disabled) return val;

  if (typeof name !== 'string' || name === '') {
    throw new Error('Empty name for assertion')
  }

  const kindOfType = kindOf(type)

  if (kindOfType === 'array') {
    // AND assertion
    type.forEach(t => assert(val, t, name, ...placeholders))
  } else if (kindOfType === 'function') {
    if (!type(val)) throw new Error(message(val, name))
  } else if (kindOfType === 'boolean') {
    if (type === false) throw new Error(message(val, name))
  } else if (kindOfType === 'regexp' || kindOfType === 'string') {
    const check = cached(type.toString(), placeholders)
    const err = check(val, name, message, kindOf)
    if (err) throw new Error(err)
  } else {
    throw new Error(`Invalid assertion type: ${kindOfType}`)
  }

  return val
}

function generate(expr, placeholders, isChild = false, indent = 1) {
  const anyOf = isChild ? expr : parse(expr, placeholders)
      , lines = []

  // if (!isChild) console.log(JSON.stringify(anyOf, null, ' '))

  const push = (...args) => lines.push(...args.map(indentLine))
  const unshift = (...args) => lines.unshift(...args.map(indentLine))
  const indentLine = (l) => l ? new Array(indent).join('  ') + l : ''

  // Start function body
  indent++; if (!isChild) push("'use strict';")
  push('var err,i,l,arr')

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

      push( `var ${valIter} = ${generate(members, placeholders, true, indent)}\n`
          , 'if (err === undefined) {' )

      members.forEach(m => {
        if (m.key) keyMembers.push({ type: m.key
                                   , regex: m.keyRegex
                                   , negate: m.keyNegate })
      })

      if (keyMembers.length) {
        const fn = generate(keyMembers, placeholders, true, indent)
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
           , `  if (err = ${valIter}(val[i], name + "[" + i + "]", message, kindOf)) break`
           , `}` ]
  } else if (type === 'object') {
    // Ignoring keyIterator, can only be strings
    return [ `for(arr = Object.keys(val), i=0, l=arr.length; i<l; i++) {`
           , `  if (err = ${valIter}(val[arr[i]], name + "." + arr[i], message, kindOf)) break`
           , `}` ]
  } else if (type === 'map') {
    const lines = [ `for(arr = val.entries(), i=0, l=arr.length; i<l; i++) {` ]

    if (keyIter !== null) {
      lines.push(`  if (err = ${keyIter}(arr[i][0], "key " + i + " in " + name, message, kindOf)) break`)
    }

    lines.push(`  if (err = ${valIter}(arr[i][1], name + "[" + i + "]", message, kindOf)) break`)
    lines.push(`}`)

    return lines
  } else {
    throw new Error(`Unsupported or invalid iterable: ${type}`)
  }
}

function message(val, name, msg = 'Invalid value') {
  const json = JSON.stringify(val)
  return `${msg} for "${name}", got ${json} (${kindOf(val)})`
}

module.exports = assert
assert.parse = parse
assert.disabled = false;
