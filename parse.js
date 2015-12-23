const [ TOKEN_OPEN, TOKEN_CLOSE, TOKEN_OR, TOKEN_KEY ] = [ '<', '>', '|', ':' ]
    , [ TOKEN_REGEX, TOKEN_ESC, TOKEN_NEGATE ] = [ '/', '\\', '!' ]
    , [ TOKEN_PLACEHOLDER ] = [ '$' ]
    , [ MODE_REGEX, MODE_REGEX_FLAGS, MODE_NORMAL ] = [ 1, 2, 3 ]
    , [ LO_NUM, HI_NUM, LO_AZ, HI_AZ ] = [ 48, 57, 97, 122 ]

// Yeah it's not pretty, but fairly fast
module.exports = function parse(expr, placeholders) {
  let stack = [{}]
    , node = stack[0]
    , mode = MODE_NORMAL

  for (let i=-1, l=expr.length; i<l; i++) {
    let t = i === -1 ? TOKEN_OPEN : expr[i]
      , c = t.charCodeAt(0)
      , isAlpha = c >= LO_AZ && c <= HI_AZ
      , isNum = c >= LO_NUM && c <= HI_NUM

    if (mode === MODE_REGEX) {
      while (expr[i] === TOKEN_ESC) t+= expr[++i]
      if (t === TOKEN_REGEX) mode = MODE_REGEX_FLAGS
      node.regex+= t
    } else if (mode === MODE_REGEX_FLAGS) {
      if (!isAlpha) { mode = MODE_NORMAL; i--; continue } // Revisit
      node.regex+= t
    } else if (t === TOKEN_REGEX) {
      if (mode !== MODE_NORMAL) invalid(i, `Unexpected REGEX token "${t}"`)
      mode = MODE_REGEX
      node.regex = t
      node.type = 'string'
    } else if (t === TOKEN_PLACEHOLDER) {
      const val = placeholders.shift()
      if (!val) invalid(i, `Missing value for placeholder`)
      expr = expr.slice(0, i) + val + expr.slice(i+1)
      l = expr.length; i--; continue; // Revisit
    } else if (t === TOKEN_NEGATE) {
      if (node.type) invalid(i, `Unexpectedly late NEGATE token "${t}"`)
      node.negate = !node.negate
    } else if (isAlpha || isNum) {
      node.type+= t
    } else if (t === ' ') {
      continue // Ignore whitespace
    } else if (t === TOKEN_OPEN) {
      stack.push(node)
      node.members || (node.members = [])
      node.members.push(node = { type: '' })
    } else {
      if (!node.type) invalid(i, `Unexpectedly early token "${t}"`)

      const depth = stack.length - 1

      if (t === TOKEN_CLOSE) {
        if (depth <= 1) invalid(i, `Unexpected CLOSE token "${t}" at root`)
        node = stack.pop()
      } else if (t === TOKEN_OR) {
        stack[depth].members.push(node = { type: '' })
      } else if (t === TOKEN_KEY) {
        if (depth <= 1) invalid(i, `Unexpected KEY token "${t}" at root`)

        // Apply properties to key instead
        node.key = node.type
        node.type = ''

        if (node.regex)  { node.keyRegex  = node.regex;  delete node.regex  }
        if (node.negate) { node.keyNegate = node.negate; delete node.negate }
      } else {
        invalid(i, `Unknown token "${t}"`)
      }
    }
  }

  return stack[0].members

  function invalid(i, msg) {
    throw new Error(`${msg} in type declaration "${expr}" at index ${i}`)
  }
}
