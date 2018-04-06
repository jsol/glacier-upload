const { Writable } = require('stream')
const AWS = require('aws-sdk')

class GlacierStream extends Writable {
  constructor (options) {
    super(options)
    this.chunkSize = options.chunkSize || 1024 * 1024 * 8
    this.total = 0
    this.buffer = Buffer.allocUnsafe(0)
    this.options = options
    this.glacier = options.glacier || new AWS.Glacier({apiVersion: '2012-06-01'})
    this.hashes = []
    this.debug = options.debug || console.log
  }

  init () {
    return new Promise((resolve, reject) => {
      const params = {
        vaultName: this.options.vaultName,
        archiveDescription: this.options.archiveDescription,
        partSize: this.chunkSize.toString()
      }
      this.glacier.initiateMultipartUpload(params, (err, multipart) => {
        if (err) {
          this.debug('Could not initiate the multipart upload')
          this.debug(JSON.stringify(err))
          this.debug(JSON.stringify(multipart))
          return reject(err)
        }
        this.uploadId = multipart.uploadId
        resolve()
      })
    })
  }

  _write (chunk, encoding, done) {
    this.buffer = Buffer.concat([ this.buffer, chunk ])
    const promises = []
    while (this.buffer.length > this.chunkSize) {
      promises.push(this.sendChunk(this.buffer.slice(0, this.chunkSize), this.total))
      this.total += this.chunkSize
      this.buffer = this.buffer.slice(this.chunkSize)
    }

    if (promises.length === 0) {
      return done()
    }

    Promise.all(promises).then(newHashes => {
      this.hashes = this.hashes.concat(newHashes)
      this.emit('progress', this.total)
      done()
    })
  }

  _final (done) {
    this.sendChunk(this.buffer, this.total)
      .then((newHashes) => {
        this.hashes = this.hashes.concat(newHashes)
        const checksum = this.glacier.buildHashTree(this.hashes)
        const params = {
          vaultName: this.options.vaultName,
          uploadId: this.uploadId,
          archiveSize: (this.total + this.buffer.length).toString(),
          checksum: checksum
        }
        this.glacier.completeMultipartUpload(params, (err, data) => {
          if (err) {
            this.debug('Could not finalize the upload')
            this.debug(JSON.stringify(err))
            this.debug(JSON.stringify(data))
            return done(err)
          }
          this.emit('done', data)
      	  this.debug('Done with the upload!')
          done()
        })
      })
  }

  sendChunk (buffer, offset) {
    if (buffer.length === 0) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      const hash = this.glacier.computeChecksums(buffer).treeHash
      const params = {
        vaultName: this.options.vaultName,
        uploadId: this.uploadId,
        range: `bytes ${offset}-${offset + buffer.length - 1}/` + '*',
        body: buffer,
        checksum: hash
      }

      this.glacier.uploadMultipartPart(params, (err, data) => {
        if (err) {
          this.debug('Could not upload chunk')
          this.debug(JSON.stringify(err))
          this.debug(JSON.stringify(data))
          return reject(err)
        }

        // We get a hex string from the glacier lib, so we need to convert it back
        // to this "binary" string so that it can be used in the final checksum
        // calculation.
        resolve(Buffer.from(hash, 'hex').toString('binary'))
      })
    })
  }
}

module.exports = GlacierStream
