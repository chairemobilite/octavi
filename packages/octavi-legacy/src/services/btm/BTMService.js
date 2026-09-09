

import _merge     from 'lodash/merge';
import _padStart  from 'lodash/padStart';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import pQueue from 'p-queue';
import fetchRetry from 'fetch-retry';
// FIXME Define type for btm config
import config from 'chaire-lib-backend/lib/config/server.config';
const fetch = fetchRetry(global.fetch);


// This allows to limit the number of parallel requests
const requestQueue = new pQueue({ concurrency: 10 });

class BTMService {

  constructor() {

  }

  async request(routePrefix, query, parameters, hideEtag) {

    const request = `${this.getUrlPrefix(parameters ? parameters.host : null, parameters ? parameters.port : null)}${routePrefix}${query ? query : ''}`;

    const headers = {
      "Accept"         : "application/json",
      "X-Version"      : "2",
      "Content-Type"   : "application/json",
      "X-API-KEY"      : process.env.BTM_API_KEY,
      "Accept-Encoding": 'gzip'
    };

    if (!_isBlank(parameters.etag))
    {
      headers["If-None-Match"] = parameters.etag;
    }

    let newEtag = null;

    return requestQueue.add(async () => {
      try {
        const response = await fetch(request, {
            method: "GET",
            headers
        });
        if (response.status === 304) {  // this status means no change since submited etag
          return { status: 'NotModified' };
        }
        const respHeaders    = response.headers;
        const headerEtag = respHeaders.get('etag');
        if (headerEtag)
        {
          newEtag = headerEtag;
        }
        if (!hideEtag) {
          console.log('headerEtag', headerEtag);
        }
        const json = await response.json();
        json.query = request;
        json.etag  = newEtag;
        return json;
      } catch (error) {
        console.error(`Error fetching data from API: ${error}`);
        return false;
      }
    })

  }

  async taxiPositions(parameters = {}) {
    /**
     * @param {Object} data parameter for query Must be formated as follow : {year: XX, day: XX, hour: XX, minute: XX} minute must be a multiple of 10
     */

    parameters = _merge({
      routePrefix: 'api/data-dumps/taxi-positions/',
    }, parameters);

    const query  = `${parameters.year}-${_padStart(parameters.month, 2, '0')}-${_padStart(parameters.day, 2, '0')}T${_padStart(parameters.hour, 2, '0')}:${_padStart(parameters.minute, 2, '0')}:00.000Z`;
    const result = await this.request(parameters.routePrefix, query, parameters, true);
    return result;

  }

  async taxis(parameters = {}) {

    parameters = _merge({
      routePrefix: 'api/data-dumps/taxis/',
    }, parameters);

    const result = await this.request(parameters.routePrefix, null, parameters);
    return result;

  }

  async permits(parameters = {}) {

    parameters = _merge({
      routePrefix: 'api/data-dumps/ads/',
    }, parameters);

    const result = await this.request(parameters.routePrefix, null, parameters);
    return result;

  }

  async drivers(parameters = {}) {

    parameters = _merge({
      routePrefix: 'api/data-dumps/drivers/',
    }, parameters);

    const result = await this.request(parameters.routePrefix, null, parameters);
    return result;

  }

  async vehicles(parameters = {}) {

    parameters = _merge({
      routePrefix: 'api/data-dumps/vehicles/',
    }, parameters);

    const result = await this.request(parameters.routePrefix, null, parameters);
    return result;

  }


  getUrlPrefix(host, port) {
    const btmConfig = config.btm ?? {};
    if (host === undefined || host === null || host === '')
    {
      host = btmConfig.host || 'http://localhost';
    }
    if (port === undefined || port === null || port === '')
    {
      port = btmConfig.port;
    }
    return `${host}${port ? ':' + port : ''}/`;
  }

}

// singleton:
const instance = new BTMService();
Object.freeze(instance);

export default instance
