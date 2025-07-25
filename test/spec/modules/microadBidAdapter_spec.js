import { expect } from 'chai';
import { spec } from 'modules/microadBidAdapter.js';
import * as utils from 'src/utils.js';

describe('microadBidAdapter', () => {
  const bidRequestTemplate = {
    bidder: 'microad',
    mediaTypes: {
      banner: {}
    },
    params: {
      spot: 'spot-code'
    },
    bidId: 'bid-id',
    ortb2Imp: {
      ext: {
        tid: 'transaction-id'
      }
    }
  };

  describe('isBidRequestValid', () => {
    it('should return true when required parameters are set', () => {
      const validBids = [
        bidRequestTemplate,
        Object.assign({}, bidRequestTemplate, {
          mediaTypes: {
            native: {}
          }
        }),
        Object.assign({}, bidRequestTemplate, {
          mediaTypes: {
            video: {}
          }
        })
      ];
      validBids.forEach(validBid => {
        expect(spec.isBidRequestValid(validBid)).to.equal(true);
      });
    });

    it('should return false when required parameters are not set', () => {
      const bidWithoutParams = utils.deepClone(bidRequestTemplate);
      delete bidWithoutParams.params;
      const bidWithoutSpot = utils.deepClone(bidRequestTemplate);
      delete bidWithoutSpot.params.spot;
      const bidWithoutMediaTypes = utils.deepClone(bidRequestTemplate);
      delete bidWithoutMediaTypes.mediaTypes;

      const invalidBids = [
        {},
        bidWithoutParams,
        bidWithoutSpot,
        bidWithoutMediaTypes,
        Object.assign({}, bidRequestTemplate, {
          mediaTypes: {}
        })
      ];
      invalidBids.forEach(invalidBid => {
        expect(spec.isBidRequestValid(invalidBid)).to.equal(false);
      });
    });
  });

  describe('buildRequests', () => {
    const bidderRequest = {
      refererInfo: {
        page: 'https://example.com/to',
        ref: 'https://example.com/from'
      }
    };
    const expectedResultTemplate = {
      spot: 'spot-code',
      url: 'https://example.com/to',
      referrer: 'https://example.com/from',
      bid_id: 'bid-id',
      transaction_id: 'transaction-id',
      media_types: 1
    };

    it('should generate valid media_types', () => {
      const bidRequests = [
        bidRequestTemplate,
        Object.assign({}, bidRequestTemplate, {
          mediaTypes: {
            banner: {}, native: {}
          }
        }),
        Object.assign({}, bidRequestTemplate, {
          mediaTypes: {
            banner: {}, native: {}, video: {}
          }
        }),
        Object.assign({}, bidRequestTemplate, {
          mediaTypes: {
            native: {}
          }
        }),
        Object.assign({}, bidRequestTemplate, {
          mediaTypes: {
            native: {}, video: {}
          }
        }),
        Object.assign({}, bidRequestTemplate, {
          mediaTypes: {
            video: {}
          }
        }),
        Object.assign({}, bidRequestTemplate, {
          mediaTypes: {
            banner: {}, video: {}
          }
        })
      ];

      const results = bidRequests.map(bid => {
        const requests = spec.buildRequests([bid], bidderRequest);
        return requests[0].data.media_types;
      });
      expect(results).to.deep.equal([
        1, // BANNER
        3, // BANNER + NATIVE
        7, // BANNER + NATIVE + VIDEO
        2, // NATIVE
        6, // NATIVE + VIDEO
        4, // VIDEO
        5 // BANNER + VIDEO
      ]);
    });

    it('should use window.location.href if there is no page', () => {
      const bidderRequestWithoutCanonicalUrl = {
        refererInfo: {
          ref: 'https://example.com/from'
        }
      };
      const requests = spec.buildRequests([bidRequestTemplate], bidderRequestWithoutCanonicalUrl);
      requests.forEach(request => {
        expect(request.data).to.deep.equal(
          Object.assign({}, expectedResultTemplate, {
            cbt: request.data.cbt,
            url: window.location.href
          })
        );
      });
    });

    it('should generate valid request with no optional parameters', () => {
      const requests = spec.buildRequests([bidRequestTemplate], bidderRequest);
      requests.forEach(request => {
        expect(request.data).to.deep.equal(
          Object.assign({}, expectedResultTemplate, {
            cbt: request.data.cbt
          })
        );
      });
    });

    it('should add url_macro parameter to response if request parameters contain url', () => {
      const bidRequestWithUrl = Object.assign({}, bidRequestTemplate, {
        params: {
          spot: 'spot-code',
          url: '${COMPASS_EXT_URL}url-macro'
        }
      });
      const requests = spec.buildRequests([bidRequestWithUrl], bidderRequest);
      requests.forEach(request => {
        expect(request.data).to.deep.equal(
          Object.assign({}, expectedResultTemplate, {
            cbt: request.data.cbt,
            url_macro: 'url-macro'
          })
        );
      });
    });

    it('should add referrer_macro parameter to response if request parameters contain referrer', () => {
      const bidRequestWithReferrer = Object.assign({}, bidRequestTemplate, {
        params: {
          spot: 'spot-code',
          referrer: '${COMPASS_EXT_REF}referrer-macro'
        }
      });
      const requests = spec.buildRequests([bidRequestWithReferrer], bidderRequest);
      requests.forEach(request => {
        expect(request.data).to.deep.equal(
          Object.assign({}, expectedResultTemplate, {
            cbt: request.data.cbt,
            referrer_macro: 'referrer-macro'
          })
        );
      });
    });

    it('should add ifa parameter to response if request parameters contain ifa', () => {
      const bidRequestWithIfa = Object.assign({}, bidRequestTemplate, {
        params: {
          spot: 'spot-code',
          ifa: '${COMPASS_EXT_IFA}ifa'
        }
      });
      const requests = spec.buildRequests([bidRequestWithIfa], bidderRequest);
      requests.forEach(request => {
        expect(request.data).to.deep.equal(
          Object.assign({}, expectedResultTemplate, {
            cbt: request.data.cbt,
            ifa: 'ifa'
          })
        );
      });
    });

    it('should add appid parameter to response if request parameters contain appid', () => {
      const bidRequestWithAppid = Object.assign({}, bidRequestTemplate, {
        params: {
          spot: 'spot-code',
          appid: '${COMPASS_EXT_APPID}appid'
        }
      });
      const requests = spec.buildRequests([bidRequestWithAppid], bidderRequest);
      requests.forEach(request => {
        expect(request.data).to.deep.equal(
          Object.assign({}, expectedResultTemplate, {
            cbt: request.data.cbt,
            appid: 'appid'
          })
        );
      });
    });

    it('should not add geo parameter to response even if request parameters contain geo', () => {
      const bidRequestWithGeo = Object.assign({}, bidRequestTemplate, {
        params: {
          spot: 'spot-code',
          geo: '${COMPASS_EXT_GEO}35.655275,139.693771'
        }
      });
      const requests = spec.buildRequests([bidRequestWithGeo], bidderRequest);
      requests.forEach(request => {
        expect(request.data).to.not.deep.equal(
          Object.assign({}, expectedResultTemplate, {
            cbt: request.data.cbt,
            geo: '35.655275,139.693771'
          })
        );
      });
    });

    it('should not add geo parameter to response if request parameters contain invalid geo', () => {
      const bidRequestWithGeo = Object.assign({}, bidRequestTemplate, {
        params: {
          spot: 'spot-code',
          geo: '${COMPASS_EXT_GEO}invalid format geo'
        }
      });
      const requests = spec.buildRequests([bidRequestWithGeo], bidderRequest);
      requests.forEach(request => {
        expect(request.data).to.deep.equal(
          Object.assign({}, expectedResultTemplate, {
            cbt: request.data.cbt
          })
        );
      });
    });

    it('should always use the HTTPS endpoint https://s-rtb-pb.send.microad.jp/prebid even if it is served via HTTP', () => {
      const requests = spec.buildRequests([bidRequestTemplate], bidderRequest);
      requests.forEach(request => {
        expect(request.url.lastIndexOf('https', 0) === 0).to.be.true;
      });
    });

    it('should not add Liveramp identity link and Audience ID if it is not available in request parameters', () => {
      const bidRequestWithOutLiveramp = Object.assign({}, bidRequestTemplate, {
        userId: {}
      });
      const requests = spec.buildRequests([bidRequestWithOutLiveramp], bidderRequest)
      requests.forEach(request => {
        expect(request.data).to.deep.equal(
          Object.assign({}, expectedResultTemplate, {
            cbt: request.data.cbt
          })
        );
      })
    });

    Object.entries({
      'IM-UID': {
        userId: {imuid: 'imuid-sample'},
        expected: {aids: JSON.stringify([{type: 6, id: 'imuid-sample'}])}
      },
      'ID5 ID': {
        userId: {id5id: {uid: 'id5id-sample'}},
        expected: {aids: JSON.stringify([{type: 8, id: 'id5id-sample'}])}
      },
      'Unified ID': {
        userId: {tdid: 'unified-sample'},
        expected: {aids: JSON.stringify([{type: 9, id: 'unified-sample'}])}
      },
      'Novatiq Snowflake ID': {
        userId: {novatiq: {snowflake: 'novatiq-sample'}},
        expected: {aids: JSON.stringify([{type: 10, id: 'novatiq-sample'}])}
      },
      'AudienceOne User ID': {
        userId: {dacId: {id: 'audience-one-sample'}},
        expected: {aids: JSON.stringify([{type: 12, id: 'audience-one-sample'}])}
      },
      'Ramp ID and Liveramp identity': {
        userId: {idl_env: 'idl-env-sample'},
        expected: {idl_env: 'idl-env-sample', aids: JSON.stringify([{type: 13, id: 'idl-env-sample'}])}
      },
      'Criteo ID': {
        userId: {criteoId: 'criteo-id-sample'},
        expected: {aids: JSON.stringify([{type: 14, id: 'criteo-id-sample'}])}
      },
      'Shared ID': {
        userId: {pubcid: 'shared-id-sample'},
        expected: {aids: JSON.stringify([{type: 15, id: 'shared-id-sample'}])}
      }
    }).forEach(([test, arg]) => {
      it(`should add ${test} if it is available in request parameters`, () => {
        const bidRequestWithUserId = { ...bidRequestTemplate, userId: arg.userId }
        const requests = spec.buildRequests([bidRequestWithUserId], bidderRequest)
        requests.forEach((request) => {
          expect(request.data).to.deep.equal({
            ...expectedResultTemplate,
            cbt: request.data.cbt,
            ...arg.expected
          })
        })
      })
    })

    Object.entries({
      'ID5 ID': {
        userId: {id5id: {uid: 'id5id-sample'}},
        userIdAsEids: [
          {
            source: 'id5-sync.com',
            uids: [{id: 'id5id-sample', aType: 1, ext: {linkType: 2, abTestingControlGroup: false}}]
          }
        ],
        expected: {
          aids: JSON.stringify([{type: 8, id: 'id5id-sample', ext: {linkType: 2, abTestingControlGroup: false}}])
        }
      },
      'Unified ID': {
        userId: {tdid: 'unified-sample'},
        userIdAsEids: [
          {
            source: 'adserver.org',
            uids: [{id: 'unified-sample', aType: 1, ext: {rtiPartner: 'TDID'}}]
          }
        ],
        expected: {aids: JSON.stringify([{type: 9, id: 'unified-sample', ext: {rtiPartner: 'TDID'}}])}
      },
      'not add': {
        userId: {id5id: {uid: 'id5id-sample'}},
        userIdAsEids: [],
        expected: {
          aids: JSON.stringify([{type: 8, id: 'id5id-sample'}])
        }
      }
    }).forEach(([test, arg]) => {
      it(`should ${test} ext if it is available in request parameters`, () => {
        const bidRequestWithUserId = {
          ...bidRequestTemplate,
          userId: arg.userId,
          userIdAsEids: arg.userIdAsEids
        }
        const requests = spec.buildRequests([bidRequestWithUserId], bidderRequest)
        requests.forEach((request) => {
          expect(request.data).to.deep.equal({
            ...expectedResultTemplate,
            cbt: request.data.cbt,
            ...arg.expected
          })
        })
      });
    })

    describe('should send gpid', () => {
      it('from gpid', () => {
        const bidRequest = Object.assign({}, bidRequestTemplate, {
          ortb2Imp: {
            ext: {
              tid: 'transaction-id',
              gpid: '1111/2222',
              data: {
                pbadslot: '3333/4444'
              }
            }
          }
        });
        const requests = spec.buildRequests([bidRequest], bidderRequest)
        requests.forEach(request => {
          expect(request.data).to.deep.equal(
            Object.assign({}, expectedResultTemplate, {
              cbt: request.data.cbt,
              gpid: '1111/2222',
              pbadslot: '3333/4444'
            })
          );
        })
      })

      it('from pbadslot', () => {
        const bidRequest = Object.assign({}, bidRequestTemplate, {
          ortb2Imp: {
            ext: {
              tid: 'transaction-id',
              gpid: '3333/4444',
              data: {}
            }
          }
        });
        const requests = spec.buildRequests([bidRequest], bidderRequest)
        requests.forEach(request => {
          expect(request.data).to.deep.equal(
            Object.assign({}, expectedResultTemplate, {
              cbt: request.data.cbt,
              gpid: '3333/4444',
            })
          );
        })
      })
    })

    const notGettingGpids = {
      'they are not existing': bidRequestTemplate,
      'they are blank': {
        ortb2Imp: {
          ext: {
            tid: 'transaction-id',
            gpid: '',
            data: {
              pbadslot: ''
            }
          }
        }
      }
    }

    Object.entries(notGettingGpids).forEach(([testTitle, param]) => {
      it(`should not send gpid because ${testTitle}`, () => {
        const bidRequest = Object.assign({}, bidRequestTemplate, param);
        const requests = spec.buildRequests([bidRequest], bidderRequest)
        requests.forEach(request => {
          expect(request.data).to.deep.equal(
            Object.assign({}, expectedResultTemplate, {
              cbt: request.data.cbt,
            })
          );
          expect(request.data.gpid).to.be.undefined;
          expect(request.data.pbadslot).to.be.undefined;
        })
      })
    })

    it('should send adservname', () => {
      const bidRequest = Object.assign({}, bidRequestTemplate, {
        ortb2Imp: {
          ext: {
            tid: 'transaction-id',
            data: {
              adserver: {
                name: 'gam'
              }
            }
          }
        }
      });
      const requests = spec.buildRequests([bidRequest], bidderRequest)
      requests.forEach(request => {
        expect(request.data).to.deep.equal(
          Object.assign({}, expectedResultTemplate, {
            cbt: request.data.cbt,
            adservname: 'gam'
          })
        );
      })
    })

    const notGettingAdservnames = {
      'it is not existing': bidRequestTemplate,
      'it is blank': {
        ortb2Imp: {
          ext: {
            tid: 'transaction-id',
            data: {
              adserver: {
                name: ''
              }
            }
          }
        }
      }
    }

    Object.entries(notGettingAdservnames).forEach(([testTitle, param]) => {
      it(`should not send adservname because ${testTitle}`, () => {
        const bidRequest = Object.assign({}, bidRequestTemplate, param);
        const requests = spec.buildRequests([bidRequest], bidderRequest)
        requests.forEach(request => {
          expect(request.data).to.deep.equal(
            Object.assign({}, expectedResultTemplate, {
              cbt: request.data.cbt,
            })
          );
          expect(request.data.adservname).to.be.undefined;
        })
      })
    })

    it('should send adservadslot', () => {
      const bidRequest = Object.assign({}, bidRequestTemplate, {
        ortb2Imp: {
          ext: {
            tid: 'transaction-id',
            data: {
              adserver: {
                adslot: '/1111/home'
              }
            }
          }
        }
      });
      const requests = spec.buildRequests([bidRequest], bidderRequest)
      requests.forEach(request => {
        expect(request.data).to.deep.equal(
          Object.assign({}, expectedResultTemplate, {
            cbt: request.data.cbt,
            adservadslot: '/1111/home'
          })
        );
      })
    })

    const notGettingAdservadslots = {
      'it is not existing': bidRequestTemplate,
      'it is blank': {
        ortb2Imp: {
          ext: {
            tid: 'transaction-id',
            data: {
              adserver: {
                adslot: ''
              }
            }
          }
        }
      }
    }

    Object.entries(notGettingAdservadslots).forEach(([testTitle, param]) => {
      it(`should not send adservadslot because ${testTitle}`, () => {
        const bidRequest = Object.assign({}, bidRequestTemplate, param);
        const requests = spec.buildRequests([bidRequest], bidderRequest)
        requests.forEach(request => {
          expect(request.data).to.deep.equal(
            Object.assign({}, expectedResultTemplate, {
              cbt: request.data.cbt,
            })
          );
          expect(request.data.adservadslot).to.be.undefined;
        })
      })
    })
  });

  describe('interpretResponse', () => {
    const serverResponseTemplate = {
      body: {
        requestId: 'request-id',
        cpm: 0.1,
        width: 200,
        height: 100,
        ad: '<div>test</div>',
        ttl: 10,
        creativeId: 'creative-id',
        netRevenue: true,
        currency: 'JPY',
        meta: {
          advertiserDomains: ['foobar.com']
        }
      }
    };
    const expectedBidResponseTemplate = {
      requestId: 'request-id',
      cpm: 0.1,
      width: 200,
      height: 100,
      ad: '<div>test</div>',
      ttl: 10,
      creativeId: 'creative-id',
      netRevenue: true,
      currency: 'JPY',
      meta: {
        advertiserDomains: ['foobar.com']
      }
    };

    it('should return nothing if server response body does not contain cpm', () => {
      const emptyResponse = {
        body: {}
      };

      expect(spec.interpretResponse(emptyResponse)).to.deep.equal([]);
    });

    it('should return nothing if returned cpm is zero', () => {
      const serverResponse = {
        body: {
          cpm: 0
        }
      };

      expect(spec.interpretResponse(serverResponse)).to.deep.equal([]);
    });

    it('should return a valid bidResponse without deal id if serverResponse is valid, has a nonzero cpm and no deal id', () => {
      expect(spec.interpretResponse(serverResponseTemplate)).to.deep.equal([expectedBidResponseTemplate]);
    });

    it('should return a valid bidResponse with deal id if serverResponse is valid, has a nonzero cpm and a deal id', () => {
      const serverResponseWithDealId = Object.assign({}, utils.deepClone(serverResponseTemplate));
      serverResponseWithDealId.body['dealId'] = 10001;
      const expectedBidResponse = Object.assign({}, expectedBidResponseTemplate, {
        dealId: 10001
      });

      expect(spec.interpretResponse(serverResponseWithDealId)).to.deep.equal([expectedBidResponse]);
    });

    it('should return a valid bidResponse without meta if serverResponse is valid, has a nonzero cpm and no deal id', () => {
      const serverResponseWithoutMeta = Object.assign({}, utils.deepClone(serverResponseTemplate));
      delete serverResponseWithoutMeta.body.meta;
      const expectedBidResponse = Object.assign({}, expectedBidResponseTemplate, {
        meta: { advertiserDomains: [] }
      });

      expect(spec.interpretResponse(serverResponseWithoutMeta)).to.deep.equal([expectedBidResponse]);
    });
  });

  describe('getUserSyncs', () => {
    const BOTH_ENABLED = {
      iframeEnabled: true, pixelEnabled: true
    };
    const IFRAME_ENABLED = {
      iframeEnabled: true, pixelEnabled: false
    };
    const PIXEL_ENABLED = {
      iframeEnabled: false, pixelEnabled: true
    };
    const BOTH_DISABLED = {
      iframeEnabled: false, pixelEnabled: false
    };
    const serverResponseTemplate = {
      body: {
        syncUrls: {
          iframe: ['https://www.example.com/iframe1', 'https://www.example.com/iframe2'],
          image: ['https://www.example.com/image1', 'https://www.example.com/image2']
        }
      }
    };
    const expectedIframeSyncs = [
      {type: 'iframe', url: 'https://www.example.com/iframe1'},
      {type: 'iframe', url: 'https://www.example.com/iframe2'}
    ];
    const expectedImageSyncs = [
      {type: 'image', url: 'https://www.example.com/image1'},
      {type: 'image', url: 'https://www.example.com/image2'}
    ];

    it('should return nothing if no sync urls are set', () => {
      const serverResponse = utils.deepClone(serverResponseTemplate);
      serverResponse.body.syncUrls.iframe = [];
      serverResponse.body.syncUrls.image = [];

      const syncs = spec.getUserSyncs(BOTH_ENABLED, [serverResponse]);
      expect(syncs).to.deep.equal([]);
    });

    it('should return nothing if sync is disabled', () => {
      const syncs = spec.getUserSyncs(BOTH_DISABLED, [serverResponseTemplate]);
      expect(syncs).to.deep.equal([]);
    });

    it('should register iframe and image sync urls if sync is enabled', () => {
      const syncs = spec.getUserSyncs(BOTH_ENABLED, [serverResponseTemplate]);
      expect(syncs).to.deep.equal(expectedIframeSyncs.concat(expectedImageSyncs));
    });

    it('should register iframe sync urls if iframe is enabled', () => {
      const syncs = spec.getUserSyncs(IFRAME_ENABLED, [serverResponseTemplate]);
      expect(syncs).to.deep.equal(expectedIframeSyncs);
    });

    it('should register image sync urls if image is enabled', () => {
      const syncs = spec.getUserSyncs(PIXEL_ENABLED, [serverResponseTemplate]);
      expect(syncs).to.deep.equal(expectedImageSyncs);
    });
  });
});
