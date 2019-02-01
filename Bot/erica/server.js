
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
    var cmd = 0;
    var subcmd = 0;
    var newcp = 0;
    var newSelection = 0;
    if ('エリカ様の血盟管理お手伝い' ==  msg.author.username) {
      return;
    }
    if (-1 < msg.content.indexOf('\n')) {
      console.log('改行は無視');
      return;
    }
    msg.content = msg.content.replace(/　/g, " ");
    console.log(msg.content);
    console.log(msg.author.username + '#' + msg.author.discriminator);
    if (isFinite(msg.content) && 0 < parseInt(msg.content)) {
      newcp = parseInt(msg.content);
      msg.channel.createMessage('戦闘力を更新するのね、私に任せて！\n');
      cmd = 1;
      var randnum = 1 + Math.floor( Math.random() * 100 );
      if (randnum > 50 && randnum < 55) {
        msg.channel.createMessage('ごめんなさい・・・やっぱり疲れたから少し休ませて・・・(T-T)\n');
        cmd = 0;
      }
    }
    else if (0 === msg.content.indexOf('参加 ') || msg.content == '参加' || msg.content == 'ハァハァ' || msg.content == 'ハアハア') {
      if (msg.content == 'ハァハァ' || msg.content == 'ハアハア') {
        if ('ナレノハテ明美#6358' == msg.author.username + '#' + msg.author.discriminator) {
          msg.channel.createMessage('アナタ・・・出るのね・・・ハァハァ\n');
          newSelection = 1;
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
    else if (0 === msg.content.indexOf('参加△ ') || msg.content == '参加△') {
      msg.channel.createMessage('予定は未定よね・・・分かったわ！予定には **たぶん参加** で登録するわ！出れるかハッキリ分かったらまた改めて教えて頂戴ね★\n');
      var entry = msg.content.replace('参加△', '').trim();
      cmd = 4;
      subcmd = 0;
      newSelection = 0;
      if ('string' == typeof entry && 0 < entry.length) {
        newSelection = entry;
      }
      if (0 === newSelection) {
        msg.channel.createMessage('メモの設定は同時にしなくて良かったかしら？もし必要なら「参加△ 何かメモしたいコメント」の形で教えてちょうだいね★\n');
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
      msg.content = msg.content.replace(/[０-９]/g, function(s){
          return String.fromCharCode(s.charCodeAt(0)-0xFEE0);
      });
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
      msg.content = msg.content.replace(/[０-９]/g, function(s){
          return String.fromCharCode(s.charCodeAt(0)-0xFEE0);
      });
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
      if (-1 < buki.indexOf('ハロウィン')) {
        var toLv = parseInt(buki.replace('ハロウィン', '').trim());
        if (0 < toLv && 10 >= toLv) {
          newSelection = 'カボ' + toLv;
          msg.channel.createMessage('該当の武器コスが見つかったわ！\n **ハロウィンシリーズの特性Lv' + toLv + '** で登録するわね。\n');
        }
      }
      if (-1 < buki.indexOf('カボチャ')) {
        var toLv = parseInt(buki.replace('カボチャ', '').trim());
        if (0 < toLv && 10 >= toLv) {
          newSelection = 'カボ' + toLv;
          msg.channel.createMessage('該当の武器コスが見つかったわ！\n **ハロウィンシリーズの特性Lv' + toLv + '** で登録するわね。\n');
        }
      }
      if (-1 < buki.indexOf('カボチ')) {
        var toLv = parseInt(buki.replace('カボチ', '').trim());
        if (0 < toLv && 10 >= toLv) {
          newSelection = 'カボ' + toLv;
          msg.channel.createMessage('該当の武器コスが見つかったわ！\n **ハロウィンシリーズの特性Lv' + toLv + '** で登録するわね。\n');
        }
      }
      if (-1 < buki.indexOf('カボ')) {
        var toLv = parseInt(buki.replace('カボ', '').trim());
        if (0 < toLv && 10 >= toLv) {
          newSelection = 'カボ' + toLv;
          msg.channel.createMessage('該当の武器コスが見つかったわ！\n **ハロウィンシリーズの特性Lv' + toLv + '** で登録するわね。\n');
        }
      }
      if (-1 < buki.indexOf('アイスエッジ')) {
        var toLv = parseInt(buki.replace('アイスエッジ', '').trim());
        if (0 < toLv && 10 >= toLv) {
          newSelection = '氷刃' + toLv;
          msg.channel.createMessage('該当の武器コスが見つかったわ！\n **アイスエッジシリーズの特性Lv' + toLv + '** で登録するわね。\n');
        }
      }
      if (-1 < buki.indexOf('アイスエッヂ')) {
        var toLv = parseInt(buki.replace('アイスエッヂ', '').trim());
        if (0 < toLv && 10 >= toLv) {
          newSelection = '氷刃' + toLv;
          msg.channel.createMessage('該当の武器コスが見つかったわ！\n **アイスエッジシリーズの特性Lv' + toLv + '** で登録するわね。\n');
        }
      }
      if (-1 < buki.indexOf('アイス')) {
        var toLv = parseInt(buki.replace('アイス', '').trim());
        if (0 < toLv && 10 >= toLv) {
          newSelection = '氷刃' + toLv;
          msg.channel.createMessage('該当の武器コスが見つかったわ！\n **アイスエッジシリーズの特性Lv' + toLv + '** で登録するわね。\n');
        }
      }
      if (-1 < buki.indexOf('氷')) {
        var toLv = parseInt(buki.replace('氷', '').trim());
        if (0 < toLv && 10 >= toLv) {
          newSelection = '氷刃' + toLv;
          msg.channel.createMessage('該当の武器コスが見つかったわ！\n **アイスエッジシリーズの特性Lv' + toLv + '** で登録するわね。\n');
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
      msg.content = msg.content.replace(/[０-９]/g, function(s){
          return String.fromCharCode(s.charCodeAt(0)-0xFEE0);
      });
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
      if (-1 < manto.indexOf('ハギ')) {
        var toLv = parseInt(manto.replace('ハギ', '').trim());
        if (0 < toLv && 30 >= toLv) {
          newSelection = 'ハギ' + toLv;
          msg.channel.createMessage('該当のマントが見つかったわ！\n **ハギオスのマント** ね。 **Lv' + toLv + '** で登録するわ！\n');
        }
      }
      if (-1 < manto.indexOf('ハギオス')) {
        var toLv = parseInt(manto.replace('ハギオス', '').trim());
        if (0 < toLv && 30 >= toLv) {
          newSelection = 'ハギ' + toLv;
          msg.channel.createMessage('該当のマントが見つかったわ！\n **ハギオスのマント** ね。 **Lv' + toLv + '** で登録するわ！\n');
        }
      }
      if (-1 < manto.indexOf('堅守なる氷結')) {
        var toLv = parseInt(manto.replace('堅守なる氷結の', '').trim());
        if (0 < toLv && 30 >= toLv) {
          newSelection = '氷結' + toLv;
          msg.channel.createMessage('該当のマントが見つかったわ！\n **堅守なる氷結のマント** ね。 **Lv' + toLv + '** で登録するわ！\n');
        }
      }
      if (-1 < manto.indexOf('氷結')) {
        var toLv = parseInt(manto.replace('氷結', '').trim());
        if (0 < toLv && 30 >= toLv) {
          newSelection = '氷結' + toLv;
          msg.channel.createMessage('該当のマントが見つかったわ！\n **堅守なる氷結のマント** ね。 **Lv' + toLv + '** で登録するわ！\n');
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
    else if (0 === msg.content.indexOf('特性 ') || 0 === msg.content.indexOf('武器特性 ')) {
      msg.content = msg.content.replace(/[０-９]/g, function(s){
          return String.fromCharCode(s.charCodeAt(0)-0xFEE0);
      });
      msg.channel.createMessage('武器の特性を更新するのね、私に任せて！\n');
      var tokusei = msg.content.replace('特性', '');
      tokusei = tokusei.replace('武器', '');
      tokusei = tokusei.trim();
      console.log(tokusei);
      cmd = 1;
      if (-1 < tokusei.indexOf('ボス特')) {
        var toLv = parseInt(tokusei.replace('ボス特', '').trim());
        if (0 < toLv && 10 >= toLv) {
          newSelection = toLv;
          msg.channel.createMessage('該当の武器が見つかったわ！\n **ボス特性武器** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
          subcmd = 4;
        }
      }
      if (-1 < tokusei.indexOf('ボス')) {
        var toLv = parseInt(tokusei.replace('ボス', '').trim());
        if (0 < toLv && 10 >= toLv) {
          newSelection = toLv;
          msg.channel.createMessage('該当の武器が見つかったわ！\n **ボス特性武器** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
          subcmd = 4;
        }
      }
      if (-1 < tokusei.indexOf('魔物')) {
        var toLv = parseInt(tokusei.replace('魔物', '').trim());
        if (0 < toLv && 10 >= toLv) {
          newSelection = toLv;
          msg.channel.createMessage('該当の武器が見つかったわ！\n **魔物特性武器** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
          subcmd = 5;
        }
      }
      if (-1 < tokusei.indexOf('赤武器')) {
        var toLv = parseInt(tokusei.replace('赤武器', '').trim());
        if (0 < toLv && 10 >= toLv) {
          newSelection = toLv;
          msg.channel.createMessage('該当の武器が見つかったわ！\n **魔物特性武器** ね。 **特性Lv' + toLv + '** で登録するわ！\n');
          subcmd = 5;
        }
      }
      if (true != ('number' == typeof newSelection && 0 < newSelection)) {
        msg.channel.createMessage('該当の武器が見つからなかったわ・・・\n「特性 魔物10」みたいな指定をしてみて！10の部分はその武器の特性レベルを入れるのよ！\n');
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
      if (0 < toLv && 320 >= toLv) {
        newSelection = toLv;
        msg.channel.createMessage('レベルを更新するのね、私に任せて！\n **Lv' + toLv + '** で登録するわ！\n');
        subcmd = 10;
      }
      if (true != ('number' == typeof newSelection && 0 < newSelection)) {
        cmd = 0;
        return;
      }
    }
    else if (0 === msg.content.indexOf('転職 完了') || 0 === msg.content.indexOf('転職完了')) {
      msg.content = msg.content.replace(/[０-９]/g, function(s){
          return String.fromCharCode(s.charCodeAt(0)-0xFEE0);
      });
      newSelection = 1;
      msg.channel.createMessage('3次職転職がついに完了したのね！！おめでとう！！！\n **転職済み** にデータを更新するわ！\nコレであなたも巨人の力を手に入れた必滅者となったのね・・・今後の活躍が楽しみ★');
      cmd = 1;
      subcmd = 11;
    }
    else if (msg.content === 'お知らせ通知') {
      msg.channel.createMessage('お知らせを毎日自動通知して欲しいのね、私に任せて！\n');
      cmd = 2;
    }
    else if (msg.content === 'お知らせ通知解除') {
      msg.channel.createMessage('お知らせ自動通知を解除して欲しいのね、私に任せて！\n');
      cmd = 3;
    }
    else if (0 === msg.content.indexOf('ギロチン ') || 0 === msg.content.indexOf('ザケン ')) {
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
    else if (-1 < msg.content.indexOf('ボス石教え') || -1 < msg.content.indexOf('ボス石おしえ') || -1 < msg.content.indexOf('ボス石確認') || -1 < msg.content.indexOf('ボス石教えてにゃ')) {
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
    else if (-1 < msg.content.indexOf('AF') || -1 < msg.content.indexOf('アーティファクト')) {
      if (-1 < msg.content.indexOf('計算') || -1 < msg.content.indexOf('最適') || -1 < msg.content.indexOf('教えて') || -1 < msg.content.indexOf('知りたい')) {
        msg.channel.createMessage('フレヤサーバーの @KK1116 さん、 @Lsama さんが **アーティファクト計算ツール** を作って公開してくれているわ！\n'
        + 'それを活用するのがベストよ！\nhttps://t.co/yHzFtk4rXo\n\n'
        + '**【使い方(PC)】**\nリンクを開いた後に「ファイル」 => 「コピーを作成」とやって自分専用のシートにコピーして使うのよ！\n決して作者さんに権限追加依頼を出さないように注意してね。\n\nhttps://twitter.com/KK11161/status/1083645715081904129 \n\n'
        + '**【使い方(スマホ)】**\nスマホの場合は「Googleスプレッドシート」アプリ( https://www.google.com/intl/ja_jp/sheets/about/ )\nをインストールしてからリンクを開くとアプリが起動するわ。\nメニューから「共有とエクスポート」 => 「コピーの作成」ってやるとPCと同じ事が出来るわ！\n\n'
        + '**【スマホ版シートの開き方説明動画】**\nhttps://youtu.be/xKo-PGzjALI\n*※提供のねーこちゃんありがとう♥*'
        /*+ 'アプリを入れずにどうしても直ぐに試してみたい場合は作者が用意してるコチラのリンク\nhttps://docs.google.com/spreadsheets/d/1cBqk4uM34QEhBOiqw1X2XTlh9VxnDejenYu4dKh902c/edit?usp=sharing\nを使ってみて！\n他の人が編集している場合があるし、後から他の人に見られたりするからくれぐれも注意して使ってね。\n\n'*/
        );
        return;
      }
    }
    else if (-1 < msg.content.indexOf('エリカ様今日悲しいことあった')) {
      var randnum = 1 + Math.floor( Math.random() * 100 );
      if (randnum > 40 && randnum < 50) {
        msg.channel.createMessage(msg.author.username + 'ちゃん、諦めないで頑張ろ！！');
        return;
      }
      if (randnum > 30 && randnum < 40) {
        msg.channel.createMessage(msg.author.username + 'ちゃんの泣き言なんて聞きたくないっ！！');
        return;
      }
      msg.channel.createMessage(msg.author.username + 'ちゃん、よしよし');
      cmd = 0;
      return;
    }
    else if (-1 < msg.content.indexOf('エリカ様だいすき') || -1 < msg.content.indexOf('エリカ様大好き') || -1 < msg.content.indexOf('エリカ様好き') || -1 < msg.content.indexOf('エリカ様すき')) {
      var randnum = 1 + Math.floor( Math.random() * 100 );
      if (randnum > 40 && randnum < 50) {
        msg.channel.createMessage(msg.author.username + 'ちゃん・・・ちょっとキモいわ・・・');
        return;
      }
      if (randnum > 30 && randnum < 40) {
        msg.channel.createMessage(msg.author.username + 'ちゃん♥エリカスゴくウレシイ♥♥');
        return;
      }
      msg.channel.createMessage(msg.author.username + 'ちゃん私もっ♥');
      msg.channel.createMessage('もし良かったら・・・作者に寄付して上げて★\n寄付はここから出来るわ♥\nhttps://line2revo.fun/#donation');
      cmd = 0;
      return;
    }
    else if (-1 < msg.content.indexOf('エリカ様お疲れ') || -1 < msg.content.indexOf('エリカ様おつかれ') || -1 < msg.content.indexOf('エリカさまお疲れ') || -1 < msg.content.indexOf('エリカさまおつかれ')) {
      msg.channel.createMessage('あら！ありがとうーー♪嬉しいわー！\n私へのお給料の振込はここから出来るわ♥\nhttps://line2revo.fun/#donation');
      cmd = 0;
      return;
    }
    else if (-1 < msg.content.indexOf('エリカ') && true == (-1 < msg.content.indexOf('ヘルプ') || -1 < msg.content.indexOf('パンツ') || -1 < msg.content.indexOf('助け') || -1 < msg.content.indexOf('おしえ') || -1 < msg.content.indexOf('たすけ') || -1 < msg.content.indexOf('教え'))) {
      msg.channel.createMessage('呼んだかしら？？\n'
      + '私が出来るお手伝いは\n\n'
      + '戦闘力の更新 **[1012543]**\n'
      + 'レベルの更新 **[レベル 1〜320]**\n'
      + '3次職転職完了状態の更新 **[転職完了] [転職 完了]**\n'
      + '予定への参加登録 **[参加] [参加 聞き専(or 可能・不可)] [参加△ コメント] [不参加]**\n'
      + '予定参加者の確認 **[確認] [確認△]**\n'
      + 'アクセの登録 **[アクセ カラ 1〜10]**\n'
      + '武器コスの登録 **[武器コス 海賊 1〜10]**\n'
      + 'マントの登録 **[マント 高潔 1〜30]**\n'
      + 'ボス特性武器の登録 **[特性 ボス 1〜10]**\n'
      + '魔物特性武器の登録 **[特性 魔物 1〜10]**\n'
      + 'ボス石の欠片所持数の登録 **[ギロチン 120] [ザケン 120] [ギロチン 60 他の誰かの名前] [ザケン 0 使用した人の名前]**\n'
      + 'ボス石の欠片所持数の確認 **[ボス石確認]**\n'
      + 'お知らせの自動通知 **[お知らせ通知]**\n'
      + 'お知らせ自動通知の解除 **[お知らせ通知解除]**\n'
      + 'アーティファクト自動編成ツールの使い方のヘルプ **[AF最適化] [AF教えて] [アーティファクト計算]**\n'
      + '\nよ！\n'
      + '**[]**の中がコマンドになってるから\n'
      + '\nボス石確認\n'
      + '\nとかって言う風に書き込んでくれれば、あとは私がやっておくわ！！\n'
      + '覚えてね★');
      if ('ジン#2696' == (msg.author.username + '#' + msg.author.discriminator)) {
        msg.channel.createMessage('ゴメンナサイ・・・植毛は絶望的だわ・・・\n');
      }
      cmd = 0;
      return;
    }
    else if ('ジン#2696' == (msg.author.username + '#' + msg.author.discriminator)) {
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
    else if ('ねーこ#5826' == (msg.author.username + '#' + msg.author.discriminator) && 0 > msg.content.indexOf('にゃ')) {
      msg.channel.createMessage('にゃ！');
      cmd = 0;
      return;
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
                        msg.channel.createMessage('該当する血盟員が見つかったわ！\n***' + user.name + '*** ね！\n');
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
                          if (10 == subcmd && 'number' == typeof newSelection && 0 < newSelection) {
                            targetUser.level = newSelection;
                          }
                          if (11 == subcmd && 'number' == typeof newSelection && 0 < newSelection) {
                            targetUser.job3d = newSelection;
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
                      if (0 < cpmargin) {
                        var marginTxt = '';
                        if (100000 <= cpmargin) {
                          marginTxt = '***頑張り過ぎじゃない！？ホントに大丈夫なの！！？***\n';
                        }
                        else if (50000 <= cpmargin) {
                          marginTxt = '**とてつもない成長よ！**\n';
                        }
                        else if (20000 <= cpmargin) {
                          marginTxt = '**凄い成長してるわ！**\n';
                        }
                        else if (5000 <= cpmargin) {
                          marginTxt = '**順調に成長してて偉いわね！**\n';
                        }
                        var randnum = 1 + Math.floor( Math.random() * 100 );
                        if (3000000 < newcp) {
                          if (3000000 > currentcp) {
                            msg.channel.createMessage('.\n\n' + marginTxt + 'ついに異次元の強さだわ・・・\n本当におめでとう。もうエリカから教えられる事は何も無いわ！貴方が正しいと思う道を行くのが正解よ！エリカはずっと応援してるわ★\n');
                          }
                        }
                        else if (2500000 < newcp) {
                          if (randnum > 0 && randnum <= 25) {
                            msg.channel.createMessage('.\n\n' + marginTxt + '凄いわ・・・ここまで来てしまうなんて！！\nいよいよLRソウルストーンが必要な時よ！先ずは攻撃のLRソウルストーン、その後は防御のLRが簡単よ！\n全身LRソウルストーンになるころにはきっとまたスゴく強くなってるハズよ！頑張って！！\n');
                          }
                          else if (randnum > 25 && randnum <= 50) {
                            msg.channel.createMessage('.\n\n' + marginTxt + '凄いわ・・・ここまで来てしまうなんて！！\n兎に角装備実績を積みましょう。25万は欲しいところね・・・全ての武器と1種類のアクセサリーオールコンプリートでそのくらいよ！\n先は長いけどここまで来たなら頑張りましょう！！\n');
                          }
                          else if (randnum > 50 && randnum <= 75) {
                            msg.channel.createMessage('.\n\n' + marginTxt + '250万オーバー！？分かってる、異世界のアデナを使ったのね。凄いわ・・・\n兎に角装備実績を積みましょう。\n武器の装備実績を終わらせる頃にはきっとまたスゴく強くなってるハズよ！頑張って！！\n');
                          }
                          else if (randnum > 75 && randnum <= 100) {
                            msg.channel.createMessage('.\n\n' + marginTxt + '250万オーバー！？分かってる、異世界のアデナを使ったのね。凄いわ・・・\nココからはMAXセットを目指しましょう！全身が終わったら次は赤防具か2種目の装飾品がいいんじゃないかしら。\nでも正直もうエリカには分からない世界だわ・・・\n');
                          }
                          return;
                        }
                        else if (2000000 < newcp) {
                          if (randnum > 0 && randnum <= 25) {
                            msg.channel.createMessage('.\n\n' + marginTxt + 'いよいよ200万オーバーなのね！凄い頑張ってるわ！\nこれからは装備実績も積み上げて行かないと行けないわね。\nイベントショップでアデナで買える選択祝福はオススメよ！毎週買って貯めるといいわよ！\n');
                          }
                          else if (randnum > 25 && randnum <= 50) {
                            msg.channel.createMessage('.\n\n' + marginTxt + 'いよいよ200万オーバーなのね！凄い頑張ってるわ！\nココからは強化セットも狙っていかないと中々上がらないわ・・・\nでも慎重に！**くれぐれもマーブル無しでなんてやらないでね！エリカからのお願いよ・・・！**\n');
                          }
                          else if (randnum > 50 && randnum <= 75) {
                            msg.channel.createMessage('.\n\n' + marginTxt + 'もうココまで来てるのね、凄いわ！\nとにかくエリクサーがまだなら終わらせましょう！\n要塞ショップは欠かさず買うのよ！！エリクサーエッセンス選択ボックスももちろん毎日買うのよ！！\n');
                          }
                          else if (randnum > 75 && randnum <= 100) {
                            msg.channel.createMessage('.\n\n' + marginTxt + 'もうココまで来てるのね、凄いわ！\n200万から先は修羅の道よ・・・防御クリスタルが足りない時はHRの分解も視野に入れてみて。\nどーしても直ぐに欲しい時は・・・悔しいけどネトマの力に頼るしか無いわね・・・\n');
                          }
                          return;
                        }
                        else if (1500000 < newcp) {
                          if (randnum > 0 && randnum <= 25) {
                            msg.channel.createMessage('.\n\n' + marginTxt + '順調に強くなっているわ！\nてっとり速くMAX装備が欲しくなるけど慎重にね・・・\n**マーブル無しで打つのだけはダメ、絶対！エリカと約束！！**\n');
                          }
                          else if (randnum > 25 && randnum <= 50) {
                            msg.channel.createMessage('.\n\n' + marginTxt + '順調に強くなっているわ！\nLR装備を揃え始める時期だわ。先ずはエリート武器、その次に青武器が私のオススメよ！\nペニーワイズの言うことを信じちゃダメよ！\nサン★フレアは信じちゃったみたいだけど・・・\n');
                          }
                          else if (randnum > 50 && randnum <= 75) {
                            msg.channel.createMessage('.\n\n' + marginTxt + 'いい感じに成長してるわね！\nレベル250でURエリクサーが開放されるわ！\nURエリクサーはトータル1200万アデナも使うけど、戦闘力が8万近く上がるから絶対に見逃さないでね★\n');
                          }
                          else if (randnum > 75 && randnum <= 100) {
                            msg.channel.createMessage('.\n\n' + marginTxt + 'いい感じに成長してるわね！\n戦闘力を上げるには装備の超越も重要よ！日々小まめに合成を行うのよ！！\nそしたら功績だって達成出来るんだから★\n');
                          }
                          return;
                        }
                        else {
                          if (randnum > 0 && randnum <= 25) {
                            msg.channel.createMessage('.\n\n' + marginTxt + 'まだ駆け出しの段階ね！\n今は装備を揃えることとモンスターコアをコンプする事が重要よ！\n頑張ってね★\n');
                          }
                          else if (randnum > 25 && randnum <= 50) {
                            msg.channel.createMessage('.\n\n' + marginTxt + 'まだ駆け出しの段階ね！\n決闘は面倒でも欠かさずやっておいた方がいい日課よ。\n名誉ランクで上がる戦闘力は馬鹿にならないのよ★\n');
                          }
                          else if (randnum > 50 && randnum <= 75) {
                            msg.channel.createMessage('.\n\n' + marginTxt + '順調に成長してるわね。\nレベル上げと同時にルーンのレベルも上げていくといいわ！\nルーンはアデナを大量に使うから、しっかりアデナを貯めて置くことも大事よ★\n');
                          }
                          else if (randnum > 75 && randnum <= 100) {
                            msg.channel.createMessage('.\n\n' + marginTxt + '順調に成長してるわね。\n戦闘力を上げるには装備の超越も重要よ！日々小まめに合成を行うのよ！！\nそしたら功績だって達成出来るんだから★\n');
                          }
                          return;
                        }
                      }
                      else if (0 > cpmargin) {
                        msg.channel.createMessage('.\n\n貴方戦闘力下がってるけど・・・エリカとの約束ちゃんと守ってる？マーブル無しで強化したら怒るわよ・・・？\n');
                      }
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
                        msg.channel.createMessage('該当する予定が見つかったわ！\n**' + dateLabel + 'に予定さている「' + targetSchedule.name + '」**ね！\n現在 **' + incount + '名** が参加予定になってるわ。\n');
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
                                if (0 !== newSelection) {
                                  targetUser.comment = newSelection;
                                }
                              }
                              targetUser.status = 0;
                              targetUser.party = 0;
                              targetUser.voice = 0;
                            }
                            if ('string' == typeof targetUser.comment && targetUser.comment == '同一タグの前回のPT編成をコピー') {
                              targetUser.comment = '';
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
                    msg.channel.createMessage('**このエラーは想定外！**\n作者に問い合わせのが懸命よ。きっとバグね・・・\nhttps://line2revo.fun/#inquiry\n');
                  });
                  return;
                }).catch(function(error) {
                  console.error("Error read worldboss: ", error);
                  msg.channel.createMessage('**このエラーは想定外！**\n作者に問い合わせのが懸命よ。きっとバグね・・・\nhttps://line2revo.fun/#inquiry\n');
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
    if (time === '0000' || time === '0001' || time === '0002') {
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
