'use strict';

import {registerBidder} from '../src/adapters/bidderFactory.js';
import {BANNER} from '../src/mediaTypes.js';
import {config} from '../src/config.js';
import {getWindowSelf} from '../src/utils.js'
import {getStorageManager} from '../src/storageManager.js';

const BIDDER_CODE = 'taboola';
const GVLID = 42;
const CURRENCY = 'USD';
export const END_POINT_URL = 'https://display.bidder.taboola.com/OpenRTB/TaboolaHB/auction';
const USER_ID = 'user-id';
const STORAGE_KEY = `taboola global:${USER_ID}`;
const COOKIE_KEY = 'trc_cookie_storage';

/**
 *  extract User Id by that order:
 * 1. local storage
 * 2. first party cookie
 * 3. rendered trc
 * 4. new user set it to 0
 */
export const userData = {
  storageManager: getStorageManager({gvlid: GVLID, bidderCode: BIDDER_CODE}),
  getUserId: () => {
    const {getFromLocalStorage, getFromCookie, getFromTRC} = userData;

    try {
      return getFromLocalStorage() || getFromCookie() || getFromTRC();
    } catch (ex) {
      return 0;
    }
  },
  getFromCookie() {
    const {cookiesAreEnabled, getCookie} = userData.storageManager;
    if (cookiesAreEnabled()) {
      const cookieData = getCookie(COOKIE_KEY);
      const userId = userData.getCookieDataByKey(cookieData, USER_ID);
      if (userId) {
        return userId;
      }
    }
  },
  getCookieDataByKey(cookieData, key) {
    const [, value = ''] = cookieData.split(`${key}=`)
    return value;
  },
  getFromLocalStorage() {
    const {hasLocalStorage, localStorageIsEnabled, getDataFromLocalStorage} = userData.storageManager;

    if (hasLocalStorage() && localStorageIsEnabled()) {
      return getDataFromLocalStorage(STORAGE_KEY);
    }
  },
  getFromTRC() {
    return window.TRC ? window.TRC.user_id : 0;
  }
}

export const internal = {
  getPageUrl: (refererInfo = {}) => {
    return refererInfo?.page || getWindowSelf().location.href;
  },
  getReferrer: (refererInfo = {}) => {
    return refererInfo?.ref || getWindowSelf().document.referrer;
  }
}

export const spec = {
  supportedMediaTypes: [BANNER],
  gvlid: GVLID,
  code: BIDDER_CODE,
  isBidRequestValid: (bidRequest) => {
    return !!(bidRequest.sizes &&
              bidRequest.params &&
              bidRequest.params.publisherId &&
              bidRequest.params.tagId);
  },
  buildRequests: (validBidRequests, bidderRequest) => {
    const [bidRequest] = validBidRequests;
    const {refererInfo, gdprConsent = {}, uspConsent} = bidderRequest;
    const {publisherId} = bidRequest.params;
    const site = getSiteProperties(bidRequest.params, refererInfo);
    const device = {ua: navigator.userAgent};
    const imps = getImps(validBidRequests);
    const user = {
      buyeruid: userData.getUserId(gdprConsent, uspConsent),
      ext: {}
    };
    const regs = {
      coppa: 0,
      ext: {}
    };

    if (gdprConsent.gdprApplies) {
      user.ext.consent = bidderRequest.gdprConsent.consentString;
      regs.ext.gdpr = 1;
    }

    if (uspConsent) {
      regs.ext.us_privacy = uspConsent;
    }

    if (config.getConfig('coppa')) {
      regs.coppa = 1;
    }

    const ortb2 = bidderRequest.ortb2 || {
      badv: [],
      bcat: []
    };

    const request = {
      id: bidderRequest.auctionId,
      imp: imps,
      site,
      device,
      source: {fd: 1},
      tmax: bidderRequest.timeout,
      bcat: ortb2.bcat,
      badv: ortb2.badv,
      user,
      regs
    };

    const url = [END_POINT_URL, publisherId].join('/');

    return {
      url,
      method: 'POST',
      data: JSON.stringify(request),
      bids: validBidRequests,
      options: {
        withCredentials: false
      },
    };
  },
  interpretResponse: (serverResponse, {bids}) => {
    if (!bids) {
      return [];
    }

    const {bidResponses, cur: currency} = getBidResponses(serverResponse);

    if (!bidResponses) {
      return [];
    }

    return bidResponses.map((bidResponse) => getBid(bids, currency, bidResponse)).filter(Boolean);
  },
};

function getSiteProperties({publisherId, bcat = []}, refererInfo) {
  const {getPageUrl, getReferrer} = internal;
  return {
    id: publisherId,
    name: publisherId,
    domain: refererInfo?.domain || window.location?.host,
    page: getPageUrl(refererInfo),
    ref: getReferrer(refererInfo),
    publisher: {
      id: publisherId
    },
    content: {
      language: navigator.language
    }
  }
}

function getImps(validBidRequests) {
  return validBidRequests.map((bid, id) => {
    const {tagId} = bid.params;
    const imp = {
      id: id + 1,
      banner: getBanners(bid),
      tagid: tagId
    }
    if (typeof bid.getFloor === 'function') {
      const floorInfo = bid.getFloor({
        currency: CURRENCY,
        mediaType: BANNER,
        size: '*'
      });
      if (typeof floorInfo === 'object' && floorInfo.currency === CURRENCY && !isNaN(parseFloat(floorInfo.floor))) {
        imp.bidfloor = parseFloat(floorInfo.floor);
        imp.bidfloorcur = CURRENCY;
      }
    } else {
      const {bidfloor = null, bidfloorcur = CURRENCY} = bid.params;
      imp.bidfloor = bidfloor;
      imp.bidfloorcur = bidfloorcur;
    }
    return imp;
  });
}

function getBanners(bid) {
  return getSizes(bid.sizes);
}

function getSizes(sizes) {
  return {
    format: sizes.map(size => {
      return {
        w: size[0],
        h: size[1]
      }
    })
  }
}

function getBidResponses({body}) {
  if (!body) {
    return [];
  }

  const {seatbid, cur} = body;

  if (!seatbid.length || !seatbid[0].bid || !seatbid[0].bid.length) {
    return [];
  }

  return {
    bidResponses: seatbid[0].bid,
    cur
  };
}

function getBid(bids, currency, bidResponse) {
  if (!bidResponse) {
    return;
  }
  const {
    price: cpm, crid: creativeId, adm: ad, w: width, h: height, exp: ttl, adomain: advertiserDomains, meta = {}
  } = bidResponse;
  let requestId = bids[bidResponse.impid - 1].bidId;
  if (advertiserDomains && advertiserDomains.length > 0) {
    meta.advertiserDomains = advertiserDomains
  }

  return {
    requestId,
    ttl,
    mediaType: BANNER,
    cpm,
    creativeId,
    currency,
    ad,
    width,
    height,
    meta,
    netRevenue: true
  };
}

registerBidder(spec);