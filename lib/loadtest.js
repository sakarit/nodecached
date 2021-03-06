'use strict';

/**
 * nodecached loadtesting client.
 * (C) 2013 Alex Fernández.
 */


// requires
require('prototypes');
var token = require('./token.js');
var {create} = require('./server.js');
var Client = require('./client.js').Client;
var Memcached = require('memcached');
var Log = require('log');
var testing = require('testing');

// globals
var log = new Log('notice');

// constants
var DEFAULT_PORT = 11211;


/**
 * Run load tests on a memcached server. Options is an object which may have:
 *	- host: to test.
 *	- port: to connect to.
 *	- concurrency: number of simultaneous connections to make.
 *	- maxRequests: number of requests to send.
 *	- maxSeconds: time to spend sending requests.
 *	- key: the key to use.
 *	- memcached: use the memcached driver.
 *	- noResponse: ignore the server response.
 * An optional callback is called after tests have run.
 */
exports.run = function(options, callback)
{
	if (options.info)
	{
		log = new Log('info');
	}
	if (options.debug)
	{
		log = new Log('debug');
	}
	var operation = new Operation(options);
	operation.start(callback);
};

/**
 * A load test operation. Options are the same as for exports.run.
 */
function Operation(options)
{
	// self-reference
	var self = this;

	// attributes
	var freeClients = {};
	var busyClients = {};
	var totalRequests = 0;
	var totalResponses = 0;
	var totalErrors = 0;
	var start = Date.now();
	var key = options.key || 'test' + token.create();
	var concurrency = options.concurrency || 1;
	var callback;

	// init
	init();

	/**
	 * Init the operation.
	 */
	function init()
	{
		var location = 'localhost:' + (options.port || DEFAULT_PORT);
		if (!options.maxRequests && !options.maxSeconds)
		{
			options.maxRequests = 1;
		}
		var ClientConstructor = Client;
		if (options.memcached)
		{
			ClientConstructor = MemcachedClient;
		}
		for (var i = 0; i < concurrency; i++)
		{
			freeClients[i] = new ClientConstructor(location, options, getBusier(i));
		}
	}

	/**
	 * Start the operation.
	 * An optional callback will be called after tests finish.
	 */
	self.start = function(hook)
	{
		callback = hook;
	};

	/**
	 * Get a function to make a client busy.
	 */
	function getBusier(index)
	{
		return function(error)
		{
			if (error)
			{
				log.error('Could not connect client %s: %s', index, error);
				return;
			}
			makeBusy(index);
		};
	}

	/**
	 * Make a client busy.
	 */
	function makeBusy(index)
	{
		if (options.maxRequests && totalRequests >= options.maxRequests)
		{
			return;
		}
		log.debug('Sending using %s: %s / %s', index, totalRequests, options.maxRequests);
		var client = freeClients[index];
		if (!client)
		{
			log.error('Client %s not free', index);
			return;
		}
		totalRequests += 1;
		delete freeClients[index];
		busyClients[index] = client;
		client.get(key, getReceiver(index));
	}

	/**
	 * Get a function to receive a response.
	 */
	function getReceiver(index)
	{
		return function(error)
		{
			log.debug('Receiving using %s', index);
			if (error)
			{
				log.error('Received error: %s', error);
				totalErrors += 1;
			}
			else
			{
				totalResponses += 1;
			}
			var client = busyClients[index];
			if (!client)
			{
				log.error('Client %s is not busy', index);
				return;
			}
			delete busyClients[index];
			freeClients[index] = client;
			if (isFinished())
			{
				return finish();
			}
			makeBusy(index);
		};
	}

	function isFinished()
	{
		if (options.maxRequests && totalResponses >= options.maxRequests)
		{
			return true;
		}
		if (options.maxSeconds)
		{
			var elapsed = (Date.now() - start) / 1000;
			if (elapsed >= options.maxSeconds)
			{
				return true;
			}
		}
		return false;
	}

	/**
	 * Finish the load test.
	 */
	function finish()
	{
		freeClients.overwriteWith(busyClients);
		for (var index in freeClients)
		{
			freeClients[index].end();
		}
		var elapsedSeconds = (Date.now() - start) / 1000;
		var rps = Math.round(totalRequests / elapsedSeconds);
		var meanTimeMs = 1000 * elapsedSeconds / totalRequests;
		if (callback)
		{
			callback({
				totalRequests: totalRequests,
				totalResponses: totalResponses,
				totalErrors: totalErrors,
				totalTimeSeconds: elapsedSeconds,
				rps: rps,
				meanTimeMs: meanTimeMs,
			});
		}
		else
		{
			log.notice('Concurrency Level:      %s', concurrency);
			log.notice('Time taken for tests:   %s seconds', elapsedSeconds);
			log.notice('Complete requests:      %s', totalResponses);
			log.notice('Failed requests:        %s', totalErrors);
			//log.notice('Total transferred:      x bytes');
			log.notice('Requests per second:    %s [#/sec] (mean)', rps);
			log.notice('Time per request:       %s [ms] (mean)', meanTimeMs);
			log.notice('Time per request:       %s [ms] (mean, across all concurrent requests)', meanTimeMs / concurrency);
			//log.notice('Transfer rate:          x [Kbytes/sec] received');
		}
	}
}

/**
 * Test loadtest.
 */
function testLoadTest(callback)
{
	var options = {
		port: 11237,
		maxRequests: 1000,
		key: 'test' + token.create(),
	};
	var location = 'localhost:' + options.port;
	const server = create()
	server.start(options, function(error)
	{
		testing.check(error, 'Could not start server', callback);
		var client = new Client(location, options, function(error)
		{
			testing.check(error, 'Could not create test client', callback);
			client.set(options.key, {b: 'c'}, 10, function(error, result)
			{
				client.end();
				testing.check(error, 'Could not set test', callback);
				testing.assert(result, 'Could not set test', callback);
				exports.run(options, function(results)
				{
					testing.assertEquals(results.totalResponses, options.maxRequests, 'Invalid number of responses', callback);
					options.memcached = true;
					exports.run(options, function(results)
					{
						testing.assertEquals(results.totalResponses, options.maxRequests, 'Invalid number of responses', callback);
						server.stop(function(error)
						{
							testing.check(error, 'Could not stop server', callback);
							testing.success(results, callback);
						});
					});
				});
			});
		});
	});
}

/**
 * A client that uses the memcached driver.
 */
var MemcachedClient = function(location, options, callback)
{
	// self-reference
	var self = this;

	// init
	var memcached = new Memcached(location);
	process.nextTick(callback);

	/**
	 * Get a value.
	 */
	self.get = function(key, callback)
	{
		memcached.get(key, callback);
	};

	/**
	 * Set a value.
	 */
	self.set = function(key, value, exptime, callback)
	{
		memcached.set(key, value, exptime, callback);
	};

	/**
	 * Delete a value.
	 */
	self.delete = function(key, callback)
	{
		memcached.delete(key, callback);
	};

	/**
	 * End the client.
	 */
	self.end = function(callback)
	{
		log.debug('Ending the client');
		memcached.end();
		if (callback)
		{
			process.nextTick(callback);
		}
	};
};


/**
 * Run all tests.
 */
exports.test = function(callback)
{
	log.debug('Running tests');
	testing.run({
		loadTest: testLoadTest,
	}, 5000, callback);
};

// run tests if invoked directly
if (__filename == process.argv[1])
{
	exports.test(testing.show);
}

