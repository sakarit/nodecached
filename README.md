[![Build Status](https://secure.travis-ci.org/alexfernandez/nodecached.png)](http://travis-ci.org/alexfernandez/nodecached)

# nodecached

nodecached is a memcached-compatible server and client written in node.js.

The client is a full-blown driver for any remote memcached servers.

The server is useful if you want a simple memcached server that integrates with your existing node.js infrastructure;
otherwise just use [the original memcached](http://memcached.org/) which is a very lightweight
program and blazing fast.

nodecached can also be used as an in-memory cache.

## Installation

Installing the package is very simple. Just install globally using npm:

    # npm install -g nodecached

On Ubuntu or Mac OS X systems, use `sudo`:

    $ sudo npm install -g nodecached

### Compatibility

Versions 1 and later should be used at least with Node.js v8 or later:

* Node.js v8 or later: ^1.0.0
* Node.js v6 or earlier: ^0.2.0.

## nodecached Server

nodecached is primarily a server compatible with memcached.

### Usage

Start from the command line:

    $ nodecached

### Options

Options are designed to be compatible with the original memcached, whenever possible.

* `-p port`: Start server on the given port.
* `-v`: Show notice messages.
* `-vv`: Show info messages.
* `-vvv`: Show debug messages.

### Advanced Options

These options are specific for nodecached.

* `--delay`: Enable Nagle's algorithm. Useful for measuring the cost of not setting the option `nodelay`.
* `--fast`: Do not parse commands and return an error on all queries. Useful for measuring socket performance.

### Server Commands

nodecached accepts the following commands, based on [the original commands](https://github.com/memcached/memcached/blob/master/doc/protocol.txt):

#### Storage

There are a few storage commands that start with a header like this:

`<command> <key> <flags> <exptime> <bytes>\r\n`

* `<command>` is `set`, `add`, `replace`, `append` or `prepend`.

* `<key>` is a string that will identify the element.

* `<flags>` is a 32-bit integer to store with the value.

* `<exptime>` is expiration time in seconds.

* `<bytes>` is the length of the data in bytes.

Afterwards the server will expect the data block:

`<data>\r\n`

with a length of `<bytes>`.

The server will respond with:

* `STORED\r\n` to indicate success.

* `NOT_STORED\r\n` to indicate failure.

#### Retrieval

The command `get` has the following syntax:

`get <key>\r\n`

where `<key>` is a string that identifies an element.

#### Deletion

The command to delete a record is:

`delete <key>\r\n`

where the `<key>` identifies the record.
The server will respond with:

* `DELETED` to indicate that the record has been deleted.

* `NOT_DELETED` if the value is not found.

#### Statistics

The following command will retrieve a set of stats.

`stats\r\n`

The stats include `pid`, `total_items` and a few others.

#### Version

This simple command retrieves the version of nodecached.

`version\r\n`

The response will be something like this:

`VERSION <string>`

The version `<string>` will always start with `nodecached-`.

### Caveats

nodecached may strive to be compatible with memcached, but it is not equivalent.
To start with, it will probably consume more memory and be slower -- in my tests about three times as slow.

On the other hand, the absolute difference amounts to about 20 µs per request --
that is 20 millionths of a second.
Typical network latencies are about 10 times bigger than that.
So the difference might not be an issue to you.

In any case, this is a preliminary version which is not even protocol-complete yet.
Please use with care.

Missing commands are: `gets`, `cas`, `slabs [command]`, `stats [option]`.
General purpose statistics are by no means complete.
The option `noreply` is not supported yet.
UDP and binary protocols are out of scope at the moment.

## Memcached Client

nodecached can be used as a client to a remote system.
It has been designed to be a drop-in replacement for
[node-memcached](https://github.com/3rd-Eden/node-memcached).

### Usage

You can integrate nodecached into your code as a client.
It is mostly compatible with node-memcached, so it should be a drop-in replacement.
Just create a client with a location and options, and use it:

    var Client = require('nodecached').Client;
    var client = new Client('localhost:11311', {
		timeout: 3000,
	});

### API

The API has the following functions.

#### Client(location, options, callback)

Create the client.
* location: a string with the location `host:port`.
Can also be an array of locations, or an object with {location: weight}.
Note: weights are ignored right now.

#### client.get(key, callback)

Retrieve an object from the server by key, and send to the callback.
* key: a string with the memcached key.
* callback: function(error, value) to call with the retrieved value.

#### client.set(key, value, lifetime, callback)

Store an object in the server by key.
* key: a string with the memcached key.
* value: the object to store.
* lifetime: max seconds to store.
* callback: function(error, result) to call, true if stored.

#### client.delete(key, callback)

Delete an object from the server by key.
* key: a string with the memcached key.
* callback: function(error, result) to call, true if deleted, false otherwise.

#### client.incr(key, value, callback)

Increment a numeric value from the server by key.
* key: a string with the memcached key.
* value: the value to add to the original.
* callback: function(error, result) to call with the incremented value,
or false if not found.

#### client.decr(key, value, callback)

Decrement a numeric value from the server by key.
* key: a string with the memcached key.
* value: the value to substract from the original.
* callback: function(error, result) to call with the decremented value,
or false if not found.

### Options

The client accepts some options compatible with node-memcached.

* `timeout`: ms to wait for a response from the server.

## In-memory Cache

nodecached can also work as an in-memory cache, again compatible with
[node-memcached](https://github.com/3rd-Eden/node-memcached).

## References

* [protocol.txt](https://github.com/memcached/memcached/blob/master/doc/protocol.txt)
* [node-memcached](https://github.com/3rd-Eden/node-memcached)
* [jscached](https://github.com/monsur/jscache)
* [memcached configuration](https://code.google.com/p/memcached/wiki/NewConfiguringServer)


## License

Distributed under the MIT license. See the file LICENSE for details.

