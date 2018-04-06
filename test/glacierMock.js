const uuid = require('uuid/v4')
const AWS = require('aws-sdk')
const glacier = new AWS.Glacier({apiVersion: '2012-06-01'})

class Glacier {
  constructor (errors) {
    this.uploads = {}
    this.errors = errors || {}
  }

  initiateMultipartUpload (params, callback) {
    const id = uuid()
    this.uploads[id] = {
      params: params,
      parts: []
    }
    callback(this.errors.init, {uploadId: id})
  }

  uploadMultipartPart (params, callback) {
    return this.validateUploadMultipartPart(params, callback)
  }

  validateUploadMultipartPart (params, callback) {
    if (!this.uploads[params.uploadId]) {
      return callback(new Error('no such uploadid'), {})
    }

    const upload = this.uploads[params.uploadId]

    if (upload.params.vaultName !== params.vaultName) {
      return callback(new Error('inconsistant vault name'), {})
    }

    if (!params.range) {
      return callback(new Error('no range provided'), {})
    }

    if (!params.body) {
      return callback(new Error('no body provided'), {})
    }

    if (!params.checksum) {
      return callback(new Error('no checksum provided'), {})
    }

    const regexp = new RegExp('bytes ([0-9]+)-([0-9]+)/\\*')
    const res = params.range.match(regexp)
    if (!res || (res[2] - res[1] + 1) !== params.body.length) {
      return callback(new Error('invalid range provided'), {})
    }

    if (params.checksum !== this.computeChecksums(params.body).treeHash) {
      return callback(new Error('invalid checksum provided'), {})
    }

    this.uploads[params.uploadId].parts.push({
      start: res[1],
      end: res[2],
      buffer: params.body
    })

    callback(this.errors.part, {})
  }

  computeChecksums (buffer) {
    return glacier.computeChecksums(buffer)
  }

  buildHashTree (buffer) {
    return glacier.buildHashTree(buffer)
  }
}

module.exports = Glacier
