# glacier-upload

The purpose is to provide a class that implements a Node writable stream
that can upload data of arbitrary size to Amazon Glacier.

It splits the data into chunks and performs a multi-upload while using the
stream to keep RAM usage as low as possible.

Default configuration should send approximatly three requests at the time to
Glacier.

## Todo
More tests
Re-upload individual chunks if something goes wrong.
Resume failed uploads
A mode where it can clean out old options.
