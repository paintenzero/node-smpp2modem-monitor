/* @flow */

var Rx = require('rx');
var express = require('express');
var smppObservable = require('./smppObservable');
var Storage = require('./storage');
var extend = require('extend');

function Monitor () {
  this.storage = new Storage('state.nedb');
  this.observable_ = Rx.Observable.never();
  this.__defineGetter__('observable', function () {
    return Rx.Observable.merge(
      this.storage.getLastObservable(),
      this.observable_
    );
  });
}

Monitor.prototype.startMonitoring = function (host, port) {
  var msgObservable = smppObservable.create(host, port).
    map(function (msg) {
      var obj = {};
      extend(false, obj, msg);
      obj.host = host;
      obj.port = port;
      obj.timestamp = new Date();
      return obj;
    });

  var lastStat = this.storage.getLastObservable().
    filter(function (msg) {
      return msg.host === host && msg.port === port && msg.type === 'stat';
    });

  var statObservable = msgObservable.
    filter(function (msg) { return msg.type === 'stat'; }).
    merge(lastStat).
    scan({sentTotal:0, rejectedTotal:0}, function (acc, cur) {
      var obj = {};
      extend(false, obj, cur);
      obj.sentTotal = acc.sentTotal + cur.sent;
      obj.rejectedTotal = acc.rejectedTotal + cur.rejected;
      return obj;
    }).
    doOnNext(function (sysMsg) {
      this.storage.setStatMessage(sysMsg);
    }.bind(this)).
    publish().
    refCount();
  statObservable.subscribe();

  var sysObservable = msgObservable.
    filter(function (msg) { return msg.type === 'sys'; }).
    doOnNext(function (sysMsg) {
      this.storage.setLastSysMessage(sysMsg);
    }.bind(this)).
    publish().
    refCount();
  sysObservable.subscribe();

  this.observable_ = this.observable_.merge(statObservable.merge(sysObservable));
};


/**
 * Returns default monitor
 */
var defMonitor = null;
function getDefaultMonitor () {
  if (defMonitor === null) {
    defMonitor = new Monitor();
  }
  return defMonitor;
}

/**
 * Starts monitoring SMPP server at given host and port
 */
module.exports.startMonitoring = function (host, port) {
  getDefaultMonitor().startMonitoring(host, port);
};
/**
 * Returns observable for default monitor
 */
module.exports.getObservable = function () {
  return getDefaultMonitor().observable;
};
