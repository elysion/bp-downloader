const bpApi = require('bp-api')
const fs = require('fs')

const args = require('optimist')
  .usage('Login and download available music from Beatport.\n\nUsage: $0')
  .demand(['c', 'd'])
  .alias('d', 'downloads-dir')
  .alias('c', 'credentials-file')
  .argv

const downloadsDir = args['downloads-dir'];
const { username, password } = require(args['credentials-file']);

if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}

console.log(`Downloading into ${downloadsDir}`)
console.log(`Logging in as ${username}`)

bpApi.initAsync(username, password)
  .tap(() => console.log('Login successful'))
  .tap(() => console.log('Getting available downloads'))
  .then(session =>
    session.getAvailableDownloadIdsAsync()
      .tap(ids => console.log(`Found ${ids.length} available track(s)`))
      .mapSeries(id => session.downloadTrackWithIdAsync(id)) // this does not work point free!
      .map(request =>
        request.on('response',
          res => {
            const disposition = res.headers['content-disposition']
            const startString = 'filename=\"'
            const endString = '\"'
            const start = disposition.indexOf(startString) + startString.length
            const end = disposition.indexOf(endString, start)
            const filename = disposition.substring(start, end)
            console.log('Downloading:', filename)

            return res.pipe(fs.createWriteStream(`${downloadsDir}/${filename}`))
          })))
