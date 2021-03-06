"use strict";

var Wallet = require('../libs/Wallet').Wallet;
var Redis = require('../libs/database/Redis').Redis;
var MongoDB = require('../libs/database/MongoDB').Mongo;
var dbLogger = global.logger.database;

var staticFuncs = exports.PayPalDAO = {
    // Properties
    STATUS_PENDING: 'PENDING',
    STATUS_ACTIVE: 'ACTIVE',
    STATUS_CANCELLED: 'CANCELED',

    // Methods:
    getByUser: (userId, callback) => {
        var query = {
            user_id: userId,
            status: {
                '$in': [
                    staticFuncs.STATUS_ACTIVE,
                    staticFuncs.STATUS_PENDING
                ]
            }
        };
        MongoDB.doQuery({
            ns: 'PayPal::getByUser', op: 'find',
            connection: 'wallet', collection: 'PreApprovals',
            query: query
        }, (err, result) => {
            if (err) result = [];
            return callback(result);
        });
    },

    getByKey: (key, callback) => {
        MongoDB.doQuery({
            ns: 'PayPal::getByKey', op: 'find',
            connection: 'wallet', collection:'PreApprovals',
            query: { _id: key }
        }, (err, result) => {
            if (err) return callback({});
            return callback(result[0]);
        });
    },

    getByKey: (key, callback) => {
        MongoDB.doQuery({
            ns: 'PayPal::getByKey', op: 'find',
            connection: 'wallet', collection:'PreApprovals',
            query: { _id: key }
        }, (err, result) => {
            if (err) return callback({});
            return callback(result[0]);
        });
    },

    create: (key, data) => {
        data['_id'] = key;
        data['status'] = staticFuncs.STATUS_PENDING;
        if (!data.hasOwnProperty('created_at'))
            data['created_at'] = (new Date()).toISOString();
        data['updated_at'] = (new Date()).toISOString();

        MongoDB.doQuery({
            ns: 'PayPal::create', op: 'insert',
            connection: 'wallet', collection:'PreApprovals',
            data: data, options: { safe: true }
        }, () => {});
    },

    update: (key, update) => {
        update['updated_at'] = (new Date()).getTime();

        MongoDB.doQuery({
            ns: 'PayPal::update', op: 'update',
            connection: 'wallet', collection:'PreApprovals',
            query: { _id: key }, update: { '$set': update }
        }, () => {});
    },

    delete: (key) => {
        MongoDB.doQuery({
            ns: 'PayPal::delete', op: 'remove',
            connection: 'wallet', collection:'PreApprovals',
            query: { _id: key }
        }, () => {});
    },

    createPayment: (key, data) => {
        data['_id'] = key;

        MongoDB.doQuery({
            ns: 'PayPal::createPayment', op: 'insert',
            connection: 'wallet', collection:'Payments',
            data: data, options: { safe: true }
        }, () => {});
    },

    updatePayment: (key, update) => {
        MongoDB.doQuery({
            ns: 'PayPal::updatePayment', op: 'update',
            connection: 'wallet', collection:'Payments',
            query: { _id: key }, update: { '$set': update }
        }, () => {});
    },

    pointsProvisioningError: (key, data) => {
        data['_id'] = key;

        MongoDB.doQuery({
            ns: 'PayPal::pointsProvisioningError', op: 'insert',
            connection: 'wallet', collection:'PointsErrors',
            data: data, options: { safe: true }
        }, () => {});
    },

    logIPN: (data) => {
        MongoDB.doQuery({
            ns: 'PayPal::logIPN', op: 'insert',
            connection: 'wallet', collection:'IpnLog',
            data: data, options: { safe: true }
        }, () => {});
    },

    getPriceData: (purchaseKey, callback) => {
        staticFuncs.getPriceList((prices) => {
            if (prices) {
                if (prices.hasOwnProperty(purchaseKey)) return callback(null, prices[purchaseKey]);
                var err = new Error("Purchase key '" + purchaseKey + "' is invalid");
                err.details = prices;
                return callback(err);
            }

            // not in redis, so make http call
            Wallet.getPriceList((err, res) => {
                if (err) return callback(err);

                prices = {};
                for (var idx = 0, length = res['prices'].length; idx < length; idx++) {
                    var priceData = res['prices'][idx];
                    if (priceData['purchaseKey'].match(/^PPAP_/)) {
                        prices[priceData['purchaseKey']] = priceData;
                    }
                }
                // cache the price list
                staticFuncs.setPriceList(prices);

                if (prices.hasOwnProperty(purchaseKey))
                    return callback(null, prices[purchaseKey]);

                var err = new Error("Purchase key '" + purchaseKey + "' is invalid");
                err.details = prices;
                return callback(err);
            });
        });
    },
    getPriceList: (callback) => {
        Redis.doQuery({
            ns: 'PayPal::getPriceList', op: 'get',
            connection: 'wallet', key: 'paypalPriceList'
        }, (err, result) => {
            if (!err && result) result = JSON.parse(result);
            return callback(result);
        });
    },
    setPriceList: (prices) => {
        Redis.doQuery({
            ns: 'PayPal::setPriceList', op: 'set',
            connection: 'wallet', key: 'paypalPriceList',
            value: JSON.stringify(prices), ttl: 86400
        }, () => {});
    }
};
