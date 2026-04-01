// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const https = require('https');
const http = require('http');
const { URL } = require('url');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************
/**
 * Performs an HTTP/HTTPS POST request.
 * Returns { ok, status, data } on success or HTTP error.
 * Throws on network/parse errors.
 *
 * @param {string} url - Full URL to POST to
 * @param {Object} headers - Request headers
 * @param {Object|string} body - Request body (object will be JSON-serialized)
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 */
function Post(url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyString),
        ...headers,
      },
    };

    const req = transport.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let data = raw;
        try {
          data = JSON.parse(raw);
        } catch (_) {
          // leave as string if not JSON
        }
        const ok = res.statusCode >= 200 && res.statusCode < 300;
        resolve({ ok, status: res.statusCode, data });
      });
    });

    req.on('error', (err) => reject(err));
    req.write(bodyString);
    req.end();
  });
}

/**
 * Performs an HTTP/HTTPS GET request.
 * Returns { ok, status, data } on success or HTTP error.
 * Throws on network/parse errors.
 *
 * @param {string} url - Full URL to GET
 * @param {Object} headers - Request headers
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 */
function Get(url, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...headers,
      },
    };

    const req = transport.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let data = raw;
        try {
          data = JSON.parse(raw);
        } catch (_) {
          // leave as string if not JSON
        }
        const ok = res.statusCode >= 200 && res.statusCode < 300;
        resolve({ ok, status: res.statusCode, data });
      });
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

// *************** EXPORT MODULE ***************
module.exports = { Post, Get };
