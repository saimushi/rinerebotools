// スプレッドシートキー
// CP管理用
const CP_SPREADSHEET_KEY = "";
// 出欠管理用
const AD_SPREADSHEET_KEY = "";

// イベント告知用WebhookURL
const discordhookid = "";
const discordhooktoken = "";

// テスト用
// https://discord.com/api/webhooks/777749056444563498/AsSsuW3T2DNTJ163dRwAmSKvD0ZIx3JKPQZzZ7238Ux5M23-bpIb5anN2S1yix558usa
//const discordhookid = "777749056444563498";
//const discordhooktoken = "AsSsuW3T2DNTJ163dRwAmSKvD0ZIx3JKPQZzZ7238Ux5M23-bpIb5anN2S1yix558usa";

// スプレッドシート操作用
const SpreadSheetService = require("./spreadSheetService");
// 認証情報jsonファイルを読み込む
const CREDIT = require("./serviceAccount.json");

// CP管理用スプシの認証
const cpSpreadSheetService = new SpreadSheetService(CP_SPREADSHEET_KEY);
cpSpreadSheetService.authorize(CREDIT);

// 出欠管理用スプシの認証
const adSpreadSheetService = new SpreadSheetService(AD_SPREADSHEET_KEY);
adSpreadSheetService.authorize(CREDIT);

const targetCols = [
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "AA",
  "AB",
  "AC",
  "AD",
  "AE",
  "AF",
  "AG",
  "AH",
  "AI",
  "AJ",
  "AK",
  "AL",
  "AM",
  "AN",
  "AO",
  "AP",
  "AQ",
  "AR",
  "AS",
  "AT",
  "AU",
  "AV",
  "AW",
  "AX",
  "AY",
  "AZ",
  "BA",
  "BB",
  "BC",
  "BD",
  "BE",
  "BF", 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL', 'BM', 'BN', 'BO', 'BP', 'BQ', 'BR', 'BS', 'BT', 'BU', 'BV', 'BW', 'BX', 'BY', 'BZ'
];

// 以下スクリプト
require("date-utils");
const crypto = require("crypto");
const _ = require("lodash");
const originalConsoleError = console.error;
console.error = function(msg) {
  if (_.startsWith(msg, "[vuex] unknown")) return;
  if (_.startsWith(msg, "Error: Could not parse CSS stylesheet")) return;
  originalConsoleError(msg);
};

const Eris = require("eris");
var bot = new Eris(process.env.TOKEN);

bot.on("ready", () => {
  console.log("Netmarble Bot is Online.");
  var dt = new Date();
  var formatted = dt.toFormat("YYYY-MM-DD HH24:MI:SS DDD");
  console.log(formatted);
});

bot.on("messageCreate", async msg => {
  var newcp = 0;
  console.log("bot=", msg.author.bot);
  if (true == msg.author.bot) {
    console.log("Botは無視");
    if (msg.channel.name == "イベント告知") {
      if (0 < msg.content.indexOf("EventID=[")) {
        console.log("でも出欠用リアクションボタンを初期配置はする！");
        // 出欠用リアクションボタンを初期配置
        msg.addReaction("☀️");
        msg.addReaction("🌤️");
        msg.addReaction("☁️");
        msg.addReaction("🌧️");
      }
    }
    return;
  }
  console.log("typeof msg.author.id=", typeof msg.author.id);
  if ("string" != typeof msg.author.id) {
    return;
  }
  const userId = msg.author.id;
  //console.log('msg=', msg);
  console.log("userId=", userId);
  console.log("msg.author.username=", msg.author.username);
  console.log("msg.author=", msg.author);
  msg.content = msg.content.replace(/　/g, " ");
  msg.content = msg.content.replace(/,/g, "");
  console.log("msg.content=", msg.content);
  console.log("msg.channel.name=", msg.channel.name);
  console.log(
    "bot.guildID=",
    bot.channelGuildMap[Object.keys(bot.channelGuildMap)[0]]
  );
  if (msg.channel.name == "戦闘力更新" && isFinite(msg.content) && 0 < parseInt(msg.content)) {
    // CP更新
    newcp = parseInt(msg.content);
    if (10000 > newcp) {
      newcp = newcp * 10000;
    }
    console.log("newcp=", newcp);
    msg.channel.createMessage(
      msg.author.username +
        "さんの戦闘力を" +
        newcp.toLocaleString() +
        "に更新しています・・・"
    );
    await cpSpreadSheetService.doc.loadInfo();
    const sheet = cpSpreadSheetService.doc.sheetsByTitle["DB"];
    await sheet.loadCells("C3:I80");
    try {
      for (var ridx = 3; ridx < 80; ridx++) {
        const discordIDData = sheet.getCellByA1("D" + ridx);
        //console.log("discordIDData.value=", discordIDData.value);
        if (discordIDData.value == userId) {
          console.log("tarbet row=D" + ridx);
          var cpData = sheet.getCellByA1("I" + ridx);
          console.log("cpData.value=" + cpData.value);
          cpData.value = newcp;
          var dateData = sheet.getCellByA1("E" + ridx);
          dateData.value = new Date().toFormat("YYYY/MM/DD HH24:MI:SS");
          await sheet.saveUpdatedCells();
          break;
        }
      }
    } catch (error) {
      console.error(error);
      await msg.channel.createMessage(
        "エラーにより更新が失敗しました・・・ネトマ運営にお問い合わせ下さい。"
      );
      return;
    }
    await msg.channel.createMessage("更新が正常に完了しました！");
    // CP更新エンド
    return;
  }
  else if (msg.channel.name == "装飾品魔力石更新") {
    var enhanceVal = 0;
    var maryokuseki = false;
    if (0 === msg.content.indexOf('魔力石抵抗 ')) {
      // 魔力石抵抗を更新
      enhanceVal = msg.content.replace('魔力石抵抗 ', '').trim();
      maryokuseki = '魔力石抵抗';
    }
    else if (0 === msg.content.indexOf('魔力石抵抗無視 ')) {
      // 魔力石抵抗無視を更新
      enhanceVal = msg.content.replace('魔力石抵抗無視 ', '').trim();
      maryokuseki = '魔力石抵抗無視';
    }
    else if (0 === msg.content.indexOf('抵抗無視')) {
      enhanceVal = msg.content.replace('抵抗無視', '').trim();
      maryokuseki = '魔力石抵抗無視';
    }
    else if (0 === msg.content.indexOf('抵抗')) {
      enhanceVal = msg.content.replace('抵抗', '').trim();
      maryokuseki = '魔力石抵抗';
    }
    enhanceVal = enhanceVal.replace(/[０-９]/g, function(s) {
      return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    });
    if (0 < enhanceVal && false !== maryokuseki) {
      msg.channel.createMessage(
        msg.author.username +
          "さんの" + maryokuseki + "値を" + enhanceVal + "に更新しています・・・"
      );
      await cpSpreadSheetService.doc.loadInfo();
      const sheet = cpSpreadSheetService.doc.sheetsByTitle["DB"];
      await sheet.loadCells("C3:AP80");
      try {
        for (var ridx = 3; ridx < 80; ridx++) {
          const discordIDData = sheet.getCellByA1("D" + ridx);
          //console.log("discordIDData.value=", discordIDData.value);
          if (discordIDData.value == userId) {
            console.log("tarbet row=D" + ridx);
            var maryokusekiData = 0;
            if ('魔力石抵抗' == maryokuseki) {
              maryokusekiData = sheet.getCellByA1('AO' + ridx);
            }
            if ('魔力石抵抗無視' == maryokuseki) {
              maryokusekiData = sheet.getCellByA1('AP' + ridx);
            }
            console.log("maryokusekiData.value=" + maryokusekiData.value);
            maryokusekiData.value = parseInt(enhanceVal);
            var dateData = sheet.getCellByA1("E" + ridx);
            dateData.value = new Date().toFormat("YYYY/MM/DD HH24:MI:SS");
            await sheet.saveUpdatedCells();
            break;
          }
        }
      } catch (error) {
        console.error(error);
        await msg.channel.createMessage(
          "エラーにより更新が失敗しました・・・ネトマ運営にお問い合わせ下さい。"
        );
        return;
      }
      await msg.channel.createMessage("更新が正常に完了しました！");
      // 魔力石更新更新エンド
      return;
    }

    if ('魔力石更新' === msg.content || '魔力石' === msg.content || 0 === msg.content.indexOf('魔力石 ')) {
      await msg.channel.createMessage(msg.author.username + "さんの魔力石強化値を更新します");
      var newmsg = await msg.channel.createMessage("表ネックレスの強化値は？");
      newmsg.addReaction('1️⃣');
      newmsg.addReaction('2️⃣');
      newmsg.addReaction('3️⃣');
      newmsg.addReaction('4️⃣');
      newmsg.addReaction('5️⃣');
      newmsg.addReaction('6️⃣');
      newmsg.addReaction('7️⃣');
      newmsg.addReaction('8️⃣');
      newmsg.addReaction('9️⃣');
      newmsg.addReaction('🔟');
      return;
    }
  }
  else if (msg.channel.name == "戦闘力更新") {
    // 武器コス更新
    var cosname = null;
    var coscolnum = 'U';
    var coslevel = '1';
    if (0 === msg.content.indexOf('ﾄﾘﾅｲ')) {
      cosname = 'トリナイ';
      coscolnum = 'AL';
      coslevel = msg.content.replace('ﾄﾘﾅｲ', '').trim();
    }
    else if (0 === msg.content.indexOf('トリナイ')) {
      cosname = 'トリナイ';
      coscolnum = 'AL';
      coslevel = msg.content.replace('トリナイ', '').trim();
    }
    else if (0 === msg.content.indexOf('トリッキーナイト')) {
      cosname = 'トリナイ';
      coscolnum = 'AL';
      coslevel = msg.content.replace('トリッキーナイト', '').trim();
    }
    else if (0 === msg.content.indexOf('トリッキー')) {
      cosname = 'トリナイ';
      coscolnum = 'AL';
      coslevel = msg.content.replace('トリッキー', '').trim();
    }
    else if (0 === msg.content.indexOf('陰陽師')) {
      cosname = '陰陽師';
      coscolnum = 'AJ';
      coslevel = msg.content.replace('陰陽師', '').trim();
    }
    else if (0 === msg.content.indexOf('EDM')) {
      cosname = 'EDM';
      coscolnum = 'AK';
      coslevel = msg.content.replace('EDM', '').trim();
    }
    else if (0 === msg.content.indexOf('妖怪')) {
      cosname = '妖怪';
      coscolnum = 'U';
      coslevel = msg.content.replace('妖怪', '').trim();
    }
    else if (0 === msg.content.indexOf('百鬼')) {
      cosname = '妖怪';
      coscolnum = 'U';
      coslevel = msg.content.replace('百鬼', '').trim();
    }
    if (null == cosname) {
      return;
    }
    coslevel = coslevel.replace(/[０-９]/g, function(s) {
      return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    });

    msg.channel.createMessage(
      msg.author.username +
        "さんの" + cosname + "武器コスレベルを" + coslevel + "に更新しています・・・"
    );
    await cpSpreadSheetService.doc.loadInfo();
    const sheet = cpSpreadSheetService.doc.sheetsByTitle["DB"];
    await sheet.loadCells("C3:AN80");
    try {
      for (var ridx = 3; ridx < 80; ridx++) {
        const discordIDData = sheet.getCellByA1("D" + ridx);
        //console.log("discordIDData.value=", discordIDData.value);
        if (discordIDData.value == userId) {
          console.log("tarbet row=D" + ridx);
          var cosData = sheet.getCellByA1(coscolnum + ridx);
          console.log("cosData.value=" + cosData.value);
          cosData.value = parseInt(coslevel);
          var dateData = sheet.getCellByA1("E" + ridx);
          dateData.value = new Date().toFormat("YYYY/MM/DD HH24:MI:SS");
          await sheet.saveUpdatedCells();
          break;
        }
      }
    } catch (error) {
      console.error(error);
      await msg.channel.createMessage(
        "エラーにより更新が失敗しました・・・ネトマ運営にお問い合わせ下さい。"
      );
      return;
    }
    await msg.channel.createMessage("更新が正常に完了しました！");
    // 武器コス更新エンド
    return;
  }
  else if (msg.channel.name == "イベント登録") {
    if (0 === msg.content.indexOf("イベント登録\n")) {
      // イベント登録
      var event = {
        日付: "",
        開始時間: "",
        種別: "",
        相手血盟: "",
        map: "",
        バフ: "",
        部屋立て: ""
      };
      const lines = msg.content.split("\n");
      console.log("lines=", lines);
      for (const index in lines) {
        const line = lines[index];
        console.log("line=", line);
        const data = line.split(": ");
        console.log("data=", data);
        if (0 === data[0].indexOf("※")) {
          data[0] = data[0].replace("※", "");
        }
        event[data[0]] = data[1];
      }
      var eventTitle =
        event["日付"] +
        " " +
        event["開始時間"] +
        " " +
        event["種別"];
      // イベントタイトルから一意のイベントIDを生成
      const shasum = crypto.createHash("sha1");
      shasum.update(eventTitle);
      const eventID = shasum.digest("hex");
      console.log("eventID=", eventID);
      event["イベントID"] = eventID;
      console.log("event=", event);
      await msg.channel.createMessage(
        eventTitle + ' ' + event["相手血盟"] + "\nこの情報でイベント登録をしています・・・"
      );

      /*
      var targetChannelID = 0;
      bot.guilds.forEach(function(element, index, array) {
        console.log("bot.guilds.channels=", element.channels);
        element.channels.forEach(function(_element, _index, _array) {
          console.log("channel.name=", _element.name);
          if (_element.name == "イベント告知") {
            targetChannelID = _element.id;
          }
        });
      });
      console.log("targetChannelID=", targetChannelID);
      */

      var updated = false;
      await adSpreadSheetService.doc.loadInfo();
      const sheet = adSpreadSheetService.doc.sheetsByTitle["イベントRef"];
      const rows = await sheet.getRows();
      for (var ridx = 0; ridx < rows.length; ridx++) {
        const row = rows[ridx];
        console.log("row=", row["イベントID"]);
        if (row["イベントID"] == eventID) {
          // すでに同じイベントIDの行があれば手動更新とる
          //await row.delete();
          updated = true;
        }
      }

      if (false === updated) {
        const eventcontent =
          "@everyone \n■" +
          event["日付"] +
          " " +
          event["開始時間"] +
          "\n" +
          event["種別"] +
          " " +
          event["相手血盟"] +
          "\nEventID=[" +
          event["イベントID"] +
          "]\n☀️ = 参加・VC OK！\n🌤️ = 参加・聞き専\n☁️ = 未定\n🌧️ = 欠席";
        //const meesage = await bot.createMessage(targetChannelID, { allowedMentions: { everyone: true, }, content: );
        try {
          const meesage = await bot.executeWebhook(
            discordhookid,
            discordhooktoken,
            { wait: true, disableEveryone: false, content: eventcontent }
          );
          console.log("meesage=", meesage);
          event["チャンネルID"] = meesage.channel_id;
          event["メッセージID"] = meesage.id;;
        } catch (error) {
          console.error("error=", error);
        }
        console.log("add event=", event);
        const sundar = await sheet.addRow(event);
        await msg.channel.createMessage("イベントを登録しました！");
      }
      else {
        await msg.channel.createMessage("イベント情報の更新は手動で行って下さい。\nhttps://docs.google.com/spreadsheets/d/xxxx/edit?usp=sharing\n[イベントRef]シートを編集して下さい。");
      }
      return;
    }
    if (-1 < msg.content.indexOf("登録したい")) {
      // 登録テンプレートを返却
      await msg.channel.createMessage(
        "以下の登録テンプレートをコピーして、該当項目を埋めて再度投稿して下さい。"
      );
      await msg.channel.createMessage(
        "イベント登録\n※日付: " +
          new Date().toFormat("MM/DD") +
          "\n※開始時間: 22:30\n※種別: 要塞戦｜攻城戦｜全鯖城1｜全鯖城2｜全鯖城3｜要塞大戦\n相手血盟: ネトマ団\nmap: 新2｜旧2｜新1旧1｜等\nバフ: あり｜なし｜ハンデ戦｜等\n部屋立て: あっち｜こっち｜等"
      );
      await msg.channel.createMessage("(※の付いた項目は必須登録項目です。)");
      return;
    }
  }
  return;
});

bot.on("messageReactionAdd", async (msg, emoji, userId) => {
  console.log("messageReactionAdd - userId=", userId);
  if ('' + userId == '' + bot.user.id) {
    console.log("messageReactionAdd - Botは無視");
    return;
  }
  console.log("msg=", msg);
  console.log("emoji=", emoji);
  console.log("userId=", userId);
  console.log("channelID=", msg.channel.id);
  console.log("msgID=", msg.id);
  const targetMessage = await bot.getMessage(msg.channel.id, msg.id);
  console.log("targetMessage.content=", targetMessage.content);
  var ad = undefined;
  var vc = false;
  var enhancePoint = 0;
  if (emoji.name == '1️⃣') {
    enhancePoint = 1;
  }
  if (emoji.name == '2️⃣') {
    enhancePoint = 2;
  }
  if (emoji.name == '3️⃣') {
    enhancePoint = 3;
  }
  if (emoji.name == '4️⃣') {
    enhancePoint = 4;
  }
  if (emoji.name == '5️⃣') {
    enhancePoint = 5;
  }
  if (emoji.name == '6️⃣') {
    enhancePoint = 6;
  }
  if (emoji.name == '7️⃣') {
    enhancePoint = 7;
  }
  if (emoji.name == '8️⃣') {
    enhancePoint = 8;
  }
  if (emoji.name == '9️⃣') {
    enhancePoint = 9;
  }
  if (emoji.name == '🔟') {
    enhancePoint = 10;
  }
  console.log("enhancePoint=", enhancePoint);
  if (0 < enhancePoint) {
    // 魔力石の更新
    console.log("update enhancePoint!");
    await targetMessage.removeReactions();
    if (0 <= targetMessage.content.indexOf('表ネックレス')) {
      targetMessage.edit('表イヤリング1の強化値は？');
    }
    else if (0 <= targetMessage.content.indexOf('表イヤリング1')) {
      targetMessage.edit('表イヤリング2の強化値は？');
    }
    else if (0 <= targetMessage.content.indexOf('表イヤリング2')) {
      targetMessage.edit('表リング1の強化値は？');
    }
    else if (0 <= targetMessage.content.indexOf('表リング1')) {
      targetMessage.edit('表リング2の強化値は？');
    }
    else if (0 <= targetMessage.content.indexOf('表リング2')) {
      targetMessage.edit('裏ネックレスの強化値は？');
    }
    else if (0 <= targetMessage.content.indexOf('裏ネックレス')) {
      targetMessage.edit('裏イヤリング1の強化値は？');
    }
    else if (0 <= targetMessage.content.indexOf('裏イヤリング1')) {
      targetMessage.edit('裏イヤリング2の強化値は？');
    }
    else if (0 <= targetMessage.content.indexOf('裏イヤリング2')) {
      targetMessage.edit('裏リング1の強化値は？');
    }
    else if (0 <= targetMessage.content.indexOf('裏リング1')) {
      targetMessage.edit('裏リング2の強化値は？');
    }
    else if (0 <= targetMessage.content.indexOf('裏リング2')) {
      targetMessage.edit('データを更新しました！');
      return;
    }
    targetMessage.addReaction('1️⃣');
    targetMessage.addReaction('2️⃣');
    targetMessage.addReaction('3️⃣');
    targetMessage.addReaction('4️⃣');
    targetMessage.addReaction('5️⃣');
    targetMessage.addReaction('6️⃣');
    targetMessage.addReaction('7️⃣');
    targetMessage.addReaction('8️⃣');
    targetMessage.addReaction('9️⃣');
    targetMessage.addReaction('🔟');
    return;
  }

  // 出欠リアクションチェック
  if (emoji.name == "🌧️") {
    console.log("欠席");
    ad = false;
    // リアクションの複数回答を許可しないので消込を行う
    var reactions = await targetMessage.getReaction("☁️");
    console.log("reactions=", reactions);
    for (var reidx = 0; reidx < reactions.length; reidx++) {
      if (userId == reactions[reidx].id) {
        await targetMessage.removeReaction("☁️", reactions[reidx].id);
      }
    }
    var reactions = await targetMessage.getReaction("🌤️");
    console.log("reactions=", reactions);
    for (var reidx = 0; reidx < reactions.length; reidx++) {
      if (userId == reactions[reidx].id) {
        await targetMessage.removeReaction("🌤️", reactions[reidx].id);
      }
    }
    var reactions = await targetMessage.getReaction("☀️");
    console.log("reactions=", reactions);
    for (var reidx = 0; reidx < reactions.length; reidx++) {
      if (userId == reactions[reidx].id) {
        await targetMessage.removeReaction("☀️", reactions[reidx].id);
      }
    }
  } else if (emoji.name == "☁️") {
    console.log("未定");
    ad = null;
    // リアクションの複数回答を許可しないので消込を行う
    var reactions = await targetMessage.getReaction("🌧️");
    console.log("reactions=", reactions);
    for (var reidx = 0; reidx < reactions.length; reidx++) {
      if (userId == reactions[reidx].id) {
        await targetMessage.removeReaction("🌧️", reactions[reidx].id);
      }
    }
    var reactions = await targetMessage.getReaction("🌤️");
    console.log("reactions=", reactions);
    for (var reidx = 0; reidx < reactions.length; reidx++) {
      if (userId == reactions[reidx].id) {
        await targetMessage.removeReaction("🌤️", reactions[reidx].id);
      }
    }
    var reactions = await targetMessage.getReaction("☀️");
    console.log("reactions=", reactions);
    for (var reidx = 0; reidx < reactions.length; reidx++) {
      if (userId == reactions[reidx].id) {
        await targetMessage.removeReaction("☀️", reactions[reidx].id);
      }
    }
  } else if (emoji.name == "🌤️") {
    console.log("参加・聞き専");
    ad = true;
    // リアクションの複数回答を許可しないので消込を行う
    var reactions = await targetMessage.getReaction("🌧️");
    console.log("reactions=", reactions);
    for (var reidx = 0; reidx < reactions.length; reidx++) {
      if (userId == reactions[reidx].id) {
        await targetMessage.removeReaction("🌧️", reactions[reidx].id);
      }
    }
    var reactions = await targetMessage.getReaction("☁️");
    console.log("reactions=", reactions);
    for (var reidx = 0; reidx < reactions.length; reidx++) {
      if (userId == reactions[reidx].id) {
        await targetMessage.removeReaction("☁️", reactions[reidx].id);
      }
    }
    var reactions = await targetMessage.getReaction("☀️");
    console.log("reactions=", reactions);
    for (var reidx = 0; reidx < reactions.length; reidx++) {
      if (userId == reactions[reidx].id) {
        await targetMessage.removeReaction("☀️", reactions[reidx].id);
      }
    }
  } else if (emoji.name == "☀️") {
    console.log("出席・VC可");
    ad = true;
    vc = true;
    // リアクションの複数回答を許可しないので消込を行う
    var reactions = await targetMessage.getReaction("🌧️");
    console.log("reactions=", reactions);
    for (var reidx = 0; reidx < reactions.length; reidx++) {
      if (userId == reactions[reidx].id) {
        await targetMessage.removeReaction("🌧️", reactions[reidx].id);
      }
    }
    var reactions = await targetMessage.getReaction("☁️");
    console.log("reactions=", reactions);
    for (var reidx = 0; reidx < reactions.length; reidx++) {
      if (userId == reactions[reidx].id) {
        await targetMessage.removeReaction("☁️", reactions[reidx].id);
      }
    }
    var reactions = await targetMessage.getReaction("🌤️");
    console.log("reactions=", reactions);
    for (var reidx = 0; reidx < reactions.length; reidx++) {
      if (userId == reactions[reidx].id) {
        await targetMessage.removeReaction("🌤️", reactions[reidx].id);
      }
    }
  }
  if (undefined !== ad) {
    setTimeout(async function() {
      try {
        const eventlines = targetMessage.content.split("\n");
        var eventID = eventlines[3].split("[")[1];
        eventID = eventID.slice(0, -1);
        console.log("eventID=", eventID);
        await adSpreadSheetService.doc.loadInfo();
        const sheet = adSpreadSheetService.doc.sheetsByTitle["出欠"];
        await sheet.loadCells("C1:BZ115");
        var { colname, rowindex } = getTargetColRows(sheet, eventID, userId);
        console.log("eventID=", eventID);
        console.log("colname=", colname);
        console.log("rowindex=", rowindex);

        if ("string" == typeof colname && 0 < parseInt(rowindex)) {
          var adData = sheet.getCellByA1(colname + rowindex);
          console.log("adData.value=" + adData.value);
          if (ad === true) {
            adData.value = "〇";
          } else if (ad === null) {
            adData.value = "△";
          } else if (ad === false) {
            adData.value = "×";
          }
          var vcData = sheet.getCellByA1(colname + (rowindex + 1));
          console.log("vcData.value=" + vcData.value);
          if (vc === true) {
            vcData.value = "喋";
          } else {
            vcData.value = "聞";
          }
          if (ad === false) {
            vcData.value = "";
          }
          await sheet.saveUpdatedCells();
        }
      } catch (error) {
        console.error(error);
        /*await msg.channel.createMessage(
          "エラーにより更新が失敗しました・・・ネトマ運営にお問い合わせ下さい。"
        );*/
        return;
      }
    }, 5000);
  }
  return;
});

bot.on("messageReactionRemove", async (msg, emoji, userId) => {
  //if (userId == '776340580577837087') {
  if ('' + userId == '' + bot.user.id) {
    console.log("messageReactionRemove - Botは無視");
    return;
  }
  console.log("msg=", msg);
  console.log("emoji=", emoji);
  console.log("userId=", userId);
  var ad = undefined;
  if (emoji.name == "🌧️") {
    console.log("欠席");
    ad = false;
  } else if (emoji.name == "☁️") {
    console.log("未定");
    ad = null;
  } else if (emoji.name == "🌤️") {
    console.log("参加・聞き専");
    ad = true;
  } else if (emoji.name == "☀️") {
    console.log("出席・VC可");
    ad = true;
  }
  if (undefined !== ad) {
    try {
      const targetMessage = await bot.getMessage(msg.channel.id, msg.id);
      console.log("targetMessage.content=", targetMessage.content);
      const eventlines = targetMessage.content.split("\n");
      var eventID = eventlines[3].split("[")[1];
      eventID = eventID.slice(0, -1);
      console.log("eventID=", eventID);
      await adSpreadSheetService.doc.loadInfo();
      const sheet = adSpreadSheetService.doc.sheetsByTitle["出欠"];
      await sheet.loadCells("C1:BZ115");
      var { colname, rowindex } = getTargetColRows(sheet, eventID, userId);
      console.log("eventID=", eventID);
      console.log("colname=", colname);
      console.log("rowindex=", rowindex);
      if ("string" == typeof colname && 0 < parseInt(rowindex)) {
        var adData = sheet.getCellByA1(colname + rowindex);
        console.log("adData.value=" + adData.value);
        adData.value = "";
        var vcData = sheet.getCellByA1(colname + (rowindex + 1));
        console.log("vcData.value=" + vcData.value);
        vcData.value = "";
        await sheet.saveUpdatedCells();
      }
    } catch (error) {
      console.error(error);
      /*await msg.channel.createMessage(
        "エラーにより更新が失敗しました・・・ネトマ運営にお問い合わせ下さい。"
      );*/
      return;
    }
  }
  return;
});

bot.connect().catch(err => {
  console.log(`Logging in error:\n${err}`);
});

const http = require("http");
const express = require("express");
const app = express();
app.get("/", async (request, response) => {
  console.log(Date.now() + " Ping Received");
  response.sendStatus(200);
  var date = new Date();
  var time = date.toFormat("HH24MI");
  console.log(time + " Ping Received");

  // 出欠の最集計処理も一緒に実施
  // XXX リアクションボタンは処理が重くて取りこぼしが多々発生しているのでここでいい気に修正する
  // 先ずはイベントRefシートからデータ更新対象のイベントを探す
  await adSpreadSheetService.doc.loadInfo();
  const adsheet = adSpreadSheetService.doc.sheetsByTitle["イベントRef"];
  const rows = await adsheet.getRows();
  var today = new Date().toFormat("YYYY/MM/DD");
  const todays = today.split('/');
  today = parseInt(todays[0] + '' + todays[1] + '' + todays[2]);
  console.log("today=", today);

  var yestdate = new Date();
  yestdate.setDate(yestdate.getDate() + 1);
  var yestday = yestdate.toFormat("YYYY/MM/DD");
  const yestdays = yestday.split('/');
  yestday = parseInt(yestdays[0] + '' + yestdays[1] + '' + yestdays[2]);
  console.log("yestday=", yestday);

  console.log("bot.user.id=", bot.user.id);

  var sheet = null;

  for (var ridx = 0; ridx < rows.length; ridx++) {
    const row = rows[ridx];
    // チャンネルIDとメッセージIDがあるもの限定
    if (0 < row["チャンネルID"] && 0 < row["メッセージID"]) {
      // 今日含めて日付が未来日のものだけが対象
      console.log("row=", row["日付"]);
      var dates = row["日付"].split('/');
      if (2020 > dates[0]) {
        dates.unshift(todays[0]);
      }
      if (2 > dates[1].length) {
        dates[1] = '0' + dates[1];
        // XXX 今だけ矯正来年 2021年中しか保たないコード 2022年にはエラーになるが・・・まぁ2022年とかリネ無いだろ
        dates[0] = '2021';
      }
      else {
        dates[0] = '2020';
      }
      if (2 > dates[2].length) {
        dates[2] = '0' + dates[2];
      }
      const day = parseInt(dates[0] + '' + dates[1] + '' + dates[2]);
      console.log("row day=", day);
      if (today <= day) {
        // 仮処理対象
        console.log("recover=", row["チャンネルID"] + ' & ' + row["メッセージID"]);
        const channelID = row["チャンネルID"];
        const messageID = row["メッセージID"];
        const targetMessage = await bot.getMessage(channelID, messageID);
        //console.log("targetMessage=", targetMessage);
        console.log("targetMessage.content=", targetMessage.content);
        const targetMessages = targetMessage.content.split("\n");
        const eventID = targetMessages[3].split("[")[1].slice(0, -1);
        const eventName = targetMessages[1] + ' ' + targetMessages[2] + '\nEventID = [' + eventID + ']\n';
        console.log("eventID=", eventID);
        console.log("eventName=", eventName);
        console.log("channelID=", channelID);
        console.log("messageID=", messageID);

        // 参加VC可リアクション一覧の取得
        const vcokReactions = await targetMessage.getReaction("☀️");
        console.log("vcokReactions=", vcokReactions.length);

        // 参加VC不可リアクション一覧の取得
        const vcngReactions = await targetMessage.getReaction("🌤️");
        console.log("vcngReactions=", vcngReactions.length);

        // 参加未定リアクション一覧の取得
        const unfixedReactions = await targetMessage.getReaction("☁️");
        console.log("unfixedReactions=", unfixedReactions.length);

        // 欠席リアクション一覧の取得
        const ngReactions = await targetMessage.getReaction("🌧️");
        console.log("ngReactions=", ngReactions.length);

        if (!sheet) {
          var sheet = adSpreadSheetService.doc.sheetsByTitle["出欠"];
          await sheet.loadCells("C1:BZ115");
        }

        // イベント列を特定する
        var colname = null;
        for (var rcidx = 0; rcidx < targetCols.length; rcidx++) {
          //console.log("targetCols=", targetCols[rcidx] + "1");
          var eventidData = sheet.getCellByA1(targetCols[rcidx] + "1");
          if (eventidData.value == eventID) {
            colname = targetCols[rcidx];
            break;
          }
        }
        console.log("colname=", colname);

        if (null != colname) {

          // リアクション数と実出欠数が合っていなければリカバリー対象確定
          var vcokCountData = sheet.getCellByA1(colname + "113");
          var unfixedCountData = sheet.getCellByA1(colname + "114");
          var ngCountData = sheet.getCellByA1(colname + "115");
          console.log("vcokCountData=", vcokCountData.value);
          console.log("unfixedCountData=", unfixedCountData.value);
          console.log("ngCountData=", ngCountData.value);
          if (vcokCountData.value != (vcokReactions.length + vcngReactions.length - 2)
            || unfixedCountData.value != (unfixedReactions.length - 1)
            || ngCountData.value != (ngReactions.length - 1)
          ) {

            console.log("vcokReactions=", (vcokReactions.length + vcngReactions.length - 2));
            console.log("unfixedReactions=", (unfixedReactions.length - 1));
            console.log("ngReactions=", (ngReactions.length - 1));

            // リアクション数と実数が一致するまでずっと処理対象
            try {

              // 対象の全てのUserIDを取得
              var allUserIDs = {};
              for (var ridx = 13; ridx < 112; ridx++) {
                const discordIDData = sheet.getCellByA1("C" + ridx);
                allUserIDs[discordIDData.value] = false;
              }
              console.log("allUserIDs=", allUserIDs);

              // 参加VC可リアクション一括修正
              for (var reidx = 0; reidx < vcokReactions.length; reidx++) {
                const userId = vcokReactions[reidx].id;
                var { colname, rowindex } = getTargetColRows(sheet, eventID, userId);
                if (rowindex) {
                  const adData = sheet.getCellByA1(colname + rowindex);
                  adData.value = "〇";
                  const vcData = sheet.getCellByA1(colname + (rowindex + 1));
                  vcData.value = "喋";
                  // 処理済みをマーク
                  allUserIDs[userId] = true;
                }
              }

              // 参加VC不可リアクション一括修正
              for (var reidx = 0; reidx < vcngReactions.length; reidx++) {
                const userId = vcngReactions[reidx].id;
                var { colname, rowindex } = getTargetColRows(sheet, eventID, userId);
                if (rowindex) {
                  const adData = sheet.getCellByA1(colname + rowindex);
                  adData.value = "〇";
                  const vcData = sheet.getCellByA1(colname + (rowindex + 1));
                  vcData.value = "聞";
                  // 処理済みをマーク
                  allUserIDs[userId] = true;
                }
              }

              // 参加未定リアクション一括修正
              for (var reidx = 0; reidx < unfixedReactions.length; reidx++) {
                const userId = unfixedReactions[reidx].id;
                var { colname, rowindex } = getTargetColRows(sheet, eventID, userId);
                if (rowindex) {
                  const adData = sheet.getCellByA1(colname + rowindex);
                  adData.value = "△";
                  const vcData = sheet.getCellByA1(colname + (rowindex + 1));
                  vcData.value = "";
                  // 処理済みをマーク
                  allUserIDs[userId] = true;
                }
              }

              // 欠席リアクション一括修正
              for (var reidx = 0; reidx < ngReactions.length; reidx++) {
                const userId = ngReactions[reidx].id;
                var { colname, rowindex } = getTargetColRows(sheet, eventID, userId);
                if (rowindex) {
                  const adData = sheet.getCellByA1(colname + rowindex);
                  adData.value = "×";
                  const vcData = sheet.getCellByA1(colname + (rowindex + 1));
                  vcData.value = "";
                  // 処理済みをマーク
                  allUserIDs[userId] = true;
                }
              }

              // 未表明修正を拾う
              for (const _userId in allUserIDs) {
                if (false === allUserIDs[_userId]) {
                  //console.log("who??=", _userId);
                  var { colname, rowindex } = getTargetColRows(sheet, eventID, _userId);
                  if (rowindex) {
                    const adData = sheet.getCellByA1(colname + rowindex);
                    adData.value = "";
                    const vcData = sheet.getCellByA1(colname + (rowindex + 1));
                    vcData.value = "";
                  }
                }
              }
              // シート更新
              await sheet.saveUpdatedCells();
              const meesage = await bot.executeWebhook(
                '777749056444563498',
                'xxxx',
                { wait: true, disableEveryone: false, content: eventName + 'の出欠のリカバリーが成功しました！' }
              );
            }
            catch (error) {
              console.error(error);
              const meesage = await bot.executeWebhook(
                '777749056444563498',
                'xxxx',
                { wait: true, disableEveryone: false, content: '@everyone ' + eventName + 'の出欠のリカバリーに失敗したみたい！' }
              );
              return;
            }
          }

          // イベント当日の未表明者にはDMを送る処理を更に実行
          var nowhour = (new Date().toFormat("HH24MI")).slice(0, -1);
          console.log("nowhour=", nowhour);
          if (true == ('' + dates[2] == todays[2] || '' + dates[2] == yestdays[2]) && true == (nowhour == '190' || nowhour == '000' || nowhour == '120')) {
            if (!allUserIDs) {
              allUserIDs = {};
              // 対象の全てのUserIDを取得
              for (var ridx = 13; ridx < 112; ridx++) {
                const discordIDData = sheet.getCellByA1("C" + ridx);
                allUserIDs[discordIDData.value] = false;
              }
            }
            for (var reidx = 0; reidx < vcokReactions.length; reidx++) {
              allUserIDs[vcokReactions[reidx].id] = true;
            }
            for (var reidx = 0; reidx < vcngReactions.length; reidx++) {
              allUserIDs[vcngReactions[reidx].id] = true;
            }
            for (var reidx = 0; reidx < ngReactions.length; reidx++) {
              allUserIDs[ngReactions[reidx].id] = true;
            }
            var dmCnt = 0;
            for (const dmTargetUserId in allUserIDs) {
              if (false === allUserIDs[dmTargetUserId]) {
                dmCnt++;
                // まだ未表明なのでDM対象
                console.log("DMTarget userID=", dmTargetUserId);
                //const dmchannel = member.user.getDMChannel();
                const dmchannel = await bot.getDMChannel(dmTargetUserId);
                console.log("DMCheck dmchannel=", dmchannel);
                if (dmchannel /*&& '' + dmTargetUserId == '' + 375149832362393600*/) {
                  try {
                    await dmchannel.createMessage(eventName + 'の出欠がまだ出ていません！ 出欠リアクションをお願いします！！\n=> https://discord.com/channels/776290711590010910/' + channelID + '/' + messageID);
                  }
                  catch (dmerror) {
                    console.error('dmerror=', dmerror);
                  }
                }
              }
            }
            console.log("DMtarget cnt=", dmCnt);
            if (0 < dmCnt) {
              const meesage = await bot.executeWebhook(
                '777749056444563498',
                'xxxx',
                { wait: true, disableEveryone: false, content: eventName + 'の出欠について ' + dmCnt + '件の催促DMを送りました！' }
              );
            }
          }
        }
      }
    }
  }
});
app.listen(process.env.PORT);

var getTargetColRows = function(sheet, eventID, userID) {
  // イベント列を特定する
  var colname = null;
  for (var rcidx = 0; rcidx < targetCols.length; rcidx++) {
    //console.log("targetCols=", targetCols[rcidx] + "1");
    var eventidData = sheet.getCellByA1(targetCols[rcidx] + "1");
    if (eventidData.value == eventID) {
      colname = targetCols[rcidx];
      break;
    }
  }
  var rowindex = null;
  for (var ridx = 13; ridx < 112; ridx++) {
    const discordIDData = sheet.getCellByA1("C" + ridx);
    //console.log("check discordIDData.value=", discordIDData.value);
    //console.log("check userID=", userID);
    if (discordIDData.value == userID || '' + discordIDData.value == '' + userID) {
      rowindex = ridx;
      break;
    }
  }
  //console.log("checked return=", { colname: colname, rowindex: rowindex });
  return { colname: colname, rowindex: rowindex };
};
