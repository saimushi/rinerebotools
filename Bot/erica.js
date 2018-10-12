
require('date-utils');

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

var _sendWebhookMessage = function(targetClan, targetSchedule, message) {
  var baseURL = 'https://line2revo.fun/?clanid=' + targetClan.ID + '&scheduleid=' + targetSchedule.ID
  message = message.replace('***date***', targetSchedule.date);
  message = message.replace('***title***', targetSchedule.name);
  message = message.replace('***pt***', baseURL + '#party');
  message = message.replace('***ptview***', baseURL + '&view=on#party');
  message = message.replace('***url***', baseURL + '#detailschedule');
  message = message.replace('***urlview***', baseURL + '&view=on#detailschedule');
  bot.executeWebhook(targetClan.discordhookid, targetClan.discordhooktoken, {
    username: 'エリカ様の血盟管理お手伝い',
    avatarURL: bot.user.dynamicAvatarURL('jpg', 256),
    content: message + '\n\n'
  });
};

var _infoNews = function(targetClan, targetSchedule) {
  var baseMessage = '**【自動お知らせ通知】** ' + targetSchedule.date + 'に「' + targetSchedule.name + '」が予定されてるわよ！確認してみて！\n https://line2revo.fun/?clanid=' + targetClan.ID + '&scheduleid=' + targetSchedule.ID + '&view=on#detailschedule \n';
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
      _sendWebhookMessage(targetClan, targetSchedule, baseMessage + '関連お知らせもあったわ！一緒に確認して！\n\n*' + datas[0].text + '*\n');
    }
    else if (1 < datas.length) {
      _sendWebhookMessage(targetClan, targetSchedule, baseMessage + '関連お知らせが' + datas.length + '件あったわ！一緒に確認して！\n');
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

var infojob = function (testClanID) {
  // firbase問い合わせ
  firestore.collection("clans").where("useInfoJob", "==", true).get().then(function(querySnapshot) {
    var datas = [];
    querySnapshot.forEach(function(snapshot) {
      if(snapshot.exists) {
        var data = snapshot.data();
        if (testClanID == snapshot.id || false === testClanID) {
          if ('string' == typeof data.discordhookid && 'string' == typeof data.discordhooktoken && 0 < data.discordhookid.length && 0 < data.discordhooktoken.length) {
            data.ID = snapshot.id;
            datas.push(data);
          }
        }
      }
    });
    console.log(datas);
    if (0 < datas.length) {
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
      var targetEnd = Math.round(targetStart + (60 * 60 * 1000 * 24 * targetDayCnt));
      console.log('targetDayCnt=' + targetDayCnt + ' & targetStart = ' + targetStart + ' & targetEnd=' + targetEnd);
      _infoSchedules(datas, targetStart, targetEnd);
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
  console.log(msg.content);
  console.log(msg.author.username + '#' + msg.author.discriminator);
  var cmd = 0;
  var subcmd = 0;
  var newcp = 0;
  var newSelection = 0;
  if (isFinite(msg.content) && 0 < parseInt(msg.content)) {
    newcp = parseInt(msg.content);
    msg.channel.createMessage('戦闘力を更新するのね、私に任せて！\n');
    cmd = 1;
    var randnum = 1 + Math.floor( Math.random() * 100 );
    if (randnum === 50) {
      msg.channel.createMessage('ごめんなさい・・・やっぱり疲れたから少し休ませて・・・(T-T)\n');
      cmd = 0;
    }
  }
  else if (0 === msg.content.indexOf('参加 ') || msg.content == '参加' || msg.content == 'ハアハア') {
    if (msg.content == 'ハァハァ') {
      if ('ナレノハテ明美#6358' == msg.author.username + '#' + msg.author.discriminator) {
        msg.channel.createMessage('アナタ・・・出るのね・・・ハァハァ\n');
      }
      else {
        return;
      }
    }
    else {
      msg.channel.createMessage('予定に参加するのね！ありがとう！！\n');
    }
    var entry = msg.content.replace('参加', '').trim();
    cmd = 4;
    subcmd = 1;
    if (-1 < entry.indexOf('聞き専')) {
      newSelection = 2
    }
    if (-1 < entry.indexOf('可能')) {
      newSelection = 1
    }
    if (-1 < entry.indexOf('不可')) {
      newSelection = -1
    }
    if (0 === newSelection) {
      msg.channel.createMessage('VCの設定は同時にしなくて良かったかしら？もし必要なら「聞き専」「可能」「不可」のどれかを教えてちょうだいね★\n');
    }
  }
  else if (msg.content == '不参加') {
    msg.channel.createMessage('予定へ不参加で登録するのね、仕方ないわ・・・次は来てね★\n');
    cmd = 4;
    subcmd = -1;
  }
  else if (msg.content === '確認') {
    msg.channel.createMessage('予定への参加表明がまだの人を確認するのね、任せて！\n');
    cmd = 5;
  }
  else if (msg.content === '確認△') {
    msg.channel.createMessage('予定への参加がまだ未確定の人を確認するのね、任せて！\n');
    cmd = 5;
    subcmd = 2;
  }
  else if (0 === msg.content.indexOf('アクセ ')) {
    msg.channel.createMessage('装飾品を更新するのね、私に任せて！\n');
    var acce = msg.content.replace('アクセ ', '');
    console.log(acce);
    cmd = 1;
    if (-1 < acce.indexOf('魔女')) {
      var toLv = parseInt(acce.replace('魔女', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 79 + toLv;
        msg.channel.createMessage('該当の装飾品が見つかったわ！\n **スゴイわ！これ魔女シリーズじゃない！！？ 特性Lv' + toLv + '** で登録するわね★\n');
      }
    }
    if (-1 < acce.indexOf('エルヴン')) {
      var toLv = parseInt(acce.replace('エルヴン', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 69 + toLv;
        msg.channel.createMessage('該当の装飾品が見つかったわ！\n **エルヴンシリーズの特性Lv' + toLv + '** で登録するのね。\n');
      }
    }
    else if (-1 < acce.indexOf('エルブン')) {
      var toLv = parseInt(acce.replace('エルブン', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 69 + toLv;
        msg.channel.createMessage('該当の装飾品が見つかったわ！\n **エルヴンシリーズの特性Lv' + toLv + '** で登録するのね。\n');
      }
    }
    else if (-1 < acce.indexOf('カラ')) {
      var toLv = parseInt(acce.replace('カラ', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 59 + toLv;
        msg.channel.createMessage('該当の装飾品が見つかったわ！\n **スゴイわ！これカラシリーズだわっ！！？ 特性Lv' + toLv + '** で登録するわね★\n');
      }
    }
    else if (-1 < acce.indexOf('ナッセン')) {
      var toLv = parseInt(acce.replace('ナッセン', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 49 + toLv;
        msg.channel.createMessage('該当の装飾品が見つかったわ！\n **ナッセンシリーズの特性Lv' + toLv + '** で登録するのね。\n');
      }
    }
    else if (-1 < acce.indexOf('ムーンストーン')) {
      var toLv = parseInt(acce.replace('ムーンストーン', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 39 + toLv;
        msg.channel.createMessage('該当の装飾品が見つかったわ！\n **ムーンストーンシリーズの特性Lv' + toLv + '** で登録するのね。\n');
      }
    }
    else if (-1 < acce.indexOf('ムーン')) {
      var toLv = parseInt(acce.replace('ムーン', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 39 + toLv;
        msg.channel.createMessage('該当の装飾品が見つかったわ！\n **ムーンストーンシリーズの特性Lv' + toLv + '** で登録するのね。\n');
      }
    }
    else if (-1 < acce.indexOf('ブラックオール')) {
      var toLv = parseInt(acce.replace('ブラックオール', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 29 + toLv;
        msg.channel.createMessage('該当の装飾品が見つかったわ！\n **ブラックオールシリーズの特性Lv' + toLv + '** で登録するのね。\n');
      }
    }
    else if (-1 < acce.indexOf('ブラック')) {
      var toLv = parseInt(acce.replace('ブラック', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 29 + toLv;
        msg.channel.createMessage('該当の装飾品が見つかったわ！\n **ブラックオールシリーズの特性Lv' + toLv + '** で登録するのね。\n');
      }
    }
    else if (-1 < acce.indexOf('オール')) {
      var toLv = parseInt(acce.replace('オール', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 29 + toLv;
        msg.channel.createMessage('該当の装飾品が見つかったわ！\n **ブラックオールシリーズの特性Lv' + toLv + '** で登録するのね。\n');
      }
    }
    else if (-1 < acce.indexOf('アルボール')) {
      var toLv = parseInt(acce.replace('アルボール', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 19 + toLv;
        msg.channel.createMessage('該当の装飾品が見つかったわ！\n **アルボールシリーズの特性Lv' + toLv + '** で登録するのね。\n');
      }
    }
    else if (-1 < acce.indexOf('アルボ')) {
      var toLv = parseInt(acce.replace('アルボ', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 19 + toLv;
        msg.channel.createMessage('該当の装飾品が見つかったわ！\n **アルボールシリーズの特性Lv' + toLv + '** で登録するのね。\n');
      }
    }
    else if (-1 < acce.indexOf('フェニックス')) {
      var toLv = parseInt(acce.replace('フェニックス', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 9 + toLv;
        msg.channel.createMessage('該当の装飾品が見つかったわ！\n **フェニックスシリーズの特性Lv' + toLv + '** で登録するのね。\n');
      }
    }
    else if (-1 < acce.indexOf('フェニ')) {
      var toLv = parseInt(acce.replace('フェニ', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = 9 + toLv;
        msg.channel.createMessage('該当の装飾品が見つかったわ！\n **フェニックスシリーズの特性Lv' + toLv + '** で登録するのね。\n');
      }
    }
    console.log('アクセID=' + newSelection);
    if (true != (isFinite(newSelection) && 0 < newSelection)) {
      msg.channel.createMessage('該当の装飾品が見つからなかったわ・・・\n「アクセ エルヴン7」みたいな指定をしてみて！7の部分は平均の特性レベルを入れるのよ！\n');
      cmd = 0;
      return;
    }
    subcmd = 1;
  }
  else if (0 === msg.content.indexOf('武器コス ')) {
    msg.channel.createMessage('武器コスを更新するのね、私に任せて！\n');
    var buki = msg.content.replace('武器コス ', '');
    console.log(buki);
    cmd = 1;
    if (-1 < buki.indexOf('百鬼')) {
      var toLv = parseInt(buki.replace('百鬼', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = '百鬼' + toLv;
        msg.channel.createMessage('該当の武器コスが見つかったわ！\n **百鬼夜行シリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('百鬼夜行')) {
      var toLv = parseInt(buki.replace('百鬼夜行', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = '百鬼' + toLv;
        msg.channel.createMessage('該当の武器コスが見つかったわ！\n **百鬼夜行シリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('海賊')) {
      var toLv = parseInt(buki.replace('海賊', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = '海賊' + toLv;
        msg.channel.createMessage('該当の武器コスが見つかったわ！\n **海賊王シリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    if (-1 < buki.indexOf('海賊王')) {
      var toLv = parseInt(buki.replace('海賊王', '').trim());
      if (0 < toLv && 10 >= toLv) {
        newSelection = '海賊' + toLv;
        msg.channel.createMessage('該当の武器コスが見つかったわ！\n **海賊王シリーズの特性Lv' + toLv + '** で登録するわね。\n');
      }
    }
    console.log('武器コスID=' + newSelection);
    if (true != ('string' == typeof newSelection && 0 < newSelection.length)) {
      msg.channel.createMessage('該当の武器コスが見つからなかったわ・・・\n「武器コス 海賊5」みたいな指定をしてみて！5の部分は特性レベルを入れるのよ！\n');
      cmd = 0;
      return;
    }
    subcmd = 2;
  }
  else if (0 === msg.content.indexOf('マント ')) {
    msg.channel.createMessage('マントを更新するのね、私に任せて！\n');
    var manto = msg.content.replace('マント ', '');
    console.log(manto);
    cmd = 1;
    if (-1 < manto.indexOf('高潔')) {
      var toLv = parseInt(manto.replace('高潔', '').trim());
      if (0 < toLv && 30 >= toLv) {
        newSelection = '高潔' + toLv;
        msg.channel.createMessage('該当のマントが見つかったわ！\n **高潔なる血のマント** ね。 **Lv' + toLv + '** で登録するわ！\n');
      }
    }
    if (-1 < manto.indexOf('高潔なる血')) {
      var toLv = parseInt(manto.replace('高潔なる血', '').trim());
      if (0 < toLv && 30 >= toLv) {
        newSelection = '高潔' + toLv;
        msg.channel.createMessage('該当のマントが見つかったわ！\n **高潔なる血のマント** ね。 **Lv' + toLv + '** で登録するわ！\n');
      }
    }
    console.log('マントID=' + newSelection);
    if (true != ('string' == typeof newSelection && 0 < newSelection.length)) {
      msg.channel.createMessage('該当のマントが見つからなかったわ・・・\n「マント 高潔20」みたいな指定をしてみて！20の部分はマントレベルを入れるのよ！\nあと、 **冒険家のマントは戦闘力に関連しないのでツールで管理出来ない** ようにされてるみたい・・・\n');
      cmd = 0;
      return;
    }
    subcmd = 3;
  }
  else if (msg.content === 'お知らせ通知') {
    msg.channel.createMessage('お知らせを毎日自動通知して欲しいのね、私に任せて！\n');
    cmd = 2;
  }
  else if (msg.content === 'お知らせ通知解除') {
    msg.channel.createMessage('お知らせ自動通知を解除して欲しいのね、私に任せて！\n');
    cmd = 3;
  }
  if (0 == cmd) {
    return;
  }
  else {
    if ('string' == typeof msg.channel.topic && -1 < msg.channel.topic.indexOf('clanid=')) {
      var scheduleID = null;
      var clanID = msg.channel.topic.replace('clanid=', '').replace("\r", '').replace("\n", '').replace("&", '');
      if (-1 < clanID.indexOf('scheduleid=')) {
        var splited = clanID.split('scheduleid=');
        clanID = splited[0];
        scheduleID = splited[1];
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
            msg.channel.createMessage('このチャンネルに該当する血盟登録が見つかったわ！\n***' + clan.name + '*** ね！\n');
            if (1 == cmd || 4 == cmd || 5 == cmd) {
              // 血盟員の一覧を取得し、更新対象を特定する
              firestore.collection("users").where('clanid', '==', clanID).where('activity', '>', -9).get().then(function(querySnapshot) {
                var targetUserID = null;
                var targetUser = false;
                var targetUsers = [];
                var incount = 0;
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
                      msg.channel.createMessage('該当する血盟員が見つかったわ！\n***' + user.name + '*** ね！\n');
                      targetUser = user;
                      // CP更新
                      targetUserID = snapshot.id;
                      if (1 == cmd) {
                        if (0 < newcp) {
                          targetUser.cp = newcp;
                        }
                        if (1 == subcmd && 0 < newSelection) {
                          targetUser.acce1 = newSelection;
                        }
                        if (2 == subcmd && 'string' == typeof newSelection && 0 < newSelection.length) {
                          targetUser.bukicos = newSelection;
                        }
                        if (3 == subcmd && 'string' == typeof newSelection && 0 < newSelection.length) {
                          targetUser.manto = newSelection;
                        }
                      }
                      return;
                    }
                  }
                });
                if (5 != cmd && false === targetUser) {
                  msg.channel.createMessage('該当する血盟員が見当たらないわ・・・\n血盟管理ツール「 https://line2revo.fun/?clanid=' + clanID + ' 」に登録済みか確認してみて！\nディスコード上のユーザー名とキャラ名が違う場合はあなたのディスコードID「 ' + whoDiscord + ' 」をツールに登録すると確実よ！');
                  return;
                }
                if (1 == cmd) {
                  firestore.collection("users").doc(targetUserID).set(targetUser).then(function(snapshot) {
                    msg.channel.createMessage('**あなたの戦闘力データを更新したわ！**\nあなたの最新データはココにあるわよ★\n' + targetUser.name + ': https://line2revo.fun/?clanid=' + clanID + '&userid=' + targetUserID + '&view=on#modifyuser\n');
                    return;
                  }).catch(function(error) {
                    console.error("Error modify user: ", error);
                    msg.channel.createMessage('**このエラーは想定外！**\n作者に問い合わせのが懸命よ。きっとバグね・・・\nhttps://line2revo.fun/#inquiry\n');
                  });
                }
                else if (4 == cmd || 5 == cmd) {
                  if (null === scheduleID) {
                    msg.channel.createMessage('このチャンネルに該当する予定が見当たらないわ・・・\nチャンネルのトピックにscheduleIDが「clanid=' + clanID + '&scheduleid=j3HQKbDdIirJgvZ0yNrf(※自身の血盟のscheduleidに置き換えて)」みたいにちゃんと設定されてるか確認してみて！\n'
                    + '設定する値は予定ページのURL「 https://line2revo.fun/?clanid=z77eo2eYNkFEW9emP3bn&scheduleid=j3HQKbDdIirJgvZ0yNrf#detailschedule 」の「clanid=z77eo2eYNkFEW9emP3bn&scheduleid=j3HQKbDdIirJgvZ0yNrf」の部分を指定すると良いわよ！\n');
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
                      msg.channel.createMessage('該当する予定が見つかったわ！\n**' + dateLabel + 'に予定さている「' + targetSchedule.name + '」**ね！\n');
                      if (5 == cmd) {
                        console.log('targetUsers=');
                        console.log(targetUsers);
                        firestore.collection('schedules').doc(scheduleID).collection('users').get().then(function(querySnapshot){
                          querySnapshot.forEach(function(snapshot) {
                            if(snapshot.exists) {
                              var data = snapshot.data();
                              for (var suidx=0; suidx < targetUsers.length; suidx++) {
          											if (targetUsers[suidx].name == data.name){
          												targetUsers[suidx].out = false;
                                  targetUsers[suidx].entry = data.entry;
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
                            else if (2 == subcmd && 0 === targetUsers[suidx].entry && targetUsers[suidx].activity > -1) {
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
                              msg.channel.createMessage('**以下の方達がまだ未確定のままだったわ・・・**\n\n' + mybeUsers + '\n\n');
                            }
                            else {
                              msg.channel.createMessage('**未確定の人は居なかったわ！**\n\n');
                            }
                          }
                          console.log('outUsers=');
                          console.log(outUsers);
                          if (0 < outUsers.length) {
                            msg.channel.createMessage('**以下の方達がまだ未表明のままだったわ・・・**\n\n' + outUsers + '\n予定への登録は「 https://line2revo.fun/?clanid=' + clanID + '&scheduleid=' + scheduleID + '&view=on#detailschedule 」から出来るわ！\n'
                            + 'もしくは私に「参加」「不参加」かを教えて！');
                          }
                          else {
                            msg.channel.createMessage('**未表明の方は居なかったわ！**\n\n予定への登録は「 https://line2revo.fun/?clanid=' + clanID + '&scheduleid=' + scheduleID + '&view=on#detailschedule 」から出来るわ！\n'
                            + 'もしくは私に「参加」「不参加」かを教えて！');
                          }
                          return;
                        }).catch(function(error) {
                          console.error("Error read schedule users: ", error);
                          msg.channel.createMessage('**このエラーは想定外！**\n作者に問い合わせのが懸命よ。きっとバグね・・・\nhttps://line2revo.fun/#inquiry\n');
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
                            if (-1 === subcmd && 0 < targetScheduleUser.entry && 0 < incount) {
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
                          if (-1 === subcmd) {
                            subMSg = '不参加';
                            targetUser.status = 0;
                            targetUser.party = 0;
                            targetUser.voice = 0;
                          }
                          firestore.collection("schedules").doc(scheduleID).collection("users").doc(targetUser.ID).set(targetUser).then(function() {
                            targetSchedule.incount = incount;
                            console.log(targetSchedule);
                            firestore.collection("schedules").doc(scheduleID).set(targetSchedule).then(function(snapshot) {
                              msg.channel.createMessage('**' + subMSg + 'で予定登録を完了したわ！**\nあなたの最新データはココにあるわよ★\n' + targetUser.name + ': https://line2revo.fun/?clanid=' + clanID + '&scheduleid=' + scheduleID + '&view=on#detailschedule\n');
                  						return;
                            }).catch(function(error) {
                              console.error("Error modify schedule: ", error);
                              msg.channel.createMessage('**このエラーは想定外！**\n作者に問い合わせのが懸命よ。きっとバグね・・・\nhttps://line2revo.fun/#inquiry\n');
                            });
                            return;
                					}).catch(function(error) {
                						console.error("Error modify schedule user: ", error);
                            msg.channel.createMessage('**このエラーは想定外！**\n作者に問い合わせのが懸命よ。きっとバグね・・・\nhttps://line2revo.fun/#inquiry\n');
                					});
                          return;
                        }).catch(function(error) {
                  				console.error("Error read schedule user: ", error);
                          msg.channel.createMessage('**このエラーは想定外！**\n作者に問い合わせのが懸命よ。きっとバグね・・・\nhttps://line2revo.fun/#inquiry\n');
                        });
                      }
                    }
                    if (false === targetSchedule) {
                      msg.channel.createMessage('このチャンネルに該当する予定が見当たらないわ・・・\nチャンネルのトピックにscheduleIDが「clanid=' + clanID + '&scheduleid=j3HQKbDdIirJgvZ0yNrf(※自身の血盟のscheduleidに置き換えて)」みたいにちゃんと設定されてるか確認してみて！\n'
                      + '設定する値は予定ページのURL「 https://line2revo.fun/?clanid=z77eo2eYNkFEW9emP3bn&scheduleid=j3HQKbDdIirJgvZ0yNrf#detailschedule 」の「clanid=z77eo2eYNkFEW9emP3bn&scheduleid=j3HQKbDdIirJgvZ0yNrf」の部分を指定すると良いわよ！\n');
                      return;
                    }
            			}).catch(function(error) {
            				console.error("Error read schedule: ", error);
                    msg.channel.createMessage('このチャンネルに該当する予定が見当たらないわ・・・\nチャンネルのトピックにscheduleIDが「clanid=' + clanID + '&scheduleid=j3HQKbDdIirJgvZ0yNrf(※自身の血盟のscheduleidに置き換えて)」みたいにちゃんと設定されてるか確認してみて！\n'
                    + '設定する値は予定ページのURL「 https://line2revo.fun/?clanid=z77eo2eYNkFEW9emP3bn&scheduleid=j3HQKbDdIirJgvZ0yNrf#detailschedule 」の「clanid=z77eo2eYNkFEW9emP3bn&scheduleid=j3HQKbDdIirJgvZ0yNrf」の部分を指定すると良いわよ！\n');
                    return;
                  });
                }
                return;
              }).catch(function(error) {
                console.error("Error read user: ", error);
                msg.channel.createMessage('該当する血盟員が見当たらないわ・・・\n血盟管理ツール「 https://line2revo.fun/?clanid=' + clanID + ' 」に登録済みか確認してみて！\nディスコード上のユーザー名とキャラ名が違う場合はあなたのディスコードID「 ' + whoDiscord + ' 」をツールに登録すると確実よ！');
              });
            }
            else if (2 == cmd) {
              if (true != ('string' == typeof clan.discordhookid && 'string' == typeof clan.discordhooktoken && 0 < clan.discordhookid.length && 0 < clan.discordhooktoken.length)) {
                msg.channel.createMessage('この血盟にはDiscordの `Webhook` がまだ登録されていないから、お知らせを自動で送ることが出来ないわ・・・\n「 https://line2revo.fun/#howto 」このページの「予定を通知して出欠を促す事は出来ますか？」を参考にDiscordに `Webhook` を設定をしてみて！');
                return;
              }
              if ('undefined' == typeof clan.useInfoJob || true !== clan.useInfoJob) {
                clan.useInfoJob = true;
                firestore.collection("clans").doc(clanID).set(clan).then(function(snapshot) {
                  msg.channel.createMessage('**お知らせ自動通知を設定したわ！**\nこれで毎晩0時頃に3日先までの予定が自動でお知らせされるハズよ！\n取り消したい時は「お知らせ通知解除」って言ってちょうだい★\n');
                  infojob(clanID);
                  return;
                }).catch(function(error) {
                  console.error("Error modify clan: ", error);
                  msg.channel.createMessage('**このエラーは想定外！**\n作者に問い合わせのが懸命よ。きっとバグね・・・\nhttps://line2revo.fun/#inquiry\n');
                });
                return;
              }
              msg.channel.createMessage('**お知らせ自動通知は既に設定されてたわ！**\n毎晩0時頃に3日前までの予定が自動でお知らせされるハズよ！\n取り消したい時は「お知らせ通知解除」って言ってちょうだい★\n');
              infojob(clanID);
              return;
            }
            else if (3 == cmd) {
              clan.useInfoJob = false;
              firestore.collection("clans").doc(clanID).set(clan).then(function(snapshot) {
                msg.channel.createMessage('**お知らせ自動通知を解除したわ！**\nこれで毎晩グッスリ眠れるハズよ！\n・・・少し・・・うるさかったかしらね・・・\nもう一度設定する時は「お知らせ通知」って言ってちょうだい★\n');
                return;
              }).catch(function(error) {
                console.error("Error modify clan: ", error);
                msg.channel.createMessage('**このエラーは想定外！**\n作者に問い合わせのが懸命よ。きっとバグね・・・\nhttps://line2revo.fun/#inquiry\n');
              });
              return;
            }
            return;
          }
        }
			}).catch(function(error) {
				console.error("Error read clan: ", error);
        msg.channel.createMessage('このチャンネルに該当する血盟登録が見当たらないわ・・・\nチャンネルのトピックにclanIDが「clanid=z77eo2eYNkFEW9emP3bn(※自身の血盟のclanIDに置き換えて)」みたいにちゃんと設定されてるか確認してみて！\n');
      });
      return;
    }
    msg.channel.createMessage('このチャンネルに該当する血盟登録が見当たらないわ・・・\nチャンネルのトピックにclanIDが「clanid=z77eo2eYNkFEW9emP3bn(※自身の血盟のclanIDに置き換えて)」みたいにちゃんと設定されてるか確認してみて！\n');
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
  if (time === '0000') {
    // 0時0分なのでお知らせバッチ実行
    infojob(false);
  }
});
app.listen(process.env.PORT);

/*
setInterval(() => {
  http.get(`http://${process.env.PROJECT_DOMAIN}.glitch.me/`);
}, 280000);
*/
