const utils = {}

utils.stringColor = (diff) => {
  if (diff == 0) {
    return '#000000'
  } else if (diff > 0) {
    return '#70a802'
  } else {
    return '#ea036f'
  }
}
  
utils.stringNumber = (diff) => {
  if (diff == 0) {
    return ''
  } else if (diff > 0) {
    return `(+${diff})`
  } else {
    return `(${diff})`
  }
}

module.exports = utils