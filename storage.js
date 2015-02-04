/* @flow */

var DataStore = require('nedb');
var Rx = require('rx');
var extend = require('extend');

function Storage(filepath) {
  this.db = new DataStore({
    filename: filepath
  });

  this.db.loadDatabase();

  this.insert = Rx.Observable.fromNodeCallback(this.db.insert.bind(this.db));
  this.update = Rx.Observable.fromNodeCallback(this.db.update.bind(this.db));
  this.findAll = Rx.Observable.fromNodeCallback(this.db.find.bind(this.db, {}));
  this.remove = Rx.Observable.fromNodeCallback(this.db.remove.bind(this.db));
}
/**
 * Sets last sys message
 */
Storage.prototype.setLastSysMessage = function (message) {
  if (message.error === undefined) {
    this.db.update({imsi: message.imsi, type:'sys'}, message, {upsert: true});
  }
};
/**
 *
 */
Storage.prototype.setStatMessage = function (message) {
  var obj = {};
  extend(false, obj, message);
  obj.sent = message.sentTotal;
  obj.rejected = message.rejectedTotal;
  this.db.update({imsi: message.imsi, type:'stat'}, obj, {upsert: true});
};
/**
 *
 */
Storage.prototype.getLastObservable = function () {
  return this.findAll().
    flatMap(function (arr) {
      return Rx.Observable.from(arr);
    });
};

Storage.prototype.clean = function (host, port) {
  this.db.remove ({}, {multi: true});
};

module.exports = Storage;
