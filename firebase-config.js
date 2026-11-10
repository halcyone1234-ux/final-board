/* 設定檔：沿用星座問卷的 Firebase 專案（zodiac-af366），資料放在 board/<班級代碼> 之下，與 classes/、quiz/ 互不干擾。
   apiKey 仍是 YOUR_… 時，網站會自動改用「本機測試模式」（資料只存在這台瀏覽器）；網址加 ?mock=1 也可強制本機模式試跑。 */
window.FB_CONFIG = {
  firebase: {
    apiKey: 'AIzaSyAcJtTlBhu2AUHqt2vRddxoh2XxIPJeSGs',
    authDomain: 'zodiac-af366.firebaseapp.com',
    databaseURL: 'https://zodiac-af366-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'zodiac-af366',
    appId: '1:728813141842:web:d791a2425d1de1e7abc48b',
  },
  adminPin: '1151',              /* 老師模式 PIN（只在前端把關） */
  defaultClassId: '1151-final',  /* 班級代碼；網址加 ?c=別的代碼 可開新班 */
  teacherName: '王思永老師',
};
