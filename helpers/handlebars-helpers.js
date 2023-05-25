const dayjs = require('dayjs')
const relativeTime = require('dayjs/plugin/relativeTime')

const colorList = [
  'bg-primary text-white',
  'bg-secondary text-white',
  'bg-success text-white',
  'bg-danger text-white',
  'bg-warning text-dark',
  'bg-info text-dark',
  'bg-light text-dark',
  'bg-dark text-white'
]

dayjs.extend(relativeTime)

module.exports = {
  currentYear: () => dayjs().year(),
  relativeTimeFromNow: a => dayjs(a).fromNow(),
  ifCond: function (a, b, options) {
    return a === b ? options.fn(this) : options.inverse(this)
  },
  randomColor: function () {
    return colorList[Math.floor(Math.random() * colorList.length)]
  }
}
