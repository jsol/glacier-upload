if (!process.env.AWS_SDK_LOAD_CONFIG) {
  // Fetch the sdk config if not told otherwise.
  process.env.AWS_SDK_LOAD_CONFIG = 'true'
}

const argv = require('minimist')(process.argv.slice(2))

if (argv.h || argv.help) {
  console.log(`
    Upload a file of any size to Glacier.
    Use environment variables to set the AWS credentials, for example
    AWS_SDK_LOAD_CONFIG=true to use the ones stored in the home folder.

    The following flags are mandatory:

    --fileName, -f\t The file to upload
    --vaultName, -n\t The name of the vault to upload to

    The following flags are optional
    --progress, -p\t Show a progress bar for this upload
    --jsonFile, -j\t Store the archive information in this JSON file.
                     Will create a new file if the path does not exist,
                     and will add to the existing info if it already exists.
                     Saving the archive information locally makes archive
                     retrieval or deletion a lot quicker.
  `)
  process.exit(0)
}
const GlacierStream = require('./GlacierStream')
const fs = require('fs')
const ProgressBar = require('progress')

const vaultName = argv.vaultName || argv.n || null
const fileName = argv.fileName || argv.f || null
const jsonFile = argv.jsonFile || argv.j || null
const progress = argv.progress || argv.p || null

if (fileName === null) {
  console.log('You must provide a file name (-f or --fileName=X)')
  process.exit(1)
}

if (vaultName === null) {
  console.log('You must provide a vault name (-n or --vaultName=X)')
  process.exit(1)
}

const file = fs.createReadStream(fileName, {
  highWaterMark: 1024 * 1024 * 24 // This should be a multiple of the chunk size for the best result
})

const filesize = fs.statSync(fileName).sizei

const date = (new Date()).toISOString().substr(0, 10)

const glacierOptions = {
  vaultName: vaultName,
  archiveDescription: `Backup of ${fileName} taken at ${date}`
}
const output = new GlacierStream(glacierOptions)

if (progress) {
  let previous = 0

  const bar = new ProgressBar('  Uploading [:bar] :rate/bps :percent :etas', {
    complete: '=',
    incomplete: ' ',
    width: '40',
    total: filesize
  })
  output.on('progress', value => {
    bar.tick(value - previous)
    previous = value
  })
  output.on('done', _ => {
    bar.tick(filesize)
  })
}

if (jsonFile) {
  output.on('done', data => {
    let save = []
    try {
      save = JSON.parse(fs.readFileSync(jsonFile))
    } catch (error) {
      save = []
    }

    save.push({
      vaultName: vaultName,
      archiveId: data.archiveId,
      time: (new Date()).toString(),
      timestamp: +new Date(),
      checksum: data.checksum
    })

    fs.writeFileSync(jsonFile, JSON.stringify(save, null, 2))
  })
}

output.init().then(() => {
  console.log('Done init')
  console.log(output.uploadId)
  file.pipe(output)
}).catch(err => {
  console.log(err)
})
