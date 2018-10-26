// https://glitch.com/edit/#!/cheerful-treatment

require('date-utils');
var Long = require("long");
const Eris = require('eris');

const getDefaultChannel = async (guild) => {
  // get "original" default channel
  if(guild.channels.has(guild.id))
    return guild.channels.get(guild.id)

  // Check for a "general" channel, which is often default chat
  var textChannel = guild.channels.find((channel) => channel.name.indexOf('general') > -1 && channel.type === 0);
  console.log('is??');
  console.log(textChannel);
  if (textChannel) {
    //textChannel.channel_id = textChannel.id;
    console.log('is-??');
    return textChannel;
  }
  textChannel = guild.channels.find((channel) => console.log(channel) && channel.name.indexOf('要塞戦') > -1 && channel.type === 0);
  console.log('is?');
  console.log(textChannel);
  if (textChannel) {
    //textChannel.channel_id = textChannel.id;
    console.log('is-?');
    return textChannel;
  }
  textChannel = guild.channels.find((channel) => channel.type === 0);
  console.log('isa?');
  console.log(textChannel);
  if (textChannel) {
    //textChannel.channel_id = textChannel.id;
    console.log('isa-?');
    return textChannel;
  }
  // Now we get into the heavy stuff: first channel in order where the bot can speak
  // hold on to your hats!
  return guild.channels
   .filter(c => c.type === "text" &&
     c.permissionsFor(guild.client.user).has("SEND_MESSAGES"))
   .sort((a, b) => a.position - b.position ||
     Long.fromString(a.id).sub(Long.fromString(b.id)).toNumber())
   .first();
};

var test = false;
var intval = null;
var startmin = 0;
var currentmin = 0;
var testtimeStr = '21時30分';
var testtime = 213000;
var endtime = 7000;
var bot = new Eris(process.env.TOKEN);
var connection = null;

bot.on('ready', () => {
  console.log('Eris Bot is Online.');
  var dt = new Date();
  var formatted = dt.toFormat("YYYY-MM-DD HH24:MI:SS DDD");
  console.log(formatted);
});

bot.on('messageCreate', (msg) => {
  if (msg.content.toLowerCase() === 'キーパーテスト') {
    msg.channel.createMessage('テストモードを開始します！ ボイスチャンネルにどなたかが繋ぐとタイムキーパーが開始されます。');
    var _dt = new Date();
    var time = parseInt(_dt.toFormat("HH24MISS"));
    testtimeStr = '10秒後';
    testtime = time + 10;
    test = true;
    endtime = 500;
  }
});

// presenceUpdate というイベントは
// ユーザまたはrelationship(そのままですみません…)のステータスが変更された時、
// またはゲームが変更された時に発火します。
/*bot.on('presenceUpdate', (other, oldPresence) => {

  // Botが投稿するためのTextChannelを取得
  // TextChannelが１つの場合を想定しています。
  // 複数ある場合はchannel.id等で判別できます。
  const textChannel = other.guild.channels.find((channel) => channel.type === 0);
  const userName = other.user.username;

  if (other.game) { // ゲームが始まった時
    const gameName = other.game.name;
    bot.createMessage(textChannel.id, `${userName} が ${gameName} をはじめました`);
  } else if (oldPresence.game) { // ゲームを終了した時
    const gameName = oldPresence.game.name;
    //bot.createMessage(textChannel.id, `${userName} が ${gameName} を終了しました`);
  }
});*/

// voiceChannelJoin というイベントは
// ユーザが音声チャンネルに参加した時に発火します。
bot.on('voiceChannelJoin', (member, newChannel) => {
  if (null !== intval) {
    // 何もしない
    return;
  }
  const textChannel = newChannel.guild.channels.find((channel) => channel.type === 0 && (channel.name.indexOf('general') > -1 || channel.name.indexOf('test') > -1 || channel.name.indexOf('要塞戦') > -1));
  //const textChannel = getDefaultChannel(newChannel.guild);
  var dt = new Date();
  var formatted = dt.toFormat("YYYY-MM-DD HH24:MI:SS DDD");
  var dayLabel = dt.toFormat("DDD");
  var nowmin = parseInt(dt.toFormat("HH24MI"));
  console.log(dayLabel);
  if (true == (-1 < dayLabel.indexOf('Sat') && 2130 > nowmin) || true === test) {
    console.log('isa!');
    bot.createMessage(textChannel.id, '要塞戦タイムキーパーを起動します。\n要塞戦は ' + testtimeStr + 'に開始します。' + formatted);
    if (!connection) {
      bot.joinVoiceChannel(newChannel.id).then((con) => {
        con.on('end', () => {
          connection = con;
        });
      });
    }
    // 要塞戦は土曜日
    startmin = parseInt(dt.toFormat("MI"));
    var min = 0;
    currentmin = 0;
    intval = setInterval(function() {
      var _dt = new Date();
      var formatted = _dt.toFormat("YYYY-MM-DD HH24:MI:SS DDD");
      var time = parseInt(_dt.toFormat("HH24MISS"));
      min = parseInt(_dt.toFormat("MI")) - startmin;
      console.log("time keepping..." + min);
      if (time >= testtime + endtime) {
        // 要塞戦終了
        clearInterval(intval);
        intval = null;
        startmin = 0;
        min = 0;
        currentmin = 0;
        testtimeStr = '21時30分';
        testtime = 213000;
        endtime = 7000;
        test = false;
        bot.createMessage(textChannel.id, '要塞戦が終了しました。お疲れ様でした！ ' + formatted);
        if (connection) {
          bot.leaveVoiceChannel(connection.id);
        }
        connection = null;
        console.log("end time keeper");
      }
      else if (time > testtime && time < testtime+2) {
        // 要塞戦開始
        bot.createMessage(textChannel.id, '要塞戦が開始しました！ ' + formatted);
        min = parseInt(_dt.toFormat("MI")) - startmin;
      }
      else if (time > testtime+1 && min > currentmin ) {
        currentmin = min;
        if (connection) {
          //console.log(connection);
          console.log("voice play1");
          connection.play('https://cdn.glitch.com/f395e4d6-8f85-4ba7-9d9c-e3855593abc6%2F' + min + 'min.mp3');
        }
        else {
          console.log('Channel=');
          //console.log(newChannel);
          bot.joinVoiceChannel(newChannel.id).then((con) => {
            console.log('con=');
            //console.log(con);
            connection = con;
            console.log("voice play2");
            connection.play('https://cdn.glitch.com/f395e4d6-8f85-4ba7-9d9c-e3855593abc6%2F' + min + 'min.mp3');
          });
        }
        //bot.createMessage(textChannel.id, min + '分経過 ' + formatted);

      }

    }, 1000);
    console.log("start time keeper");
  }
  // const msg = `${member.username} が通話をはじめました ` + formatted;
  // bot.createMessage(textChannel.id, msg);
});

// // voiceChannelLeave というイベントは
// // ユーザが音声チャンネルから退出した時に発火します。
// bot.on("voiceChannelLeave", (member, oldChannel) => {
//   const textChannel = oldChannel.guild.channels.find((channel) => channel.type === 0);
//   const msg = `${member.username} が通話をやめました`;
//   bot.createMessage(textChannel.id, msg);
// });

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
});
app.listen(process.env.PORT);
setInterval(() => {
  http.get(`http://${process.env.PROJECT_DOMAIN}.glitch.me/`);
}, 280000);
