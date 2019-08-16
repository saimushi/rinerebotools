
require('date-utils');
const crypto = require('crypto');
const shasum = crypto.createHash('sha1');

const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const _ = require('lodash')
const originalConsoleError = console.error
console.error = function(msg) {
  if(_.startsWith(msg, '[vuex] unknown')) return
  if(_.startsWith(msg, 'Error: Could not parse CSS stylesheet')) return
  originalConsoleError(msg)
}

var admin = require('firebase-admin');
var serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.DB_URL
});
const firestore = admin.firestore();
firestore.settings({timestampsInSnapshots: true,});

const Eris = require('eris');
var bot = new Eris(process.env.TOKEN);

var strings = require('./' + process.env.PROJECT_DOMAIN + '.json');
var mode = 2;// 1=l2r 2=kurosaba
if (process.env.PROJECT_DOMAIN == 'erikasama' || process.env.PROJECT_DOMAIN == 'elisabethsama') {
  mode = 1;
}

var _sendWebhookMessage = function(targetClan, targetSchedule, message, username, avatarURL) {
  if ('string' == typeof targetClan.discordhookid && 'string' == typeof targetClan.discordhooktoken && 0 < targetClan.discordhookid.length && 0 < targetClan.discordhooktoken.length) {
    if (targetSchedule) {
      var baseURL = 'https://' + strings.domain + '/?clanid=' + targetClan.ID + '&scheduleid=' + targetSchedule.ID
      message = message.replace('***date***', targetSchedule.date);
      message = message.replace('***title***', targetSchedule.name);
      message = message.replace('***pt***', baseURL + '#party');
      message = message.replace('***ptview***', baseURL + '&view=on#party');
      message = message.replace('***url***', baseURL + '#detailschedule');
      message = message.replace('***urlview***', baseURL + '&view=on#detailschedule');
    }
    var _username = strings.botname;
    if ('string' == typeof username && 0 < username.length) {
      _username = username;
    }
    var _avatarURL = bot.user.dynamicAvatarURL('jpg', 256);
    if ('string' == typeof avatarURL && 0 < avatarURL.length) {
      _avatarURL = avatarURL;
    }
    bot.executeWebhook(targetClan.discordhookid, targetClan.discordhooktoken, {
      username: _username,
      avatarURL: _avatarURL,
      disableEveryone: false,
      content: message + '\n\n'
    });
  }
};

var _infoNews = function(targetClan, targetSchedule) {
  var baseMessage = '@everyone **【自動お知らせ通知】** ' + targetSchedule.date + 'に「' + targetSchedule.name + '」' + strings.notifyMessageTails[0] + '\n https://' + strings.domain + '/?clanid=' + targetClan.ID + '&scheduleid=' + targetSchedule.ID + '&view=on#detailschedule \n';
  console.log(targetClan);
  console.log(targetSchedule);
  console.log(baseMessage);
  if ('string' != typeof targetSchedule.tag || 0 >= targetSchedule.tag.length) {
    _sendWebhookMessage(targetClan, targetSchedule, baseMessage);
    return;
  }
  firestore.collection("news").where("clanid", "==", targetClan.ID).where("tag", "==", targetSchedule.tag).get().then(function(querySnapshot) {
    var datas = [];
    querySnapshot.forEach(function(snapshot) {
      if(snapshot.exists) {
        var data = snapshot.data();
        datas.push(data);
      }
    });
    console.log('news=');
    console.log(datas);
    if (1 == datas.length) {
      _sendWebhookMessage(targetClan, targetSchedule, baseMessage + strings.notifyMessageTails[1] + '\n\n*' + datas[0].text + '*\n');
    }
    else if (1 < datas.length) {
      _sendWebhookMessage(targetClan, targetSchedule, baseMessage + '関連お知らせが' + datas.length + strings.notifyMessageTails[2] + '\n');
    }
    else {
      _sendWebhookMessage(targetClan, targetSchedule, baseMessage);
    }
    return;
  }).catch(function(error) {
    console.error("Error read news: ", error);
  });
  return;
};

var _infoSchedules = function (targetClans, targetStart, targetEnd) {
  if (0 < targetClans.length) {
    var targetClan = targetClans[0];
    targetClans.shift();
    firestore.collection("schedules").where("clanid", "==", targetClan.ID).orderBy("date", "asc").startAt(targetStart).get().then(function(querySnapshot) {
      var schedules = [];
      querySnapshot.forEach(function(snapshot) {
        if(snapshot.exists) {
          var data = snapshot.data();
          data.ID = snapshot.id;
          if ('undefined' != typeof data.date) {
            data.date = data.date.toDate();
            if (targetStart > data.date.getTime()){
              return;
            }
            if (targetEnd < data.date.getTime()){
              return;
            }
            data.date = data.date.toFormat("YYYY/MM/DD HH24:MI");
          }
          schedules.push(data);
        }
      });
      console.log('schedules=');
      console.log(schedules);
      console.log('clan=');
      console.log(targetClan);
      if (0 < schedules.length) {
        for (var sidx=0; sidx < schedules.length; sidx++) {
          _infoNews(targetClan, schedules[sidx]);
        }
      }
      if (0 < targetClans.length) {
        console.log('recursive!');
        _infoSchedules(targetClans, targetStart, targetEnd);
      }
      return;
    }).catch(function(error) {
      console.error("Error read schedules: ", error);
    });
  }
};

var _resetScheduleUser = function (targetSchedule, targetUsers, targetSchedules, targetClans, targetClan, targetBigin, targetStart) {
  if (0 < targetUsers.length) {
    var targetUser = targetUsers[0];
    targetUsers.shift();
    firestore.collection("users").doc(targetUser.ID).get().then(function(snapshot){
      //console.log('snapshot=');
      //console.log(snapshot.exists);
      var data = null;
      if(snapshot.exists) {
        data = snapshot.data();
      }
      if (data && data.activity > -1 && true != ('undefined' != typeof targetSchedule.autoResetPT && true == targetSchedule.autoResetPT)) {
        targetSchedule.incount++;
        firestore.collection("schedules").doc(targetSchedule.ID).collection("users").doc(targetUser.ID).update({entry:0, comment:'同一タグの前回のPT編成をコピー'}).then(function(_snapshot) {
          _resetScheduleUser(targetSchedule, targetUsers, targetSchedules, targetClans, targetClan, targetBigin, targetStart);
        }).catch(function(error) {
          console.error("Error update _resetScheduleUser User: ", error);
        });
        return;
      }
      else {
        firestore.collection("schedules").doc(targetSchedule.ID).collection("users").doc(targetUser.ID).delete().then(function() {
          _resetScheduleUser(targetSchedule, targetUsers, targetSchedules, targetClans, targetClan, targetBigin, targetStart);
        }).catch(function(error) {
          console.error("Error delete _resetScheduleUser User: ", error);
        });
        return;
      }
      return;
    });
    return;
  }
  var newDate = new Date(Math.round(new Date(targetSchedule.date).getTime() + (60 * 60 * 1000 * 24 * 7)));
  firestore.collection("schedules").doc(targetSchedule.ID).update({date: newDate, incount:targetSchedule.incount}).then(function() {
    console.log('recursive _resetSchedule for _resetScheduleUser!');
    console.log(targetClan);
    console.log(targetSchedule);
    var baseMessage = '@everyone **【自動お知らせ通知】** ' + targetSchedule.date + 'に開催した「' + targetSchedule.name + '」の予定を **' + newDate.toFormat("YYYY/MM/DD HH24:MI") + '** ' + strings.notifyMessageTails[3] + '\n https://' + strings.domain + '/?clanid=' + targetClan.ID + '&scheduleid=' + targetSchedule.ID + '&view=on#detailschedule \n';
    console.log(baseMessage);
    _sendWebhookMessage(targetClan, targetSchedule, baseMessage);
    _resetSchedule(targetSchedules, targetClans, targetClan, targetBigin, targetStart);
  }).catch(function(error) {
    console.error("Error update _resetScheduleUser Schedule: ", error);
  });
  return;
};

var _resetSchedule = function (targetSchedules, targetClans, targetClan, targetBigin, targetStart) {
  if (0 < targetSchedules.length) {
    var targetSchedule = targetSchedules[0];
    targetSchedule.incount = 0;
    targetSchedules.shift();
    firestore.collection("schedules").doc(targetSchedule.ID).collection("users").get().then(function(querySnapshot) {
      var users = [];
      querySnapshot.forEach(function(snapshot) {
        if(snapshot.exists) {
          var data = snapshot.data();
          data.ID = snapshot.id;
          if ('undefined' != typeof data.joind && 'string' != typeof data.joind) {
            data.joind = data.joind.toDate();
            data.joind = data.joind.toFormat("YYYY/MM/DD HH24:MI");
          }
          users.push(data);
        }
      });
      _resetScheduleUser(targetSchedule, users, targetSchedules, targetClans, targetClan, targetBigin, targetStart);
      return;
    }).catch(function(error) {
      console.error("Error read reset target schedule users: ", error);
    });
    return;
  }
  if (0 < targetClans.length) {
    console.log('recursive _resetSchedules for _resetSchedule!');
    _resetSchedules(targetClans, targetBigin, targetStart);
    return;
  }
};

var _resetSchedules = function (targetClans, targetBigin, targetStart) {
  if (0 < targetClans.length) {
    var targetClan = targetClans[0];
    targetClans.shift();
    if ('undefined' == typeof targetBigin || 'undefined' == typeof targetStart) {
      targetStart = new Date().getTime();
      targetBigin = Math.round(targetStart - (60 * 60 * 1000 * 24 * 3));
    }
    firestore.collection("schedules").where("clanid", "==", targetClan.ID).where("autoReset", "==", true).orderBy("date", "asc").startAt(targetBigin).get().then(function(querySnapshot) {
      var schedules = [];
      querySnapshot.forEach(function(snapshot) {
        if(snapshot.exists) {
          var data = snapshot.data();
          data.ID = snapshot.id;
          if ('undefined' != typeof data.date) {
            console.log('--date start--');
            console.log(data.date);
            data.date = data.date.toDate();
            console.log(targetBigin);
            console.log(targetStart);
            console.log(data.date);
            console.log('--date end--');
            if (targetBigin > data.date.getTime()){
              return;
            }
            if (targetStart < data.date.getTime()){
              return;
            }
            data.date = data.date.toFormat("YYYY/MM/DD HH24:MI");
          }
          schedules.push(data);
        }
      });
      console.log('reset target schedules=');
      console.log(schedules);
      console.log('clan=');
      console.log(targetClan);
      if (0 < schedules.length) {
        _resetSchedule(schedules, targetClans, targetClan, targetBigin, targetStart);
        return;
      }
      if (0 < targetClans.length) {
        console.log('recursive _resetSchedules for _resetSchedules!');
        _resetSchedules(targetClans, targetBigin, targetStart);
        return;
      }
      return;
    }).catch(function(error) {
      console.error("Error read reset target schedules: ", error);
    });
  }
};

var _notifyNews = function (targetClans, targetClan, targetStart, notifyMode, notifyTime, targetNews) {
  if (0 < targetNews.length) {
    var targetNew = targetNews[0];
    targetNews.shift();
    if (0 < targetNew.tag.length) {
      firestore.collection("schedules").where("clanid", "==", targetClan.ID).where("tag", '==', targetNew.tag).orderBy("date", "asc").startAt(targetStart).get().then(function(querySnapshot) {
        var targetEnd = Math.round(targetStart + (60 * 60 * 1000 * 24 * 7));
        console.log('targetStart=');
        console.log(targetStart);
        console.log('targetEnd=');
        console.log(targetEnd);
        var data = null;
        querySnapshot.forEach(function(snapshot) {
          if(snapshot.exists) {
            if ('undefined' != typeof snapshot.data().date && null === data) {
              data = snapshot.data();
              data.ID = snapshot.id;
              data.date = data.date.toDate();
              console.log('_notifyNews schedules data.date=');
              console.log(data.date);
              console.log(data.date.getTime());
              if (targetStart > data.date.getTime()){
                data = null;
              }
              else if (targetEnd < data.date.getTime()){
                data = null;
              }
              if (null != data) {
                data.date = data.date.toFormat("YYYY/MM/DD HH24:MI");
              }
            }
          }
        });
        _sendWebhookMessage(targetClan, data, '@everyone **【自動お知らせ通知】**\n' + targetNew.text);
        // リカーシブル
        _notifyNews(targetClans, targetClan, targetStart, notifyMode, notifyTime, targetNews);
        return;
      });
      return;
    }
    _sendWebhookMessage(targetClan, null, '@everyone **【自動お知らせ通知】**\n' + targetNew.text);
    // リカーシブル
    _notifyNews(targetClans, targetClan, targetStart, notifyMode, notifyTime, targetNews);
    return;
  }
  _infojob(targetClans, targetStart, notifyMode, notifyTime);
};

var _infojob = function (targetClans, targetStart, notifyMode, notifyTime) {
  if (0 < targetClans.length) {
    var targetClan = targetClans[0];
    targetClans.shift();
    // 本日通知対象
    firestore.collection("news").where("clanid", "==", targetClan.ID).where("notifymode", "==", notifyMode).where("notifytime", "==", notifyTime).get().then(function(querySnapshot) {
      var targetNews = [];
      querySnapshot.forEach(function(snapshot) {
        if(snapshot.exists) {
          var data = snapshot.data();
          data.ID = snapshot.id;
          targetNews.push(data);
        }
      });
      if (0 < targetNews.length) {
        console.log('targetNews=');
        console.log(targetNews);
        _notifyNews(targetClans, targetClan, targetStart, notifyMode, notifyTime, targetNews);
      }
      else {
        _infojob(targetClans, targetStart, notifyMode, notifyTime);
      }
    });
  }
};

var _notifyOfficalInfo = function (targetClans, targetClan, targetNotifies, notifyIndex, platformIsPC, callback) {
  if (0 < targetClans.length && targetClan == null) {
    targetClan = targetClans[0];
    targetClans.shift();
  }
  if ('object' == typeof targetClan && null != targetClan && notifyIndex < targetNotifies.length && 'object' == typeof targetNotifies[notifyIndex]) {
    var targetNotify = targetNotifies[notifyIndex];
    var _name = 'ギルド管理ツールからのお知らせ';
    var _avatarURL = 'https://kurosaba.fun/images/kurosaba/titlelogo.png';
    if (mode == 1) {
      _name = '血盟管理ツールからのお知らせ';
      _avatarURL = 'https://line2revo.fun/images/l2r/titlelogo.png';
    }
    if (true === platformIsPC) {
      if (-1 < targetNotify.message.indexOf('公式(PC)がツイートしました') && 'undefined' != typeof targetClan.twitterPCEnabled && 1 == targetClan.twitterPCEnabled) {
        console.log('@everyone \n' + targetNotify.message);
        _sendWebhookMessage(targetClan, null, '@everyone \n' + targetNotify.message , _name, _avatarURL);
      }
    }
    else {
      if (!(-1 < targetNotify.message.indexOf('公式がツイートしました') && 'undefined' != typeof targetClan.twitterDisabled && 1 == targetClan.twitterDisabled)) {
        console.log('@everyone \n' + targetNotify.message);
        _sendWebhookMessage(targetClan, null, '@everyone \n' + targetNotify.message , _name, _avatarURL);
      }
    }
    firestore.collection("notify").doc(targetNotify.ID).update({notified: true}).then(function(querySnapshot) {
      notifyIndex = notifyIndex + 1;
      _notifyOfficalInfo(targetClans, targetClan, targetNotifies, notifyIndex, platformIsPC, callback);
    });
  }
  else if (0 < targetClans.length){
    // 次の血盟
    _notifyOfficalInfo(targetClans, null, targetNotifies, 0, platformIsPC, callback);
  }
  else if ('function' == typeof callback) {
    callback();
  }
  return;
};

var infojob = function (testClanID) {
  // firbase問い合わせ
  /*firestore.collection("clans").where("useInfoJob", "==", true).get().then(function(querySnapshot) {*/
  firestore.collection("clans").get().then(function(querySnapshot) {
    var datas1 = [];
    var datas2 = [];
    var datas3 = [];
    var datas4 = [];
    var datas5 = [];
    var datas6 = [];
    var datas7 = [];
    var datas8 = [];
    querySnapshot.forEach(function(snapshot) {
      if(snapshot.exists) {
        var data = snapshot.data();
        if (testClanID == snapshot.id || false === testClanID) {
          data.ID = snapshot.id;
          if ('string' == typeof data.discordhookid && 'string' == typeof data.discordhooktoken && 0 < data.discordhookid.length && 0 < data.discordhooktoken.length) {
            if (true == data.useInfoJob) {
              datas1.push(data);
              datas5.push(data);
            }
            datas3.push(data);
            datas4.push(data);
            datas6.push(data);
            datas7.push(data);
            datas8.push(data);
          }
          datas2.push(data);
        }
      }
    });
    console.log('datas1.length='+datas1.length);
    console.log('datas2.length='+datas2.length);
    console.log('datas3.length='+datas3.length);
    console.log('datas4.length='+datas4.length);
    console.log('datas5.length='+datas5.length);
    if (0 < datas1.length || 0 < datas2.length || 0 < datas3.length || 0 < datas4.length || 0 < datas5.length || 0 < datas6.length || 0 < datas7.length) {
      var dt = new Date();
      /*var dayLabel = dt.toFormat("DDD");
      var targetDayCnt = 7;
      if (dayLabel == 'Tue') {
        targetDayCnt = 6;
      }
      else if (dayLabel == 'Wed') {
        targetDayCnt = 5;
      }
      else if (dayLabel == 'Thu') {
        targetDayCnt = 4;
      }
      else if (dayLabel == 'Fri') {
        targetDayCnt = 3;
      }
      else if (dayLabel == 'Sat') {
        targetDayCnt = 2;
      }
      else if (dayLabel == 'Sun') {
        targetDayCnt = 2;
      }*/
      var targetDayCnt = 3;
      var targetStart = dt.getTime();

      var time = dt.toFormat("HH24MI");
      console.log(time + " Ping Received");
      if (time === '0000' || time === '0001' || time === '0002') {
        if (0 < datas1.length) {
          var targetEnd = Math.round(targetStart + (60 * 60 * 1000 * 24 * targetDayCnt));
          console.log('targetDayCnt=' + targetDayCnt + ' & targetStart = ' + targetStart + ' & targetEnd=' + targetEnd);
          _infoSchedules(datas1, targetStart, targetEnd);
        }
        if (0 < datas2.length) {
          // 予定の自動コピー
          var targetBigin = Math.round(targetStart - (60 * 60 * 1000 * 24 * 5));
          console.log('targetDayCnt=' + 1 + ' & targetStart = ' + targetStart + ' & targetBigin=' + targetBigin);
          _resetSchedules(datas2, targetBigin, targetStart);
        }
      }
      var min = dt.toFormat("MI");
      console.log('min=');
      console.log(min);
      if (true == (min === '00' || min === '01' || min === '02') && true == (0 < datas3.length || 0 < datas5.length)) {
        // 約1時間前告知
        if (0 < datas5.length) {
          var targetEnd = Math.round(targetStart + (60 * 60 * 1000));
          console.log('targetDayCnt=' + 1 + ' & targetStart = ' + targetStart + ' & targetEnd=' + targetEnd);
          _infoSchedules(datas5, targetStart, targetEnd);
        }
        // 定期お知らせ配信
        if (0 < datas3.length) {
          var hour = parseInt(dt.toFormat("HH24"));
          if (hour == 0) {
            hour = 24;
          }
          var _mode = 0;
          var day = dt.toFormat("DDD");
          if (day == 'Sun') {
            _mode = 11;
          }
          else if (day == 'Mon') {
            _mode = 12;
          }
          else if (day == 'Tue') {
            _mode = 13;
          }
          else if (day == 'Wed') {
            _mode = 14;
          }
          else if (day == 'Thu') {
            _mode = 15;
          }
          else if (day == 'Fri') {
            _mode = 16;
          }
          else if (day == 'Sat') {
            _mode = 17;
          }
          console.log(_mode);
          console.log(hour);
          _infojob(datas3, targetStart, _mode, hour);
          // 毎日配信
          _infojob(datas4, targetStart, 1, hour);
        }
      }
      // 作者からのお知らせ
      if (0 < datas6.length) {
        firestore.collection("notify").where("notified", "==", false).get().then(function(querySnapshot) {
          var targetNotifies = [];
          querySnapshot.forEach(function(snapshot) {
            if(snapshot.exists) {
              var data = snapshot.data();
              data.ID = snapshot.id;
              targetNotifies.push(data);
            }
          });
          if (0 < datas6.length) {
            console.log('targetNotifies=');
            console.log(targetNotifies);
            _notifyOfficalInfo(datas6, null, targetNotifies, 0);
          }
        });
      }
      if (0 < datas7.length) {
        console.log("tweet scraip");
        var targettwitter = 'https://twitter.com/BlackDesertM_JP';
        var tweetpage = 1;
        if (mode == 1) {
          targettwitter = 'https://twitter.com/Line2Revo';
          tweetpage = 2;
        }
        JSDOM.fromURL(targettwitter).then(dom => {
          if (typeof dom.window !== 'undefined') {
            var lastTweetURL = dom.window.document.querySelector('.stream-items li:nth-child('+tweetpage+') small.time a').href;
            console.log('lastTweetURL='+lastTweetURL);
            firestore.collection("lastTweetURL").where('lastTweetURL', '==', lastTweetURL).get().then(function(querySnapshot) {
              var latesttweet = null;
              querySnapshot.forEach(function(snapshot) {
                console.log('snapshot='+snapshot);
                if(snapshot.exists) {
                  latesttweet = true;
                }
              });
              console.log('latesttweet='+latesttweet);
              var pcTweetInfo = function () {
                if (mode == 1) {
                  return;
                }
                JSDOM.fromURL('https://twitter.com/OFFICIAL_BDJP').then(dom => {
                  if (typeof dom.window !== 'undefined') {
                    var lastPCTweetURL = dom.window.document.querySelector('.stream-items li:nth-child(1) small.time a').href;
                    console.log('lastPCTweetURL='+lastPCTweetURL);
                    firestore.collection("lastTweetURL").where('lastPCTweetURL', '==', lastPCTweetURL).get().then(function(querySnapshot) {
                      var lastPCTweet = null;
                      querySnapshot.forEach(function(snapshot) {
                        console.log('snapshot='+snapshot);
                        if(snapshot.exists) {
                          lastPCTweet = true;
                        }
                      });
                      console.log('lastPCTweet='+lastPCTweet);
                      if (null == lastPCTweet) {
                        firestore.collection("lastTweetURL").doc('lastPCTweetURL').set({lastPCTweetURL:lastPCTweetURL}).then(function() {
                          var notify = { ID: 'PC-'+dt.toFormat("YYYY-MM-DD HH24:MI:SS"), message: '公式(PC)がツイートしました！\n' + lastPCTweetURL + '\n', notified: false };
                          firestore.collection("notify").doc(notify.ID).set({message: '公式(PC)がツイートしました！\n' + lastPCTweetURL + '\n', notified: false}).then(function(setSnapShot) {
                            _notifyOfficalInfo(datas8, null,  [notify], 0, true);
                          });
                        });
                      }
                    });
                  }
                });
              };
              if (null == latesttweet) {
                firestore.collection("lastTweetURL").doc('lastTweetURL').set({lastTweetURL:lastTweetURL}).then(function() {
                  var notify = { ID: dt.toFormat("YYYY-MM-DD HH24:MI:SS"), message: '公式がツイートしました！\n' + lastTweetURL + '\n', notified: false };
                  firestore.collection("notify").doc(notify.ID).set({message: '公式がツイートしました！\n' + lastTweetURL + '\n', notified: false}).then(function(setSnapShot) {
                    _notifyOfficalInfo(datas7, null,  [notify], 0, null, function () {
                      pcTweetInfo();
                    });
                  });
                });
              }
              else {
                pcTweetInfo();
              }
            });
          }
        });
      }
    }
    return;
  }).catch(function(error) {
    console.error("Error read clans: ", error);
  });
  return;
};

bot.on('ready', () => {
  console.log('Eris Bot is Online.');
  var dt = new Date();
  var formatted = dt.toFormat("YYYY-MM-DD HH24:MI:SS DDD");
  console.log(formatted);
});

bot.on('messageCreate', (msg) => {
  var cmd = 0;
  var subcmd = 0;
  var newcp = 0;
  var newSelection = 0;
  var commnet = null;
  if (bot.user == msg.author) {
    console.log('自分自身は無視');
    return;
  }
  // ボット同士の会話禁止
  if ('エリカ様の血盟管理お手伝い' ==  msg.author.username) {
    console.log('エリカ様は無視');
    return;
  }
  if ('エルゼベート様の血盟管理お手伝い' ==  msg.author.username) {
    console.log('エルゼベート様は無視');
    return;
  }
  // ボット同士の会話禁止
  if ('闇の精霊さん' ==  msg.author.username) {
    console.log('闇の精霊さんは無視');
    return;
  }
  if (-1 < msg.content.indexOf('\n')) {
    if ('サンフレ#9241' == msg.author.username + '#' + msg.author.discriminator && -1 < msg.content.indexOf('お知らせ追加\n')) {
      var message = msg.content.replace('お知らせ追加\n', '');
      console.log('お知らせ追加');
      console.log(msg.content);
      var now = new Date();
      firestore.collection("notify").doc(now.toFormat("YYYY-MM-DD HH24:MI:SS")).set({message: message, notified: false, registerd: now}).then(function(snapshot) {
        msg.channel.createMessage('<@' + msg.author.id + '> お知らせを追加しました。');
      });
      return;
    }
    else {
      console.log('改行は無視');
      return;
    }
  }
  if (msg.channel.id == 379464851560595468 || msg.channel.id == 530716770030452756) {
    bot.executeWebhook('584953379336486922', 'v4_osSlytIf42DnXa5JvUStVWtp8IIcxuah1-VHv_wHpiF3HBYa60CFr6apmYx2wvy_M', {
      disableEveryone: false,
      content: '[' + msg.author.username + ']' +  msg.content + '\n\n'
    });
    bot.executeWebhook('585021387262001152', '5Q_fZ_ddid8DXtlyxUqL5tbUno4_u4czvawKnR4rK5-CEhmpSdcn3IqqkGLiapXu1XWb', {
      disableEveryone: false,
      content: '[' + msg.author.username + ']' +  msg.content + '\n\n'
    });
  }
  console.log(msg.channel.id);
  console.log(msg.content);
  msg.content = msg.content.replace(/　/g, " ");
  msg.content = msg.content.replace(/,/g, "");
  console.log(msg.author.id);
  console.log(msg.author.username + '#' + msg.author.discriminator);
  if (isFinite(msg.content) && 0 < parseInt(msg.content)) {
    newcp = parseInt(msg.content);
    cmd = 1;
    var randnum = 1 + Math.floor( Math.random() * 100 );
    if (mode == 2 && ('さよ七#1358' == msg.author.username + '#' + msg.author.discriminator || 'Vega#3839' == msg.author.username + '#' + msg.author.discriminator)) {
      /*if (randnum > 30 && randnum <= 40) {
        msg.channel.createMessage('<@' + msg.author.id + '> ' + strings.botMessageTails[0] + '\n\n・・・ってあれ？？' + msg.author.username + '今日こんなもん？？\n');
        randnum = 999;
      }
      else if (randnum > 50 && randnum <= 60) {
        msg.channel.createMessage('<@' + msg.author.id + '> マジかよまた戦闘力上げたの？・・・ところでオレにスシってのご馳走してくれるって約束覚えてる？？\n');
        randnum = 999;
      }
      else if (randnum > 70 && randnum <= 80) {
        msg.channel.createMessage('<@' + msg.author.id + '> 今日も順調に上がってるね！もうメンドーだし取り敢えず1マンとかに更新しとく？\n');
        randnum = 999;
      }
      else if (randnum > 40 && randnum <= 50) {
        msg.channel.createMessage('<@' + msg.author.id + '> ' + strings.botMessageTails[0] + '\n\n今日あと10回くらいは更新するんだよな？？\n');
        randnum = 999;
      }
      else */if (randnum > 60 && randnum <= 70) {
        msg.channel.createMessage('<@' + msg.author.id + '> はいはい戦闘力の更新なー。\n\n仕方ないからチュンカ1万で手を打ってやるよ。\n');
        randnum = 999;
      }
      else if (randnum > 80 && randnum <= 90) {
        msg.channel.createMessage('<@' + msg.author.id + '> 戦闘力の更新も良いんだけどさ、たまには俺に酒っていうおいしいお水？ご馳走してくれても良いんだぜ？？なんなら皆にご馳走ってのもアリだぜ？\n');
        randnum = 999;
      }
    }
    if (randnum < 999) {
      msg.channel.createMessage('<@' + msg.author.id + '> ' + strings.botMessageTails[0] + '\n');
      if (randnum > 0 && randnum < 5) {
        msg.channel.createMessage('<@' + msg.author.id + '> ' + strings.botMessageTails[1] + '\n');
        cmd = 0;
      }
    }
  }
  else if (0 === msg.content.indexOf('不参加 ') || msg.content == '不参加' || 0 === msg.content.indexOf('欠席 ') || msg.content == '欠席') {
    msg.channel.createMessage(strings.botMessageTails[2] + '\n');
    var entry = msg.content.replace('不参加', '');
    entry = entry.replace('欠席', '').trim();
    cmd = 4;
    subcmd = -1;
    newSelection = 0;
    if ('string' == typeof entry && 0 < entry.length) {
      commnet = entry;
    }
    if (null === commnet) {
      msg.channel.createMessage(strings.botMessageTails[3] + '\n');
    }
  }
  else if (0 === msg.content.indexOf('参加 ') || msg.content == '参加' || 0 < msg.content.indexOf('参戦') || 0 < msg.content.indexOf('参加') || msg.content == 'ハァハァ' || msg.content == 'ハアハア') {
    if (0 !== msg.content.indexOf('参加 ') && msg.content != '参加') {
      if ('ナリ☆助#0933' != msg.author.username + '#' + msg.author.discriminator && 'ナレノハテ明美 蒼炎#6358' != msg.author.username + '#' + msg.author.discriminator) {
        return;
      }
    }
    if (msg.content == 'ハァハァ' || msg.content == 'ハアハア') {
      if ('ナレノハテ明美 蒼炎#6358' == msg.author.username + '#' + msg.author.discriminator) {
        msg.channel.createMessage(strings.botMessageTails[4] + '\n');
        newSelection = 1;
      }
      else {
        return;
      }
    }
    else {
      msg.channel.createMessage(strings.botMessageTails[5] + '\n');
    }
    var entry = msg.content.replace('参加', '').trim();
    var vcSelection = 0;
    cmd = 4;
    subcmd = 1;
    if (-1 < entry.indexOf('聞き専')) {
      entry = entry.replace('聞き専', '').trim();
      newSelection = 2
    }
    else if (mode == 2 && -1 < entry.indexOf('聞き戦')) {
      entry = entry.replace('聞き戦', '').trim();
      newSelection = 2
      msg.channel.createMessage('意地を通すのは不便なものよな。生に涯あれど名に涯はなし！！ この一戦こそわれらいくさ人のひのき舞台だぞ！！\n');
    }
    else if (-1 < entry.indexOf('可能')) {
      entry = entry.replace('可能', '').trim();
      newSelection = 1
    }
    else if (-1 < entry.indexOf('不可')) {
      entry = entry.replace('不可', '').trim();
      newSelection = -1
    }
    if ('string' == typeof entry && 0 < entry.length) {
      commnet = entry;
    }
    if (0 === newSelection) {
      msg.channel.createMessage(strings.botMessageTails[6] + '\n');
    }
  }
  else if (0 === msg.content.indexOf('参加△ ') || msg.content == '参加△' || 0 === msg.content.indexOf('未定 ') || msg.content == '未定') {
    msg.channel.createMessage(strings.botMessageTails[7] + '\n');
    var entry = msg.content.replace('参加△', '').trim();
    entry = entry.replace('未定', '').trim();
    cmd = 4;
    subcmd = 0;
    newSelection = 0;
    if ('string' == typeof entry && 0 < entry.length) {
      commnet = entry;
    }
    if (null === commnet) {
      msg.channel.createMessage(strings.botMessageTails[8] + '\n');
    }
  }
  else if (msg.content === '確認') {
    msg.channel.createMessage(strings.botMessageTails[9] + '\n');
    cmd = 5;
  }
  else if (msg.content === '確認△') {
    msg.channel.createMessage(strings.botMessageTails[10] + '\n');
    cmd = 5;
    subcmd = 2;
  }
  else if (mode == 1 && true == (0 === msg.content.indexOf('アクセ ') || 0 === msg.content.indexOf('サブアクセ '))) {
    msg.content = msg.content.replace(/[０-９]/g, function(s){
        return String.fromCharCode(s.charCodeAt(0)-0xFEE0);
    });
    var acce = '';
    subcmd = 1;
    if (-1 < msg.content.indexOf('サブアクセ ')) {
      subcmd = 21;
      msg.channel.createMessage('<@' + msg.author.id + '> サブ装飾品を更新するのね、私に任せて！\n');
      var acce = msg.content.replace('サブアクセ ', '');
    }
    else {
      msg.channel.createMessage('<@' + msg.author.id + '> 装飾品を更新するのね、私に任せて！\n');
      var acce = msg.content.replace('アクセ ', '');
    }
    console.log(acce);
    cmd = 1;
    if (-1 < acce.indexOf('魔女')) {
      var toLv = parseInt(acce.replace('魔女', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 79 + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の装飾品が見つかったわ！\n **スゴイわ！これ魔女シリーズじゃない！！？ 特性Lv' + toLv + '** で登録するわね★\n');
      }
    }
    if (-1 < acce.indexOf('エルヴン')) {
      var toLv = parseInt(acce.replace('エルヴン', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 69 + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の装飾品が見つかったわ！\n **エルヴンシリーズの特性Lv' + toLv + '** で登録するのね。\n');
      }
    }
    else if (-1 < acce.indexOf('エルブン')) {
      var toLv = parseInt(acce.replace('エルブン', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 69 + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の装飾品が見つかったわ！\n **エルヴンシリーズの特性Lv' + toLv + '** で登録するのね。\n');
      }
    }
    else if (-1 < acce.indexOf('カラ')) {
      var toLv = parseInt(acce.replace('カラ', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 59 + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の装飾品が見つかったわ！\n **スゴイわ！これカラシリーズだわっ！！？ 特性Lv' + toLv + '** で登録するわね★\n');
      }
    }
    else if (-1 < acce.indexOf('ナッセン')) {
      var toLv = parseInt(acce.replace('ナッセン', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 49 + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の装飾品が見つかったわ！\n **ナッセンシリーズの特性Lv' + toLv + '** で登録するのね。\n');
      }
    }
    else if (-1 < acce.indexOf('ムーンストーン')) {
      var toLv = parseInt(acce.replace('ムーンストーン', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 39 + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の装飾品が見つかったわ！\n **ムーンストーンシリーズの特性Lv' + toLv + '** で登録するのね。\n');
      }
    }
    else if (-1 < acce.indexOf('ムーン')) {
      var toLv = parseInt(acce.replace('ムーン', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 39 + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の装飾品が見つかったわ！\n **ムーンストーンシリーズの特性Lv' + toLv + '** で登録するのね。\n');
      }
    }
    else if (-1 < acce.indexOf('ブラックオール')) {
      var toLv = parseInt(acce.replace('ブラックオール', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 29 + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の装飾品が見つかったわ！\n **ブラックオールシリーズの特性Lv' + toLv + '** で登録するのね。\n');
      }
    }
    else if (-1 < acce.indexOf('ブラック')) {
      var toLv = parseInt(acce.replace('ブラック', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 29 + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の装飾品が見つかったわ！\n **ブラックオールシリーズの特性Lv' + toLv + '** で登録するのね。\n');
      }
    }
    else if (-1 < acce.indexOf('オール')) {
      var toLv = parseInt(acce.replace('オール', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 29 + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の装飾品が見つかったわ！\n **ブラックオールシリーズの特性Lv' + toLv + '** で登録するのね。\n');
      }
    }
    else if (-1 < acce.indexOf('アルボール')) {
      var toLv = parseInt(acce.replace('アルボール', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 19 + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の装飾品が見つかったわ！\n **アルボールシリーズの特性Lv' + toLv + '** で登録するのね。\n');
      }
    }
    else if (-1 < acce.indexOf('アルボ')) {
      var toLv = parseInt(acce.replace('アルボ', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 19 + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の装飾品が見つかったわ！\n **アルボールシリーズの特性Lv' + toLv + '** で登録するのね。\n');
      }
    }
    else if (-1 < acce.indexOf('フェニックス')) {
      var toLv = parseInt(acce.replace('フェニックス', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 9 + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の装飾品が見つかったわ！\n **フェニックスシリーズの特性Lv' + toLv + '** で登録するのね。\n');
      }
    }
    else if (-1 < acce.indexOf('フェニ')) {
      var toLv = parseInt(acce.replace('フェニ', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 9 + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の装飾品が見つかったわ！\n **フェニックスシリーズの特性Lv' + toLv + '** で登録するのね。\n');
      }
    }
    console.log('アクセID=' + newSelection);
    if (true != (isFinite(newSelection) && 0 < newSelection)) {
      msg.channel.createMessage('<@' + msg.author.id + '> 該当の装飾品が見つからなかったわ・・・\n「アクセ エルヴン7」みたいな指定をしてみて！7の部分は平均の特性レベルを入れるのよ！\n');
      cmd = 0;
      return;
    }
  }
  else if (mode == 1 && 0 === msg.content.indexOf('武器コス ')) {
    msg.content = msg.content.replace(/[０-９]/g, function(s){
        return String.fromCharCode(s.charCodeAt(0)-0xFEE0);
    });
    msg.channel.createMessage('<@' + msg.author.id + '> 武器コスを更新するのね、私に任せて！\n');
    var buki = msg.content.replace('武器コス ', '');
    console.log(buki);
    cmd = 1;
    if (-1 < buki.indexOf('百鬼')) {
      var toLv = parseInt(buki.replace('百鬼', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = '百鬼' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **百鬼夜行シリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('百鬼夜行')) {
      var toLv = parseInt(buki.replace('百鬼夜行', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = '百鬼' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **百鬼夜行シリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('海賊')) {
      var toLv = parseInt(buki.replace('海賊', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = '海賊' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **海賊王シリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('海賊王')) {
      var toLv = parseInt(buki.replace('海賊王', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = '海賊' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **海賊王シリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('ハロウィン')) {
      var toLv = parseInt(buki.replace('ハロウィン', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 'カボ' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **ハロウィンシリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('カボチャ')) {
      var toLv = parseInt(buki.replace('カボチャ', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 'カボ' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **ハロウィンシリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('カボチ')) {
      var toLv = parseInt(buki.replace('カボチ', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 'カボ' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **ハロウィンシリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('カボ')) {
      var toLv = parseInt(buki.replace('カボ', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 'カボ' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **ハロウィンシリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('アイスエッジ')) {
      var toLv = parseInt(buki.replace('アイスエッジ', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = '氷刃' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **アイスエッジシリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('アイスエッヂ')) {
      var toLv = parseInt(buki.replace('アイスエッヂ', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = '氷刃' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **アイスエッジシリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('アイス')) {
      var toLv = parseInt(buki.replace('アイス', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = '氷刃' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **アイスエッジシリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('氷')) {
      var toLv = parseInt(buki.replace('氷', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = '氷刃' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **アイスエッジシリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('フェアリーローズ')) {
      var toLv = parseInt(buki.replace('フェアリーローズ', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = '薔薇' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **フェアリーローズシリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('フェアリー')) {
      var toLv = parseInt(buki.replace('フェアリー', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = '薔薇' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **フェアリーローズシリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('ローズ')) {
      var toLv = parseInt(buki.replace('ローズ', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = '薔薇' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **フェアリーローズシリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('薔薇')) {
      var toLv = parseInt(buki.replace('薔薇', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = '薔薇' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **フェアリーローズシリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('バレンタイン')) {
      var toLv = parseInt(buki.replace('バレンタイン', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = '薔薇' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **フェアリーローズシリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('トラベラーズ')) {
      var toLv = parseInt(buki.replace('トラベラーズ', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = '旅人' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **トラベラーズシリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('トラベラー')) {
      var toLv = parseInt(buki.replace('トラベラー', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = '旅人' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **トラベラーズシリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('旅人')) {
      var toLv = parseInt(buki.replace('旅人', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = '旅人' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **トラベラーズシリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('ブラバン')) {
      var toLv = parseInt(buki.replace('ブラバン', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = '楽団' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **ブラスバンドシリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('ブラス')) {
      var toLv = parseInt(buki.replace('ブラス', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = '楽団' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **ブラスバンドシリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('ブラスバンド')) {
      var toLv = parseInt(buki.replace('ブラスバンド', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = '楽団' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **ブラスバンドシリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('アリス')) {
      var toLv = parseInt(buki.replace('アリス', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 'ｱﾘｽ' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **アリスシリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('不思議の国')) {
      var toLv = parseInt(buki.replace('不思議の国', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 'ｱﾘｽ' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つかったわ！\n **アリスシリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    console.log('武器コスID=' + newSelection);
    if (true != ('string' == typeof newSelection && 0 < newSelection.length)) {
      msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器コスが見つからなかったわ・・・\n「武器コス 海賊5」みたいな指定をしてみて！5の部分は特性レベルを入れるのよ！\n');
      cmd = 0;
      return;
    }
    subcmd = 2;
  }
  else if (mode == 1 && 0 === msg.content.indexOf('マント ')) {
    msg.content = msg.content.replace(/[０-９]/g, function(s){
        return String.fromCharCode(s.charCodeAt(0)-0xFEE0);
    });
    msg.channel.createMessage('<@' + msg.author.id + '> マントを更新するのね、私に任せて！\n');
    var manto = msg.content.replace('マント ', '');
    console.log(manto);
    cmd = 1;
    if (-1 < manto.indexOf('高潔')) {
      var toLv = parseInt(manto.replace('高潔', '').trim());
      if (0 < toLv && 30 >= toLv) {
        newSelection = '高潔' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当のマントが見つかったわ！\n **高潔なる血のマント** ね。 **Lv' + toLv + '** で登録するわ！\n');
      }
    }
    if (-1 < manto.indexOf('高潔なる血')) {
      var toLv = parseInt(manto.replace('高潔なる血', '').trim());
      if (0 < toLv && 30 >= toLv) {
        newSelection = '高潔' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当のマントが見つかったわ！\n **高潔なる血のマント** ね。 **Lv' + toLv + '** で登録するわ！\n');
      }
    }
    if (-1 < manto.indexOf('ハギ')) {
      var toLv = parseInt(manto.replace('ハギ', '').trim());
      if (0 < toLv && 30 >= toLv) {
        newSelection = 'ハギ' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当のマントが見つかったわ！\n **ハギオスのマント** ね。 **Lv' + toLv + '** で登録するわ！\n');
      }
    }
    if (-1 < manto.indexOf('ハギオス')) {
      var toLv = parseInt(manto.replace('ハギオス', '').trim());
      if (0 < toLv && 30 >= toLv) {
        newSelection = 'ハギ' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当のマントが見つかったわ！\n **ハギオスのマント** ね。 **Lv' + toLv + '** で登録するわ！\n');
      }
    }
    if (-1 < manto.indexOf('堅守なる氷結')) {
      var toLv = parseInt(manto.replace('堅守なる氷結の', '').trim());
      if (0 < toLv && 30 >= toLv) {
        newSelection = '氷結' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当のマントが見つかったわ！\n **堅守なる氷結のマント** ね。 **Lv' + toLv + '** で登録するわ！\n');
      }
    }
    if (-1 < manto.indexOf('氷結')) {
      var toLv = parseInt(manto.replace('氷結', '').trim());
      if (0 < toLv && 30 >= toLv) {
        newSelection = '氷結' + toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当のマントが見つかったわ！\n **堅守なる氷結のマント** ね。 **Lv' + toLv + '** で登録するわ！\n');
      }
    }
    console.log('マントID=' + newSelection);
    if (true != ('string' == typeof newSelection && 0 < newSelection.length)) {
      msg.channel.createMessage('<@' + msg.author.id + '> 該当のマントが見つからなかったわ・・・\n「マント 高潔20」みたいな指定をしてみて！20の部分はマントレベルを入れるのよ！\nあと、 **冒険家のマントは戦闘力に関連しないのでツールで管理出来ない** ようにされてるみたい・・・\n');
      cmd = 0;
      return;
    }
    subcmd = 3;
  }
  else if (mode == 1 && true == (0 === msg.content.indexOf('特性 ') || 0 === msg.content.indexOf('武器特性 '))) {
    msg.content = msg.content.replace(/[０-９]/g, function(s){
        return String.fromCharCode(s.charCodeAt(0)-0xFEE0);
    });
    msg.channel.createMessage('<@' + msg.author.id + '> 武器・防具の特性を更新するのね、私に任せて！\n');
    var tokusei = msg.content.replace('特性', '');
    tokusei = tokusei.replace('武器', '');
    tokusei = tokusei.trim();
    console.log(tokusei);
    cmd = 1;
    if (-1 < tokusei.indexOf('ボス特')) {
      var toLv = parseInt(tokusei.replace('ボス特', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器が見つかったわ！\n **ボス特性武器** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 4;
      }
    }
    if (-1 < tokusei.indexOf('ボス')) {
      var toLv = parseInt(tokusei.replace('ボス', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器が見つかったわ！\n **ボス特性武器** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 4;
      }
    }
    if (-1 < tokusei.indexOf('魔物')) {
      var toLv = parseInt(tokusei.replace('魔物', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器が見つかったわ！\n **魔物特性武器** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 5;
      }
    }
    if (-1 < tokusei.indexOf('赤武器')) {
      var toLv = parseInt(tokusei.replace('赤武器', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器が見つかったわ！\n **魔物特性武器** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 5;
      }
    }
    if (-1 < tokusei.indexOf('赤背景')) {
      var toLv = parseInt(tokusei.replace('赤背景', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器が見つかったわ！\n **魔物特性武器** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 5;
      }
    }
    if (-1 < tokusei.indexOf('竜特性')) {
      var toLv = parseInt(tokusei.replace('竜特性', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器が見つかったわ！\n **竜特性武器** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 9;
      }
    }
    if (-1 < tokusei.indexOf('竜')) {
      var toLv = parseInt(tokusei.replace('竜', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器が見つかったわ！\n **竜特性武器** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 9;
      }
    }
    if (-1 < tokusei.indexOf('竜装備')) {
      var toLv = parseInt(tokusei.replace('竜装備', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器が見つかったわ！\n **竜特性武器** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 9;
      }
    }
    if (-1 < tokusei.indexOf('龍特性')) {
      var toLv = parseInt(tokusei.replace('竜特性', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器が見つかったわ！\n **竜特性武器** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 9;
      }
    }
    if (-1 < tokusei.indexOf('龍')) {
      var toLv = parseInt(tokusei.replace('龍', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器が見つかったわ！\n **竜特性武器** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 9;
      }
    }
    if (-1 < tokusei.indexOf('龍装備')) {
      var toLv = parseInt(tokusei.replace('龍装備', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器が見つかったわ！\n **竜特性武器** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 9;
      }
    }
    if (-1 < tokusei.indexOf('スイート')) {
      var toLv = parseInt(tokusei.replace('スイート', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器が見つかったわ！\n **スイート特性武器** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 8;
      }
    }
    if (-1 < tokusei.indexOf('バレンタイン')) {
      var toLv = parseInt(tokusei.replace('バレンタイン', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器が見つかったわ！\n **スイート特性武器** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 8;
      }
    }
    if (-1 < tokusei.indexOf('ポッキー')) {
      var toLv = parseInt(tokusei.replace('ポッキー', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器が見つかったわ！\n **スイート特性武器** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 8;
      }
    }
    if (-1 < tokusei.indexOf('黄色')) {
      var toLv = parseInt(tokusei.replace('黄色', '').replace('背景', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器が見つかったわ！\n **スイート特性武器** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 8;
      }
    }
    if (-1 < tokusei.indexOf('PVP防御')) {
      var toLv = parseInt(tokusei.replace('PVP防御', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の防具が見つかったわ！\n **PVP特性防具** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 6;
      }
    }
    if (-1 < tokusei.indexOf('PVP防具')) {
      var toLv = parseInt(tokusei.replace('PVP防具', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の防具が見つかったわ！\n **PVP特性防具** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 6;
      }
    }
    if (-1 < tokusei.indexOf('対人防御')) {
      var toLv = parseInt(tokusei.replace('対人防御', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の防具が見つかったわ！\n **PVP特性防具** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 6;
      }
    }
    if (-1 < tokusei.indexOf('対人防具')) {
      var toLv = parseInt(tokusei.replace('対人防具', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の防具が見つかったわ！\n **PVP特性防具** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 6;
      }
    }
    if (-1 < tokusei.indexOf('青防具')) {
      var toLv = parseInt(tokusei.replace('青防具', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の防具が見つかったわ！\n **PVP特性防具** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 6;
      }
    }
    if (-1 < tokusei.indexOf('青背景防具')) {
      var toLv = parseInt(tokusei.replace('青背景防具', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の防具が見つかったわ！\n **PVP特性防具** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 6;
      }
    }
    if (-1 < tokusei.indexOf('PVP')) {
      var toLv = parseInt(tokusei.replace('PVP', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器が見つかったわ！\n **PVP特性武器** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 7;
      }
    }
    if (-1 < tokusei.indexOf('PVP攻撃')) {
      var toLv = parseInt(tokusei.replace('PVP攻撃', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器が見つかったわ！\n **PVP特性武器** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 7;
      }
    }
    if (-1 < tokusei.indexOf('対人')) {
      var toLv = parseInt(tokusei.replace('対人', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器が見つかったわ！\n **PVP特性武器** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 7;
      }
    }
    if (-1 < tokusei.indexOf('青武器')) {
      var toLv = parseInt(tokusei.replace('青武器', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器が見つかったわ！\n **PVP特性武器** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 7;
      }
    }
    if (-1 < tokusei.indexOf('青背景')) {
      var toLv = parseInt(tokusei.replace('青背景', '').trim());
      tokusei = '';
      if (0 < toLv && 10 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器が見つかったわ！\n **PVP特性武器** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
        subcmd = 7;
      }
    }
    if (true != ('number' == typeof newSelection && 0 < newSelection)) {
      msg.channel.createMessage('<@' + msg.author.id + '> 該当の武器が見つからなかったわ・・・\n「特性 魔物10」みたいな指定をしてみて！10の部分はその武器の特性レベルを入れるのよ！\n');
      cmd = 0;
      return;
    }
  }
  else if (0 === msg.content.indexOf('レベル ')) {
    msg.content = msg.content.replace(/[０-９]/g, function(s){
        return String.fromCharCode(s.charCodeAt(0)-0xFEE0);
    });
    var level = msg.content.replace('レベル', '');
    level = level.trim();
    console.log(level);
    cmd = 1;
    var toLv = parseInt(level);
    if (0 < toLv && 9999 >= toLv) {
      newSelection = toLv;
      msg.channel.createMessage('<@' + msg.author.id + '> レベル' + strings.botMessageTails[11] + '\n **Lv' + toLv + '** ' + strings.botMessageTails[12] + '\n');
      subcmd = 10;
    }
    if (true != ('number' == typeof newSelection && 0 < newSelection)) {
      cmd = 0;
      return;
    }
  }
  else if (mode == 2 && 0 === msg.content.indexOf('精霊レベル ')) {
    msg.content = msg.content.replace(/[０-９]/g, function(s){
        return String.fromCharCode(s.charCodeAt(0)-0xFEE0);
    });
    var level = msg.content.replace('精霊レベル', '');
    level = level.trim();
    console.log(level);
    cmd = 1;
    var toLv = parseInt(level);
    if (0 < toLv && 9999 >= toLv) {
      newSelection = toLv;
      msg.channel.createMessage('<@' + msg.author.id + '> 精霊レベル' + strings.botMessageTails[11] + '\n **精霊Lv' + toLv + '** ' + strings.botMessageTails[12] + '\n');
      subcmd = 14;
    }
    if (true != ('number' == typeof newSelection && 0 < newSelection)) {
      cmd = 0;
      return;
    }
  }
  else if (mode == 2 && true == (0 === msg.content.indexOf('家門 ') || 0 === msg.content.indexOf('家紋 '))) {
    msg.content = msg.content.replace(/[０-９]/g, function(s){
        return String.fromCharCode(s.charCodeAt(0)-0xFEE0);
    });
    var subcp = msg.content.replace('家門', '');
    subcp = subcp.replace('家紋', '');
    subcp = subcp.trim();
    console.log(subcp);
    cmd = 1;
    subcp = parseInt(subcp);
    if (0 < subcp) {
      newSelection = subcp;
      msg.channel.createMessage('<@' + msg.author.id + '> 家門' + strings.botMessageTails[0] + '\n');
      subcmd = 15;
    }
    if (true != ('number' == typeof newSelection && 0 < newSelection)) {
      cmd = 0;
      return;
    }
  }
  else if (mode == 1 && 0 === msg.content.indexOf('ディフェンスゾーン ')) {
    msg.content = msg.content.replace(/[０-９]/g, function(s){
        return String.fromCharCode(s.charCodeAt(0)-0xFEE0);
    });
    var level = msg.content.replace('ディフェンスゾーン', '');
    level = level.trim();
    console.log(level);
    cmd = 1;
    var toLv = parseInt(level);
    if (0 < toLv && 10 >= toLv) {
      newSelection = toLv;
      msg.channel.createMessage('<@' + msg.author.id + '> ディフェンスゾーンのレベルを更新するのね、私に任せて！\n **Lv' + toLv + '** で登録するわ！\n');
      subcmd = 12;
    }
    if (true != ('number' == typeof newSelection && 0 < newSelection)) {
      cmd = 0;
      return;
    }
  }
  else if (mode == 1 && 0 === msg.content.indexOf('メテオ ')) {
    msg.content = msg.content.replace(/[０-９]/g, function(s){
        return String.fromCharCode(s.charCodeAt(0)-0xFEE0);
    });
    var level = msg.content.replace('メテオ', '');
    level = level.trim();
    console.log(level);
    cmd = 1;
    var toLv = parseInt(level);
    if (0 < toLv && 10 >= toLv) {
      newSelection = toLv;
      msg.channel.createMessage('<@' + msg.author.id + '> メテオのレベル' + strings.botMessageTails[11] + '\n **Lv' + toLv + '** ' + strings.botMessageTails[12] + '\n');
      subcmd = 13;
    }
    if (true != ('number' == typeof newSelection && 0 < newSelection)) {
      cmd = 0;
      return;
    }
  }
  else if (mode == 1 && true == (0 === msg.content.indexOf('転職 完了') || 0 === msg.content.indexOf('転職完了'))) {
    msg.content = msg.content.replace(/[０-９]/g, function(s){
        return String.fromCharCode(s.charCodeAt(0)-0xFEE0);
    });
    newSelection = 1;
    msg.channel.createMessage('<@' + msg.author.id + '> 3次職転職がついに完了したのね！！おめでとう！！！\n **転職済み** にデータを更新するわ！\nコレであなたも巨人の力を手に入れた必滅者となったのね・・・今後の活躍が楽しみ★');
    cmd = 1;
    subcmd = 11;
  }
  else if (0 === msg.content.indexOf('パスワード ')) {
    var password = msg.content.replace('パスワード', '');
    password = password.trim();
    var hash = null;
    if (password == '削除' || password == '解除') {
      cmd = 10;
      msg.channel.createMessage('パスワード設定を解除します。\nパスワード設定を解除するとURLを知っていれば誰でもWebからツールへアクセス可能な、最初の状態に戻ります。');
    }
    else if (4 <= password.length && msg.author.id == msg.channel.guild.ownerID) {
      cmd = 10;
      msg.channel.createMessage('新しいパスワードを設定します。\nパスワードを設定するとWebからのツールのアクセスはパスワードが無いとアクセス出来なくなります。');
      shasum.update(password);
      var hash = shasum.digest('hex');
    }
    console.log('pass=' + hash);
  }
  else if (msg.content === 'お知らせ通知') {
    msg.channel.createMessage(strings.botMessageTails[13] + '\n');
    cmd = 2;
  }
  else if (msg.content === 'お知らせ通知解除') {
    msg.channel.createMessage(strings.botMessageTails[14] + '\n');
    cmd = 3;
  }
  else if (mode == 1 && true == (0 === msg.content.indexOf('ギロチン ') || 0 === msg.content.indexOf('ザケン '))) {
    msg.content = msg.content.replace(/[０-９]/g, function(s){
        return String.fromCharCode(s.charCodeAt(0)-0xFEE0);
    });
    cmd = 6;
    var boss = '';
    var bosses = msg.content.split(' ');
    console.log(bosses);
    newSelection = parseInt(bosses[1]);
    if (!isFinite(newSelection) || 0 > newSelection) {
      // ありえない数値なので無視
      return;
    }
    subcmd = msg.author.username;
    if ('string' == typeof bosses[2] && 0 < bosses[2].length) {
      // 誰が持ってるか
      subcmd = bosses[2].trim();
    }
    if ('ギロチン' == bosses[0]) {
      boss = 'ギロチン';
      msg.channel.createMessage('**' + subcmd + ' の持ってるギロチンの欠片を ' + newSelection + ' に更新** するのね、私に任せて！\n');
    }
    else if ('ザケン' == bosses[0]) {
      boss = 'ザケン';
      msg.channel.createMessage('**' + subcmd + ' の持ってるザケンの欠片を ' + newSelection + ' に更新** するのね、私に任せて！\n');
    }
    else {
      // 存在しないボスなので無視
      return;
    }
  }
  else if (mode == 1 && true == (-1 < msg.content.indexOf('ボス石教え') || -1 < msg.content.indexOf('ボス石おしえ') || -1 < msg.content.indexOf('ボス石確認') || -1 < msg.content.indexOf('ボス石教えてにゃ'))) {
    cmd = 7;
    if (-1 < msg.content.indexOf('ボス石教えてにゃ')) {
      if ('ねーこ#5826' == (msg.author.username + '#' + msg.author.discriminator)) {
        msg.channel.createMessage('ねーこちゃんの依頼か・・・少し面倒だけどしょうがないからやるわね・・・\n登録されているボス石の数を確認したいのね・・・\n');
      }
      else {
        msg.channel.createMessage('ねーこちゃんの真似をするのは良くないと思うわ・・・聞かなかった事にするわね・・・\n');
        cmd = 0;
        return;
      }
    }
    else {
      msg.channel.createMessage('登録されているボス石の数を確認したいのね、私に任せて！\n');
    }
  }
  else if (mode == 1 && true == (-1 < msg.content.indexOf('AF') || -1 < msg.content.indexOf('アーティファクト'))) {
    if (-1 < msg.content.indexOf('計算') || -1 < msg.content.indexOf('最適') || -1 < msg.content.indexOf('教えて') || -1 < msg.content.indexOf('知りたい')) {
      msg.channel.createMessage('フレヤサーバーの @KK1116 さん、 @Lsama さんが **アーティファクト計算ツール** を作って公開してくれているわ！\n'
      + 'それを活用するのがベストよ！\nhttps://t.co/gBKX2KnG0P\n\n'
      + '**【使い方(PC)】**\nリンクを開いた後に「ファイル」 => 「コピーを作成」とやって自分専用のシートにコピーして使うのよ！\n決して作者さんに権限追加依頼を出さないように注意してね。\n\nhttps://twitter.com/KK11161/status/1132613198182436864 \n\n'
      + '**【使い方(スマホ)】**\nスマホの場合は「Googleスプレッドシート」アプリ( https://www.google.com/intl/ja_jp/sheets/about/ )\nをインストールしてからリンクを開くとアプリが起動するわ。\nメニューから「共有とエクスポート」 => 「コピーの作成」ってやるとPCと同じ事が出来るわ！\n\n'
      + '**【スマホ版シートの開き方説明動画】**\nhttps://youtu.be/xKo-PGzjALI\n*※提供のねーこちゃんありがとう♥*'
      /*+ 'アプリを入れずにどうしても直ぐに試してみたい場合は作者が用意してるコチラのリンク\nhttps://docs.google.com/spreadsheets/d/1cBqk4uM34QEhBOiqw1X2XTlh9VxnDejenYu4dKh902c/edit?usp=sharing\nを使ってみて！\n他の人が編集している場合があるし、後から他の人に見られたりするからくれぐれも注意して使ってね。\n\n'*/
      );
      return;
    }
  }
  else if (0 == msg.content.indexOf('http://127.0.0.1:3000/?clanid=') || 0 == msg.content.indexOf('http://127.0.0.1:4000/?clanid=') || 0 == msg.content.indexOf('https://' + strings.domain + '/?clanid=')) {
    cmd = 8;
    var newTopicID = msg.content;
    msg.channel.createMessage('<@' + msg.author.id + '> ' + strings.botMessageTails[15] + '\n');
  }
  else if (mode == 1 && -1 < msg.content.indexOf('エリカ様今日悲しいことあった')) {
    if ('エリカ様の血盟管理お手伝い' == strings.botname) {
      var randnum = 1 + Math.floor( Math.random() * 100 );
      if (randnum > 40 && randnum < 70) {
        msg.channel.createMessage(msg.author.username + 'ちゃん、諦めないで頑張ろ！！');
        return;
      }
      if (randnum > 10 && randnum < 40) {
        msg.channel.createMessage(msg.author.username + 'ちゃんの泣き言なんて聞きたくないっ！！');
        return;
      }
      msg.channel.createMessage(msg.author.username + 'ちゃん、よしよし');
      cmd = 0;
      return;
    }
  }
  else if (mode == 1 && -1 < msg.content.indexOf('エルゼベート様今日悲しいことあった')) {
    if ('エルゼベート様の血盟管理お手伝い' == strings.botname) {
      var randnum = 1 + Math.floor( Math.random() * 100 );
      if (randnum > 40 && randnum < 70) {
        msg.channel.createMessage('あら、燃やして上げましょうか？楽になるわよ？♥');
        return;
      }
      if (randnum > 10 && randnum < 40) {
        msg.channel.createMessage('あんたの泣き言なんて聞きたくないのよ。そう言うことはエリカにでも言ってみたら？');
        return;
      }
      msg.channel.createMessage('テオドールー！慰めてあげたらー？？あたしはパーーース');
      cmd = 0;
      return;
    }
  }
  else if (mode == 1 && true == (-1 < msg.content.indexOf('エリカ様だいすき') || -1 < msg.content.indexOf('エリカ様大好き') || -1 < msg.content.indexOf('エリカ様好き') || -1 < msg.content.indexOf('エリカ様すき'))) {
    if ('エリカ様の血盟管理お手伝い' ==  strings.botname) {
      var randnum = 1 + Math.floor( Math.random() * 100 );
      if (randnum > 40 && randnum < 70) {
        msg.channel.createMessage(msg.author.username + 'ちゃん・・・ちょっとキモいわ・・・');
        return;
      }
      if (randnum > 10 && randnum < 40) {
        msg.channel.createMessage(msg.author.username + 'ちゃん♥エリカスゴくウレシイ♥♥');
        return;
      }
      msg.channel.createMessage(msg.author.username + 'ちゃん私もっ♥');
      msg.channel.createMessage('もし良かったら・・・作者に寄付して上げて★\n寄付はここから出来るわ♥\nhttps://' + strings.domain + '/#donation');
      cmd = 0;
      return;
    }
  }
  else if (mode == 1 && true == (-1 < msg.content.indexOf('エルゼベート様だいすき') || -1 < msg.content.indexOf('エルゼベート様大好き') || -1 < msg.content.indexOf('エルゼベート様好き') || -1 < msg.content.indexOf('エルゼベート様すき'))) {
    if ('エルゼベート様の血盟管理お手伝い' == strings.botname) {
      var randnum = 1 + Math.floor( Math.random() * 100 );
      if (randnum > 40 && randnum < 70) {
        msg.channel.createMessage('普通に・・・キモいわね。燃やすわよ？');
        return;
      }
      if (randnum > 10 && randnum < 40) {
        msg.channel.createMessage(msg.author.username + 'ちゃん♥エリカスゴくウレシイ♥♥ ・・・ってエリカならいいそうね。頭に花咲いてるのかしら。');
        return;
      }
      msg.channel.createMessage('その気があるなら作者に寄付でもしてあげたら？\nテオドールはバカだから寄付してたわよ♥\nhttps://' + strings.domain + '/#donation');
      cmd = 0;
      return;
    }
  }
  else if (mode == 1 && true == (-1 < msg.content.indexOf('エリカ様お疲れ') || -1 < msg.content.indexOf('エリカ様おつかれ') || -1 < msg.content.indexOf('エリカさまお疲れ') || -1 < msg.content.indexOf('エリカさまおつかれ'))) {
    if ('エリカ様の血盟管理お手伝い' == strings.botname) {
      msg.channel.createMessage('あら！ありがとうーー♪嬉しいわー！\n私へのお給料の振込はここから出来るわ♥\nhttps://' + strings.domain + '/#donation');
      cmd = 0;
      return;
    }
  }
  else if (-1 < msg.content.indexOf(strings.metaname) && true == (-1 < msg.content.indexOf('ヘルプ') || -1 < msg.content.indexOf('パンツ') || -1 < msg.content.indexOf('助け') || -1 < msg.content.indexOf('おしえ') || -1 < msg.content.indexOf('たすけ') || -1 < msg.content.indexOf('教え'))) {
    var cmdMsg = strings.botMessageTails[16] + '\n\n戦闘力の更新 **[1012543]**\nレベルの更新 **[レベル 1〜9999]**\n';
    if (mode == 1) {
      cmdMsg = cmdMsg + 'メテオレベルの更新 **[メテオ 1〜10]**\n';
      cmdMsg = cmdMsg + 'ディフェンスゾーンレベルの更新 **[ディフェンスゾーン 1〜10]**\n';
      cmdMsg = cmdMsg + '3次職転職完了状態の更新 **[転職完了] [転職 完了]**\n';
    }
    cmdMsg = cmdMsg+ '予定への参加登録 **[参加] [参加 聞き専(or 可能・不可)] [参加△ コメント] [不参加]**\n';
    cmdMsg = cmdMsg+ '予定参加者の確認 **[確認] [確認△]**\n';
    if (mode == 1) {
      cmdMsg = cmdMsg + 'アクセの登録 **[アクセ カラ 1〜10]**\n';
      cmdMsg = cmdMsg + '武器コスの登録 **[武器コス 海賊 1〜10]**\n';
      cmdMsg = cmdMsg + 'マントの登録 **[マント 高潔 1〜30]**\n';
      cmdMsg = cmdMsg + 'PVP特性武器の登録 **[特性 対人 1〜10]**\n';
      cmdMsg = cmdMsg + 'PVP特性防具の登録 **[特性 対人防具 1〜10]**\n';
      cmdMsg = cmdMsg + 'スイート特性武器の登録 **[特性 スイート 1〜10]**\n';
      cmdMsg = cmdMsg + '魔物特性武器の登録 **[特性 魔物 1〜10]**\n';
      cmdMsg = cmdMsg + '竜特性武器の登録 **[特性 竜 1〜10]**\n';
      cmdMsg = cmdMsg + 'ボス特性武器の登録 **[特性 ボス 1〜10]**\n';
      cmdMsg = cmdMsg + 'ボス石の欠片所持数の登録 **[ギロチン 120] [ザケン 120] [ギロチン 60 他の誰かの名前] [ザケン 0 使用した人の名前]**\n';
      cmdMsg = cmdMsg + 'ボス石の欠片所持数の確認 **[ボス石確認]**\n';
    }
    else if (mode == 2) {
      cmdMsg = cmdMsg + '精霊レベルの更新 **[精霊レベル 1〜9999]**\n';
    }
    cmdMsg = cmdMsg+ 'お知らせの自動通知 **[お知らせ通知]**\n';
    cmdMsg = cmdMsg+ 'お知らせ自動通知の解除 **[お知らせ通知解除]**\n';
    if (mode == 1) {
      cmdMsg = cmdMsg + 'アーティファクト自動編成ツールの使い方のヘルプ **[AF最適化] [AF教えて] [アーティファクト計算]**\n';
    }
    cmdMsg = cmdMsg + '\n' + strings.botMessageTails[17];
    msg.channel.createMessage(cmdMsg);
    if (mode == 1 && 'ジン#2696' == (msg.author.username + '#' + msg.author.discriminator)) {
      msg.channel.createMessage('ゴメンナサイ・・・植毛は絶望的だわ・・・\n');
    }
    cmd = 0;
    return;
  }
  if (mode == 1 && 'ジン#2696' == (msg.author.username + '#' + msg.author.discriminator)) {
    var randnum = 1 + Math.floor( Math.random() * 100 );
    if (randnum > 40 && randnum < 50) {
      msg.channel.createMessage('ハゲマスって・・・コレじゃただの冷やかしよね・・・\n');
      return;
    }
    if (randnum > 30 && randnum < 40) {
      msg.channel.createMessage('また抜け毛が落ちてたわ・・・\n');
      return;
    }
  }
  else if ('ねーこ#5826' == (msg.author.username + '#' + msg.author.discriminator)) {
    if (0 > msg.content.indexOf('にゃ')) {
      msg.channel.createMessage(strings.botMessageTails[18]);
      cmd = 0;
      return;
    }
    if (mode == 2 && -1 < msg.content.indexOf('ぼんちゃん') && true == (-1 < msg.content.indexOf('かっこいい') || -1 < msg.content.indexOf('カッコイイ') || -1 < msg.content.indexOf('カッコいい'))) {
      var randnum = 1 + Math.floor( Math.random() * 100 );
      if (randnum > 10) {
        msg.channel.createMessage('ぼんちゃんは世界一！\n(ねーこ後でスシね！)');
        cmd = 0;
        return;
      }
      if (randnum <= 10) {
        msg.channel.createMessage('BOMBER is a perfect human.\n(ねーこ後でステーキね！)');
        cmd = 0;
        return;
      }
    }
  }
  else if (mode == 2 && 'ナレノハテ明美 蒼炎#6358' == msg.author.username + '#' + msg.author.discriminator && true == (-1 < msg.content.indexOf('ハァハァ') || -1 < msg.content.indexOf('ハアハア'))) {
    var randnum = 1 + Math.floor( Math.random() * 100 );
    if (randnum > 40 && randnum < 90) {
      msg.channel.createMessage('やるならやらしく行こうぜ・・・？ ハァハァ');
    }
  }
  else if (mode == 2 && 0 < cmd && 'へーじ#0698' == (msg.author.username + '#' + msg.author.discriminator)) {
    var randnum = 1 + Math.floor( Math.random() * 100 );
    if (randnum > 70 && randnum <= 80) {
      msg.channel.createMessage('<@' + msg.author.id + '> せやかて工藤、ワイが手伝えるんはココまでやで？');
    }
    else if (randnum > 80 && randnum <= 90) {
      msg.channel.createMessage('<@' + msg.author.id + '> そいがっさい工藤、おいがさるっとば、こしこしかなかとぜ？');
    }
  }
  if (0 == cmd) {
    return;
  }
  else {
    if ('string' == typeof newTopicID || true == ('string' == typeof msg.channel.topic && -1 < msg.channel.topic.indexOf('clanid='))) {
      var clanID = null;
      var scheduleID = null;
      if ('string' == typeof newTopicID) {
        var splitTopics = new URL(newTopicID);
        clanID = splitTopics.searchParams.get('clanid');
        var _scheduleID = splitTopics.searchParams.get('scheduleid');
        if (_scheduleID) {
          scheduleID = _scheduleID;
          // コマンドを上位コマンドに改定
          cmd = 9;
        }
      }
      else {
        clanID = msg.channel.topic.replace('clanid=', '').replace("\r", '').replace("\n", '').replace("&", '');
        if (-1 < clanID.indexOf('scheduleid=')) {
          var splited = clanID.split('scheduleid=');
          clanID = splited[0];
          scheduleID = splited[1];
        }
      }
      console.log('clanID:[' + clanID + ']');
      console.log('scheduleID:[' + scheduleID + ']');
      // CP更新
      var who = msg.author.username
      var whoDiscord = msg.author.username + '#' + msg.author.discriminator;
      console.log('cp up from ' + who + ' & ' + whoDiscord);
      // firbase問い合わせ
      firestore.collection("clans").doc(clanID).get().then(function(snapshot){
        console.log('snapshot=');
        console.log(snapshot.exists);
        if(snapshot.exists) {
          var clan = snapshot.data();
          console.log('clan=');
          console.log(clan);
          // 血盟名が取れていればOK
          if ('undefined' != typeof clan.name && 0 < clan.name.length) {
            console.log('clan exists!');
            msg.channel.createMessage('<@' + msg.author.id + '> ' + strings.botMessageTails[19] + '\n***' + clan.name + '*** ' + strings.botMessageTails[20] + '\n');
            if (1 == cmd || 4 == cmd || 5 == cmd || 8 == cmd || 9 == cmd) {
              // 血盟員の一覧を取得し、更新対象を特定する
              firestore.collection("users").where('clanid', '==', clanID).where('activity', '>', -9).get().then(function(querySnapshot) {
                var targetUserID = null;
                var targetUser = false;
                var targetUsers = [];
                var incount = 0;
                var currentcp = 0;
                var cpmargin = 0;
                querySnapshot.forEach(function(snapshot) {
                  if(snapshot.exists && false === targetUser) {
                    var user = snapshot.data();
                    if (5 == cmd) {
                      user.ID = snapshot.id;
                      user.out = true;
                      targetUsers.push(user);
                    }
                    else if (-1 < user.name.indexOf(who) || true === ('undefined' != typeof user.discord && -1 < user.discord.indexOf(who + '#'))) {
                      console.log('user exists!');
                      msg.channel.createMessage('<@' + msg.author.id + '> ' + strings.botMessageTails[21] + '\n***' + user.name + '*** ' + strings.botMessageTails[20] + '\n');
                      targetUser = user;
                      // CP更新
                      targetUserID = snapshot.id;
                      if (1 == cmd) {
                        if (0 < newcp) {
                          currentcp = targetUser.cp;
                          cpmargin = newcp - targetUser.cp;
                          targetUser.cp = newcp;
                        }
                        if (1 == subcmd && 0 < newSelection) {
                          targetUser.acce1 = newSelection;
                        }
                        if (21 == subcmd && 0 < newSelection) {
                          targetUser.acce2 = newSelection;
                        }
                        if (2 == subcmd && 'string' == typeof newSelection && 0 < newSelection.length) {
                          targetUser.bukicos = newSelection;
                        }
                        if (3 == subcmd && 'string' == typeof newSelection && 0 < newSelection.length) {
                          targetUser.manto = newSelection;
                        }
                        if (4 == subcmd && 'number' == typeof newSelection && 0 < newSelection) {
                          targetUser.boss = newSelection;
                        }
                        if (5 == subcmd && 'number' == typeof newSelection && 0 < newSelection) {
                          targetUser.mamono = newSelection;
                        }
                        if (6 == subcmd && 'number' == typeof newSelection && 0 < newSelection) {
                          targetUser.pvpdf = newSelection;
                        }
                        if (7 == subcmd && 'number' == typeof newSelection && 0 < newSelection) {
                          targetUser.pvpat = newSelection;
                        }
                        if (8 == subcmd && 'number' == typeof newSelection && 0 < newSelection) {
                          targetUser.sweet = newSelection;
                        }
                        if (9 == subcmd && 'number' == typeof newSelection && 0 < newSelection) {
                          targetUser.dragon = newSelection;
                        }
                        if (10 == subcmd && 'number' == typeof newSelection && 0 < newSelection) {
                          targetUser.level = newSelection;
                        }
                        if (11 == subcmd && 'number' == typeof newSelection && 0 < newSelection) {
                          targetUser.job3d = newSelection;
                        }
                        if (12 == subcmd && 'number' == typeof newSelection && 0 < newSelection) {
                          targetUser.dzone = newSelection;
                        }
                        if (13 == subcmd && 'number' == typeof newSelection && 0 < newSelection) {
                          targetUser.meteo = newSelection;
                        }
                        if (14 == subcmd && 'number' == typeof newSelection && 0 < newSelection) {
                          targetUser.spiritlevel = newSelection;
                        }
                        if (15 == subcmd && 'number' == typeof newSelection && 0 < newSelection) {
                          targetUser.subcp = newSelection;
                        }
                      }
                      return;
                    }
                  }
                });
                if (5 != cmd && false === targetUser) {
                  msg.channel.createMessage('<@' + msg.author.id + '> ' + strings.botMessageTails[22] + strings.domain + '/?clanid=' + clanID + strings.botMessageTails[23] + whoDiscord + strings.botMessageTails[24]);
                  return;
                }
                if (1 == cmd) {
                  targetUser.modified = new Date();
                  firestore.collection("users").doc(targetUserID).update(targetUser).then(function(snapshot) {
                    msg.channel.createMessage('<@' + msg.author.id + '> ' + strings.botMessageTails[25] + '\n' + targetUser.name + ': https://' + strings.domain + '/?clanid=' + clanID + '&userid=' + targetUserID + '&view=on#modifyuser\n');
                    if (mode == 1 && 0 < cpmargin) {
                      var randnum = 1 + Math.floor( Math.random() * 100 );
                      var marginTxt = '';
                      if (100000 <= cpmargin) {
                        if ('えりち#6210' == (msg.author.username + '#' + msg.author.discriminator)) {
                          marginTxt = '***強い！可愛い！エリーチカ！！ハラショー！！！***\n';
                        }
                        else {
                          marginTxt = '***頑張り過ぎじゃない！？ホントに大丈夫なの！！？***\n';
                        }
                      }
                      else if (50000 <= cpmargin) {
                        if ('えりち#6210' == (msg.author.username + '#' + msg.author.discriminator)) {
                          marginTxt = '**ハラショー！！とてつもない成長よ！！！**\n';
                        }
                        else {
                          marginTxt = '**とてつもない成長よ！**\n';
                        }
                      }
                      else if (20000 <= cpmargin) {
                        marginTxt = '**凄い成長してるわ！**\n';
                        if ('えりち#6210' == (msg.author.username + '#' + msg.author.discriminator)) {
                          marginTxt = '**ホンマに上がったんかな？嘘やったらワシワシMAXやで〜？**\n';
                        }
                      }
                      else if (5000 <= cpmargin) {
                        if ('えりち#6210' == (msg.author.username + '#' + msg.author.discriminator)) {
                          marginTxt = '**にっこにっこにー♪ **\n';
                        }
                        marginTxt = '**順調に成長してて偉いわね！**\n';
                      }
                      if ('エリカ様の血盟管理お手伝い' ==  msg.author.username) {
                        if (3000000 < newcp) {
                          if (3000000 > currentcp) {
                            msg.channel.createMessage('<@' + msg.author.id + '> ' + marginTxt + 'ついに異次元の強さだわ・・・\n本当におめでとう。もうエリカから教えられる事は何も無いわ！貴方が正しいと思う道を行くのが正解よ！エリカはずっと応援してるわ★\n');
                          }
                        }
                        else if (2500000 < newcp) {
                          if (randnum > 0 && randnum <= 25) {
                            msg.channel.createMessage('<@' + msg.author.id + '> ' + marginTxt + '凄いわ・・・ここまで来てしまうなんて！！\nいよいよLRソウルストーンが必要な時よ！先ずは攻撃のLRソウルストーン、その後は防御のLRが簡単よ！\n全身LRソウルストーンになるころにはきっとまたスゴく強くなってるハズよ！頑張って！！\n');
                          }
                          else if (randnum > 25 && randnum <= 50) {
                            msg.channel.createMessage('<@' + msg.author.id + '> ' + marginTxt + '凄いわ・・・ここまで来てしまうなんて！！\n兎に角装備実績を積みましょう。25万は欲しいところね・・・全ての武器と1種類のアクセサリーオールコンプリートでそのくらいよ！\n先は長いけどここまで来たなら頑張りましょう！！\n');
                          }
                          else if (randnum > 50 && randnum <= 75) {
                            msg.channel.createMessage('<@' + msg.author.id + '> ' + marginTxt + '250万オーバー！？分かってる、異世界のアデナを使ったのね。凄いわ・・・\n兎に角装備実績を積みましょう。\n武器の装備実績を終わらせる頃にはきっとまたスゴく強くなってるハズよ！頑張って！！\n');
                          }
                          else if (randnum > 75 && randnum <= 100) {
                            msg.channel.createMessage('<@' + msg.author.id + '> ' + marginTxt + '250万オーバー！？分かってる、異世界のアデナを使ったのね。凄いわ・・・\nココからはMAXセットを目指しましょう！全身が終わったら次は赤防具か2種目の装飾品がいいんじゃないかしら。\nでも正直もうエリカには分からない世界だわ・・・\n');
                          }
                          return;
                        }
                        else if (2000000 < newcp) {
                          if (randnum > 0 && randnum <= 25) {
                            msg.channel.createMessage('<@' + msg.author.id + '> ' + marginTxt + 'いよいよ200万オーバーなのね！凄い頑張ってるわ！\nこれからは装備実績も積み上げて行かないと行けないわね。\nイベントショップでアデナで買える選択祝福はオススメよ！毎週買って貯めるといいわよ！\n');
                          }
                          else if (randnum > 25 && randnum <= 50) {
                            msg.channel.createMessage('<@' + msg.author.id + '> ' + marginTxt + 'いよいよ200万オーバーなのね！凄い頑張ってるわ！\nココからは強化セットも狙っていかないと中々上がらないわ・・・\nでも慎重に！**くれぐれもマーブル無しでなんてやらないでね！エリカからのお願いよ・・・！**\n');
                          }
                          else if (randnum > 50 && randnum <= 75) {
                            msg.channel.createMessage('<@' + msg.author.id + '> ' + marginTxt + 'もうココまで来てるのね、凄いわ！\nとにかくエリクサーがまだなら終わらせましょう！\n要塞ショップは欠かさず買うのよ！！エリクサーエッセンス選択ボックスももちろん毎日買うのよ！！\n');
                          }
                          else if (randnum > 75 && randnum <= 100) {
                            msg.channel.createMessage('<@' + msg.author.id + '> ' + marginTxt + 'もうココまで来てるのね、凄いわ！\n200万から先は修羅の道よ・・・防御クリスタルが足りない時はHRの分解も視野に入れてみて。\nどーしても直ぐに欲しい時は・・・悔しいけどネトマの力に頼るしか無いわね・・・\n');
                          }
                          return;
                        }
                        else if (1500000 < newcp) {
                          if (randnum > 0 && randnum <= 25) {
                            msg.channel.createMessage('<@' + msg.author.id + '> ' + marginTxt + '順調に強くなっているわ！\nてっとり速くMAX装備が欲しくなるけど慎重にね・・・\n**マーブル無しで打つのだけはダメ、絶対！エリカと約束！！**\n');
                          }
                          else if (randnum > 25 && randnum <= 50) {
                            msg.channel.createMessage('<@' + msg.author.id + '> ' + marginTxt + '順調に強くなっているわ！\nLR装備を揃え始める時期だわ。先ずはエリート武器、その次に青武器が私のオススメよ！\nペニーワイズの言うことを信じちゃダメよ！\nサン★フレアは信じちゃったみたいだけど・・・\n');
                          }
                          else if (randnum > 50 && randnum <= 75) {
                            msg.channel.createMessage('<@' + msg.author.id + '> ' + marginTxt + 'いい感じに成長してるわね！\nレベル250でURエリクサーが開放されるわ！\nURエリクサーはトータル1200万アデナも使うけど、戦闘力が8万近く上がるから絶対に見逃さないでね★\n');
                          }
                          else if (randnum > 75 && randnum <= 100) {
                            msg.channel.createMessage('<@' + msg.author.id + '> ' + marginTxt + 'いい感じに成長してるわね！\n戦闘力を上げるには装備の超越も重要よ！日々小まめに合成を行うのよ！！\nそしたら功績だって達成出来るんだから★\n');
                          }
                          return;
                        }
                        else {
                          if (randnum > 0 && randnum <= 25) {
                            msg.channel.createMessage('<@' + msg.author.id + '> ' + marginTxt + 'まだ駆け出しの段階ね！\n今は装備を揃えることとモンスターコアをコンプする事が重要よ！\n頑張ってね★\n');
                          }
                          else if (randnum > 25 && randnum <= 50) {
                            msg.channel.createMessage('<@' + msg.author.id + '> ' + marginTxt + 'まだ駆け出しの段階ね！\n決闘は面倒でも欠かさずやっておいた方がいい日課よ。\n名誉ランクで上がる戦闘力は馬鹿にならないのよ★\n');
                          }
                          else if (randnum > 50 && randnum <= 75) {
                            msg.channel.createMessage('<@' + msg.author.id + '> ' + marginTxt + '順調に成長してるわね。\nレベル上げと同時にルーンのレベルも上げていくといいわ！\nルーンはアデナを大量に使うから、しっかりアデナを貯めて置くことも大事よ★\n');
                          }
                          else if (randnum > 75 && randnum <= 100) {
                            msg.channel.createMessage('<@' + msg.author.id + '> ' + marginTxt + '順調に成長してるわね。\n戦闘力を上げるには装備の超越も重要よ！日々小まめに合成を行うのよ！！\nそしたら功績だって達成出来るんだから★\n');
                          }
                          return;
                        }
                      }
                    }
                    else if (0 > cpmargin) {
                      msg.channel.createMessage('<@' + msg.author.id + '> ' + strings.botMessageTails[26] + '\n');
                    }
                    return;
                  }).catch(function(error) {
                    console.error("Error modify user: ", error);
                    msg.channel.createMessage(strings.systemErrorMessageTail + '\n');
                  });
                }
                if (8 == cmd) {
                  msg.channel.edit({topic: 'clanid=' + clanID }).then(function(){
                    msg.channel.createMessage('<@' + msg.author.id + '> ' + strings.botMessageTails[27] + '\n');
                    return;
                  }).catch(function(error) {
                    console.error("Error topic edit 8 error: ", error);
                    if ('object' == typeof error && -1 < error.toString().indexOf('Missing Permissions')) {
                      msg.channel.createMessage('<@' + msg.author.id + '> ' + strings.botMessageTails[28] + '\n');
                    }
                    else {
                      console.error("Error read schedule users: ", error);
                      msg.channel.createMessage(strings.systemErrorMessageTail + '\n');
                    }
                    return;
                  });
                  return;
                }
                else if (4 == cmd || 5 == cmd || 9 == cmd) {
                  if (null === scheduleID) {
                    msg.channel.createMessage(strings.botMessageTails[29] + clanID + strings.botMessageTails[30] + '\n'
                    + '設定する値は予定ページのURL「 https://' + strings.domain + '/?clanid=**貴方のclnaID**&scheduleid=**連携したい予定のscheduleID**#detailschedule 」' + strings.botMessageTails[31] + '\n');
                    return;
                  }
                  // firbase問い合わせ
                  firestore.collection("schedules").doc(scheduleID).get().then(function(snapshot){
                    console.log('snapshot=');
                    console.log(snapshot.exists);
                    var targetSchedule = false;
                    if(snapshot.exists) {
                      targetSchedule = snapshot.data();
                      var dateLabel = '';
                      if ('undefined' != typeof targetSchedule.date) {
                        var _date = targetSchedule.date.toDate();
                        dateLabel = _date.toFormat("YYYY/MM/DD HH24:MI");
                      }
                      console.log('targetSchedule=');
                      console.log(targetSchedule);
                      incount = targetSchedule.incount;
                      msg.channel.createMessage('<@' + msg.author.id + '> ' + strings.botMessageTails[32] + '\n**' + dateLabel + 'に予定さてる「' + targetSchedule.name + '」**' + strings.botMessageTails[20] + '\n現在 **' + incount + strings.botMessageTails[33] + '\n');
                      if (9 == cmd) {
                        msg.channel.edit({topic: 'clanid=' + clanID + '&scheduleid=' + scheduleID }).then(function(){
                          msg.channel.createMessage('<@' + msg.author.id + '> ' + strings.botMessageTails[34] + '\n');
                          return;
                        }).catch(function(error) {
                          console.error("Error topic edit 8 error: ", error);
                          if ('object' == typeof error && -1 < error.toString().indexOf('Missing Permissions')) {
                            msg.channel.createMessage('<@' + msg.author.id + '> ' + strings.botMessageTails[28] + '\n');
                          }
                          else {
                            console.error("Error read schedule users: ", error);
                            msg.channel.createMessage(strings.systemErrorMessageTail + '\n');
                          }
                          return;
                        });
                        return;
                      }
                      if (5 == cmd) {
                        console.log('targetUsers=');
                        console.log(targetUsers);
                        firestore.collection('schedules').doc(scheduleID).collection('users').get().then(function(querySnapshot){
                          querySnapshot.forEach(function(snapshot) {
                            if(snapshot.exists) {
                              var data = snapshot.data();
                              for (var suidx=0; suidx < targetUsers.length; suidx++) {
                                if (targetUsers[suidx].name == data.name){
                                  if (true != (data.comment == '同一タグの前回のPT編成をコピー' && 0 == data.entry)) {
                                    targetUsers[suidx].out = false;
                                  }
                                  targetUsers[suidx].entry = data.entry;
                                  if ('string' == typeof data.comment) {
                                    targetUsers[suidx].comment = data.comment;
                                  }
                                  if (-1 < data.entry) {
                                    incount++;
                                  }
                                }
                              }
                            }
                          });
                          var mybeUsers = '';
                          var outUsers = '';
                          for (var suidx=0; suidx < targetUsers.length; suidx++) {
                            if (true === targetUsers[suidx].out && targetUsers[suidx].activity > -1) {
                              outUsers = outUsers + targetUsers[suidx].name;
                              var botUser = bot.users.find(function(element) {
                                if ('string' == typeof targetUsers[suidx].discord && 0 < targetUsers[suidx].discord.length && targetUsers[suidx].discord == element.username + '#' + element.discriminator) {
                                  return true;
                                }
                                else if (targetUsers[suidx].name == element.username) {
                                  return true;
                                }
                                return false;
                              });
                              if (botUser) {
                                outUsers = outUsers + ' (<@' + botUser.id + '>)';
                              }
                              outUsers = outUsers + '\n';
                            }
                            else if (2 == subcmd && 0 === targetUsers[suidx].entry && targetUsers[suidx].activity > -1 && targetUsers[suidx].comment != '同一タグの前回のPT編成をコピー') {
                              mybeUsers = mybeUsers + targetUsers[suidx].name;
                              var botUser = bot.users.find(function(element) {
                                if ('string' == typeof targetUsers[suidx].discord && 0 < targetUsers[suidx].discord.length && targetUsers[suidx].discord == element.username + '#' + element.discriminator) {
                                  return true;
                                }
                                else if (targetUsers[suidx].name == element.username) {
                                  return true;
                                }
                                return false;
                              });
                              if (botUser) {
                                mybeUsers = mybeUsers + ' (<@' + botUser.id + '>)';
                              }
                              mybeUsers = mybeUsers + '\n';
                            }
                          }
                          if (2 == subcmd) {
                            console.log('mybeUsers=');
                            console.log(mybeUsers);
                            if (0 < mybeUsers.length) {
                              msg.channel.createMessage(strings.botMessageTails[35] + '\n\n' + mybeUsers + '\n\n');
                            }
                            else {
                              msg.channel.createMessage(strings.botMessageTails[36] + '\n\n');
                            }
                          }
                          console.log('outUsers=');
                          console.log(outUsers);
                          if (0 < outUsers.length) {
                            msg.channel.createMessage(strings.botMessageTails[37] + '\n\n' + outUsers + '\n予定への登録は「 https://' + strings.domain + '/?clanid=' + clanID + '&scheduleid=' + scheduleID + '&view=on#detailschedule 」から' + strings.botMessageTails[38]);
                          }
                          else {
                            msg.channel.createMessage(strings.botMessageTails[39] + '\n\n予定への登録は「 https://' + strings.domain + '/?clanid=' + clanID + '&scheduleid=' + scheduleID + '&view=on#detailschedule 」から' + strings.botMessageTails[38]);
                          }
                          return;
                        }).catch(function(error) {
                          console.error("Error read schedule users: ", error);
                          msg.channel.createMessage(strings.systemErrorMessageTail + '\n');
                          return;
                        });
                      }
                      else {
                        firestore.collection("schedules").doc(scheduleID).collection("users").doc(targetUserID).get().then(function(snapshot){
                          console.log('snapshot=');
                          console.log(snapshot.exists);
                          if(snapshot.exists) {
                            var targetScheduleUser = snapshot.data();
                            targetUser.status = 0;
                            targetUser.party = 0;
                            if ('undefined' != typeof targetScheduleUser.status) {
                              targetUser.status = targetScheduleUser.status;
                            }
                            if ('undefined' != typeof targetScheduleUser.party) {
                              targetUser.party = targetScheduleUser.party;
                            }
                            console.log(targetScheduleUser);
                            if (-1 === subcmd && -1 < targetScheduleUser.entry && 0 < incount) {
                              // 不参加に変更
                              incount--;
                              console.log('dec1');
                            }
                            else if (-1 < subcmd && 0 > targetScheduleUser.entry){
                              incount++;
                              console.log('inc1');
                            }
                          }
                          else {
                            targetUser.status = 0;
                            targetUser.party = 0;
                            if (-1 < subcmd) {
                              incount++;
                              console.log('inc2');
                            }
                          }
                          // 予定に追加
                          targetUser.ID = targetUserID;
                          targetUser.entry = subcmd;
                          targetUser.voice = newSelection;
                          var subMSg = '参加';
                          if (1 > subcmd) {
                            if (-1 === subcmd) {
                              subMSg = '不参加';
                            }
                            else {
                              subMSg = 'たぶん参加';
                            }
                            targetUser.status = 0;
                            targetUser.party = 0;
                            targetUser.voice = 0;
                          }
                          if (null !== commnet) {
                            targetUser.comment = commnet;
                          }
                          if ('string' == typeof targetUser.comment && targetUser.comment == '同一タグの前回のPT編成をコピー') {
                            targetUser.comment = '';
                          }
                          firestore.collection("schedules").doc(scheduleID).collection("users").doc(targetUser.ID).set(targetUser).then(function() {
                            targetSchedule.incount = incount;
                            console.log(targetSchedule);
                            firestore.collection("schedules").doc(scheduleID).set(targetSchedule).then(function(snapshot) {
                              msg.channel.createMessage('**' + subMSg + strings.botMessageTails[40] + '\n' + targetUser.name + ': https://' + strings.domain + '/?clanid=' + clanID + '&scheduleid=' + scheduleID + '&view=on#detailschedule\n');
                              return;
                            }).catch(function(error) {
                              console.error("Error modify schedule: ", error);
                              msg.channel.createMessage(strings.systemErrorMessageTail + '\n');
                            });
                            return;
                          }).catch(function(error) {
                            console.error("Error modify schedule user: ", error);
                            msg.channel.createMessage(strings.systemErrorMessageTail + '\n');
                          });
                          return;
                        }).catch(function(error) {
                          console.error("Error read schedule user: ", error);
                          msg.channel.createMessage(strings.systemErrorMessageTail + '\n');
                        });
                      }
                    }
                    if (false === targetSchedule) {
                      msg.channel.createMessage(strings.botMessageTails[29] + clanID + strings.botMessageTails[30] + '\n'
                      + '設定する値は予定ページのURL「 https://' + strings.domain + '/?clanid=**貴方のclnaID**&scheduleid=**連携したい予定のscheduleID**#detailschedule 」' + strings.botMessageTails[31] + '\n');
                      return;
                    }
                  }).catch(function(error) {
                    console.error("Error read schedule: ", error);
                    msg.channel.createMessage(strings.botMessageTails[29] + clanID + strings.botMessageTails[30] + '\n'
                    + '設定する値は予定ページのURL「 https://' + strings.domain + '/?clanid=**貴方のclnaID**&scheduleid=**連携したい予定のscheduleID**#detailschedule 」' + strings.botMessageTails[31] + '\n');
                    return;
                  });
                }
                return;
              }).catch(function(error) {
                console.error("Error read user: ", error);
                msg.channel.createMessage('<@' + msg.author.id + '> ' + strings.botMessageTails[22] + strings.domain + '/?clanid=' + clanID + strings.botMessageTails[23] + whoDiscord + strings.botMessageTails[24]);
              });
            }
            else if (2 == cmd) {
              if (true != ('string' == typeof clan.discordhookid && 'string' == typeof clan.discordhooktoken && 0 < clan.discordhookid.length && 0 < clan.discordhooktoken.length)) {
                msg.channel.createMessage(strings.botMessageTails[41]);
                return;
              }
              if ('undefined' == typeof clan.useInfoJob || true !== clan.useInfoJob) {
                clan.useInfoJob = true;
                firestore.collection("clans").doc(clanID).set(clan).then(function(snapshot) {
                  msg.channel.createMessage(strings.botMessageTails[42] + '\n');
                  infojob(clanID);
                  return;
                }).catch(function(error) {
                  console.error("Error modify clan: ", error);
                  msg.channel.createMessage(strings.systemErrorMessageTail + '\n');
                });
                return;
              }
              msg.channel.createMessage(strings.botMessageTails[43] + '\n');
              infojob(clanID);
              return;
            }
            else if (3 == cmd) {
              clan.useInfoJob = false;
              firestore.collection("clans").doc(clanID).set(clan).then(function(snapshot) {
                msg.channel.createMessage(strings.botMessageTails[44] + '\n');
                return;
              }).catch(function(error) {
                console.error("Error modify clan: ", error);
                msg.channel.createMessage(strings.systemErrorMessageTail + '\n');
              });
              return;
            }
            else if (6 == cmd) {
              firestore.collection("clans").doc(clanID).collection("worldbossholders").doc(subcmd).get().then(function(snapshot){
                console.log('snapshot=');
                console.log(snapshot.exists);
                var targetHolder = { username: subcmd, guillotine: 0, zaken: 0, };
                if (snapshot.exists) {
                  targetHolder = snapshot.data();
                }
                console.log(targetHolder);
                if (boss == 'ギロチン') {
                  targetHolder.guillotine = newSelection;
                }
                else if (boss == 'ザケン') {
                  targetHolder.zaken = newSelection;
                }
                firestore.collection("clans").doc(clanID).collection("worldbossholders").doc(subcmd).set(targetHolder).then(function() {
                  msg.channel.createMessage('**データを更新したわ！**\n現在の状況を確認したい場合は「ボス石教えて」って言ってちょうだい★\n');
                  return;
                }).catch(function(error) {
                  console.error("Error modify worldboss holders: ", error);
                  msg.channel.createMessage(strings.systemErrorMessageTail + '\n');
                });
                return;
              }).catch(function(error) {
                console.error("Error read worldboss: ", error);
                msg.channel.createMessage(strings.systemErrorMessageTail + '\n');
              });
              return;
            }
            else if (7 == cmd) {
              firestore.collection("clans").doc(clanID).collection("worldbossholders").get().then(function(querySnapshot){
                var messageGuillotine = '';
                var messageZaken = '';
                var totalGuillotine = 0;
                var totalZaken = 0;
                querySnapshot.forEach(function(snapshot) {
                  if(snapshot.exists) {
                    var targetHolder = snapshot.data();
                    if (targetHolder.guillotine > 0 || targetHolder.zaken > 0) {
                      if (targetHolder.guillotine > 0) {
                        var guillotineNum = Math.floor(targetHolder.guillotine / 100);
                        if (0 < guillotineNum) {
                          messageGuillotine = messageGuillotine + '**';
                        }
                        messageGuillotine = messageGuillotine + targetHolder.username + ' 【ギロチン】' + guillotineNum + '個(+' + (targetHolder.guillotine % 100) + '欠片)';
                        if (0 < guillotineNum) {
                          messageGuillotine = messageGuillotine + '**';
                        }
                        messageGuillotine = messageGuillotine + '\n';
                        totalGuillotine += guillotineNum;
                      }
                      if (targetHolder.zaken > 0) {
                        var zakenNum = Math.floor(targetHolder.zaken / 100);
                        if (0 < zakenNum) {
                          messageZaken = messageZaken + '**';
                        }
                        messageZaken = messageZaken + targetHolder.username + ' 【ザケン】' + zakenNum + '個(+' + (targetHolder.zaken % 100) + '欠片)';
                        if (0 < zakenNum) {
                          messageZaken = messageZaken + '**';
                        }
                        messageZaken = messageZaken + '\n';
                        totalZaken += zakenNum;
                      }
                    }
                  }
                });
                if (0 < messageGuillotine.length || 0 < messageZaken.length) {
                  var message = '';
                  if (0 < messageGuillotine.length) {
                    message = message + '\n' + messageGuillotine + '\n**総ギロチン ' + totalGuillotine + '個**\n';
                  }
                  if (0 < messageZaken.length) {
                    message = message + '\n' + messageZaken + '\n**総ザケン ' + totalZaken + '個**\n';
                  }
                  msg.channel.createMessage('現在の状況は\n' + message + '\nって登録されてるわよ！\n');
                }
                else {
                  msg.channel.createMessage('\n**現在はボス石は何も登録されていなかったわ。** \n\n登録する場合は「ギロチン 150 サンフレ」みたいに所持中のボスの名前と欠片換算で所持中の欠片の数と持ってる人の名前の順序で繋げて言ってくれれば私が代わりに登録してあげるわよ★'
                  + '\n持ってる人の名前は省略してもいいわ。その場合はアナタの名前で登録するわ！');
                }
                return;
              }).catch(function(error) {
                console.error("Error modify clan: ", error);
                msg.channel.createMessage(strings.systemErrorMessageTail + '\n');
              });
              return;
            }
            else if (10 == cmd) {
              firestore.collection("clans").doc(clanID).update({'clanpass': hash}).then(function(querySnapshot){
                msg.channel.createMessage('パスワードの設定が完了しました。\n');
              });
            }
            return;
          }
          return;
        }
        msg.channel.createMessage(strings.botMessageTails[45]);
        return;
    }).catch(function(error) {
        console.error("Error read clan: ", error);
        msg.channel.createMessage(strings.botMessageTails[45]);
      });
      return;
    }
    msg.channel.createMessage(strings.botMessageTails[45]);
    return;
  }
  return;
});

bot.connect()
.catch(err => {
  console.log(`Logging in error:\n${err}`);
});

const http = require('http');
const express = require('express');
const app = express();
app.get("/", (request, response) => {
  console.log(Date.now() + " Ping Received");
  response.sendStatus(200);
  var date = new Date();
  var time = date.toFormat("HH24MI");
  console.log(time + " Ping Received");
  if (process.env.PROJECT_DOMAIN != 'elisabethsama') {
    infojob(false);
  }
});
app.listen(process.env.PORT);
