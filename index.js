const bpApi = require('bp-api')
const fs = require('fs')
const R = require('ramda')
const BPromise = require('bluebird')

const args = require('optimist')
  .usage('Login and download available music from Beatport.\n\nUsage: $0')
  .demand(['c', 'd'])
  .alias('d', 'downloads-dir')
  .describe('d', 'Target directory where the script will download the tracks to')
  .alias('c', 'credentials-file')
  .describe('c', `JSON file containing credentials used to log into Beatport \
(format: {"username": "YOUR_BEATPORT_USERNAME", "password": "YOUR_BEATPORT_PASSWORD"})`)
  .alias('i', 'ignore-file')
  .describe('i', `File to log downloaded track ids into. \
This also works as an input to prevent downloading already downloaded tracks`)
  .argv

const downloadsDir = args['downloads-dir'];
const credentials = require(args['credentials-file']);
const ignoreFile = args['ignore-file']

const downloadFromBeatport = (downloadsDir, {username, password}, ignoreFile) => {
  let ignored = []
  if (ignoreFile) {
    if (!fs.existsSync(ignoreFile)) {
      fs.closeSync(fs.openSync(ignoreFile, 'w'));
    } else {
      ignored = fs.readFileSync(ignoreFile, {encoding: 'utf8'}).split('\n').map(Number)
    }
  }

  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
  }

  console.log(`Downloading into ${downloadsDir}`)
  console.log(`Logging in as ${username}`)

  return bpApi.initAsync(username, password)
    .tap(() => console.log('Login successful'))
    .tap(() => console.log('Getting available downloads'))
    .then(session =>
      session.getAvailableDownloadIdsAsync()
        .tap(ids => console.log(`Found ${ids.length} available track(s)`))
        .then(R.without(ignored))
        .tap(ids => console.log(`Found ${ids.length} new track(s)`))
        .mapSeries(id => session.downloadTrackWithIdAsync(id)
          .tap(request =>
            new BPromise((resolve, reject) =>
              request.on('response',
                res => {
                  const disposition = res.headers['content-disposition']
                  const startString = 'filename=\"'
                  const endString = '\"'
                  const start = disposition.indexOf(startString) + startString.length
                  const end = disposition.indexOf(endString, start)
                  const filename = disposition.substring(start, end)
                  console.log('Downloading:', filename)

                  return res
                    .pipe(fs.createWriteStream(`${downloadsDir}/${filename}`))
                    .on('finish', () => {
                      console.log(`Done downloading ${filename}`)
                      if (ignoreFile) {
                        console.log(`Adding ${id} to ignore file`)
                        fs.appendFileSync(ignoreFile, `${id}\n`)
                      }
                      resolve()
                    })
                    .on('error', reject)
                })
                .on('error', reject)
          ))))
    .tap(() => console.log('Success!'))
}

if (require.main === module) {
  return downloadFromBeatport(downloadsDir, credentials, ignoreFile)
}

module.exports = downloadFromBeatport
