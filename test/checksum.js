/* eslint-env mocha */
const GlacierStream = require('../src/GlacierStream')
const GlacierMock = require('./glacierMock')
const chai = require('chai')
const expect = chai.expect

describe('when finalizing the upload', done => {
  it('should calculate a correct TreeHash', done => {
    const glacier = new GlacierMock()
    const upload = Buffer.concat([
      Buffer.alloc(1024 * 1024 * 12, 'a'),
      Buffer.alloc(1024 * 1024 * 12, 'b'),
      Buffer.alloc(1024 * 1024 * 12, 'c'),
      Buffer.alloc(1024 * 1024 * 12, 'd'),
      Buffer.alloc(1024 * 1024 * 12, 'e'),
      Buffer.alloc(1024 * 1024 * 12, 'f'),
      Buffer.alloc(1024 * 1024 * 12, 'g')
    ])

    const checksum = glacier.computeChecksums(upload).treeHash

    const glacierOptions = {
      vaultName: 'test',
      archiveDescription: `test`,
      glacier: glacier,
      debug: () => {}
    }

    const output = new GlacierStream(glacierOptions)
    glacier.completeMultipartUpload = (params, callback) => {
      callback(null, {})
      try {
        expect(params.archiveSize).to.equal(upload.length.toString())
        expect(params.checksum).to.equal(checksum)
      } catch (err) {
        return done(err)
      }
      done()
    }
    output.init().then(() => {
      output.write(upload)
      output.end()
    })
  })
})
