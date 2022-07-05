/**
 * This module sets default values and validates ortb2 first part data
 * @module modules/firstPartyData
 */
import { config } from '../../src/config.js';
import { module, getHook } from '../../src/hook.js';
import {logError} from '../../src/utils.js';

let submodules = [];

export function registerSubmodules(submodule) {
  submodules.push(submodule);
}

export function reset() {
  submodules.length = 0;
}

export function processFpd({global = {}, bidder = {}} = {}) {
  let modConf = config.getConfig('firstPartyData') || {};
  // TODO: convert this to GreedyPromise once #8626 gets merged
  let result = Promise.resolve({global, bidder});
  submodules.sort((a, b) => {
    return ((a.queue || 1) - (b.queue || 1));
  }).forEach(submodule => {
    result = result.then(
      ({global, bidder}) => Promise.resolve(submodule.processFpd(modConf, {global, bidder}))
        .catch((err) => {
          logError(`Error in FPD module ${submodule.name}`, err);
          return {};
        })
        .then((result) => ({global: result.global || global, bidder: result.bidder || bidder}))
    );
  });
  return result;
}

export function startAuctionHook(fn, req) {
  processFpd(req.ortb2Fragments).then((ortb2Fragments) => {
    Object.assign(req.ortb2Fragments, ortb2Fragments);
    fn.call(this, req);
  })
}

function setupHook() {
  getHook('startAuction').before(startAuctionHook, 10);
}

module('firstPartyData', registerSubmodules);

// Runs setupHook on initial load
setupHook();
